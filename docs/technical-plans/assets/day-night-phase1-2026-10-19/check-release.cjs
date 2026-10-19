const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {verifyRelease} = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../../dist');
const baseUrl = process.env.STUDY_URL || 'http://127.0.0.1:8192/';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
(async () => {
  const totals = verifyRelease(root), manifestBytes = fs.readFileSync(path.join(root, 'release-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const oldManifest = require('../lighthouse-finish-2026-10-19/release-manifest.json');
  const runtime = m => m.files.filter(f => f.kind === 'runtime').map(f => ({path: f.path, bytes: f.bytes, sha256: f.sha256}));
  assert.deepEqual(runtime(manifest), runtime(oldManifest), 'all 36 downloaded resources retain their bytes and hashes');
  const files = [...manifest.files, {path: 'release-manifest.json', bytes: manifestBytes.length, sha256: sha(manifestBytes)}];
  const result = {baseline: 'af11fae', totals, runtimeUnchanged: true, prefixes: []};
  // Serial requests also cover unused debug/editor chunks and documentation; nothing is hidden.
  for (const prefix of ['', 'home/']) {
    const base = new URL(prefix, baseUrl);
    for (const file of files) {
      const response = await fetch(new URL(file.path, base));
      assert.equal(response.status, 200, `${prefix}${file.path}`);
      const data = Buffer.from(await response.arrayBuffer());
      assert.equal(data.length, file.bytes, `${prefix}${file.path} size`);
      assert.equal(sha(data), file.sha256, `${prefix}${file.path} hash`);
    }
    result.prefixes.push({path: base.pathname, files: files.length, bytes: totals.releaseBytes, passed: true});
  }
  result.passed = true;
  fs.writeFileSync(path.join(__dirname, 'release-check.json'), JSON.stringify(result, null, 2) + '\n');
  fs.copyFileSync(path.join(root, 'release-manifest.json'), path.join(__dirname, 'release-manifest.json'));
  console.log(JSON.stringify(result));
})().catch(error => {console.error(error); process.exitCode = 1;});
