const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p))),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const before=read('before/browser.json'),after=read('after/browser.json'),movement=read('movement.json');
assert.ok(before.passed&&after.passed&&movement.passed);
assert.deepEqual(before.views,after.views,'all 27 before/after camera poses and landmark projections must match');
const oldManifest=read('before/release-manifest.json'),newManifest=read('after/release-manifest.json');
assert.deepEqual(oldManifest.files.filter(f=>f.kind==='runtime'),newManifest.files.filter(f=>f.kind==='runtime'));
assert.deepEqual(oldManifest.chunkFiles,newManifest.chunkFiles);
assert.ok(after.firstScreenBytes-before.firstScreenBytes<=5*1024);
assert.ok(after.release.releaseBytes-before.release.releaseBytes<=15*1024);
for(const key of ['meshes','materials','textures','lights','cameras','shadowMaps'])assert.equal(after.scene[key],before.scene[key]);
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),groups=load('CoastalLandscape').coastalLandscape(),poly=load('CoastalSite').COASTAL_WALK_BOUNDARY;
const withoutDetails=group=>{const {details,...base}=group;if(!details)return base;
 for(const kind of ['plants','rocks'])if(group[kind]){const g=group[kind],n=details[kind];base[kind]={...g,positions:g.positions.slice(0,n*3),indices:g.indices.filter(i=>i<n),uvs:g.uvs.slice(0,n*2),colors:g.colors.slice(0,n*4)};}
 if(base.anchors)base.anchors=base.anchors.filter(a=>a.first<details[a.kind==='rock'?'rocks':'plants']);return base;};
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
const geometry=groups.map(group=>({name:group.name,phase:group.phase||1,trees:group.trees.length,
 shrubs:group.anchors?.filter(a=>a.kind==='shrub').length||0,grassClumps:(group.anchors?.filter(a=>a.kind==='grass').length||0)/5,rocks:group.anchors?.filter(a=>a.kind==='rock').length||0,
 meshes:['ground','plants','rocks'].filter(k=>group[k]).map(kind=>{const g=group[kind],ps=Array.from({length:g.positions.length/3},(_,i)=>({x:g.positions[i*3]/5+5.4,y:g.positions[i*3+2]/5+5.4}));
  const box={minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxY:Math.max(...ps.map(p=>p.y))};
  const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];let clearance=Infinity;
  for(let i=0;i<poly.length;i++)for(let j=0;j<4;j++){const a=poly[i],b=poly[(i+1)%poly.length],c=corners[j],d=corners[(j+1)%4];clearance=Math.min(clearance,segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));}
  return {kind,vertices:ps.length,triangles:g.indices.length/3,detailVertices:group.details&&kind!=='ground'?ps.length-group.details[kind]:0,
   detailTriangles:group.details&&kind!=='ground'?g.indices.filter(n=>n>=group.details[kind]).length/3:0,box,clearance};
 })}));
const meshes=geometry.flatMap(g=>g.meshes).filter(m=>m.detailVertices>0);
const result={baseline:'e9f3a79',phaseOneGeometrySha256:sha(JSON.stringify(groups.filter(g=>!g.phase).map(withoutDetails))),phaseOneTwoGeometrySha256:sha(JSON.stringify(groups.map(withoutDetails))),geometry,
 added:{meshes:after.scene.meshes-before.scene.meshes,vertices:meshes.reduce((n,m)=>n+m.detailVertices,0),triangles:meshes.reduce((n,m)=>n+m.detailTriangles,0),minimumBoxClearance:Math.min(...meshes.map(m=>m.clearance)),firstScreenJsBytes:after.firstScreenBytes-before.firstScreenBytes,releaseBytes:after.release.releaseBytes-before.release.releaseBytes},
 budgets:{firstScreenHeadroom:3*1048576-after.firstScreenBytes,releaseHeadroom:41*1048576-after.release.releaseBytes},
 runtimeAssetHashesUnchanged:true,dynamicChunksPreserved:true,identicalCameraPoses:after.views.length,
 sourceSha256:Object.fromEntries(['src/examples/CoastalLandscape.ts','src/examples/RoomExterior.ts','src/examples/CoastalCliff.ts','src/examples/CoastalSite.ts','src/examples/WalkingSurface.ts','src/examples/CoastalMaterials.ts','public/environment/coastal-cliff-source.json','public/STUDY_ASSET_SOURCES.md','tests/coastal-landscape.test.cjs','package-lock.json','tsconfig.json','webpack.config.js'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),passed:true};
assert.equal(result.phaseOneGeometrySha256,'3e612548994b2e6c02caf275c48f7644024dd089fb004b4a5716194bcbb98e20');
assert.ok(result.added.minimumBoxClearance>=3);assert.equal(result.phaseOneTwoGeometrySha256,'10b25aff3a18248792c81c18baa8dcda1502fdef9c06cd9ac8fc53a0cd8a725f');
assert.ok(result.added.meshes===0&&result.added.vertices<=2400&&result.added.triangles<=3800);
assert.equal(result.added.vertices,after.scene.vertices-before.scene.vertices);
assert.equal(result.added.triangles,after.scene.landscape.reduce((n,m)=>n+m.triangles,0)-before.scene.landscape.reduce((n,m)=>n+m.triangles,0));
fs.writeFileSync(path.join(__dirname,'geometry-and-release.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({added:result.added,budgets:result.budgets,passed:true},null,2));
