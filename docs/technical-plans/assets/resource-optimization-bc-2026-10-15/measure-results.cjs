const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { hash } = require('../../../../tools/optimize-study-models.cjs');
const root = path.resolve(__dirname, '../../../..');
const temporary = path.resolve(process.argv[2] || '/private/tmp/babylon-resource-bc-20261015');
const sharp = require(process.env.SHARP_PACKAGE || 'sharp');
const read = file => JSON.parse(fs.readFileSync(file));

(async () => {
  const manifest = read(path.join(root, 'public/models/study-model-optimization.json'));
  const originalFiles = read(path.join(root, 'docs/technical-plans/assets/resource-baseline-2026-10-15/files.json'));
  const before = read(path.join(temporary, 'screens/before.json'));
  const after = read(path.join(temporary, 'screens/after.json'));
  const assets = originalFiles.assets.map(item => {
    const data = fs.readFileSync(path.join(root, item.path));
    if (!manifest.models.some(model => model.file === item.path)) assert.equal(hash(data), item.sha256);
    return { path: item.path, originalBytes: item.bytes, bytes: data.length, sha256: hash(data) };
  });
  assert.equal(execFileSync('git', ['diff', '--name-only', '7dfd21d', '--', 'src', 'public/index.html', 'package.json', 'package-lock.json', 'webpack.config.js', 'tsconfig.json'], { cwd: root }).toString().trim(), '');
  const list = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name); return entry.isDirectory() ? list(file) : [file];
  });
  const buildRoot = path.join(temporary, 'build');
  const buildFiles = list(buildRoot).sort().map(file => {
    const data = fs.readFileSync(file); return { path: path.relative(buildRoot, file), bytes: data.length, sha256: hash(data) };
  });
  const modelsWithoutTextureSizes = models => models.map(model => ({ ...model,
    meshes: model.meshes.map(mesh => ({ ...mesh, textures: mesh.textures.map(({ size, ...texture }) => texture) })) }));
  assert.deepEqual(modelsWithoutTextureSizes(before.models), modelsWithoutTextureSizes(after.models));
  assert.equal(before.views.length, 10); assert.equal(after.views.length, 10);
  assert.deepEqual(before.views, after.views, 'Cameras, geometry and active meshes must stay identical');
  assert.deepEqual(after.errors, []);
  for (const request of after.requests) {
    assert.ok(request.finished && request.status === 200 && !request.failure);
    assert.equal(request.receivedBodyBytes, request.contentLength);
    assert.ok(!request.fromDiskCache && !request.fromServiceWorker);
  }
  const comparisons = [];
  for (const profile of ['1k-c85', '1k-c90', '1k-c95', 'mixed-c90', 'detail-c85', 'detail-c90', 'after']) {
    for (const view of ['cabinet-close', 'bookshelf-close']) {
      const a = await sharp(path.join(temporary, `screens/before/${view}.png`)).removeAlpha().raw().toBuffer();
      const b = await sharp(path.join(temporary, `screens/${profile}/${view}.png`)).removeAlpha().raw().toBuffer();
      assert.equal(a.length, b.length);
      let absolute = 0, squared = 0;
      for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; absolute += Math.abs(d); squared += d * d; }
      comparisons.push({ profile, view, meanAbsolutePixelError: absolute / a.length,
        fullFramePsnrDb: 10 * Math.log10(255 * 255 / (squared / a.length)) });
    }
  }
  const originalModelBytes = manifest.models.reduce((sum, model) => sum + model.original.bytes, 0);
  const modelBytes = manifest.models.reduce((sum, model) => sum + model.delivery.bytes, 0);
  const assetBytes = assets.reduce((sum, item) => sum + item.bytes, 0);
  const originalAssetBytes = assets.reduce((sum, item) => sum + item.originalBytes, 0);
  const buildBytes = buildFiles.reduce((sum, file) => sum + file.bytes, 0);
  const initial = after.requests.filter(request => request.phase === 'initial');
  const inspector = after.requests.filter(request => request.phase === 'inspector');
  const initialBodyBytes = initial.reduce((sum, request) => sum + request.receivedBodyBytes, 0);
  const result = { sceneCodeBaseline: execFileSync('git', ['rev-parse', '7dfd21d'], { cwd: root }).toString().trim(),
    selectedProfile: manifest.selectedProfile, applicationCodeAndConfigurationUnchanged: true,
    fpsCpuGpuSampling: false, modelStructureAndRuntimeAttributesUnchanged: true, cameraAndMeshRecordsIdentical: true,
    reproducedDeliverySha256Matches: manifest.models.every(model => hash(fs.readFileSync(path.join(temporary, 'reproduced/detail-c85', path.basename(model.file)))) === model.delivery.sha256),
    summary: { originalModelBytes, modelBytes, modelReductionPercent: 100 * (1 - modelBytes / originalModelBytes),
      originalAssetBytes, assetBytes, assetReductionPercent: 100 * (1 - assetBytes / originalAssetBytes),
      buildFileCount: buildFiles.length, buildBytes, originalBuildPlusAssetsBytes: buildBytes + originalAssetBytes,
      buildPlusAssetsBytes: buildBytes + assetBytes, initialRequestCount: initial.length, initialBodyBytes,
      equivalentOriginalInitialBodyBytes: initialBodyBytes + originalAssetBytes - assetBytes,
      equivalentOriginalInitialBodyIsCalculated: true,
      inspectorRequestCount: inspector.length, inspectorBodyBytes: inspector.reduce((sum, request) => sum + request.receivedBodyBytes, 0) },
    assets, buildFiles, comparisons,
    comparisonNote: 'PNG comparisons include background and UI and are supplementary; visual close-up inspection determines acceptance. No FPS or loading speed claim.',
    metadataBytes: fs.statSync(path.join(root, 'public/models/study-model-optimization.json')).size,
  };
  assert.ok(result.reproducedDeliverySha256Matches);
  fs.writeFileSync(path.join(__dirname, 'measurements.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.summary));
})().catch(error => { console.error(error); process.exitCode = 1; });
