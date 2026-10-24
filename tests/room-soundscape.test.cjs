const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomSoundscape,soundRegion}=load('RoomSoundscape');
const {LIGHTHOUSE}=load('LighthouseLayout'),{COASTAL_SITE:{tower}}=load('CoastalSite');
const base=()=>({firstPerson:true,x:14,y:2.2,feet:0,yaw:0,shoreDistance:12,
  weather:{rain:0,kind:'clear',from:'clear',transition:1},pauses:[],doors:{},
  scooter:{riding:false,speed:0,heading:0,forward:false,back:false,brake:false,exitRequested:false}});
function fixture(){let targets=[];const events=[],stops=[],sink={world:t=>targets=t,resetWorld:()=>targets=[],stopEntity:id=>stops.push(id),play:(...args)=>events.push(args)};
  const controller=new RoomSoundscape(sink),state=base();
  const step=(n=100)=>{for(let i=0;i<n;i++)controller.update(.04,state);return targets;};
  return {controller,state,step,events,stops,gain:id=>targets.find(t=>t.id===id)?.gain||0,targets:()=>targets};}
test('regions match house/window/door, tower/lantern/gallery and service footprints with hysteresis',()=>{
  const s=base();Object.assign(s,{x:7,y:5,feet:0});assert.equal(soundRegion(s),'house');
  s.x=10.85;assert.equal(soundRegion(s,'house'),'house');s.x=11.01;assert.equal(soundRegion(s,'house'),'outside');
  Object.assign(s,{x:8,y:11.3});assert.equal(soundRegion(s),'balcony');
  Object.assign(s,{x:tower.x,y:tower.y,feet:LIGHTHOUSE.floor});assert.equal(soundRegion(s),'tower');
  s.feet=LIGHTHOUSE.gallery;assert.equal(soundRegion(s),'lantern');s.x+=2.6;assert.equal(soundRegion(s),'gallery');
  Object.assign(s,{x:tower.x-5.1,y:tower.y+5.9,feet:tower.ground+.04});assert.equal(soundRegion(s),'service');
  s.firstPerson=false;assert.equal(soundRegion(s),'outside');
});
test('actual speed controls loops, coasting is softer, real braking is one-shot and zero speed is silent',()=>{
  const f=fixture();f.state.scooter.riding=true;f.state.scooter.forward=true;f.step();assert.equal(f.gain('motor-loop'),0);
  f.state.scooter.speed=5;f.step();const powered=f.gain('motor-loop');assert.ok(powered>0&&f.gain('roll-loop')>0);
  const ridingWind=f.gain('wind-open');f.state.scooter.speed=10;f.step();assert.ok(f.gain('wind-open')>ridingWind,'headwind shares the weather wind layer and rises with actual speed');
  f.state.scooter.speed=5;f.step();
  f.state.scooter.forward=false;f.step();assert.ok(f.gain('motor-loop')<powered);
  f.state.scooter.brake=true;f.state.scooter.speed=4.5;f.step(1);f.step(10);assert.equal(f.events.length,1);
  f.state.scooter.speed=0;f.step(1);assert.equal(f.gain('motor-loop'),0);assert.equal(f.gain('roll-loop'),0);
  f.step();assert.equal(f.events.length,1,'standing brake never repeats');
  f.state.scooter.brake=false;f.state.scooter.speed=-.7;f.state.scooter.back=true;f.step();assert.ok(f.gain('motor-loop')>0);
  assert.ok(f.targets().every(t=>!t.rate || t.rate>=.5&&t.rate<=2));
});
test('weather follows the interpolated rain/from/kind; doors/windows reveal exterior without indoor full rain',()=>{
  const f=fixture();f.step();const clear=f.gain('wind-open');
  f.state.weather={rain:.5,from:'clear',kind:'storm',transition:.5};f.step();
  assert.ok(f.gain('rain-open')>0);assert.ok(f.gain('wind-open')>clear);assert.equal(f.controller.diagnostics.wind,.525);
  const outdoorRain=f.gain('rain-open');Object.assign(f.state,{x:7,y:5});f.step(160);
  assert.ok(f.gain('rain-open')<outdoorRain*.05);assert.ok(f.gain('rain-sheltered')>f.gain('rain-open'));
  Object.assign(f.state,{x:10.25,y:4.65});f.step(160);const closed=f.gain('wind-open');
  f.state.doors['entry-door']=1;f.step(160);assert.ok(f.gain('wind-open')>closed);
  f.state.weather={rain:0,kind:'fog',from:'fog',transition:1};f.step(40);assert.ok(f.gain('rain-open')<.0008&&f.gain('rain-sheltered')<.0008,'forced rain removal settles within 1.6 seconds');
});
test('pause types distinguish low reading ambience from silent world; old speed is not resumed',()=>{
  const f=fixture();f.state.scooter={...f.state.scooter,riding:true,speed:6,forward:true};f.step();const full=f.gain('sea-open');
  f.state.pauses=['map'];f.step(160);assert.equal(f.gain('motor-loop'),0);assert.ok(f.gain('sea-open')<full*.36);
  for(const reason of ['settings','inspector','external','blur','hidden']){f.state.pauses=[reason];f.step(1);assert.deepEqual(f.targets(),[]);}
  f.state.pauses=[];f.state.scooter.speed=0;f.step();assert.equal(f.gain('motor-loop'),0);assert.equal(f.events.length,0);
  f.state.firstPerson=false;f.state.scooter.speed=5;f.step();assert.equal(f.gain('motor-loop'),0);
});
test('vehicle pan is bounded over a full turn and changes do not create gameplay random events',()=>{
  const f=fixture();f.state.scooter={...f.state.scooter,riding:true,speed:8,forward:true};
  for(let yaw=0;yaw<Math.PI*2;yaw+=.1){f.state.yaw=yaw;f.step(1);assert.ok(f.targets().every(t=>!t.pan||Math.abs(t.pan)<=.18));}
  assert.equal(f.events.length,0);f.controller.reset();assert.equal(f.controller.diagnostics,undefined);
  assert.ok(f.stops.includes('scooter-brake')&&f.stops.includes('scooter-contact'));
});
test('soundscape container/provenance and total encoded/PCM budgets reject corrupt or oversized releases',t=>{
  const {validateAudioResources,audioBudgets}=require('../tools/study-audio-resources.cjs');
  const root=path.resolve(__dirname,'../public'), summary=validateAudioResources(root);
  assert.equal(summary.files.length,38);assert.equal(summary.decodedBytes,14578560);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'soundscape-resources-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  for(const dir of ['study','actions','soundscape'])fs.cpSync(path.join(root,'audio',dir),path.join(temp,'audio',dir),{recursive:true});
  const manifest=path.join(temp,'audio/soundscape/source.json'),original=fs.readFileSync(manifest),source=JSON.parse(original);
  const audio=path.join(temp,source.files[0].file), bytes=fs.readFileSync(audio),bad=Buffer.from(bytes);bad[60]^=1;fs.writeFileSync(audio,bad);
  assert.throws(()=>validateAudioResources(temp),/SHA256/);fs.writeFileSync(audio,bytes);
  source.sources[0].license='unknown';fs.writeFileSync(manifest,JSON.stringify(source));assert.throws(()=>validateAudioResources(temp),/source license/);fs.writeFileSync(manifest,original);
  for(const key of ['encodedBytes','decodedBytes']){const saved=audioBudgets[key];audioBudgets[key]=summary[key]-1;
    try{assert.throws(()=>validateAudioResources(temp),/budget exceeded/);}finally{audioBudgets[key]=saved;}}
});

