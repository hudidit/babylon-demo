const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p))),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const before=read('before/browser.json'),after=read('after/browser.json'),movement=read('movement.json'),coverage=read('coverage-0.5m.json'),coarse=read('coverage-1m.json');
assert.ok(before.passed&&after.passed&&movement.passed);assert.deepEqual(before.views,after.views);
const oldManifest=read('before/release-manifest.json'),newManifest=read('after/release-manifest.json');
assert.equal(after.manifestSha256,movement.manifestSha256);
assert.deepEqual(newManifest.files.filter(f=>f.kind==='runtime'&&!oldManifest.files.some(o=>o.path===f.path)).map(f=>f.path),['textures/coastal/pine-impostor.png']);
const originalAssets=oldManifest.files.filter(f=>f.kind==='runtime');for(const f of originalAssets)assert.deepEqual(newManifest.files.find(n=>n.path===f.path),f);
assert.deepEqual(oldManifest.chunkFiles,newManifest.chunkFiles);
assert.equal(after.scene.meshes-before.scene.meshes,103);assert.equal(after.scene.materials-before.scene.materials,1);assert.equal(after.scene.textures-before.scene.textures,1);
for(const key of ['lights','cameras','shadowMaps'])assert.equal(after.scene[key],before.scene[key]);
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),groups=load('CoastalLandscape').coastalLandscape(),forestModule=load('CoastalForest'),cells=forestModule.coastalForest(groups),trees=cells.flatMap(g=>g.trees),poly=load('CoastalSite').COASTAL_WALK_BOUNDARY;
const preserved=groups.map(g=>({name:g.name,trees:g.trees.map(({x,y,base,height})=>({x,y,base,height})),ground:g.ground,plants:g.trees.length?undefined:g.plants,rocks:g.rocks,anchors:g.anchors,details:g.trees.length?undefined:g.details}));
const preservedHash=sha(JSON.stringify(preserved));assert.equal(preservedHash,'aab6b6626f6b917ff1c07d79ebdb1c4dd72dda242c3c5487f107f4c819d2b871');
const minimumFootprintClearance=Math.min(...trees.map(t=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return forestModule.forestSegmentDistance(t.x,t.y,a.x,a.y,b.x,b.y)-t.width/Math.SQRT2;}))));
const landscapeVertices=after.scene.landscape.reduce((n,m)=>n+m.vertices,0),landscapeTriangles=after.scene.landscape.reduce((n,m)=>n+m.triangles,0),lod=after.scene.landscape.filter(m=>m.forestLOD);
const provenance=require(path.join(root,'public/textures/coastal/pine-impostor-source.json')),asset=fs.readFileSync(path.join(root,'public',provenance.output.file));
assert.equal(sha(asset),provenance.output.sha256);assert.equal(asset.length,provenance.output.bytes);
assert.equal(sha(fs.readFileSync(path.join(root,provenance.geometrySource))),provenance.geometrySha256);
assert.equal(provenance.foliageSha256,require(path.join(root,'public/textures/coastal/pine-source.json')).output.sha256);
assert.ok(minimumFootprintClearance>=3);assert.equal(trees.length,coverage.newPlants);assert.ok(Math.abs(coverage.all.plantableCoverage-coarse.all.plantableCoverage)<.001);
const treeGeometry=far=>{const g={positions:[],indices:[],uvs:[],colors:[]};load('CoastalTree').appendCoastalTree(g,0,0,0,6,far,1,1,2);return{vertices:g.positions.length/3,triangles:g.indices.length/3};};
const sourceFiles=['src/examples/CoastalForest.ts','src/examples/CoastalTree.ts','src/examples/CoastalLandscape.ts','src/examples/RoomExterior.ts','src/examples/CoastalCliff.ts','src/examples/CoastalSite.ts','src/examples/WalkingSurface.ts','src/examples/CoastalMaterials.ts','public/environment/coastal-cliff-source.json','public/STUDY_ASSET_SOURCES.md','public/textures/coastal/pine-impostor-source.json','tests/coastal-forest.test.cjs','tests/coastal-landscape.test.cjs','tests/study-release.test.cjs','tests/room-layout.test.cjs','tests/lighthouse-equipment.test.cjs','tests/lighthouse-ladder.test.cjs','tests/lighthouse-interior.test.cjs','tests/lighthouse-site.test.cjs','tools/bake-coastal-tree.py','tools/study-release.config.cjs','package-lock.json','tsconfig.json','webpack.config.js'];
const result={baseline:'554fc99',preservedLayoutGroundDetailsSha256:preservedHash,
 forest:{newTrees:trees.filter(t=>!t.shrub).length,newShrubs:trees.filter(t=>t.shrub).length,batches:cells.length,minimumFootprintClearance,
  vertices:cells.reduce((n,c)=>n+c.plants.positions.length/3,0),triangles:cells.reduce((n,c)=>n+c.plants.indices.length/3,0),lodBackupVertices:lod.reduce((n,m)=>n+m.vertices,0),lodBackupTriangles:lod.reduce((n,m)=>n+m.triangles,0)},
 totals:{landscapeVertices,landscapeTriangles,combinedCoastVertices:165829+landscapeVertices-before.scene.landscape.reduce((n,m)=>n+m.vertices,0)},
 perTreeGeometry:{existingNear:treeGeometry(false),existingFar:treeGeometry(true),impostor:{vertices:13,triangles:8}},
 added:{storedLandscapeVertices:landscapeVertices-before.scene.landscape.reduce((n,m)=>n+m.vertices,0),triangles:landscapeTriangles-before.scene.landscape.reduce((n,m)=>n+m.triangles,0),runtimeBytes:after.release.runtimeBytes-before.release.runtimeBytes,firstScreenJsBytes:after.firstScreenBytes-before.firstScreenBytes,releaseBytes:after.release.releaseBytes-before.release.releaseBytes},
 budgets:{...forestModule.FOREST_BUDGET,firstScreenHeadroom:3*1048576-after.firstScreenBytes,releaseHeadroom:41*1048576-after.release.releaseBytes},coverage,
 originalRuntimeAssetHashesUnchanged:originalAssets.length,dynamicChunksPreserved:true,identicalCameraPoses:after.views.length,
 sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),passed:true};
assert.ok(result.totals.combinedCoastVertices<=result.budgets.vertices);assert.ok(landscapeTriangles<=result.budgets.triangles);
assert.ok(result.budgets.firstScreenHeadroom>=0&&result.budgets.releaseHeadroom>=0);
const current=require(path.join(root,'public/environment/coastal-cliff-source.json')).backgroundLandscape;
assert.equal(current.vertices,landscapeVertices);assert.equal(current.triangles,landscapeTriangles);assert.equal(current.meshes,after.scene.landscape.length);
fs.writeFileSync(path.join(__dirname,'geometry-and-release.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({forest:result.forest,totals:result.totals,added:result.added,budgets:result.budgets,passed:true},null,2));
