// NullEngine geometry/resource counts, never an FPS, GPU or loading-time sample.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript'), b = require('@babylonjs/core');
const root = path.resolve(__dirname, '../../../..');
function measure(previous) {
  const cache = new Map();
  function source(name) {
    if (cache.has(name)) return cache.get(name);
    const text = previous
      ? execFileSync('git', ['show', '98e760a:src/examples/' + name + '.ts'], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, 'src/examples', name + '.ts'), 'utf8');
    const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(id => id.startsWith('./') ? source(id.slice(2)) : require(id), module, module.exports);
    cache.set(name, module.exports); return module.exports;
  }
  const engine = new b.NullEngine(), scene = new b.Scene(engine);
  scene.useDelayedTextureLoading = true;
  const exterior = new (source('RoomExterior').RoomExterior)(scene);
  const result = { meshes: exterior.meshes.length, vertices: exterior.meshes.reduce((n,m) => n+m.getTotalVertices(),0), triangles: exterior.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0), materials: scene.materials.length, textures: scene.textures.length, lights: scene.lights.length, cameras: scene.cameras.length, renderTargets: scene.textures.filter(t=>t.isRenderTarget).length, layers: {} };
  for (const m of exterior.meshes) { const layer = m.metadata.exteriorLayer || 'forest'; result.layers[layer] = (result.layers[layer] || 0) + 1; }
  if (!previous) {
    const context = new Proxy({}, { get: (_, key) => ['createLinearGradient','createRadialGradient'].includes(key)
      ? () => ({ addColorStop() {} }) : () => {} });
    engine.createCanvas = () => ({ width: 1, height: 1, getContext: () => context, remove() {} });
    const furniture = new (source('RoomFurnishings').RoomFurnishings)(scene);
    source('HouseArchitecture').createHouseArchitecture(scene, furniture);
    furniture.finish(); exterior.bindShadowCasters(scene.meshes);
    const list = exterior.shadow.getShadowMap().renderList;
    result.localShadow = { size: [1024,1024], refreshRate: exterior.shadow.getShadowMap().refreshRate,
      fixedOrthoWorldUnits: exterior.sun.shadowFrustumSize, casterCount: list.length,
      casterVertices: list.reduce((n,m)=>n+m.getTotalVertices(),0), casters: list.map(m=>m.name),
      receivers: exterior.meshes.filter(m=>m.receiveShadows).map(m=>m.name),
      indoorEnvironmentReplaced: false, cameraTargetsAdded: 0 };
    result.deliveryTexturePixels = 2048**2 + 3*1024**2 + 512**2 + 256**2;
    result.rgba8MapsWithFullMipChainEstimateBytes = result.deliveryTexturePixels*4*4/3;
    result.environmentFaceSize = 128;
    result.generatedShoreField = { pixels: 256*256, rgba8Bytes: 256*256*4, mipmaps: false };
    result.gpuMemoryMeasured = false;
  }
  scene.dispose(); engine.dispose(); return result;
}
const inputs = ['src/examples/CoastalOcean.ts','src/examples/CoastalCliff.ts','src/examples/CoastalMaterials.ts','src/examples/CoastalScatter.ts','src/examples/CoastalSky.ts','src/examples/RoomExterior.ts','src/examples/Room.ts','tools/study-release.config.cjs','public/environment/coastal-cliff-source.json'];
const result = { baseline: '98e760a', before: measure(true), after: measure(false), fpsOrLoadTimeSampling: false, inputs: inputs.map(file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex') })) };
fs.writeFileSync(path.join(__dirname,'geometry.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
