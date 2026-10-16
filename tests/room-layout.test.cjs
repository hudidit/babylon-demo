const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const babylon = require("@babylonjs/core");
require("@babylonjs/loaders/glTF");

const sourceCache = new Map();
function loadSource(name) {
  if (sourceCache.has(name)) return sourceCache.get(name);
  const source = fs.readFileSync(path.join(__dirname, "../src/examples", name + ".ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    id => id.startsWith("./") ? loadSource(id.slice(2)) : require(id), module, module.exports);
  sourceCache.set(name, module.exports);
  return module.exports;
}

const { measureBookshelf } = loadSource("BookshelfLayout");
const { RoomFurnishings } = loadSource("RoomFurnishings");
const { RoomScene } = loadSource("Room");
const { RoomItemInspection } = loadSource("RoomItemInspection");
const { RoomInteractions, cabinetDrawers } = loadSource("RoomInteractions");
const { RoomLighting } = loadSource("RoomLighting");
const { placeFurniture } = loadSource("RoomFurnitureAssets");
const { mappedMaterial, paintedWallMaterial, tileMaterial } = loadSource("RoomMaterials");
const { beveledBox, creasedLetter, curtainPanel, ficusLeaf } = loadSource("RoomDetailGeometry");
const { buildWearMask } = loadSource("RoomSurfaceDetails");
const { partitionMergedCollisions } = loadSource("RoomCollisions");
const { createLivingRoom, constrainWalkingPosition } = loadSource("RoomLivingRoom");

function adjacentRooms(t) {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  const shell = new babylon.TransformNode("shell", scene);
  RoomScene.prototype.createArchitecture.call({ scene, interiorShell: shell }, room);
  room.furnish();
  createLivingRoom(scene, room, shell);
  room.finish().forEach(mesh => mesh.checkCollisions = true);
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  return { scene, room, shell };
}

test("adjacent rooms have a real bidirectional passage and closed walls outside it", t => {
  const { scene, shell, room } = adjacentRooms(t);
  scene.collisionsEnabled = true;
  const interactions = new RoomInteractions(scene, () => {});
  interactions.addDoor(room.doors[0]);
  interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5)).toggle();
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  for (const [x, dx, expected] of [[17, 7, 24], [24, -7, 17]]) {
    const result = sweep(scene, new babylon.Vector3(x, -1.8, -5), new babylon.Vector3(dx, 0, 0));
    assert.ok(Math.abs(result.position.x - expected) < 0.02, "walls, trims and casing must leave a walkable passage");
  }
  for (const z of [-12, -8, -2, 0]) {
    const result = sweep(scene, new babylon.Vector3(17, -1.8, z), new babylon.Vector3(7, 0, 0));
    assert.ok(result.position.x < 19.2, "shared wall outside the passage must block walking");
  }
  const outside = sweep(scene, new babylon.Vector3(50, -1.8, 15), new babylon.Vector3(0, 0, 10));
  assert.ok(outside.position.z < 19.2, "living room perimeter must block walking");
  const furniture = sweep(scene, new babylon.Vector3(37, -1.8, 15), new babylon.Vector3(0, 0, -8));
  assert.ok(furniture.position.z > 9, "sofa remains a physical obstacle");
  shell.setEnabled(false);
  assert.equal(scene.getMeshByName("shared-wall-0").isEnabled(), false);
  assert.equal(scene.getMeshByName("living-back-wall").isEnabled(), true);
  assert.equal(scene.getMeshByName("living-oak-floor").position.y, -5);
  for (const value of [new babylon.Vector3(37, 8, 0), new babylon.Vector3(100, -10, 30)]) {
    constrainWalkingPosition(value);
    assert.equal(value.y, 1); assert.ok(value.x > 20 && value.x <= 52.8 && value.z <= 18.8);
  }
});

test("living room lamps and shadows stay in their room without taking study light slots", t => {
  const { scene, room } = adjacentRooms(t);
  const lighting = new RoomLighting(scene); lighting.addLivingRoom(scene);
  const lamp = room.lamps.find(lamp => lamp.id === "living-lamp");
  assert.ok(lamp.meshes.every(mesh => mesh.metadata.room === "living"));
  const shade = scene.getMaterialByName("living-lamp-shade"), initial = shade.emissiveColor.clone();
  lighting.bindLamp("living-lamp", shade); lighting.addMeshes(scene.meshes);
  for (const light of scene.lights.filter(light => light instanceof babylon.SpotLight)) {
    const living = light.name.startsWith("living-");
    for (const mesh of scene.meshes.filter(mesh => mesh.getTotalVertices() > 0)) {
      const excluded = mesh.metadata?.room === "shared" ? /banker|reading-lamp/.test(light.name)
        : (mesh.metadata?.room === "living") !== living;
      assert.equal(light.excludedMeshes.includes(mesh), excluded);
    }
    assert.ok(light.getShadowGenerator().getShadowMap().renderList.every(mesh =>
      mesh.metadata?.room === "shared" || (mesh.metadata?.room === "living") === living));
  }
  const studyIntensity = scene.getLightByName("banker-lamp-light").intensity;
  lighting.toggleLamp("living-lamp");
  assert.equal(scene.getLightByName("living-table-lamp-light").intensity, 0);
  assert.ok(shade.emissiveColor.equals(babylon.Color3.Black()));
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, studyIntensity);
  lighting.toggleLamp("living-lamp"); assert.ok(shade.emissiveColor.equals(initial));
  lighting.freezeShadows();
  assert.ok(scene.lights.filter(light => light instanceof babylon.SpotLight).every(light =>
    light.getShadowGenerator().getShadowMap().refreshRate === babylon.RenderTargetTexture.REFRESHRATE_RENDER_ONCE));
});

