// Production-only spatial/functional evidence. Controller calibration is not a real walking or FPS test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const root=path.resolve(__dirname,'../../../..'),output=__dirname,url=process.env.STUDY_URL||'http://127.0.0.1:8170/';
const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/examples',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(id=>load(id.slice(2)),m,m.exports);cache.set(name,m.exports);return m.exports;}
const {coastalRoute,coastalRouteLength,COASTAL_SITE:site}=load('CoastalSite'),{coastalSurfaceHeight:height}=load('CoastalCliff');
const route=coastalRoute(),length=coastalRouteLength(height);
const maximumGrade=Math.max(...route.slice(1).map((p,i)=>Math.abs(height(p.x,p.y)-height(route[i].x,route[i].y))/Math.hypot(p.x-route[i].x,p.y-route[i].y)));
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],warnings=[],requests=[];
 const record={baseline:'2169624 + lighthouse A',browser:browser.version(),fpsOrLoadTimeSampling:false,outdoorWalking:false,routeLengthMetres:length,maximumGrade,views:[],errors,warnings};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const render=(n=4)=>page.evaluate(async n=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=1;i<n;i++)s.render();},n);
 const shot=async(name)=>{await render();await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:88});record.views.push({name,...await page.evaluate(()=>({camera:s.activeCamera.name,position:s.activeCamera.position.asArray(),target:s.activeCamera.getTarget().asArray(),viewport:[innerWidth,innerHeight]}))});};
 const world=(x,y,h=0)=>[(x-5.4)*5,-5+h*5,(y-5.4)*5];
 const pose=async(position,target)=>{await page.evaluate(({position,target})=>{const c=s.activeCamera,V=c.position.constructor;c.lowerRadiusLimit=.1;c.upperRadiusLimit=6000;c.upperBetaLimit=Math.PI-.01;c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;c.setTarget(new V(...target));c.setPosition(new V(...position));c.getViewMatrix(true);c.getProjectionMatrix(true);},{position,target});await render();};
 const mapCoast=async()=>{await page.locator('#floor-plan-toggle').click();await page.locator('#map-scope-coast').click();};
 try{
  await page.goto(url,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  record.initialRequests=[...requests];record.actualInitialJsBytes=requests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((n,r)=>n+r.bytes,0);
  assert.ok(record.actualInitialJsBytes<=3*1048576);
  await page.evaluate(()=>{webpackChunkbabylon_learning.push([[987624],{},r=>self.req=r]);for(const[id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;e.stopRenderLoop();e.getDeltaTime=()=>1000/60;}});
  await render();
  record.resources=await page.evaluate(()=>({metadata:s.metadata,meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,
   exteriorMeshes:s.meshes.filter(m=>m.metadata?.exterior).length,exteriorVertices:s.meshes.filter(m=>m.metadata?.exterior).reduce((n,m)=>n+m.getTotalVertices(),0),
   shoreField:s.getMaterialByName('coastal-ocean').getActiveTextures().map(t=>({name:t.name,size:t.getSize(),gamma:t.gammaSpace})),
   outdoorCollisionMeshes:s.meshes.filter(m=>m.metadata?.exterior&&m.checkCollisions).map(m=>m.name)}));
  assert.equal(record.resources.metadata.coastalSite.outdoorWalking,false);assert.equal(record.resources.cameras,3);assert.ok(record.resources.exteriorVertices<=160000);
  assert.deepEqual(record.resources.outdoorCollisionMeshes,[]);
  await mapCoast();await shot('coast-map-desktop');
  assert.equal(await page.locator('#coast-route-length').textContent(),length.toFixed(0));
  assert.equal(await page.locator('#house-map-notes').isVisible(),false);assert.equal(await page.locator('#coast-map-notes').isVisible(),true);
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#floor-plan-dialog').contains(document.activeElement)));
  await page.locator('#coast-preview').click();await shot('coast-overview');
  record.overview=await page.evaluate(()=>{e._drawCalls.fetchNewFrame();s.render();return{draws:e._drawCalls.current,roof:s.getMeshByName('coastal-house-roof-graybox').isVisible,
    wallAlpha:s.getMaterialByName('house-wall-paint')?.alpha,landmarkVisible:s.getMeshByName('coastal-lighthouse-shaft').isVisible};});
  assert.ok(record.overview.roof&&record.overview.landmarkVisible);
  const l=site.lookout,t=site.tower;
  await pose(world(l.x,l.y,height(l.x,l.y)+1.6),world(t.x,t.y,t.ground+11));await shot('lookout-toward-lighthouse');
  await pose(world(l.x,l.y,height(l.x,l.y)+1.6),world(5.4,5.4,2.3));await shot('lookout-back-to-house');
  await pose(world(t.x,t.y-7,t.ground+1.6),world(5.4,5.4,2.3));await shot('lighthouse-back-to-house');
  await pose(world(t.x+26,t.y-32,t.ground+1.6),world(t.x,t.y,t.ground+10));await shot('lighthouse-massing-close');
  await pose(world(-34,8,height(-34,8)+1.6),world(-55,12,height(-55,12)+1.6));await shot('path-original-coast-pinch');
  // Geometry line-of-sight evidence supplements, rather than replaces, screenshots.
  record.sightlines=await page.evaluate(({pairs})=>{
   const c=s.activeCamera,V=c.position.constructor,R=s.getCameraByName('study-first-person').getForwardRay().constructor;
   return pairs.map(({name,a,b})=>{const start=new V(...a),end=new V(...b),delta=end.subtract(start),distance=delta.length();
    const hit=s.pickWithRay(new R(start,delta.normalize(),distance),m=>m.metadata?.exteriorLayer==='terrain'||m.metadata?.exteriorLayer==='cliff');
    return{name,distance,firstHit:hit.hit?{name:hit.pickedMesh.name,distance:hit.distance}:null,clear:!hit.hit||hit.distance>=distance-2};});
  },{pairs:[{name:'balcony-to-tower-top',a:world(8.1,11.45,1.6),b:world(t.x,t.y,t.ground+18)},
    {name:'lookout-to-house-roof',a:world(l.x,l.y,height(l.x,l.y)+1.6),b:world(5.4,5.4,3.1)},
    {name:'tower-plaza-to-house-roof',a:world(t.x,t.y-7,t.ground+1.6),b:world(5.4,5.4,3.1)}]});
  assert.ok(record.sightlines.every(p=>p.clear),JSON.stringify(record.sightlines));
  await page.locator('[data-view="first-person"]').click();
  await page.evaluate(({position,target})=>{const c=s.activeCamera,V=c.position.constructor;c.position.set(...position);c.setTarget(new V(...target));c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();},{position:world(8.1,11.45,1.6),target:world(t.x,t.y,t.ground+11)});
  await shot('balcony-right-lighthouse');
  if(await page.evaluate(()=>!!document.pointerLockElement))await page.keyboard.press('Escape');
  await page.locator('[data-view="overview"]').click();await render();
  assert.equal(await page.evaluate(()=>s.getMeshByName('coastal-house-roof-graybox').isVisible),false);
  record.controllerCalibration=await page.evaluate(({routeLength})=>{
   const real=s.getCameraByName('study-first-person'),probe=new real.constructor('stage-a-speed-probe',real.position.clone(),s),old=s.activeCamera,oldFps=e.getFps,oldDelta=e.getDeltaTime;
   probe.speed=real.speed;probe.inertia=real.inertia;probe.keysUp=[...real.keysUp];probe.checkCollisions=false;probe.rotation.setAll(0);probe.attachControl(e.getRenderingCanvas(),true);
   e.getFps=()=>60;e.getDeltaTime=()=>1000/60;s.activeCamera=probe;
   try{probe.inputs.attached.keyboard._keys=[87];for(let i=0;i<60;i++)probe._checkInputs();const start=probe.position.clone();for(let i=0;i<120;i++)probe._checkInputs();
    const metresPerSecond=probe.position.subtract(start).length()/5/2;
    return{method:'camera keyboard/controller calibration with fixed 60Hz reference steps on an unconstrained probe; NOT an outdoor walking test or FPS measurement',base:real.speed,metresPerSecond,routeSeconds:routeLength/metresPerSecond};
   }finally{probe.detachControl();s.activeCamera=old;probe.dispose();e.getFps=oldFps;e.getDeltaTime=oldDelta;}
  },{routeLength:length});
  assert.ok(record.controllerCalibration.metresPerSecond>0);
  for(const [width,h,name]of [[390,844,'portrait'],[844,390,'landscape']]){
   await page.setViewportSize({width,height:h});await mapCoast();await shot('coast-map-'+name);
   assert.ok(await page.locator('#coast-preview').isVisible());await page.locator('#coast-preview').click();await shot('coast-overview-'+name);
  }
  await page.setViewportSize({width:1280,height:800});await page.locator('[data-view="balcony"]').click();await shot('balcony-preserved');
  record.animationTimes=[];for(let i=0;i<4;i++){await render(12);record.animationTimes.push(await page.evaluate(()=>s.getMaterialByName('coastal-ocean')._floats.oceanTime));}
  assert.ok(record.animationTimes.every((t,i,a)=>!i||t>a[i-1]));
  await mapCoast();await page.locator('#map-scope-house').click();assert.equal(await page.locator('#floor-plan-drawing [data-room]').count(),8);
  await page.locator('#floor-plan-return').click();
  record.finalCameras=await page.evaluate(()=>s.cameras.length);assert.equal(record.finalCameras,3);
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.requests=requests;
  record.passed=true;fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({routeLength:length,js:record.actualInitialJsBytes,resources:record.resources,calibration:record.controllerCalibration,sightlines:record.sightlines,warnings,views:record.views.length}));
 }finally{if(!record.passed)fs.writeFileSync(path.join(output,'browser-partial.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
