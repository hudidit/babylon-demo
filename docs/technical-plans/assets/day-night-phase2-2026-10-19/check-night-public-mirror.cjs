// Reused lighthouse-finish acceptance; phase2 output directory and time explicitly selected below.
// Actual public-bathroom geometry/reflection check, not a performance sample.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
 const output=process.env.STUDY_CHECK_OUTPUT||__dirname;
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const render=()=>page.evaluate(()=>{for(let i=0;i<5;i++)s.render();});
 const pose=(x,y,tx,ty,h=1.6,th=1.6)=>page.evaluate(({x,y,tx,ty,h,th})=>{const c=s.activeCamera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.position.copyFrom(p(x,y,h));c.setTarget(p(tx,ty,th));if(c===room.firstPersonCamera){const feet=h-1.6;Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};}
  c.getViewMatrix(true);for(let i=0;i<5;i++)s.render();},{x,y,tx,ty,h,th});
 const pixels=()=>page.evaluate(async()=>{const p=(await mirrorPixels).slice();let changed=0;if(self.lastPixels)for(let i=0;i<p.length;i+=4)if(p[i]!==lastPixels[i]||p[i+1]!==lastPixels[i+1]||p[i+2]!==lastPixels[i+2])changed++;self.lastPixels=p;return{changedPixels:changed,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',p))].map(n=>n.toString(16).padStart(2,'0')).join('')};});
 const shot=async name=>{await page.evaluate(()=>{self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});await page.waitForTimeout(300);await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:88});await page.evaluate(()=>e.stopRenderLoop(self.shotRender));};
 const record={fpsOrLoadTimeSampling:false};
 try{
  await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8160/');
  await page.waitForFunction(()=>document.querySelector('#floor-plan-drawing [data-room="bathroom"]').dataset.state==='ready');
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  await page.evaluate(()=>{webpackChunkbabylon_learning.push([[989994],{},r=>self.req=r]);for(const [id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;e.stopRenderLoop();e.getDeltaTime=()=>50;}
   s.getMaterialByName('coastal-ocean').onBindObservable.add(()=>s.getMaterialByName('coastal-ocean').getEffect()?.setFloat('oceanTime',0));self.m=s.meshes.find(m=>m.metadata?.reflectionRoom==='bathroom');self.t=m.material.reflectionTexture;t.onAfterRenderObservable.add(()=>self.mirrorPixels=e.readPixels(0,0,512,512));self.toilet=s.meshes.filter(m=>m.name.startsWith('bathroom-toilet-'));
  });
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await page.context().newCDPSession(page));
 await page.evaluate(()=>room.setTimeOfDay(0));record.timeAtStart=await page.evaluate(()=>room.timeOfDay.hour);assert.equal(record.timeAtStart,0);
  await page.locator('[data-view="first-person"]').click();await pose(3.2,5.4,2.512,5.4);await render();record.visible=await pixels();
  await shot('public-mirror-front');
  await page.evaluate(()=>toilet.forEach(m=>m.setEnabled(false)));await render();record.hiddenToilet=await pixels();assert.ok(record.hiddenToilet.changedPixels>20);
  await page.evaluate(()=>toilet.forEach(m=>m.setEnabled(true)));await render();record.restored=await pixels();assert.equal(record.visible.sha256,record.restored.sha256);
  await pose(3.4,5.4,3.085,5.4,1.6,2.18);await page.mouse.down();await page.mouse.up();await render();assert.equal(await page.evaluate(()=>s.getLightByName('bathroom-lamp-light').intensity),0);
  await pose(3.2,5.4,2.512,5.4);record.lightOff=await pixels();assert.notEqual(record.lightOff.sha256,record.visible.sha256);
  await shot('public-mirror-light-off');
  record.targets=await page.evaluate(()=>s.meshes.filter(m=>m.metadata?.mirrorPlane).map(m=>({room:m.metadata.reflectionRoom,size:m.material.reflectionTexture.getSize(),noPrePass:m.material.reflectionTexture.noPrePassRenderer})));
  assert.equal(record.targets.length,2);assert.ok(record.targets.every(t=>t.size.width===512&&t.noPrePass));assert.deepEqual(errors,[]);record.passed=true;
 }finally{record.errors=errors;fs.writeFileSync(path.join(output,'public-mirror.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
