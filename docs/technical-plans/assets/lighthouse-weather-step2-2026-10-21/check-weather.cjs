const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{LIGHTHOUSE:a}=load('LighthouseLayout'),{LIGHTHOUSE_SOLAR_RACK:rack}=load('LighthouseEquipmentLayout');
const root=path.resolve(__dirname,'../../../../dist'),out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'browser')),base=process.env.STUDY_URL||'http://127.0.0.1:8254/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),record={baseline:'3d1dd3c',manifestSha256:sha(fs.readFileSync(path.join(root,'release-manifest.json'))),method:'Unmodified production dist. Native weather/time-menu choices and grounded camera fixtures; original accepted .1-second production callbacks for scene-hour checks. GPU buffers and actual 512-square mirrors, no fake weather/Wh/evidence or performance sampling.',pages:[],cases:{}};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await pw.chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});record.browser=browser.version();try{
for(const prefix of ['','home/']){
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const item={prefix,requests:[],errors:[],warnings:[],weather:[],cases:{}};record.pages.push(item);
 page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());if(m.type()==='warning')item.warnings.push(m.text());});page.on('response',r=>item.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(new URL(prefix,base).href,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
 item.initialJsBytes=item.requests.filter(r=>new URL(r.url).pathname.endsWith('.js')).reduce((n,r)=>n+r.bytes,0);assert.ok(item.initialJsBytes<=3*1048576);
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
 await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;e.getFps=()=>20;room.setTimeOfDay(12);});
 const render=async()=>page.evaluate(async()=>{for(let i=0;i<4;i++)s.render();await new Promise(resolve=>s.executeWhenReady(resolve));s.render();});
 const step=n=>page.evaluate(n=>{for(let i=0;i<n;i++){room.updateTimeOfDay(.1);if(!room.pauses.blocked)room.interactions.update(.1,room.timeState.lastAdvance.activeSeconds);}},n);
 const current=()=>page.evaluate(()=>({weather:room.weather,op:room.lighthouseOperation,p:room.lighthousePower,m:room.lighthouseMaintenance,i:room.lighthouseInspection,automatic:room.timePlayback.automatic,hour:room.timeOfDay.hour,rain:s.getMeshByName('coastal-weather-rain').isVisible}));
 const openMenu=async()=>{if(await page.evaluate(()=>!!document.pointerLockElement))await page.keyboard.press('t');else await page.locator('#time-toggle').click();};
 const choose=async(kind,hour)=>{await openMenu();await page.locator('#weather-mode').selectOption(kind);if(hour!==undefined){await page.locator(`[data-time-hour="${hour}"]`).click();await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<26;i++)s.render();e.getDeltaTime=()=>0;});}await page.locator('#time-close').click();await render();};
 const pose=async(x,y,feet,tx,ty,th=feet+1.6)=>{await page.evaluate(({x,y,feet,tx,ty,th})=>{const c=room.firstPersonCamera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);c.position.copyFrom(p(x,y,feet+1.6));c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.ladder.attached=false;room.scooter.riding=false;room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};c.setTarget(p(tx,ty,th));c.getViewMatrix(true);room.updateControls();room.updateInteractionHint();room.updateFloorPlan();},{x,y,feet,tx,ty,th});await render();};
 const shot=async name=>{await page.evaluate(()=>e.runRenderLoop(self.weatherShot=()=>s.render()));await page.waitForTimeout(100);await page.screenshot({path:path.join(out,(prefix?'subpath-':'')+name+'.jpg'),type:'jpeg',quality:85});await page.evaluate(()=>e.stopRenderLoop(weatherShot));};
 const pixels=()=>page.evaluate(async()=>{s.render();const W=e.getRenderWidth(),H=e.getRenderHeight();return Array.from(new Uint8Array(await e.readPixels(0,0,W,H)));});
 const diff=(a,b)=>{let changed=0,peak=0;for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);if(d>=3)changed++;peak=Math.max(peak,d);}return{changed,peak};};
 // Four day/night states at house/coast, on the path, tower gallery and both bathrooms.
 for(const hour of [12,21])for(const kind of ['clear','overcast','fog','storm']){
  await choose(kind,hour);const state=await current();assert.equal(state.op.running,hour===21||kind==='fog');assert.equal(state.p.mainLoadW,hour===21||kind==='fog'?55:5);
  const snap=await page.evaluate(()=>({fog:s.fogDensity,mode:s.fogMode,sky:s.getMaterialByName('coastal-sky')._floats,sea:s.getMaterialByName('coastal-ocean')._floats,lights:s.lights.length,cameras:s.cameras.length}));assert.equal(snap.sky.weatherFogDensity,snap.fog);assert.equal(snap.sea.weatherFogDensity,snap.fog);assert.equal(snap.lights,22);assert.equal(snap.cameras,3);
  const cases=[['house',8.1,12,0,t.x,t.y,12],['path',-70,25,1.0410445648890654,-125,90,20],['gallery',t.x+1.1,t.y+2.4,a.gallery,t.x+30,t.y+35,a.gallery],['ensuite',1.45,5.1,0,2.288,5.35,1.72],['bathroom',3.2,5.25,0,2.512,5.4,1.64]];
  for(const [name,x,y,feet,tx,ty,th]of cases){await pose(x,y,feet,tx,ty,th);await shot(`${hour}-${kind}-${name}`);}
  item.weather.push({hour,kind,op:state.op.running,solarW:state.p.solarW,snapshot:snap});
 }
 await choose('fog',12);await pose(8.1,12,0,t.x,t.y,12);const fogPixels=await pixels(),density=await page.evaluate(()=>s.fogDensity);await page.evaluate(()=>s.fogDensity=0);await render();const noGeometryFog=await pixels();await page.evaluate(d=>s.fogDensity=d,density);await render();item.cases.realGeometryFog=diff(fogPixels,noGeometryFog);assert.ok(item.cases.realGeometryFog.changed>100);
 // Actual mirror RTTs: change weather through the original UI, keeping each camera and time fixed.
 item.cases.mirrors=[];
 for(const [owner,params]of [['ensuite',[1.45,5.1,0,2.288,5.35,1.72]],['bathroom',[3.2,5.25,0,2.512,5.4,1.64]]]){
  const mirrorFrame=()=>page.evaluate(async owner=>{
   for(let i=0;i<4;i++)s.render();const mesh=s.meshes.find(m=>m.metadata?.reflectionRoom===owner),target=mesh.material.reflectionTexture;
   const W=e.getRenderWidth(),H=e.getRenderHeight(),V=mesh.position.constructor,M=s.activeCamera.getViewMatrix().constructor;
   const pts=mesh.getBoundingInfo().boundingBox.vectorsWorld.map(p=>V.Project(p,M.Identity(),s.getTransformMatrix(),{x:0,y:0,width:W,height:H})).map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
   const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),hull=[];
   for(const p of pts){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}const lower=hull.length;
   for(let i=pts.length-2;i>=0;i--){const p=pts[i];while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}hull.pop();
   const raw=await e.readPixels(0,0,W,H),rtt=await target.readPixels();return{pixels:Array.from(raw),W,H,hull,size:target.getSize(),rttType:rtt?.constructor.name||"null",rttLength:rtt?.length||0,hasSky:target.renderList.includes(s.getMeshByName('coastal-sky')),hasSea:target.renderList.includes(s.getMeshByName('coastal-sea'))};
  },owner);
  await choose('clear',12);await pose(...params);const before=await mirrorFrame();
  await choose('fog',12);await pose(...params);const after=await mirrorFrame();
  let changed=0,mask=0;const hull=after.hull,cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  for(let i=0;i<after.W*after.H;i++){const p={x:i%after.W+.5,y:after.H-(Math.floor(i/after.W)+.5)};if(!hull.every((a,n)=>cross(a,hull[(n+1)%hull.length],p)>=0))continue;mask++;let d=0;for(let c=0;c<3;c++)d+=Math.abs(before.pixels[i*4+c]-after.pixels[i*4+c]);if(d>=3)changed++;}
  assert.ok(changed>5,JSON.stringify({owner,changed,mask,rttType:after.rttType}));assert.equal(after.size.width,512);assert.equal(after.hasSky,true);assert.equal(after.hasSea,true);item.cases.mirrors.push({owner,changed,mask,size:after.size,rttType:after.rttType,rttLength:after.rttLength});
 }
 await choose('storm',12);await pose(t.x+1.1,t.y+2.4,a.gallery,t.x+10,t.y+10,a.gallery+1);
 const rainOn=await pixels();await openMenu();await page.locator('#weather-reduced-motion').check();await page.locator('#time-close').click();await render();assert.equal((await current()).rain,false);const rainOff=await pixels();item.cases.rainPixels=diff(rainOn,rainOff);assert.ok(item.cases.rainPixels.changed>10);
 await openMenu();await page.locator('#weather-reduced-motion').uncheck();await page.locator('#time-close').click();await render();assert.equal((await current()).rain,true);
 // Original frame callbacks consume actual energy under fog; menu/settings/map/blur freeze every owner.
 await choose('fog',12);await pose(t.x+2.35,t.y-1,a.floor,t.x+2.35,t.y+.2,a.floor+1.3);
 await openMenu();await page.locator('#time-automatic').check();await page.locator('#time-close').click();await step(1);const before=await current();await step(600);const after=await current();assert.ok(after.op.automaticOperatingHours>before.op.automaticOperatingHours+.9);assert.ok(after.p.mainWh!==before.p.mainWh);assert.equal(after.p.mainLoadW,55);item.cases.fogEnergy={before:before.p,after:after.p,hours:after.op.automaticOperatingHours-before.op.automaticOperatingHours};
 for(const [open,close]of [['#time-toggle','#time-close'],['#settings-btn','#settings-close'],['#floor-plan-toggle','#floor-plan-return']]){await page.locator(open).click();const before=await current();await step(50);const after=await current();assert.deepEqual(after,before);await page.locator(close).click();}
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await current();await step(50);assert.deepEqual(await current(),paused);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));room.updateTimeOfDay(3600);});assert.deepEqual(await current(),paused);item.cases.pauses=true;
 // Real fixed-mode choices and current player controls do not restore complex maintenance commands.
 await choose('storm',12);await pose(t.x+1.1,t.y+2.4,a.gallery,t.x+1.1,t.y+1.05,a.gallery+1.6);
 assert.equal(await page.evaluate(()=>room.pauses.blocked),false);if(!await page.evaluate(()=>!!document.pointerLockElement))await page.locator('#gameCanvas').click({position:{x:640,y:400}});await page.waitForFunction(()=>room.pointerLocked);await page.keyboard.down('w');await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<15;i++)s.render();e.getDeltaTime=()=>0;});await page.keyboard.up('w');
 item.cases.retreat=await page.evaluate(()=>({position:room.firstPersonCamera.position.asArray(),feet:room.jump.feet}));assert.ok(Math.abs(item.cases.retreat.feet-a.gallery)<.2);assert.ok(Math.hypot(item.cases.retreat.position[0]/5+5.4-t.x,item.cases.retreat.position[2]/5+5.4-t.y)<1.95);
 // Responsive menu remains scrollable and every weather control is reachable.
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);await page.evaluate(()=>e.resize());await openMenu();await page.locator('#weather-mode').scrollIntoViewIfNeeded();assert.equal(await page.locator('#weather-mode').isVisible(),true);await shot(`menu-${viewport.width}`);await page.locator('#time-close').scrollIntoViewIfNeeded();await page.locator('#time-close').click();}
 assert.deepEqual(item.errors,[]);assert.deepEqual(item.requests.filter(r=>r.status>=400),[]);item.passed=true;await context.close();
}
record.passed=true;
}finally{fs.writeFileSync(path.join(out,'weather.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}console.log(JSON.stringify({passed:record.passed,browser:record.browser,pages:record.pages.map(p=>({prefix:p.prefix,js:p.initialJsBytes,cases:p.cases,errors:p.errors,warnings:p.warnings}))}));})().catch(e=>{console.error(e);process.exitCode=1;});
