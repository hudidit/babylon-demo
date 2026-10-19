const assert = require('node:assert/strict'), {test} = require('node:test');
const b = require('@babylonjs/core/pure');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {evaluateTimeOfDay: at, blendTimeOfDay: blend} = load('RoomTimeOfDay');
const {RoomExterior} = load('RoomExterior'), {RoomLighting} = load('RoomLighting');
const {skyTimeUniforms} = load('CoastalSky');
const {RoomMirrors} = load('RoomMirrors');
const near = (a, z, epsilon = 1e-8) => assert.ok(Math.abs(a - z) < epsilon, `${a} != ${z}`);
function setup(t) {
  const engine = new b.NullEngine(), scene = new b.Scene(engine); scene.useDelayedTextureLoading = true;
  scene.iblIntensity = .35; scene.ambientColor.set(.08, .075, .065);
  t.after(() => {scene.dispose(); engine.dispose();});
  return {scene, engine};
}

test('sky, sea, scoped light and a single cached shadow follow all eight nodes and twilight together', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene);
  const shadow = exterior.shadow.getShadowMap(), sky = exterior.sky;
  const resources = [scene.meshes.length, scene.materials.length, scene.textures.length, scene.lights.length];
  for (const hour of [0, 3, 6, 9, 12, 15, 18, 21, 18.4, 5.55, 12]) {
    const state = at(hour); exterior.applyTimeOfDay(state);
    near(exterior.sun.intensity, state.primary?.intensity || 0);
    if (state.primary) exterior.sun.direction.asArray().forEach((n, i) => near(n, state.primary.lightDirection[i]));
    assert.equal(exterior.sun.isEnabled(), !!state.primary);
    assert.equal(exterior.shadow.getShadowMap(), shadow);
    assert.equal(shadow.refreshRate, b.RenderTargetTexture.REFRESHRATE_RENDER_ONCE);
    assert.deepEqual(exterior.ocean.material._vectors3.sunDirection, sky._vectors3.sunDirection);
    near(exterior.ocean.material._floats.sunStrength, state.primary?.strength || 0);
    near(exterior.ocean.material._floats.skyIllumination, state.environment.exterior);
    near(sky._floats.skyStarVisibility, state.sky.starVisibility);
    assert.deepEqual(sky._vectors3.skyCloudLight.asArray(), [...state.sky.cloudLight]);
    assert.deepEqual(sky._vectors3.skyCloudShade.asArray(), [...state.sky.cloudShade]);
    assert.deepEqual(sky._vectors3.skyMoonDirection.asArray(), [...state.moon.sourceDirection]);
    if (state.primary?.kind === 'sun') assert.equal(sky._floats.skyMoonVisibility, 0);
    assert.deepEqual([scene.meshes.length, scene.materials.length, scene.textures.length, scene.lights.length], resources);
  }
  assert.equal(scene.iblIntensity, .35);
  for (const boundary of [5.5, 5.625, 18.375, 18.5]) {
    exterior.applyTimeOfDay(at(boundary - .000001));
    const before = sky._floats.sunWarmth, beforeDirection = sky._vectors3.skySunDirection.clone();
    exterior.applyTimeOfDay(at(boundary + .000001));
    near(sky._floats.sunWarmth, before, .00001);
    assert.ok(b.Vector3.Distance(beforeDirection, sky._vectors3.skySunDirection) < .00001,
      'twilight horizon keeps the solar direction while the direct light hands off to the moon');
  }
  exterior.applyTimeOfDay(at(18.4)); exterior.setVisible(false); exterior.setVisible(true);
  assert.equal(exterior.sun.isEnabled(), false, 'visibility must not restore daylight during twilight');
});

test('shadow anchor relocation retains the current moon/sun instead of reverting to the old afternoon direction', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene), camera = new b.UniversalCamera('test-eye', b.Vector3.Zero(), scene);
  scene.activeCamera = camera;
  for (const hour of [6, 0, 18]) {
    exterior.applyTimeOfDay(at(hour)); const direction = exterior.sun.direction.clone();
    for (const anchor of [exterior.shadowAnchors.at(-1), exterior.shadowAnchors[0]]) {
      camera.position.copyFrom(anchor); camera.getViewMatrix(true); exterior.updateVisuals();
      assert.ok(exterior.sun.direction.equals(direction));
      const toward = exterior.sun.position.subtract(exterior.shadowAnchors[exterior.shadowAnchor]).normalize();
      toward.asArray().forEach((n, i) => near(n, at(hour).primary.sourceDirection[i]));
    }
  }
});

