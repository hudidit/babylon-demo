const assert = require('node:assert/strict'), {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {lighthouseBeamStrength: beam, LIGHTHOUSE_BEAM} = load('LighthouseBeacon');
const {LIGHTHOUSE_SHAFT: shaft, lighthouseShaftEnvelope: envelope} = load('LighthouseBeam');
const {LighthouseOperation} = load('LighthouseOperation');
const {LIGHTHOUSE: layout} = load('LighthouseLayout'), {COASTAL_SITE: {tower}} = load('CoastalSite');
const {planToWorld} = load('HouseLayout');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);

function setup(t) {
  load('RoomRuntime').registerRoomRuntime();
  const b = require('@babylonjs/core/pure'), engine = new b.NullEngine(), scene = new b.Scene(engine);
  scene.useDelayedTextureLoading = true;
  const exterior = new (load('RoomExterior').RoomExterior)(scene), details = exterior.lighthouseDetails;
  const point = (x, y, height) => {const p = planToWorld({x: tower.x + x, y: tower.y + y}, height); return new b.Vector3(p.x, p.y, p.z);};
  const camera = new b.UniversalCamera('beacon-test', point(.25, -1.1, layout.gallery + 1.6), scene);
  scene.activeCamera = camera;
  t.after(() => {scene.dispose(); engine.dispose();});
  return {b, engine, scene, exterior, details, beacon: details.beacon, point, camera};
}

test('every fixed observer sees one forward flash per ten seconds, with a dark opposite direction', () => {
  for (const angle of [0, .4, Math.PI / 2, Math.PI, 5.3]) {
    let risingEdges = 0, previous = false, peak = 0;
    for (let i = -1; i <= 1000; i++) {
      const strength = beam(i / 1000, Math.sin(angle), Math.cos(angle));
      if (i >= 0 && strength > .5 && !previous) risingEdges++;
      previous = strength > .5; peak = Math.max(peak, strength);
    }
    assert.equal(risingEdges, 1); near(peak, 1);
    near(beam(angle / (Math.PI * 2), Math.sin(angle), Math.cos(angle)), 1);
    near(beam(angle / (Math.PI * 2), -Math.sin(angle), -Math.cos(angle)), 0);
    near(beam(.123, Math.sin(angle), Math.cos(angle)), beam(1.123, Math.sin(angle), Math.cos(angle)));
  }
  assert.equal(beam(0, 0, 0), 0); assert.equal(beam(NaN, 0, 1), 0);
  assert.ok(LIGHTHOUSE_BEAM.outerAngle < Math.PI / 4);
});

test('the optical head rotates around its real centre while the frame, base and floor remain fixed', t => {
  const {scene, beacon, point} = setup(t), op = new LighthouseOperation();
  const fixed = scene.getMeshByName('coastal-lighthouse-detail-lantern-brass');
  const before = fixed.computeWorldMatrix(true).asArray().slice();
  const state = {...op.snapshot, rotationRadians: Math.PI / 2, rotationTurns: .25, running: true};
  beacon.apply(state);
  const centre = beacon.source.getBoundingInfo().boundingBox.center;
  const world = require('@babylonjs/core/pure').Vector3.TransformCoordinates(centre, beacon.source.computeWorldMatrix(true));
  const origin = point(0, 0, tower.ground + LIGHTHOUSE_BEAM.opticHeight);
  near(world.x, origin.x + LIGHTHOUSE_BEAM.sourceForward * 5); near(world.z, origin.z); near(world.y, origin.y);
  assert.deepEqual(fixed.computeWorldMatrix(true).asArray(), before);
  assert.ok(beacon.meshes.every(m => m.parent === beacon.root && !m.isWorldMatrixFrozen));
  assert.ok(beacon.meshes.every(m => m.metadata.deviceId === 'lighthouse-beacon-main'));
});

