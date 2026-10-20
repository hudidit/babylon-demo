const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const b = require('@babylonjs/core/pure');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/examples',name+'.ts'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','module','exports',code)(id => id.startsWith('./') ? load(id.slice(2)) : require(id),module,module.exports);
  cache.set(name,module.exports); return module.exports;
}
load('RoomRuntime').registerRoomRuntime();
const {COASTAL_SITE,coastalRoute,coastalRouteLength} = load('CoastalSite');
const {COASTAL_CLIFF,coastalCrestY,coastalSurfaceHeight,coastalLandPatch} = load('CoastalCliff');
const {planToWorld} = load('HouseLayout');

test('the entire rounded path width rests on land and clears the original coast pinch point', () => {
  const route=coastalRoute(),half=COASTAL_SITE.pathWidth/2;
  assert.ok(coastalRouteLength(coastalSurfaceHeight)>=190 && coastalRouteLength(coastalSurfaceHeight)<=230);
  assert.deepEqual(route[0],{x:10.8,y:4.65});
  assert.deepEqual(route.at(-1),{x:COASTAL_SITE.tower.x,y:COASTAL_SITE.tower.y});
  for(let i=0;i<route.length;i++){
    const p=route[i],a=route[Math.max(0,i-1)],z=route[Math.min(route.length-1,i+1)],dx=z.x-a.x,dy=z.y-a.y,n=Math.hypot(dx,dy);
    if(i)assert.ok(Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y)<=.301);
    if(i)assert.ok(Math.abs(coastalSurfaceHeight(p.x,p.y)-coastalSurfaceHeight(route[i-1].x,route[i-1].y))
      /Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y)<=.08,'the main road must keep its planned 8% maximum grade');
    for(const offset of [-half,0,half]){
      const x=p.x-dy/n*offset,y=p.y+dx/n*offset;
      assert.ok(Number.isFinite(coastalSurfaceHeight(x,y)),`missing path support at ${x},${y}`);
      assert.ok(coastalCrestY(x)-y>=4,`path too close to crest at ${x},${y}`);
    }
  }
  for(const dx of [-7,0,7])for(const dy of [-9,0,9])
    assert.ok(Math.abs(coastalSurfaceHeight(COASTAL_SITE.tower.x+dx,COASTAL_SITE.tower.y+dy)-3)<1e-8,'tower plaza is level and fully supported');
});

test('placement heights equal hits on actual terrain triangles instead of the continuous height formula', t => {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
  const mesh=new b.Mesh('land',scene),g=coastalLandPatch(0,COASTAL_CLIFF.columns,0,COASTAL_CLIFF.nearRows),vd=new b.VertexData();
  vd.positions=g.positions;vd.indices=g.indices;vd.applyToMesh(mesh);mesh.computeWorldMatrix(true);
  for(const p of coastalRoute().filter((_,i)=>i%13===0)){
    const v=planToWorld(p,20),hit=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,-1,0),150));
    assert.ok(hit.hit);
    assert.ok(Math.abs((hit.pickedPoint.y+5)/5-coastalSurfaceHeight(p.x,p.y))<2e-5);
  }
  assert.equal(coastalSurfaceHeight(-125,120),undefined,'the sea must not provide a phantom support height');
});

test('the expanded shoreline field covers the new cape with the existing near-house sampling density', () => {
  const {OCEAN_FIELD:f,coastalShoreField,coastalShoreDistance}=load('CoastalOcean'),data=coastalShoreField();
  assert.ok(f.width/f.size<=135/256 && f.depth/f.size<=155/256);
  for(const p of [{x:-125,y:90},{x:-125,y:120},{x:-144,y:95},{x:8.1,y:40}]){
    const col=Math.floor((p.x-f.minX)/f.width*f.size),row=Math.floor((p.y-f.minY)/f.depth*f.size);
    assert.ok(col>=0&&row>=0&&col<f.size&&row<f.size);
    const i=(row*f.size+col)*4,actual=((data[i]*256+data[i+1])/65535*2-1)*f.range;
    const exact=coastalShoreDistance(f.minX+(col+.5)/f.size*f.width,f.minY+(row+.5)/f.size*f.depth);
    assert.ok(Math.abs(actual-Math.max(-f.range,Math.min(f.range,exact)))<.002);
  }
});

