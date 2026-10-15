// Compare actual cold-context startup requests, rather than only the main bundle.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { hash } = require('../../../../tools/StudyReleasePlugin.cjs');
const { verifyRelease, listFiles } = require('../../../../tools/verify-study-release.cjs');
const { initialJsBudgetBytes } = require('../../../../tools/study-bundle-analysis.cjs');
const root = path.resolve(__dirname, '../../../..');
const temporary = path.resolve(process.argv[2] || '/private/tmp/babylon-tree-shaking-20261015');
const build = path.resolve(process.argv[3] || path.join(root, 'dist'));
const url = process.env.BASELINE_URL || 'http://127.0.0.1:8094/';
const read = file => JSON.parse(fs.readFileSync(file));

function summarizeBrowser(browser, directory) {
  assert.deepEqual(browser.errors, []);
  const phases = {};
  for (const phase of ['initial', 'views', 'interaction', 'inspector']) {
    const rows = browser.requests.filter(row => row.phase === phase);
    phases[phase] = { count: rows.length, bodyBytes: rows.reduce((sum, row) => sum + row.receivedBodyBytes, 0),
      transferBytesIncludingHeaders: rows.reduce((sum, row) => sum + row.encodedTransferBytes, 0) };
  }
  const initialJs = browser.requests.filter(row => row.phase === 'initial' && new URL(row.url).pathname.endsWith('.js'));
  const jsFiles = initialJs.map(row => {
    const file = new URL(row.url).pathname.slice(1);
    const data = fs.readFileSync(path.join(directory, file));
    assert.equal(data.length, row.receivedBodyBytes);
    return { path: file, bytes: data.length, sha256: hash(data), gzip9Bytes: zlib.gzipSync(data, { level: 9 }).length,
      brotli7Bytes: zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 7 } }).length };
  });
  for (const row of browser.requests) {
    assert.ok(row.finished && row.status === 200 && !row.failure);
    assert.ok(!row.fromDiskCache && !row.fromServiceWorker);
    assert.equal(row.receivedBodyBytes, row.contentLength);
    assert.equal(new URL(row.url).origin, new URL(url).origin);
  }
  return { phases, initialJsFiles: jsFiles, initialJsBytes: jsFiles.reduce((sum, file) => sum + file.bytes, 0),
    initialJsGzip9Bytes: jsFiles.reduce((sum, file) => sum + file.gzip9Bytes, 0),
    initialJsBrotli7Bytes: jsFiles.reduce((sum, file) => sum + file.brotli7Bytes, 0) };
}

(async () => {
  const before = read(path.join(temporary, 'screens-before/after.json'));
  const after = read(path.join(temporary, 'screens-after/after.json'));
  assert.deepEqual(after.views, before.views, 'Camera poses and vertex/active mesh counts');
  assert.deepEqual(after.models, before.models, 'GLB attributes, bounds, textures, collision and shadows');
  assert.deepEqual(after.rendering, before.rendering, 'Environment, materials, camera inputs and postprocess pipelines');
  assert.ok(after.interactions.sameEngineAfterInspector);
  assert.equal(after.interactions.speedChanged, 1.1);
  assert.equal(after.interactions.speedReset, 0.55);
  assert.notEqual(after.interactions.orbitStart.alpha, after.interactions.orbitAfterDrag);
  assert.notEqual(after.interactions.orbitStart.radius, after.interactions.radiusAfterZoom);
  assert.ok(!after.fpsCpuGpuSampling && !before.fpsCpuGpuSampling);
  const priorBuild = path.join(temporary, 'before');
  const beforeStats = summarizeBrowser(before, priorBuild), afterStats = summarizeBrowser(after, build);
  assert.ok(afterStats.initialJsBytes < beforeStats.initialJsBytes * 0.7, 'Require at least 30% actual startup JS reduction');
  assert.ok(afterStats.initialJsBytes <= initialJsBudgetBytes, 'Mandatory async startup JS counts toward the 3 MiB budget');
  assert.equal(afterStats.phases.views.count + afterStats.phases.interaction.count, 0);
  const summary = verifyRelease(build);
  const manifest = read(path.join(build, 'release-manifest.json'));
  const oldManifest = read(path.join(priorBuild, 'release-manifest.json'));
  const assets = manifest.files.filter(file => file.kind === 'runtime');
  assert.deepEqual(assets, oldManifest.files.filter(file => file.kind === 'runtime'));
  const hostedFiles = [];
  for (const file of listFiles(build)) {
    const response = await fetch(new URL(file, url), { redirect: 'error' });
    assert.equal(response.status, 200, `Hosted dependency missing: ${file}`);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(body), hash(fs.readFileSync(path.join(build, file))));
    hostedFiles.push({ path: file, bytes: body.length, sha256: hash(body), status: 200 });
  }
  const beforeReleaseBytes = listFiles(priorBuild).reduce((sum, file) => sum + fs.statSync(path.join(priorBuild, file)).size, 0);
  const report = { baselineCommit: '6dea648', browserVersion: after.browserVersion, before: beforeStats, after: afterStats,
    summary: { ...summary, actualStartupJsBytes: afterStats.initialJsBytes,
      startupJsReductionPercent: 100 * (1 - afterStats.initialJsBytes / beforeStats.initialJsBytes),
      initialBodyReductionPercent: 100 * (1 - afterStats.phases.initial.bodyBytes / beforeStats.phases.initial.bodyBytes),
      beforeReleaseBytes, releaseDeltaBytes: summary.releaseBytes - beforeReleaseBytes,
      startupJsGzipReductionPercent: 100 * (1 - afterStats.initialJsGzip9Bytes / beforeStats.initialJsGzip9Bytes),
      startupJsBrotliReductionPercent: 100 * (1 - afterStats.initialJsBrotli7Bytes / beforeStats.initialJsBrotli7Bytes) },
    checks: { resourcesIdentical: true, cameraGeometryModelsAndRenderingIdentical: true, independentHosting: true,
      inspectorOpenedAndClosedOnSameEngine: true, actualMandatoryAsyncJsIncluded: true, fpsCpuGpuOrLoadTimeSampling: false },
    compressionNote: 'gzip level 9 and Brotli quality 7 per JS file, offline only. HTTP test server sends uncompressed responses.',
    hostedFiles,
  };
  for (const label of ['before', 'after']) {
    fs.copyFileSync(path.join(temporary, `screens-${label}/after.json`), path.join(__dirname, `${label}.json`));
    for (const view of after.views) fs.copyFileSync(path.join(temporary, `screens-${label}/after/${view.view}.jpg`), path.join(__dirname, `${label}-${view.view}.jpg`));
  }
  for (const file of ['release-manifest.json', 'bundle-analysis.json']) fs.copyFileSync(path.join(build, file), path.join(__dirname, file));
  for (const file of ['build.log', 'tests.log', 'development-build.log']) {
    const log = fs.readFileSync(path.join(temporary, file), 'utf8').split('\n').map(line => line.trimEnd()).join('\n');
    fs.writeFileSync(path.join(__dirname, file), log);
  }
  fs.writeFileSync(path.join(__dirname, 'measurements.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