test('all rotating geometry fits the protected core and never enters the cached static shadow map', t => {
  const {b, exterior, beacon} = setup(t), inverse = b.Matrix.Invert(beacon.root.computeWorldMatrix(true));
  let vertices = 0;
  for (const mesh of beacon.meshes) {
    const positions = mesh.getVerticesData('position'), world = mesh.computeWorldMatrix(true);
    vertices += mesh.getTotalVertices();
    for (let i = 0; i < positions.length; i += 3) {
      const p = b.Vector3.TransformCoordinates(b.Vector3.TransformCoordinates(b.Vector3.FromArray(positions, i), world), inverse);
      assert.ok(Math.hypot(p.x, p.z) <= .44 * 5 + 1e-4, mesh.name);
    }
    assert.equal(exterior.shadow.getShadowMap().renderList.includes(mesh), false);
    assert.equal(mesh.checkCollisions, false);
  }
  assert.ok(vertices <= 8000); assert.ok(beacon.meshes.length <= 12);
});

test('navigation emission follows operation, remains independent from the work lamp, and allocates no light or RTT', t => {
  const {scene, beacon, details, exterior} = setup(t), operation = new LighthouseOperation();
  const lights = scene.lights.length, targets = scene.textures.filter(t => t.isRenderTarget).length;
  operation.selectTime(21); beacon.apply(operation.snapshot); assert.equal(beacon.material._floats.beaconOn, 1);
  details.toggle(); assert.equal(beacon.material._floats.beaconOn, 1);
  operation.selectTime(12); beacon.apply(operation.snapshot); assert.equal(beacon.material._floats.beaconOn, 0);
  operation.startTest(); beacon.apply(operation.snapshot); assert.equal(beacon.material._floats.beaconOn, 1);
  exterior.setVisible(false); assert.equal(beacon.root.isEnabled(), false);
  exterior.setVisible(true); assert.equal(beacon.root.isEnabled(), true);
  assert.equal(scene.lights.length, lights); assert.equal(scene.textures.filter(t => t.isRenderTarget).length, targets);
});

test('the visible shaft reaches the sea within its finite forward range and keeps soft transverse edges', () => {
  const {coastalSeaY} = load('CoastalCliff'), origin = planToWorld(tower, tower.ground + LIGHTHOUSE_BEAM.opticHeight);
  const waterDistance = (origin.y - coastalSeaY) / (5 * Math.sin(shaft.pitch));
  assert.ok(waterDistance > 350 && waterDistance < shaft.length * .8);
  assert.ok(envelope(0, 0, waterDistance) > .9);
  assert.ok(envelope(5, 0, waterDistance) < envelope(0, 0, waterDistance));
  for (const z of [-1, 0, shaft.length, shaft.length + 100]) assert.equal(envelope(0, 0, z), 0);
  assert.equal(envelope(100, 0, 200), 0); assert.equal(envelope(0, 100, 200), 0);
  assert.equal(envelope(NaN, 0, 200), 0);
});

test('air and ocean share rotating direction, dirty-pane dimming, shutdown and exterior visibility', t => {
  const {exterior, beacon, scene} = setup(t), op = new LighthouseOperation(), volume = beacon.volume;
  const lights = scene.lights.length, textures = scene.textures.length, observers = scene.onBeforeRenderObservable.observers.length;
  const ocean = exterior.ocean.material;
  op.selectTime(0);
  beacon.apply({...op.snapshot, rotationRadians: Math.PI / 2}, .38);
  for (const m of [volume.material, ocean]) {
    near(m._floats.shaftPower, .38);
    near(m._vectors3.shaftDirection.x, Math.cos(shaft.pitch)); near(m._vectors3.shaftDirection.y, -Math.sin(shaft.pitch));
    near(m._vectors3.shaftDirection.z, 0);
    near(m._vectors3.shaftOrigin.x, beacon.root.position.x + LIGHTHOUSE_BEAM.sourceForward * 5);
  }
  assert.equal(volume.mesh.isEnabled(), true);
  exterior.setVisible(false);
  assert.equal(volume.mesh.isEnabled(), false); assert.equal(ocean._floats.shaftPower, 0);
  exterior.setVisible(true); near(ocean._floats.shaftPower, .38);
  op.selectTime(12); beacon.apply(op.snapshot);
  assert.equal(volume.mesh.isEnabled(), false); assert.equal(ocean._floats.shaftPower, 0);
  op.startTest(); beacon.apply(op.snapshot); assert.equal(volume.mesh.isEnabled(), true);
  beacon.apply({...op.snapshot, running: false}); assert.equal(ocean._floats.shaftPower, 0);
  assert.equal(volume.mesh.checkCollisions, false); assert.equal(volume.mesh.isPickable, false);
  assert.equal(exterior.shadow.getShadowMap().renderList.includes(volume.mesh), false);
  assert.equal(volume.material.disableDepthWrite, true); assert.equal(volume.material.depthFunction, 0);
  assert.ok(volume.mesh.getTotalVertices() < 150);
  assert.equal(scene.lights.length, lights); assert.equal(scene.textures.length, textures);
  assert.equal(scene.onBeforeRenderObservable.observers.length, observers);
});

