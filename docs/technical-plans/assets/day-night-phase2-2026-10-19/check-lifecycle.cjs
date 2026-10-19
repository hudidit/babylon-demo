const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const out=__dirname,url=process.env.STUDY_URL||'http://127.0.0.1:8194/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),record={baseline:'ed703e8 + day-night phase2',fpsOrLoadTimeSampling:false};
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const held=new Promise(r=>release=r);
  await page.route('**/wooden_bookshelf.glb',async route=>{await held;await route.continue();});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#movement-speed')?.min==='0.25',null,{timeout:120000});
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
  await page.evaluate(()=>room.setTimeOfDay(0));release();
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  record.lateImport=await page.evaluate(()=>{
   const root=s.getTransformNodeByName('antique-bookshelf');
   const materials=[...new Set(root.getDescendants(false).map(m=>m.material).filter(m=>!!m&&room.lighting.environments.has(m)))];
   return {hour:room.timeOfDay.hour,materials:materials.map(m=>({name:m.name,intensity:m.environmentIntensity,base:room.lighting.environments.get(m).intensity})),stage:s.metadata.timeOfDay.stage};
  });
  assert.equal(record.lateImport.hour,0);assert.ok(record.lateImport.materials.length>0);
  record.lateImport.materials.forEach(m=>assert.ok(Math.abs(m.intensity-m.base*.10)<1e-8));
  assert.deepEqual(errors,[]);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.close();
  const failure=await context.newPage(),uncaught=[],expectedNetworkErrors=[];
  failure.on('pageerror',e=>uncaught.push(e.message));failure.on('console',m=>{if(m.type()==='error')expectedNetworkErrors.push(m.text());});
  await failure.route('**/coastal-daylight.hdr',route=>route.abort('failed'));
  await failure.goto(url);await failure.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(failure,await context.newCDPSession(failure));
  for(const hour of [0,12,6,21]){
   const check=await failure.evaluate(hour=>{room.setTimeOfDay(hour);s.render();return{hour:room.timeOfDay.hour,visual:s.metadata.timeOfDay.visualApplied,materials:room.exterior.surfaces.materials.map(m=>({intensity:m.environmentIntensity,reflection:m.reflectionTexture?.name||null})),fallbacks:s.metadata.exteriorFallbacks};},hour);
   assert.equal(check.hour,hour);assert.equal(check.visual,true);assert.ok(check.materials.every(m=>m.intensity===0&&m.reflection===null));
   assert.ok(check.fallbacks.some(f=>f.endsWith('coastal-daylight.hdr')));
  }
  await failure.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));room.setTimeOfDay(6);});
  assert.equal(await failure.evaluate(()=>s.isDisposed),true);assert.equal(await failure.evaluate(()=>s.meshes.length),0);assert.deepEqual(uncaught,[]);
  record.hdrFailure={passed:true,uncaught,expectedNetworkErrors};record.passed=true;await failure.close();
 }finally{fs.writeFileSync(path.join(out,'lifecycle.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(record));
})().catch(e=>{console.error(e);process.exitCode=1;});