test("single door picks from both rooms, reverse smoothly and move their physical collision", t => {
  const { scene, room } = adjacentRooms(t), door = room.doors[0];
  scene.collisionsEnabled = true;
  let refreshed = 0;
  const interactions = new RoomInteractions(scene, () => refreshed++);
  interactions.addDoor(door);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  const reverseAction = interactions.pick(new babylon.Ray(new babylon.Vector3(24, 1, -5), new babylon.Vector3(-1, 0, 0), 7.5));
  assert.ok(action && action === reverseAction);
  assert.match(action.label(), /^打开/);
  for (const [x, dx] of [[16, 8], [24, -8]]) {
    const blocked = sweep(scene, new babylon.Vector3(x, -1.8, -5), new babylon.Vector3(dx, 0, 0)).position;
    assert.ok(x < 20 ? blocked.x < 19.2 : blocked.x > 20.8, "closed door must block both directions");
  }
  action.toggle(); interactions.update(0.05);
  const partial = door.root.rotation.y;
  action.toggle(); assert.deepEqual(door.root.rotation.y, partial);
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y) < 1e-6);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.equal(room.doors.length, 1);
  assert.ok(Math.abs(door.root.rotation.y - door.openAngle) < 1e-6);
  assert.ok(door.meshes.every(mesh => mesh.checkCollisions && !mesh.isWorldMatrixFrozen));
  const contact = sweep(scene, new babylon.Vector3(22, -1.8, -5), new babylon.Vector3(0, 0, -5)).position;
  assert.ok(Math.abs(contact.z + 5) < 3.3, "open door must still collide at its new position");
  const passed = sweep(scene, new babylon.Vector3(16, -1.8, -5), new babylon.Vector3(8, 0, 0)).position;
  assert.ok(Math.abs(passed.x - 24) < 0.01);
  assert.ok(refreshed > 0);
  refreshed = 0; interactions.update(0.05); assert.equal(refreshed, 0);
});

test("door sweep pauses for a walker, resumes after clearance and supports reversing while blocked", t => {
  const { scene, room } = adjacentRooms(t), door = room.doors[0];
  let walker = new babylon.Vector3(19, 1, -5);
  const interactions = new RoomInteractions(scene, () => {}, () => walker);
  interactions.addDoor(door);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y - Math.PI / 2) < 1e-6, "standing at the study face must permit opening away from the walker");
  walker = new babylon.Vector3(20, 1, -5);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.match(action.label(), /让开门口/);
  assert.ok(door.root.rotation.y > 0.2);
  const paused = door.root.rotation.y;
  interactions.update(0.05); assert.equal(door.root.rotation.y, paused);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y - Math.PI / 2) < 1e-6);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  walker = new babylon.Vector3(16, 1, -5);
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y) < 1e-6);
  assert.match(action.label(), /^打开/);
});

test("audio events follow actual movement, blocking and completion rather than click timers", t => {
  const { scene, room } = adjacentRooms(t), events = [];
  let walker = new babylon.Vector3(19, 1, -5);
  const interactions = new RoomInteractions(scene, () => {}, () => walker, event => events.push(event));
  interactions.addDoor(room.doors[0]);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  action.toggle(); assert.deepEqual(events.map(event => event.cue), ['stop']);
  interactions.update(0); assert.equal(events.length, 1, 'no sound before movement');
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'door-move').length, 1);
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 0, 'opening never emits closing latch');
  walker = new babylon.Vector3(20, 1, -5); action.toggle();
  for (let i = 0; i < 20; i++) interactions.update(.05);
  const count = events.length;
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.length, count, 'blocked frames do not repeatedly sound');
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 0);
  walker = new babylon.Vector3(16, 1, -5);
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 1);
  const drawer = room.drawers[0]; interactions.addDrawer(drawer);
  const state = interactions.drawers[0]; state.open = true;
  interactions.update(.05); interactions.silenceMotion(); interactions.update(.05);
  state.open = false;
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'drawer-stop').length, 1);
  assert.ok(events.some(event => event.entity === drawer.id && event.position().x === event.position().x));
});

test("section batching preserves singleton artwork/window world transforms and cutaway parenting", t => {
  const { scene } = adjacentRooms(t);
  const artwork = scene.getMeshByName("living-study-living-landscape-artwork");
  const window = scene.getMeshByName("living-study-window-glass-surface");
  assert.ok(artwork.getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(new babylon.Vector3(37, 4, -18.66), 0.001));
  assert.ok(window.getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(new babylon.Vector3(48, 2.5, -19.14), 0.001));
  const furnishings = new RoomFurnishings(scene), shell = new babylon.TransformNode("test-shell", scene);
  const meshes = furnishings.section("singleton", () => {
    const parent = furnishings.group("model-parent", [30, 2, -4], Math.PI / 2);
    furnishings.box("only-part", [2, 1, 1], [0, 1, 2], "wood", parent);
  }, shell);
  const centre = meshes[0].getBoundingInfo().boundingBox.centerWorld;
  assert.ok(centre.equalsWithEpsilon(new babylon.Vector3(32, 3, -4), 0.001));
  shell.setEnabled(false); assert.ok(!meshes[0].isEnabled());
  shell.setEnabled(true); meshes[0].computeWorldMatrix(true);
  assert.ok(meshes[0].getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(centre));
});

function sweep(scene, position, displacement, radius = new babylon.Vector3(0.65, 2.8, 0.65)) {
  const collider = scene.collisionCoordinator.createCollider();
  collider._radius = radius;
  let testedIndices = 0;
  const collide = collider._collide;
  collider._collide = function (...args) {
    testedIndices += args[4] - args[3];
    return collide.apply(this, args);
  };
  let result;
  scene.collisionCoordinator.getNewPosition(position, displacement, collider, 3, null,
    (_, finalPosition) => result = finalPosition.clone(), 0);
  return { position: result, testedIndices };
}

