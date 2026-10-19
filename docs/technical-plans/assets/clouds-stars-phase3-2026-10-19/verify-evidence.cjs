// Check evidence provenance and acceptance, independently of the browser runner.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name)));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=read('run-checks.json'),manifest=sha(path.join(__dirname,'release-manifest.json')),implementation=read('implementation.json');
const inspectorWarning=`The keyword 'slider-vertical' specified to an 'appearance' property is not standardized. It will be removed in the future. Use <input type=range style="writing-mode: vertical-lr; direction: rtl"> instead.`;
assert.equal(run.passed,true);assert.equal(Object.keys(run.suites).length,19);
assert.equal(manifest,sha(path.join(root,'dist/release-manifest.json')));assert.equal(manifest,sha(path.join(__dirname,'../clouds-stars-phase2-2026-10-19/release-manifest.json')));
for(const [name,suite]of Object.entries(run.suites)){
 assert.equal(suite.passed,true,name);assert.equal(suite.exitCode,0,name);assert.equal(suite.manifestSha256,manifest,name);
 assert.equal(sha(path.join(root,suite.script)),suite.sha256,name+' executed source');
 if(name!=='platforms'){const value=read(suite.result);assert.equal(value.passed,true,name);assert.deepEqual(value.errors||[],[],name);assert.deepEqual(value.warnings||[],name==='controls'?[inspectorWarning]:[],name);}
}
for(const file of implementation.files)assert.equal(sha(path.join(root,file.path)),file.sha256,file.path);
assert.equal(sha(path.join(root,implementation.inspectorWarningSource.path)),implementation.inspectorWarningSource.sha256);
for(const file of read('suite-sources.json').scripts)assert.equal(sha(path.join(root,file.derivedFrom)),file.inputSha256,file.derivedFrom+' historical source');
const controls=read('controls.json'),automatic=read('automatic-clouds.json'),journey=read('journey.json'),life=read('lifecycle.json'),recreate=read('recreate.json');
assert.equal(controls.nodes.length,8);assert.equal(controls.transitions.length,25);assert.equal(controls.automatic.length,11);assert.ok(controls.inspectionPause.resumedOnSecondFrame);assert.ok(controls.inspectorInternalHide.passed);
assert.ok(controls.cadence.batches>=9&&controls.cadence.batches<=10);assert.equal(controls.reducedMotion.hour,18);
assert.equal(automatic.cases.length,2);
for(const c of automatic.cases){assert.equal(c.passed,true);assert.ok(c.samples.length>=2400);assert.equal(c.samples.at(-1).step,14400);assert.ok(Math.abs(c.samples.at(-1).hour-18)<1e-7);
 assert.equal(c.referencePixels.length,15);assert.equal(c.referencePixels.filter(p=>p.compared).length,10);
 assert.ok(c.referencePixels.every(p=>p.repeatDifferences===0&&(!p.compared||p.mean<1&&p.maximum<=16&&p.overEightFraction<.001)));assert.deepEqual(c.errors,[]);assert.deepEqual(c.warnings,[]);
 for(const image of c.images)assert.ok(fs.existsSync(path.join(__dirname,image)));assert.ok(Math.abs(c.stopped.hour-c.stopped.visual)<1e-7);}
