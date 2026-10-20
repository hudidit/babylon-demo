const assert=require('node:assert/strict'),{test}=require('node:test');
const b=require('@babylonjs/core/pure'),load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {LIGHTHOUSE:a,LIGHTHOUSE_FLOORS:floors,LIGHTHOUSE_WINDOWS:windows,lighthouseHoleAt}=load('LighthouseLayout');
const ladder=load('LighthouseLadder'),walking=load('WalkingSurface'),{planToWorld}=load('HouseLayout'),{COASTAL_SITE:{tower:tower}}=load('CoastalSite');
const point=(x,y)=>({x:tower.x+x,y:tower.y+y});
function setup(t){const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;const exterior=new(load('RoomExterior').RoomExterior)(scene);t.after(()=>{scene.dispose();engine.dispose();});return{engine,scene,exterior};}

test('each existing high window gets a full storey with a 0.9m sill and a safe ladder landing',()=>{
  assert.equal(floors.length,5);assert.deepEqual(floors.map(f=>Number(f.height.toFixed(2))),[3.54,6.39,10.99,15.09,19.64]);
  windows.forEach((w,i)=>assert.ok(Math.abs(tower.ground+.49+w.bottom-floors[i+1].height-.9)<1e-8));
  const landing=ladder.lighthouseLadderLanding();
  for(const f of floors){const s=walking.walkingSurfaceAt(landing.x,landing.y,f.height);assert.ok(Math.abs(s.height-f.height)<1e-7);assert.ok(walking.walkingPointAllowed(landing,.26,f.height),f.label);assert.ok(ladder.canBoardLighthouseLadder(landing,f.height,true));assert.equal(ladder.canBoardLighthouseLadder(landing,f.height,false),false);}
  assert.equal(ladder.canBoardLighthouseLadder(landing,a.floor+.4,true),false);assert.equal(ladder.canBoardLighthouseLadder(point(2,0),a.floor,true),false);
});

test('all storey support and overhead heights match actual rendered floor faces and the well is open',t=>{
  const {scene}=setup(t),predicate=m=>['coastal-lighthouse-ground-floor','coastal-lighthouse-level-floors','coastal-lighthouse-level-deck'].includes(m.name);
  for(const floor of floors){
    const p=point(.5,-.75),v=planToWorld(p,floor.height+.04),s=walking.walkingSurfaceAt(p.x,p.y,floor.height);
    const hit=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,-1,0),1.5),predicate);assert.ok(hit.hit,floor.label);assert.ok(Math.abs((hit.pickedPoint.y+5)/5-s.height)<2e-5);assert.ok(hit.getNormal(true).y>.99);
    if(floor.index<4){const up=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,1,0),30),predicate);assert.ok(up.hit);assert.ok(Math.abs((up.pickedPoint.y+5)/5-s.ceiling)<2e-5);assert.ok(s.ceiling-s.height>=2.6);}
    if(floor.hole){const hole=planToWorld(ladder.lighthouseLadderPoint(),floor.height+.04),down=scene.pickWithRay(new b.Ray(new b.Vector3(hole.x,hole.y,hole.z),new b.Vector3(0,-1,0),1),predicate);assert.equal(down.hit,false,'ladder opening is geometry, not a dark decal');}
  }
  const centre=ladder.lighthouseLadderPoint(),low=planToWorld(centre,a.floor+.1);
  const through=scene.pickWithRay(new b.Ray(new b.Vector3(low.x,low.y,low.z),new b.Vector3(0,1,0),82),m=>predicate(m)||m.name==='coastal-lighthouse-level-cornice');assert.equal(through.hit,false,'the entire body shaft stays clear through all four openings');
});

test('floor selection cannot project upper floors down to the entrance or change levels during a long move',()=>{
  const p=point(.5,-.75),heights=floors.map(f=>walking.walkingSurfaceAt(p.x,p.y,f.height).height);
  assert.deepEqual(heights,floors.map(f=>f.height));assert.equal(walking.walkingSurfaceAt(p.x,p.y).height,a.floor);
  for(const floor of floors){const target=point(.9,-.85),next=walking.sweepWalking(p,target,floor.height);assert.ok(next&&Math.hypot(next.x-target.x,next.y-target.y)<1e-6);assert.ok(Math.abs(next.height-floor.height)<1e-6);}
});

test('walking and jumping cannot enter the ladder well, cross glazing or leave the gallery edge',()=>{
  const hole=ladder.lighthouseLadderPoint(),landing=ladder.lighthouseLadderLanding();assert.ok(lighthouseHoleAt(hole.x-tower.x,hole.y-tower.y));
  for(const floor of floors){for(const raised of [0,.55])assert.equal(walking.walkingPointAllowed(hole,.26,floor.height+raised),false);
    const end=walking.sweepWalking(landing,hole,floor.height);assert.ok(end&&end.y<tower.y+a.ladder.minY-.26);
    if(floor.index<4)assert.equal(walking.walkingPointAllowed(point(.65,-2.45),.26,floor.height),false,'window/masonry protection includes player radius');
  }
  for(let i=0;i<8;i++)if(i!==a.exitPanel)assert.equal(walking.walkingPointAllowed(point(1.617*Math.cos((i+.5)*Math.PI/4),1.617*Math.sin((i+.5)*Math.PI/4)),.26,a.gallery),false);
  for(let i=0;i<32;i++){const theta=i*Math.PI/16;assert.equal(walking.walkingPointAllowed(point(2.8*Math.cos(theta),2.8*Math.sin(theta)),.26,a.gallery),false);}
});

