const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f))),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const run=read('run-checks.json');assert.equal(run.passed,true);assert.equal(Object.keys(run.suites).length,7);
for(const item of Object.values(run.suites)){assert.equal(item.passed,true);assert.equal(sha(path.join(root,item.script)),item.scriptSha256);assert.equal(sha(path.join(__dirname,item.result)),item.resultSha256);assert.equal(read(item.result).passed,true);}
for(const [f,digest]of Object.entries(read('source-fingerprints.json')))assert.equal(sha(path.join(root,f)),digest,f);
assert.equal(sha(path.join(root,'dist/release-manifest.json')),run.manifestSha256);assert.equal(sha(path.join(__dirname,'release-manifest.json')),run.manifestSha256);
const discovery=read('discovery/discovery.json'),weather=read('weather/weather.json'),matrix=read('matrix/matrix.json'),release=read('release.json');
assert.equal(discovery.manifestSha256,run.manifestSha256);assert.equal(weather.manifestSha256,run.manifestSha256);assert.equal(matrix.manifestSha256,run.manifestSha256);assert.equal(release.releaseManifestSha256,run.manifestSha256);
assert.equal(discovery.first.d.solar.latest.id,discovery.repeated.d.solar.latest.id);assert.equal(discovery.first.w.random.streams.inspection.draws,1);assert.equal(discovery.second.w.random.streams.inspection.draws,2);assert.equal(discovery.second.d.solar.latest.visit,2);assert.equal(discovery.deep.d.solar.latest.status,'confirmed');assert.equal(discovery.rechecked.d.solar.latest.status,'clear');assert.equal(discovery.saved.weather,'clear');
assert.equal(discovery.errors.length+discovery.warnings.length,0);assert.equal(matrix.errors.length+matrix.warnings.length,0);
for(const page of weather.pages){assert.equal(page.errors.length+page.warnings.length,0);assert.equal(page.initialJsBytes,3054848);assert.ok(page.initialJsBytes<=3*1048576);}
assert.equal(matrix.cases.length,108);assert.ok(matrix.cases.filter(c=>c.clearRepeatDifferences!==undefined).every(c=>c.clearRepeatDifferences===0));
assert.equal(release.unchangedRuntimeFiles,36);assert.ok(release.prefixes.every(p=>p.passed&&p.files===495));assert.ok(release.totals.releaseBytes<=41*1048576);assert.ok(release.totals.runtimeBytes<=16*1048576);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 324/);assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/fail 0/);
const report={passed:true,baseline:'51a626c',manifestSha256:run.manifestSha256,suites:7,tests:324,matrixCases:108,actualInitialJsBytes:3054848,totals:release.totals,sourceFiles:Object.keys(read('source-fingerprints.json')).length};
fs.writeFileSync(path.join(__dirname,'evidence-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
