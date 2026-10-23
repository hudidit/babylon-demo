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
 for(const group of groups)for(const g of [group.ground,group.plants].filter(Boolean)){
  assert.ok(g.positions.every(Number.isFinite));assert.equal(g.colors.length,g.positions.length/3*4);
  triangles+=g.indices.length/3;
  const points=Array.from({length:g.positions.length/3},(_,i)=>plan(g,i));
  const box={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  // Stronger than checking tree centres: entire batch AABBs lie north of every walk vertex.
  assert.ok(box.maxY < Math.min(...COASTAL_WALK_BOUNDARY.map(p=>p.y))-3);
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

test('background batches use one opaque material, no shadows/collisions/picking and clean disposal', t => {
 const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
 t.after(()=>{scene.dispose();engine.dispose();});
 const exterior=new(load('RoomExterior').RoomExterior)(scene),meshes=exterior.meshes.filter(m=>m.name.startsWith('coastal-landscape-'));
 assert.equal(meshes.length,10);
 const shadow=exterior.shadow.getShadowMap().renderList;
 for(const m of meshes){assert.equal(m.metadata.exteriorLayer,'distant');assert.equal(m.isPickable,false);assert.equal(m.checkCollisions,false);assert.equal(m.receiveShadows,false);assert.ok(!shadow.includes(m));assert.equal(m.material.alpha,1);assert.equal(m.material.needAlphaBlending(),false);assert.ok(exterior.sun.includedOnlyMeshes.includes(m));}
 const forest=scene.getMaterialByName('coastal-background-foliage');
 assert.equal(new Set(meshes.filter(m=>!m.name.endsWith('ground')).map(m=>m.material)).size,1);
 assert.equal(forest.albedoTexture,null);assert.ok(forest.backFaceCulling);
 exterior.updateCutaway({x:20,z:50},{x:0,z:0});assert.ok(forest.clipPlane2==null);
 exterior.setVisible(false);assert.ok(meshes.every(m=>!m.isVisible));exterior.setVisible(true);assert.ok(meshes.every(m=>m.isVisible));
 exterior.dispose();exterior.dispose();assert.ok(meshes.every(m=>m.isDisposed()));assert.ok(!scene.materials.includes(forest));
});
