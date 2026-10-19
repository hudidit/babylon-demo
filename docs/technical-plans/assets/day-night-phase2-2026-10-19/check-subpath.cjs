const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),page=await context.newPage(),errors=[],warnings=[],requests=[];
 const record={baseline:'ed703e8 + day-night phase2',prefix:'/home/',fpsOrLoadTimeSampling:false};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 try{
  await page.goto(new URL('home/',process.env.STUDY_URL||'http://127.0.0.1:8194/').href);
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
  for(const hour of [6,18,0]){
   const state=await page.evaluate(hour=>{room.setTimeOfDay(hour);s.render();return s.metadata.timeOfDay;},hour);
   assert.equal(state.state.hour,hour);assert.equal(state.visualHour,hour);assert.equal(state.visualApplied,true);
  }
  await page.locator('[data-view="balcony"]').click();await page.screenshot({path:path.join(__dirname,'subpath-night.jpg'),type:'jpeg',quality:88});
  await page.locator('#floor-plan-toggle').click();await page.locator('#map-scope-coast').click();await page.locator('#coast-return-home').click();
  await page.waitForFunction(()=>!!document.pointerLockElement);assert.equal(await page.evaluate(()=>room.timeOfDay.hour),0);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.pointerLockElement);
  await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});
  await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!s.debugLayer.isVisible());
  assert.equal(await page.evaluate(()=>room.timeOfDay.hour),0);record.inspectorLoaded=true;
  assert.ok(requests.filter(r=>new URL(r.url).pathname.endsWith('.js')).every(r=>new URL(r.url).pathname.startsWith('/home/')));
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{Object.assign(record,{errors,warnings,requests});fs.writeFileSync(path.join(__dirname,'subpath.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,initialJsBytes:record.initialJsBytes,inspectorLoaded:record.inspectorLoaded}));
})().catch(e=>{console.error(e);process.exitCode=1;});
