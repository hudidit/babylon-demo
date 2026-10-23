const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p))),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const before=read('before/browser.json'),after=read('after/browser.json'),movement=read('movement.json');
assert.ok(before.passed&&after.passed&&movement.passed);assert.deepEqual(before.views,after.views);
const oldManifest=read('before/release-manifest.json'),newManifest=read('after/release-manifest.json');
const addedAssets=newManifest.files.filter(f=>f.kind==='runtime'&&!oldManifest.files.some(o=>o.path===f.path));
assert.deepEqual(addedAssets,[]);
assert.deepEqual(newManifest.files.filter(f=>f.kind==='runtime').map(f=>f.path),oldManifest.files.filter(f=>f.kind==='runtime').map(f=>f.path));
for(const f of oldManifest.files.filter(f=>f.kind==='runtime'&&f.path!=='textures/coastal/pine-branches.png'))assert.deepEqual(newManifest.files.find(n=>n.path===f.path),f);
assert.deepEqual(oldManifest.chunkFiles,newManifest.chunkFiles);
for(const key of ['meshes','materials','textures','lights','cameras','shadowMaps'])assert.equal(after.scene[key],before.scene[key]);
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),groups=load('CoastalLandscape').coastalLandscape(),poly=load('CoastalSite').COASTAL_WALK_BOUNDARY;
const preserved=groups.map(g=>({name:g.name,trees:g.trees.map(({x,y,base,height})=>({x,y,base,height})),ground:g.ground,plants:g.trees.length?undefined:g.plants,rocks:g.rocks,anchors:g.anchors,details:g.trees.length?undefined:g.details}));
const preservedHash=sha(JSON.stringify(preserved));assert.equal(preservedHash,'aab6b6626f6b917ff1c07d79ebdb1c4dd72dda242c3c5487f107f4c819d2b871');
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
const geometry=groups.map(group=>({name:group.name,trees:group.trees.length,meshes:['ground','plants','rocks'].filter(k=>group[k]).map(kind=>{
 const g=group[kind],ps=Array.from({length:g.positions.length/3},(_,i)=>({x:g.positions[i*3]/5+5.4,y:g.positions[i*3+2]/5+5.4}));
 const box={minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxY:Math.max(...ps.map(p=>p.y))};
 const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];let clearance=Infinity;
 for(let i=0;i<poly.length;i++)for(let j=0;j<4;j++){const a=poly[i],b=poly[(i+1)%poly.length],c=corners[j],d=corners[(j+1)%4];clearance=Math.min(clearance,distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));}
 return {kind,vertices:ps.length,triangles:g.indices.length/3,box,clearance};
})}));
const meshes=geometry.flatMap(g=>g.meshes),provenance=require(path.join(root,'public/textures/coastal/pine-source.json'));
assert.equal(sha(fs.readFileSync(path.join(root,'public',provenance.output.file))),provenance.output.sha256);
assert.equal(newManifest.files.find(f=>f.path===provenance.output.file).bytes,provenance.output.bytes);
const result={baseline:'f5172ba',preservedLayoutGroundDetailsSha256:preservedHash,geometry,
 totals:{vertices:meshes.reduce((n,m)=>n+m.vertices,0),triangles:meshes.reduce((n,m)=>n+m.triangles,0),minimumBoxClearance:Math.min(...meshes.map(m=>m.clearance))},
 added:{vertices:after.scene.vertices-before.scene.vertices,triangles:after.scene.landscape.reduce((n,m)=>n+m.triangles,0)-before.scene.landscape.reduce((n,m)=>n+m.triangles,0),runtimeBytes:after.release.runtimeBytes-before.release.runtimeBytes,firstScreenJsBytes:after.firstScreenBytes-before.firstScreenBytes,releaseBytes:after.release.releaseBytes-before.release.releaseBytes},
 budgets:{firstScreenHeadroom:3*1048576-after.firstScreenBytes,releaseHeadroom:41*1048576-after.release.releaseBytes},
 otherRuntimeAssetHashesUnchanged:36,dynamicChunksPreserved:true,identicalCameraPoses:after.views.length,
 sourceSha256:Object.fromEntries(['src/examples/CoastalTree.ts','src/examples/CoastalLandscape.ts','src/examples/RoomExterior.ts','src/examples/CoastalCliff.ts','src/examples/CoastalSite.ts','src/examples/WalkingSurface.ts','src/examples/CoastalMaterials.ts','public/environment/coastal-cliff-source.json','public/STUDY_ASSET_SOURCES.md','public/textures/coastal/pine-source.json','tests/coastal-landscape.test.cjs','tools/prepare-island-foliage.py','tools/study-release.config.cjs','package-lock.json','tsconfig.json','webpack.config.js'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),passed:true};
assert.ok(result.totals.minimumBoxClearance>=3);assert.ok(result.totals.triangles<=15000);assert.ok(result.budgets.firstScreenHeadroom>=0&&result.budgets.releaseHeadroom>=0);
fs.writeFileSync(path.join(__dirname,'geometry-and-release.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({totals:result.totals,added:result.added,budgets:result.budgets,passed:true},null,2));
