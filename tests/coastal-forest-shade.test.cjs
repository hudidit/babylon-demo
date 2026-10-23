const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const b=require('@babylonjs/core/pure');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const baseline=require('../docs/technical-plans/assets/island-grounding-2026-10-23/structure-before.json');
const {forestGroundShade}=load('CoastalForestShade');
load('RoomRuntime').registerRoomRuntime();

test('static forest shade has bounded soft edges, stable overlap and continuous spatial buckets',()=>{
 assert.equal(forestGroundShade([])(0,0),1);
 const tree={x:-32,y:32,height:6,width:10},group={trees:[tree]},shade=forestGroundShade([group]);
 const copy=JSON.stringify(group);assert.ok(shade(-32,32)<.35);
 let previous=0;for(let d=0;d<=10;d+=.05){const value=shade(tree.x+d,tree.y);assert.ok(value>=previous-1e-12&&value>=.28-1e-12&&value<=1);previous=value;}
 assert.equal(shade(100,100),1);
 assert.ok(Math.abs(shade(-32-1e-7,32)-shade(-32+1e-7,32))<1e-7);
 const overlap=forestGroundShade([group,group]);assert.equal(overlap(-32,32),shade(-32,32),'overlap cannot turn into black puddles');
 const moved=forestGroundShade([{trees:[{...tree,x:tree.x+64,y:tree.y-64}]}]);
 for(let x=-40;x<-20;x+=.3)assert.ok(Math.abs(shade(x,33)-moved(x+64,-31))<1e-12);
 assert.equal(JSON.stringify(group),copy,'source layout is read-only');
});

test('ground-only color baking preserves geometry, buffer sizes, non-ground colors and shadow casters',t=>{
 const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
 const room=new(load('RoomExterior').RoomExterior)(scene);t.after(()=>{room.dispose();scene.dispose();engine.dispose();});
 const ground=room.meshes.filter(m=>[room.surfaces.ground,room.surfaces.farGround].includes(m.material));
 const geometry=crypto.createHash('sha256'),other=crypto.createHash('sha256');
 for(const m of room.meshes){geometry.update(m.name);for(const key of ['position','normal','uv'])geometry.update(JSON.stringify(Array.from(m.getVerticesData(key)||[])));geometry.update(JSON.stringify(Array.from(m.getIndices()||[])));if(!ground.includes(m))other.update(JSON.stringify(Array.from(m.getVerticesData('color')||[])));}
 assert.equal(geometry.digest('hex'),baseline.geometrySha256);assert.equal(other.digest('hex'),baseline.nonGroundColorsSha256);
 assert.equal(room.meshes.length,baseline.meshes);assert.equal(room.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),baseline.vertices);
 for(const key of ['materials','textures','lights'])assert.equal(scene[key].length,baseline[key]);
 assert.deepEqual(room.shadow.getShadowMap().renderList.map(m=>m.name),baseline.casters);
 assert.deepEqual(ground.map(m=>({name:m.name,vertices:m.getTotalVertices(),colors:m.getVerticesData('color').length})),baseline.ground);
 const seen=new Map();let darkened=0,seams=0;
 for(const m of ground){const p=m.getVerticesData('position'),c=m.getVerticesData('color');
  for(let i=0;i<p.length/3;i++){
   const rgb=c.slice(i*4,i*4+3);assert.ok(rgb.every(v=>v>0&&v<=1));assert.equal(c[i*4+3],1);
   if(rgb[0]<.99)darkened++;
   const x=p[i*3]/5+5.4,y=p[i*3+2]/5+5.4;
   if(x>=0&&x<=10&&y>=0&&y<=10)assert.deepEqual(Array.from(rgb),[1,1,1],'house clearing stays unchanged');
   const key=Array.from(p.slice(i*3,i*3+3)).map(v=>v.toFixed(6)).join(',');
   if(seen.has(key)){assert.ok(rgb.every((v,j)=>Math.abs(v-seen.get(key)[j])<1e-6));seams++;}else seen.set(key,rgb);
  }
 }
 assert.ok(darkened>10000);assert.ok(seams>200);
 const groups=load('CoastalLandscape').coastalLandscape(),cells=load('CoastalForest').coastalForest(groups);
 const near=[...groups.flatMap(g=>g.trees),...cells.flatMap(g=>g.trees).filter(t=>t.detailFirst!==undefined)];
 for(const tree of near){const p=load('HouseLayout').planToWorld(tree,60);
  const hit=scene.pickWithRay(new b.Ray(new b.Vector3(p.x,p.y,p.z),new b.Vector3(0,-1,0),500),m=>ground.includes(m));assert.ok(hit.hit);
  const m=hit.pickedMesh,ids=m.getIndices().slice(hit.faceId*3,hit.faceId*3+3),colors=m.getVerticesData('color');
  const contact=ids.reduce((sum,id,i)=>sum+colors[id*4]*[hit.bu,hit.bv,1-hit.bu-hit.bv][i],0);
  assert.ok(contact<.8,`actual ground triangle beneath ${tree.x},${tree.y} must be visibly shaded`);
 }
 const colors=()=>JSON.stringify(ground.map(m=>Array.from(m.getVerticesData('color')))),before=colors();
 for(const hour of [0,6,12,18])room.applyTimeOfDay(load('RoomTimeOfDay').evaluateTimeOfDay(hour));
 room.setVisible(false);room.setVisible(true);assert.equal(colors(),before,'time and visibility do not rebake or move the shade');
});

test('shader whitespace reclamation preserves existing surface and finish tokens',t=>{
 const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
 const hash=crypto.createHash('sha256');
 for(const [mod,cls,kinds]of [['CoastalMaterials','CoastalSurface',['rock','ground']],['CoastalFinish','CoastalFinish',['plaster','wood','path','paving','roof']]])
  for(const kind of kinds){const p=new(load(mod)[cls])(new b.PBRMaterial(kind,scene),kind,{});hash.update(JSON.stringify(p.getCustomCode('fragment')).replace(/\s|\\n/g,''));}
 assert.equal(hash.digest('hex'),baseline.surfaceShaderTokensSha256);
});
