const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core');
const baseline=process.argv.includes('--baseline'),out=path.join(__dirname,baseline?'before':'after');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record={baseline,manifestSha256:sha(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))),errors:[],warnings:[],views:[]};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
record.browser=browser.version();const requests=[],pending=[];
page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
page.on('response',r=>{if(r.status()>=400)record.errors.push(r.status()+' '+r.url());if(new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>requests.push({url:r.url(),bytes:b.length,sha256:sha(b)})));});
await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8254/',{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);await Promise.all(pending);record.firstScreenJs={files:requests,bytes:requests.reduce((n,f)=>n+f.bytes,0)};assert.ok(record.firstScreenJs.bytes<=3*1048576);
await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;room.setTimeOfDay(0);room.setWeather('clear');room.setView('coast');});
const pose=async(x,y,h,tx,ty,th)=>{await page.evaluate(({x,y,h,tx,ty,th})=>{const c=room.camera,V=c.position.constructor;c.lowerRadiusLimit=1;c.upperRadiusLimit=5000;c.setTarget(new V((tx-5.4)*5,-5+th*5,(ty-5.4)*5));c.setPosition(new V((x-5.4)*5,-5+h*5,(y-5.4)*5));c.getViewMatrix(true);},{x,y,h,tx,ty,th});};
const render=async()=>{await page.evaluate(async()=>{s.render();await new Promise(r=>s.executeWhenReady(r));for(let i=0;i<3;i++)s.render();});};
const phase=async radians=>{await page.evaluate(r=>{const goal=r/(2*Math.PI);for(let i=0;i<110;i++){const delta=goal-room.lighthouseOperation.rotationTurns;if(Math.abs(delta)<1e-8||Math.abs(Math.abs(delta)-1)<1e-8)break;const remaining=(delta+1)%1;room.updateTimeOfDay(Math.min(.1,remaining*10));}if(Math.abs(room.lighthouseOperation.rotationRadians-r)>1e-5)throw new Error('Phase did not advance through the shared clock');},radians);await render();};
const shot=async name=>{await render();await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:88});record.views.push({name,state:await page.evaluate(()=>({turns:room.lighthouseOperation.rotationTurns,power:room.exterior.ocean.material._floats.shaftPower}))});};
// Reproducible observation fixtures: a sea establishing view and a grounded coastal path view.
await pose(-65,150,18,-124,108,17);await phase(Math.PI/2);await shot('sea-side');await phase(0);await shot('sea-forward');
await pose(-94,44,3.2,-124,88,20);await phase(Math.PI/2);await shot('coastal-path');
await pose(11,12,1.6,-124,88,21);await phase(Math.PI*.42);await shot('home-distance');
if(!baseline){
await pose(240,300,100,340,90,-28);await phase(Math.PI/2);await shot('sea-landing');
await page.evaluate(()=>room.exterior.lighthouseDetails.beacon.volume.mesh.isVisible=false);await shot('sea-light-only');
const pixels=()=>page.evaluate(()=>{s.render();const pixels=new Uint8Array(e.getRenderWidth()*e.getRenderHeight()*4);e._gl.readPixels(0,0,e.getRenderWidth(),e.getRenderHeight(),e._gl.RGBA,e._gl.UNSIGNED_BYTE,pixels);return Array.from(pixels);});
const lit=await pixels();await page.evaluate(()=>{const m=room.exterior.ocean.material;self.darkSeaObserver=m.onBindObservable.add(()=>m.getEffect().setFloat('shaftPower',0));});await shot('sea-light-disabled');const dark=await pixels();
record.seaLight={changedChannels:lit.reduce((n,v,i)=>n+(v!==dark[i]?1:0),0),maxDifference:lit.reduce((n,v,i)=>Math.max(n,Math.abs(v-dark[i])),0)};assert.ok(record.seaLight.changedChannels>100);assert.ok(record.seaLight.maxDifference>20);
await page.evaluate(()=>{room.exterior.ocean.material.onBindObservable.remove(darkSeaObserver);room.exterior.lighthouseDetails.beacon.volume.mesh.isVisible=true;});
// Original bounded scene updates drive all rotation; pause and resume use the real T menu.
await page.evaluate(()=>{room.setTimeOfDay(0);e.getDeltaTime=()=>50;s.render();});
record.rotation=await page.evaluate(()=>{const before=room.lighthouseOperation.rotationTurns;for(let i=0;i<50;i++)s.render();return{before,after:room.lighthouseOperation.rotationTurns,direction:room.exterior.ocean.material._vectors3.shaftDirection.asArray()};});
assert.ok(Math.abs(((record.rotation.after-record.rotation.before+1)%1)-.25)<1e-5);
await page.locator('#time-toggle').click();const paused=await page.evaluate(()=>room.lighthouseOperation.rotationTurns);await page.evaluate(()=>{for(let i=0;i<50;i++)s.render();});assert.equal(await page.evaluate(()=>room.lighthouseOperation.rotationTurns),paused);await page.locator('#time-close').click();
record.resume=await page.evaluate(()=>{const before=room.lighthouseOperation.rotationTurns;s.render();const first=room.lighthouseOperation.rotationTurns;s.render();const second=room.lighthouseOperation.rotationTurns;e.getDeltaTime=()=>0;return{before,first,second};});assert.equal(record.resume.first,record.resume.before);assert.ok(Math.abs(((record.resume.second-record.resume.first+1)%1)-.005)<1e-6);record.pausedAndResumed=true;
await page.evaluate(()=>room.setTimeOfDay(12));await render();assert.equal(await page.evaluate(()=>room.exterior.ocean.material._floats.shaftPower),0);await shot('day-standby');
await page.evaluate(()=>{room.lighthouseState.startTest();room.notifyLighthouseOperation();});await render();assert.equal(await page.evaluate(()=>room.exterior.ocean.material._floats.shaftPower),await page.evaluate(()=>room.lighthouseInspection.transmission));record.dayTest=true;
await page.evaluate(()=>room.setTimeOfDay(0));
await pose(-65,150,18,-124,108,17);await phase(Math.PI/2);
for(const viewport of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);await shot('night-'+viewport.width);}
await page.setViewportSize({width:1280,height:800});
for(const weather of ['fog','storm']){await page.evaluate(w=>room.setWeather(w),weather);await render();record.views.push({weather,fog:await page.evaluate(()=>room.exterior.lighthouseDetails.beacon.volume.material._floats.weatherFogDensity)});await shot(weather);}
await page.evaluate(()=>room.setWeather('clear'));

await page.evaluate(()=>{room.camera.minZ=.1;});await pose(-121,90,21.24,-125,90,20.85);await phase(0);await shot('gallery-optic');
record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),lights:s.lights.length,materials:s.materials.length,targets:s.textures.filter(t=>t.isRenderTarget).length}));
record.ready=await page.evaluate(()=>({volume:room.exterior.lighthouseDetails.beacon.volume.material.getEffect().isReady(),ocean:room.exterior.ocean.material.getEffect().isReady()}));assert.deepEqual(record.ready,{volume:true,ocean:true});
}
assert.deepEqual(record.errors,[]);
if(!baseline){await page.evaluate(()=>room.dispose());record.disposed=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,transforms:s.transformNodes.length}));assert.ok(Object.values(record.disposed).every(v=>v===0));}
record.passed=true;
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}console.log(JSON.stringify({passed:record.passed,views:record.views,errors:record.errors,js:record.firstScreenJs?.bytes}));})().catch(e=>{console.error(e);process.exitCode=1;});