test('north/east/south openings only accept incident celestial light and artificial lamp switches survive time changes', t => {
  const {scene} = setup(t), lights = new RoomLighting(scene, true);
  lights.addLivingRoom(scene, true); lights.addMasterSuite(scene); lights.addBedroom(scene); lights.addServiceRooms(scene); lights.addBalcony(scene);
  const day = name => scene.getLightByName(name + '-daylight');
  const lamp = scene.getLightByName('banker-lamp-light'), original = lamp.intensity;
  lights.toggleLamp('desk-lamp');
  lights.applyTimeOfDay(at(6));
  assert.ok(day('living-window').intensity > .9); near(day('window').intensity, 0); near(day('bedroom-window').intensity, 0, 1e-6);
  lights.applyTimeOfDay(at(12));
  assert.ok(day('bedroom-window').intensity > 1); near(day('master-window').intensity, 0);
  near(day('kitchen-window').intensity, 0); near(day('living-window').intensity, 0, 1e-6);
  lights.applyTimeOfDay(at(0));
  assert.ok(day('bedroom-window').intensity > 0 && day('bedroom-window').intensity < .1);
  near(scene.getLightByName('room-bounce-light').intensity, .038);
  assert.equal(lamp.intensity, 0); assert.equal(lights.isLampOn('desk-lamp'), false);
  lights.toggleLamp('desk-lamp'); lights.applyTimeOfDay(at(3)); assert.equal(lamp.intensity, original);
  lights.applyTimeOfDay(at(18.4)); for (const l of scene.lights.filter(l => l.name.endsWith('daylight'))) assert.equal(l.intensity, 0);
});

test('indoor materials keep distinct baselines, mirror RTTs/emission are protected and late imports inherit night', t => {
  const {scene} = setup(t), lights = new RoomLighting(scene, true);
  const mesh = b.CreateBox('late-indoor-model', {}, scene), material = new b.PBRMaterial('late-wood', scene);
  mesh.material = material; material.environmentIntensity = .85; material.emissiveColor.set(.2, .1, 0);
  mesh.metadata = {ownerRooms: ['study']};
  lights.applyTimeOfDay(at(0)); lights.addMeshes([mesh]); near(material.environmentIntensity, .085);
  lights.addMeshes([mesh]); near(material.environmentIntensity, .085, 1e-8);
  lights.applyTimeOfDay(at(12)); near(material.environmentIntensity, .85);
  assert.deepEqual(material.emissiveColor.asArray(), [.2, .1, 0]);
  const mirror = b.CreateBox('mirror', {}, scene), mirrorMaterial = new b.PBRMaterial('planar-mirror', scene);
  mirror.material = mirrorMaterial; mirror.metadata = {mirrorPlane: [0, 0, 1, 0], ownerRooms: ['study']};
  lights.addMeshes([mirror]); lights.applyTimeOfDay(at(0)); assert.equal(mirrorMaterial.environmentIntensity, 1);
  material.dispose(); assert.ok(!lights.environments.has(material)); assert.equal(scene.iblIntensity, .35);
});

test('outdoor baselines, late-created materials and failed IBL never drift or fall back to indoor daylight', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene), surfaces = exterior.surfaces;
  exterior.applyTimeOfDay(at(0)); const late = surfaces.solid('late-test-material', '#ffffff', .9);
  near(late.environmentIntensity, .9 * .18);
  exterior.applyTimeOfDay(at(12)); near(late.environmentIntensity, .9);
  exterior.applyTimeOfDay(at(0)); near(late.environmentIntensity, .162);
  surfaces.fallbackFor(surfaces.environment); exterior.applyTimeOfDay(at(12));
  assert.ok(surfaces.materials.every(m => m.environmentIntensity === 0 && m.reflectionTexture === null));
  const last = surfaces.solid('after-failure', '#ffffff'); assert.equal(last.environmentIntensity, 0); assert.equal(last.reflectionTexture, null);
  exterior.dispose(); exterior.dispose(); exterior.applyTimeOfDay(at(6));
  assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0); assert.equal(scene.lights.length, 0);
});