test("collision partitions preserve swept collisions and cull distant geometry without extra draw calls", t => {
  const scene = createScene(t);
  const parts = Array.from({ length: 20 }, (_, i) => {
    const mesh = babylon.MeshBuilder.CreateSphere("obstacle", { diameter: 3, segments: 24 }, scene);
    mesh.position.set(i * 8, 0, 4);
    return mesh;
  });
  const ranges = parts.map(part => ({ vertices: part.getTotalVertices(), indices: part.getTotalIndices() }));
  const mesh = babylon.Mesh.MergeMeshes(parts, true, true);
  mesh.material = new babylon.StandardMaterial("obstacles", scene);
  mesh.checkCollisions = true;
  mesh.freezeWorldMatrix();
  const vertices = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  const fallback = scene.getCollidingSubMeshCandidates;
  const sweeps = [
    [[0, 0, 0], [0, 0, 8]], // Direct contact.
    [[4, 0, 0], [0, 0, 8]], // Pass through the gap.
    [[-2, 0, 4], [6, 0, 0]], // Side contact and sliding.
    [[0, 6, 0], [0, 0, 8]], // Pass above the obstacles.
    [[-5, 0, -3], [24, 0, 14]], // A large swept displacement.
  ].map(([start, delta]) => [new babylon.Vector3(...start), new babylon.Vector3(...delta)]);
  const baseline = sweeps.map(([start, delta]) => sweep(scene, start, delta));
  partitionMergedCollisions(mesh, ranges);
  const candidates = scene.getCollidingSubMeshCandidates(mesh, scene.collisionCoordinator.createCollider());
  assert.equal(candidates.length, parts.length);
  assert.equal(mesh.subMeshes.length, 1, "collision partitions must not split the render batch");
  assert.equal(scene.meshes.length, 1, "collision partitions share geometry instead of adding proxy meshes");
  assert.strictEqual(mesh.getVerticesData(babylon.VertexBuffer.PositionKind), vertices);
  assert.strictEqual(mesh.getIndices(), indices);
  assert.ok(baseline[0].position.z < 4, "the baseline actually blocks movement");
  const optimized = sweeps.map(([start, delta]) => sweep(scene, start, delta));
  optimized.forEach((result, i) => assert.ok(result.position.equalsWithEpsilon(baseline[i].position, 1e-6),
    `sweep ${i} must keep the original precise collision response`));
  assert.ok(optimized[0].testedIndices <= baseline[0].testedIndices / 10,
    `a local sweep should avoid at least 90% of unrelated triangle tests (${optimized[0].testedIndices}/${baseline[0].testedIndices})`);
  const other = babylon.MeshBuilder.CreateBox("unregistered", {}, scene);
  assert.strictEqual(scene.getCollidingSubMeshCandidates(other, null).data, fallback(other, null).data,
    "architecture and imported meshes continue to use the original candidate provider");
});

test("actual room collision partitions cover every merged index and preserve first-person sweeps", t => {
  const scene = createScene(t);
  const fallback = scene.getCollidingSubMeshCandidates;
  const furnishings = new RoomFurnishings(scene);
  furnishings.furnish();
  const meshes = furnishings.finish();
  meshes.forEach(mesh => {
    mesh.checkCollisions = true;
    const candidates = scene.getCollidingSubMeshCandidates(mesh, null);
    assert.equal(candidates.data.slice(0, candidates.length).reduce((sum, part) => sum + part.indexCount, 0),
      mesh.getTotalIndices(), "no merged triangles may be omitted");
    assert.equal(mesh.subMeshes.length, 1);
  });
  const optimized = scene.getCollidingSubMeshCandidates;
  for (const [x, z] of [[4, 16], [0, 8], [-7, 5], [-7, -1], [10, 5], [-17, 9]]) {
    for (const [dx, dz] of [[0, -2], [2, 0], [-2, -1]]) {
      const start = new babylon.Vector3(x, -1.8, z);
      const delta = new babylon.Vector3(dx, 0, dz);
      scene.getCollidingSubMeshCandidates = fallback;
      const before = sweep(scene, start, delta);
      scene.getCollidingSubMeshCandidates = optimized;
      const after = sweep(scene, start, delta);
      assert.ok(after.position.equalsWithEpsilon(before.position, 1e-6),
        `first-person sweep from (${x}, ${z}) must retain exact collisions`);
    }
  }
});

function createScene(t) {
  const engine = new babylon.NullEngine();
  // Canvas drawing is irrelevant to geometry; use the real meshes, materials and glTF loader.
  const context = new Proxy({}, { get: (_, key) => ["createLinearGradient", "createRadialGradient"].includes(key)
    ? () => ({ addColorStop() {} }) : () => {} });
  engine.createCanvas = () => ({ width: 1, height: 1, getContext: () => context, remove() {} });
  engine.getDeltaTime = () => 1000 / 30;
  engine.getFps = () => 30;
  t.after(() => engine.dispose());
  return new babylon.Scene(engine);
}

for (const scale of [5.2, 3.7]) {
  test(`books and vase fit the actual bookshelf model at scale ${scale}`, async t => {
    const scene = createScene(t);
    const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/wooden_bookshelf.glb")));
    const result = await babylon.ImportMeshAsync(source, scene, {
      pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
    });
    const placement = new babylon.TransformNode("bookshelf-placement", scene);
    placement.position.set(11.5, -5, -17.8);
    placement.scaling.setAll(scale);
    result.meshes[0].parent = placement;
    const { compartments } = measureBookshelf(result.meshes);
    assert.equal(compartments.length, 6, "the model has six interior compartments");
    const localShelfHeights = [0.107607, 0.391878, 0.671547, 0.960453, 1.276524, 1.663383];
    compartments.forEach((slot, row) => {
      assert.ok(Math.abs(slot.min.y - (-5 + scale * localShelfHeights[row])) < 0.01);
    });
    const furnishings = new RoomFurnishings(scene);
    const parts = [];
    const merge = furnishings.merge.bind(furnishings);
    furnishings.merge = meshes => {
      meshes.forEach(mesh => {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        parts.push({ name: mesh.name, min: box.minimumWorld.clone(), max: box.maximumWorld.clone() });
      });
      return merge(meshes);
    };
    furnishings.furnishBookshelf(result.meshes);
    const books = parts.filter(part => part.name === "shelf-book");
    assert.ok(books.length >= 40, "every compartment contains books");
    for (const book of books) {
      const slot = compartments.find(slot => Math.abs(book.min.y - slot.min.y - 0.015) < 0.002);
      assert.ok(slot, "each book must rest on a real shelf");
      for (const axis of ["x", "y", "z"]) {
        assert.ok(book.min[axis] >= slot.min[axis] - 0.002 && book.max[axis] <= slot.max[axis] + 0.002,
          `book protrudes through compartment on ${axis}`);
      }
    }
    const vaseParts = parts.filter(part => /^(vase-|dried-flower)/.test(part.name));
    const vaseSlot = compartments[compartments.length - 2];
    assert.equal(vaseParts.length, 12);
    for (const part of vaseParts) {
      for (const axis of ["x", "y", "z"]) {
        assert.ok(part.min[axis] >= vaseSlot.min[axis] - 0.002 && part.max[axis] <= vaseSlot.max[axis] + 0.002,
          `${part.name} protrudes through compartment on ${axis}`);
      }
    }
  });
}

