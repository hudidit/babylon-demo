const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const config = require('../tools/study-release.config.cjs');
const { StudyReleasePlugin, hash } = require('../tools/StudyReleasePlugin.cjs');
const { verifyRelease } = require('../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '..');

function compile(options) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(options);
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError) reject(error || closeError);
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
      else resolve(stats);
    }));
  });
}

test('production packaging includes exact study assets, license sidecars and lazy chunks; rejects broken releases', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-release-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const output = path.join(temporary, 'output');
  fs.writeFileSync(path.join(temporary, 'entry.js'), 'document.body.onclick = () => import("./lazy.js").then(m => console.log(m.value));');
  fs.writeFileSync(path.join(temporary, 'lazy.js'), '/*! @license Fixture notice */\nexport const value = "debug fixture";');
  const options = {
    context: root, mode: 'production', entry: path.join(temporary, 'entry.js'),
    output: { path: output, filename: 'js/main.js', chunkFilename: 'js/[id].js' },
    plugins: [new HtmlWebpackPlugin({ templateContent: '<!doctype html><html><body>Fixture</body></html>' }),
      new webpack.BannerPlugin({ banner: '/*! @license Fixture notice */', raw: true }), new StudyReleasePlugin()],
  };
  await compile(options);
  const manifestFile = path.join(output, 'release-manifest.json');
  const originalManifest = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(originalManifest);
  const updateManifest = updated => fs.writeFileSync(manifestFile, JSON.stringify(updated, null, 2) + '\n');

  await t.test('whitelist matches measured runtime assets, copied bytes and full compiled output', () => {
    const baseline = require('../docs/technical-plans/assets/resource-baseline-2026-10-15/files.json');
    assert.deepEqual([...config.runtime].sort(), baseline.assets.map(file => file.path.replace(/^public\//, '')).sort());
    const summary = verifyRelease(output);
    assert.equal(summary.runtimeBytes, 15871062);
    assert.equal(summary.modelBytes, 4332840);
    assert.ok(manifest.files.some(file => file.path.endsWith('.LICENSE.txt')));
    assert.ok(manifest.chunkFiles.length > manifest.entryFiles.length);
    for (const file of config.runtime) {
      assert.equal(hash(fs.readFileSync(path.join(output, file))), hash(fs.readFileSync(path.join(root, 'public', file))));
    }
    assert.ok(!manifest.files.some(file => file.path.includes('barrel.glb') || file.path.includes('screenshots')));
  });
  await t.test('missing lazy chunk is rejected', () => {
    const file = manifest.chunkFiles.find(file => !manifest.entryFiles.includes(file));
    const target = path.join(output, file), data = fs.readFileSync(target);
    fs.unlinkSync(target);
    try { assert.throws(() => verifyRelease(output), /Missing or unexpected/); }
    finally { fs.writeFileSync(target, data); }
  });
  await t.test('extra example asset or stale build file is rejected', () => {
    const target = path.join(output, 'models/barrel.glb');
    fs.writeFileSync(target, 'unlisted');
    try { assert.throws(() => verifyRelease(output), /Missing or unexpected/); }
    finally { fs.unlinkSync(target); }
  });
  await t.test('same-size resource corruption is rejected by SHA256', () => {
    const target = path.join(output, 'textures/pictures/pic1.jpg'), data = fs.readFileSync(target);
    const corrupted = Buffer.from(data); corrupted[20] ^= 1;
    fs.writeFileSync(target, corrupted);
    try { assert.throws(() => verifyRelease(output), /SHA256 mismatch/); }
    finally { fs.writeFileSync(target, data); }
  });
  await t.test('GLB external dependencies require a whitelist review even when manifest hash is updated', () => {
    const target = path.join(output, 'models/gothic_commode.glb'), data = fs.readFileSync(target);
    const doc = { asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], images: [{ uri: 'missing.jpg' }] };
    const json = Buffer.from(JSON.stringify(doc));
    const padding = (4 - json.length % 4) % 4;
    const glb = Buffer.alloc(20 + json.length + padding + 12);
    glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
    glb.writeUInt32LE(json.length + padding, 12); glb.write('JSON', 16); json.copy(glb, 20);
    glb.fill(32, 20 + json.length, 20 + json.length + padding);
    glb.writeUInt32LE(4, 20 + json.length + padding); glb.write('BIN\0', 24 + json.length + padding);
    const updated = JSON.parse(originalManifest), record = updated.files.find(file => file.path === 'models/gothic_commode.glb');
    record.bytes = glb.length; record.sha256 = hash(glb);
    fs.writeFileSync(target, glb); updateManifest(updated);
    try { assert.throws(() => verifyRelease(output), /Unlisted GLB dependency/); }
    finally { fs.writeFileSync(target, data); fs.writeFileSync(manifestFile, originalManifest); }
  });
  await t.test('production mode and fixed budgets cannot silently change', () => {
    const updated = JSON.parse(originalManifest); updated.budgets.release *= 2; updateManifest(updated);
    try { assert.throws(() => verifyRelease(output), /Budget changes/); }
    finally { fs.writeFileSync(manifestFile, originalManifest); }
  });
  await t.test('oversized initial JS is rejected even with consistent hashes and totals', () => {
    const bundlePath = path.join(output, 'bundle-analysis.json');
    const originalBundle = fs.readFileSync(bundlePath), bundle = JSON.parse(originalBundle);
    const main = manifest.entryFiles[0], target = path.join(output, main), originalJs = fs.readFileSync(target);
    const padding = bundle.initialJsBudgetBytes + 1 - bundle.initialJsBytes;
    const expanded = Buffer.concat([originalJs, Buffer.alloc(padding, 32)]);
    const updated = JSON.parse(originalManifest), jsRecord = updated.files.find(file => file.path === main);
    jsRecord.bytes = expanded.length; jsRecord.sha256 = hash(expanded);
    updated.totals.build += padding;
    bundle.initialJsBytes += padding;
    const bundleData = Buffer.from(JSON.stringify(bundle, null, 2) + '\n');
    const bundleRecord = updated.files.find(file => file.path === 'bundle-analysis.json');
    updated.totals.build += bundleData.length - bundleRecord.bytes;
    bundleRecord.bytes = bundleData.length; bundleRecord.sha256 = hash(bundleData);
    fs.writeFileSync(target, expanded); fs.writeFileSync(bundlePath, bundleData); updateManifest(updated);
    try { assert.throws(() => verifyRelease(output), /Initial JS budget exceeded/); }
    finally { fs.writeFileSync(target, originalJs); fs.writeFileSync(bundlePath, originalBundle); fs.writeFileSync(manifestFile, originalManifest); }
  });
  await t.test('missing white-listed source fails compilation', async () => {
    await assert.rejects(compile({ ...options, context: temporary, output: { ...options.output, path: path.join(temporary, 'missing-source') } }), /ENOENT/);
  });
  verifyRelease(output);
});
