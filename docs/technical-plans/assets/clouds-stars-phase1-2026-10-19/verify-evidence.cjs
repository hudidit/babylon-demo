// Read-only consistency checks; writes only this task's acceptance summary.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name)));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=read('browser.json'),matrix=read('matrix.json'),release=read('release-check.json'),regression=read('regression.json');
const implementation=read('implementation.json'),platforms=read('platform-availability.json'),manifest=read('release-manifest.json');
for(const file of implementation.sourceFiles)assert.equal(sha(path.join(root,file.path)),file.sha256,file.path);
assert.equal(sha(path.join(root,implementation.regressionSuite.path)),implementation.regressionSuite.sha256);
assert.equal(sha(path.join(root,'dist/release-manifest.json')),sha(path.join(__dirname,'release-manifest.json')));
for(const result of [browser,matrix,release,regression])assert.equal(result.passed,true);
assert.equal(matrix.cases.length,12);assert.equal(matrix.cases.reduce((n,c)=>n+c.nodes.length,0),48);
for(const c of matrix.cases){assert.equal(c.passed,true);assert.deepEqual(c.errors,[]);assert.deepEqual(c.warnings,[]);assert.deepEqual(c.failed,[]);}
assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.warnings,[]);assert.equal(browser.initialJs.length,12);
assert.equal(browser.initialJsBytes,2897086+release.staticInitialJsDelta);
assert.ok(browser.initialJsBytes<=3*1048576);assert.ok(browser.initialJsBytes-2897086<=24*1024);
assert.equal(browser.transitions.length,25);assert.equal(browser.retarget.passed,true);assert.equal(browser.inspectorLoaded,true);
assert.ok(browser.starPixels.night.changedPixels>20);assert.equal(browser.starPixels.night.repeatDifferences,0);
assert.equal(browser.starPixels.day.changedPixels,0);assert.equal(browser.starPixels.belowHorizon.changedPixels,0);
assert.deepEqual(regression.errors,[]);assert.deepEqual(regression.warnings,[]);
assert.equal(release.unchangedRuntimeFiles,36);assert.equal(release.prefixes.length,2);assert.equal(release.totals.fileCount,495);
assert.equal(manifest.files.length+1,495);assert.ok(release.totals.releaseBytes<=41*1048576);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 186/);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/fail 0/);
assert.match(fs.readFileSync(path.join(__dirname,'development-build.log'),'utf8'),/compiled successfully/);
assert.match(fs.readFileSync(path.join(__dirname,'production-build.log'),'utf8'),/compiled with 3 warnings/);
const summary={baseline:'bea1db6',passed:true,tests:186,browser:browser.browser,matrixCases:12,fourNodeChecks:48,
  resources:browser.nodes[0].resources,starPixels:browser.starPixels,staticInitialJsBytes:release.staticInitialJsBytes,
  actualInitialJsBytes:browser.initialJsBytes,actualInitialJsFiles:browser.initialJs.length,jsDelta:release.staticInitialJsDelta,
  releaseBytes:release.totals.releaseBytes,releaseDelta:release.releaseDelta,runtimeBytes:release.totals.runtimeBytes,
  modelBytes:release.totals.modelBytes,releasePrefixes:release.prefixes,unchangedRuntimeFiles:36,
  regression:{drawers:regression.drawers.length,lamps:regression.lamps.length,doors:regression.doors.length,checks:regression.regression},
  sourceFiles:implementation.sourceFiles,platforms,remaining:['Ocean cloud reflection and star filtering','Double-mirror cloud/star visual acceptance',
    'Eight nodes and six views, full slow-turn/zoom continuity, automatic/pause/whole-route/recreation acceptance','Firefox, Safari and physical devices'],
  fpsGpuOrLoadTimeMeasurements:false};
fs.writeFileSync(path.join(__dirname,'acceptance-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({passed:true,tests:186,matrixCases:12,actualInitialJsBytes:browser.initialJsBytes,releaseBytes:release.totals.releaseBytes}));
