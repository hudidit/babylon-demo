const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./study-release.config.cjs');
const { hash } = require('./StudyReleasePlugin.cjs');
const { readGlb } = require('./optimize-study-models.cjs');

function listFiles(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${file}`);
    return entry.isDirectory() ? listFiles(root, file) : [file];
  }).sort();
}

function verifyRelease(directory) {
  const root = path.resolve(directory);
  const manifestData = fs.readFileSync(path.join(root, 'release-manifest.json'));
  const manifest = JSON.parse(manifestData);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.mode, 'production');
  assert.deepEqual(manifest.budgets, config.budgets, 'Budget changes require an explicit config update');
  const records = new Map(manifest.files.map(file => [file.path, file]));
  assert.equal(records.size, manifest.files.length, 'Duplicate manifest path');
  assert.deepEqual(listFiles(root), [...records.keys(), 'release-manifest.json'].sort(), 'Missing or unexpected release files');
  const expectedDocs = [...config.documentation, ...config.libraryNotices.map(item => item.file)].sort();
  for (const [kind, expected] of [['runtime', config.runtime], ['documentation', expectedDocs]]) {
    assert.deepEqual(manifest.files.filter(file => file.kind === kind).map(file => file.path).sort(), [...expected].sort(), `${kind} whitelist mismatch`);
  }
  const totals = { build: 0, runtime: 0, documentation: 0 };
  for (const file of manifest.files) {
    assert.ok(typeof file.path === 'string' && !file.path.includes('\\') && !file.path.startsWith('/') &&
      file.path.split('/').every(part => part && part !== '.' && part !== '..'), `Unsafe release path: ${file.path}`);
    assert.ok(Object.hasOwn(totals, file.kind), `Unknown file kind: ${file.kind}`);
    if (file.kind === 'build') assert.ok(file.path === 'index.html' || /^js\/[\w.-]+\.js(?:\.LICENSE\.txt)?$/.test(file.path), `Unexpected build output: ${file.path}`);
    const data = fs.readFileSync(path.join(root, file.path));
    assert.equal(data.length, file.bytes, `Size mismatch: ${file.path}`);
    assert.equal(hash(data), file.sha256, `SHA256 mismatch: ${file.path}`);
    totals[file.kind] += data.length;
    if (file.path.endsWith('.glb')) {
      const { document } = readGlb(data);
      // Current models are self-contained. A future external dependency/decoder must be reviewed and whitelisted.
      for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
        assert.ok(!resource.uri || resource.uri.startsWith('data:'), `Unlisted GLB dependency: ${file.path} -> ${resource.uri}`);
      }
      assert.deepEqual(document.extensionsRequired || [], [], `Review required GLB extensions/decoders: ${file.path}`);
    }
  }
  assert.deepEqual(manifest.totals, totals, 'Manifest totals mismatch');
  assert.ok(manifest.entryFiles.length && manifest.chunkFiles.length > manifest.entryFiles.length, 'Expected entry and lazy debug chunks');
  for (const file of [...manifest.entryFiles, ...manifest.chunkFiles]) {
    assert.equal(records.get(file)?.kind, 'build', `Missing entry or dynamic chunk: ${file}`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // Production HTML minification can remove attribute quotes.
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)]
    .map(match => (match[1] || match[2] || match[3]).replace(/^\.\//, ''));
  assert.ok(scripts.length, 'Missing HTML script entry');
  assert.deepEqual(scripts.sort(), [...manifest.entryFiles].sort(), 'HTML script entries must match the build');
  const modelBytes = config.optimizedModels.reduce((sum, file) => sum + records.get(file).bytes, 0);
  const releaseBytes = Object.values(totals).reduce((sum, bytes) => sum + bytes, 0) + manifestData.length;
  assert.ok(modelBytes <= config.budgets.models, 'Model budget exceeded');
  assert.ok(totals.runtime <= config.budgets.runtime, 'Runtime budget exceeded');
  assert.ok(releaseBytes <= config.budgets.release, 'Release budget exceeded');
  return { fileCount: manifest.files.length + 1, modelBytes, buildBytes: totals.build,
    runtimeBytes: totals.runtime, documentationBytes: totals.documentation, manifestBytes: manifestData.length, releaseBytes };
}

if (require.main === module) {
  try { console.log(JSON.stringify(verifyRelease(process.argv[2] || 'dist'), null, 2)); }
  catch (error) { console.error(`Release verification failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { verifyRelease, listFiles };