test('coast map landmarks follow the existing house map and a real north-up left-handed camera', () => {
  const {coastalDrawingPoint:p,coastalPlanSvg}=load('CoastalMap');
  const view=b.Matrix.LookAtLH(new b.Vector3(0,1000,0),b.Vector3.Zero(),new b.Vector3(0,0,-1));
  const transform=view.multiply(b.Matrix.OrthoLH(2000,2000,.1,3000));
  const project=point=>{const q=planToWorld(point);return b.Vector3.Project(new b.Vector3(q.x,q.y,q.z),b.Matrix.Identity(),transform,new b.Viewport(0,0,600,600));};
  const points=[{x:5.4,y:5.4},COASTAL_SITE.lookout,COASTAL_SITE.tower];
  for(const a of points)for(const z of points){
    assert.equal(Math.sign(p(a.x,a.y).x-p(z.x,z.y).x),Math.sign(project(a).x-project(z).x));
    assert.equal(Math.sign(p(a.x,a.y).y-p(z.x,z.y).y),Math.sign(project(a).y-project(z).y));
  }
  const svg=coastalPlanSvg();assert.ok(!/NaN|undefined/.test(svg));assert.match(svg,/步行到灯塔/);
});

test('road faces remain above actual land while outdoor movement uses the explicit surface controller', t => {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});
  const exterior=new(load('RoomExterior').RoomExterior)(scene),mesh=scene.getMeshByName('coastal-lighthouse-path');
  const p=mesh.getVerticesData(b.VertexBuffer.PositionKind),indices=mesh.getIndices();
  for(let i=0;i<indices.length;i+=3){
    const points=indices.slice(i,i+3).map(index=>p.slice(index*3,index*3+3));
    const centre=[0,1,2].map(axis=>points.reduce((sum,a)=>sum+a[axis]/3,0));
    const clearance=(centre[1]+5)/5-coastalSurfaceHeight(centre[0]/5+5.4,centre[2]/5+5.4);
    assert.ok(clearance>=0 && clearance<.08,'a road face must not cut through or float above the terrain');
  }
  assert.equal(scene.metadata.coastalSite.outdoorWalking,true);
  assert.equal(scene.metadata.coastalSite.stage,'C');
  assert.ok(exterior.meshes.filter(m=>!m.metadata.movingLighthouseDoor).every(m=>!m.checkCollisions));
  assert.ok(exterior.lighthouseDoor.meshes.every(m=>m.checkCollisions));
  exterior.setHouseEnclosed(false);assert.equal(scene.getMeshByName('coastal-house-roof').isVisible,false);
  exterior.setHouseEnclosed(true);assert.equal(scene.getMeshByName('coastal-house-roof').isVisible,true);
});

const walking=load('WalkingSurface'),access=load('CoastalPath'),jump=load('HouseJump');
const {HOUSE_COORDINATES,houseRoomAt}=load('HouseLayout');
const {COASTAL_WALK_BOUNDARY,COASTAL_HOME}=load('CoastalSite');

test('walking support matches rendered road, ramp, lookout and plaza top faces including negative heights', t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});new(load('RoomExterior').RoomExterior)(scene);
  const points=coastalRoute().filter((_,i)=>i%11===0&&!houseRoomAt(coastalRoute()[i].x,coastalRoute()[i].y));
  points.push({x:11.3,y:4.65},{x:12.5,y:4.65},{x:-125,y:83},{x:-70,y:26},{x:-70.8,y:24});
  for(const point of points){
    const v=planToWorld(point,30),hit=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,-1,0),250),
      m=>m.name.startsWith('coastal-platform-')||['coastal-lighthouse-path','coastal-entry-ramp','coastal-lighthouse-plaza','coastal-lighthouse-lookout','coastal-lighthouse-ground-floor','coastal-lighthouse-entry-steps'].includes(m.name));
    assert.ok(hit.hit);const support=walking.walkingSurfaceAt(point.x,point.y);
    assert.ok(Math.abs((hit.pickedPoint.y-HOUSE_COORDINATES.floorY)/5-support.height)<2e-5,JSON.stringify({point,support,hit:hit.pickedPoint.y}));
    assert.ok(support.normal.y>Math.cos(Math.PI/6));
  }
  assert.ok(walking.walkingSurfaceAt(COASTAL_HOME.x,COASTAL_HOME.y).height<0);
  assert.equal(walking.walkingSurfaceAt(-125,120),undefined);assert.equal(walking.walkingSurfaceAt(0,-500),undefined);
  assert.equal(walking.walkingSurfaceAt(NaN,0),undefined);
});

