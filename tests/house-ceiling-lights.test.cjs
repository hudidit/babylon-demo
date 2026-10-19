const assert = require('node:assert/strict'), {test} = require('node:test');
const b = require('@babylonjs/core/pure');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {RoomLighting} = load('RoomLighting'), {RoomFurnishings} = load('RoomFurnishings');
const {createHouseArchitecture} = load('HouseArchitecture');
const {HOUSE_CEILING_LIGHTS: fixtures, furnishHouseCeilingLights, ceilingLampPosition} = load('HouseCeilingLights');
const {setRoomOwners} = load('RoomOwnership'), {evaluateTimeOfDay: at} = load('RoomTimeOfDay');
const {RoomInteractions} = load('RoomInteractions');

function setup(t) {
  const engine = new b.NullEngine();
  // Drawing is covered by the browser; the geometry suite needs only a canvas interface.
  const context = new Proxy({}, {get: (_, key) => /create.*Gradient/.test(key)
    ? () => ({addColorStop() {}}) : () => {}});
  engine.createCanvas = () => ({width: 1, height: 1, getContext: () => context, remove() {}});
  const scene = new b.Scene(engine); scene.useDelayedTextureLoading = true;
  t.after(() => {scene.dispose(); engine.dispose();});
  const furniture = new RoomFurnishings(scene), architecture = createHouseArchitecture(scene, furniture);
  furnishHouseCeilingLights(furniture); furniture.finish();
  const lights = new RoomLighting(scene, true);
  lights.addLivingRoom(scene, true); lights.addMasterSuite(scene); lights.addBedroom(scene);
  lights.addServiceRooms(scene); lights.addBalcony(scene); lights.addCeilingLights();
  furniture.lamps.forEach(lamp => lights.bindLamp(lamp.id, scene.getMaterialByName(lamp.id + '-glow')));
  lights.addMeshes(scene.meshes); lights.freezeShadows();
  return {scene, furniture, architecture, lights};
}

test('four flush fixtures fit below the roof, emit outside their own geometry and follow ceiling visibility', t => {
  const {scene, furniture, architecture} = setup(t);
  assert.equal(furniture.lamps.length, 4);
  assert.equal(new Set(furniture.lamps.map(l => scene.getMaterialByName(l.id + '-glow'))).size, 4);
  for (const fixture of fixtures) {
    const light = scene.getLightByName(fixture.id + '-light'), lamp = furniture.lamps.find(l => l.id === fixture.id);
    for (const mesh of lamp.meshes) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      assert.ok(box.minimumWorld.y > 8.4 && box.maximumWorld.y <= 9.00001, mesh.name);
      assert.deepEqual(mesh.metadata.ownerRooms, [fixture.room]);
    }
    assert.ok(!scene.pickWithRay(new b.Ray(light.position, light.direction, 10), m => lamp.meshes.includes(m))?.hit);
    assert.equal(light.getShadowGenerator().getShadowMap().getSize().width, 1024);
    assert.equal(light.getShadowGenerator().getShadowMap().refreshRate, b.RenderTargetTexture.REFRESHRATE_RENDER_ONCE);
  }
  for (const [enclosed, view, visible] of [[false,'overview',false],[true,'first-person',true],[false,'study',false],[false,'coast',true]]) {
    architecture.setEnclosed(enclosed, view);
    assert.ok(furniture.lamps.every(lamp => lamp.meshes.every(mesh => mesh.isVisible === visible)));
  }
});

test('new sources keep room masks and enough real shader slots on shared walls and late furniture', t => {
  const {scene, lights} = setup(t);
  for (const fixture of fixtures) {
    const light = scene.getLightByName(fixture.id + '-light');
    for (const mesh of scene.meshes.filter(m => m.getTotalVertices() && !m.metadata?.ownerRooms.includes(fixture.room)))
      assert.ok(!light.canAffectMesh(mesh), mesh.name + ' must be isolated');
  }
  const late = b.CreateBox('late-living-sofa', {}, scene);
  setRoomOwners(late, ['living']); late.material = new b.PBRMaterial('late-sofa', scene);
  lights.toggleLamp('living-ceiling-lamp'); // Off sources must still reserve a slot for the next switch-on.
  lights.addMeshes([late]); lights.toggleLamp('living-ceiling-lamp');
  assert.equal(late.material.maxSimultaneousLights, 5);
  assert.equal(late.lightSources.length, 5);
  assert.ok(late.lightSources.some(l => l.name === 'living-ceiling-lamp-light'));
  const shared = scene.meshes.find(m => m.metadata.ownerRooms?.includes('living') && m.metadata.ownerRooms?.includes('study'));
  assert.ok(shared);
  assert.ok(shared.material.maxSimultaneousLights >= shared.lightSources.length);
  assert.ok(shared.lightSources.some(l => l.name === 'living-ceiling-lamp-light'));
  assert.ok(shared.lightSources.some(l => l.name === 'study-ceiling-lamp-light'));
});

test('reachable first-person switches preserve independent lamp state across time, invalidate local shadows and release cleanly', t => {
  const {scene, furniture, lights} = setup(t), interactions = new RoomInteractions(scene, () => {});
  for (const lamp of furniture.lamps) interactions.addLamp(lamp, () => lights.isLampOn(lamp.id), () => lights.toggleLamp(lamp.id));
  for (const fixture of fixtures) {
    const lamp = furniture.lamps.find(l => l.id === fixture.id), material = scene.getMaterialByName(fixture.id + '-glow');
    const before = scene.lights.map(l => l.intensity), light = scene.getLightByName(fixture.id + '-light');
    const eye = b.Vector3.FromArray(ceilingLampPosition(fixture.room, 1.6));
    const face = scene.pickWithRay(new b.Ray(eye, b.Vector3.Up(), 7.5), mesh => lamp.meshes.includes(mesh));
    assert.equal(face.pickedMesh.material, material, 'the lit diffuser must be visible through the open trim');
    const action = interactions.pick(new b.Ray(eye, b.Vector3.Up(), 7.5));
    assert.ok(action?.label().includes(fixture.label));
    const touched = [];
    scene.lights.filter(l => l.getShadowGenerator?.()).forEach(l =>
      l.getShadowGenerator().getShadowMap().resetRefreshCounter = () => touched.push(l.metadata.ownerRooms[0]));
    action.toggle(); assert.deepEqual([...new Set(touched)], [fixture.room]);
    assert.ok(scene.lights.every((l,i) => l.intensity === (l === light ? 0 : before[i])));
    for (const hour of [0,3,6,12,18,21]) {lights.applyTimeOfDay(at(hour)); assert.equal(light.intensity, 0);}
    assert.ok(material.emissiveColor.equals(b.Color3.Black()));
    action.toggle(); assert.equal(light.intensity, fixture.intensity);
    assert.ok(!material.emissiveColor.equals(b.Color3.Black()));
    const target = light.getShadowGenerator().getShadowMap();
    lights.removeRoom(fixture.room); interactions.removeRoom(fixture.room);
    assert.equal(scene.getLightByName(fixture.id + '-light'), null);
    assert.ok(!scene.textures.includes(target));
  }
});
