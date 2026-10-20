const assert = require('node:assert/strict'), {test} = require('node:test');
const b = require('@babylonjs/core/pure');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const layout = load('LighthouseEquipmentLayout'), {LIGHTHOUSE:a,LIGHTHOUSE_FLOORS:floors} = load('LighthouseLayout');
const {COASTAL_SITE:{tower:t}} = load('CoastalSite'), {planToWorld} = load('HouseLayout'), walk = load('WalkingSurface');
const p = (x,y) => ({x:t.x+x,y:t.y+y});
const v = (x,y,h) => {const q=planToWorld(p(x,y),h);return new b.Vector3(q.x,q.y,q.z);};
function setup(t) {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  const exterior=new(load('RoomExterior').RoomExterior)(scene);
  t.after(()=>{exterior.dispose();scene.dispose();engine.dispose();});
  return {scene,exterior,equipment:exterior.lighthouseDetails.equipment};
}

test('installation identities and state remain honest; main hatch follows actual operation',()=>{
  const state=new(load('LighthouseOperation').LighthouseOperation)();
  assert.equal(new Set(layout.LIGHTHOUSE_EQUIPMENT.map(d=>d.id)).size,8);
  for(const d of layout.LIGHTHOUSE_EQUIPMENT) {
    assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.sign));
    assert.ok(d.parent&&d.purpose&&d.guide&&d.lines.length===2);
    const reading=layout.lighthouseEquipmentReading(d.id,state.snapshot);
    assert.doesNotMatch(reading.state+reading.detail,/100%|备用正常|[0-9]+Wh|[0-9]+W/);
    if(!['lighthouse-drive-hatch','lighthouse-generator-room'].includes(d.id))assert.match(reading.state,/待同步/);
  }
  assert.match(layout.lighthouseEquipmentReading('lighthouse-drive-hatch',state.snapshot).state,/停转/);
  state.startTest();assert.match(layout.lighthouseEquipmentReading('lighthouse-drive-hatch',state.snapshot).state,/运行/);
});

test('cabinet, solar panel and generator block the complete body through the shared collision route',()=>{
  for(const [x,y,h]of [[2.35,.2,a.floor],[4.8,5.8,3.04],[-5.1,6.15,3.04],[-6.35,5.5,3.04]]) {
    assert.equal(walk.walkingPointAllowed(p(x,y),.26,h),false);
  }
  const from=p(1.6,.2), stopped=walk.sweepWalking(from,p(2.8,.2),a.floor);
  assert.ok(stopped&&stopped.x<t.x+1.85,'cabinet face protects the shoulders');
  assert.equal(layout.lighthouseEquipmentPointAllowed(t.x+4.8,t.y+5.8,.26,3.04+.5),false,'jumping does not bypass the sloped panel');
});

test('the engine room has a usable doorway, a clear service station, bounded ceiling and an outside escape route',()=>{
  const room=layout.LIGHTHOUSE_SERVICE_ROOM;
  let current=p(room.x,3.3);
  for(const y of [4,4.5,5,5.25,5,4.5,4,3.3]) {
    const target=p(room.x,y),next=walk.sweepWalking(current,target,room.floor);
    assert.ok(next&&Math.hypot(next.x-target.x,next.y-target.y)<1e-6,JSON.stringify({target,next}));current=next;
  }
  const support=walk.walkingSurfaceAt(t.x+room.x,t.y+5.1,room.floor);
  assert.equal(support.height,room.floor);assert.equal(support.region,'灯塔独立机房');assert.equal(support.ceiling,room.floor+room.clearHeight);
  assert.equal(walk.walkingPointAllowed(p(room.x,5.1),.26,room.floor+.7),false,'ceiling blocks a raised standing body');
  assert.equal(walk.walkingPointAllowed(p(room.x+.32,room.y-room.depth/2),.26,room.floor),false,'jamb protects shoulders');
  for(const [x,y]of [[-7.2,5.5],[-5.1,7.7],[-3,5.5],[4.8,7.6],[6.9,5.8]])assert.ok(walk.walkingPointAllowed(p(x,y),.26,room.floor));
});