assert.equal(journey.timeAtStart,0);assert.equal(journey.routeOut.length,139);assert.equal(journey.routeBack.length,139);assert.equal(journey.gallery.length,32);assert.equal(journey.up.length,4);assert.equal(journey.down.length,4);assert.match(journey.cases.continuousJourneyHome.region,/客厅/);assert.ok(journey.cases.timeMenuPause);
assert.ok(life.lateImport.transitioning);assert.equal(life.hdrNodes.length,4);assert.equal(life.hdrFailure.passed,true);assert.equal(life.ladder.attached,true);assert.deepEqual(life.ladder.before,life.ladder.after);
assert.equal(recreate.cycles.length,3);assert.equal(new Set(recreate.cycles.map(c=>c.sky.pixelSha256)).size,1);
for(const c of recreate.cycles){assert.equal(c.passed,true);assert.deepEqual(c.resources,{meshes:670,materials:95,textures:148,lights:17,cameras:3});assert.ok(Object.values(c.disposed).every(n=>n===0));assert.equal(c.after.document.keydown||0,0);}
const matrix=read('engines/matrix.json'),stability=read('stability.json'),visuals=read('visuals.json'),reflection=read('reflection.json'),mirrors=read('mirror-clouds.json');
assert.equal(matrix.cases.length,12);assert.ok(matrix.cases.every(c=>c.passed&&c.nodes.length===8&&c.automatic.length===3));
for(const c of matrix.cases){assert.deepEqual(c.errors,[]);assert.deepEqual(c.warnings,[]);}
assert.equal(stability.cases.length,12);for(const c of stability.cases){assert.equal(c.nodes.length,8);assert.equal(c.frames.length,13);assert.equal(c.frames[0].width,c.viewport.width*c.dpr);assert.equal(c.frames[0].height,c.viewport.height*c.dpr);assert.ok(c.matches.every(m=>m.ratio>=.8&&m.maxFluxRatio<1.8&&m.minFluxRatio>.5));assert.deepEqual(c.errors,[]);assert.deepEqual(c.warnings,[]);}
assert.ok(stability.dprMatches.every(m=>m.ratio>=.8));assert.equal(visuals.nodes.length,8);assert.equal(visuals.shadowAnchors.length,32);
for(const hour of[0,3,6,9,12,15,18,21])for(const view of['balcony','bedroom','house','path','tower','scooter','north','east','south','west','zenith'])assert.ok(fs.existsSync(path.join(__dirname,`${String(hour).padStart(2,'0')}-${view}.jpg`)));
assert.ok(reflection.seaClouds.changedPixels>100);assert.equal(reflection.seaClouds.repeatDifferences,0);assert.equal(reflection.seaStars.changedPixels,0);assert.deepEqual(reflection.gradientBefore,reflection.gradientAfter);assert.deepEqual(reflection.reflectionWithBody,reflection.reflectionWithoutBody);
assert.ok(mirrors.ensuite.changedPixels>10);assert.equal(mirrors.ensuite.repeatDifferences,0);assert.equal(mirrors.publicClosed.changedPixels,0);assert.equal(mirrors.targets.length,2);assert.ok(mirrors.targets.every(t=>t.size.width===512&&t.refreshRate===0&&t.noPrePass));assert.equal(read('mirrors/master/mirror-map.json').visibilityGating,true);
const transitions=read('transitions/transitions.json');assert.equal(transitions.frames.length,25);assert.equal(transitions.retargets.length,3);assert.equal(transitions.reducedMidpoint.stars,.5);assert.equal(transitions.reducedEnd.stars,1);
const scooter=read('browser.json'),jump=read('jump/jump.json'),subpath=read('subpath.json'),release=read('release-check.json'),platforms=read('platform-availability.json');
assert.equal(scooter.zones.length,6);assert.equal(scooter.obstacles.length,3);assert.ok(scooter.safeDismount&&scooter.mapPauses&&scooter.inspector);assert.equal(Object.keys(jump.landings).length,6);assert.ok(subpath.inspectorLoaded);
assert.equal(release.totals.fileCount,495);assert.equal(release.unchangedRuntimeFiles,36);assert.equal(release.staticJsDeltaFromPhase2,0);assert.equal(release.releaseDeltaFromPhase2,0);assert.ok(release.prefixes.every(p=>p.passed&&p.files===495));
assert.equal(controls.initialJs.length,12);assert.equal(controls.initialJsBytes,visuals.initialJsBytes);assert.equal(subpath.initialJsBytes,controls.initialJsBytes);assert.ok(controls.initialJsBytes<=3*1048576);assert.equal(controls.initialJsBytes,release.staticInitialJsBytes+218852);assert.ok(release.totals.releaseBytes<=41*1048576);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 187/);assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/fail 0/);
assert.match(fs.readFileSync(path.join(__dirname,'development-build.log'),'utf8'),/compiled successfully/);assert.match(fs.readFileSync(path.join(__dirname,'production-build.log'),'utf8'),/compiled with 3 warnings/);
const matches=stability.cases.flatMap(c=>c.matches),pixels=automatic.cases.flatMap(c=>c.referencePixels.filter(p=>p.compared));
const documentation=read('documentation-check.json');assert.equal(documentation.passed,true);assert.equal(documentation.currentStatusConsistent,true);
for(const file of documentation.files)assert.equal(sha(path.join(root,file.path)),file.sha256,file.path+' documented version');
const summary={baseline:'47eb076',status:'engineering-and-available-platforms-complete',passed:true,runtimePackageChanged:false,unitTestsPassed:187,suitesCompleted:19,browserAndReleaseSuitesPassed:18,platformProbeCompleted:true,productionManifestSha256:manifest,
 automatic:{engines:2,stepsPerEngine:14400,samples:automatic.cases.map(c=>c.samples.length),gpuFrames:pixels.length+10,comparedPairs:pixels.length,maxPixelDifference:Math.max(...pixels.map(p=>p.maximum)),maxMeanPixelDifference:Math.max(...pixels.map(p=>p.mean))},
 matrixCases:12,matrixNodeChecks:96,matrixAutomaticSegments:36,starReferenceFrames:156,minStarMatchRatio:Math.min(...matches.map(m=>m.ratio)),maxStarAngleError:Math.max(...matches.map(m=>m.maxAngle)),
 route:{out:139,back:139,gallery:32,storeys:5},recreateCycles:3,recreatedSkyPixelSha256:recreate.cycles[0].sky.pixelSha256,
 actualInitialJsBytes:controls.initialJsBytes,actualInitialJsFiles:12,release:release.totals,resources:visuals.nodes[0].resources,platforms,
 inspectorDeprecationWarnings:[inspectorWarning],buildPerformanceRecommendations:3,
 documentation:{localLinksChecked:documentation.localLinksChecked,headingAnchorsChecked:documentation.headingAnchorsChecked,currentStatusConsistent:true},
 limitations:['Firefox/Safari sessions and physical devices unverified','WebGL2 and reference poses only; no WebGL1 conclusion','No subjective physical-device audio check','FPS/GPU/load-time experiments remain paused','Neutral IBL, local shadows and artistic cloud/roughness approximations retained'],remainingImplementation:[]};
fs.writeFileSync(path.join(__dirname,'acceptance-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
