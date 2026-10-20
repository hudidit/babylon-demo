const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const documents = ['CHANGELOG.md', 'docs/technical-plans/README.md',
  'docs/technical-plans/2026-10-20-lighthouse-project-01-core-loop.md',
  'docs/technical-plans/2026-10-20-lighthouse-operation-and-keeper-routine.md',
  path.relative(root, path.join(__dirname, 'README.md')), 'public/STUDY_ASSET_SOURCES.md'];
const result = {documents: documents.length, checkedLocalLinks: 0, buildGeneratedTargets: [], missingLinks: [],
  manifestAndAnalysisMatchDist: false, sixFinalSuitesPassed: false};
for (const document of documents) {
  const full = path.join(root, document), text = fs.readFileSync(full, 'utf8');
  for (const [, raw] of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link = decodeURIComponent(raw.replace(/^<|>$/g, '').split('#')[0].split('?')[0]);
    if (!link || /^[a-z]+:/i.test(link)) continue;
    result.checkedLocalLinks++;
    if (fs.existsSync(path.resolve(path.dirname(full), link))) continue;
    if (document === 'public/STUDY_ASSET_SOURCES.md' && fs.existsSync(path.join(root, 'dist', link))) result.buildGeneratedTargets.push(link);
    else result.missingLinks.push({document, target: link});
  }
}
assert.deepEqual(result.missingLinks, []);
for (const name of ['release-manifest.json', 'bundle-analysis.json']) {
  assert.deepEqual(fs.readFileSync(path.join(__dirname, name)), fs.readFileSync(path.join(root, 'dist', name)));
}
result.manifestAndAnalysisMatchDist = true;
for (const file of ['browser.json', 'subpath/browser.json', 'journey/journey.json', 'engines/matrix.json', 'regression/regression.json', 'release.json']) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, file))).passed, true, file);
}
result.sixFinalSuitesPassed = true;
fs.writeFileSync(path.join(__dirname, 'documentation-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
