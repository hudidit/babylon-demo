const {test}=require('node:test'),assert=require('node:assert/strict');
const b=require('@babylonjs/core/pure'),load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
load('RoomRuntime').registerRoomRuntime();
const {coastalForest,FOREST_BUDGET,FOREST_SIGHTLINES,forestSegmentDistance}=load('CoastalForest');
const {coastalLandscape,landscapeGroundHeight}=load('CoastalLandscape'),groups=coastalLandscape(),cells=coastalForest(groups),trees=cells.flatMap(g=>g.trees);
const {COASTAL_WALK_BOUNDARY}=load('CoastalSite'),{withinWalkingBoundary,walkingSurfaceAt}=load('WalkingSurface'),{planToWorld}=load('HouseLayout');
const at=(g,i)=>({x:g.positions[i*3]/5+5.4,y:g.positions[i*3+2]/5+5.4,height:(g.positions[i*3+1]+5)/5});
const add=(scene,name,g)=>{const m=new b.Mesh(name,scene),v=new b.VertexData();v.positions=g.positions;v.indices=g.indices;v.applyToMesh(m);m.computeWorldMatrix(true);return m;};

test('forest layout is deterministic, bounded, and its complete tree footprints clear walking space and terrain edges',()=>{
 assert.deepEqual(cells,coastalForest(groups));assert.ok(trees.length>4000&&trees.length<=FOREST_BUDGET.trees);assert.ok(cells.length<=FOREST_BUDGET.batches);
 assert.ok(trees.some(t=>t.shrub)&&trees.some(t=>!t.shrub));
 for(const cell of cells){
  const g=cell.plants;assert.equal(g.positions.length/3,cell.trees.length*13);assert.equal(g.indices.length/3,cell.trees.length*8);
  assert.ok(g.positions.every(Number.isFinite));assert.equal(g.colors.length/4,g.positions.length/3);assert.equal(g.uvs.length/2,g.positions.length/3);assert.equal(g.normals.length,g.positions.length);
  for(const t of cell.trees){
   const radius=t.width/Math.SQRT2;
   assert.equal(withinWalkingBoundary(t),false);
   for(const [i,a]of COASTAL_WALK_BOUNDARY.entries()){const z=COASTAL_WALK_BOUNDARY[(i+1)%COASTAL_WALK_BOUNDARY.length];assert.ok(forestSegmentDistance(t.x,t.y,a.x,a.y,z.x,z.y)>=radius+3);}
   for(const v of FOREST_SIGHTLINES)assert.ok(forestSegmentDistance(t.x,t.y,...v)>=radius+1);
   for(let i=t.first;i<t.first+13;i++){const p=at(g,i);assert.notEqual(landscapeGroundHeight(p.x,p.y),undefined);assert.equal(withinWalkingBoundary(p),false);}
   assert.ok(Math.abs(at(g,t.first).height-t.base+.16)<1e-6);
   // Crown must have relief, and top-view V must run opposite plan Y to preserve the baked view.
   assert.ok(at(g,t.first+12).height>at(g,t.first+8).height+t.height*.27);
   assert.ok(g.uvs[(t.first+8)*2+1]>g.uvs[(t.first+10)*2+1]);
  }
 }
});

test('stratified forest roots match actual terrain/hill ray hits, and landmark rays remain clear',t=>{
 const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 const {COASTAL_CLIFF:c,coastalLandPatch}=load('CoastalCliff');
 add(scene,'ground',coastalLandPatch(0,c.columns,0,c.rows));for(const g of groups)if(g.ground)add(scene,g.name,g.ground);
 // Float32 mesh uploads allow 1mm on steep hill triangles. One root per spatial cell plus every root whose support is a hill (not the base land).
 const samples=new Set(cells.map(c=>c.trees[Math.floor(c.trees.length/2)]));
 for(const tree of trees)if(tree.base>landscapeGroundHeight(tree.x,tree.y)+1e-5)samples.add(tree);
 for(const tree of samples){const p=planToWorld(tree,60),hit=scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,-1,0),500));
  assert.ok(hit.hit);assert.ok(Math.abs((hit.pickedPoint.y+5)/5-tree.base)<.001,`${tree.x},${tree.y}: ${(hit.pickedPoint.y+5)/5-tree.base}m`);}
 for(const m of [...scene.meshes])m.dispose();
 for(const cell of cells)add(scene,cell.name,cell.plants);
 for(const g of groups)for(const data of [g.plants,g.rocks,g.ground].filter(Boolean))add(scene,g.name,data);
 for(const [x,y,tx,ty]of FOREST_SIGHTLINES){
  const p=planToWorld({x,y},y===87?21.24:walkingSurfaceAt(x,y).height+1.6),q=planToWorld({x:tx,y:ty},tx===5.4?3:18);
  const start=new b.Vector3(p.x,p.y,p.z),delta=new b.Vector3(q.x,q.y,q.z).subtract(start);
  assert.equal(scene.pickWithRay(new b.Ray(start,delta.normalizeToNew(),delta.length())).hit,false,`${x},${y} to ${tx},${ty}`);
 }
});

