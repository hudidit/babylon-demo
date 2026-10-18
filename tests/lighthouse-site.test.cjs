const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const b = require('@babylonjs/core/pure');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/examples',name+'.ts'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','module','exports',code)(id => id.startsWith('./') ? load(id.slice(2)) : require(id),module,module.exports);
  cache.set(name,module.exports); return module.exports;
}
load('RoomRuntime').registerRoomRuntime();
const {COASTAL_SITE,coastalRoute,coastalRouteLength} = load('CoastalSite');
const {COASTAL_CLIFF,coastalCrestY,coastalSurfaceHeight,coastalLandPatch} = load('CoastalCliff');
const {planToWorld} = load('HouseLayout');

test('the entire rounded path width rests on land and clears the original coast pinch point', () => {
  const route=coastalRoute(),half=COASTAL_SITE.pathWidth/2;
  assert.ok(coastalRouteLength(coastalSurfaceHeight)>=190 && coastalRouteLength(coastalSurfaceHeight)<=230);
  assert.deepEqual(route[0],{x:10.8,y:4.65});
  assert.deepEqual(route.at(-1),{x:COASTAL_SITE.tower.x,y:COASTAL_SITE.tower.y});
  for(let i=0;i<route.length;i++){
    const p=route[i],a=route[Math.max(0,i-1)],z=route[Math.min(route.length-1,i+1)],dx=z.x-a.x,dy=z.y-a.y,n=Math.hypot(dx,dy);
    if(i)assert.ok(Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y)<=.301);
    if(i)assert.ok(Math.abs(coastalSurfaceHeight(p.x,p.y)-coastalSurfaceHeight(route[i-1].x,route[i-1].y))
      /Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y)<=.08,'the main road must keep its planned 8% maximum grade');
    for(const offset of [-half,0,half]){
      const x=p.x-dy/n*offset,y=p.y+dx/n*offset;
      assert.ok(Number.isFinite(coastalSurfaceHeight(x,y)),`missing path support at ${x},${y}`);
      assert.ok(coastalCrestY(x)-y>=4,`path too close to crest at ${x},${y}`);
    }
  }
  for(const dx of [-7,0,7])for(const dy of [-9,0,9])
    assert.ok(Math.abs(coastalSurfaceHeight(COASTAL_SITE.tower.x+dx,COASTAL_SITE.tower.y+dy)-3)<1e-8,'tower plaza is level and fully supported');
});

test('placement heights equal hits on actual terrain triangles instead of the continuous height formula', t => {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);t.after(()=>{scene.dispose();engine.dispose();});
  const mesh=new b.Mesh('land',scene),g=coastalLandPatch(0,COASTAL_CLIFF.columns,0,COASTAL_CLIFF.nearRows),vd=new b.VertexData();
  vd.positions=g.positions;vd.indices=g.indices;vd.applyToMesh(mesh);mesh.computeWorldMatrix(true);
  for(const p of coastalRoute().filter((_,i)=>i%13===0)){
    const v=planToWorld(p,20),hit=scene.pickWithRay(new b.Ray(new b.Vector3(v.x,v.y,v.z),new b.Vector3(0,-1,0),150));
    assert.ok(hit.hit);
    assert.ok(Math.abs((hit.pickedPoint.y+5)/5-coastalSurfaceHeight(p.x,p.y))<2e-5);
  }
  assert.equal(coastalSurfaceHeight(-125,120),undefined,'the sea must not provide a phantom support height');
});

test('the expanded shoreline field covers the new cape with the existing near-house sampling density', () => {
  const {OCEAN_FIELD:f,coastalShoreField,coastalShoreDistance}=load('CoastalOcean'),data=coastalShoreField();
  assert.ok(f.width/f.size<=135/256 && f.depth/f.size<=155/256);
  for(const p of [{x:-125,y:90},{x:-125,y:120},{x:-144,y:95},{x:8.1,y:40}]){
    const col=Math.floor((p.x-f.minX)/f.width*f.size),row=Math.floor((p.y-f.minY)/f.depth*f.size);
    assert.ok(col>=0&&row>=0&&col<f.size&&row<f.size);
    const i=(row*f.size+col)*4,actual=((data[i]*256+data[i+1])/65535*2-1)*f.range;
    const exact=coastalShoreDistance(f.minX+(col+.5)/f.size*f.width,f.minY+(row+.5)/f.size*f.depth);
    assert.ok(Math.abs(actual-Math.max(-f.range,Math.min(f.range,exact)))<.002);
  }
});

test('coast map landmarks follow the existing house map and a real north-up left-handed camera', () => {
  const {coastalDrawingPoint:p,coastalPlanSvg}=load('CoastalMap');
  const view=b.Matrix.LookAtLH(new b.Vector3(0,1000,0),b.Vector3.Zero(),new b.Vector3(0,0,-1));
  const transform=view.multiply(b.Matrix.OrthoLH(2000,2000,.1,3000));
  const project=point=>{const q=planToWorld(point);return b.Vector3.Project(new b.Vector3(q.x,q.y,q.z),b.Matrix.Identity(),transform,new b.Viewport(0,0,600,600));};
  const points=[{x:5.4,y:5.4},COASTAL_SITE.lookout,COASTAL_SITE.tower];
  for(const a of points)for(const z of points){
    assert.equal(Math.sign(p(a.x,a.y).x-p(z.x,z.y).x),Math.sign(project(a).x-project(z).x));
    assert.equal(Math.sign(p(a.x,a.y).y-p(z.x,z.y).y),Math.sign(project(a).y-project(z).y));
  }
  const svg=coastalPlanSvg();assert.ok(!/NaN|undefined/.test(svg));assert.match(svg,/室外步行尚未开放/);
});

test('graybox road faces remain above the actual land and do not unlock outdoor collisions', t => {
  const engine=new b.NullEngine(),scene=new b.Scene(engine);scene.useDelayedTextureLoading=true;
  t.after(()=>{scene.dispose();engine.dispose();});
  const exterior=new(load('RoomExterior').RoomExterior)(scene),mesh=scene.getMeshByName('coastal-lighthouse-path');
  const p=mesh.getVerticesData(b.VertexBuffer.PositionKind),indices=mesh.getIndices();
  for(let i=0;i<indices.length;i+=3){
    const points=indices.slice(i,i+3).map(index=>p.slice(index*3,index*3+3));
    const centre=[0,1,2].map(axis=>points.reduce((sum,a)=>sum+a[axis]/3,0));
    const clearance=(centre[1]+5)/5-coastalSurfaceHeight(centre[0]/5+5.4,centre[2]/5+5.4);
    assert.ok(clearance>=0 && clearance<.08,'a road face must not cut through or float above the terrain');
  }
  assert.equal(scene.metadata.coastalSite.outdoorWalking,false);
  assert.ok(exterior.meshes.every(m=>!m.checkCollisions));
  exterior.setHouseEnclosed(false);assert.equal(scene.getMeshByName('coastal-house-roof-graybox').isVisible,false);
  exterior.setHouseEnclosed(true);assert.equal(scene.getMeshByName('coastal-house-roof-graybox').isVisible,true);
});
