// Position fixtures isolate former slow zones; reference timesteps are behavior checks, not FPS measurements.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const v=require('../lighthouse-d-2026-10-18/source-loader.cjs')('CoastalScooter');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const record={baseline:'69606ac',fpsOrLoadingBenchmark:false,method:'Final production dist; pose/speed fixtures and explicit fixed reference timesteps with actual W/Space/S/E/M events. No claim of new full-route travel time.',errors:[],warnings:[],requests:[],zones:[],obstacles:[]};
 page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});page.on('response',r=>record.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const state=()=>page.evaluate(()=>({vehicle:{...room.scooter},hint:document.querySelector('#interaction-hint').textContent,riding:room.scooter.riding,locked:!!document.pointerLockElement,roomLocked:room.pointerLocked,view:room.currentView,mapOpen:room.floorPlan.isOpen,controlsEnabled:room.controlsEnabled,pauses:room.pauseReasons,hidden:document.hidden,inputs:{...room.scooterInput}}));
 const fixture=async(p,speed)=>page.evaluate(({p,speed})=>{room.pauseScooter();room.scooterTransition=undefined;Object.assign(room.scooter,p,{speed,distance:0,riding:true,exitRequested:false,steer:0});room.scooterModel.update(room.scooter,true);room.firstPersonCamera.rotation.set(.08,p.heading,0);room.placeRiderCamera();room.updateControls();room.updateFloorPlan();},{p,speed});
 const step=(n,dt)=>page.evaluate(({n,dt})=>{e.getDeltaTime=()=>dt*1000;for(let i=0;i<n;i++)if(room.scooter.riding||room.scooterTransition)room.updateScooter();room.updateInteractionHint();s.render();},{n,dt});
 try{
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8196/',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  record.initialRequests=[...record.requests];record.actualInitialJsBytes=record.initialRequests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((n,r)=>n+r.bytes,0);assert.ok(record.actualInitialJsBytes<=3*1048576);
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await page.locator('[data-view="first-person"]').click();
  await page.waitForFunction(()=>!!document.pointerLockElement&&room.pointerLocked&&room.controlsEnabled&&room.currentView==='first-person'&&!document.hidden);
  await page.evaluate(()=>e.stopRenderLoop());record.initialControlReady=await state();record.cruiseProbes=[];
  for(const p of [...v.SCOOTER_PARKING,{id:'bend-east',x:-4,y:-5,heading:-.75},{id:'bend-west',x:-56,y:8,heading:-1},{id:'edge-approach',x:14,y:0,heading:Math.PI/2}]){
   await fixture(p,v.SCOOTER.cruise);const before=await state();await page.keyboard.down('w');const requested=await state();await step(1,1/60);await page.keyboard.up('w');const cruising=await state();record.latestCruiseProbe={id:p.id,before,requested,cruising};record.cruiseProbes.push(record.latestCruiseProbe);assert.equal(cruising.vehicle.speed,v.SCOOTER.cruise,JSON.stringify(record.latestCruiseProbe));assert.ok(v.scooterSupport(cruising.vehicle));assert.match(cruising.hint,/骑行 40 km\/h/);
   if(p.id==='home')await page.screenshot({path:path.join(__dirname,'home-40-kmh.jpg'),type:'jpeg',quality:86});
   await fixture(p,3);await page.keyboard.down('w');await step(1,1/60);await page.keyboard.up('w');const accelerating=await state();assert.ok(accelerating.vehicle.speed>3,p.id);record.zones.push({id:p.id,cruising,accelerating});
  }
  for(const p of [{id:'fence',x:14,y:0,heading:Math.PI/2},{id:'tower',x:-125,y:84,heading:0},{id:'house',x:13.3,y:4.65,heading:-Math.PI/2}]){
   await fixture(p,v.SCOOTER.cruise);await page.keyboard.down('w');await step(15,.2);await page.keyboard.up('w');const stopped=await state();assert.equal(stopped.vehicle.speed,0,p.id);assert.ok(v.scooterSupport(stopped.vehicle));record.obstacles.push({id:p.id,referenceFrameSeconds:.2,frames:15,...stopped});
  }
  await fixture(v.SCOOTER_PARKING[0],5);await page.keyboard.down('Space');await step(5,.2);await page.keyboard.up('Space');assert.equal((await state()).vehicle.speed,0);record.spaceBrakes=true;
  await page.keyboard.down('s');await step(4,.2);await page.keyboard.up('s');assert.equal((await state()).vehicle.speed,-1);record.reverseBounded=true;
  await fixture(v.SCOOTER_PARKING[0],4);await page.keyboard.press('m');assert.equal((await state()).vehicle.speed,0);assert.equal(await page.locator('#floor-plan-dialog').evaluate(n=>n.open),true);await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await step(1,.1);assert.equal((await state()).vehicle.speed,0);record.mapPauses=true;
  await fixture(v.SCOOTER_PARKING[0],0);await page.waitForFunction(()=>room.pointerLocked&&!room.floorPlan.isOpen);record.dismountBefore=await state();await page.keyboard.press('e');record.dismountRequested=await state();await step(6,.1);record.dismountAfter=await state();assert.equal(record.dismountAfter.vehicle.riding,false,JSON.stringify(record.dismountAfter));record.safeDismount=true;
  await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});record.inspector=true;
  await page.waitForFunction(()=>!document.querySelector('#inspect-btn').disabled);await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!s.debugLayer.isVisible());
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.warnings,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{fs.writeFileSync(path.join(__dirname,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,zones:record.zones.length,obstacles:record.obstacles.length,actualInitialJsBytes:record.actualInitialJsBytes}));
})().catch(e=>{console.error(e);process.exitCode=1;});
