const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {verifyRelease} = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../../dist'), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const totals = verifyRelease(root), raw = fs.readFileSync(path.join(root, 'release-manifest.json')), manifest = JSON.parse(raw);
  const previousRaw = fs.readFileSync(path.join(__dirname, '../lighthouse-operation-phase3-2026-10-20/release-manifest.json'));
  assert.deepEqual(raw, previousRaw, 'Final production manifest must reproduce the phase3 delivery');
  const files = [...manifest.files, {path: 'release-manifest.json', bytes: raw.length, sha256: sha(raw)}];
  const record = {baseline: '8aea9e9', totals, unchangedRuntimeFiles: manifest.files.filter(f => f.kind === 'runtime').length,
    identicalToPhase3: true, manifestSha256: sha(raw), prefixes: []};
  for (const prefix of ['', 'home/']) {
    const base = new URL(prefix, process.env.STUDY_URL || 'http://127.0.0.1:8217/');
    for (const file of files) {
      const response = await fetch(new URL(file.path, base)); assert.equal(response.status, 200, file.path);
      const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha(bytes), file.sha256, file.path);
    }
    record.prefixes.push({path: base.pathname, files: files.length, passed: true});
  }
  for (const name of ['release-manifest.json', 'bundle-analysis.json']) fs.copyFileSync(path.join(root, name), path.join(__dirname, name));
  record.passed = true; fs.writeFileSync(path.join(__dirname, 'release.json'), JSON.stringify(record, null, 2) + '\n'); console.log(JSON.stringify(record));
})().catch(error => {console.error(error); process.exitCode = 1;});
