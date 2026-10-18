const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),walking=load('WalkingSurface'),site=load('CoastalSite');
const out=__dirname,base=process.env.STUDY_URL||'http://127.0.0.1:8178/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const record={baseline:'f2acb80',fpsOrLoadingBenchmark:false,errors:[],warnings:[],requests:[],travel:[],checks:{}};
 page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});page.on('response',r=>record.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const shot=name=>page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87});
 const state=()=>page.evaluate(()=>({vehicle:{...room.scooter},camera:room.firstPersonCamera.position.asArray(),rotation:room.firstPersonCamera.rotation.asArray(),grounded:room.jump.grounded,feet:room.jump.feet,transition:!!room.scooterTransition,view:room.currentView,locked:!!document.pointerLockElement,hint:document.querySelector('#interaction-hint').textContent}));
 const placeWalker=async(p,target)=>{
  const h=walking.walkingSurfaceAt(p.x,p.y).height;await page.evaluate(({p,h,target})=>{const c=room.firstPersonCamera,V=c.position.constructor;c.position.set((p.x-5.4)*5,-5+(h+1.6)*5,(p.y-5.4)*5);c.setTarget(new V((target.x-5.4)*5,-5+(h+.7)*5,(target.y-5.4)*5));c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();room.previousWalk.copyFrom(c.position);Object.assign(room.jump,{feet:h,grounded:true,velocity:0,queued:false,originTop:h});room.stableWalk={position:c.position.clone(),feet:h};},{p,h,target});
 };
 let pressed=new Set();
 const keys=async next=>{const n=new Set(next);for(const key of pressed)if(!n.has(key))await page.keyboard.up(key);for(const key of n)if(!pressed.has(key))await page.keyboard.down(key);pressed=n;};
 const drive=async(name,points,boardedAt)=>{
  let index=0,stuck=0,lastDistance=0;const keyDownCounts={w:0,a:0,d:0,Space:0};const started=Date.now(),samples=[];let lastSample=0;
  while(index<points.length){
   const s=(await state()).vehicle;let closest=index,d=Infinity;
   for(let j=index;j<Math.min(points.length,index+18);j++){const dist=Math.hypot(points[j].x-s.x,points[j].y-s.y);if(dist<d){d=dist;closest=j;}}
   index=closest;const end=points.at(-1),endDistance=Math.hypot(end.x-s.x,end.y-s.y);
   if(index>points.length-5&&endDistance<.65)break;
   let goal=points[index],j=index;const look=.8+Math.abs(s.speed)*.22;
   while(j<points.length-1&&Math.hypot(goal.x-s.x,goal.y-s.y)<look)goal=points[++j];
   const desired=Math.atan2(goal.x-s.x,goal.y-s.y),error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading)),predicted=error-s.steer*.16;
   const input=[];if(Math.abs(error)<.8)input.push('w');else input.push('Space');if(predicted>.06)input.push('d');if(predicted<-.06)input.push('a');
   for(const key of input)if(!pressed.has(key))keyDownCounts[key]++;
   await keys(input);await page.waitForTimeout(60);
   if(Date.now()-lastSample>450){lastSample=Date.now();if(samples.length%20===0)console.log(name,'progress',index,s.x,s.y,s.speed);samples.push({elapsed:(Date.now()-started)/1000,index,speedLimit:v.scooterSpeedLimit(s),...s});if(Math.abs(s.distance-lastDistance)<.02)stuck++;else stuck=0;lastDistance=s.distance;}
   assert.ok(stuck<18,'stuck '+JSON.stringify({name,index,s,error,goal}));assert.ok(Date.now()-started<100000,'trip timeout '+name);
  }
  await keys(['Space']);await page.waitForTimeout(850);await keys([]);
  const stoppedAt=Date.now(),drivingElapsed=(stoppedAt-started)/1000,elapsed=(stoppedAt-boardedAt)/1000,end=await state();
  record.travel.push({name,elapsed,drivingElapsed,preDriveSeconds:(started-boardedAt)/1000,keyDownCounts,method:'Real Playwright W/A/D/Space keys, normal render loop; guidance selects keys only, never assigns vehicle heading/position or camera during travel',samples,end});
  for(const s of samples)assert.ok(v.scooterSupport(s),JSON.stringify(s));
  await shot(name);console.log(name,elapsed,end.vehicle);
 };
 try{
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(base,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  record.initialRequests=[...record.requests];record.actualInitialJsBytes=record.initialRequests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((n,r)=>n+r.bytes,0);assert.ok(record.actualInitialJsBytes<=3*1048576);
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,vehicleMeshes:room.scooterModel.meshes.length,vehicleVertices:room.scooterModel.meshes.reduce((n,m)=>n+m.getTotalVertices(),0)}));
  await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await placeWalker({x:12.9,y:2.2},v.scooterOffset(v.SCOOTER_PARKING[0],0,-.35));await page.waitForTimeout(300);await shot('parked-home');
  assert.ok(await page.evaluate(()=>room.scooterTarget()),'real ray reaches scooter');
  const outboundBoardedAt=Date.now();await page.keyboard.press('e');await page.waitForTimeout(500);assert.ok((await state()).vehicle.riding);await shot('first-person-handlebar');
  const route=site.coastalRoute().filter(p=>p.y<82&&p.x<13.1).filter(p=>!(p.x>10&&p.y>1));
  // Route starts at the actual parked scooter and finishes on the tower plaza before its solid plinth.
  const outbound=[{x:13,y:0},...route.filter(p=>p.x<12.9||p.y<0),{x:-123.5,y:82.3}];
  await drive('ride-home-to-lighthouse',outbound,outboundBoardedAt);
  await page.keyboard.press('e');await page.waitForTimeout(650);const parked=await state();assert.equal(parked.vehicle.riding,false);assert.ok(walking.walkingPointAllowed({x:parked.camera[0]/5+5.4,y:parked.camera[2]/5+5.4}));record.checks.safeDismount=parked;await shot('parked-lighthouse');
  await page.keyboard.press('Space');await page.waitForTimeout(200);assert.ok((await state()).feet>parked.feet+.1);await page.waitForTimeout(1000);record.checks.jumpAfterDismount=true;
  await page.keyboard.press('m');await shot('map-find-scooter');const marker=await page.locator('#floor-plan-drawing .plan-scooter').getAttribute('transform');assert.ok(marker?.includes('translate'));record.checks.mapMarker=marker;await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  const current=(await state()).vehicle;await placeWalker(v.scooterOffset(current,.9,0),v.scooterOffset(current,0,-.35));await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>room.scooterTarget()),"reboard ray");const returnBoardedAt=Date.now();await page.keyboard.press('e');await page.waitForTimeout(550);assert.ok((await state()).vehicle.riding);
  // Turn around with genuine A input, then drive the same route back.
  await keys(['a']);await page.waitForTimeout(1880);await keys([]);await page.waitForTimeout(200);
  const back=outbound.slice().reverse().slice(1);back.push({x:14,y:2.2});await drive('ride-lighthouse-to-home',back,returnBoardedAt);
  // Pausing while a real movement key remains held must require a fresh keydown after resuming.
  await keys(['w']);await page.waitForTimeout(350);await page.keyboard.press('m');const paused=await state();assert.equal(paused.vehicle.speed,0);await page.waitForTimeout(400);assert.deepEqual((await state()).vehicle,paused.vehicle);
  await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(400);assert.equal((await state()).vehicle.speed,0);await keys([]);record.checks.mapStopsHeldInput=true;
  await page.keyboard.press('Escape');await page.locator('[data-view="living"]').click();await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);assert.ok((await state()).vehicle.riding);assert.equal((await state()).vehicle.speed,0);record.checks.presetRetainsRide=true;
  await page.keyboard.press('m');await page.locator('#coast-return-home').click();await page.waitForFunction(()=>!!document.pointerLockElement);const home=await state();assert.equal(home.vehicle.riding,false);assert.equal(home.vehicle.x,14);assert.equal(home.vehicle.y,2.2);assert.ok(Math.abs(home.camera[0]/5+5.4-12.2)<.01);record.checks.returnHome=home;
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{await keys([]);fs.writeFileSync(path.join(out,record.passed?'browser.json':'browser-partial.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
