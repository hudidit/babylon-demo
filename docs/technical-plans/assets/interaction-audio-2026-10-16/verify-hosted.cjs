const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const base = process.env.STUDY_URL || 'http://127.0.0.1:8095/';
(async () => {
  const response = await fetch(base + 'release-manifest.json'); assert.equal(response.status, 200);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(data), hash(fs.readFileSync(path.join(__dirname, '../../../../dist/release-manifest.json'))));
  const manifest = JSON.parse(data), files = [];
  // Ordinary Python static hosting has a small connection backlog; validate sequentially without special routes.
  for (const row of manifest.files) {
    const result = await fetch(base + row.path); assert.equal(result.status, 200, row.path);
    const bytes = Buffer.from(await result.arrayBuffer());
    assert.equal(bytes.length, row.bytes, row.path); assert.equal(hash(bytes), row.sha256, row.path);
    files.push(row.path);
  }
  const record = { passed: true, baseUrl: base, fileCount: files.length + 1,
    method: 'GET and SHA256 for all manifest entries plus manifest', releaseManifestSha256: hash(data),
    releaseBytes: manifest.files.reduce((sum, row) => sum + row.bytes, 0) + data.length, files };
  fs.writeFileSync(path.join(__dirname, 'hosted-release.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ ...record, files: files.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
