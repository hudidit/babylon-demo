const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomSoundscape,soundRegion}=load('RoomSoundscape');
const {LIGHTHOUSE}=load('LighthouseLayout'),{COASTAL_SITE:{tower}}=load('CoastalSite');
const base=()=>({firstPerson:true,hour:0,x:14,y:2.2,feet:0,yaw:0,shoreDistance:12,
  weather:{rain:0,kind:'clear',from:'clear',transition:1},pauses:[],doors:{},
  scooter:{riding:false,speed:0,heading:0,forward:false,back:false,brake:false,exitRequested:false}});
function fixture(random=()=>.5){let targets=[];const events=[],stops=[],sink={world:t=>targets=t,resetWorld:()=>targets=[],stopEntity:id=>stops.push(id),play:(...args)=>events.push(args)};
  const controller=new RoomSoundscape(sink,random),state=base();
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
  f.state.scooter.speed=10;f.step();
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
test('quieter weather beds do not depend on scooter speed, drive, brake or riding',()=>{
  const walking=fixture(),riding=fixture();
  for(let i=0;i<1500;i++){
    Object.assign(riding.state.scooter,{riding:i%2===0,speed:i%30-15,forward:i%3===0,brake:i%4===0});
    walking.step(1);riding.step(1);
    for(const id of ['wind-open','wind-sheltered','sea-open','sea-sheltered','rain-open','rain-sheltered'])assert.equal(walking.gain(id),riding.gain(id));
  }
  assert.ok(walking.gain('wind-open')<.028);assert.ok(walking.gain('sea-open')<.055);
  walking.state.weather={rain:1,kind:'storm',from:'storm',transition:1};walking.step(200);
  assert.ok(walking.gain('wind-open')<.051);assert.ok(walking.gain('rain-open')<=.09);
});
test('separate birds are sparse and daylight/outdoor only; pause and re-entry start a new quiet interval',()=>{
  const f=fixture(()=>0);f.state.hour=12;
  const birds=()=>f.events.filter(e=>e[0]==='bird-call');f.step(450);assert.equal(birds().length,0);
  f.step(2);assert.equal(birds().length,1);f.step(799);assert.equal(birds().length,1);f.step(2);assert.equal(birds().length,2);
  for(const change of [{hour:0},{x:7,y:5},{pauses:['map']},{weather:{rain:1,kind:'storm',from:'storm',transition:1}}]){
    const before=birds().length;Object.assign(f.state,change);f.step(1800);assert.equal(birds().length,before);
    Object.assign(f.state,base(),{hour:12});f.step(440);assert.equal(birds().length,before,'re-entry never instantly replays an old call');
  }
  f.controller.reset();assert.ok(f.stops.includes('ambient-birds'));f.step(440);const count=birds().length;f.state.pauses=['blur'];f.step(2000);assert.equal(birds().length,count);
});
test('upper bird timing bound remains one phrase per 62 seconds without catch-up bursts',()=>{
  const f=fixture(()=>1);f.state.hour=12;f.step(750);assert.equal(f.events.length,0);f.step(2);assert.equal(f.events.length,1);
  f.step(1548);assert.equal(f.events.length,1);f.step(4);assert.equal(f.events.length,2);
  assert.ok(f.events.every(e=>e[0]==='bird-call'));
});
test('bird delivery rejects a loop, unknown license and corrupted content independently',t=>{
  const {validateBirdAudio}=require('../tools/bird-audio-resources.cjs'),root=path.resolve(__dirname,'../public');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bird-resources-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.cpSync(path.join(root,'audio/birds'),path.join(temp,'audio/birds'),{recursive:true});
  const manifest=path.join(temp,'audio/birds/source.json'),original=fs.readFileSync(manifest),source=JSON.parse(original);
  source.files[0].loop=true;fs.writeFileSync(manifest,JSON.stringify(source));assert.throws(()=>validateBirdAudio(temp),/Birds must not loop/);
  source.files[0].loop=false;source.sources[0].license='unknown';fs.writeFileSync(manifest,JSON.stringify(source));assert.throws(()=>validateBirdAudio(temp),/bird license/);
  fs.writeFileSync(manifest,original);const p=path.join(temp,source.files[0].file),bytes=fs.readFileSync(p);bytes[100]^=1;fs.writeFileSync(p,bytes);assert.throws(()=>validateBirdAudio(temp),/SHA256/);
});
test('soundscape container/provenance and total encoded/PCM budgets reject corrupt or oversized releases',t=>{
  const {validateAudioResources,audioBudgets}=require('../tools/study-audio-resources.cjs');
  const root=path.resolve(__dirname,'../public'), summary=validateAudioResources(root);
  assert.equal(summary.files.length,77);assert.equal(summary.decodedBytes,16698240);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'soundscape-resources-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  for(const dir of ['study','actions','soundscape','daily','birds'])fs.cpSync(path.join(root,'audio',dir),path.join(temp,'audio',dir),{recursive:true});
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