test('the entrance, rounded route and complete ring around the solid tower are continuously walkable both ways',()=>{
  const route=[{x:10.25,y:4.65},...coastalRoute().filter(p=>Math.hypot(p.x+125,p.y-90)>4.5)];
  for(let i=1;i<route.length;i++){
    assert.ok(walking.walkingPointAllowed(route[i]),JSON.stringify(route[i]));
    const a=walking.sweepWalking(route[i-1],route[i]),z=walking.sweepWalking(route[i],route[i-1]);
    assert.ok(a&&Math.hypot(a.x-route[i].x,a.y-route[i].y)<1e-7,JSON.stringify({a,to:route[i]}));
    assert.ok(z&&Math.hypot(z.x-route[i-1].x,z.y-route[i-1].y)<1e-7);
  }
  for(let i=0;i<120;i++){
    const point={x:-125+5.5*Math.cos(i/120*Math.PI*2),y:90+5.5*Math.sin(i/120*Math.PI*2)};
    assert.ok(walking.walkingPointAllowed(point),JSON.stringify(point));
  }
});

test('long and airborne moves cannot cross windows, balcony rails, tower or the finite guardrail',()=>{
  const cases=[
    [{x:-1,y:8},{x:1,y:8}],
    [{x:8,y:11.8},{x:8,y:16}],
    [{x:-125,y:84.5},{x:-125,y:95.5}],
    [{x:14,y:0},{x:19,y:0}],
  ];
  for(const [a,z] of cases){
    const end=walking.sweepWalking(a,z);assert.ok(end,JSON.stringify(a));
    assert.ok(Math.hypot(end.x-z.x,end.y-z.y)>.5,JSON.stringify({a,z,end}));
    assert.ok(walking.walkingPointAllowed(end));
  }
  assert.equal(walking.sweepWalking(COASTAL_HOME,{x:NaN,y:4}),undefined);
  assert.equal(walking.sweepWalking(COASTAL_HOME,{x:-125,y:90}),undefined);
  // Sampling the interior of the segment is essential: the destination beyond the tower is valid.
  assert.ok(walking.walkingPointAllowed({x:-125,y:95.5}));
});

test('visible guardrail follows real terrain and leaves its full support on land',()=>{
  const g=access.coastalGuardrailGeometry();assert.ok(g.positions.length/3<20000);
  const normals=[];b.VertexData.ComputeNormals(g.positions,g.indices,normals);
  for(let box=0;box<g.positions.length;box+=72){
    const centre=[0,1,2].map(axis=>Array.from({length:24},(_,i)=>g.positions[box+i*3+axis]).reduce((a,z)=>a+z)/24);
    for(let face=0;face<6;face++){
      const at=box+face*12,mid=[0,1,2].map(axis=>[0,1,2,3].reduce((sum,i)=>sum+g.positions[at+i*3+axis]/4,0));
      assert.ok(mid.reduce((sum,v,axis)=>sum+(v-centre[axis])*normals[at+axis],0)>0,'guardrail box normals face outward');
    }
  }
  for(let i=0;i<COASTAL_WALK_BOUNDARY.length;i++){
    const a=COASTAL_WALK_BOUNDARY[i],z=COASTAL_WALK_BOUNDARY[(i+1)%COASTAL_WALK_BOUNDARY.length];
    const count=Math.ceil(Math.hypot(a.x-z.x,a.y-z.y)/.2);
    for(let j=0;j<=count;j++)assert.ok(Number.isFinite(coastalSurfaceHeight(a.x+(z.x-a.x)*j/count,a.y+(z.y-a.y)*j/count)));
  }
});

test('outdoor jumps land on their actual negative or elevated ground without a global indoor ceiling',()=>{
  for(const floor of [-.14,1,3.04]){
    const state=jump.createJumpState();jump.resetJumpState(state,floor);jump.requestJump(state);
    let highest=floor;
    for(let i=0;i<180;i++){
      jump.advanceJump(state,1/120,{x:-120,y:85},{floor});highest=Math.max(highest,state.feet);
      if(i&&state.grounded)break;
    }
    assert.ok(highest-floor>.68&&highest-floor<=.72);assert.equal(state.feet,floor);assert.ok(state.grounded);
  }
  const state=jump.createJumpState();jump.resetJumpState(state,3);
  for(let i=0;i<120;i++)jump.advanceJump(state,1/60,{x:-125,y:120},{floor:undefined});
  assert.ok(!state.grounded&&state.feet<0,'missing support must never land on an invented zero floor');
});