test('local controls require a clear short ray; walls, glazing, floor and range block access', t => {
  const {b, scene, details, point} = setup(t), interactions = new (load('RoomInteractions').RoomInteractions)(scene, () => {});
  let opened = 0; interactions.addDevice(details.panel, () => opened++); interactions.addDevice(details.test, () => opened++);
  const panelEye = point(1.52, -1.14, layout.floor + 1.6), topEye = point(.25, -1.1, layout.gallery + 1.6);
  const {walkingPointAllowed} = load('WalkingSurface');
  assert.ok(walkingPointAllowed({x: tower.x + 1.52, y: tower.y - 1.14}, .26, layout.floor));
  assert.ok(walkingPointAllowed({x: tower.x + .25, y: tower.y - 1.1}, .26, layout.gallery));
  assert.equal(load('LighthouseLadder').canBoardLighthouseLadder({x: tower.x + .25, y: tower.y - 1.1}, layout.gallery, true), false);
  assert.equal(interactions.canReachDevice(details.panel, panelEye), true);
  assert.equal(interactions.canReachDevice(details.test, topEye), true);
  assert.equal(interactions.canReachDevice(details.panel, point(-3.2, .1, layout.floor + 1.6)), false);
  assert.equal(interactions.canReachDevice(details.test, point(0, -2.5, layout.gallery + 1.6)), false);
  assert.equal(interactions.canReachDevice(details.test, point(0, -1.05, layout.gallery - 1)), false);
  assert.equal(interactions.canReachDevice(details.panel, point(0, .1, layout.floor + 1.6), 1), false);
  const target = details.panel.meshes[0].getBoundingInfo().boundingBox.centerWorld;
  const action = interactions.pick(new b.Ray(panelEye, target.subtract(panelEye).normalize(), 7.5));
  assert.match(action.label(), /首层运行面板/); action.toggle(); assert.equal(opened, 1);
});

test('running atmospheric light never occludes local buttons or direct observation; solid geometry still blocks access', t => {
  const {b,scene,beacon,details,point}=setup(t),{RoomInteractions,interactionSurface}=load('RoomInteractions');
  const interactions=new RoomInteractions(scene,()=>{}),op=new LighthouseOperation(),eye=point(.25,-1.1,layout.gallery+1.6);
  interactions.addDevice(details.test,()=>{});op.selectTime(21);
  for(let n=0;n<32;n++) {
    beacon.apply({...op.snapshot,rotationTurns:n/32,rotationRadians:n/32*Math.PI*2});
    assert.equal(interactionSurface(beacon.volume.mesh),false);
    assert.equal(interactions.canReachDevice(details.test,eye),true,`phase ${n}/32`);
    const direction=beacon.root.position.subtract(eye).normalize();
    assert.equal(interactions.canReachDevice({id:'lighthouse-beacon-main',label:'main',meshes:beacon.meshes},eye,7.5,direction,[details.cover.pane]),true);
  }
  const target=details.test.meshes[0].getBoundingInfo().boundingBox.centerWorld,obstacle=b.CreateBox('solid-ray-obstacle',{size:2},scene);
  obstacle.position.copyFrom(eye.add(target.subtract(eye).scale(.5)));obstacle.isPickable=false;obstacle.computeWorldMatrix(true);
  assert.equal(interactions.canReachDevice(details.test,eye),false);obstacle.dispose();assert.equal(interactions.canReachDevice(details.test,eye),true);
});

