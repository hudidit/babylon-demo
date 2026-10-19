const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),{coastalRoute,COASTAL_SITE}=load('CoastalSite');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const stateAt=(x,y,heading=0)=>({...v.createScooterState(),x,y,heading,riding:true});
const input=values=>({...v.emptyScooterInput(),...values});

test('parking footprints and dismounts have real support; no safe exit leaves the rider aboard',()=>{
 for(const p of v.SCOOTER_PARKING){assert.ok(v.scooterSupport(p),p.id);const exit=v.scooterDismount(p);assert.ok(exit,p.id);assert.ok(distance(p,exit)>.7);assert.equal(v.scooterDismount(p,()=>false),undefined);}
 assert.equal(v.scooterSupport({x:9.4,y:5.35,heading:0}),undefined,'vehicle must never enter the house');
 assert.equal(v.scooterSupport({x:11.6,y:4.65,heading:0}),undefined,'entry door sweep stays clear');
 assert.equal(v.scooterSupport({x:-125,y:90,heading:0}),undefined,'solid tower base');
 assert.equal(v.scooterSupport({x:-68.8,y:26.4,heading:0}),undefined,'lookout bench');
 assert.equal(v.scooterSupport({x:NaN,y:2,heading:0}),undefined);
});

test('acceleration uses metres per second and coasting, braking and reversing are bounded',()=>{
 const s=stateAt(-80,33,Math.atan2(-24,19));
 for(let i=0;i<240;i++)v.advanceScooter(s,input({forward:true}),1/120);
 assert.ok(s.speed>4.8&&s.speed<=5);assert.ok(s.distance>4.8&&s.distance<5.2);
 for(let i=0;i<240;i++)v.advanceScooter(s,input({}),1/120);assert.equal(s.speed,0);
 const parked={...s};for(let i=0;i<120;i++)v.advanceScooter(s,input({back:true}),1/120);
 assert.ok(s.speed>=-1&&s.speed<0);assert.ok(distance(s,parked)<1.01);
 v.advanceScooter(s,input({brake:true}),.2);assert.equal(s.speed,0);
 s.speed=4;s.exitRequested=true;for(let i=0;i<4;i++)v.advanceScooter(s,input({forward:true}),.2);assert.equal(s.speed,0);
 s.riding=false;v.advanceScooter(s,input({forward:true}),.2);assert.equal(s.speed,0);
});

test('top speed is 40 km/h and full-lock steering is half the earlier response',()=>{
 assert.equal(v.SCOOTER.cruise,40/3.6);assert.equal(v.SCOOTER.steerSensitivity,.5);
 const s=stateAt(-80,33,Math.atan2(-24,19));
 for(let i=0;i<600;i++)v.advanceScooter(s,input({forward:true}),1/120);
 assert.equal(s.speed,40/3.6);assert.equal(Math.round(s.speed*3.6),40);assert.ok(v.scooterSupport(s));
 const start=Math.atan2(-24,19),turn=stateAt(-80,33,start);
 for(let i=0;i<120;i++)v.advanceScooter(turn,input({right:true}),1/120);
 const angle=turn.heading-start;
 assert.ok(v.scooterSupport(turn));assert.ok(angle>.74&&angle<.80,'one second at full standstill lock should turn about 44°, half the previous response');
});

test('long frames sweep the entire vehicle against fence, tower, house and rocks, including in-place turning',()=>{
 const cases=[stateAt(14,0,Math.PI/2),stateAt(-125,84,0),stateAt(13.3,4.65,-Math.PI/2)];
 for(const s of cases){assert.ok(v.scooterSupport(s));for(let i=0;i<60;i++)v.advanceScooter(s,input({forward:true}),2);assert.ok(v.scooterSupport(s));assert.equal(s.speed,0);}
 const s=stateAt(14,2.2);for(let i=0;i<40;i++)v.advanceScooter(s,input({right:true}),.2);assert.ok(v.scooterSupport(s));assert.equal(s.speed,0);
 const before={...s};v.advanceScooter(s,input({forward:true}),NaN);assert.equal(s.x,before.x);assert.equal(s.y,before.y);assert.equal(s.heading,before.heading);assert.equal(s.speed,0);
 const huge=stateAt(-80,33,-.9);v.advanceScooter(huge,input({forward:true}),100);assert.ok(huge.distance<=.06,'long background gap cannot become kilometres of travel');
});

