// Real keyboard events with fixed reference simulation steps; no FPS/load-time sampling.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),walking=load('WalkingSurface'),v=load('CoastalScooter');
const before=require('../../../../tests/fixtures/coastal-obstacles-before.json');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const record={baseline:before.baseline,method:'Production dist, real W/E/Space/M events, pose fixtures, fixed reference simulation steps; no in-segment teleports or performance measurements.',errors:[],warnings:[],requests:[],walking:[],riding:[],blocked:[]};
 page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});page.on('response',r=>record.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const shot=async name=>{await page.evaluate(()=>{e.getDeltaTime=()=>0;e.runRenderLoop(self.shotRender=()=>s.render());});await page.waitForTimeout(180);await page.screenshot({path:path.join(__dirname,name+'.jpg'),type:'jpeg',quality:86});await page.evaluate(()=>{e.stopRenderLoop(shotRender);e.getDeltaTime=()=>1000/60;});};
 const pose=async(p,riding=false)=>page.evaluate(({p,riding,parking})=>{
  room.pauseScooter();room.scooterTransition=undefined;room.ladder.attached=false;
  Object.assign(room.scooter,riding?p:parking,{riding,speed:riding?2:0,distance:0,steer:0,exitRequested:false});
  const c=room.firstPersonCamera;c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
  c.rotation.set(.12,p.heading,0);const feet=p.height;
  c.position.set((p.x-5.4)*5,-5+(feet+1.6)*5,(p.y-5.4)*5);
  Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};
  room.scooterModel.update(room.scooter,true);if(riding)room.placeRiderCamera();room.updateControls();room.updateFloorPlan();room.updateInteractionHint();c.getViewMatrix(true);
 },{p:{...p,height:walking.walkingSurfaceAt(p.x,p.y).height},riding,parking:v.SCOOTER_PARKING[0]});
 const state=()=>page.evaluate(()=>({point:{x:room.firstPersonCamera.position.x/5+5.4,y:room.firstPersonCamera.position.z/5+5.4},feet:room.jump.feet,grounded:room.jump.grounded,scooter:{...room.scooter},locked:!!document.pointerLockElement,controls:room.controlsEnabled}));
 const step=async(n,dt=1/60)=>page.evaluate(({n,dt})=>{e.getDeltaTime=()=>dt*1000;for(let i=0;i<n;i++)room.updateScooter();room.updateInteractionHint();s.render();},{n,dt});
 try{
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8213/',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  record.initialJs=record.requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>1000/60;e.getFps=()=>60;});
  record.removedMeshes=await page.evaluate(obstacles=>{
   const g=s.getMeshByName('coastal-anchored-rocks').getVerticesData('position');
   const tops=[];for(let i=0;i<g.length;i+=45*3)tops.push({x:g[i]/5+5.4,y:g[i+2]/5+5.4});
   return obstacles.map(o=>({x:o.x,y:o.y,absent:tops.every(p=>Math.hypot(o.x-p.x,o.y-p.y)>1e-5)}));
  },before.obstacles);assert.ok(record.removedMeshes.every(r=>r.absent));
  for(const [id,site]of [['house-side',before.obstacles[2]],['path-side',before.obstacles[8]]])for(const reverse of [false,true]){
   const sign=reverse?-1:1,p={x:site.x,y:site.y-sign*2.5,heading:reverse?Math.PI:0};await pose(p);
   await page.keyboard.down('w');const result=await page.evaluate(({site,sign})=>{
    const c=room.firstPersonCamera;let frames=0;
    while(frames<600&&(c.position.z/5+5.4-site.y)*sign<2.3){c._checkInputs();frames++;}
    return{frames,point:{x:c.position.x/5+5.4,y:c.position.z/5+5.4},feet:room.jump.feet,grounded:room.jump.grounded};
   },{site,sign});await page.keyboard.up('w');
   assert.ok((result.point.y-site.y)*sign>=2.3,JSON.stringify({id,reverse,result}));assert.ok(result.grounded);assert.ok(walking.walkingPointAllowed(result.point));record.walking.push({id,reverse,...result});
   if(!reverse){await pose({...p,y:site.y-sign*2.8});await page.evaluate(()=>room.firstPersonCamera.rotation.x=.5);await shot(id+'-cleared');}
   await pose(p,true);await page.keyboard.down('w');await step(75);await page.keyboard.up('w');const ridden=await state();assert.ok((ridden.scooter.y-site.y)*sign>1.5,JSON.stringify(ridden));assert.ok(ridden.scooter.speed>2);assert.ok(v.scooterSupport(ridden.scooter));record.riding.push({id,reverse,...ridden});
  }
  for(const p of [{id:'guardrail',x:14,y:0,heading:Math.PI/2},{id:'tower',x:-125,y:84,heading:0},{id:'house',x:13.3,y:4.65,heading:-Math.PI/2}]){
   await pose(p,true);await page.evaluate(speed=>room.scooter.speed=speed,v.SCOOTER.cruise);await page.keyboard.down('w');await step(15,.2);await page.keyboard.up('w');const result=await state();assert.equal(result.scooter.speed,0,p.id);assert.ok(v.scooterSupport(result.scooter));record.blocked.push({id:p.id,...result});
  }
  await pose({...v.SCOOTER_PARKING[0]},true);await page.keyboard.press('m');assert.equal((await state()).scooter.speed,0);assert.equal(await page.locator('#floor-plan-dialog').evaluate(n=>n.open),true);await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);record.mapPause=true;
  await page.keyboard.down('Space');await step(15,.2);await page.keyboard.up('Space');assert.equal((await state()).scooter.speed,0);record.manualBrake=true;
  await page.keyboard.press('e');await step(12,.1);assert.equal((await state()).scooter.riding,false);record.safeDismount=true;
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.warnings,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);record.browser=browser.version();record.passed=true;
 }catch(error){record.failure=String(error.stack||error);throw error;}finally{fs.writeFileSync(path.join(__dirname,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,walking:record.walking.length,riding:record.riding.length,blocked:record.blocked.length,initialJsBytes:record.initialJsBytes}));
})().catch(e=>{console.error(e);process.exitCode=1;});
