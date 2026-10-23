const {test} = require('node:test');
const assert = require('node:assert/strict');
const b = require('@babylonjs/core/pure');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {coastalLandscape, landscapeGroundHeight} = load('CoastalLandscape');
const {COASTAL_CLIFF, coastalLandPatch} = load('CoastalCliff');
const {COASTAL_WALK_BOUNDARY} = load('CoastalSite');
const {withinWalkingBoundary} = load('WalkingSurface');
const {planToWorld} = load('HouseLayout');
const groups = coastalLandscape();
const plan = (g, i) => ({x:g.positions[i*3]/5+5.4, y:g.positions[i*3+2]/5+5.4, height:(g.positions[i*3+1]+5)/5});
const segmentDistance = (p,a,z) => {
 const dx=z.x-a.x,dy=z.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};

test('complete landscape bounds stay outside walking space, with supported roots and buried hill edges', () => {
 let triangles=0;
 for(const group of groups)for(const g of [group.ground,group.plants,group.rocks].filter(Boolean)){
  assert.ok(g.positions.every(Number.isFinite));assert.equal(g.colors.length,g.positions.length/3*4);
  triangles+=g.indices.length/3;
  const points=Array.from({length:g.positions.length/3},(_,i)=>plan(g,i));
  const box={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  // Test complete batch rectangles, including edges, rather than only scatter centres.
  const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];
  for(const p of corners)assert.equal(withinWalkingBoundary(p),false);
  for(const [i,a]of COASTAL_WALK_BOUNDARY.entries()){
   const z=COASTAL_WALK_BOUNDARY[(i+1)%COASTAL_WALK_BOUNDARY.length];
   assert.ok(a.x<box.minX||a.x>box.maxX||a.y<box.minY||a.y>box.maxY);
   for(const [j,c]of corners.entries()){
    const d=corners[(j+1)%4],cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    assert.ok(!(cross(a,z,c)*cross(a,z,d)<0&&cross(c,d,a)*cross(c,d,z)<0));
    assert.ok(Math.min(segmentDistance(a,c,d),segmentDistance(z,c,d),segmentDistance(c,a,z),segmentDistance(d,a,z))>=3,group.name);
   }
  }
  for(const p of points){
   assert.equal(withinWalkingBoundary(p),false);
   assert.ok(COASTAL_WALK_BOUNDARY.every((a,i)=>segmentDistance(p,a,COASTAL_WALK_BOUNDARY[(i+1)%COASTAL_WALK_BOUNDARY.length])>=3));
  }
  if(g===group.ground){
   const edge=points.slice(-25);
   for(const [i,p] of edge.entries()){
    assert.ok(Math.abs(p.height-landscapeGroundHeight(p.x,p.y)+.18)<1e-6);
    const q=edge[(i+1)%edge.length];
    for(let step=0;step<=10;step++){const t=step/10,x=p.x+(q.x-p.x)*t,y=p.y+(q.y-p.y)*t;
     assert.ok(p.height+(q.height-p.height)*t<=landscapeGroundHeight(x,y)+1e-6,'hill perimeter cannot float between vertices');}
   }
   assert.ok(g.colors.slice(-25*4).every(v=>v===1),'hill perimeter must match the original ground tint');
  }
 }
 assert.ok(triangles<=15000);
 const first=groups.filter(g=>!g.phase);
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(first)).digest('hex'),
  '3e612548994b2e6c02caf275c48f7644024dd089fb004b4a5716194bcbb98e20','phase-one geometry must be preserved');
 assert.deepEqual(groups,coastalLandscape(),'fixed layout must be reproducible');
 for(const group of groups)for(const tree of group.trees){
  const p=plan(group.plants,tree.first);
  assert.ok(Math.abs(p.height-(tree.base-.22))<1e-7);
  assert.ok(Number.isFinite(tree.base));
 }
});