test('scene authorization rejects wrong storey, ladder, vehicle, airborne and orbit controls', t => {
  const {scene, exterior, point, camera} = setup(t), {RoomScene} = load('Room');
  const room = Object.create(RoomScene.prototype);
  Object.assign(room, {scene, exterior, currentView: 'first-person', firstPersonCamera: camera,
    jump: {feet: layout.gallery, grounded: true}, ladder: {attached: false}, scooter: {riding: false},
    interactions: new (load('RoomInteractions').RoomInteractions)(scene, () => {})});
  assert.equal(room.canAccessLighthouse('test'), true);
  room.ladder.attached = true; assert.equal(room.canAccessLighthouse('test'), false); room.ladder.attached = false;
  room.scooter.riding = true; assert.equal(room.canAccessLighthouse('test'), false); room.scooter.riding = false;
  room.jump.grounded = false; assert.equal(room.canAccessLighthouse('test'), false); room.jump.grounded = true;
  room.jump.feet = layout.floor; assert.equal(room.canAccessLighthouse('test'), false); room.jump.feet = layout.gallery;
  room.currentView = 'coast'; assert.equal(room.canAccessLighthouse('test'), false); room.currentView = 'first-person';
  camera.position.copyFrom(point(0, -3, layout.gallery + 1.6)); assert.equal(room.canAccessLighthouse('test'), false);
});

test('stationary whole-lamp observation covers a complete rotation from multiple walkable positions', t => {
  const {b,scene,exterior,beacon,point,camera}=setup(t),{RoomScene}=load('Room');
  const room=Object.create(RoomScene.prototype);
  camera.fov=.95;
  Object.assign(room,{scene,exterior,currentView:'first-person',firstPersonCamera:camera,
    pauses:new(load('RoomPauseState').RoomPauseState)(),jump:{feet:layout.gallery,grounded:true},ladder:{attached:false},scooter:{riding:false}});
  const {walkingPointAllowed}=load('WalkingSurface');let positions=0;
  const aim=target=>{camera.setTarget(target);camera.getViewMatrix(true);scene.updateTransformMatrix(true);};
  for(const radius of [1.2,1.6])for(let side=0;side<12;side++) {
    const x=radius*Math.cos((side+.5)*Math.PI/6),y=radius*Math.sin((side+.5)*Math.PI/6);
    if(!walkingPointAllowed({x:tower.x+x,y:tower.y+y},.26,layout.gallery))continue;
    camera.position.copyFrom(point(x,y,layout.gallery+1.6));aim(beacon.root.position);positions++;
    const originalEye=camera.position.clone(),originalRotation=camera.rotation.clone();
    for(let phase=0;phase<32;phase++) {
      beacon.apply({...new LighthouseOperation().snapshot,rotationTurns:phase/32,rotationRadians:phase/32*Math.PI*2,running:true});
      assert.equal(room.canObserveMain(),true,JSON.stringify({radius,side,phase}));
    }
    assert.deepEqual(camera.position.asArray(),originalEye.asArray());assert.deepEqual(camera.rotation.asArray(),originalRotation.asArray());
    camera.rotation.y+=.5;camera.getViewMatrix(true);scene.updateTransformMatrix(true);
    assert.equal(room.canObserveMain(),true,'whole-lamp visibility does not require the crosshair on the emitting face');
    aim(camera.position.scale(2).subtract(beacon.root.position));assert.equal(room.canObserveMain(),false,'looking away stops observation');
  }
  assert.ok(positions>=10,'test ordinary positions around the lamp, including beyond device-operation range');
  camera.position.copyFrom(point(.25,-1.6,layout.gallery+1.6));aim(beacon.root.position);
  const obstacle=b.CreateBox('observation-solid-obstacle',{size:8},scene);
  obstacle.position.copyFrom(camera.position.add(beacon.root.position).scale(.5));obstacle.computeWorldMatrix(true);
  assert.equal(room.canObserveMain(),false,'a fully occluding object prevents evidence');obstacle.dispose();
  assert.equal(room.canObserveMain(),true);
  for(const [object,key,value]of [[room,'currentView','coast'],[room.jump,'grounded',false],[room.jump,'feet',layout.floor],[room.ladder,'attached',true],[room.scooter,'riding',true]]) {
    const before=object[key];object[key]=value;assert.equal(room.canObserveMain(),false,key);object[key]=before;
  }
  room.pauses.set('settings',true);assert.equal(room.canObserveMain(),false);
  room.pauses.set('settings',false);camera.position.copyFrom(point(0,-3.8,layout.gallery+1.6));aim(beacon.root.position);
  assert.equal(room.canObserveMain(),false,'distant visible optics still exceed the three-metre surface range');
});

