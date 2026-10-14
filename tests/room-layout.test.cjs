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
const { beveledBox, creasedLetter, curtainPanel, ficusLeaf } = loadSource("RoomDetailGeometry");
const { buildWearMask } = loadSource("RoomSurfaceDetails");

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
