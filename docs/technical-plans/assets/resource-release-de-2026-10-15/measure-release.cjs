// Validate a separately hosted release and compare static captures with stage C.
// No frame-rate, CPU/GPU, or load-time sampling.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { verifyRelease, listFiles } = require('../../../../tools/verify-study-release.cjs');
const { hash } = require('../../../../tools/StudyReleasePlugin.cjs');
const root = path.resolve(__dirname, '../../../..');
const build = path.resolve(process.argv[2] || path.join(root, 'dist'));
const screens = path.resolve(process.argv[3] || '/private/tmp/babylon-resource-de-20261015/screens');
const url = process.env.BASELINE_URL || 'http://127.0.0.1:8094/';
const read = file => JSON.parse(fs.readFileSync(file));

(async () => {
  const summary = verifyRelease(build);
  const release = read(path.join(build, 'release-manifest.json'));
  const after = read(path.join(screens, 'after.json'));
  const priorDirectory = path.join(__dirname, '../resource-optimization-bc-2026-10-15');
  const prior = read(path.join(priorDirectory, 'after.json'));
  const priorMeasurement = read(path.join(priorDirectory, 'measurements.json'));
  const baseline = read(path.join(__dirname, '../resource-baseline-2026-10-15/files.json'));
  assert.deepEqual(after.errors, []);
  assert.equal(after.servedModelsViaRoute, false);
  assert.equal(after.fpsCpuGpuSampling, false);
  assert.deepEqual(after.views, prior.views, 'Cameras, geometry and active mesh counts must match stage C');
  assert.deepEqual(after.models, prior.models, 'Actual model attributes must match stage C');
  assert.equal(after.views.length, 10);
  assert.ok(after.interactions.settingsVisible && after.interactions.inspectorOpenedAndClosed);
  assert.ok(after.interactions.movementStart.some((value, i) => value !== after.interactions.movementEnd[i]));
  assert.equal(execFileSync('git', ['diff', '--name-only', 'c076c7c', '--', 'src'], { cwd: root }).toString().trim(), '');
  const compiled = release.files.filter(file => file.kind === 'build');
  assert.deepEqual(compiled.filter(file => file.path !== 'index.html').map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort((a, b) => a.path.localeCompare(b.path)),
    priorMeasurement.buildFiles.filter(file => file.path !== 'index.html').map(file => ({ ...file })).sort((a, b) => a.path.localeCompare(b.path)), 'All compiled JS and license bytes must match stage C');

  for (const request of after.requests) {
    assert.equal(new URL(request.url).origin, new URL(url).origin, 'Runtime must not depend on an external service');
    assert.ok(request.finished && request.status === 200 && !request.failure, `Failed runtime request: ${request.url}`);
    assert.ok(!request.fromDiskCache && !request.fromServiceWorker);
    assert.equal(request.receivedBodyBytes, request.contentLength);
  }
  const hostedFiles = [];
  for (const file of listFiles(build)) {
    const target = new URL(file, url);
    const response = await fetch(target, { redirect: 'error' });
    assert.equal(response.status, 200, `Hosted file inaccessible: ${file}`);
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(data), hash(fs.readFileSync(path.join(build, file))), `Hosted bytes differ: ${file}`);
    hostedFiles.push({ path: file, status: response.status, bytes: data.length, sha256: hash(data) });
  }
  const missing = await fetch(new URL('models/barrel.glb', url));
  assert.equal(missing.status, 404, 'Server must not fall back to the development public directory');
  const phase = name => {
    const requests = after.requests.filter(request => request.phase === name);
    return { count: requests.length, bodyBytes: requests.reduce((sum, request) => sum + request.receivedBodyBytes, 0),
      transferBytesIncludingHeaders: requests.reduce((sum, request) => sum + request.encodedTransferBytes, 0) };
  };
  const initial = phase('initial');
  const runtimePaths = after.requests.filter(request => request.phase === 'initial').map(request => new URL(request.url).pathname.replace(/^\//, ''));
  for (const file of release.files.filter(file => file.kind === 'runtime')) assert.ok(runtimePaths.includes(file.path));
  const comparisons = [];
  for (const view of after.views) {
    const file = `${view.view}.jpg`;
    const data = fs.readFileSync(path.join(screens, 'after', file));
    const old = fs.readFileSync(path.join(priorDirectory, `after-${file}`));
    comparisons.push({ view: view.view, jpegSha256: hash(data), stageCSha256: hash(old), byteIdentical: data.equals(old) });
    fs.writeFileSync(path.join(__dirname, file), data);
  }
  const allocatedBytes = listFiles(build).reduce((sum, file) => sum + fs.statSync(path.join(build, file)).blocks * 512, 0);
  const report = {
    implementationBaseline: 'c076c7c', sceneCodeBaseline: '7dfd21d',
    buildCommand: 'npm run build:production', servingCommand: 'python3 -m http.server 8094 --bind 127.0.0.1 --directory dist',
    independentStaticHosting: true, developmentPublicFallback: false, allCompiledJsAndLicenseBytesIdenticalToStageC: true,
    htmlChange: 'Inline empty favicon declaration avoids an implicit favicon.ico 404 on ordinary static hosting.',
    sceneCodeUnchanged: true, cameraAndGeometryUnchanged: true, modelRuntimeAttributesUnchanged: true,
    fpsCpuGpuOrLoadTimeSampling: false,
    summary: { ...summary, allocatedBytes, initial, views: phase('views'), interaction: phase('interaction'), inspector: phase('inspector'),
      stageAAssetBytes: baseline.summary.assetBytes, stageABuildPlusAssetsBytes: baseline.summary.productionPlusAssetsBytes,
      assetReductionPercent: 100 * (1 - summary.runtimeBytes / baseline.summary.assetBytes),
      fullReleaseReductionPercent: 100 * (1 - summary.releaseBytes / baseline.summary.productionPlusAssetsBytes),
      stageAInitialBodyBytes: 60039503, initialBodyReductionPercent: 100 * (1 - initial.bodyBytes / 60039503),
      budgetBytes: release.budgets },
    hostedFiles, excludedExampleRequest: { path: 'models/barrel.glb', status: missing.status, intentionalNegativeCheck: true },
    comparisons,
    comparisonNote: 'JPEG hashes are diagnostic, not an equality gate. Ten matching camera/mesh records, identical JS/runtime bytes and visual review protect deployment equivalence; no speed or FPS claim.',
  };
  fs.copyFileSync(path.join(screens, 'after.json'), path.join(__dirname, 'browser.json'));
  fs.copyFileSync(path.join(build, 'release-manifest.json'), path.join(__dirname, 'release-manifest.json'));
  fs.writeFileSync(path.join(__dirname, 'measurements.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Static JPEGs identical to stage C: ${comparisons.filter(item => item.byteIdentical).length}/10`);
})().catch(error => { console.error(error); process.exitCode = 1; });
