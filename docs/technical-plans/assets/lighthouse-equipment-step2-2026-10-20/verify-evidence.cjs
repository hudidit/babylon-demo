const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file))),digest=file=>sha(fs.readFileSync(file));
const {jobs}=require('./run-checks.cjs');
const manifest=fs.readFileSync(path.join(root,'dist/release-manifest.json')),manifestSha256=sha(manifest),release=read('release.json'),runs=read('run-checks.json');
// Reset a previous report before checking; its self-link exists but cannot claim success early.
fs.writeFileSync(path.join(__dirname,'evidence-check.json'),JSON.stringify({passed:false,manifestSha256,checking:true},null,2)+'\n');
assert.equal(runs.manifestSha256,manifestSha256);assert.equal(runs.passed,true);assert.equal(release.releaseManifestSha256,manifestSha256);
assert.equal(digest(path.join(__dirname,'release-manifest.json')),manifestSha256);
assert.equal(digest(path.join(__dirname,'bundle-analysis.json')),digest(path.join(root,'dist/bundle-analysis.json')));
for(const [name,file,direct]of jobs){
 const suite=runs.suites[name],result=read(file);assert.equal(suite.passed,true,name);assert.equal(suite.exitCode,0,name);assert.equal(result.passed,true,name);
 assert.equal(result.releaseManifestSha256,manifestSha256,name);assert.equal(suite.resultSha256,digest(path.join(__dirname,file)),name);
 assert.equal(suite.scriptSha256,digest(path.join(root,suite.script)),name);
 assert.equal(suite.adapterSha256,digest(path.join(__dirname,direct||'suite-adapter.cjs')),name);
 assert.deepEqual(result.errors||[],[],name);assert.deepEqual((result.requests||[]).filter(r=>r.status>=400),[],name);
}
const equipment=read('equipment/equipment.json'),subpath=read('subpath/equipment.json'),matrix=read('matrix/matrix.json');
assert.equal(equipment.devices.length,8);assert.equal(subpath.devices.length,8);
assert.equal(equipment.resources.metadata.step,2);assert.equal(equipment.resources.metadata.commissioned,true);
assert.equal(equipment.resources.equipment.length,24);assert.equal(equipment.resources.equipment.reduce((n,m)=>n+m.vertices,0),1588);
assert.equal(matrix.cases.length,72);
assert.equal(new Set(matrix.cases.map(c=>[c.kind,c.dpr,c.viewport,c.pose].join('/'))).size,72);
for(const item of matrix.cases){assert.ok(item.on.ready);assert.ok(item.on.difference>.1);}
for(const file of ['drills/drills.json','drills-subpath/drills.json']) {
 const c=read(file).cases;
 for(const key of ['normalRestoredExactly','cancelPreservesPart','selfTestSeparate','disposed'])assert.equal(c[key],true,file+': '+key);
 assert.ok(c.backupFlashPixelDifference>1);
 assert.ok(c.solarSurfacePixelDifference>1);assert.ok(c.sensorSurfacePixelDifference>1);
 for(const key of ['drive','charger','sensor'])assert.equal(c[key].m.resolved,true,file+': '+key);
 assert.equal(c.drive.m.source,'main');assert.equal(c.drive.m.mainIsolated,false);assert.equal(c.drive.m.backupOn,false);assert.equal(c.drive.m.inventory.drive,0);assert.equal(c.drive.op.running,true);
 assert.equal(c.charger.m.outputW,200);assert.equal(c.charger.m.inventory.charger,0);assert.equal(c.charger.m.chargerVerified,true);
 assert.ok(c.charger.m.evidence.some(e=>/0\.2014Wh/.test(e.result)));
 assert.equal(c.sensor.m.override,false);assert.equal(c.sensor.m.sensorDirty,false);assert.equal(c.sensor.m.sensorVerified,true);
}
const recreated=read('recreate/recreate.json');assert.equal(recreated.cycles.length,3);assert.ok(recreated.cycles.every(c=>c.passed));
const jsWindows=jobs.map(([name,file])=>({suite:name,...read(file)})).filter(r=>typeof r.initialJsBytes==='number').map(r=>({suite:r.suite,bytes:r.initialJsBytes}));
assert.ok(jsWindows.length>=5);for(const window of jsWindows)assert.ok(window.bytes<=3*1048576);
assert.equal(release.unchangedRuntimeFiles,36);assert.deepEqual(release.prefixes.map(p=>p.files),[495,495]);
assert.ok(release.totals.modelBytes<=4.25*1048576);assert.ok(release.totals.runtimeBytes<=16*1048576);assert.ok(release.totals.initialJsBytes<=3*1048576);assert.ok(release.totals.releaseBytes<=41*1048576);
for(const file of ['tests.log','typecheck.log','development-build.log','production-build.log'])assert.ok(fs.statSync(path.join(__dirname,file)).size>0);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 251[\s\S]*pass 251[\s\S]*fail 0/);
const docs=['AGENTS.md','docs/technical-plans/README.md','docs/technical-plans/2026-10-20-lighthouse-project-02-equipment-and-maintenance.md',
 'docs/technical-plans/2026-10-20-lighthouse-operation-and-keeper-routine.md','CHANGELOG.md','public/STUDY_ASSET_SOURCES.md',path.relative(root,path.join(__dirname,'README.md'))];
let localLinks=0;
for(const file of docs){const text=fs.readFileSync(path.join(root,file),'utf8'),documentPath=path.join(root,file.startsWith('public/')?'dist/'+file.slice(7):file);
 for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
 const link=match[1];if(/^[a-z]+:|^#/.test(link))continue;assert.ok(fs.existsSync(path.resolve(path.dirname(documentPath),decodeURIComponent(link.split('#')[0]))),file+': '+link);localLinks++;
}}
const sourceFiles=['src/examples/LighthouseMaintenance.ts','src/examples/LighthouseMaintenancePanel.ts','src/examples/LighthouseOperation.ts','src/examples/LighthouseInspection.ts','src/examples/LighthouseEquipment.ts','src/examples/LighthouseEquipmentLayout.ts','src/examples/LighthouseDetails.ts','src/examples/LighthousePanel.ts','src/examples/LighthouseRecords.ts',
 'src/examples/Room.ts','src/examples/WalkingSurface.ts','src/examples/CoastalScooter.ts','src/examples/CoastalMap.ts','public/index.html','public/STUDY_ASSET_SOURCES.md','public/environment/coastal-cliff-source.json'];
const record={passed:true,baseline:'e13fe78',manifestSha256,release:release.totals,jsWindows,maxObservedFirstScreenJsBytes:Math.max(...jsWindows.map(w=>w.bytes)),
 verifiedSuites:jobs.length,componentCases:matrix.cases.length,localLinks,sourceSha256:Object.fromEntries(sourceFiles.map(file=>[file,digest(path.join(root,file))])),fpsOrLoadTimeSampling:false};
fs.writeFileSync(path.join(__dirname,'evidence-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
