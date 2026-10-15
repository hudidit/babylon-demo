const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');
const { assertInitialModules } = require('../tools/study-bundle-analysis.cjs');

test('pure room registrations work in a fresh process without the core side-effect barrel', () => {
  const output = execFileSync(process.execPath, [path.join(__dirname, 'fixtures/room-runtime-probe.cjs')], { encoding: 'utf8' });
  assert.match(output, /Pure runtime probe passed/);
});

test('initial dependency guard rejects broad or unrelated systems while allowing room features', () => {
  assert.doesNotThrow(() => assertInitialModules([
    'node_modules/@babylonjs/core/scene.pure.js',
    'node_modules/@babylonjs/core/Gamepads/gamepadSceneComponent.pure.js',
    'node_modules/@babylonjs/loaders/glTF/2.0/glTFLoader.pure.js',
    'node_modules/@babylonjs/core/FlowGraph/CustomTypes/flowGraphInteger.pure.js',
    'node_modules/@babylonjs/core/Meshes/GaussianSplatting/gaussianSplatting.functions.js',
  ]));
  for (const name of ['core/index.js', 'core/XR/webXRSessionManager.js', 'core/Physics/physicsEngine.js',
    'core/FlowGraph/flowGraph.js', 'core/FrameGraph/frameGraph.js',
    'core/Meshes/Node/nodeGeometry.js', 'core/Meshes/GaussianSplatting/gaussianSplattingMesh.pure.js',
    'inspector/lib/index.js', 'loaders/glTF/1.0/glTFLoader.js']) {
    assert.throws(() => assertInitialModules([`node_modules/@babylonjs/${name}`]), /Unexpected initial Babylon/);
  }
});