test('ramp and main-road slopes can be followed while grounded without tiny repeated falls',()=>{
  const state=jump.createJumpState();
  for(let x=10.5;x<13;x+=.02){const p={x,y:4.65},support=walking.walkingSurfaceAt(p.x,p.y);jump.advanceJump(state,1/60,p,{floor:support.height,ceiling:support.ceiling});assert.ok(state.grounded);assert.ok(Math.abs(state.feet-support.height)<1e-7);}
  const route=coastalRoute().filter(p=>p.x<-15&&Math.hypot(p.x+125,p.y-90)>4.5);
  jump.resetJumpState(state,walking.walkingSurfaceAt(route[0].x,route[0].y).height);
  for(const p of route){const support=walking.walkingSurfaceAt(p.x,p.y);jump.advanceJump(state,1/60,p,{floor:support.height});assert.ok(state.grounded);assert.ok(Math.abs(state.feet-support.height)<1e-7);}
});

test('walking recovery keeps a valid elevated checkpoint and rejects void or newly obstructed saved poses', t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
  const Room=load('Room').RoomScene,room=Object.create(Room.prototype);
  room.firstPersonCamera=new b.UniversalCamera('recovery',b.Vector3.Zero(),scene);
  room.previousWalk=b.Vector3.Zero();room.jump=jump.createJumpState();
  let clear=true;room.interactions={walkerIsClear:()=>clear};
  const point={x:-120,y:85},support=walking.walkingSurfaceAt(point.x,point.y),v=planToWorld(point,support.height+1.6);
  room.firstPersonCamera.position.set(v.x,v.y,v.z);room.firstPersonCamera.rotation.set(.1,1.3,0);jump.resetJumpState(room.jump,support.height);
  room.stableWalk={position:room.firstPersonCamera.position.clone(),feet:support.height};room.saveWalkingPose();
  assert.ok(room.walkPoseIsValid(room.walkPose));assert.deepEqual(room.walkPose.rotation.asArray(),[.1,1.3,0]);
  room.firstPersonCamera.position.x=NaN;room.restoreStableWalk();assert.deepEqual(room.firstPersonCamera.position.asArray(),[v.x,v.y,v.z]);
  assert.equal(room.jump.feet,support.height);assert.ok(room.jump.grounded);
  clear=false;assert.equal(room.walkPoseIsValid(room.walkPose),false);
  room.restoreStableWalk();assert.ok(Math.abs(room.firstPersonCamera.position.x/5+5.4-COASTAL_HOME.x)<1e-8);
  assert.equal(room.jump.velocity,0);assert.ok(Number.isFinite(room.firstPersonCamera.position.y));
});

test('restoration checks actual door-leaf transforms after an orbit-view door movement',t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});
  const mount=new b.TransformNode('fixed-door-mount',scene),root=new b.TransformNode('entry-leaf',scene),p=planToWorld({x:10.8,y:4.1});
  mount.position.set(p.x,p.y,p.z);mount.rotation.y=Math.PI/2;root.parent=mount;
  const leaf=b.CreateBox('restoration-door-leaf',{width:.18,height:10.6,depth:5.5},scene);leaf.parent=root;leaf.position.set(0,5.3,2.75);
  const door={id:'entry-door',label:'入户门',root,meshes:[leaf],width:5.5,openAngle:Math.PI/2,walkerRadius:1.3};
  const interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{});interactions.addDoor(door);
  const centre=()=>b.Vector3.TransformCoordinates(new b.Vector3(0,8,door.width/2),door.root.computeWorldMatrix(true));
  const closedCentre=centre();assert.equal(interactions.walkerIsClear(closedCentre),false);
  door.root.rotation.y=door.openAngle;assert.equal(interactions.walkerIsClear(centre()),false);
  assert.equal(interactions.walkerIsClear(closedCentre),true,'the previous closed-leaf area is free after opening');
  const q=planToWorld(COASTAL_HOME,1.6);assert.equal(interactions.walkerIsClear(new b.Vector3(q.x,q.y,q.z)),true);
});

