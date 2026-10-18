// Read-only verification of the frozen scene inputs; does not update snapshots or Git refs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const baselinePath = 'docs/reuse/baselines/2026-10-17-eight-room-v1.json';
const hash = data => createHash('sha256').update(data).digest('hex');

function readBaseline(snapshotRoot, relative = baselinePath) {
  assert.ok(typeof relative === 'string' && relative.startsWith('docs/reuse/baselines/') && relative.endsWith('.json'),
    'Baseline must be a repository-relative JSON under docs/reuse/baselines/');
  return JSON.parse(fs.readFileSync(safeFile(snapshotRoot, relative), 'utf8'));
}

function safeFile(root, relative) {
  assert.ok(typeof relative === 'string' && relative && !relative.includes('\\')
    && !path.isAbsolute(relative) && relative.split('/').every(p => p && p !== '.' && p !== '..'),
  `Unsafe snapshot path: ${relative}`);
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert.ok(!fs.lstatSync(current).isSymbolicLink(), `Snapshot symlink: ${relative}`);
  }
  assert.ok(fs.statSync(current).isFile(), `Not a file: ${relative}`);
  return current;
}

function verifyFiles(root, files) {
  assert.ok(Array.isArray(files) && files.length, 'Empty file snapshot');
  const seen = new Set();
  let bytes = 0;
  for (const file of files) {
    assert.ok(!seen.has(file.path), `Duplicate snapshot path: ${file.path}`);
    seen.add(file.path);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0 && /^[a-f0-9]{64}$/.test(file.sha256),
      `Invalid file record: ${file.path}`);
    const data = fs.readFileSync(safeFile(root, file.path));
    assert.equal(data.length, file.bytes, `Size mismatch: ${file.path}`);
    assert.equal(hash(data), file.sha256, `SHA256 mismatch: ${file.path}`);
    bytes += data.length;
  }
  return { files: files.length, bytes };
}

function listFiles(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), `Release symlink: ${relative}`);
    return entry.isDirectory() ? listFiles(root, relative) : [relative];
  }).sort();
}

function verifySnapshot(root, baseline, inventory, options = {}) {
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.sourceCommit, baseline.source.commit);
  assert.equal(inventory.baselineId, baseline.id);
  verifyFiles(options.snapshotRoot || root, [baseline.assetInventory]);
  const source = verifyFiles(root, baseline.frozenInputs);
  for (const prefix of baseline.exactSourceDirectories || []) {
    assert.deepEqual(listFiles(path.join(root, prefix)).map(file => `${prefix}/${file}`).sort(),
      baseline.frozenInputs.filter(file => file.path.startsWith(`${prefix}/`)).map(file => file.path).sort(),
      `Missing or unexpected source files: ${prefix}`);
  }
  assert.equal(new Set(inventory.runtimeAssets.map(asset => asset.id)).size, inventory.runtimeAssets.length,
    'Duplicate asset ID');
  const runtime = verifyFiles(root, inventory.runtimeAssets);
  assert.equal(runtime.files, inventory.totals.runtimeFiles);
  assert.equal(runtime.bytes, inventory.totals.runtimeBytes);
  assert.deepEqual(inventory.runtimeAssets.map(asset => asset.releasePath).sort(),
    baseline.release.files.filter(file => file.kind === 'runtime').map(file => file.path).sort());
  for (const asset of inventory.runtimeAssets) {
    const released = baseline.release.files.find(file => file.path === asset.releasePath);
    assert.equal(asset.path, `public/${asset.releasePath}`);
    assert.equal(asset.bytes, released.bytes, `Release asset size: ${asset.id}`);
    assert.equal(asset.sha256, released.sha256, `Release asset SHA256: ${asset.id}`);
    assert.ok(asset.license && asset.provenanceRecords.length, `Missing provenance: ${asset.id}`);
    asset.provenanceRecords.forEach(file => safeFile(root, file));
  }
  const result = { baselineId: baseline.id, sourceCommit: baseline.source.commit, source, runtime,
    release: 'not checked; pass --release', archive: 'not checked; pass --archive' };
  if (options.releaseDirectory) {
    assert.deepEqual(listFiles(options.releaseDirectory), baseline.release.files.map(file => file.path).sort(),
      'Missing or unexpected release files');
    result.release = verifyFiles(options.releaseDirectory, baseline.release.files);
    assert.equal(result.release.bytes, baseline.release.metrics.releaseBytes);
    assert.equal(result.release.files, baseline.release.metrics.fileCount);
  }
  if (options.archiveFile) {
    assert.ok(!fs.lstatSync(options.archiveFile).isSymbolicLink(), 'Archive symlink');
    const data = fs.readFileSync(options.archiveFile);
    assert.equal(data.length, baseline.archive.bytes, 'Archive size mismatch');
    assert.equal(hash(data), baseline.archive.sha256, 'Archive SHA256 mismatch');
    result.archive = { bytes: data.length, sha256: hash(data) };
  }
  return result;
}

function verifyBaseline(options = {}) {
  // Metadata belongs to the preparation checkout; --root can be a clean checkout of the older scene tag.
  const snapshotRoot = path.resolve(path.join(__dirname, '..'));
  const root = path.resolve(options.root || snapshotRoot);
  const baseline = readBaseline(snapshotRoot, options.baselinePath);
  assert.match(baseline.source.commit, /^[a-f0-9]{40}$/);
  assert.match(baseline.source.tree, /^[a-f0-9]{40}$/);
  const inventory = JSON.parse(fs.readFileSync(safeFile(snapshotRoot, baseline.assetInventory.path), 'utf8'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('rev-parse', `${baseline.source.commit}^{tree}`), baseline.source.tree, 'Source tree mismatch');
  assert.equal(git('rev-parse', `refs/tags/${baseline.source.tag}^{commit}`), baseline.source.commit,
    'Baseline tag missing or points to another commit');
  const result = verifySnapshot(root, baseline, inventory, { ...options, snapshotRoot });
  result.tag = baseline.source.tag;
  return result;
}

if (require.main === module) {
  try {
    const options = {}, names = { '--root': 'root', '--release': 'releaseDirectory', '--archive': 'archiveFile', '--baseline': 'baselinePath' };
    for (let i = 2; i < process.argv.length; i += 2) {
      const name = names[process.argv[i]], value = process.argv[i + 1];
      assert.ok(name && value && !value.startsWith('--'), 'Usage: node tools/verify-reuse-baseline.cjs [--baseline docs/reuse/baselines/NAME.json] [--root DIR] [--release DIR] [--archive FILE]');
      options[name] = value;
    }
    console.log(JSON.stringify(verifyBaseline(options), null, 2));
  } catch (error) { console.error(`Reuse baseline verification failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { hash, readBaseline, verifyFiles, verifySnapshot, verifyBaseline };