test('vertical input stops exactly at every storey in both directions and consumes held movement',()=>{
  for(const dt of [1/120,.05,.2,3]){
    const state=ladder.createLighthouseLadderState();state.attached=true;
    for(const target of [...floors.slice(1),...floors.slice(0,4).reverse()]){
      const input={up:target.height>state.feet,down:target.height<state.feet};let arrived;
      for(let i=0;i<3000&&!arrived;i++)arrived=ladder.advanceLighthouseLadder(state,input,dt);
      assert.equal(arrived?.index,target.index);assert.equal(state.feet,target.height);assert.deepEqual(input,{up:false,down:false});
      for(let i=0;i<40;i++)ladder.advanceLighthouseLadder(state,input,dt);assert.equal(state.feet,target.height,'holding/repeats do not skip the stop');
    }
  }
});

test('ladder mid-flight stopping, simultaneous keys, endpoints and invalid input stay bounded',()=>{
  const state=ladder.createLighthouseLadderState();assert.equal(ladder.advanceLighthouseLadder(state,{up:true,down:false},1),undefined);state.attached=true;
  ladder.advanceLighthouseLadder(state,{up:true,down:false},.2);const mid=state.feet;
  for(const input of [{up:false,down:false},{up:true,down:true}])for(let i=0;i<100;i++)ladder.advanceLighthouseLadder(state,input,.2);
  assert.equal(state.feet,mid);assert.equal(ladder.lighthouseLadderFloor(mid),undefined);
  for(const dt of [NaN,Infinity,-1,0]){ladder.advanceLighthouseLadder(state,{up:true,down:false},dt);assert.equal(state.feet,mid);}
  state.feet=a.gallery;ladder.advanceLighthouseLadder(state,{up:true,down:false},.2);assert.equal(state.feet,a.gallery);
  state.feet=a.floor;ladder.advanceLighthouseLadder(state,{up:false,down:true},.2);assert.equal(state.feet,a.floor);
});

test('camera keeps its orientation, pauses mid-climb and leaves only onto a real storey',t=>{
  const {engine,scene}=setup(t),Room=load('Room').RoomScene,room=Object.create(Room.prototype);
  room.scene=scene;room.engine=engine;room.firstPersonCamera=new b.UniversalCamera('ladder-camera',b.Vector3.Zero(),scene);room.previousWalk=b.Vector3.Zero();room.jump=load('HouseJump').createJumpState();
  room.ladder={attached:true,feet:floors[1].height+.5};room.ladderInput={up:true,down:false};room.pointerLocked=true;room.updateControls=()=>{};room.updateInteractionHint=()=>{};room.interactions={walkerIsClear:()=>true};engine.getDeltaTime=()=>50;
  const previousDocument=global.document;global.document={hidden:false,addEventListener(){},removeEventListener(){}};t.after(()=>{global.document=previousDocument;});
  room.firstPersonCamera.rotation.set(.12,1.35,0);room.updateLadder();assert.ok(Math.abs(room.ladder.feet-floors[1].height-.58)<1e-7);assert.deepEqual(room.firstPersonCamera.rotation.asArray(),[.12,1.35,0]);
  room.pauseLadder();const paused=room.ladder.feet;room.updateLadder();assert.equal(room.ladder.feet,paused);room.leaveLadder();assert.equal(room.ladder.attached,true);assert.equal(room.ladderTransition,undefined);
  room.ladder.feet=floors[2].height;room.placeLadderCamera();room.leaveLadder();assert.ok(room.ladderTransition?.leaving);for(let i=0;i<8;i++)if(room.ladder.attached)room.updateLadder();
  assert.equal(room.ladder.attached,false);assert.equal(room.jump.grounded,true);assert.equal(room.jump.feet,floors[2].height);assert.ok(room.walkPoseIsValid(room.walkPose));assert.deepEqual(room.firstPersonCamera.rotation.asArray(),[.12,1.35,0]);
});

test('entry door vertical clearance and resource ownership remain correct after adding floors',t=>{
  const {scene,exterior}=setup(t),door=exterior.lighthouseDoor,interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{});interactions.addDoor(door);
  const p=point(0,a.doorY),eye=planToWorld(p,a.floor+1.6);assert.equal(interactions.walkerIsClear(new b.Vector3(eye.x,eye.y,eye.z)),false);
  const high=planToWorld(p,a.gallery+1.6);assert.equal(interactions.walkerIsClear(new b.Vector3(high.x,high.y,high.z)),true);
  assert.ok(load('RoomInteractions').doorSweepIsClear(door,0,1,new b.Vector3(high.x,high.y,high.z)));
  const structure=exterior.meshes.filter(m=>m.metadata.lighthouseInteriorStructure);assert.equal(structure.length,6);assert.ok(structure.reduce((n,m)=>n+m.getTotalVertices(),0)<=8000);
  assert.ok(exterior.meshes.filter(m=>!m.metadata.lighthouseInteriorStructure && !m.metadata.lighthouseDetail && !m.metadata.lighthouseEquipment).reduce((n,m)=>n+m.getTotalVertices(),0)<160000);
  assert.equal(scene.getMeshByName('coastal-lighthouse-ground-ceiling'),null);assert.equal(scene.metadata.coastalSite.interiorStage,3);assert.equal(exterior.surfaces.textures.length,9);
  exterior.dispose();exterior.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.materials.length,0);
});