test("all flower stems connect to both the vase neck and their flower heads", t => {
  const scene = createScene(t);
  const furnishings = new RoomFurnishings(scene);
  const parent = new babylon.TransformNode("console", scene);
  parent.rotation.y = Math.PI / 2;
  furnishings.vase([2.5, 4.27, 0], 0.65, parent);
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  const neck = scene.getMeshByName("vase-neck");
  const body = scene.getMeshByName("vase-body");
  const stems = scene.meshes.filter(mesh => mesh.name === "dried-flower-stem");
  const flowers = scene.meshes.filter(mesh => mesh.name === "dried-flower");
  assert.ok(neck.intersectsMesh(body, true));
  assert.equal(stems.length, 5);
  stems.forEach((stem, index) => {
    assert.ok(stem.intersectsMesh(neck, true), `stem ${index} must enter the vase neck`);
    assert.ok(stem.intersectsMesh(flowers[index], true), `stem ${index} must reach its flower`);
  });
});

test("changing movement speed applies immediately and clears previous movement", t => {
  const scene = createScene(t);
  const camera = new babylon.UniversalCamera("first-person", babylon.Vector3.Zero(), scene);
  const room = Object.create(RoomScene.prototype);
  room.firstPersonCamera = camera;
  room.setMovementSpeed(1);
  camera.cameraDirection.set(0.4, 0, 0);
  camera._checkInputs();
  const previous = camera.position.clone();
  room.setMovementSpeed(0.25);
  camera._checkInputs();
  assert.ok(camera.position.equals(previous), "old movement must stop when speed changes");
  const slow = camera._computeLocalCameraSpeed();
  room.setMovementSpeed(3);
  assert.ok(Math.abs(camera._computeLocalCameraSpeed() / slow - 12) < 0.0001);
  assert.equal(room.setMovementSpeed(NaN), 1);
  assert.equal(room.setMovementSpeed(-1), 0.25);
  assert.equal(room.setMovementSpeed(100), 3);
});

test("lamp lights emit below their shades and the window is the main light source", t => {
  const scene = createScene(t);
  new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  furnishings.floorLamp();
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  for (const [lightName, shadeName] of [
    ["reading-lamp-light", "linen-lampshade"], ["banker-lamp-light", "banker-green-shade"],
  ]) {
    const light = scene.getLightByName(lightName);
    const shade = scene.getMeshByName(shadeName).getBoundingInfo().boundingBox;
    assert.ok(light.position.y < shade.minimumWorld.y, `${lightName} must not be enclosed in its shade`);
    assert.ok(Math.abs(light.position.x - (shade.minimumWorld.x + shade.maximumWorld.x) / 2) < 0.01);
    assert.ok(Math.abs(light.position.z - (shade.minimumWorld.z + shade.maximumWorld.z) / 2) < 0.01);
    assert.ok(light.getShadowGenerator(), `${lightName} must cast shadows`);
  }
  const windowLight = scene.getLightByName("window-daylight");
  const directSources = scene.lights.filter(light => light instanceof babylon.SpotLight);
  assert.deepEqual(directSources.map(light => light.name).sort(),
    ["banker-lamp-light", "reading-lamp-light", "window-daylight"], "each direct source corresponds to a visible window or lamp");
  assert.equal(new Set(directSources.map(light => light.getShadowGenerator())).size, 3,
    "each direct source must own an independent shadow map");
  assert.ok(windowLight.position.x < -18 && windowLight.direction.x > 0, "daylight must enter from the window wall");
  assert.ok(scene.materials.filter(material => material instanceof babylon.StandardMaterial || material instanceof babylon.PBRMaterial)
    .every(material => material.maxSimultaneousLights >= scene.lights.length));
});

test("floor lamp foot touches the floor and its stacked base joins the stem", t => {
  const scene = createScene(t);
  const lighting = new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.floorLamp();
  const names = ["lamp-base-foot", "lamp-weighted-base", "lamp-base-shoulder", "lamp-stem"];
  const parts = names.map(name => scene.getMeshByName(name));
  parts.forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = parts.map(mesh => mesh.getBoundingInfo().boundingBox);
  assert.ok(Math.abs(bounds[0].minimumWorld.y + 5) < 0.0001, "foot must rest on the floor");
  bounds.slice(1).forEach((box, index) => {
    assert.ok(box.minimumWorld.y <= bounds[index].maximumWorld.y + 0.0001,
      `${names[index + 1]} must touch or overlap the part below`);
  });
  const merged = furnishings.finish();
  lighting.addMeshes(merged);
  scene.lights.filter(light => light instanceof babylon.SpotLight).forEach(light => {
    assert.ok(merged.every(mesh => light.getShadowGenerator().getShadowMap().renderList.includes(mesh)),
      "the complete lamp base must cast shadows from each direct source after merging");
  });
});

for (const [file, width, rotation, x, z] of [
  ["sofa_03", 10.8, 0, 10, 6],
  ["modern_arm_chair_01", 3.8, Math.PI / 2, -10, 12],
]) {
  test(`${file} fits its room footprint and sits on the floor after glTF conversion`, async t => {
    const scene = createScene(t);
    const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/study", file + ".glb")));
    const result = await babylon.ImportMeshAsync(source, scene, {
      pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
    });
    const geometry = result.meshes.filter(mesh => mesh.getTotalVertices() > 0);
    const parents = geometry.map(mesh => mesh.parent);
    placeFurniture(result.meshes, scene, file, new babylon.Vector3(x, -5, z), width, rotation);
    let min = new babylon.Vector3(Infinity, Infinity, Infinity);
    let max = new babylon.Vector3(-Infinity, -Infinity, -Infinity);
    geometry.forEach((mesh, index) => {
      assert.equal(mesh.parent, parents[index], "fitting must preserve the imported transform hierarchy");
      assert.ok(mesh.checkCollisions && mesh.receiveShadows && mesh.metadata.castsShadows);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min = babylon.Vector3.Minimize(min, bounds.minimumWorld);
      max = babylon.Vector3.Maximize(max, bounds.maximumWorld);
    });
    assert.ok(Math.abs(min.y + 5) < 0.001, "lowest vertex must touch the floor");
    assert.ok(Math.abs((min.x + max.x) / 2 - x) < 0.001);
    assert.ok(Math.abs((min.z + max.z) / 2 - z) < 0.001);
    const widthAxis = rotation === 0 ? "x" : "z";
    assert.ok(Math.abs(max[widthAxis] - min[widthAxis] - width) < 0.001);
    assert.ok(max.y < 1, "furniture must remain below the standing camera's eye level");
  });
}

