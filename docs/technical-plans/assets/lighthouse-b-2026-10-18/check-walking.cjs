// Real browser keyboard walking; nominal simulation cases are explicitly separate from wall-clock travel.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const root=path.resolve(__dirname,'../../../..'),out=__dirname,base=process.env.STUDY_URL||'http://127.0.0.1:8171/';
const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/examples',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(id=>id.startsWith('./')?load(id.slice(2)):require(id),m,m.exports);cache.set(name,m.exports);return m.exports;}
const {coastalRoute,coastalRouteLength,COASTAL_SITE:site,COASTAL_HOME:home}=load('CoastalSite');
const walking=load('WalkingSurface'),height=load('CoastalCliff').coastalSurfaceHeight;
const route=[{x:9.35,y:4.65},...coastalRoute().filter(p=>Math.hypot(p.x-site.tower.x,p.y-site.tower.y)>4.65)];
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
 const errors=[],warnings=[],requests=[],record={sourceBaseline:'8110fe7',stage:'lighthouse-B',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,errors,warnings,checks:{},travel:[]};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87});};
 const place=(p,feet)=>page.evaluate(({p,feet})=>{const c=room.firstPersonCamera,support=room.jump;
  c.position.set((p.x-5.4)*5,-5+(feet+1.6)*5,(p.y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
  Object.assign(support,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};}, {p,feet:feet??walking.walkingSurfaceAt(p.x,p.y).height});
 const face=p=>page.evaluate(p=>{const c=room.firstPersonCamera,V=c.position.constructor;c.setTarget(new V((p.x-5.4)*5,c.position.y,(p.y-5.4)*5));c.cameraRotation.setAll(0);c.movement.resetRotationVelocity();},p);
 const state=()=>page.evaluate(()=>{const c=room.firstPersonCamera;return {point:{x:c.position.x/5+5.4,y:c.position.z/5+5.4},feet:room.jump.feet,grounded:room.jump.grounded,position:c.position.asArray(),rotation:c.rotation.asArray(),view:room.currentView,locked:!!document.pointerLockElement,map:document.querySelector('#floor-plan-location').textContent,mini:document.querySelector('#map-mini-title').textContent};});
 const normalTrip=async(name,points)=>{
  await page.evaluate(points=>{const c=room.firstPersonCamera;self.trip={points,index:0,done:false,started:performance.now(),samples:[],lastSample:0};
   self.tripObserver=s.onBeforeRenderObservable.add(()=>{const t=trip,p={x:c.position.x/5+5.4,y:c.position.z/5+5.4};
    while(t.index<t.points.length-1){const a=t.points[t.index],b=t.points[t.index+1];
     if(Math.hypot(p.x-a.x,p.y-a.y)<.45||Math.hypot(p.x-b.x,p.y-b.y)<=Math.hypot(p.x-a.x,p.y-a.y))t.index++;else break;}
    const goal=t.points[Math.min(t.index+2,t.points.length-1)],V=c.position.constructor;c.setTarget(new V((goal.x-5.4)*5,c.position.y,(goal.y-5.4)*5));c.cameraRotation.setAll(0);c.movement.resetRotationVelocity();
    if(performance.now()-t.lastSample>500){t.samples.push({...p,feet:room.jump.feet,grounded:room.jump.grounded,index:t.index});t.lastSample=performance.now();}
    if(t.index===t.points.length-1&&Math.hypot(p.x-goal.x,p.y-goal.y)<.35){t.done=true;t.elapsed=(performance.now()-t.started)/1000;c.inputs.attached.keyboard._keys=[];c.cameraDirection.setAll(0);c.movement.resetPanVelocity();s.onBeforeRenderObservable.remove(tripObserver);}
   });},points);
  await page.keyboard.down('w');
  let last=-1,unchanged=0;
  while(!(await page.evaluate(()=>trip.done))){await page.waitForTimeout(1000);const p=await page.evaluate(()=>({index:trip.index,total:trip.points.length,point:room.firstPersonCamera.position.asArray()}));
   if(p.index===last)unchanged++;else unchanged=0;last=p.index;assert.ok(unchanged<12,`stuck during ${name}: ${JSON.stringify(p)}`);
   assert.ok((await page.evaluate(()=>performance.now()-trip.started))<260000,`travel timeout ${name}`);
   if(p.index%70<5)console.log(name,p.index+'/'+p.total);
  }
  await page.keyboard.up('w');const result=await page.evaluate(()=>({elapsed:trip.elapsed,samples:trip.samples,index:trip.index}));
  for(const p of result.samples){const support=walking.walkingSurfaceAt(p.x,p.y);assert.ok(walking.walkingPointAllowed(p),JSON.stringify(p));assert.ok(support);assert.ok(Math.abs(p.feet-support.height)<.08,JSON.stringify({p,support}));}
  record.travel.push({name,method:'Actual Playwright W key held with normal render loop and engine timing; scripted camera steering only, no in-trip teleports or position assignment',...result,end:await state()});
  console.log(name+' passed in '+result.elapsed.toFixed(2)+' seconds');await shot(name);
 };
 try{
  await page.goto(base,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  record.initialRequests=[...requests];record.actualInitialJsBytes=requests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((n,r)=>n+r.bytes,0);assert.ok(record.actualInitialJsBytes<=3*1048576);
  await require('./browser-harness.cjs').captureRoom(page,cdp);
  await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!self.room&&!!document.pointerLockElement);
  record.resources=await page.evaluate(()=>({metadata:s.metadata,meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,exteriorMeshes:s.meshes.filter(m=>m.metadata?.exterior).length,exteriorVertices:s.meshes.filter(m=>m.metadata?.exterior).reduce((n,m)=>n+m.getTotalVertices(),0)}));
  assert.ok(record.resources.metadata.coastalSite.outdoorWalking);assert.ok(record.resources.exteriorVertices<=160000);assert.equal(record.resources.cameras,3);
  // Initial setup places the player inside the actual entrance; all subsequent trip movement uses input.
  await place(route[0]);await face({x:11.5,y:4.65});await page.mouse.down();await page.mouse.up();await page.waitForTimeout(1100);
  assert.ok(await page.evaluate(()=>Math.abs(s.getTransformNodeByName('entry-door').rotation.y)>1.5),'real entrance interaction opens the leaf');
  record.checks.entryOpened=true;
  await normalTrip('walk-home-to-lighthouse',route);
  await page.keyboard.press('m');const before=await state();assert.equal(await page.locator('#map-scope-coast').getAttribute('aria-pressed'),'true');await shot('lighthouse-map');
  const marker=await page.locator('#floor-plan-drawing .plan-position').getAttribute('transform');assert.ok(marker&&marker.includes('translate'));record.checks.outdoorMap={before,marker};
  await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  assert.deepEqual((await state()).position,before.position);
  await page.keyboard.press('Escape');await page.locator('[data-view="living"]').click();await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  const restored=await state();assert.deepEqual(restored.position,before.position);record.checks.presetRestored=restored;
  const t=site.tower,start=await state(),theta=Math.atan2(start.point.y-t.y,start.point.x-t.x),ring=Array.from({length:80},(_,i)=>({x:t.x+5.5*Math.cos(theta+i/79*Math.PI*2),y:t.y+5.5*Math.sin(theta+i/79*Math.PI*2)}));
  await normalTrip('walk-around-lighthouse',ring);
  await normalTrip('walk-lighthouse-to-home',[...route].reverse());
  assert.equal((await state()).mini,'全屋地图');record.checks.indoorMapRestored=await state();
  await page.keyboard.press('m');await page.locator('#map-scope-coast').click();await page.locator('#coast-return-home').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  const returned=await state();assert.ok(Math.hypot(returned.point.x-home.x,returned.point.y-home.y)<.02);record.checks.activeReturnHome=returned;
  assert.ok(await page.evaluate(()=>Math.abs(s.getTransformNodeByName('entry-door').rotation.y)>1.5),'returning home preserves the door state');
  record.checks.longFrames=[];
  // Controlled input/collision reference cases do not claim wall-clock travel times.
  const references=[{name:'cliff-rail',from:{x:14,y:0},to:{x:19,y:0}},{name:'balcony-rail',from:{x:8,y:11.5},to:{x:8,y:15}},{name:'tower',from:{x:-125,y:84.5},to:{x:-125,y:95.5}}];
  for(const c of references){await place(c.from);await face(c.to);const result=await page.evaluate(()=>{e.stopRenderLoop();const oldDelta=e.getDeltaTime,oldFps=e.getFps;e.getDeltaTime=()=>200;e.getFps=()=>5;room.setMovementSpeed(3);const c=room.firstPersonCamera;c.inputs.attached.keyboard._keys=[87];for(let i=0;i<15;i++)c._checkInputs();c.inputs.attached.keyboard._keys=[];c.cameraDirection.setAll(0);room.setMovementSpeed(1);e.getDeltaTime=oldDelta;e.getFps=oldFps;e.runRenderLoop(room.render);return {x:c.position.x/5+5.4,y:c.position.z/5+5.4,feet:room.jump.feet};});
   assert.ok(walking.walkingPointAllowed(result));assert.ok(Math.hypot(result.x-c.to.x,result.y-c.to.y)>.5);record.checks.longFrames.push({...c,result,referenceStepSeconds:.2,speedMultiplier:3});
  }
  await place({x:-120,y:85});await face(site.tower);await page.keyboard.press('Space');let apex=3.04;
  for(let i=0;i<24;i++){await page.waitForTimeout(50);apex=Math.max(apex,(await state()).feet);}assert.ok(apex>3.5);assert.ok((await state()).grounded);record.checks.outdoorJump={apex,landed:await state()};await shot('outdoor-jump-landed');
  for(const [name,p,top]of [['bed',{x:2.1,y:8.45},.73],['sofa',{x:10.24,y:8.4},.441],['coffee-table',{x:8.7,y:8.4},.468],['chair',{x:6.9,y:1.8},.561]]){
   await place(p,0);await page.keyboard.press('Space');await page.waitForTimeout(1500);assert.ok(Math.abs((await state()).feet-top)<.01,name);record.checks['jump-'+name]=await state();
  }
  await place(home);await page.evaluate(()=>{room.firstPersonCamera.position.x=NaN;room.updateFirstPersonHeight();});const recovered=await state();assert.ok(Number.isFinite(recovered.point.x)&&walking.walkingPointAllowed(recovered.point));record.checks.invalidCoordinateRecovery=recovered;
  await page.keyboard.press('Escape');await page.locator('#floor-plan-toggle').click();await page.locator('#map-scope-coast').click();await page.locator('#coast-preview').click();await page.waitForTimeout(500);await shot('coast-overview');
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.requests=requests;record.browser=browser.version();record.passed=true;
 }finally{fs.writeFileSync(path.join(out,record.passed?'browser.json':'browser-partial.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log('Lighthouse B walking checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
