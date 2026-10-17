// Compare measured file bodies and the browser-observed initial request inventory, never timing.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { verifyRelease } = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name)));
const current = read('release-manifest.json'), previous = require('../coastal-cliff-b-2026-10-17/release-manifest.json');
const metrics = verifyRelease(path.join(root, 'dist'));
function observed(name, prefix) {
  const inventory = read('browser.json'), paths = [...new Set(inventory[name].map(a => new URL(a.url).pathname.replace(prefix, '')))];
  const files = paths.map(p => current.files.find(f => f.path === p));
  assert.ok(files.every(Boolean), 'observed files must belong to this final release');
  const scripts = files.filter(f => f.path.endsWith('.js')), runtime = files.filter(f => f.kind === 'runtime');
  assert.equal(runtime.length, 36); assert.ok(scripts.length >= 12);
  const bytes = scripts.reduce((n, f) => n + f.bytes, 0); assert.ok(bytes <= 3 * 1048576);
  return { scripts, runtimePaths: runtime.map(f => f.path).sort(), actualInitialJsBytes: bytes };
}
const initial = observed('initialAssets', '/'), subpath = observed('subpathAssets', '/home/');
assert.equal(initial.actualInitialJsBytes, subpath.actualInitialJsBytes);
assert.deepEqual(initial.runtimePaths, subpath.runtimePaths);
const retained = previous.files.filter(f => f.kind === 'runtime');
for (const file of retained) assert.deepEqual(current.files.find(f => f.path === file.path), file);
const result = { baseline: '98e760a / stage B', before: require('../coastal-cliff-b-2026-10-17/resource-changes.json').after,
  after: { ...metrics, actualInitialJsBytes: initial.actualInitialJsBytes, observedInitialScripts: initial.scripts.length,
    observedRuntimeAssets: initial.runtimePaths.length },
  method: 'Ready scene and audio, before Inspector; browser observed resource URLs matched to final dist file bytes/SHA256. Normal browser cache, no timing, cold-transfer or FPS experiment.',
  initialScripts: initial.scripts, subpath: { actualInitialJsBytes: subpath.actualInitialJsBytes, sameRuntimePaths: true },
  retainedRuntimeAssets: { count: retained.length, bytesAndSha256: 'all unchanged' },
  addedRuntimeAssets: current.files.filter(f => f.kind === 'runtime' && !retained.some(p => p.path === f.path)),
  remainingBytes: { runtime: 16*1048576-metrics.runtimeBytes, actualInitialJs: 3*1048576-initial.actualInitialJsBytes,
    release: 41*1048576-metrics.releaseBytes }, fpsOrLoadTimeSampling: false };
fs.writeFileSync(path.join(__dirname, 'resource-changes.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify(result.after));
