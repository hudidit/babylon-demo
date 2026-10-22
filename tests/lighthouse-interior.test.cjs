const assert = require('node:assert/strict');
const { test } = require('node:test');
const b = require('@babylonjs/core/pure');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const { LIGHTHOUSE:a, lighthouseInnerRadius } = load('LighthouseLayout');
const { COASTAL_SITE:{tower:tower} } = load('CoastalSite');
const { walkingSurfaceAt:surface, walkingPointAllowed:allowed, sweepWalking:sweep } = load('WalkingSurface');
const { planToWorld } = load('HouseLayout');
const point = (x,y) => ({x:tower.x+x,y:tower.y+y});
function setup(t) {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  const exterior=new(load('RoomExterior').RoomExterior)(scene);
  t.after(()=>{exterior.dispose();scene.dispose();engine.dispose();});
  return {scene,exterior};
}

test('entrance connects the plaza and first room in both directions with no side access',()=>{
  for(const direction of [1,-1]) {
    let current=point(0,direction===1?-4.2:-1.9);
    for(let i=1;i<=46;i++) {
      const target=point(0,direction===1?-4.2+i*.05:-1.9-i*.05),next=sweep(current,target);
      assert.ok(next&&Math.hypot(next.x-target.x,next.y-target.y)<1e-6,JSON.stringify({current,target,next}));current=next;
    }
  }
  for(let i=0;i<128;i++) {
    const angle=i/128*Math.PI*2;
    if(Math.sin(angle)<-.98)continue;
    const end=sweep(point(4.5*Math.cos(angle),4.5*Math.sin(angle)),point(0,0));
    assert.ok(end&&Math.hypot(end.x-tower.x,end.y-tower.y)>=a.plinthRadius+.25,'the solid base cannot be climbed from its side');
  }
  assert.equal(allowed(point(a.entranceHalfWidth-.24,a.doorY)),false,'player shoulders cannot cross a jamb');
  assert.equal(allowed(point(tower.radius-.35,0)),false,'tapered wall protects the whole body');
  for(const f of a.furniture)assert.equal(allowed(point(f.x,f.y)),false,f.id);
});

test('first-floor and every stair support equal actual rendered top faces',t=>{
  const {scene}=setup(t);
  for(const [x,y]of [[0,0],[.8,.5],[-.5,-1.5],[0,-3.3],[0,-3.1],[0,-2.95],[0,-2.8],[0,-2.5]]) {
    const p=point(x,y),v=planToWorld(p,4.8),support=surface(p.x,p.y);
    const hit=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,-1,0),30),
      m=>['coastal-lighthouse-ground-floor','coastal-lighthouse-entry-steps','coastal-lighthouse-plaza'].includes(m.name));
    assert.ok(hit.hit);assert.ok(Math.abs((hit.pickedPoint.y+5)/5-support.height)<2e-5,JSON.stringify({p,support,hit:hit.pickedPoint}));
  }
  const inside=surface(tower.x,tower.y);assert.equal(inside.height,a.floor);assert.equal(scene.getMeshByName('coastal-lighthouse-ground-ceiling'),null);
  assert.match(inside.region,/灯塔首层/);assert.equal(surface(tower.x,tower.y-4).ceiling,undefined);
});

test('inner masonry faces the room, window holes stay open and reveals close the thickness',t=>{
  const {scene}=setup(t),inner=scene.getMeshByName('coastal-lighthouse-inner-wall');inner.computeWorldMatrix(true);
  const cast=(height,x=0,z=1)=>{const p=planToWorld(point(x,0),tower.ground+.49+height);
    return scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,0,-1),20),m=>m===inner);};
  for(const h of [1,4.4,9,13.1])assert.equal(cast(h).hit,false,'matching inner door/window hole');
  for(const h of [2.6,6,11,15])assert.ok(cast(h).hit,'inner wall visible between holes');
  const g=load('CoastalLandmark').coastalTowerLining(a.wallThickness),outer=load('CoastalLandmark').coastalTowerShaft();
  assert.ok(g.positions.length>outer.positions.length,'opening reveals have real surfaces');
  for(let i=0;i<outer.positions.length;i+=3) {
    const centre=planToWorld(tower),r=Math.hypot(g.positions[i]-centre.x,g.positions[i+2]-centre.z);
    const ro=Math.hypot(outer.positions[i]-centre.x,outer.positions[i+2]-centre.z);
    assert.ok(Math.abs(ro-r-a.wallThickness*5)<1e-5);
    assert.ok(g.normals[i]*(g.positions[i]-centre.x)+g.normals[i+2]*(g.positions[i+2]-centre.z)<0);
  }
  assert.ok(lighthouseInnerRadius(0,15.85)>1.7,'upper storey retains the original interior radius');
});

