// Match observed initial URLs to final file bodies; no cold-transfer or timing claims.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { verifyRelease } = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../..'), read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
const current = read('dist/release-manifest.json'), before = read('docs/technical-plans/assets/coastal-cliff-c-2026-10-17/release-manifest.json');
const matrix = read('docs/technical-plans/assets/coastal-cliff-d-2026-10-18/engines/matrix.json');
const metrics = verifyRelease(path.join(root, 'dist'));
const records = [];
for (const engine of matrix.engines.filter(e => e.passed)) for (const dpr of [1,2]) {
  const prefix = dpr === 2 ? '/home/' : '/';
  const paths = [...new Set(engine['initialAssetsDpr'+dpr].map(url => new URL(url).pathname.slice(prefix.length)))];
  const files = paths.map(p => current.files.find(f => f.path === p));
  assert.ok(files.every(Boolean), 'Observed request is outside final release');
  const scripts = files.filter(f => f.path.endsWith('.js')), runtime = files.filter(f => f.kind === 'runtime');
  const initialJsBytes = scripts.reduce((n,f)=>n+f.bytes,0);
  assert.equal(runtime.length,36); assert.equal(scripts.length,12); assert.ok(initialJsBytes <= 3*1048576);
  records.push({ engine: engine.kind, dpr, prefix, initialJsBytes, scripts: scripts.map(f=>f.path).sort(), runtimeAssets: runtime.length });
}
assert.ok(records.length >= 2);
assert.ok(records.every(r=>r.initialJsBytes === records[0].initialJsBytes));
for (const file of before.files.filter(f=>f.kind==='runtime')) assert.deepEqual(current.files.find(f=>f.path===file.path), file);
const priorMetrics = read('docs/technical-plans/assets/coastal-cliff-c-2026-10-17/resource-changes.json').after;
const result = { sourceCommit: 'd1ae3a1', beforeStageC: priorMetrics,
  after: {...metrics, actualInitialJsBytes: records[0].initialJsBytes},
  currentRuntimeChangesDuringD: false, all36AssetsUnchangedSinceStageC: true, records,
  deltaSinceStageCIncludesAlreadyCommittedWindowOverviewJumpFixes: true,
  remainingBytes: {runtime:16*1048576-metrics.runtimeBytes, initialJs:3*1048576-records[0].initialJsBytes,release:41*1048576-metrics.releaseBytes},
  method:'Scene/audio ready and before Inspector. Observed resource URL set matched to final file bytes/SHA256. No timing/FPS experiment.',
  incompleteEngineCoverage:matrix.engines.filter(e=>!e.passed).map(e=>({kind:e.kind,reason:e.failure.split('\n')[0]})) };
fs.writeFileSync(path.join(__dirname,'resource-changes.json'),JSON.stringify(result,null,2)+'\n');
fs.copyFileSync(path.join(root,'dist/release-manifest.json'),path.join(__dirname,'release-manifest.json'));
fs.copyFileSync(path.join(root,'dist/bundle-analysis.json'),path.join(__dirname,'bundle-analysis.json'));
console.log(JSON.stringify(result.after));