test('original entrance, ladder landings, gallery loop and scooter parking stay clear',()=>{
  for(const floor of floors)for(const [x,y]of [[a.ladder.x,a.ladder.landingY],[0,-1.2],[.7,-.6]])assert.ok(walk.walkingPointAllowed(p(x,y),.26,floor.height));
  for(let i=0;i<64;i++){const angle=i/64*Math.PI*2;assert.ok(walk.walkingPointAllowed(p(2.66*Math.cos(angle),2.66*Math.sin(angle)),.26,a.gallery));}
  const {scooterSupport,scooterDismount,SCOOTER_PARKING}=load('CoastalScooter');
  const parking=SCOOTER_PARKING.find(q=>q.id==='tower');assert.ok(scooterSupport(parking));assert.ok(scooterDismount(parking));
  assert.equal(scooterSupport({...p(-6.35,5.5),heading:0}),undefined);
  assert.equal(scooterSupport({...p(layout.LIGHTHOUSE_SERVICE_ROOM.x,layout.LIGHTHOUSE_SERVICE_ROOM.y-.4),heading:0}),undefined,'engine room access is on foot');
  assert.equal(scooterSupport({...p(4.8,5.8),heading:0}),undefined);
});

test('shared solids match their rendered group bounds, labels face the stated service side and all eight devices are pickable',t=>{
  const {scene,equipment}=setup(t),interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{});
  for(const device of equipment.devices)interactions.addDevice(device,()=>{});
  for(const definition of layout.LIGHTHOUSE_EQUIPMENT) {
    const device=equipment.device(definition.id);assert.ok(device&&device.meshes.length>=1);
    assert.ok(device.meshes.every(m=>m.metadata.equipmentId===definition.id&&m.metadata.equipmentParent===definition.parent));
    const label=device.meshes.find(m=>m.name.endsWith('-labels')), sign=definition.sign;
    const normal=label.getVerticesData('normal');assert.ok(normal.slice(-12)[0]*sign.nx+normal.slice(-12)[2]*sign.ny>.99);
    const target=v(sign.x,sign.y,sign.bottom+sign.height/2),eye=target.add(new b.Vector3(sign.nx,0,sign.ny).scale(3));
    const action=interactions.pick(new b.Ray(eye,target.subtract(eye).normalize(),7.5));
    assert.ok(action,definition.id);assert.match(action.label(),new RegExp(definition.label));
    assert.equal(interactions.canReachDevice(device,eye.add(new b.Vector3(sign.nx,0,sign.ny).scale(20))),false);
  }
  for(const part of layout.LIGHTHOUSE_EQUIPMENT_BOXES) {
    const group=equipment.device(part.id).meshes.find(m=>m.name.endsWith('-'+part.finish));
    const bounds=group.getBoundingInfo().boundingBox,low=v(part.x-part.width/2,part.y-part.depth/2,part.bottom),high=v(part.x+part.width/2,part.y+part.depth/2,part.bottom+part.height);
    for(const axis of ['x','y','z']){assert.ok(bounds.minimumWorld[axis]<=low[axis]+1e-3);assert.ok(bounds.maximumWorld[axis]>=high[axis]-1e-3);}
  }
});

test('new cabinet access uses real floor, distance, occlusion and the existing scene authorization',t=>{
  const {scene,exterior,equipment}=setup(t),interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{});
  const device=equipment.device('lighthouse-battery-main');interactions.addDevice(device,()=>{});
  assert.ok(interactions.canReachDevice(device,v(1.25,-.8,a.floor+1.6)));
  assert.equal(interactions.canReachDevice(device,v(1.72,3,a.floor+1.6)),false,'masonry/workbench occludes cabinet');
  const proto=load('Room').RoomScene.prototype,room=Object.create(proto);
  Object.assign(room,{disposed:false,currentView:'first-person',exterior,interactions,firstPersonCamera:{position:v(1.25,-.8,a.floor+1.6)},
    ladder:{attached:false},scooter:{riding:false},jump:{grounded:true,feet:a.floor}});
  assert.equal(room.canAccessLighthouse(device.id),true);room.jump.feet=a.gallery;assert.equal(room.canAccessLighthouse(device.id),false);
  room.jump.feet=a.floor;room.ladder.attached=true;assert.equal(room.canAccessLighthouse(device.id),false);
});

