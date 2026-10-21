const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name)));
const manifestSha256=sha(fs.readFileSync(path.join(root,'dist/release-manifest.json')));
const browser=json('after/browser.json'),matrix=json('matrix/matrix.json'),release=json('release.json'),regression=json('regression/regression.json'),recreate=json('recreate/recreate.json');
for(const r of [browser,matrix,release,regression,recreate])assert.equal(r.passed,true);
assert.equal(browser.manifestSha256,manifestSha256);assert.equal(matrix.manifestSha256,manifestSha256);assert.equal(release.releaseManifestSha256,manifestSha256);
assert.equal(sha(fs.readFileSync(path.join(__dirname,'release-manifest.json'))),manifestSha256);
assert.equal(matrix.cases.length,48);assert.equal(recreate.cycles.length,3);
assert.equal(browser.firstScreenJs.bytes,3062443);assert.ok(browser.firstScreenJs.bytes<=3*1048576);
assert.equal(release.totals.initialJsBytes,2843591);assert.equal(release.totals.releaseBytes,42510439);
assert.equal(regression.release.bytes,release.totals.releaseBytes);assert.equal(regression.initialJsBytes,browser.firstScreenJs.bytes);
assert.ok(release.prefixes.every(p=>p.passed&&p.files===495));assert.equal(release.unchangedRuntimeFiles,36);
assert.equal(browser.pausedAndResumed,true);assert.equal(browser.dayTest,true);assert.ok(browser.seaLight.changedChannels>100);assert.ok(browser.seaLight.maxDifference>20);
for(const r of [browser,matrix,regression,recreate])assert.deepEqual(r.errors,[]);
const sources=['src/examples/LighthouseBeam.ts','src/examples/LighthouseBeacon.ts','src/examples/CoastalOcean.ts','src/examples/RoomExterior.ts','tests/lighthouse-beacon.test.cjs'];
const scripts=['check-browser.cjs','check-matrix.cjs','check-release.cjs','verify-evidence.cjs'];
const results=['after/browser.json','matrix/matrix.json','release.json','regression/regression.json','recreate/recreate.json'];
const record={baseline:'c9a2807',manifestSha256,node:process.version,
  sourceFingerprints:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),
  scriptFingerprints:Object.fromEntries(scripts.map(p=>[p,sha(fs.readFileSync(path.join(__dirname,p)))])),
  resultFingerprints:Object.fromEntries(results.map(p=>[p,sha(fs.readFileSync(path.join(__dirname,p)))])),
  suites:{browser:true,matrixCases:matrix.cases.length,releasePrefixes:release.prefixes,regression:true,recreateCycles:recreate.cycles.length},passed:true};
fs.writeFileSync(path.join(__dirname,'evidence-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({passed:true,manifestSha256}));