test('Room emits contact only after a successful dismount, never when all standing positions are rejected',t=>{
  const {RoomScene}=load('Room'),{Vector3}=require('@babylonjs/core'),scooter=load('CoastalScooter');
  const room=Object.create(RoomScene.prototype),played=[];
  room.scooter={...scooter.createScooterState(),riding:true,exitRequested:true};room.scooterInput=scooter.emptyScooterInput();
  room.engine={getDeltaTime:()=>40};room.firstPersonCamera={position:new Vector3(40,3,-16),rotation:new Vector3(0,Math.PI,0)};
  room.pointerLocked=true;room.currentView='first-person';room.jump=load('HouseJump').createJumpState();room.previousWalk=Vector3.Zero();
  room.scooterModel={update(){},headlight:{setActive(){}}};room.placeRiderCamera=()=>{};room.updateControls=()=>{};room.updateInteractionHint=()=>{};
  room.audio={play:(...args)=>played.push(args)};room.interactions={walkerIsClear:()=>false};
  const previous=global.document;global.document={hidden:false};t.after(()=>{global.document=previous;});
  room.updateScooter();assert.equal(room.scooter.riding,true);assert.equal(played.length,0);
  room.interactions.walkerIsClear=()=>true;room.scooter.exitRequested=true;room.updateScooter();
  assert.equal(room.scooter.riding,false);assert.deepEqual(played,[['scooter-mount','scooter-contact']]);
  for(let i=0;i<10;i++)room.updateScooter();assert.equal(played.length,1,'transition completion is not a second contact');
});