test('clear lantern glazing permits gallery observation through every turn, while device access and solid occlusion remain blocked', t => {
  const {b,scene,exterior,beacon,details,point,camera}=setup(t),room=Object.create(load('Room').RoomScene.prototype);
  Object.assign(room,{scene,exterior,currentView:'first-person',firstPersonCamera:camera,
    pauses:new(load('RoomPauseState').RoomPauseState)(),jump:{feet:layout.gallery,grounded:true},ladder:{attached:false},scooter:{riding:false}});
  const interactions=new(load('RoomInteractions').RoomInteractions)(scene,()=>{}),surface=load('RoomInteractions').interactionSurface;
  for(const radius of [2.5,2.8])for(let side=0;side<8;side++) {
    const angle=(side+.5)*Math.PI/4;
    camera.position.copyFrom(point(radius*Math.cos(angle),radius*Math.sin(angle),layout.gallery+1.6));
    camera.setTarget(beacon.root.position);camera.getViewMatrix(true);scene.updateTransformMatrix(true);
    const forward=beacon.root.position.subtract(camera.position).normalize();
    const glass=scene.pickWithRay(new b.Ray(camera.position,forward,15),m=>surface(m)&&m!==details.cover.pane);
    if(side!==1)assert.equal(glass.pickedMesh.name,'coastal-lighthouse-glazing');
    for(let phase=0;phase<32;phase++) {
      beacon.apply({...new LighthouseOperation().snapshot,rotationTurns:phase/32,rotationRadians:phase/32*Math.PI*2,running:true});
      assert.equal(room.canObserveMain(),true,JSON.stringify({radius,side,phase}));
    }
    if(side!==1)assert.equal(interactions.canReachDevice({id:'optic',label:'optic',meshes:beacon.meshes},camera.position,15,forward,[details.cover.pane]),false);
  }
  const obstacle=b.CreateBox('solid-in-front-of-glass',{size:8},scene);
  obstacle.position.copyFrom(camera.position.add(beacon.root.position).scale(.5));obstacle.computeWorldMatrix(true);
  assert.equal(room.canObserveMain(),false);obstacle.dispose();assert.equal(room.canObserveMain(),true);
});


test('independent lighthouse pause cannot be cleared by another UI and printed records claim no completed inspection', () => {
  const pauses = new (load('RoomPauseState').RoomPauseState)();
  pauses.set('lighthouse-panel', true); pauses.set('settings', true); pauses.set('settings', false);
  assert.equal(pauses.blocked, true); assert.equal(pauses.transitionBlocked, true);
  assert.deepEqual(pauses.snapshot, ['lighthouse-panel']);
  const {LIGHTHOUSE_LOG} = load('LighthouseRecords');
  assert.doesNotMatch(LIGHTHOUSE_LOG.join(' '), /DAYLIGHT STANDBY|LENS CLEANED|CABLES CHECKED|TOOLS RETURNED/);
  assert.match(LIGHTHOUSE_LOG.join(' '), /STATUS - SEE PANEL/);
});

test('coast disposal releases the optical transform, shader and all generated meshes once', t => {
  const {scene, exterior, camera, beacon} = setup(t); camera.dispose();
  exterior.dispose(); exterior.dispose(); beacon.apply(new LighthouseOperation().snapshot);
  assert.equal(scene.meshes.length, 0); assert.equal(scene.transformNodes.length, 0); assert.equal(scene.materials.length, 0);
  assert.equal(scene.lights.length, 0);
});

