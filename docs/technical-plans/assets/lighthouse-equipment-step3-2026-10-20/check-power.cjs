// Unmodified production dist; pose fixtures, original bounded clock receipts and native automatic-time toggle. Local ray picks, real dialog/tool input and original frame loop perform every transaction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{LIGHTHOUSE:a}=load('LighthouseLayout'),layout=load('LighthouseEquipmentLayout');
const out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'power')),url=process.env.STUDY_URL||'http://127.0.0.1:8241/';
const record={baseline:'9e3823e',releaseManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))).digest('hex'),
 fpsOrLoadTimeSampling:false,method:'Natural energy depletion, original bounded scene-hour updates, native generator/fuel/battery commands. Production local UI only. Grounded nearby pose fixtures between equipment. Original bounded frame receipts; no state/proof/fault setters. Real mouse click and selectOption for all commands, actual ray gates and committed parts. GPU pixels use actual model state.',requests:[],errors:[],warnings:[],cases:{}};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 record.browser=browser.version();page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
 page.on('response',r=>record.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(url,{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
 record.initialJs=record.requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await page.locator('[data-view="first-person"]').click();
 const locked=async()=>{await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.waitForTimeout(150);};await locked();
 await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;e.getFps=()=>20;});
 const frames=n=>page.evaluate(async n=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=1;i<n;i++)s.render();},n);
 const state=()=>page.evaluate(()=>({m:room.lighthouseMaintenance,op:room.lighthouseOperation,p:room.lighthousePower}));
 const pose=(x,y,floor,target)=>page.evaluate(({x,y,floor,target,t})=>{
  const c=room.firstPersonCamera,V=c.position.constructor;c.position.set((t.x+x-5.4)*5,-5+(floor+1.6)*5,(t.y+y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
  Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.ladder.attached=false;room.scooter.riding=false;
  room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};c.setTarget(new V(...target));c.getViewMatrix(true);room.updateInteractionHint();
 },{x,y,floor,target,t});
 const world=(x,y,h)=>{const p=load('HouseLayout').planToWorld({x:t.x+x,y:t.y+y},h);return[p.x,p.y,p.z];};
 const aim=(x,y,h)=>page.evaluate(target=>{const c=room.firstPersonCamera,V=c.position.constructor;c.setTarget(new V(...target));c.getViewMatrix(true);room.updateInteractionHint();},world(x,y,h));
 const shot=async name=>{await page.evaluate(()=>{e.getDeltaTime=()=>0;e.runRenderLoop(self.drillShot=()=>s.render());});await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87});await page.evaluate(()=>{e.stopRenderLoop(drillShot);e.getDeltaTime=()=>50;});};
 const close=async()=>{await page.locator('#lighthouse-panel-return').click();await locked();};
 const open=async id=>{
  let x,y,floor,target;
  if(id==='control'){x=-1.8;y=-.95;floor=a.floor;target=world(-1.69,.1,a.floor+1.55);}
  else {const d=layout.lighthouseEquipmentDefinition(id),v=d.sign;x=v.x+v.nx*.75;y=v.y+v.ny*.75;floor=d.floor;
   target=await page.evaluate(id=>{const d=room.exterior.lighthouseDetails.equipment.device(id),m=d.meshes.find(m=>m.name.endsWith(id==='lighthouse-drive-hatch'?'-paint':'-labels'));m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.centerWorld.asArray();},id);}
  await pose(x,y,floor,target);await frames(2);assert.equal(await page.evaluate(id=>room.canAccessLighthouse(id),id),true,id);
  await page.mouse.down();await page.mouse.up();assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),true,id);
 };
 const command=async(id,tool)=>{if(tool)await page.locator('#lighthouse-tool').selectOption(tool);await page.locator(`[data-command="${id}"]`).click();};
 const action=async(id,tool)=>{await command(id,tool);await locked();await frames(104);assert.equal((await state()).m.action,undefined,(await state()).m.notice);assert.equal((await state()).p.action,undefined,(await state()).p.notice);};
 const automatic=async()=>{await page.keyboard.press('t');await page.locator('#time-automatic').check();await page.locator('#time-close').click();await page.locator('#gameCanvas').click();await locked();};
 const enter=async drill=>{await open('control');await page.locator(`[data-lighthouse-drill="${drill}"]`).click();assert.equal((await state()).m.session,drill);await close();};
 const backupView=async()=>{const b=layout.LIGHTHOUSE_BACKUP_MOUNT;await pose(2.45,-.45,a.gallery,world(b.x-.09,-.06,b.lensBottom+b.lensHeight*.86));await frames(2);assert.equal(await page.evaluate(()=>room.canObserveBackup()),true);};
 const pixels=()=>page.evaluate(()=>{s.render();const gl=e._gl,w=e.getRenderWidth(),h=e.getRenderHeight(),n=40,p=new Uint8Array(n*n*4);gl.readPixels(Math.floor((w-n)/2),Math.floor((h-n)/2),n,n,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);});

 const powerCommand=async(id,tool)=>{if(tool)await page.locator('#lighthouse-tool').selectOption(tool);await page.locator(`[data-power-command="${id}"]`).click();};
 const powerAction=async(id,tool)=>{await powerCommand(id,tool);await locked();await frames(106);assert.equal((await state()).p.action,undefined,(await state()).p.notice);};
 const advanceUntil=async kind=>page.evaluate(kind=>{
  let frames=0;const samples=[];
  const done=()=>kind==='protected'?room.lighthousePower.protected:kind==='ready'?room.lighthousePower.recoveryReady:!room.lighthousePower.generatorRunning;
  while(!done()&&frames<70000){room.updateTimeOfDay(.1);frames++;if(frames%1800===0)samples.push({day:room.lighthouseOperation.dutyDay,hour:room.lighthouseOperation.hour,p:room.lighthousePower});}
  return{frames,done:done(),samples,p:room.lighthousePower,m:room.lighthouseMaintenance,op:room.lighthouseOperation};
 },kind);
 await open('control');const normal=await page.evaluate(()=>({time:room.timeOfDay,op:room.lighthouseOperation,inspection:room.lighthouseInspection,m:room.lighthouseMaintenance,p:room.lighthousePower}));await page.locator('[data-lighthouse-drill="power"]').click();await close();await automatic();
 // A healthy night navigation load naturally depletes the explicit teaching 11% battery. No battery, threshold or fuel setters.
 record.cases.depletion=await advanceUntil('protected');assert.ok(record.cases.depletion.done);assert.ok(record.cases.depletion.frames>300);
 assert.equal((await state()).op.running,false);assert.equal((await state()).m.source,'backup');assert.ok((await state()).p.backupWh>90);
 assert.equal((await state()).p.warning,true);await open('lighthouse-battery-main');await shot('battery-low-protection');await powerCommand('verify-main','meter');assert.match(await page.locator('#lighthouse-power-notice').textContent(),/20%/);await close();
 await open('lighthouse-generator');await powerAction('start-generator','meter');assert.equal((await state()).p.generatorRunning,true);assert.equal((await state()).p.generatorVerified,false);
 assert.equal((await state()).p.generatorW,200);assert.equal((await state()).p.solarW,0);await shot('generator-running-physical');
 await open('lighthouse-generator');await powerCommand('refuel');assert.match(await page.locator('#lighthouse-power-notice').textContent(),/先停止/);await powerCommand('stop-generator');
 const reserve=(await state()).p.reserveFuel,fuel=(await state()).p.fuel;await powerCommand('refuel');await locked();await frames(10);await aim(layout.LIGHTHOUSE_SERVICE_ROOM.x,layout.LIGHTHOUSE_SERVICE_ROOM.y-3,3.04+1.6);await frames(2);
 assert.equal((await state()).p.action,undefined);assert.equal((await state()).p.reserveFuel,reserve);assert.equal((await state()).p.fuel,fuel);record.cases.cancelRefuelNoDebit=true;
 await open('lighthouse-generator');await powerAction('refuel');assert.equal((await state()).p.reserveFuel,reserve-4);assert.equal((await state()).p.fuel,fuel+4);assert.equal((await state()).p.generatorRunning,false);
 await open('lighthouse-generator');await powerAction('start-generator');record.cases.recharge=await advanceUntil('ready');assert.ok(record.cases.recharge.done);assert.equal((await state()).p.protected,true);assert.ok((await state()).p.mainWh>=576-1e-7);
 await open('lighthouse-battery-main');await powerCommand('verify-main','cloth');assert.match(await page.locator('#lighthouse-power-notice').textContent(),/检测工具/);await shot('battery-recovery-awaits-verification');await powerAction('verify-main','meter');
 assert.equal((await state()).p.protected,false);record.cases.verifiedRecovery=await state();
 // Actual 5-second generator net-Wh sampling, separate from its successful start.
 await open('lighthouse-generator');const before=(await state()).p.mainWh;await powerAction('probe-generator','meter');assert.equal((await state()).p.generatorVerified,true);assert.ok((await state()).p.mainWh>before);record.cases.generatorVerified=await state();assert.equal((await state()).m.resolved,true);
 await open('lighthouse-generator');await shot('generator-output-verified');await close();record.cases.exhaustion=await advanceUntil('empty');assert.ok(record.cases.exhaustion.done);assert.equal((await state()).p.fuel,0);assert.equal((await state()).p.generatorW,0);assert.equal((await state()).p.generatorVerified,false);
 await open('lighthouse-generator');await shot('generator-fuel-empty');await powerCommand('start-generator');assert.match(await page.locator('#lighthouse-power-notice').textContent(),/燃料不足/);await close();
 await open('control');await page.locator('[data-lighthouse-drill="normal"]').click();assert.deepEqual(await page.evaluate(()=>({time:room.timeOfDay,op:room.lighthouseOperation,inspection:room.lighthouseInspection,m:room.lighthouseMaintenance,p:room.lighthousePower})),normal);record.cases.normalRestoredExactly=true;await close();
 assert.deepEqual(record.errors,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);record.passed=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length+s.materials.length+s.transformNodes.length+s.lights.length),0);record.cases.disposed=true;await context.close();
 }finally{fs.writeFileSync(path.join(out,'power.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,initialJsBytes:record.initialJsBytes,cases:Object.keys(record.cases)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
