// Independent dist-only HTTP and subpath verification; no timing/FPS claims.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { verifyRelease } = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../..');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8160/';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
(async () => {
  const metrics = verifyRelease(path.join(root, 'dist'));
  const manifestData = fs.readFileSync(path.join(root, 'dist/release-manifest.json'));
  const manifest = JSON.parse(manifestData);
  const files = [...manifest.files, { path: 'release-manifest.json', bytes: manifestData.length, sha256: sha(manifestData) }];
  const result = { baseline: 'd1ae3a1 + stage D', url, metrics, deployments: [], fpsOrLoadTimeSampling: false };
  for (const prefix of ['', 'home/']) {
    let cursor = 0, checked = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (cursor < files.length) {
        const file = files[cursor++], response = await fetch(new URL(prefix + file.path, url));
        assert.equal(response.status, 200, prefix + file.path);
        const data = Buffer.from(await response.arrayBuffer());
        assert.equal(data.length, file.bytes, prefix + file.path + ': bytes');
        assert.equal(sha(data), file.sha256, prefix + file.path + ': SHA256');
        checked++;
      }
    }));
    const index = await fetch(new URL(prefix, url));
    assert.equal(index.status, 200);
    assert.equal(sha(Buffer.from(await index.arrayBuffer())), files.find(f => f.path === 'index.html').sha256);
    for (const absent of ['textures/study/forest-window/panorama.jpg', 'models/barrel.glb'])
      assert.equal((await fetch(new URL(prefix + absent, url))).status, 404, 'no public fallback');
    result.deployments.push({ prefix: '/' + prefix, files: checked, sha256: 'all matched', htmlDirectoryIndex: true, unlistedPublicFallback: false });
  }
  fs.writeFileSync(path.join(__dirname, 'release-check.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