test("wall colour, normal and ARM maps tile together without modifying other walls", t => {
  const scene = createScene(t);
  const source = paintedWallMaterial(scene);
  const wall = tileMaterial(source, "wall", 3.5, 1.2);
  const other = tileMaterial(source, "lintel", 0.7, 0.3);
  for (const key of ["albedoTexture", "bumpTexture", "metallicTexture"]) {
    assert.notEqual(wall[key], source[key]);
    assert.equal(wall[key].uScale, 3.5);
    assert.equal(wall[key].vScale, 1.2);
    assert.equal(other[key].uScale, 0.7);
    assert.equal(source[key].uScale, 1);
  }
  assert.equal(wall.albedoTexture.gammaSpace, true);
  assert.equal(wall.bumpTexture.gammaSpace, false);
  assert.equal(wall.metallicTexture.gammaSpace, false);
  assert.equal(wall.bumpTexture.level, 0.18);
  assert.ok([wall.albedoTexture, wall.bumpTexture, wall.metallicTexture].every(texture =>
    texture.url.includes('/painted_wall/') && texture.url.endsWith('.png')));
});

test("all exterior, shared and lintel walls use the same painted finish while wood remains separate", t => {
  const { scene } = adjacentRooms(t);
  const names = ['back-wall-left', 'back-wall-right', 'door-lintel-wall', 'left-painted-wall',
    'front-painted-wall', 'shared-wall-0', 'shared-wall-1', 'shared-wall-2', 'living-back-wall',
    'living-right-wall', 'living-front-wall', 'living-right-painted-facing'];
  for (const name of names) {
    const mesh = scene.getMeshByName(name);
    assert.ok(mesh, name);
    assert.ok(mesh.material.albedoTexture.url.includes('/painted_wall/'), name);
    assert.equal(mesh.material.bumpTexture.level, 0.18);
    assert.equal(mesh.material.metallicTexture.gammaSpace, false);
  }
  assert.ok(scene.getMaterialByName('wood').albedoTexture.url.includes('/wood_table_001/'));
  assert.ok(!scene.textures.some(texture => texture.url?.includes('/brick_wall_001/')));
});

test("rugs receive shadows without hiding chair legs; cached shadows refresh after enclosure changes", t => {
  const scene = createScene(t);
  const lighting = new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.chair([-3, -5, 5.1], 0);
  furnishings.box("persian-rug", [14.5, 0.055, 13], [-3, -4.95, -0.3], "wood");
  furnishings.box("foundation", [40.6, 0.6, 40.6], [0, -5.4, 0], "darkWood");
  const meshes = furnishings.finish();
  lighting.addMeshes(meshes);
  const receivers = meshes.filter(mesh => mesh.metadata.castsShadows === false);
  const furniture = meshes.filter(mesh => mesh.metadata.castsShadows);
  assert.equal(receivers.length, 2, "receivers sharing furniture materials must merge separately");
  const shadows = scene.lights.filter(light => light instanceof babylon.SpotLight)
    .map(light => light.getShadowGenerator());
  for (const shadow of shadows) {
    const casters = shadow.getShadowMap().renderList;
    assert.ok(receivers.every(mesh => mesh.receiveShadows && !casters.includes(mesh)));
    assert.ok(furniture.every(mesh => casters.includes(mesh)), "chair geometry must cast shadows from every light");
  }
  lighting.freezeShadows();
  for (const shadow of shadows) {
    assert.equal(shadow.getShadowMap()._shouldRender(), true);
    assert.equal(shadow.getShadowMap()._shouldRender(), false);
  }
  lighting.refreshShadows();
  for (const shadow of shadows) {
    assert.equal(shadow.getShadowMap()._shouldRender(), true, "changed walls must invalidate all cached shadows");
  }
});

test("beveled boards keep their dimensions and have outward, finite surface normals", t => {
  const scene = createScene(t);
  for (const size of [[8.3, 0.4, 6], [0.2, 2.3, 0.2], [10.7, 0.2, 0.28]]) {
    const mesh = beveledBox("board", size, 0.065, scene);
    const positions = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(babylon.VertexBuffer.NormalKind);
    const fromWinding = [];
    babylon.VertexData.ComputeNormals(positions, mesh.getIndices(), fromWinding);
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(box.maximum.asArray()[axis] - size[axis] / 2) < 0.00001);
      assert.ok(Math.abs(box.minimum.asArray()[axis] + size[axis] / 2) < 0.00001);
    }
    for (let i = 0; i < normals.length; i += 3) {
      const normal = babylon.Vector3.FromArray(normals, i);
      assert.ok(Math.abs(normal.length() - 1) < 0.00001);
      assert.ok(babylon.Vector3.Dot(normal, babylon.Vector3.FromArray(fromWinding, i)) > 0.8,
        "triangle winding must agree with the visible outer surface");
      assert.ok(babylon.Vector3.Dot(normal, babylon.Vector3.FromArray(positions, i)) > 0);
    }
  }
});

test("stacked book covers touch the support and the next book without floating gaps", t => {
  const scene = createScene(t);
  const furnishings = new RoomFurnishings(scene);
  furnishings.bookStack([0, 2, 0]);
  const covers = scene.meshes.filter(mesh => mesh.name === "book-cover");
  covers.forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = covers.map(mesh => mesh.getBoundingInfo().boundingBox);
  assert.ok(Math.abs(bounds[0].minimumWorld.y - 2) < 0.00001);
  for (let book = 0; book < 2; book++) {
    assert.ok(Math.abs(bounds[book * 2 + 1].maximumWorld.y - bounds[(book + 1) * 2].minimumWorld.y) < 0.00001);
  }
});