test('background support and tree roots match ray hits on actual ground and hill triangles', t => {
 const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 const add=(name,g)=>{const m=new b.Mesh(name,scene),vd=new b.VertexData();vd.positions=g.positions;vd.indices=g.indices;vd.applyToMesh(m);m.computeWorldMatrix(true);return m;};
 add('base',coastalLandPatch(0,COASTAL_CLIFF.columns,0,COASTAL_CLIFF.rows));
 const hit=(x,y)=>{const p=planToWorld({x,y},60);const hit=scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,-1,0),500));assert.ok(hit.hit);return(hit.pickedPoint.y+5)/5;};
 for(const x of [-140,-130,-75,-20,35])for(const y of [-50.01,-67,-93,-127,-180])
  assert.ok(Math.abs(hit(x,y)-landscapeGroundHeight(x,y))<3e-5,`${x},${y}`);
 for(const group of groups)if(group.ground)add(group.name,group.ground);
 for(const group of groups)for(const tree of group.trees)assert.ok(Math.abs(hit(tree.x,tree.y)-tree.base)<3e-5);
 for(const p of [[NaN,-70],[0,Infinity],[0,-601],[-900,-100],[0,100]])assert.equal(landscapeGroundHeight(...p),undefined);
});

test('hill faces point up and closed crowns point outward in Babylon left-handed winding', () => {
 for(const group of groups){
  const n=[];b.VertexData.ComputeNormals(group.plants.positions,group.plants.indices,n);
  for(const tree of group.trees){
   const top=tree.first+14;assert.ok(n[top*3+1]>.95,'crown top must face the sky');
   const bottom=top+15;assert.ok(n[bottom*3+1]<-.95,'closed crown underside must face the ground');
  }
  if(group.ground){const n=[];b.VertexData.ComputeNormals(group.ground.positions,group.ground.indices,n);
   assert.ok(n.filter((_,i)=>i%3===1).every(v=>v>=0),'hill must not expose its unlit back face');}
 }
});

test('background plants share one opaque material, no shadows/collisions/picking and clean disposal', t => {
 const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
 t.after(()=>{scene.dispose();engine.dispose();});
 const exterior=new(load('RoomExterior').RoomExterior)(scene),meshes=exterior.meshes.filter(m=>m.name.startsWith('coastal-landscape-'));
 assert.equal(meshes.length,19);
 const added=meshes.filter(m=>m.metadata.landscapePhase===2);
 assert.ok(added.length<=10);assert.ok(added.reduce((n,m)=>n+m.getTotalVertices(),0)<=6000);
 assert.ok(added.reduce((n,m)=>n+m.getTotalIndices()/3,0)<=7000);
 const originalCoast=exterior.meshes.filter(m=>!m.metadata.lighthouseEquipment&&!m.metadata.lighthouseInteriorStructure&&!m.metadata.lighthouseDetail);
 assert.ok(originalCoast.filter(m=>m.metadata.landscapePhase!==2).reduce((n,m)=>n+m.getTotalVertices(),0)<160000);
 assert.ok(originalCoast.reduce((n,m)=>n+m.getTotalVertices(),0)<=166000);
 const shadow=exterior.shadow.getShadowMap().renderList;
 for(const m of meshes){assert.equal(m.metadata.exteriorLayer,'distant');assert.equal(m.isPickable,false);assert.equal(m.checkCollisions,false);assert.equal(m.receiveShadows,false);assert.ok(!shadow.includes(m));assert.equal(m.material.alpha,1);assert.equal(m.material.needAlphaBlending(),false);assert.ok(exterior.sun.includedOnlyMeshes.includes(m));}
 const forest=scene.getMaterialByName('coastal-background-foliage');
 assert.equal(new Set(meshes.filter(m=>!m.name.endsWith('ground')&&!m.name.endsWith('rocks')).map(m=>m.material)).size,1);
 for(const m of meshes.filter(m=>m.name.endsWith('rocks')))assert.equal(m.material,exterior.surfaces.farRock);
 assert.equal(forest.albedoTexture,null);assert.ok(forest.backFaceCulling);
 exterior.updateCutaway({x:20,z:50},{x:0,z:0});assert.ok(forest.clipPlane2==null);
 exterior.setVisible(false);assert.ok(meshes.every(m=>!m.isVisible));exterior.setVisible(true);assert.ok(meshes.every(m=>m.isVisible));
 exterior.dispose();exterior.dispose();assert.ok(meshes.every(m=>m.isDisposed()));assert.ok(!scene.materials.includes(forest));
});


