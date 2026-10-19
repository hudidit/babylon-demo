const assert=require('node:assert/strict'),{test}=require('node:test');
const b=require('@babylonjs/core/pure'),load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {RoomFurnishings}=load('RoomFurnishings'),{createHouseArchitecture}=load('HouseArchitecture');
const {RoomInteractions}=load('RoomInteractions'),{RoomLighting}=load('RoomLighting');
const {HOUSE_WINDOWS}=load('HouseStructure'),{evaluateTimeOfDay:at}=load('RoomTimeOfDay');
function setup(t) {
  const engine=new b.NullEngine(),context=new Proxy({}, {get:(_,key)=>/create.*Gradient/.test(key)?()=>({addColorStop(){}}):()=>{}});
  engine.createCanvas=()=>({width:1,height:1,getContext:()=>context,remove(){}});
  const scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});
  const furniture=new RoomFurnishings(scene),architecture=createHouseArchitecture(scene,furniture);furniture.finish();architecture.setEnclosed(true);
  scene.meshes.forEach(mesh=>mesh.computeWorldMatrix(true));
  const lighting=new RoomLighting(scene,true);lighting.addLivingRoom(scene,true);lighting.addMasterSuite(scene);lighting.addBedroom(scene);
  lighting.addServiceRooms(scene);lighting.addBalcony(scene);lighting.addCeilingLights();lighting.addMeshes(scene.meshes);lighting.freezeShadows();
  const touched=[],interactions=new RoomInteractions(scene,owners=>{touched.push(owners);lighting.refreshShadows(owners);});
  furniture.curtains.forEach(c=>interactions.addCurtain(c,n=>lighting.setCurtain(c.windowId,n)));
  return{scene,furniture,architecture,lighting,interactions,touched};
}
const ray=(curtain,x,y=0,distance=4)=>{
  const matrix=curtain.root.computeWorldMatrix(true),from=b.Vector3.TransformCoordinates(new b.Vector3(x,y,-distance),matrix);
  const toward=b.Vector3.TransformCoordinates(new b.Vector3(x,y,0),matrix).subtract(from).normalize();
  return new b.Ray(from,toward,7.5);
};
const advance=(interactions,n=20)=>{for(let i=0;i<n;i++)interactions.update(.05);};

test('six existing curtain assemblies cover each real opening when closed and retain the original open silhouette',t=>{
  const {scene,furniture}=setup(t),resources=[scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length];
  assert.equal(furniture.curtains.length,6);
  for(const c of furniture.curtains) {
    assert.ok(HOUSE_WINDOWS.some(w=>w.id===c.windowId));assert.equal(c.id,c.windowId+'-curtains');
    const fabric=c.meshes[0],original=Array.from(fabric.getVerticesData(b.VertexBuffer.PositionKind));
    const hooks=c.meshes[1],originalHooks=Array.from(hooks.getVerticesData(b.VertexBuffer.PositionKind));
    assert.equal(c.meshes.length,3);assert.ok(c.meshes.every(m=>m.parent===c.root&&!m.checkCollisions));
    assert.ok(!scene.pickWithRay(ray(c,0),m=>m===fabric).hit,'open curtains leave the center clear');
    for(const amount of [.2,.5,1]) {
      c.applyClosed(amount);
      const moving=fabric.getVerticesData(b.VertexBuffer.PositionKind);
      for(let i=0;i<moving.length;i+=3)if(moving[i+1]>-4.4&&moving[i+1]<-4)
        assert.ok(moving[i+2]<-.8,'released cloth stays ahead of the sill during spreading');
    }
    assert.equal(c.meshes[2].visibility,0,'released tie and tassels do not hang across the closed fabric');
    const closed=fabric.getVerticesData(b.VertexBuffer.PositionKind);
    for(let i=0;i<closed.length;i+=3)if(closed[i+1]>-4.4&&closed[i+1]<-4)
      assert.ok(closed[i+2]<-.8,'unfolded fabric clears the forward-projecting window sill');
    const movedHooks=hooks.getVerticesData(b.VertexBuffer.PositionKind),perRing=hooks.getTotalVertices()/14;
    for(let ring=0;ring<14;ring++) {
      const side=ring<7?-1:1,index=ring%7,offset=side*3.18+(index-3)-(side*5.55+(index-3)*.245);
      for(let vertex=ring*perRing;vertex<(ring+1)*perRing;vertex++) {
        assert.ok(Math.abs(movedHooks[vertex*3]-originalHooks[vertex*3]-offset)<1e-5);
        assert.equal(movedHooks[vertex*3+1],originalHooks[vertex*3+1]);
        assert.equal(movedHooks[vertex*3+2],originalHooks[vertex*3+2]);
      }
    }
    for(const x of [-5.1,-2.5,-.01,0,.01,2.5,5.1])for(const y of [-3.7,0,3.7])
      assert.ok(scene.pickWithRay(ray(c,x,y),m=>m===fabric).hit,c.id+' covers '+x+','+y);
    const normals=fabric.getVerticesData(b.VertexBuffer.NormalKind);
    for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<1e-5);
    c.applyClosed(0);assert.deepEqual(Array.from(fabric.getVerticesData(b.VertexBuffer.PositionKind)),original);
    assert.deepEqual(Array.from(hooks.getVerticesData(b.VertexBuffer.PositionKind)),originalHooks);
    assert.equal(c.meshes[2].visibility,1);
  }
  assert.deepEqual([scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length],resources);
});

