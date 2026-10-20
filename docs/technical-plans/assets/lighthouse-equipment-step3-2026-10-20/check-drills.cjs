// Unmodified production dist; pose fixtures, original bounded clock receipts and native automatic-time toggle. Local ray picks, real dialog/tool input and original frame loop perform every transaction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{LIGHTHOUSE:a}=load('LighthouseLayout'),layout=load('LighthouseEquipmentLayout');
const out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'drills')),url=process.env.STUDY_URL||'http://127.0.0.1:8241/';
const record={baseline:'9e3823e',releaseManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))).digest('hex'),
 fpsOrLoadTimeSampling:false,method:'Production local UI only. Grounded nearby pose fixtures between equipment. Original bounded frame receipts; no state/proof/fault setters. Real mouse click and selectOption for all commands, actual ray gates and committed parts. GPU pixels use actual model state.',requests:[],errors:[],warnings:[],cases:{}};
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
 // Preserve an already running, partially elapsed normal test and a local control observation.
 await open('control');await page.locator('#lighthouse-confirm-control').click();await close();
 await pose(.25,-1.1,a.gallery,world(0,-.37,a.gallery+.44));await frames(2);await page.mouse.down();await page.mouse.up();console.log('TEST ENTRY',await page.evaluate(()=>({location:room.lighthousePanel.activeLocation,hint:document.querySelector('#interaction-hint').textContent,grounded:room.jump.grounded,feet:room.jump.feet,pose:room.firstPersonCamera.position.asArray(),rotation:room.firstPersonCamera.rotation.asArray()})));assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),'test');await page.locator('#lighthouse-test-toggle').click();await locked();await frames(40);
 // Capture at the entrance, because walking/pose fixture frames remain real accepted time.
 await open('control');const suspended=await page.evaluate(()=>({time:room.timeOfDay,op:room.lighthouseOperation,inspection:room.lighthouseInspection,m:room.lighthouseMaintenance,p:room.lighthousePower}));
 await page.locator('[data-lighthouse-drill="drive"]').click();await shot('drive-symptoms');await close();
 assert.equal((await state()).op.running,false);assert.equal((await state()).m.source,'backup');
 await open('lighthouse-drive-hatch');await command('isolate-main');assert.match(await page.locator('#lighthouse-maintenance-notice').textContent(),/先在外廊/);await close();
 await backupView();let bright,dark;
 for(let i=0;i<220&&(!bright||!dark);i++){const st=await state();if(st.m.backupFlash&&!bright)bright=await pixels();if(!st.m.backupFlash&&!dark)dark=await pixels();await frames(1);}
 assert.ok(bright&&dark);const diff=bright.reduce((n,v,i)=>n+Math.abs(v-dark[i]),0)/bright.length;assert.ok(diff>1,'actual backup flash changes visible GPU pixels');record.cases.backupFlashPixelDifference=diff;
 await frames(210);assert.equal((await state()).m.backupConfirmed,true);await shot('backup-actual-takeover');
 await open('lighthouse-drive-hatch');await command('isolate-main');await action('diagnose','meter');
 await open('lighthouse-drive-hatch');await command('replace','charger-module');assert.match(await page.locator('#lighthouse-maintenance-notice').textContent(),/不匹配/);assert.equal((await state()).m.inventory.drive,1);
 await command('replace','drive-module');await locked();await frames(10);await aim(0,-2,a.gallery+1.6);await frames(2);assert.equal((await state()).m.action,undefined);assert.equal((await state()).m.inventory.drive,1);record.cases.cancelPreservesPart=true;
 await open('lighthouse-drive-hatch');await action('replace','drive-module');assert.equal((await state()).m.inventory.drive,0);
 await open('lighthouse-drive-hatch');await command('replace','drive-module');assert.equal((await state()).m.inventory.drive,0);await action('diagnose','meter');
 await open('lighthouse-drive-hatch');await command('restore');assert.equal((await state()).m.mainIsolated,true);await command('trial');await locked();
 await pose(.25,-1.1,a.gallery,world(0,0,t.ground+17.85));await frames(220);assert.equal((await state()).m.mainVerified,true,JSON.stringify(await state()));await shot('main-repaired-trial');
 await open('lighthouse-drive-hatch');await command('restore');assert.equal((await state()).m.resolved,true);assert.equal((await state()).m.source,'main');await shot('drive-resolved');record.cases.drive=await state();await close();
 await open('control');await page.locator('[data-lighthouse-drill="normal"]').click();const restored=await page.evaluate(()=>({time:room.timeOfDay,op:room.lighthouseOperation,inspection:room.lighthouseInspection,m:room.lighthouseMaintenance,p:room.lighthousePower}));assert.deepEqual(restored,suspended);record.cases.normalRestoredExactly=true;await close();
 console.log('DRIVE PASSED');await enter('charger');await automatic();await open('lighthouse-solar-charger');await action('probe','meter');assert.equal((await state()).m.chargerVerified,false);
 await open('lighthouse-solar-array');await action('inspect','meter');const dirtySolar=await pixels();await open('lighthouse-solar-array');await shot('solar-dirty');await action('clean','cloth');const cleanSolar=await pixels();record.cases.solarSurfacePixelDifference=dirtySolar.reduce((n,v,i)=>n+Math.abs(v-cleanSolar[i]),0)/dirtySolar.length;assert.ok(record.cases.solarSurfacePixelDifference>1);await open('lighthouse-solar-array');await action('inspect','meter');await shot('solar-clean');
 await open('lighthouse-solar-charger');await command('isolate-charge');await action('diagnose','meter');await open('lighthouse-solar-charger');await action('replace','charger-module');
 await open('lighthouse-solar-charger');await action('diagnose','meter');await open('lighthouse-solar-charger');await command('reconnect');assert.equal((await state()).m.resolved,false);await action('probe','meter');
 assert.equal((await state()).m.resolved,true);record.cases.charger=await state();await open('lighthouse-solar-charger');await shot('charger-resolved');await close();await open('control');await page.locator('[data-lighthouse-drill="normal"]').click();await close();
 console.log('CHARGER PASSED');await enter('sensor');assert.equal((await state()).op.running,true);await open('control');await command('override-on');assert.equal((await state()).op.running,false);await close();
 await open('lighthouse-light-sensor');await action('inspect','meter');const dirtySensor=await pixels();await open('lighthouse-light-sensor');await shot('sensor-dirty');await action('clean','cloth');const cleanSensor=await pixels();record.cases.sensorSurfacePixelDifference=dirtySensor.reduce((n,v,i)=>n+Math.abs(v-cleanSensor[i]),0)/dirtySensor.length;assert.ok(record.cases.sensorSurfacePixelDifference>1);await open('lighthouse-light-sensor');await action('inspect','meter');await shot('sensor-clean');
 await open('control');await command('override-off');await close();await open('lighthouse-light-sensor');await action('verify-sensor','meter');assert.equal((await state()).m.resolved,true);record.cases.sensor=await state();
 await open('control');await shot('sensor-resolved');await page.locator('[data-lighthouse-drill="normal"]').click();await close();
 // Independent backup self-test has a separate journal event and no actual-takeover proof.
 await pose(.25,-1.1,a.gallery,world(0,-.37,a.gallery+.44));await frames(2);await page.mouse.down();await page.mouse.up();console.log('TEST ENTRY',await page.evaluate(()=>({location:room.lighthousePanel.activeLocation,hint:document.querySelector('#interaction-hint').textContent,grounded:room.jump.grounded,feet:room.jump.feet,pose:room.firstPersonCamera.position.asArray(),rotation:room.firstPersonCamera.rotation.asArray()})));assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),'test');await page.locator('#lighthouse-test-toggle').click();await locked();
 await open('lighthouse-beacon-backup');await command('self-test');await locked();await backupView();await frames(210);assert.equal((await state()).m.backupConfirmed,false);assert.ok((await state()).m.evidence.some(e=>e.method==='自检复验'));await frames(40);assert.equal((await state()).m.backupOn,false);record.cases.selfTestSeparate=true;
 assert.deepEqual(record.errors,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);record.passed=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length+s.materials.length+s.transformNodes.length+s.lights.length),0);record.cases.disposed=true;await context.close();
 }finally{fs.writeFileSync(path.join(out,'drills.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,initialJsBytes:record.initialJsBytes,cases:Object.keys(record.cases)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
