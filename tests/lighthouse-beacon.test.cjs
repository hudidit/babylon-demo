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
  const panelEye = point(-1.8, -.95, layout.floor + 1.6), topEye = point(.25, -1.1, layout.gallery + 1.6);
  const {walkingPointAllowed} = load('WalkingSurface');
  assert.ok(walkingPointAllowed({x: tower.x - 1.8, y: tower.y - .95}, .26, layout.floor));
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