test('real fabric picking supports smooth reversal, window-local light transmission, unchanged artificial lamps and idle shadow caches',t=>{
  const {scene,furniture,interactions,lighting,touched}=setup(t),curtain=furniture.curtains.find(c=>c.windowId==='living-window');
  const action=interactions.pick(ray(curtain,5.8));assert.ok(action?.label().includes('客厅窗帘'));
  const allLamps=[...lighting.lamps].map(([id,l])=>[id,l.on,l.light.intensity]);
  lighting.applyTimeOfDay(at(9));const light=scene.getLightByName('living-window-daylight'),original=light.intensity;assert.ok(original>0);
  const positions=()=>Array.from(curtain.meshes[0].getVerticesData(b.VertexBuffer.PositionKind));
  const open=positions();action.toggle();advance(interactions,6);const middle=positions();assert.notDeepEqual(middle,open);
  action.toggle();assert.deepEqual(positions(),middle,'reversing itself must not jump');advance(interactions);assert.deepEqual(positions(),open);
  action.toggle();advance(interactions);assert.ok(Math.abs(light.intensity/original-.04)<1e-8);
  assert.deepEqual([...lighting.lamps].map(([id,l])=>[id,l.on,l.light.intensity]),allLamps);
  for(const hour of [0,3,6,9,12,18,21,9])lighting.applyTimeOfDay(at(hour));
  assert.ok(Math.abs(light.intensity/original-.04)<1e-8,'time changes keep the closed transmission');
  assert.ok(interactions.curtains.filter(s=>s.curtain!==curtain).every(s=>s.progress===0));
  assert.ok(touched.every(owners=>owners.length===1&&owners[0]==='living'));
  touched.length=0;advance(interactions);assert.equal(touched.length,0,'stationary curtains keep shadow maps cached');
  action.toggle();advance(interactions);assert.equal(light.intensity,original);
  assert.deepEqual(positions(),open);
});

test('curtain actions obey reach/occlusion/cutaway and remove pending animation on room release',t=>{
  const {scene,furniture,architecture,interactions}=setup(t),c=furniture.curtains.find(c=>c.windowId==='study-window');
  const r=ray(c,5.8),action=interactions.pick(r);assert.ok(action);
  const short=new b.Ray(r.origin,r.direction,.1);assert.equal(interactions.pick(short),undefined);
  const blocker=b.CreateBox('opaque-furniture',{size:.6},scene);blocker.position.copyFrom(r.origin.add(r.direction.scale(.8)));
  blocker.computeWorldMatrix(true);
  assert.equal(interactions.pick(r),undefined);blocker.dispose();
  c.meshes.forEach(m=>m.isVisible=false);assert.equal(interactions.pick(r),undefined);architecture.setEnclosed(true);
  action.toggle();advance(interactions,3);const before=Array.from(c.meshes[0].getVerticesData(b.VertexBuffer.PositionKind));
  interactions.removeRoom('study');advance(interactions);
  assert.deepEqual(Array.from(c.meshes[0].getVerticesData(b.VertexBuffer.PositionKind)),before);
  assert.equal(interactions.pick(r),undefined);
  assert.ok(interactions.curtains.some(s=>s.curtain.windowId==='master-window'));
});
