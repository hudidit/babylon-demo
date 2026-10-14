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
const { RoomLighting } = loadSource("RoomLighting");
const { placeFurniture } = loadSource("RoomFurnitureAssets");
const { mappedMaterial, tileMaterial } = loadSource("RoomMaterials");

function createScene(t) {
  const engine = new babylon.NullEngine();
  // Canvas drawing is irrelevant to geometry; use the real meshes, materials and glTF loader.
  const context = new Proxy({}, { get: () => () => {} });
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
  assert.ok(windowLight.position.x < -18 && windowLight.direction.x > 0, "daylight must enter from the window wall");
  assert.ok(scene.materials.filter(material => material instanceof babylon.StandardMaterial || material instanceof babylon.PBRMaterial)
    .every(material => material.maxSimultaneousLights >= scene.lights.length));
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
  const source = mappedMaterial("brick", scene, "brick_wall_001");
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
