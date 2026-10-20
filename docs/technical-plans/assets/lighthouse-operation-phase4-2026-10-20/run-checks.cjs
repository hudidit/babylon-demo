// Serial browser runs bind new evidence to one immutable, independently served production build.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jobs = [
  ['browser', 'browser/browser.json'], ['subpath', 'subpath/browser.json', 'browser'],
  ['journey', 'journey/journey.json'], ['matrix', 'matrix/matrix.json'],
  ['regression', 'regression/regression.json'], ['master-mirror', 'master-mirror/mirror-map.json'],
  ['public-mirror', 'public-mirror/public-mirror.json'], ['curtains', 'curtains/browser.json'],
  ['ceiling', 'ceiling/browser.json'], ['scooter', 'scooter/browser.json'], ['headlight', 'headlight/browser.json'],
  ['continuity', 'continuity/continuity.json'], ['lifecycle', 'lifecycle/lifecycle.json'], ['recreate', 'recreate/recreate.json'],
  ['platforms', 'platforms/platform-availability.json'], ['release', 'release.json'],
];
exports.jobs = jobs;
if (require.main === module) (async () => {
  const manifestSha256 = sha(fs.readFileSync(path.join(root, 'dist/release-manifest.json')));
  const resultFile = path.join(__dirname, 'run-checks.json'), only = new Set(process.argv.slice(2));
  for (const name of only) assert.ok(jobs.some(job => job[0] === name), 'Unknown suite ' + name);
  const record = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile)) :
    {baseline: '8aea9e9', manifestSha256, fpsOrLoadTimeSampling: false, suites: {}};
  assert.equal(record.manifestSha256, manifestSha256, 'New dist requires fresh evidence');
  for (const [name, result, alias] of jobs) {
    if (only.size && !only.has(name)) continue;
    assert.equal(sha(fs.readFileSync(path.join(root, 'dist/release-manifest.json'))), manifestSha256);
    const output = path.join(__dirname, path.dirname(result)); fs.mkdirSync(output, {recursive: true});
    const direct = ['continuity', 'release'].includes(name);
    const script = direct ? path.join(__dirname, 'check-' + name + '.cjs') : path.join(__dirname, 'suite-adapter.cjs');
    const sourceSuite = direct ? script : path.resolve(__dirname, '..', require('./suite-adapter.cjs').suites[alias || name][0]);
    const logfile = path.join(__dirname, name + '.log'), fd = fs.openSync(logfile, 'w');
    console.log('START ' + name);
    let exitCode;
    try {
      const base = process.env.STUDY_URL || 'http://127.0.0.1:8217/';
      exitCode = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...(direct ? [] : [alias || name])], {cwd: root,
          env: {...process.env, STUDY_URL: name === 'subpath' ? new URL('home/', base).href : base, STUDY_CHECK_OUTPUT: output},
          stdio: ['ignore', fd, fd]});
        child.once('error', reject); child.once('exit', resolve);
      });
    } finally {fs.closeSync(fd);}
    const file = path.join(__dirname, result), item = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
    const passed = exitCode === 0 && !!item && (name === 'platforms' ? !!item.firefox && !!item.safari : item.passed === true);
    if (item) {
      item.sourceBaseline = item.sourceBaseline || item.baseline; item.baseline = record.baseline;
      item.releaseManifestSha256 = manifestSha256;
      fs.writeFileSync(file, JSON.stringify(item, null, 2) + '\n');
    }
    record.suites[name] = {script: path.relative(root, sourceSuite), scriptSha256: sha(fs.readFileSync(sourceSuite)),
      adapterSha256: sha(fs.readFileSync(script)), result, log: path.basename(logfile), exitCode, passed,
      ...(item ? {resultSha256: sha(fs.readFileSync(file))} : {})};
    record.passed = jobs.every(([key]) => record.suites[key]?.passed);
    fs.writeFileSync(resultFile, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({suite: name, exitCode, passed}));
    assert.ok(passed, name + ' failed; see ' + logfile);
    assert.equal(sha(fs.readFileSync(path.join(root, 'dist/release-manifest.json'))), manifestSha256);
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