test('backup source clears the roof and body while the closed drive hatch stays in the protected core',t=>{
  const {scene,equipment}=setup(t),u=5;
  const backup=equipment.device('lighthouse-beacon-backup').meshes.find(m=>m.name.endsWith('-solar'));
  assert.ok(backup.getBoundingInfo().boundingBox.minimumWorld.y>v(0,0,load('CoastalSite').COASTAL_SITE.tower.ground+20.04).y,'lens is above the original roof apex');
  assert.ok(walk.walkingPointAllowed(p(2.8,-.45),.26,a.gallery));
  const eye=v(2.8,-.45,a.gallery+1.6),mount=layout.LIGHTHOUSE_BACKUP_MOUNT,visible=[];
  for(let i=0;i<10;i++){
    const target=v(mount.x-.09,mount.y-.06,mount.lensBottom+mount.lensHeight*(i+.5)/10);
    const hit=scene.pickWithRay(new b.Ray(eye,target.subtract(eye).normalize(),20),m=>m.metadata?.lighthouse&&!m.metadata?.lighthouseMaintenanceTool);
    if(hit.pickedMesh===backup)visible.push(i);
  }
  assert.ok(visible.length>=3,'a real gallery standing position sees the independent lens past the roof eave: '+visible);
  for(const part of layout.LIGHTHOUSE_EQUIPMENT_BOXES.filter(p=>p.id==='lighthouse-beacon-backup'))assert.ok(part.bottom>=a.gallery+2.04);
  for(const mesh of equipment.device('lighthouse-drive-hatch').meshes){const values=mesh.getVerticesData('position'),world=mesh.computeWorldMatrix(true),origin=v(0,0,a.gallery);
    for(let i=0;i<values.length;i+=3){const q=b.Vector3.TransformCoordinates(b.Vector3.FromArray(values,i),world).subtract(origin);assert.ok(Math.hypot(q.x,q.z)<=.44*u+1e-4);}}
});

test('new geometry has its own budget, preserves old exterior budget and disposes its one atlas and three materials',t=>{
  const {scene,exterior,equipment}=setup(t),one=load('LighthouseRecords').lighthouseEquipmentPixels(),two=load('LighthouseRecords').lighthouseEquipmentPixels();
  assert.deepEqual(one,two);assert.equal(one.pixels.length,256*512*4);
  const panel=equipment.device('lighthouse-solar-array').meshes.find(m=>m.name.endsWith('-solar'));
  const normals=panel.getVerticesData('normal');
  for(let i=0;i<normals.length;i+=3)assert.ok(normals[i+1]>.8&&normals[i+2]>.4,'the visible PV front faces up and world +Z (south), not its metal underside');
  assert.ok(equipment.meshes.length<=24);assert.ok(equipment.meshes.reduce((n,m)=>n+m.getTotalVertices(),0)<=20000);
  assert.equal(new Set(equipment.meshes.map(m=>m.material).filter(m=>/solar-cells|equipment-print|backup-white-flash/.test(m.name))).size,3);
  assert.ok(exterior.meshes.filter(m=>!m.metadata.lighthouseEquipment&&!m.metadata.lighthouseInteriorStructure&&!m.metadata.lighthouseDetail).reduce((n,m)=>n+m.getTotalVertices(),0)<160000);
  assert.equal(scene.lights.length,2);assert.equal(scene.cameras.length,0);
  const atlas=scene.getTextureByName('lighthouse-original-equipment-signs');assert.ok(atlas);assert.equal(!!atlas.isRenderTarget,false);
  exterior.dispose();exterior.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,0);assert.equal(scene.lights.length,0);
  assert.ok(!scene.textures.includes(atlas));
});