function simpleCheck(t, hour=12) {
  const f=setup(t),room=Object.create(load('Room').RoomScene.prototype);
  const session=load('LighthouseStorySave').createLighthouseStorySession('simple-check',0),e=session.equipment;
  const bridge=new(load('LighthouseStoryBridge').LighthouseStoryBridge)(session.story,e);
  e.clock.restore(hour,false);e.operation.selectTime(hour);e.clock.advance(0);
  Object.assign(room,{scene:f.scene,exterior:f.exterior,currentView:'first-person',firstPersonCamera:f.camera,
    pauses:new(load('RoomPauseState').RoomPauseState)(),jump:{feet:layout.gallery,grounded:true},ladder:{attached:false},scooter:{riding:false},
    timeState:e.clock,lighthouseState:e.operation,lighthouseInspectionState:e.inspection,lighthouseMaintenanceState:e.maintenance,
    lighthousePowerState:e.power,weatherState:e.weather,discovery:e.discovery,timeVisualElapsed:0,
    synchronizeDiscovery(){},enforceWeatherWork(){},notifyTimeOfDay(){},applyTimeOfDay(){},rain:{apply(){}},renderStory(){},
    notifyLighthouseOperation(){e.inspection.synchronize(e.operation.snapshot);bridge.synchronize(e);}});
  const run=seconds=>{for(let n=0;n<Math.round(seconds*10);n++)room.updateTimeOfDay(.1);};
  return {...f,room,e,story:session.story,run};
}
test('a whole top-floor area accepts a check in every direction without aiming, including the glass gallery',t=>{
  const {room,camera,point}=simpleCheck(t);
  for(const radius of [1.2,2.5,3.1])for(let n=0;n<16;n++) {
    const angle=n*Math.PI/8;camera.position.copyFrom(point(radius*Math.cos(angle),radius*Math.sin(angle),layout.gallery+1.6));
    camera.setTarget(camera.position.add(new(require('@babylonjs/core/pure').Vector3)(Math.cos(angle),0,Math.sin(angle))));
    assert.equal(room.canObserveMain(false),true,`${radius}/${n}`);
  }
  camera.position.copyFrom(point(0,-3.3,layout.gallery+1.6));assert.equal(room.canObserveMain(false),false);
  camera.position.copyFrom(point(.25,-1.1,layout.gallery+1.6));
  for(const [object,key,value]of [[room,'currentView','coast'],[room.jump,'grounded',false],[room.jump,'feet',layout.floor],
    [room.ladder,'attached',true],[room,'ladderTransition',{}],[room.scooter,'riding',true]]) {
    const before=object[key];object[key]=value;assert.equal(room.canObserveMain(false),false,key);assert.equal(room.beginMainCheck(),false);object[key]=before;
  }
  room.pauses.set('settings',true);assert.equal(room.beginMainCheck(),false);
});
test('one explicit check starts daylight testing, completes at three seconds and advances the story before ending its test',t=>{
  const {room,e,story,run,camera,point}=simpleCheck(t);
  story.readMaterial('CL01');story.acceptDuty();
  run(4);assert.equal(e.inspection.snapshot.optic,undefined,'proximity alone does not manufacture a check');
  assert.equal(room.beginMainCheck(),true);assert.equal(room.mainCheck,'test');assert.equal(e.operation.snapshot.mode,'test');
  run(1);assert.equal(room.beginMainCheck(),false,'repeat press must not restart');
  camera.position.copyFrom(point(2.8,0,layout.gallery+1.6));camera.rotation.y+=Math.PI;
  run(1.9);assert.equal(e.inspection.snapshot.optic,undefined);assert.equal(story.arrivalChecks.main,false);
  run(.1);assert.ok(e.inspection.snapshot.optic);near(e.inspection.snapshot.observedTurns,.1);
  assert.equal(story.arrivalChecks.main,true);assert.equal(room.mainCheck,undefined);
  assert.equal(e.operation.snapshot.mode,'automatic');assert.equal(e.operation.snapshot.running,false);
  const count=e.inspection.snapshot.events.length;run(4);assert.equal(e.inspection.snapshot.events.length,count);
});
test('menus freeze a check; departure cancels owned tests and a retry requires three new active seconds',t=>{
  const {room,e,run,camera,point}=simpleCheck(t);room.beginMainCheck();run(1);
  room.pauses.set('settings',true);room.updateTimeOfDay(40);near(e.inspection.snapshot.observationSeconds,1);
  assert.equal(room.mainCheck,'test');room.pauses.set('settings',false);
  camera.position.copyFrom(point(0,-3.5,layout.gallery+1.6));run(.1);
  assert.equal(room.mainCheck,undefined);assert.equal(e.operation.snapshot.mode,'automatic');near(e.inspection.snapshot.observationSeconds,0);
  camera.position.copyFrom(point(.25,-1.1,layout.gallery+1.6));room.beginMainCheck();run(2.9);assert.equal(e.inspection.snapshot.optic,undefined);
  run(.1);assert.ok(e.inspection.snapshot.optic);
});
test('night navigation and pre-existing tests remain running; unavailable lamps cannot pass',t=>{
  const {room,e,run}=simpleCheck(t,21);assert.equal(room.beginMainCheck(),true);run(3);
  assert.equal(e.operation.snapshot.running,true);assert.equal(e.operation.snapshot.mode,'automatic');
  e.operation.selectTime(12);e.operation.startTest();assert.equal(room.beginMainCheck(),true);run(3);
  assert.equal(e.operation.snapshot.mode,'test');near(e.operation.snapshot.testSecondsRemaining,57);
  e.operation.endTest();e.maintenance.configurePower(false,false,true,e.operation.snapshot);e.maintenance.synchronize(e.operation);e.inspection.renewObservation();
  assert.equal(room.beginMainCheck(),false);run(4);assert.equal(e.inspection.snapshot.optic,undefined);
});