test('phase-two shrubs, grass and rock feet rest on the actual terrain; closed faces point outward', () => {
 for(const group of groups.filter(g=>g.phase))for(const anchor of group.anchors){
  const g=anchor.kind==='rock'?group.rocks:group.plants, a=anchor.first;
  const count=anchor.kind==='rock'?26:anchor.kind==='grass'?4:16,edges=new Map();
  for(let i=0;i<g.indices.length;i+=3){const face=g.indices.slice(i,i+3);if(!face.every(n=>n>=a&&n<a+count))continue;
   for(let j=0;j<3;j++){const u=face[j],v=face[(j+1)%3],key=[Math.min(u,v),Math.max(u,v)].join(':');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok(edges.size>0&&[...edges.values()].every(n=>n===2),'each closed shape edge must join two faces');
  const feet=anchor.kind==='rock'?Array.from({length:8},(_,i)=>a+i):anchor.kind==='grass'?[a,a+1,a+2]:[a+15];
  for(const i of feet){const p=plan(g,i),floor=landscapeGroundHeight(p.x,p.y);assert.ok(floor!==undefined&&p.height<floor,`${group.name} ${anchor.kind}`);assert.ok(floor-p.height<.5);}
  const normals=[];b.VertexData.ComputeNormals(g.positions,g.indices,normals);
  if(anchor.kind==='shrub'){assert.ok(normals[a*3+1]>.95);assert.ok(normals[(a+15)*3+1]<-.95);}
  if(anchor.kind==='rock'){assert.ok(normals[(a+24)*3+1]>.95);assert.ok(normals[(a+25)*3+1]<-.95);}
  if(anchor.kind==='grass'){
   const center=[0,1,2,3].map(i=>plan(g,a+i)).reduce((r,p)=>({x:r.x+p.x/4,y:r.y+p.y/4,height:r.height+p.height/4}),{x:0,y:0,height:0});
   const indices=g.indices;
   for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3);if(!ids.every(n=>n>=a&&n<a+4))continue;
    const [p,q,r]=ids.map(i=>plan(g,i));
    // Babylon's left-handed face normal in plan X/Y/height coordinates.
    const ux=q.x-p.x,uy=q.y-p.y,uz=q.height-p.height,vx=r.x-p.x,vy=r.y-p.y,vz=r.height-p.height;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    assert.ok(nx*(p.x-center.x)+ny*(p.y-center.y)+nz*(p.height-center.height)>0);
   }
  }
 }
});

test('new landscape leaves house and lighthouse sightlines open from the playable route', t => {
 const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 for(const group of groups.filter(g=>g.phase))for(const g of [group.plants,group.rocks].filter(Boolean)){
  const mesh=new b.Mesh(group.name,scene),vd=new b.VertexData();vd.positions=g.positions;vd.indices=g.indices;vd.applyToMesh(mesh);mesh.computeWorldMatrix(true);
 }
 const {walkingSurfaceAt}=load('WalkingSurface');
 const observers=[[13,-3],[-18,10],[-40,12],[-56,8],[-70,25],[-94,44],[-116,63],[-125,87]];
 for(const [x,y]of observers)for(const [tx,ty,h]of [[5.4,5.4,3],[-125,90,18]]){
  const p=planToWorld({x,y},y===87?21.24:walkingSurfaceAt(x,y).height+1.6),q=planToWorld({x:tx,y:ty},h);
  const start=new b.Vector3(p.x,p.y,p.z),delta=new b.Vector3(q.x,q.y,q.z).subtract(start);
  assert.equal(scene.pickWithRay(new b.Ray(start,delta.normalizeToNew(),delta.length())).hit,false,`${x},${y} to ${tx},${ty}`);
 }
});
