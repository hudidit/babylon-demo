const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {scooterNightStrength:night}=load('CoastalScooterHeadlight');
const {evaluateTimeOfDay:at,blendTimeOfDay:blend}=load('RoomTimeOfDay');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('headlight follows twilight continuously and cannot flash at manual sun/moon handover',()=>{
 assert.deepEqual([0,3,6,9,12,15,18,21].map(h=>night(at(h))),[1,1,0,0,0,0,0,1]);
 for(let i=1;i<=24000;i++)assert.ok(Math.abs(night(at(i/1000))-night(at((i-1)/1000)))<.02);
 for(const from of [0,3,6,9,12,15,18,21])for(const to of [0,3,6,9,12,15,18,21])for(const reduced of [false,true]){
  let previous=night(at(from));
  for(let i=1;i<=1000;i++){
   const next=night(blend(at(from),at(to),i/1000,reduced));
   assert.ok(next>=0&&next<=1);assert.ok(Math.abs(next-previous)<.025,`${from}->${to}, reduced ${reduced}, frame ${i}`);previous=next;
  }
  near(previous,night(at(to)));
 }
});

function fixture(t){
 load('RoomRuntime').registerRoomRuntime();const b=require('@babylonjs/core/pure'),engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
 const exterior=new(load('RoomExterior').RoomExterior)(scene);
 t.after(()=>{scene.dispose();engine.dispose();});return{b,scene,exterior,Model:load('CoastalScooterModel').CoastalScooterModel};
}

test('night riding illuminates outdoor receivers only; day, unmounted and absent receivers stay off',t=>{
 const {b,scene,exterior,Model}=fixture(t),textures=scene.textures.length;
 const slots=new Map(scene.materials.filter(m=>m instanceof b.PBRMaterial).map(m=>[m,m.maxSimultaneousLights]));
 const model=new Model(scene,exterior.sun,exterior.surfaces,exterior.meshes),lamp=model.headlight,light=lamp.light,lens=scene.getMaterialByName('scooter-headlight-lens');
 lamp.applyTimeOfDay(at(0));assert.equal(light.isEnabled(),false);
 lamp.setActive(true);assert.equal(light.isEnabled(),true);assert.ok(light.intensity>0&&lens.emissiveColor.r>0);
 assert.equal(scene.textures.length,textures);assert.equal(light.getShadowGenerator(),null);
 assert.ok(light.includedOnlyMeshes.some(m=>m.metadata.exteriorLayer==='path'));
 assert.ok(light.includedOnlyMeshes.some(m=>m.metadata.exteriorLayer==='terrain'));
 for(const mesh of exterior.lighthouseDetails.light.includedOnlyMeshes)assert.equal(light.canAffectMesh(mesh),false,'lighthouse interior stays scoped to its work light: '+mesh.name);
 for(const mesh of scene.meshes){
  if(['sky','sea','distant','vehicle'].includes(mesh.metadata?.exteriorLayer)||mesh.metadata?.lighthouseInteriorStructure||!mesh.metadata?.exterior)assert.equal(light.canAffectMesh(mesh),false,mesh.name);
  if(light.canAffectMesh(mesh)){assert.ok(mesh.material.maxSimultaneousLights>=2);assert.ok(exterior.sun.canAffectMesh(mesh));}
 }
 lamp.applyTimeOfDay(at(12));assert.equal(light.isEnabled(),false);near(lens.emissiveColor.r,0);
 lamp.applyTimeOfDay(at(21));assert.equal(light.isEnabled(),true);
 lamp.setActive(false);assert.equal(light.isEnabled(),false);near(light.intensity,0);near(lens.emissiveColor.r,0);
 model.dispose();model.dispose();for(const [material,original]of slots)assert.equal(material.maxSimultaneousLights,original,material.name);
 const unbound=new Model(scene,exterior.sun,exterior.surfaces);unbound.headlight.applyTimeOfDay(at(0));unbound.headlight.setActive(true);assert.equal(unbound.headlight.light.isEnabled(),false);unbound.dispose();
});

test('beam origin and direction follow the fork, heading and slope without camera coupling',t=>{
 const {b,scene,exterior,Model}=fixture(t),model=new Model(scene,exterior.sun,exterior.surfaces,exterior.meshes),light=model.headlight.light;
 const {createScooterState}=load('CoastalScooter'),state={...createScooterState(),riding:true};
 assert.ok(model.update(state,true));
 const vector=()=>b.Vector3.TransformNormal(light.direction,light.parent.computeWorldMatrix(true)).normalize();
 const initial=vector();assert.ok(initial.y<0);near(initial.x,0);
 state.steer=1;model.update(state,true);const turned=vector();assert.ok(Math.abs(turned.x-initial.x)>.2);
 model.root.rotation.set(-.1,Math.PI/2,.05);const slope=vector();assert.ok(slope.x>.8&&slope.y<0);
 const origin=b.Vector3.TransformCoordinates(light.position,light.parent.computeWorldMatrix(true));
 assert.ok(b.Vector3.Distance(origin,model.root.position)>5);near(light.range,100);
 model.dispose();
});

test('Room gates the lamp by riding, current view and hidden state, preserving a stationary rider',()=>{
 const {RoomScene}=load('Room'),room=Object.create(RoomScene.prototype),previous=global.document;let active;
 global.document={hidden:false};room.scooter={riding:true,speed:0};room.currentView='first-person';room.scooterModel={headlight:{setActive:value=>active=value}};
 try{
  room.updateScooterHeadlight();assert.equal(active,true);
  room.currentView='coast';room.updateScooterHeadlight();assert.equal(active,false);
  room.currentView='first-person';global.document.hidden=true;room.updateScooterHeadlight();assert.equal(active,false);
  global.document.hidden=false;room.updateScooterHeadlight();assert.equal(active,true);
  room.scooter.riding=false;room.updateScooterHeadlight();assert.equal(active,false);
 }finally{global.document=previous;}
});