test('both directions of the route support wheelbase and full body through all corners',()=>{
 const route=coastalRoute().filter(p=>p.x<10.5&&distance(p,COASTAL_SITE.tower)>5.5);
 for(let i=1;i<route.length-1;i++)for(const reverse of [0,Math.PI]){
  const a=route[i-1],b=route[i+1],p={...route[i],heading:Math.atan2(b.x-a.x,b.y-a.y)+reverse};
  assert.ok(v.scooterSupport(p),JSON.stringify(p));
 }
});

test('model stays in geometry/material budgets and disposal restores scene-owned resources',t=>{
 load('RoomRuntime').registerRoomRuntime();const b=require('@babylonjs/core/pure'),e=new b.NullEngine(),s=new b.Scene(e);s.useDelayedTextureLoading=true;
 t.after(()=>{s.dispose();e.dispose();});const exterior=new(load('RoomExterior').RoomExterior)(s),lighting=new(load('RoomLighting').RoomLighting)(s,true);
 const count=()=>[s.meshes.length,s.materials.length,s.textures.length,s.lights.length,s.cameras.length,s.transformNodes.length,exterior.sun.includedOnlyMeshes.length];
 const before=count(),Model=load('CoastalScooterModel').CoastalScooterModel;
 for(let i=0;i<2;i++){const m=new Model(s,exterior.sun,exterior.surfaces,exterior.meshes);lighting.addMeshes(m.meshes);assert.ok(m.meshes.every(x=>lighting.fill.excludedMeshes.includes(x)),'outdoor vehicle cannot take the only direct-light slot from indoor fill');assert.ok(m.meshes.length<=10);assert.ok(m.meshes.reduce((n,x)=>n+x.getTotalVertices(),0)<=5000);assert.equal(s.materials.length-before[1],3);assert.equal(s.lights.length-before[3],1);
  assert.ok(m.update(v.createScooterState(),true));assert.ok(m.meshes.every(x=>!x.checkCollisions),'parked vehicle cannot block door or walking');
  assert.ok(m.meshes.every(x=>!exterior.shadow.getShadowMap().renderList.includes(x)),'dynamic vehicle does not invalidate static cache');
  m.dispose();m.dispose();assert.ok(s.lights.every(light=>light.includedOnlyMeshes.every(x=>!m.meshes.includes(x))&&light.excludedMeshes.every(x=>!m.meshes.includes(x))));assert.deepEqual(count(),before);}
});


test('former slow zones and edge approaches share the cruise target without automatic braking',()=>{
 const poses=[...v.SCOOTER_PARKING,{x:-4,y:-5,heading:-.75},{x:-56,y:8,heading:-1},{x:14,y:0,heading:Math.PI/2}];
 for(const p of poses){
  const s=stateAt(p.x,p.y,p.heading);s.speed=v.SCOOTER.cruise;
  assert.ok(v.scooterSupport(s),JSON.stringify(p));v.advanceScooter(s,input({forward:true}),1/60);
  assert.equal(s.speed,v.SCOOTER.cruise,JSON.stringify(p));assert.ok(v.scooterSupport(s));
  const accelerating=stateAt(p.x,p.y,p.heading);accelerating.speed=3;v.advanceScooter(accelerating,input({forward:true}),1/60);
  assert.ok(accelerating.speed>3,'no position-based cap during acceleration');
 }
 for(const s of [stateAt(14,0,Math.PI/2),stateAt(-125,84,0),stateAt(13.3,4.65,-Math.PI/2)]){
  s.speed=v.SCOOTER.cruise;v.advanceScooter(s,input({forward:true}),.2);
  for(let i=0;i<10;i++)v.advanceScooter(s,input({forward:true}),.2);
  assert.ok(v.scooterSupport(s));assert.equal(s.speed,0,'cruise-speed sweep must still stop at obstacles');
 }
});