test('shared forest material, LOD backups, full stored geometry, fallback and cleanup obey the new budget',t=>{
 const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;t.after(()=>{scene.dispose();engine.dispose();});
 const exterior=new(load('RoomExterior').RoomExterior)(scene),meshes=exterior.meshes,land=meshes.filter(m=>m.name.startsWith('coastal-landscape-'));
 const forest=land.filter(m=>m.metadata.forestCount),lod=land.filter(m=>m.metadata.forestLOD),parents=land.filter(m=>m.getLODLevels().length);
 assert.equal(forest.length,cells.length);assert.equal(lod.length,9);assert.equal(parents.length,9);assert.equal(land.length,19+9+cells.length);
 assert.equal(forest.reduce((n,m)=>n+m.metadata.forestCount,0),trees.length);
 const coast=meshes.filter(m=>!m.metadata.lighthouseEquipment&&!m.metadata.lighthouseInteriorStructure&&!m.metadata.lighthouseDetail);
 const original=coast.filter(m=>!m.metadata.forestCount&&!m.metadata.forestLOD);
 assert.ok(original.reduce((n,m)=>n+m.getTotalVertices(),0)<=166000,'old geometry budget is still protected');
 assert.ok(coast.reduce((n,m)=>n+m.getTotalVertices(),0)<=FOREST_BUDGET.vertices,'include all LOD backups');
 assert.ok(land.reduce((n,m)=>n+m.getTotalIndices()/3,0)<=FOREST_BUDGET.triangles);
 const material=scene.getMaterialByName('coastal-tree-impostor'),texture=material.albedoTexture;
 assert.equal(material.transparencyMode,b.PBRMaterial.PBRMATERIAL_ALPHATEST);assert.equal(material.alphaCutOff,.35);assert.equal(material.needAlphaBlending(),false);assert.equal(texture.hasAlpha,true);
 const camera=new b.FreeCamera('lod-check',new b.Vector3(0,0,0),scene);camera.maxZ=1e8;
 for(const parent of parents){
  assert.equal(parent.useLODScreenCoverage,true);const level=parent.getLODLevels()[0];assert.equal(level.distanceOrScreenCoverage,.002);assert.ok(lod.includes(level.mesh));
  parent.computeWorldMatrix(true);const sphere=parent.getBoundingInfo().boundingSphere;
  camera.position.copyFrom(sphere.centerWorld).addInPlace(new b.Vector3(0,0,sphere.radiusWorld*2));camera.getViewMatrix(true);
  assert.equal(parent.getLOD(camera),parent);
  camera.position.copyFrom(sphere.centerWorld).addInPlace(new b.Vector3(0,0,sphere.radiusWorld*1000));camera.getViewMatrix(true);
  assert.equal(parent.getLOD(camera),level.mesh);
 }
 for(const m of [...forest,...lod]){assert.equal(m.material,material);assert.equal(m.isPickable,false);assert.equal(m.checkCollisions,false);assert.equal(m.receiveShadows,false);assert.ok(!exterior.shadow.getShadowMap().renderList.includes(m));assert.ok(exterior.sun.includedOnlyMeshes.includes(m));}
 exterior.setVisible(false);assert.ok(land.every(m=>!m.isVisible));exterior.setVisible(true);assert.ok(land.every(m=>m.isVisible));
 exterior.surfaces.fallbackFor(texture);
 assert.ok([...forest,...lod].every(m=>m.visibility===0));assert.ok(parents.every(m=>m.visibility===1&&m.getLODLevels().length===0),'missing impostors restore the detailed originals');
 assert.ok(coast.filter(m=>!m.metadata.forestCount&&!m.metadata.forestLOD).every(m=>m.visibility===1));
 exterior.dispose();exterior.dispose();assert.ok(land.every(m=>m.isDisposed()));assert.ok(!scene.materials.includes(material));assert.ok(!scene.textures.includes(texture));
});