test('sky and sea bind the reflected eye in mirror passes and restore the real eye for the main camera', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene);
  const camera = new b.UniversalCamera('time-eye', new b.Vector3(10, 15, 20), scene);
  scene.activeCamera = camera; camera.getViewMatrix(true);
  for (const material of [exterior.sky, exterior.ocean.material]) {
    let eye;
    const getEffect = material.getEffect;
    material.getEffect = () => ({setVector3: (name, value) => {if (name === 'cameraPosition') eye = value.clone();}});
    scene._mirroredCameraPosition = new b.Vector3(10, 15, -20);
    material.onBindObservable.notifyObservers(exterior.ocean.mesh);
    assert.ok(eye.equals(scene._mirroredCameraPosition));
    scene._mirroredCameraPosition = null;
    material.onBindObservable.notifyObservers(exterior.ocean.mesh);
    assert.ok(eye.equals(camera.globalPosition));
    material.getEffect = getEffect;
  }
});

test('manual fades update natural shadow maps together, leave artificial caches intact and share the sky handoff', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene), lights = new RoomLighting(scene, true);
  lights.addLivingRoom(scene, true);
  const artificial = lights.shadows.filter(shadow => !lights.natural.has(shadow.getLight()));
  let artificialRefreshes = 0;
  artificial.forEach(shadow => { shadow.getShadowMap().resetRefreshCounter = () => artificialRefreshes++; });
  let naturalRefreshes = 0, exteriorRefreshes = 0;
  for (const light of lights.natural.keys()) light.getShadowGenerator().getShadowMap().resetRefreshCounter = () => naturalRefreshes++;
  exterior.shadow.getShadowMap().resetRefreshCounter = () => exteriorRefreshes++;
  for (const reduced of [false, true]) for (const t of [.1, .49, .5, .51, .9, 1]) {
    const state = blend(at(18), at(0), t, reduced);
    lights.applyTimeOfDay(state); exterior.applyTimeOfDay(state);
    near(exterior.sun.intensity, state.primary?.intensity || 0);
    near(exterior.sky._floats.sunStrength, exterior.ocean.material._floats.sunStrength);
    near(exterior.sky._floats.sunWarmth, exterior.ocean.material._floats.sunWarmth);
    assert.deepEqual(exterior.sky._vectors3.skySunDirection, exterior.ocean.material._vectors3.skySunDirection);
    for (const key of skyTimeUniforms) {
      assert.deepEqual(exterior.sky._floats[key], exterior.ocean.material._floats[key], key);
      assert.deepEqual(exterior.sky._vectors3[key], exterior.ocean.material._vectors3[key], key);
    }
    if (t === .5) assert.equal(exterior.sky._floats.skyMoonVisibility, 0, 'moon suppression fades away at a source handoff');
    if (t === .5) { assert.equal(exterior.sun.isEnabled(), false); assert.equal(exterior.ocean.material._floats.sunStrength, 0); }
  }
  assert.equal(artificialRefreshes, 0); assert.equal(naturalRefreshes, lights.natural.size * 12); assert.equal(exteriorRefreshes, 12);
});

test('both real mirror targets retain the shared sky and sea while excluding unrelated rooms and previews', t => {
  const {scene} = setup(t), exterior = new RoomExterior(scene);
  const unrelated = b.CreateBox('unrelated-study', {}, scene); unrelated.metadata = {ownerRooms:['study']};
  const preview = b.CreateBox('exterior-preview', {}, scene); preview.metadata = {ownerRooms:['ensuite','bathroom'],inspectionPreview:true};
  for (const owner of ['ensuite','bathroom']) {
    const mirror = b.CreateBox(owner+'-mirror-fixture', {}, scene);
    mirror.metadata = {ownerRooms:[owner],reflectionRoom:owner,mirrorPlane:[0,0,1,-4]};
  }
  new RoomMirrors(scene);
  const mirrors=scene.meshes.filter(m=>m.metadata?.mirrorPlane), targets=mirrors.map(m=>m.material.reflectionTexture);
  assert.equal(targets.length,2); assert.notEqual(targets[0],targets[1]);
  for (const target of targets) {
    assert.ok(target.renderList.includes(scene.getMeshByName('coastal-sky')));
    assert.ok(target.renderList.includes(exterior.ocean.mesh));
    assert.ok(!target.renderList.includes(unrelated) && !target.renderList.includes(preview));
    assert.ok(mirrors.every(m=>!target.renderList.includes(m)));
    assert.equal(target.getSize().width,512); assert.equal(target.noPrePassRenderer,true);
    assert.equal(target.refreshRate,0);
  }
  const resources=[scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length];
  for (const hour of [0,3,6,9,12,15,18,21,0]) exterior.applyTimeOfDay(at(hour));
  assert.deepEqual([scene.meshes.length,scene.materials.length,scene.textures.length,scene.lights.length],resources);
});