test('actual E-key handler checks without pointer lock, ignores repeats and gives the ladder back after completion',t=>{
  const {room,e,run}=simpleCheck(t),fs=require('node:fs'),ts=require('typescript');
  // Bind the production class-field handler without constructing its WebGL/DOM shell.
  const source=fs.readFileSync(require.resolve('../src/examples/Room.ts'),'utf8');
  const field=source.slice(source.indexOf('  private keyDown ='),source.indexOf('  private pointerDown =')).replace('private keyDown','this.keyDown');
  const code=ts.transpileModule(`function bind() {${field}}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('HTMLElement',`${code};return bind;`)(class {}).call(room);
  let boarded=0,left=0;
  Object.assign(room,{controlsEnabled:true,pointerLocked:false,lighthousePanel:{isOpen:false},storyPanel:{isOpen:false},floorPlan:{isOpen:false},inspection:{isOpen:false},
    ladderTarget(){return undefined;},boardLadder(){boarded++;return true;},leaveLadder(){left++;}});
  const key=extra=>room.keyDown({code:'KeyE',key:'e',target:null,preventDefault(){this.defaultPrevented=true;},...extra});
  key({ctrlKey:true});assert.equal(room.mainCheck,undefined);
  key();assert.equal(room.mainCheck,'test');run(1);key({repeat:true});near(e.inspection.snapshot.observationSeconds,1);
  assert.equal(boarded,0);run(2);assert.ok(e.inspection.snapshot.optic);
  key();assert.equal(room.mainCheck,'test','explicit repeat check remains available for new weather evidence');run(3);
  room.pointerLocked=true;room.ladderTarget=()=>true;key();assert.equal(boarded,1);assert.equal(room.mainCheck,undefined);
  room.ladder.attached=true;key();assert.equal(left,1);
});

test('lamp-panel check button closes its modal, starts a fresh check and keeps its local authority gate',t=>{
  const {room,e,run}=simpleCheck(t);let closed=0,notice=0;
  room.lighthousePanel={activeLocation:'test',isOpen:true,notice(){notice++;}};
  room.interactions=new(load('RoomInteractions').RoomInteractions)(room.scene,()=>{});
  room.pauses.set('lighthouse-panel',true);
  room.closeLighthousePanel=()=>{closed++;room.lighthousePanel.isOpen=false;room.pauses.set('lighthouse-panel',false);};
  room.checkLocalMain();assert.equal(closed,1);assert.equal(room.mainCheck,'test');run(3);assert.ok(e.inspection.snapshot.optic);
  room.lighthousePanel.isOpen=true;room.pauses.set('lighthouse-panel',true);room.checkLocalMain();run(3);
  assert.equal(e.inspection.snapshot.events.filter(event=>event.type==='optic-observed').length,2);
  room.currentView='coast';room.checkLocalMain();assert.equal(notice,1);assert.equal(closed,2);
});

test('lamp-panel refusal keeps its modal and explains low power instead of silently returning to the scene',t=>{
  const {room,e,run}=simpleCheck(t);let closed=0,notice='';
  room.lighthousePanel={activeLocation:'test',isOpen:true,notice(text){notice=text;}};
  room.interactions=new(load('RoomInteractions').RoomInteractions)(room.scene,()=>{});
  room.pauses.set('lighthouse-panel',true);
  room.closeLighthousePanel=()=>{closed++;room.lighthousePanel.isOpen=false;room.pauses.set('lighthouse-panel',false);};
  room.lighthousePowerState=new(load('LighthousePower').LighthousePower)({mainWh:200});
  room.synchronizeLighthousePower();assert.equal(room.lighthouseOperation.available,false);
  const events=e.inspection.snapshot.events.length;
  room.checkLocalMain();
  assert.equal(closed,0,'failed start must leave its explanation visible');
  assert.equal(room.lighthousePanel.isOpen,true);assert.equal(room.pauses.has('lighthouse-panel'),true);
  assert.match(notice,/低电保护.*首层.*电池柜/);
  assert.equal(room.mainCheck,undefined);assert.equal(e.operation.snapshot.mode,'automatic');
  run(4);assert.equal(e.inspection.snapshot.optic,undefined);assert.equal(e.inspection.snapshot.events.length,events);
  // Restore a valid supplied model through the existing power synchronization, then retry the same panel.
  room.lighthousePowerState=new(load('LighthousePower').LighthousePower)();room.synchronizeLighthousePower();
  room.checkLocalMain();assert.equal(closed,1);run(3);assert.ok(e.inspection.snapshot.optic);
});

test('lamp-panel resumes an active check without restarting its test or elapsed observation',t=>{
  const {room,e,run}=simpleCheck(t);room.beginMainCheck();run(1);let closed=0;
  room.lighthousePanel={activeLocation:'test',isOpen:true,notice(){assert.fail('active check should resume');}};
  room.interactions=new(load('RoomInteractions').RoomInteractions)(room.scene,()=>{});
  room.pauses.set('lighthouse-panel',true);
  room.closeLighthousePanel=()=>{closed++;room.lighthousePanel.isOpen=false;room.pauses.set('lighthouse-panel',false);};
  const starts=e.operation.snapshot.events.filter(event=>event.type==='test-started').length;
  room.checkLocalMain();assert.equal(closed,1);near(e.inspection.snapshot.observationSeconds,1);
  assert.equal(e.operation.snapshot.events.filter(event=>event.type==='test-started').length,starts);
  run(2);assert.ok(e.inspection.snapshot.optic);
});

test('lamp-panel refuses a failed drive without closing or manufacturing an observation',t=>{
  const {room,e,run}=simpleCheck(t);let closed=0,notice='';
  room.lighthousePanel={activeLocation:'test',isOpen:true,notice(text){notice=text;}};
  room.interactions=new(load('RoomInteractions').RoomInteractions)(room.scene,()=>{});
  room.pauses.set('lighthouse-panel',true);room.closeLighthousePanel=()=>{closed++;};
  room.lighthouseMaintenanceState=new(load('LighthouseMaintenance').LighthouseMaintenance)('drive');room.synchronizeLighthousePower();
  assert.equal(room.lighthouseOperation.available,false);
  room.checkLocalMain();assert.equal(closed,0);assert.match(notice,/驱动异常/);
  run(4);assert.equal(room.mainCheck,undefined);assert.equal(e.inspection.snapshot.optic,undefined);
});
