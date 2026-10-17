const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { hash, verifyFiles, verifySnapshot } = require('../tools/verify-reuse-baseline.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reuse-baseline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), data);
    return { path: file, bytes: Buffer.byteLength(data), sha256: hash(data) };
  };
  return { root, write };
}

test('frozen files reject missing and same-length modified inputs', t => {
  const { root, write } = fixture(t), record = write('source/file.ts', 'original');
  assert.deepEqual(verifyFiles(root, [record]), { files: 1, bytes: 8 });
  write(record.path, 'modified');
  assert.throws(() => verifyFiles(root, [record]), /SHA256 mismatch/);
  fs.unlinkSync(path.join(root, record.path));
  assert.throws(() => verifyFiles(root, [record]), /ENOENT/);
});

test('snapshot paths reject traversal, duplicate entries and symlink parents', t => {
  const { root, write } = fixture(t), record = write('source/file', 'data');
  assert.throws(() => verifyFiles(root, [{ ...record, path: '../file' }]), /Unsafe snapshot path/);
  assert.throws(() => verifyFiles(root, [record, record]), /Duplicate snapshot path/);
  fs.symlinkSync(path.join(root, 'source'), path.join(root, 'alias'));
  assert.throws(() => verifyFiles(root, [{ ...record, path: 'alias/file' }]), /Snapshot symlink/);
});

test('release verification rejects unexpected, changed or omitted delivery files and wrong archive', t => {
  const { root, write } = fixture(t);
  const source = write('src/scene.ts', 'scene');
  const asset = { ...write('public/model.glb', 'model'), id: 'model', releasePath: 'model.glb',
    license: 'unverified', provenanceRecords: ['public/source.json'] };
  write('public/source.json', '{}');
  const inventory = { schemaVersion: 1, sourceCommit: 'revision', baselineId: 'baseline',
    runtimeAssets: [asset], totals: { runtimeFiles: 1, runtimeBytes: 5 } };
  const inventoryRecord = write('inventory.json', JSON.stringify(inventory));
  write('release/model.glb', 'model');
  const archive = write('release.tar.gz', 'archive');
  const baseline = { schemaVersion: 1, id: 'baseline', source: { commit: 'revision' },
    assetInventory: inventoryRecord, frozenInputs: [source], exactSourceDirectories: ['src'],
    release: { files: [{ path: 'model.glb', bytes: 5, sha256: asset.sha256, kind: 'runtime' }],
      metrics: { fileCount: 1, releaseBytes: 5 } }, archive };
  const options = { releaseDirectory: path.join(root, 'release'), archiveFile: path.join(root, archive.path) };
  assert.equal(verifySnapshot(root, baseline, inventory, options).release.files, 1);
  write('src/unlisted.ts', 'unexpected');
  assert.throws(() => verifySnapshot(root, baseline, inventory, options), /Missing or unexpected source files/);
  fs.unlinkSync(path.join(root, 'src/unlisted.ts'));
  write('release/unlisted.js', 'extra');
  assert.throws(() => verifySnapshot(root, baseline, inventory, options), /Missing or unexpected release files/);
  fs.unlinkSync(path.join(root, 'release/unlisted.js'));
  write('release/model.glb', 'other');
  assert.throws(() => verifySnapshot(root, baseline, inventory, options), /SHA256 mismatch/);
  fs.unlinkSync(path.join(root, 'release/model.glb'));
  assert.throws(() => verifySnapshot(root, baseline, inventory, options), /Missing or unexpected release files/);
  write('release/model.glb', 'model'); write(archive.path, 'changed');
  assert.throws(() => verifySnapshot(root, baseline, inventory, options), /Archive SHA256 mismatch/);
});
