// Independent production hosting, native clicks/dialogs and original accepted-clock updates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{LIGHTHOUSE:a}=load('LighthouseLayout'),layout=load('LighthouseEquipmentLayout');
const out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'browser')),url=process.env.STUDY_URL||'http://127.0.0.1:8242/';
const record={baseline:'ccbdc3f',releaseManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))).digest('hex'),
 method:'Unmodified production dist; real local ray clicks, contextual buttons, native pointer lock and keyboard. Grounded nearby pose fixtures; original updateTimeOfDay(.05) receipts. No fault, inventory, energy, inspection or evidence mutations. Not an FPS/load-time experiment.',requests:[],errors:[],warnings:[],cases:{},layouts:[]};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);record.browser=browser.version();
 page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
 page.on('response',r=>record.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(url,{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
 record.initialJs=record.requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await page.locator('[data-view="first-person"]').click();
 const locked=async()=>{await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.waitForTimeout(100);};await locked();
 await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;});
 const frames=n=>page.evaluate(async n=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=1;i<n;i++)s.render();},n);
 const step=n=>page.evaluate(n=>{for(let i=0;i<n;i++)room.updateTimeOfDay(.05);},n);
 const state=()=>page.evaluate(()=>({i:room.lighthouseInspection,m:room.lighthouseMaintenance,p:room.lighthousePower,op:room.lighthouseOperation}));
 const pose=(x,y,floor,target)=>page.evaluate(({x,y,floor,target,t})=>{const c=room.firstPersonCamera,V=c.position.constructor;
 c.position.set((t.x+x-5.4)*5,-5+(floor+1.6)*5,(t.y+y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
 Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.ladder.attached=false;room.scooter.riding=false;room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};
 c.setTarget(new V(...target));c.getViewMatrix(true);room.updateControls();room.updateInteractionHint();},{x,y,floor,target,t});
 const click=async()=>{await page.mouse.down();await page.mouse.up();};
 const close=async()=>{await page.locator('#lighthouse-panel-return').click();await locked();};
 const shot=async name=>{await page.evaluate(()=>e.runRenderLoop(self.checkShot=()=>s.render()));await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:88});await page.evaluate(()=>e.stopRenderLoop(checkShot));};
 const open=async id=>{
 let x,y,floor,target;
 if(['control','test','cover','log'].includes(id)) {
  x=id==='log'?.65:id==='control'?-1.8:.25;y=id==='log'?1.15:id==='control'?-.95:-1.1;floor=['control','log'].includes(id)?a.floor:a.gallery;
  target=await page.evaluate(id=>{const d=room.exterior.lighthouseDetails,m=id==='cover'?d.cover.pane:(id==='control'?d.panel:id==='log'?d.log:d.test).meshes[0];m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.centerWorld.asArray();},id);
 } else {const d=layout.lighthouseEquipmentDefinition(id),v=d.sign;x=v.x+v.nx*.75;y=v.y+v.ny*.75;floor=d.floor;
  target=await page.evaluate(id=>{const d=room.exterior.lighthouseDetails.equipment.device(id),m=d.meshes.find(m=>m.name.endsWith(id==='lighthouse-drive-hatch'?'-paint':'-labels'));m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.centerWorld.asArray();},id);}
 await pose(x,y,floor,target);await frames(2);assert.equal(await page.evaluate(id=>room.canAccessLighthouse(id),id),true,id);await click();
 assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),id,id);
 };
 const layoutCheck=async(name,screen)=>{const shape=await page.locator('#lighthouse-panel').evaluate(n=>{const r=n.getBoundingClientRect();return{within:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,horizontalOverflow:n.scrollWidth>n.clientWidth+1,verticalOverflow:n.scrollHeight>n.clientHeight+1,visibleButtons:[...n.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.disabled).map(b=>b.id),gauges:n.querySelectorAll('.lighthouse-gauge').length};});
 assert.equal(shape.within,true);assert.equal(shape.horizontalOverflow,false);if(screen==='desktop')assert.equal(shape.verticalOverflow,false);assert.ok(shape.gauges<=2);record.layouts.push({name,screen,...shape});};
 record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
 assert.equal(await page.locator('select#lighthouse-tool,[data-lighthouse-drill],[data-command],[data-power-command]').count(),0);
 for(const id of layout.LIGHTHOUSE_EQUIPMENT.map(d=>d.id)){
  await open(id);await layoutCheck(id,'desktop');if(id==='lighthouse-solar-charger'){
   assert.equal(await page.locator('.lighthouse-gauge').count(),2);assert.equal(await page.locator('#lighthouse-actions button:visible').count(),0);
   await shot('solar-controller-desktop');
   for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await layoutCheck(id,width===390?'portrait':'landscape');await shot('solar-controller-'+width);}
   await page.setViewportSize({width:1280,height:800});
  }await close();
 }
 record.cases.allEightLocalDevicesAndDeferredControlsRemoved=true;
 await open('control');await page.locator('#lighthouse-confirm-control').click();assert.equal((await state()).i.checks['check-control'],'complete');await shot('control-readings');await close();
 await open('test');await page.locator('#lighthouse-test-toggle').click();await locked();
 const aimOptic=()=>page.evaluate(()=>{room.firstPersonCamera.setTarget(room.exterior.lighthouseDetails.beacon.root.position);room.firstPersonCamera.getViewMatrix(true);});
 await aimOptic();await step(1);await step(80);let current=await state();assert.ok(current.i.observationSeconds>3.8&&current.i.observationSeconds<4.2);
 const ring=()=>page.locator('#lighthouse-progress-value').evaluate(n=>Number(n.style.strokeDashoffset));assert.ok(await ring()>58&&await ring()<62);assert.equal(await page.locator('#lighthouse-activity').isVisible(),true);assert.equal(await page.locator('#interaction-hint').evaluate(n=>getComputedStyle(n).visibility),'hidden');
 const center=await page.locator('#lighthouse-progress').evaluate(n=>{const r=n.getBoundingClientRect();return{dx:r.left+r.width/2-innerWidth/2,dy:r.top+r.height/2-innerHeight/2};});assert.ok(Math.abs(center.dx)<1&&Math.abs(center.dy)<1);await shot('observation-ring-partial');
 await page.evaluate(()=>{const c=room.firstPersonCamera;c.setTarget(c.position.add(c.getForwardRay().direction.scale(-5)));c.getViewMatrix(true);});await step(2);assert.equal((await state()).i.observationSeconds,0);assert.equal(await page.locator('#lighthouse-activity').isVisible(),false);
 await aimOptic();await step(80);await page.keyboard.press('m');await step(1);const frozen=(await state()).i.observationSeconds;await step(80);assert.equal((await state()).i.observationSeconds,frozen);assert.equal(await page.locator('#lighthouse-activity').isVisible(),false);
 await page.locator('#floor-plan-return').click();await locked();await step(1);await aimOptic();await step(150);assert.equal((await state()).i.checks['check-optic'],'complete');assert.equal(await ring(),0);assert.equal(await page.locator('#lighthouse-activity').getAttribute('data-state'),'complete');await shot('observation-ring-complete');
 record.cases.observationActualProgressResetPauseAndClosedSuccess=true;
 await open('test');await page.locator('#lighthouse-test-toggle').click();await locked();assert.equal((await state()).op.running,false);
 await open('cover');await page.locator('#lighthouse-cover-check').click();assert.equal((await state()).i.checks['check-cover'],'dirty');assert.equal(await page.locator('#lighthouse-actions button:visible').count(),1);await shot('cover-dirty');
 await page.locator('#lighthouse-clean-start').click();await locked();await step(1);await step(14);assert.equal((await state()).i.dirty,true);assert.ok(await ring()>50&&await ring()<57);await shot('cleaning-ring');
 await page.evaluate(()=>{const c=room.firstPersonCamera;c.setTarget(c.position.add(c.getForwardRay().direction.scale(-5)));c.getViewMatrix(true);});await step(1);assert.equal((await state()).i.cleaning,false);assert.equal((await state()).i.dirty,true);assert.notEqual(await page.locator('#lighthouse-activity').getAttribute('data-state'),'complete');
 await open('cover');await page.locator('#lighthouse-clean-start').click();await locked();await step(1);await step(31);assert.equal((await state()).i.dirty,false);assert.equal((await state()).i.checks['check-cover'],'awaiting-recheck');assert.equal(await ring(),0);await shot('cleaning-complete');
 await open('cover');await page.locator('#lighthouse-cover-check').click();assert.equal((await state()).i.completed,true);await page.locator('#lighthouse-record-toggle').click();assert.equal(await page.locator('#lighthouse-paper').isVisible(),true);assert.equal(await page.locator('#lighthouse-instrument').isVisible(),false);
 assert.equal(await page.locator('#lighthouse-record-rows [data-object]:not([data-object="lighthouse-optics-cleaning"])').count(),0);await shot('cover-paper-records');await close();record.cases.cleaningCancelActualCompletionAndRecheck=true;
 await open('lighthouse-solar-array');await page.locator('#lighthouse-solar-inspect').click();await locked();await step(1);await step(18);assert.ok(await ring()>50);await step(25);assert.equal((await state()).m.action,undefined);assert.equal(await ring(),0);await open('lighthouse-solar-array');await page.locator('#lighthouse-record-toggle').click();assert.match(await page.locator('#lighthouse-record-rows').textContent(),/巡视面板.*面板洁净/);await close();record.cases.solarPatrolAutomaticTool=true;
 await open('log');assert.equal(await page.locator('#lighthouse-paper').isVisible(),true);assert.equal(await page.locator('#lighthouse-checklist [data-state="complete"]').count(),3);assert.ok(await page.locator('#lighthouse-record-rows tr').count()<=5);assert.equal(await page.locator('#lighthouse-record-next').isEnabled(),true);
 await shot('paper-journal-desktop');await page.locator('#lighthouse-record-next').click();assert.match(await page.locator('#lighthouse-record-page').textContent(),/2/);await page.locator('#lighthouse-record-prev').click();
 for(const [width,height]of [[390,844],[844,390]]){await page.setViewportSize({width,height});await layoutCheck('journal',width===390?'portrait':'landscape');await shot('paper-journal-'+width);}
 await page.setViewportSize({width:1280,height:800});await page.locator('#lighthouse-panel-return').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lighthouse-record-next');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lighthouse-panel-return');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),false);assert.equal(await page.evaluate(()=>room.pauseReasons.includes('lighthouse-panel')),false);record.cases.paperPaginationKeyboardAndEscape=true;
 assert.deepEqual(record.errors,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);await page.evaluate(()=>room.dispose());assert.equal(await page.evaluate(()=>s.meshes.length+s.materials.length+s.transformNodes.length+s.lights.length),0);record.cases.disposed=true;record.passed=true;await context.close();
 } catch(error){record.error=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,initialJsBytes:record.initialJsBytes,cases:record.cases,resources:record.resources,errors:record.errors,warnings:record.warnings}));
})().catch(error=>{console.error(error);process.exitCode=1;});