test('the door is picked from both sides, masonry occludes it, and a walker pauses its sweep',t=>{
  const {scene,exterior}=setup(t),door=exterior.lighthouseDoor;
  let walker;const interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{},()=>walker);
  interactions.addDoor(door);
  const ray=(y,dir,x=0)=>{const p=planToWorld(point(x,y),a.floor+1);return new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,0,dir),25);};
  assert.ok(interactions.pick(ray(-4,1)));assert.ok(interactions.pick(ray(-1.9,-1)));
  assert.equal(interactions.pick(ray(4,-1)),undefined,'wall blocks picking the door from behind the tower');
  interactions.pick(ray(-4,1)).toggle();
  const w=planToWorld(point(.1,a.doorY+.37),a.floor+1.6);walker=new b.Vector3(w.x,w.y,w.z);
  for(let i=0;i<30;i++)interactions.update(.05);
  const state=interactions.doors[0];assert.ok(state.blocked&&state.progress<1);
  walker=undefined;for(let i=0;i<30;i++)interactions.update(.05);
  assert.ok(Math.abs(door.root.rotation.y-Math.PI/2)<1e-6);
  assert.ok(door.meshes.every(m=>m.checkCollisions&&m.metadata.movingLighthouseDoor));
  assert.ok(!exterior.shadow.getShadowMap().renderList.some(m=>m.metadata.movingLighthouseDoor));
});

test('scooter cannot use the newly walkable entrance or the first room',()=>{
  const {scooterSupport}=load('CoastalScooter');
  for(const y of [-4,-3.5,-3.1,-2,0])assert.equal(scooterSupport({...point(0,y),heading:0}),undefined);
});

test('interior reuses shared materials, remains enclosed under cutaway and releases its nodes',t=>{
  const {scene,exterior}=setup(t),door=exterior.lighthouseDoor;
  const meshes=exterior.meshes.filter(m=>m.name.includes('lighthouse')&&m!==scene.getMeshByName('coastal-lighthouse-path'));
  assert.equal(exterior.surfaces.textures.length,9);assert.equal(scene.metadata.coastalSite.interiorStage,3);
  exterior.updateCutaway({x:60,z:30},{x:0,z:0});assert.ok(meshes.every(m=>!m.material.clipPlane2));
  exterior.setVisible(false);assert.ok(meshes.every(m=>!m.isVisible));exterior.setVisible(true);assert.ok(meshes.every(m=>m.isVisible));
  const mount=door.root.parent;exterior.dispose();exterior.dispose();assert.ok(door.root.isDisposed()&&mount.isDisposed());
  assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.materials.length,0);
  assert.ok(scene.textures.every(t=>t.name.startsWith('data:EnvironmentBRDFTexture')),'only the reusable scene-owned BRDF remains');
});

test('a normal one-metre frontal approach can fully open the wider entry without sidestepping',t=>{
 const {scene,exterior}=setup(t),p=planToWorld(point(0,a.doorY-1),a.floor+1.6),eye=new b.Vector3(p.x,p.y,p.z);
 const i=new(load('RoomInteractions').RoomInteractions)(scene,()=>{},()=>eye);i.addDoor(exterior.lighthouseDoor);
 i.actions.get(exterior.lighthouseDoor.meshes[0]).toggle();for(let n=0;n<25;n++)i.update(.05);
 assert.equal(i.doors[0].blocked,false);assert.equal(i.doors[0].progress,1);assert.ok(exterior.lighthouseDoor.openAngle>0,'inward sweep clears the exterior approach');
});

test('the control panel has a clear frontal operating bay and its complete face can be picked',t=>{
  const {scene,exterior}=setup(t),panel=exterior.lighthouseDetails.panel,p=a.controlPanel;
  const nx=Math.cos(p.angle),ny=Math.sin(p.angle),tx=-ny,ty=nx;
  const interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{});
  let clicks=0;interactions.addDevice(panel,()=>clicks++);
  const {canBoardLighthouseLadder}=load('LighthouseLadder');
  for(const lateral of [-.25,0,.25]) {
    const standing=point(p.x-nx*1.1+tx*lateral,p.y-ny*1.1+ty*lateral);
    assert.equal(allowed(standing,.26,a.floor),true,'standing bay is walkable');
    assert.equal(canBoardLighthouseLadder(standing,a.floor,true),false,'panel clicks cannot board the ladder');
    const eyeAt=planToWorld(standing,a.floor+1.6),eye=new b.Vector3(eyeAt.x,eyeAt.y,eyeAt.z);
    assert.equal(interactions.canReachDevice(panel,eye),true,'local command authority sees the same panel');
    for(const across of [-.3,0,.3])for(const up of [-.25,0,.25]) {
      const targetAt=planToWorld(point(p.x-nx*p.depth/2+tx*across,p.y-ny*p.depth/2+ty*across),a.floor+p.centerHeight+up);
      const target=new b.Vector3(targetAt.x,targetAt.y,targetAt.z),ray=new b.Ray(eye,target.subtract(eye).normalize(),7.5);
      const action=interactions.pick(ray);assert.ok(action,JSON.stringify({lateral,across,up}));
      assert.match(action.label(),/首层运行面板/);action.toggle();
    }
  }
  assert.equal(clicks,27,'all 27 direct/offset samples open with one action');
  const outside=planToWorld(point(p.x+nx,p.y+ny),a.floor+1.6);
  assert.equal(interactions.canReachDevice(panel,new b.Vector3(outside.x,outside.y,outside.z)),false,'masonry still blocks access');
  const far=planToWorld(point(p.x-nx*2,p.y-ny*2),a.floor+1.6);
  assert.equal(interactions.canReachDevice(panel,new b.Vector3(far.x,far.y,far.z)),false,'1.5m command range is retained');
  for(const fraction of [.25,.5,.75,1]) {
    const target=point((p.x-nx*1.1)*fraction,-2+(p.y-ny*1.1+2)*fraction);
    assert.equal(allowed(target,.26,a.floor),true,'entry-to-panel approach stays clear');
  }
});