test("cloth gathers around its tie and leaves have a thin, curved pointed silhouette", t => {
  const scene = createScene(t);
  const cloth = curtainPanel("cloth", 1, scene);
  const clothPositions = cloth.getVerticesData(babylon.VertexBuffer.PositionKind);
  const rowWidth = row => {
    const start = row * 41 * 3;
    return clothPositions[start + 40 * 3] - clothPositions[start];
  };
  assert.ok(rowWidth(23) < rowWidth(0) * 0.6, "the panel must visibly gather at the tie height");
  assert.ok(rowWidth(36) > rowWidth(23) * 2, "cloth must spread back out toward the hem");
  const leaf = ficusLeaf("leaf", 1.5, 0.7, scene);
  const leafPositions = leaf.getVerticesData(babylon.VertexBuffer.PositionKind);
  const halfVertices = leafPositions.length / 6;
  const tipY = leafPositions[(14 * 9 + 4) * 3 + 1];
  assert.ok(tipY < -0.2, "the tip must droop below its attachment");
  assert.ok(Math.abs(leafPositions[14 * 9 * 3]) < 0.005, "the silhouette must taper to a point");
  assert.ok(halfVertices > 100, "curvature must come from geometry rather than a stretched sphere");
  assert.ok([...clothPositions, ...leafPositions].every(Number.isFinite));
});

test("desk accessories, tea tray and small furniture rest on their actual supports", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  const bounds = mesh => {
    mesh.computeWorldMatrix(true);
    return mesh.getBoundingInfo().boundingBox;
  };
  furnishings.writingTable();
  const deskY = bounds(scene.getMeshByName("table-top")).maximumWorld.y;
  for (const name of ["book-cover", "saucer", "banker-base"]) {
    assert.ok(Math.abs(bounds(scene.getMeshByName(name)).minimumWorld.y - deskY) < 0.00001,
      `${name} must touch the desktop`);
  }
  furnishings.coffeeTable();
  const teaTray = bounds(scene.getMeshByName("tea-tray"));
  assert.ok(Math.abs(teaTray.minimumWorld.y - bounds(scene.getMeshByName("oval-walnut-top")).maximumWorld.y) < 0.00001);
  const saucers = scene.meshes.filter(mesh => mesh.name === "saucer");
  assert.ok(Math.abs(bounds(saucers[1]).minimumWorld.y - teaTray.maximumWorld.y) < 0.00001);
  furnishings.armchair(); furnishings.sofa();
  for (const name of ["side-table-base", "ottoman-foot"]) {
    assert.ok(Math.abs(bounds(scene.getMeshByName(name)).minimumWorld.y + 5) < 0.00001,
      `${name} must touch the floor`);
  }
});

test("wear masks preserve tangent normals and keep surface variation subtle and reproducible", () => {
  for (const kind of ["wood", "brass", "cover"]) {
    const { size, pixels } = buildWearMask(kind);
    assert.deepEqual(pixels, buildWearMask(kind).pixels, "wear must remain stable across reloads");
    assert.equal(pixels.length, size * size * 4);
    let roughnessMin = 255, roughnessMax = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const nx = pixels[i + 3] / 255 * 2 - 1, ny = pixels[i + 1] / 255 * 2 - 1;
      assert.ok(Math.sqrt(1 - nx * nx - ny * ny) > 0.999,
        "detail maps must not flatten or bend the original normal, including materials without a bump map");
      assert.ok(pixels[i] >= 120 && pixels[i] <= 150, "albedo variation must be restrained");
      roughnessMin = Math.min(roughnessMin, pixels[i + 2]);
      roughnessMax = Math.max(roughnessMax, pixels[i + 2]);
    }
    assert.ok(roughnessMin >= 110 && roughnessMax <= 160);
    assert.ok(roughnessMax - roughnessMin > 12, "roughness must contain actual local wear");
  }
});

test("creased letter rests on the blotter and curls only a small distance above it", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  const letter = scene.getMeshByName("letter"), blotter = scene.getMeshByName("desk-blotter");
  letter.computeWorldMatrix(true); blotter.computeWorldMatrix(true);
  const paperBounds = letter.getBoundingInfo().boundingBox;
  const support = blotter.getBoundingInfo().boundingBox.maximumWorld.y;
  assert.ok(paperBounds.minimumWorld.y >= support && paperBounds.minimumWorld.y - support < 0.003);
  assert.ok(paperBounds.maximumWorld.y - support > 0.04 && paperBounds.maximumWorld.y - support < 0.07);
  assert.ok(letter.material.albedoTexture && letter.material.roughness > 0.9);
  const mesh = creasedLetter("check-normals", scene);
  const positions = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(babylon.VertexBuffer.NormalKind);
  assert.ok([...positions, ...normals].every(Number.isFinite));
  assert.ok(normals[1] > 0.9, "the top side must face the room lights");
});

