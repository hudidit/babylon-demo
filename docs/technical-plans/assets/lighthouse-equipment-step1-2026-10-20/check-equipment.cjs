// Final dist, local pointer controls and original walking updates. No FPS or loading-time benchmark.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),layout=load('LighthouseEquipmentLayout');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{planToWorld}=load('HouseLayout');
const out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'equipment')),url=process.env.STUDY_URL||'http://127.0.0.1:8219/';
const manifest=fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'));
const record={baseline:'8e6e255',releaseManifestSha256:crypto.createHash('sha256').update(manifest).digest('hex'),fpsOrLoadTimeSampling:false,
  method:'Final unmodified dist. Nearby grounded pose fixtures for each installation; real clicks and native-dialog keyboard. Engine-room entry/exit and collision use W input with no subsequent pose correction.',errors:[],warnings:[],requests:[],devices:[],cases:{}};
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
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
 await page.locator('[data-view="first-person"]').click();
 const locked=async()=>{await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.waitForTimeout(150);};await locked();
 await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;e.getFps=()=>20;});
 const frames=n=>page.evaluate(async n=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=1;i<n;i++)s.render();},n);
 const pose=async(x,y,floor,target)=>page.evaluate(({x,y,floor,target,t})=>{
   const c=room.firstPersonCamera,V=c.position.constructor;c.position.set((t.x+x-5.4)*5,-5+(floor+1.6)*5,(t.y+y-5.4)*5);
   c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
   Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.ladder.attached=false;room.scooter.riding=false;
   room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};
   c.setTarget(new V(...target));c.getViewMatrix(true);room.updateInteractionHint();
 },{x,y,floor,target,t});
 const aim=async(x,y,h)=>{const q=planToWorld({x:t.x+x,y:t.y+y},h);await page.evaluate(q=>{const c=room.firstPersonCamera,V=c.position.constructor;c.setTarget(new V(q.x,q.y,q.z));c.getViewMatrix(true);room.updateInteractionHint();},q);};
 const shot=async name=>{await page.evaluate(()=>{e.getDeltaTime=()=>0;e.runRenderLoop(self.equipmentShot=()=>s.render());});await page.waitForTimeout(120);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87});await page.evaluate(()=>{e.stopRenderLoop(equipmentShot);e.getDeltaTime=()=>50;});};
 record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,
   equipment:room.exterior.lighthouseDetails.equipment.meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),material:m.material.name})),metadata:s.metadata.lighthouseEquipment}));
 assert.equal(record.resources.equipment.length,23);assert.equal(record.resources.equipment.reduce((n,m)=>n+m.vertices,0),1560);
 assert.equal(record.resources.lights,22);assert.equal(record.resources.cameras,3);assert.equal(record.resources.textures,153);assert.equal(record.resources.metadata.commissioned,false);
 for(const definition of layout.LIGHTHOUSE_EQUIPMENT){
   const d=definition.sign,target=await page.evaluate(id=>{
     const device=room.exterior.lighthouseDetails.equipment.device(id),mesh=device.meshes.find(m=>m.name.endsWith(id==='lighthouse-drive-hatch'?'-paint':'-labels'));
     mesh.computeWorldMatrix(true);return mesh.getBoundingInfo().boundingBox.centerWorld.asArray();
   },definition.id);
   await pose(d.x+d.nx*.75,d.y+d.ny*.75,definition.floor,target);await frames(2);
   await shot(definition.id+'-physical');
   assert.match(await page.locator('#interaction-hint').textContent(),new RegExp(definition.label));
   const before=await page.evaluate(()=>room.lighthouseInspection);
   await page.mouse.down();await page.mouse.up();assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),true);
   assert.equal(await page.locator('#lighthouse-panel-title').textContent(),definition.label);assert.equal(await page.locator('#lighthouse-equipment-id').textContent(),definition.id);
   assert.equal(await page.locator('#lighthouse-operation-content').isVisible(),false);
   assert.equal(await page.locator('#lighthouse-equipment-content').isVisible(),true);
   const equipmentState=await page.locator('#lighthouse-panel-state').textContent();assert.doesNotMatch(equipmentState,/100%|备用正常/);
   const paused=await page.evaluate(()=>room.lighthouseOperation);await frames(20);assert.deepEqual(await page.evaluate(()=>room.lighthouseOperation),paused);
   assert.deepEqual(await page.evaluate(()=>room.lighthouseInspection),before,'read-only device view cannot complete inspection tasks');
   const layouts=[];
   for(const [width,height]of [[1280,800],[390,844],[844,390]]){
     await page.setViewportSize({width,height});const bounds=await page.locator('#lighthouse-panel').boundingBox();
     assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
     await page.locator('#lighthouse-panel-return').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'lighthouse-panel-return');
     layouts.push({width,height,bounds});
   }
   await shot(definition.id+'-info');await page.setViewportSize({width:1280,height:800});
   await page.locator('#lighthouse-panel-return').click();await locked();
   record.devices.push({id:definition.id,state:equipmentState,layouts,paused:true});
 }
 const roomLayout=layout.LIGHTHOUSE_SERVICE_ROOM;
 const position=()=>page.evaluate(()=>({x:room.firstPersonCamera.position.x/5+5.4-t.x,y:room.firstPersonCamera.position.z/5+5.4-t.y,feet:room.jump.feet,grounded:room.jump.grounded}));
 // Inject only a constant layout value, not a replacement controller.
 await page.evaluate(t=>self.t=t,t);
 const walk=async(x,y,max=100,arrive=true)=>{
   const start=await position();await aim(x,y,start.feet+1.6);const samples=[];await page.keyboard.down('w');
   try{for(let i=0;i<max;i++){await frames(1);const state=await position();assert.ok(state.grounded);if(i%4===0)samples.push(state);if(arrive&&Math.hypot(state.x-x,state.y-y)<.06)break;}}
   finally{await page.keyboard.up('w');await page.evaluate(()=>{room.firstPersonCamera.cameraDirection.setAll(0);room.firstPersonCamera.movement.resetPanVelocity();});}
   const end=await position();if(arrive)assert.ok(Math.hypot(end.x-x,end.y-y)<.075,JSON.stringify({x,y,end}));return{start,end,samples};
 };
 const initial=planToWorld({x:t.x+roomLayout.x,y:t.y+roomLayout.y-2.6},roomLayout.floor+1.6);
 await pose(roomLayout.x,roomLayout.y-2.6,roomLayout.floor,[initial.x,initial.y,initial.z+5]);
 record.cases.enterRoom=await walk(roomLayout.x,roomLayout.y-.4);await frames(2);
 assert.match(await page.locator('#view-help').textContent(),/独立机房/);assert.doesNotMatch(await page.locator('#view-help').textContent(),/垂直梯/);
 await shot('engine-room-inside');record.cases.engineBlocksWalk=await walk(roomLayout.x,roomLayout.y+1.2,60,false);
 assert.ok(record.cases.engineBlocksWalk.end.y<roomLayout.y);
 record.cases.leaveRoom=await walk(roomLayout.x,roomLayout.y-2.6);
 for(const [x,y]of [[-5.5,0],[-3.9,-3.9],[0,-5.5],[3.9,-3.9],[5.5,0],[5.5,3.2],[4.8,3.5]])await walk(x,y);
 record.cases.solarBlocksWalk=await walk(4.8,6.4,90,false);assert.ok(record.cases.solarBlocksWalk.end.y<4.8);
 await shot('solar-shared-collision');
 assert.deepEqual(record.errors,[]);assert.deepEqual(record.requests.filter(r=>r.status>=400),[]);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length+s.materials.length+s.transformNodes.length+s.lights.length),0);
 record.cases.release=true;record.passed=true;await context.close();
 }finally{fs.writeFileSync(path.join(out,'equipment.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,devices:record.devices.length,initialJsBytes:record.initialJsBytes}));
})().catch(e=>{console.error(e);process.exitCode=1;});
