const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name))),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=read('run-checks.json'),visuals=read('visuals.json'),reflection=read('reflection.json'),stability=read('stability.json'),mirrors=read('mirror-clouds.json');
const master=read('mirrors/master/mirror-map.json'),publicMirror=read('mirrors/public/public-mirror.json'),transitions=read('transitions.json'),regression=read('regression.json'),release=read('release-check.json');
const implementation=read('implementation.json'),platforms=read('platform-availability.json'),manifest=sha(path.join(__dirname,'release-manifest.json'));
assert.equal(sha(path.join(root,'dist/release-manifest.json')),manifest);assert.equal(run.passed,true);assert.equal(Object.keys(run.suites).length,10);
for(const state of Object.values(run.suites)){assert.equal(state.passed,true);assert.equal(state.exitCode,0);assert.equal(state.manifestSha256,manifest);assert.equal(sha(path.join(root,state.script)),state.sha256);}
for(const file of implementation.sourceFiles)assert.equal(sha(path.join(root,file.path)),file.sha256,file.path);
for(const result of[visuals,reflection,stability,mirrors,master,publicMirror,transitions,regression,release]){assert.equal(result.passed,true);assert.deepEqual(result.errors||[],[]);assert.deepEqual(result.warnings||[],[]);}
assert.equal(visuals.nodes.length,8);assert.equal(visuals.initialJs.length,12);assert.ok(visuals.initialJsBytes<=3*1048576);
assert.equal(visuals.initialJsBytes,release.staticInitialJsBytes+218852);assert.ok(visuals.initialJsBytes-2897086<=24*1024);
for(const hour of[0,3,6,9,12,15,18,21])for(const view of['balcony','bedroom','house','path','tower','scooter','north','east','south','west','zenith'])assert.ok(fs.existsSync(path.join(__dirname,`${String(hour).padStart(2,'0')}-${view}.jpg`)));
assert.ok(reflection.seaClouds.changedPixels>100);assert.equal(reflection.seaClouds.repeatDifferences,0);assert.equal(reflection.seaStars.changedPixels,0);
assert.deepEqual(reflection.gradientBefore,reflection.gradientAfter);assert.deepEqual(reflection.reflectionWithBody,reflection.reflectionWithoutBody);
assert.equal(stability.cases.length,12);assert.equal(stability.cases.reduce((n,c)=>n+c.nodes.length,0),96);
for(const c of stability.cases){assert.equal(c.frames.length,13);assert.equal(c.frames[0].width,c.viewport.width*c.dpr);assert.equal(c.frames[0].height,c.viewport.height*c.dpr);
 assert.ok(c.matches.every(m=>m.ratio>=.8&&m.maxFluxRatio<1.8&&m.minFluxRatio>.5));assert.deepEqual(c.errors,[]);assert.deepEqual(c.warnings,[]);}
assert.ok(stability.dprMatches.every(m=>m.ratio>=.8));assert.ok(mirrors.ensuite.changedPixels>10);assert.equal(mirrors.ensuite.repeatDifferences,0);assert.equal(mirrors.publicClosed.changedPixels,0);
assert.equal(mirrors.targets.length,2);assert.ok(mirrors.targets.every(t=>t.size.width===512&&t.refreshRate===0&&t.noPrePass));assert.equal(master.visibilityGating,true);
assert.equal(transitions.frames.length,25);assert.equal(transitions.retargets.length,3);assert.equal(transitions.reducedMidpoint.stars,.5);assert.equal(transitions.reducedEnd.stars,1);
assert.equal(release.totals.fileCount,495);assert.equal(release.unchangedRuntimeFiles,36);assert.equal(release.prefixes.length,2);assert.ok(release.totals.releaseBytes<=41*1048576);
assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/tests 187/);assert.match(fs.readFileSync(path.join(__dirname,'tests.log'),'utf8'),/fail 0/);
assert.match(fs.readFileSync(path.join(__dirname,'development-build.log'),'utf8'),/compiled successfully/);assert.match(fs.readFileSync(path.join(__dirname,'production-build.log'),'utf8'),/compiled with 3 warnings/);
const allMatches=stability.cases.flatMap(c=>c.matches),summary={baseline:'fefe1b3',passed:true,tests:187,productionManifestSha256:manifest,
 visualNodes:8,sixViewImages:48,directionalSkyImages:40,matrixCases:12,matrixNodeChecks:96,referenceFrames:156,
 minStarMatchRatio:Math.min(...allMatches.map(m=>m.ratio)),maxStarAngleError:Math.max(...allMatches.map(m=>m.maxAngle)),
 fluxRatioRange:[Math.min(...allMatches.map(m=>m.minFluxRatio)),Math.max(...allMatches.map(m=>m.maxFluxRatio))],dprMatches:stability.dprMatches,
 actualInitialJsBytes:visuals.initialJsBytes,actualInitialJsFiles:visuals.initialJs.length,release,seaClouds:reflection.seaClouds,seaStars:reflection.seaStars,
 resources:visuals.nodes[0].resources,mirrorCloudPixels:mirrors.ensuite.changedPixels,mirrorClosedWallPixels:mirrors.publicClosed.changedPixels,
 mirrorNightStarsInThisWindowFixture:mirrors.ensuiteNightStars.changedPixels,mirrorsRemain512:true,platforms,
 remaining:['Stage 3 complete automatic/pause/full-route and three-cycle recreation acceptance','Firefox/Safari/physical devices'],fpsGpuOrLoadTimeMeasurements:false};
fs.writeFileSync(path.join(__dirname,'acceptance-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({passed:true,tests:187,matrixCases:12,referenceFrames:156,actualInitialJsBytes:visuals.initialJsBytes,releaseBytes:release.totals.releaseBytes}));