test("detail view permits close inspection and restores overview zoom limits on exit", t => {
  const scene = createScene(t), room = Object.create(RoomScene.prototype);
  room.camera = new babylon.ArcRotateCamera("orbit", 0.8, 1.08, 66, babylon.Vector3.Zero(), scene);
  room.firstPersonCamera = new babylon.UniversalCamera("walking", new babylon.Vector3(4, 1, 16), scene);
  room.interiorShell = new babylon.TransformNode("shell", scene);
  room.interiorShell.setEnabled(false);
  room.scene = scene; room.controlsEnabled = false;
  room.interactions = { silenceMotion() {} };
  room.audio = { setSpatialCamera() {} };
  room.floorPlan = { isOpen: false, update() {} };
  room.canvas = { setAttribute() {} };
  let refreshed = 0;
  room.lighting = { refreshShadows() { refreshed++; } };
  const previousDocument = global.document;
  global.document = { querySelector: () => null, querySelectorAll: () => [] };
  try {
    room.setView("details");
    room.camera._checkInputs();
    assert.equal(scene.activeCamera, room.camera);
    assert.ok(room.camera.radius < 6 && room.camera.lowerRadiusLimit <= room.camera.radius,
      "the close preset must not be pushed away by the general room zoom limit");
    room.setView("overview");
    assert.equal(room.camera.lowerRadiusLimit, 9);
    room.setView("first-person");
    assert.equal(scene.activeCamera, room.firstPersonCamera);
    assert.ok(room.interiorShell.isEnabled() && refreshed === 1);
    room.setView("details");
    assert.ok(!room.interiorShell.isEnabled() && refreshed === 2);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});


test("all five procedural drawers retain boxes, independent motion and live collisions after merging", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable(); furnishings.windowDesk();
  assert.equal(furnishings.drawers.length, 5);
  for (const drawer of furnishings.drawers) {
    assert.equal(drawer.meshes.filter(mesh => /drawer-(bottom|side|back)/.test(mesh.name)).length, 4);
  }
  furnishings.finish().forEach(mesh => mesh.checkCollisions = true);
  let refreshed = 0;
  const interactions = new RoomInteractions(scene, () => refreshed++);
  furnishings.drawers.forEach(drawer => interactions.addDrawer(drawer));
  const initial = furnishings.drawers.map(drawer => drawer.root.getAbsolutePosition().clone());
  for (const [index, drawer] of furnishings.drawers.entries()) {
    drawer.meshes.forEach(mesh => {
      assert.ok(!mesh.isWorldMatrixFrozen && mesh.checkCollisions);
      mesh.computeWorldMatrix(true);
    });
    const front = drawer.meshes.find(mesh => mesh.material.name === "wood");
    const bounds = front.getBoundingInfo().boundingBox;
    const centre = bounds.centerWorld.clone();
    const outward = index < 2 ? new babylon.Vector3(0, 0, 1) : new babylon.Vector3(1, 0, 0);
    const ray = new babylon.Ray(centre.add(outward.scale(5)), outward.negate(), 7.5);
    const action = interactions.pick(ray);
    assert.ok(action && action.label().startsWith("打开"), drawer.id + " must have a reachable front");
    action.toggle();
    interactions.update(0.05);
    const partial = drawer.root.position.clone();
    action.toggle(); // Reverse while moving; toggling must not snap to either endpoint.
    assert.ok(drawer.root.position.equals(partial));
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    assert.ok(drawer.root.getAbsolutePosition().equalsWithEpsilon(initial[index], 0.00001));
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    const delta = drawer.root.getAbsolutePosition().subtract(initial[index]);
    assert.ok(delta.equalsWithEpsilon(outward.scale(drawer.travel.length()), 0.0001), "travel must respect the rotated console");
    front.computeWorldMatrix(true);
    const openBounds = front.getBoundingInfo().boundingBox;
    const start = openBounds.centerWorld.add(outward.scale(2));
    const contact = sweep(scene, start, outward.scale(-3), new babylon.Vector3(0.1, 0.1, 0.1)).position;
    assert.ok(babylon.Vector3.Dot(contact.subtract(openBounds.centerWorld), outward) > 0.1,
      "the moving drawer must still block movement at its new position");
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
  }
  assert.ok(refreshed > 0, "motion must invalidate cached shadows");
  refreshed = 0; interactions.update(0.05);
  assert.equal(refreshed, 0, "settled drawers must retain shadow caching");
});

test("actual cabinet drawers move outward through the glTF conversion, preserving their geometry", async t => {
  const scene = createScene(t);
  const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/gothic_commode.glb")));
  const result = await babylon.ImportMeshAsync(source, scene, {
    pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
  });
  const placement = new babylon.TransformNode("antique-cabinet", scene);
  placement.position.set(-13.5, -5, -17.6); placement.scaling.setAll(4.7);
  result.meshes[0].parent = placement;
  result.meshes.forEach(mesh => { mesh.freezeWorldMatrix(); mesh.checkCollisions = true; });
  placement.freezeWorldMatrix();
  const interactions = new RoomInteractions(scene, () => {});
  const drawers = cabinetDrawers(result.meshes);
  assert.equal(drawers.length, 3);
  drawers.forEach(drawer => interactions.addDrawer(drawer));
  for (const drawer of drawers) {
    const mesh = drawer.meshes[0]; mesh.computeWorldMatrix(true);
    const before = mesh.getBoundingInfo().boundingBox.centerWorld.clone();
    const vertices = [...mesh.getVerticesData(babylon.VertexBuffer.PositionKind)];
    const action = interactions.pick(new babylon.Ray(before.add(new babylon.Vector3(0, 0, 5)), new babylon.Vector3(0, 0, -1), 7.5));
    assert.ok(action, drawer.id + " must be reachable on the visible cabinet front");
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    mesh.computeWorldMatrix(true);
    const delta = mesh.getBoundingInfo().boundingBox.centerWorld.subtract(before);
    assert.ok(delta.equalsWithEpsilon(new babylon.Vector3(0, 0, 1.786), 0.0001), JSON.stringify({delta:delta.asArray(),label:action.label(),drawer:drawer.id}));
    assert.deepEqual([...mesh.getVerticesData(babylon.VertexBuffer.PositionKind)], vertices);
    assert.ok(!mesh.isWorldMatrixFrozen && mesh.checkCollisions);
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
  }
  assert.throws(() => cabinetDrawers([]), /drawer missing/);
});

test("picking respects occlusion, hidden geometry and first-person reach", t => {
  const scene = createScene(t), interactions = new RoomInteractions(scene, () => {});
  const lamp = babylon.CreateBox("lamp", {}, scene); lamp.position.z = 4; lamp.isPickable = false; lamp.computeWorldMatrix(true);
  let toggled = 0;
  interactions.addLamp({ id: "lamp", label: "灯", meshes: [lamp] }, () => true, () => toggled++);
  const ray = new babylon.Ray(babylon.Vector3.Zero(), new babylon.Vector3(0, 0, 1), 7.5);
  assert.ok(interactions.pick(ray));
  const blocker = babylon.CreateBox("blocker", {}, scene); blocker.position.z = 2; blocker.isPickable = false;
  blocker.computeWorldMatrix(true);
  assert.equal(interactions.pick(ray), undefined, "static non-pickable furniture must occlude interactions");
  blocker.setEnabled(false); assert.ok(interactions.pick(ray));
  blocker.setEnabled(true); blocker.isVisible = false; assert.ok(interactions.pick(ray));
  lamp.position.z = 10; lamp.computeWorldMatrix(true); assert.equal(interactions.pick(ray), undefined, "out-of-reach lamps must not activate");
  ray.length = 100; interactions.pick(ray).toggle(); assert.equal(toggled, 1);
});

