// Capture a NEW immutable identity. Never refresh an existing inventory/baseline in place.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { hash } = require('../../../../tools/verify-reuse-baseline.cjs');
const { verifyRelease } = require('../../../../tools/verify-study-release.cjs');
const root = path.resolve(__dirname, '../../../..');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const id = '2026-10-18-coastal-cliff-v1', commit = git('rev-parse', 'd1ae3a1^{commit}');
const inventoryPath = `docs/reuse/coastal-asset-inventory.json`, baselinePath = `docs/reuse/baselines/${id}.json`;
assert.ok(!fs.existsSync(path.join(root, inventoryPath)) && !fs.existsSync(path.join(root, baselinePath)), 'Snapshot already exists: create a new version');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const stat = relative => { const data = fs.readFileSync(path.join(root, relative)); return { path: relative, bytes: data.length, sha256: hash(data) }; };
const config = require('../../../../tools/study-release.config.cjs');
const metrics = verifyRelease(path.join(root, 'dist')), release = read('dist/release-manifest.json');
const old = read('docs/reuse/asset-inventory.json'), coastal = read('public/textures/coastal/source.json');
const inventory = { ...old, baselineId: id, sourceCommit: commit, capturedOn: '2026-10-18',
  scope: 'Coastal cliff eight-room scene including south bedroom window, translucent overview, furniture jumping and window reveal fix; independent of forest v1',
  runtimeAssets: old.runtimeAssets.filter(a => config.runtime.includes(a.releasePath)) };
for (const file of coastal.files) {
  const generated = !file.input;
  inventory.runtimeAssets.push({ ...stat('public/' + file.file), releasePath: file.file, version: 'coastal-cliff-v1',
    id: generated ? 'environment.coastal-daylight' : 'texture.coastal.' + file.output.replace('.jpg', '').replace('-', '.'),
    kind: generated ? 'environment' : 'texture', role: file.semantic,
    license: { status: generated ? 'project-authored' : 'recorded', identifier: generated ? 'ISC' : file.license,
      review: 'retained locked provenance; no new upstream audit' },
    provenanceRecords: ['public/STUDY_ASSET_SOURCES.md', 'public/textures/coastal/source.json', 'public/environment/coastal-cliff-source.json'],
    source: file, consumers: [generated ? 'src/examples/CoastalMaterials.ts' : 'src/examples/CoastalMaterials.ts'],
    sharing: 'one shared coast per scene; keep linear data/sRGB albedo and original channel semantics; dispose at last owner' });
}
inventory.runtimeAssets.sort((a,b) => a.id.localeCompare(b.id));
inventory.totals = { ...old.totals, runtimeFiles: inventory.runtimeAssets.length, runtimeBytes: inventory.runtimeAssets.reduce((n,a) => n+a.bytes, 0) };
assert.equal(inventory.totals.runtimeFiles, 36); assert.equal(inventory.totals.runtimeBytes, metrics.runtimeBytes);
inventory.codeComponents.find(c => c.id === 'code.architecture').files.push('src/examples/HouseJump.ts');
const coastSources = ['CoastalCliff','CoastalMaterials','CoastalScatter','CoastalSky','CoastalOcean'].map(n => `src/examples/${n}.ts`);
inventory.codeComponents.find(c => c.id === 'code.visual').files.push(...coastSources);
inventory.generatedResources = { ...old.generatedResources, sources: [...old.generatedResources.sources, ...coastSources],
  oceanField: { size: [256,256], format: 'linear RGBA8; signed distance and approximate seabed', bytesWithoutMipmaps: 262144, downloadBytes: 0 } };
inventory.processingTools = old.processingTools.filter(p => !p.includes('forest')).concat(['tools/prepare-coastal-materials.py','tools/coastal-material-inputs.json']);
inventory.deliverySupport = { ...old.deliverySupport, documentation: config.documentation.map(p => `public/${p}`) };
inventory.historicalAcceptance = 'docs/technical-plans/assets/coastal-cliff-c-2026-10-17/README.md';
inventory.currentAcceptance = 'docs/technical-plans/assets/coastal-cliff-d-2026-10-18/README.md';
const inventoryData = Buffer.from(JSON.stringify(inventory, null, 2) + '\n');
const taggedFiles = git('ls-tree','-r','--name-only',commit).split('\n');
const inputs = taggedFiles.filter(file => /^(src\/|tests\/|tools\/|assets\/audio-source\/)/.test(file)
  && !['tools/verify-reuse-baseline.cjs','tests/reuse-baseline.test.cjs'].includes(file));
inputs.push('.editorconfig','package.json','package-lock.json','tsconfig.json','webpack.config.js','public/index.html',
  ...config.runtime.map(p => 'public/' + p), ...config.documentation.map(p => 'public/' + p));
const frozenInputs = [...new Set(inputs)].sort().map(file => {
  const result = stat(file), original = execFileSync('git', ['-C', root, 'show', `${commit}:${file}`], { maxBuffer: 64 * 1048576 });
  assert.equal(result.sha256, hash(original), `Source differs from frozen commit: ${file}`); return result;
});
const files = [...release.files, { ...stat('dist/release-manifest.json'), path: 'release-manifest.json', kind: 'manifest' }].sort((a,b)=>a.path.localeCompare(b.path));
const archive = read('docs/technical-plans/assets/coastal-cliff-d-2026-10-18/archive.json');
const baseline = { schemaVersion: 1, id, capturedOn: '2026-10-18', status: 'frozen coastal runtime; acceptance limits in evidence; no generic SDK',
  source: { commit, tree: git('rev-parse', `${commit}^{tree}`), tag: `scene-baseline/${id}`, repository: 'git@github.com:hudidit/babylon-demo.git',
    preparationCommit: 'separate verification/docs commit; find via Git history of this baseline' },
  environment: { node: process.version, npm: execFileSync('npm',['--version'],{encoding:'utf8'}).trim(), platform: process.platform, architecture: process.arch,
    babylon: '9.30.0', typescript: '5.9.3', webpack: '5.111.1' },
  assetInventory: { path: inventoryPath, bytes: inventoryData.length, sha256: hash(inventoryData) }, exactSourceDirectories: ['src'],
  frozenInputPolicy: 'All src, scene build/resource tools, scene tests, original audio, root build/dependency inputs and active public whitelist at runtime tag; snapshot verifier/tests and new evidence/docs are separate preparation files. Unrelated untracked files excluded.',
  frozenInputs, release: { metrics, files }, archive,
  evidence: { current: inventory.currentAcceptance, historicalCoastal: inventory.historicalAcceptance,
    measurementBoundary: 'Functional/WebGL/request bytes only; physical devices, listening, FPS/load-time/VRAM excluded unless separately evidenced' },
  unresolved: ['Three historical assets remain license-unverified','Local binary archive has not been backed up remotely','Generic SDK and next project are not implemented','Physical mobile/device listening and paused performance experiments are not completed by browser emulation'] };
fs.writeFileSync(path.join(root, inventoryPath), inventoryData, { flag: 'wx' });
fs.writeFileSync(path.join(root, baselinePath), JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ id, commit, frozenInputs: frozenInputs.length, assets: inventory.totals.runtimeFiles, releaseFiles: files.length }));
