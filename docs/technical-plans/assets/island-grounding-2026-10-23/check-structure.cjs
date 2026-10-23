const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const b=require('@babylonjs/core/pure'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const root=path.resolve(__dirname,'../../../..'),baseline=require('./structure-before.json');
load('RoomRuntime').registerRoomRuntime();
const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
const room=new(load('RoomExterior').RoomExterior)(scene),groups=load('CoastalLandscape').coastalLandscape(),cells=load('CoastalForest').coastalForest(groups);
const original=groups.flatMap(g=>g.trees),trees=cells.flatMap(g=>g.trees),ground=room.meshes.filter(m=>[room.surfaces.ground,room.surfaces.farGround].includes(m.material));
const geometry=crypto.createHash('sha256'),other=crypto.createHash('sha256');
for(const m of room.meshes){geometry.update(m.name);for(const key of ['position','normal','uv'])geometry.update(JSON.stringify(Array.from(m.getVerticesData(key)||[])));geometry.update(JSON.stringify(Array.from(m.getIndices()||[])));if(!ground.includes(m))other.update(JSON.stringify(Array.from(m.getVerticesData('color')||[])));}
const result={baseline:'bfe0c62',geometrySha256:geometry.digest('hex'),nonGroundColorsSha256:other.digest('hex'),meshes:room.meshes.length,vertices:room.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),materials:scene.materials.length,textures:scene.textures.length,lights:scene.lights.length,casters:room.shadow.getShadowMap().renderList.map(m=>m.name)};
for(const key of Object.keys(result))assert.deepEqual(result[key],baseline[key]);
result.ground=ground.map(m=>({name:m.name,vertices:m.getTotalVertices(),colorElements:m.getVerticesData('color').length,darkVertices:m.getVerticesData('color').filter((v,i)=>i%4===0&&v<.99).length}));
const oldColors=new Map(groups.filter(g=>g.ground).map(g=>[`coastal-landscape-${g.name}-ground`,g.ground.colors]));
const summary=values=>({min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,v)=>a+v,0)/values.length});
result.contact={};
for(const [name,samples]of [['original88',original],['detailed93',trees.filter(t=>t.detailFirst!==undefined)],['stratifiedFar',trees.filter((_,i)=>i%40===0)]]){
 const colors=[],ratios=[];
 for(const tree of samples){const p=load('HouseLayout').planToWorld(tree,60),hit=scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,-1,0),500),m=>ground.includes(m));assert.ok(hit.hit);
  const m=hit.pickedMesh,ids=m.getIndices().slice(hit.faceId*3,hit.faceId*3+3),c=m.getVerticesData('color'),old=oldColors.get(m.name),weights=[hit.bu,hit.bv,1-hit.bu-hit.bv];
  const actual=ids.reduce((n,id,i)=>n+c[id*4]*weights[i],0),previous=ids.reduce((n,id,i)=>n+(old?old[id*4]:1)*weights[i],0);
  colors.push(actual);ratios.push(actual/previous);
 }
 result.contact[name]={samples:samples.length,linearRed:summary(colors),attenuationRatio:summary(ratios)};
}
const shade=load('CoastalForestShade').forestGroundShade([...groups,...cells]);
const hypot=Math.hypot;let evaluations=0;
try{Math.hypot=(...args)=>{evaluations++;return hypot(...args);};for(const m of ground){const p=m.getVerticesData('position');for(let i=0;i<p.length;i+=3)shade(p[i]/5+5.4,p[i+2]/5+5.4);}}finally{Math.hypot=hypot;}
const vertices=ground.reduce((n,m)=>n+m.getTotalVertices(),0);
result.initialization={plants:original.length+trees.length,groundVertices:vertices,candidateDistanceEvaluations:evaluations,fullAllPairsEvaluations:vertices*(original.length+trees.length),existingColorBufferBytes:vertices*4*4,addedColorBufferBytes:0,method:'Count standalone static field queries on current ground vertices; not timing, loading-speed or FPS measurement.'};
assert.ok(evaluations<result.initialization.fullAllPairsEvaluations/20);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
result.sources=Object.fromEntries(['src/examples/CoastalForestShade.ts','src/examples/RoomExterior.ts','src/examples/CoastalMaterials.ts','src/examples/CoastalFinish.ts','src/examples/CoastalForest.ts','src/examples/CoastalLandscape.ts','src/examples/CoastalCliff.ts','tests/coastal-forest-shade.test.cjs','public/environment/coastal-cliff-source.json','public/STUDY_ASSET_SOURCES.md'].map(p=>[p,sha(p)]));
result.passed=true;fs.writeFileSync(path.join(__dirname,'structure-after.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({contact:result.contact,initialization:result.initialization,passed:true},null,2));
room.dispose();scene.dispose();engine.dispose();
