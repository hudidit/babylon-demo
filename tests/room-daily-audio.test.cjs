const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomDailyAudio,footMaterial}=load('RoomDailyAudio'),{LIGHTHOUSE}=load('LighthouseLayout');
function fixture(){const events=[],stops=[],audio=new RoomDailyAudio({play:(cue,entity,point)=>events.push({cue,entity,point:point?.()}),stopEntity:e=>stops.push(e)});
 const state={x:7,y:2.7,feet:0,grounded:true,material:'wood',landed:false,impact:0};return{audio,state,events,stops,step:(dt=.02)=>audio.walk(dt,state)};}
test('accepted distance, speed and surface drive footsteps; idle/camera-only movement does not',()=>{
 const f=fixture();f.step();for(let i=0;i<100;i++)f.step();assert.equal(f.events.length,0);
 for(let i=0;i<50;i++){f.state.x+=.04;f.step();}assert.equal(f.events.length,3);assert.ok(f.events.every(e=>e.cue==='footstep-wood'&&e.point));
 f.state.material='metal';for(let i=0;i<20;i++){f.state.x+=.12;f.step();}assert.ok(f.events.some(e=>e.cue==='footstep-metal'));
 const count=f.events.length;for(let i=0;i<30;i++)f.step();assert.equal(f.events.length,count);
});
test('air travel is silent; one real landing replaces a stride and never repeats on grounded frames',()=>{
 const f=fixture();f.step();f.state.grounded=false;
 for(let i=0;i<30;i++){f.state.x+=.04;f.state.feet+=.01;f.step();}assert.equal(f.events.length,0);
 Object.assign(f.state,{feet:0,grounded:true,material:'hard',landed:true,impact:3.1});f.step();
 assert.deepEqual(f.events.map(e=>e.cue),['landing-hard']);f.state.landed=false;for(let i=0;i<50;i++)f.step();assert.equal(f.events.length,1);
 assert.ok(f.stops.includes('walker-feet'));
});
test('teleports, session resets, long frames and invalid samples cannot queue a burst or false landing',()=>{
 const f=fixture();f.step();f.state.x+=100;f.step();assert.equal(f.events.length,0);
 f.state.x+=2;f.step(1);assert.equal(f.events.length,0);f.step();f.state.x+=.2;f.step();assert.equal(f.events.length,0);
 f.audio.reset();Object.assign(f.state,{landed:true,impact:4,grounded:true});f.step();assert.equal(f.events.length,0);
 f.state.x=NaN;f.step();f.state.x=7;f.state.landed=false;f.step();assert.equal(f.events.length,0);
});
test('material follows bath tile bounds, authored soft furniture, wood table and tower metal deck',()=>{
 const floor={kind:'floor',height:0,region:'house',normal:{x:0,y:1,z:0}};
 assert.equal(footMaterial(floor,6,3.1,0),'wood');assert.equal(footMaterial(floor,7,2,0),'soft');assert.equal(footMaterial(floor,8,8,0),'soft');assert.equal(footMaterial(floor,1,6,0),'hard');
 assert.equal(footMaterial(floor,.02,6,0),'wood');assert.equal(footMaterial(floor,3,6,0),'hard');
 assert.equal(footMaterial(floor,7,5,.5,{id:'guest-bed',top:.5}),'soft');
 assert.equal(footMaterial(floor,7,5,.5,{id:'coffee-table',top:.5}),'wood');
 assert.equal(footMaterial({...floor,lighthouse:true},-130,85,LIGHTHOUSE.gallery),'metal');
 assert.equal(footMaterial({...floor,kind:'terrain'},14,0,0),'earth');assert.equal(footMaterial({...floor,kind:'path'},14,0,0),'hard');
});
test('ladder contacts use actual 0.28m rung crossings, in both directions, and stop at rest/reversal',()=>{
 const f=fixture();let h=LIGHTHOUSE.floor;
 for(let i=0;i<40;i++){f.audio.climb(h,h+.032);h+=.032;}assert.equal(f.events.length,4);
 assert.ok(f.events.every(e=>e.cue==='ladder-rung'&&e.point.y>0));const n=f.stops.length;
 f.audio.climb(h,h);assert.equal(f.stops.length,n+1);for(let i=0;i<50;i++)f.audio.climb(h,h);assert.equal(f.events.length,4);
 for(let i=0;i<40;i++){f.audio.climb(h,h-.032);h-=.032;}assert.equal(f.events.length,8);
 f.audio.climb(h,h+10);assert.equal(f.events.length,8,'teleport not a ladder contact');f.audio.reset();assert.ok(f.stops.includes('lighthouse-ladder-feet'));
});
test('curtain sounds start on motion, reverse by stopping old contact, and end without a latch',t=>{
 const {NullEngine,Scene,TransformNode,MeshBuilder}=require('@babylonjs/core'),{RoomInteractions}=load('RoomInteractions');
 const engine=new NullEngine(),scene=new Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 const root=new TransformNode('curtain',scene),mesh=MeshBuilder.CreateBox('panel',{},scene);mesh.parent=root;
 const events=[],interactions=new RoomInteractions(scene,()=>{},()=>undefined,e=>events.push(e));
 interactions.addCurtain({id:'test-curtain',windowId:'test-window',label:'curtain',root,meshes:[mesh],applyClosed(){}});
 const action=interactions.actions.get(mesh);action.toggle();interactions.update(0);assert.deepEqual(events.map(e=>e.cue),['stop']);
 for(let i=0;i<7;i++)interactions.update(.05);assert.equal(events.filter(e=>e.cue==='curtain-move').length,1);
 action.toggle();interactions.update(.05);assert.deepEqual(events.slice(-2).map(e=>e.cue),['stop','curtain-move']);
 for(let i=0;i<25;i++)interactions.update(.05);assert.equal(events.at(-1).cue,'stop');assert.ok(!events.some(e=>e.cue.includes('latch')));
 action.toggle();interactions.update(.05);interactions.silenceMotion();assert.equal(events.at(-1).cue,'stop');interactions.remove('test-curtain');
});
test('beacon is local, reflects real running/visibility and any modal pause, with automatic time disabled independent',()=>{
 const {RoomSoundscape}=load('RoomSoundscape'),tower=load('CoastalSite').COASTAL_SITE.tower;let targets=[];
 const sound=new RoomSoundscape({world:t=>targets=t,resetWorld:()=>targets=[],stopEntity(){},play(){}});
 const s={firstPerson:true,x:tower.x+1,y:tower.y,feet:LIGHTHOUSE.gallery,yaw:0,shoreDistance:30,
 weather:{rain:0,kind:'clear',from:'clear',transition:1},doors:{},pauses:[],scooter:{riding:false,speed:0},beacon:{running:true,visible:true}};
 const gain=()=>targets.find(t=>t.id==='beacon-drive')?.gain||0;
 for(let i=0;i<50;i++)sound.update(.04,s);assert.ok(gain()>0);assert.ok(targets.find(t=>t.id==='beacon-drive').position);
 for(const change of [{beacon:{running:false,visible:true}},{pauses:['map']},{feet:LIGHTHOUSE.floor},{firstPerson:false},{beacon:{running:true,visible:false}}]){
  const next={...s,...change};sound.update(.04,next);assert.equal(gain(),0);
 }
 sound.update(.04,s);assert.ok(gain()>0);s.scooter.riding=true;s.scooter.speed=5;s.scooter.forward=true;s.weather.rain=1;
 sound.update(.04,s);assert.equal(gain(),0);assert.ok(targets.filter(t=>t.gain>.0008).length<=8);
});
test('daily provenance, content-addressed PCM, unique variations, cancellation metadata and budget fail closed',t=>{
 const {validateDailyAudio}=require('../tools/daily-audio-resources.cjs');const source=path.resolve('public');
 const summary=validateDailyAudio(source);assert.equal(summary.files.length,37);assert.equal(summary.decodedBytes,1870080);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'daily-audio-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 fs.cpSync(path.join(source,'audio/daily'),path.join(temp,'audio/daily'),{recursive:true});
 const manifest=path.join(temp,'audio/daily/source.json'),raw=fs.readFileSync(manifest),m=JSON.parse(raw),file=path.join(temp,m.files[0].file),bytes=fs.readFileSync(file);
 const bad=Buffer.from(bytes);bad[60]^=1;fs.writeFileSync(file,bad);assert.throws(()=>validateDailyAudio(temp),/SHA256/);fs.writeFileSync(file,bytes);
 m.sources[0].license='unknown';fs.writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>validateDailyAudio(temp),/source license/);
 fs.writeFileSync(manifest,raw);const n=JSON.parse(raw);n.files[0].sourceSha256s[0]='0'.repeat(64);fs.writeFileSync(manifest,JSON.stringify(n));assert.throws(()=>validateDailyAudio(temp),/Unreviewed daily source/);
 fs.writeFileSync(manifest,raw);fs.unlinkSync(path.join(temp,'audio/daily/Kenney-License.txt'));assert.throws(()=>validateDailyAudio(temp),/ENOENT/);
});
