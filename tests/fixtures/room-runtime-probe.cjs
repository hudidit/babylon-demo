// Separate process: the geometry suite's @babylonjs/core import must not hide missing registrations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function loadSource(file) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    id => id.startsWith('.') ? loadSource(path.resolve(path.dirname(file), id + '.ts')) : require(id), module, module.exports);
  return module.exports;
}
const runtime = loadSource(path.join(__dirname, '../../src/examples/RoomRuntime.ts'));
runtime.registerRoomRuntime();
runtime.registerRoomRuntime();
const b = require('@babylonjs/core/pure');
const engine = new b.NullEngine();
const scene = new b.Scene(engine);
try {
  const orbit = new b.ArcRotateCamera('orbit', 0.8, 1.08, 66, b.Vector3.Zero(), scene);
  const walker = new b.UniversalCamera('walker', new b.Vector3(0, 1, 4), scene);
  assert.deepEqual(Object.keys(orbit.inputs.attached).sort(), ['keyboard', 'mousewheel', 'pointers']);
  assert.deepEqual(Object.keys(walker.inputs.attached).sort(), ['gamepad', 'keyboard', 'mouse', 'touch']);
  assert.equal(scene.defaultMaterial.getClassName(), 'StandardMaterial');
  const box = b.CreateBox('obstacle', {}, scene);
  box.material = new b.PBRMaterial('wood', scene);
  box.material.albedoTexture = new b.Texture(null, scene);
  const clone = box.material.clone('copy');
  assert.equal(clone.getClassName(), 'PBRMaterial');
  assert.ok(clone.albedoTexture, 'PBR clone must retain its registered texture parser');
  box.computeWorldMatrix(true);
  assert.ok(scene.pickWithRay(new b.Ray(new b.Vector3(0, 0, -3), new b.Vector3(0, 0, 1))).hit);
  box.checkCollisions = scene.collisionsEnabled = true;
  const collider = scene.collisionCoordinator.createCollider();
  collider._radius.setAll(0.5);
  let finalPosition;
  scene.collisionCoordinator.getNewPosition(new b.Vector3(0, 0, -3), new b.Vector3(0, 0, 6), collider, 3, null,
    (_, position) => finalPosition = position.clone(), 0);
  assert.ok(finalPosition.z < -0.9, 'Walker must stop at the obstacle');
  scene.activeCamera = orbit;
  scene.render();
  const { RoomItemInspection } = loadSource(path.join(__dirname, '../../src/examples/RoomItemInspection.ts'));
  const inspection = new RoomItemInspection(scene);
  inspection.open({ id: 'pure-item', label: 'item', mesh: box, displayRotation: b.Vector3.Zero() });
  const preview = scene.getMeshByName('inspection-pure-item');
  assert.equal(preview.geometry, box.geometry);
  assert.equal(preview.material.emissiveTexture, box.material.albedoTexture);
  scene.render();
  inspection.dispose();
  assert.equal(scene.activeCamera, orbit);
  assert.ok(scene.textures.includes(box.material.albedoTexture), 'Preview cleanup must retain the original texture');
  const normalized = Object.keys(require.cache).map(file => file.split(path.sep).join('/'));
  assert.ok(!normalized.some(file => file.endsWith('/@babylonjs/core/index.js')), 'Core barrel must not pre-register features');
  console.log('Pure runtime probe passed');
} finally {
  scene.dispose(); engine.dispose();
}
