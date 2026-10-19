// Final evidence consistency, separate from runtime/browser verification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file)));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=read('run-checks.json');assert.equal(run.passed,true);assert.equal(Object.keys(run.suites).length,11);
for(const [name,suite]of Object.entries(run.suites)){
  assert.equal(suite.passed,true,name);assert.equal(suite.exitCode,0,name);assert.equal(read(suite.result).passed,true,name);
  assert.equal(sha(path.join(root,suite.script)),suite.scriptSha256,name+' executed source matches');
}
for(const source of read('suite-sources.json').scripts)
  assert.equal(sha(path.join(__dirname,'..',source.derivedFrom)),source.inputSha256,source.derivedFrom+' historical source unchanged');
const matrix=read('engines/matrix.json');assert.equal(matrix.availablePlatformsPassed,true);assert.equal(matrix.cases.length,12);
assert.ok(matrix.cases.every(entry=>entry.passed&&entry.nodes.length===8&&entry.automatic.length===3));
const release=read('release-check.json');assert.equal(release.passed,true);assert.equal(release.unchangedReleaseFiles,495);
assert.ok(release.prefixes.every(entry=>entry.passed&&entry.files===495));
const manifest=read('release-manifest.json');
assert.equal(sha(path.join(__dirname,'bundle-analysis.json')),manifest.files.find(file=>file.path==='bundle-analysis.json').sha256);
assert.equal(sha(path.join(__dirname,'release-manifest.json')),sha(path.join(__dirname,'../day-night-phase3-2026-10-19/release-manifest.json')));
const visuals=read('visuals.json'),controls=read('controls.json'),journey=read('journey.json'),recreate=read('recreate.json');
assert.equal(visuals.passed,true);assert.equal(visuals.nodes.length,8);assert.equal(visuals.shadowAnchors.length,32);
assert.equal(journey.routeOut.length,139);assert.equal(journey.routeBack.length,139);assert.equal(journey.gallery.length,32);
assert.ok(journey.cases.timeMenuPause);assert.equal(recreate.cycles.length,3);assert.ok(controls.inspectionPause.resumedOnSecondFrame);
const tests=fs.readFileSync(path.join(__dirname,'tests.log'),'utf8');assert.match(tests,/tests 184/);assert.match(tests,/fail 0/);
const availability=read('platform-availability.json');
const summary={baseline:'69606ac',status:'engineering-and-available-platforms-complete',runtimePackageChanged:false,unitTestsPassed:184,
  browserSuitesPassed:Object.keys(run.suites).length,matrixCases:matrix.cases.length,nodeChecks:96,automaticSegments:36,
  route:{out:139,back:139,gallery:32,storeys:5},recreateCycles:3,
  actualInitialJsBytes:controls.initialJsBytes,initialJsFiles:controls.initialJs.length,release:release.totals,
  scene:visuals.nodes[0].resources,unverifiedPlatforms:{firefox:availability.firefox,safari:availability.safari,physicalDevices:availability.physicalDevices},
  limits:['No physical-device or subjective audio validation','FPS/GPU/load-time experiments remain paused','Neutral single-IBL and local-shadow coverage approximations retained'],
  allAvailableChecksPassed:true};
fs.writeFileSync(path.join(__dirname,'acceptance-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({status:summary.status,suites:summary.browserSuitesPassed,matrixCases:summary.matrixCases,nodeChecks:summary.nodeChecks,automaticSegments:summary.automaticSegments,releaseFiles:release.unchangedReleaseFiles}));