test('lighthouse door and windows are real recessed openings while the permanent shaft stays solid between them',t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});new(load('RoomExterior').RoomExterior)(scene);
  const tower=COASTAL_SITE.tower,shaft=scene.getMeshByName('coastal-lighthouse-shaft');shaft.computeWorldMatrix(true);
  const hit=(h,x=0)=>{const p=planToWorld({x:tower.x+x,y:tower.y-4},tower.ground+.49+h);
    return scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,0,1),12),m=>m===shaft).hit;};
  for(const h of [1,4.4,9,13.1]) assert.equal(hit(h),false,'ray crosses an actual opening, not a dark decal');
  for(const h of [2.6,6,11,15]) assert.equal(hit(h),true,'opaque masonry between openings remains present');
  const g=load('CoastalLandmark').coastalTowerShaft();
  for(let i=0;i<g.indices.length;i+=3){const a=g.indices[i]*3,c=g.indices[i+1]*3,d=g.indices[i+2]*3;
    const A=b.Vector3.FromArray(g.positions,a),C=b.Vector3.FromArray(g.positions,c),D=b.Vector3.FromArray(g.positions,d),centre=A.add(C).add(D).scale(1/3);
    const world=planToWorld(tower),radial=new b.Vector3(centre.x-world.x,0,centre.z-world.z);
    assert.ok(b.Vector3.Dot(b.Vector3.Cross(A.subtract(C),D.subtract(C)),radial)>0,'wall winding faces outside');
  }
});

test('all exterior roof pieces hide together and landmark materials cannot inherit the house cutaway',t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});const exterior=new(load('RoomExterior').RoomExterior)(scene);
  const roofs=exterior.meshes.filter(m=>m.metadata.exteriorLayer==='house-roof');assert.ok(roofs.length>=3);
  exterior.updateCutaway({x:60,z:30},{x:0,z:0});
  for(const m of exterior.meshes.filter(m=>m.metadata.exteriorLayer==='landmark'||m.metadata.exteriorLayer==='path'))assert.ok(m.material.clipPlane2==null,m.name);
  exterior.setHouseEnclosed(false);assert.ok(roofs.every(m=>!m.isVisible));
  exterior.setVisible(false);exterior.setHouseEnclosed(true);assert.ok(roofs.every(m=>!m.isVisible));
  exterior.setVisible(true);assert.ok(roofs.every(m=>m.isVisible));
  assert.equal(scene.getMaterialByName('coastal-gravel-path').albedoTexture,exterior.surfaces.rock.albedoTexture);
  assert.equal(exterior.surfaces.textures.length,9,'seven outdoor downloads plus the two original generated signage atlases');
});

test('local shadow coverage has hysteresis, caches at rest, stops in background and removes its observer',t=>{
  const engine=new b.NullEngine(),scene=new b.Scene(engine),doc={hidden:false,addEventListener(){},removeEventListener(){}};
  scene.useDelayedTextureLoading=true;engine.getRenderingCanvas=()=>({ownerDocument:doc});
  t.after(()=>{scene.dispose();engine.dispose();});const camera=new b.FreeCamera('walk-visuals',b.Vector3.Zero(),scene),exterior=new(load('RoomExterior').RoomExterior)(scene);
  const map=exterior.shadow.getShadowMap(),initial=exterior.sun.position.clone(),textureCount=scene.textures.length;
  let resets=0;map.resetRefreshCounter=()=>resets++;
  const place=(x,y)=>{const p=planToWorld({x,y},5);camera.position.set(p.x,p.y,p.z);camera.getViewMatrix(true);exterior.updateVisuals();};
  place(-125,83);assert.ok(!exterior.sun.position.equals(initial));assert.equal(exterior.shadow.bias,.001);assert.equal(exterior.shadow.normalBias,.25);const zone=scene.metadata.coastalSite.shadowZone;
  assert.ok(scene.getMeshByName('coastal-lighthouse-fine-metal').isVisible);
  const afterMove=resets;for(let i=0;i<20;i++)place(-125+i*.01,83);
  assert.equal(resets,afterMove,'no stationary or tiny-movement refresh');assert.equal(scene.metadata.coastalSite.shadowZone,zone);
  doc.hidden=true;place(12,4);assert.equal(scene.metadata.coastalSite.shadowZone,zone);assert.equal(resets,afterMove);
  doc.hidden=false;place(12,4);assert.equal(scene.metadata.coastalSite.shadowZone,0);assert.equal(exterior.shadow.bias,.00015);assert.equal(exterior.shadow.normalBias,.045);
  assert.equal(scene.getMeshByName('coastal-lighthouse-fine-metal').isVisible,false);
  assert.equal(exterior.shadow.getShadowMap(),map);assert.equal(scene.textures.length,textureCount);
  const observers=scene.onBeforeRenderObservable.observers.filter(o=>!o._willBeUnregistered).length;
  exterior.dispose();assert.equal(scene.onBeforeRenderObservable.observers.filter(o=>!o._willBeUnregistered).length,observers-2);
});