test("lamp switches independently restore direct light and their own emission", t => {
  const scene = createScene(t), lighting = new RoomLighting(scene), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable(); furnishings.floorLamp(); furnishings.finish();
  const desk = scene.getMaterialByName("desk-lamp-glow"), floor = scene.getMaterialByName("floor-lamp-shade");
  lighting.bindLamp("desk-lamp", desk); lighting.bindLamp("floor-lamp", floor);
  const deskGlow = desk.emissiveColor.clone(), floorGlow = floor.emissiveColor.clone();
  const candle = scene.getMaterialByName("shade").emissiveColor.clone();
  lighting.toggleLamp("desk-lamp");
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, 0);
  assert.ok(desk.emissiveColor.equals(babylon.Color3.Black()) && floor.emissiveColor.equals(floorGlow));
  assert.ok(lighting.isLampOn("floor-lamp") && !lighting.isLampOn("desk-lamp"));
  lighting.toggleLamp("floor-lamp");
  assert.equal(scene.getLightByName("reading-lamp-light").intensity, 0);
  assert.ok(scene.getMaterialByName("shade").emissiveColor.equals(candle));
  assert.equal(scene.getLightByName("window-daylight").intensity, 3.5);
  lighting.toggleLamp("desk-lamp"); lighting.toggleLamp("floor-lamp");
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, 1.25);
  assert.equal(scene.getLightByName("reading-lamp-light").intensity, 3.3);
  assert.ok(desk.emissiveColor.equals(deskGlow) && floor.emissiveColor.equals(floorGlow));
});


test("the inspectable letter remains a complete independent mesh on its original desk support", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  const letter = scene.getMeshByName("letter"), geometry = letter.geometry;
  const world = letter.computeWorldMatrix(true).clone();
  const material = letter.material;
  furnishings.finish();
  assert.equal(furnishings.inspectables.length, 1);
  const item = furnishings.inspectables[0];
  assert.equal(item.id, "desk-letter"); assert.equal(item.mesh, letter);
  assert.equal(letter.geometry, geometry); assert.equal(letter.material, material);
  assert.ok(letter.computeWorldMatrix(true).equalsWithEpsilon(world));
  assert.ok(letter.isWorldMatrixFrozen && letter.receiveShadows);
  assert.equal(letter.getTotalVertices(), 17 * 23 * 2, "the full creased sheet must be retained");
});

test("inspection centres and fits the actual shared geometry, restores the original camera and releases only preview resources", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  const originalCamera = new babylon.UniversalCamera("walking", new babylon.Vector3(4, 1, 10), scene);
  originalCamera.rotation.set(0.3, 1.2, 0);
  furnishings.writingTable(); furnishings.finish();
  const item = furnishings.inspectables[0], texture = item.mesh.material.albedoTexture;
  const world = item.mesh.computeWorldMatrix(true).clone();
  const inspection = new RoomItemInspection(scene);
  scene.activeCamera = originalCamera;
  const counts = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };
  let width = 1280, height = 720;
  scene.getEngine().getRenderWidth = () => width; scene.getEngine().getRenderHeight = () => height;
  for (let iteration = 0; iteration < 5; iteration++) {
    assert.ok(inspection.open(item)); assert.equal(inspection.open(item), false, "do not nest or leak duplicate previews");
    const preview = scene.getMeshByName("inspection-desk-letter");
    assert.equal(preview.geometry, item.mesh.geometry);
    assert.equal(preview.material.emissiveTexture, texture);
    assert.ok(!preview.checkCollisions && !preview.isPickable && !preview.receiveShadows);
    assert.equal(preview.layerMask & originalCamera.layerMask, 0);
    assert.ok(preview.layerMask & inspection.camera.layerMask);
    assert.deepEqual(Object.keys(inspection.camera.inputs.attached), []);
    for (const dimensions of [[1280, 720], [390, 844], [844, 390]]) {
      [width, height] = dimensions; inspection.resize();
      const transform = inspection.camera.getViewMatrix(true).multiply(inspection.camera.getProjectionMatrix(true));
      const viewport = new babylon.Viewport(0, 0, width, height);
      const bounds = preview.getBoundingInfo().boundingBox;
      const centre = babylon.Vector3.Project(bounds.centerWorld, babylon.Matrix.Identity(), transform, viewport);
      assert.ok(Math.abs(centre.x - width / 2) < 0.001 && Math.abs(centre.y - height / 2) < 0.001);
      for (const corner of bounds.vectorsWorld) {
        const point = babylon.Vector3.Project(corner, babylon.Matrix.Identity(), transform, viewport);
        assert.ok(point.x >= width * 0.08 && point.x <= width * 0.92);
        assert.ok(point.y >= height * 0.18 && point.y <= height * 0.82);
      }
    }
    assert.ok(inspection.close()); assert.equal(inspection.close(), false);
    assert.equal(scene.activeCamera, originalCamera);
    assert.ok(originalCamera.position.equalsWithEpsilon(new babylon.Vector3(4, 1, 10)));
    assert.ok(originalCamera.rotation.equalsWithEpsilon(new babylon.Vector3(0.3, 1.2, 0)));
    assert.ok(item.mesh.computeWorldMatrix(true).equalsWithEpsilon(world));
    assert.equal(scene.meshes.length, counts.meshes); assert.equal(scene.materials.length, counts.materials);
    assert.equal(scene.textures.length, counts.textures); assert.ok(scene.textures.includes(texture));
  }
  inspection.open(item); inspection.dispose();
  assert.equal(scene.activeCamera, originalCamera);
  assert.ok(!scene.cameras.includes(inspection.camera));
  assert.ok(scene.textures.includes(texture), "disposing inspection must preserve the desk letter texture");
});

test("letter inspection uses the existing ray action and preview geometry cannot occlude scene actions", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  new babylon.UniversalCamera("camera", new babylon.Vector3(-3.5, 2, -0.65), scene);
  furnishings.writingTable(); furnishings.finish();
  const item = furnishings.inspectables[0], interactions = new RoomInteractions(scene, () => {});
  let selected;
  interactions.addInspectable(item, value => selected = value);
  item.mesh.computeWorldMatrix(true);
  const centre = item.mesh.getBoundingInfo().boundingBox.centerWorld;
  const ray = new babylon.Ray(centre.add(new babylon.Vector3(0, 4, 0)), new babylon.Vector3(0, -1, 0), 7.5);
  const action = interactions.pick(ray);
  assert.equal(action.label(), "查看桌上的信"); action.toggle(); assert.equal(selected, item);
  const preview = item.mesh.clone("ignored-preview"); preview.unfreezeWorldMatrix(); preview.position.y += 1;
  preview.metadata = { inspectionPreview: true }; preview.computeWorldMatrix(true);
  assert.equal(interactions.pick(ray), action, "preview layer meshes must never intercept room interactions");
});
