const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const url=process.env.STUDY_URL||'http://127.0.0.1:8195/';
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
  const record={baseline:'5569564 + day-night phase3',fpsOrLoadTimeSampling:false};
  const capture=async page=>{
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;});
  };
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    let release;const held=new Promise(r=>release=r);
    await page.route('**/wooden_bookshelf.glb',async route=>{await held;await route.continue();});
    await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#movement-speed').min==='0.25',null,{timeout:120000});
    await capture(page);await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();
    await page.evaluate(()=>{for(let i=0;i<8;i++)s.render();});
    assert.equal(await page.evaluate(()=>room.timePlayback.transitioning),true);release();
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    record.lateImport=await page.evaluate(()=>{
      const root=s.getTransformNodeByName('antique-bookshelf');
      const materials=[...new Set(root.getDescendants(false).map(m=>m.material).filter(m=>!!m&&room.lighting.environments.has(m)))];
      return {hour:room.timeOfDay.hour,transitioning:room.timePlayback.transitioning,environment:room.timeOfDay.environment.interior,
        materials:materials.map(m=>({name:m.name,intensity:m.environmentIntensity,base:room.lighting.environments.get(m).intensity}))};
    });
    assert.equal(record.lateImport.transitioning,true);assert.ok(record.lateImport.materials.length>0);
    record.lateImport.materials.forEach(m=>assert.ok(Math.abs(m.intensity-m.base*record.lateImport.environment)<1e-8));
    await page.evaluate(()=>{for(let i=0;i<20;i++)s.render();});assert.equal(await page.evaluate(()=>room.timeOfDay.hour),0);
    assert.deepEqual(errors,[]);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.close();
    const failure=await context.newPage(),uncaught=[],expectedNetworkErrors=[];
    failure.on('pageerror',e=>uncaught.push(e.message));failure.on('console',m=>{if(m.type()==='error')expectedNetworkErrors.push(m.text());});
    await failure.route('**/coastal-daylight.hdr',route=>route.abort('failed'));await failure.goto(url);
    await failure.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await capture(failure);await failure.locator('#time-toggle').click();
    for(const hour of [0,12,6,21]){
      await failure.locator(`[data-time-hour="${hour}"]`).click();
      const value=await failure.evaluate(()=>{for(let i=0;i<26;i++)s.render();return {hour:room.timeOfDay.hour,materials:room.exterior.surfaces.materials.map(m=>({intensity:m.environmentIntensity,reflection:m.reflectionTexture?.name||null})),fallbacks:s.metadata.exteriorFallbacks};});
      assert.equal(value.hour,hour);assert.ok(value.materials.every(m=>m.intensity===0&&m.reflection===null));assert.ok(value.fallbacks.some(f=>f.endsWith('coastal-daylight.hdr')));
    }
    await failure.locator('#time-close').click();await failure.locator('[data-view="first-person"]').click();await failure.waitForFunction(()=>!!document.pointerLockElement);
    // A ladder fixture isolates the new pause owner; the previously delivered full route is unchanged.
    await failure.evaluate(()=>{room.ladder.attached=true;room.ladder.feet=3.54;room.placeLadderCamera();room.updateControls();});
    await failure.keyboard.down('w');await failure.keyboard.press('t');await failure.waitForFunction(()=>!document.pointerLockElement);
    record.ladder=await failure.evaluate(()=>{const before=room.firstPersonCamera.position.asArray();for(let i=0;i<12;i++)s.render();return {before,after:room.firstPersonCamera.position.asArray(),attached:room.ladder.attached,up:room.ladderInput.up};});
    assert.equal(record.ladder.attached,true);assert.equal(record.ladder.up,false);assert.deepEqual(record.ladder.before,record.ladder.after);
    await failure.keyboard.up('w');await failure.keyboard.press('Escape');assert.equal(await failure.evaluate(()=>room.ladder.attached),true);
    await failure.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));room.transitionTimeOfDay(6);room.setTimeAutomatic(true);});
    assert.equal(await failure.evaluate(()=>s.isDisposed),true);assert.equal(await failure.evaluate(()=>s.meshes.length),0);assert.equal(await failure.evaluate(()=>s.onBeforeRenderObservable.observers.length),0);
    assert.deepEqual(uncaught,[]);assert.ok(expectedNetworkErrors.every(message=>message==='Failed to load resource: net::ERR_FAILED'));
    record.hdrFailure={passed:true,uncaught,expectedNetworkErrors};record.passed=true;
  }finally{fs.writeFileSync(path.join(__dirname,'lifecycle.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
  console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});
