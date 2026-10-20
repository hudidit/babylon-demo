const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name)));
const result = {baseline: '8aea9e9', checkedLocalLinks: 0, missingLinks: [], suites: [], buildGeneratedTargets: []};
const run = read('run-checks.json'); assert.equal(run.passed, true);
assert.equal(sha(fs.readFileSync(path.join(root, 'dist/release-manifest.json'))), run.manifestSha256);
for (const [name, file] of require('./run-checks.cjs').jobs) {
  const suite = run.suites[name], record = read(file);
  assert.equal(suite.passed, true, name); assert.equal(suite.exitCode, 0, name);
  assert.equal(record.releaseManifestSha256, run.manifestSha256, name);
  assert.equal(sha(fs.readFileSync(path.join(__dirname, file))), suite.resultSha256, file);
  assert.equal(sha(fs.readFileSync(path.join(root, suite.script))), suite.scriptSha256, suite.script);
  const adapter = ['continuity', 'release'].includes(name) ? path.join(__dirname, 'check-' + name + '.cjs') : path.join(__dirname, 'suite-adapter.cjs');
  assert.equal(sha(fs.readFileSync(adapter)), suite.adapterSha256);
  result.suites.push({name, passed: true});
}
for (const file of ['release-manifest.json', 'bundle-analysis.json'])
  assert.deepEqual(fs.readFileSync(path.join(__dirname, file)), fs.readFileSync(path.join(root, 'dist', file)));
const release = read('release.json'); assert.equal(release.identicalToPhase3, true); assert.equal(release.unchangedRuntimeFiles, 36);
assert.deepEqual(release.prefixes.map(p => p.files), [495, 495]);
const initial = ['browser/browser.json', 'subpath/browser.json'].map(file => read(file).initialJsBytes);
assert.deepEqual(initial, [2944957, 2944957]); assert.ok(Math.max(...initial) <= 3 * 1048576);
const conservativeInitialJsBytes = Math.max(...initial, read('headlight/browser.json').initialJsBytes);
assert.equal(conservativeInitialJsBytes, 2948280); assert.ok(conservativeInitialJsBytes <= 3 * 1048576);
const initialPaths = new Set(read('browser/browser.json').initialJs.map(r => new URL(r.url).pathname));
result.earlyAdditionalRequests = read('headlight/browser.json').initialJs
  .filter(r => !initialPaths.has(new URL(r.url).pathname)).map(r => ({path: new URL(r.url).pathname, bytes: r.bytes}));
assert.deepEqual(result.earlyAdditionalRequests, [{path: '/js/1442.js', bytes: 3323}]);
assert.equal(release.totals.modelBytes, 4332840); assert.ok(release.totals.modelBytes <= 4.25 * 1048576);
assert.equal(release.totals.runtimeBytes, 15867377); assert.ok(release.totals.runtimeBytes <= 16 * 1048576);
assert.equal(release.totals.releaseBytes, 42369441); assert.ok(release.totals.releaseBytes <= 41 * 1048576);
result.budgets = {actualInitialJsBytes: initial, conservativeInitialJsBytes, ...release.totals};
const platforms = read('platforms/platform-availability.json');
result.platformCoverage = {chromium: true, webkit: true, firefox: platforms.firefox.lighthouseTested === true,
  safari: platforms.safari.lighthouseTested === true, physicalDevices: false, availabilityProbeIsFunctionalTest: false};
const continuity = read('continuity/continuity.json');
assert.deepEqual(continuity.completedCycles.map(c => [c.kind, c.completeCycles]), [['chromium', 8], ['webkit', 4]]);
assert.deepEqual(continuity.completedCycles[0].retainedDays, [3, 4, 5, 6, 7, 8, 9]);
assert.equal(continuity.stressAttemptPassed, false); assert.ok(continuity.freshSessions.every(c => c.passed === true));
const stressProvenance = read('diagnostic-eight-day-stress-provenance.json');
assert.equal(stressProvenance.releaseManifestSha256, run.manifestSha256);
assert.equal(sha(fs.readFileSync(path.join(__dirname, 'diagnostic-eight-day-stress.json'))), stressProvenance.resultSha256);
assert.equal(sha(fs.readFileSync(path.join(__dirname, 'diagnostic-eight-day-stress.cjs'))), stressProvenance.sourceSha256);
result.completedSimulatedCycles = continuity.completedCycles; result.extraEightDayStressPassed = false;
const tests = fs.readFileSync(path.join(__dirname, 'tests.log'), 'utf8'); assert.match(tests, /tests 235/); assert.match(tests, /fail 0/);
assert.match(fs.readFileSync(path.join(__dirname, 'production-build.log'), 'utf8'), /compiled with 3 warnings/);
execFileSync('git', ['diff', '--quiet', '8aea9e9', '--', 'src', 'public', 'tools', 'tests', 'package.json', 'package-lock.json', 'webpack.config.js', 'tsconfig.json'], {cwd: root});
result.runtimeSourcesUnchanged = true;
const documents = ['CHANGELOG.md', 'docs/technical-plans/README.md',
  'docs/technical-plans/2026-10-20-lighthouse-project-01-core-loop.md',
  'docs/technical-plans/2026-10-20-lighthouse-operation-and-keeper-routine.md',
  'docs/technical-plans/2026-10-20-lighthouse-project-02-equipment-and-maintenance.md',
  'docs/technical-plans/2026-10-20-lighthouse-project-03-weather-and-uncertainty.md',
  path.relative(root, path.join(__dirname, 'README.md')), 'public/STUDY_ASSET_SOURCES.md'];
for (const document of documents) {
  const full = path.join(root, document), text = fs.readFileSync(full, 'utf8');
  for (const [, raw] of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link = decodeURIComponent(raw.replace(/^<|>$/g, '').split('#')[0].split('?')[0]);
    if (!link || /^[a-z]+:/i.test(link)) continue;
    result.checkedLocalLinks++;
    if (fs.existsSync(path.resolve(path.dirname(full), link))) continue;
    if (document === 'public/STUDY_ASSET_SOURCES.md' && fs.existsSync(path.join(root, 'dist', link))) result.buildGeneratedTargets.push(link);
    else result.missingLinks.push({document, link});
  }
}
assert.deepEqual(result.missingLinks, []); result.documents = documents.length;
const files = new Set([__filename, path.join(__dirname, 'run-checks.cjs'), path.join(__dirname, 'suite-adapter.cjs'), path.join(__dirname, 'diagnostic-eight-day-stress.cjs'),
  ...Object.values(run.suites).map(suite => path.join(root, suite.script)),
  ...['lighthouse-finish-2026-10-19/check-journey.cjs', 'lighthouse-d-2026-10-18/browser-harness.cjs',
    'lighthouse-d-2026-10-18/source-loader.cjs', 'day-night-phase4-2026-10-19/browser-harness.cjs',
    'coastal-cliff-d-2026-10-18/serve-dist.py'].map(file => path.resolve(__dirname, '..', file))]);
result.sourceScripts = [...files].sort().map(file => ({path: path.relative(root, file), sha256: sha(fs.readFileSync(file))}));
result.passed = true;
fs.writeFileSync(path.join(__dirname, 'evidence-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({passed: true, suites: result.suites.length, documents: result.documents, checkedLocalLinks: result.checkedLocalLinks, budgets: result.budgets}));
