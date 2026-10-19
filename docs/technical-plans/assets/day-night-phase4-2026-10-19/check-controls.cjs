// Real UI input plus deterministic render/clock steps. No FPS or load-time measurement.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const {evaluateTimeOfDay: at} = require('../lighthouse-d-2026-10-18/source-loader.cjs')('RoomTimeOfDay');
const out = __dirname, url = process.env.STUDY_URL || 'http://127.0.0.1:8196/';
const near = (a,b,epsilon=1e-7) => assert.ok(Math.abs(a-b)<epsilon, `${a} != ${b}`);
(async () => {
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  const page = await context.newPage(), errors=[], warnings=[], requests=[];
  let phase='initial';
  const record={baseline:'69606ac + day-night phase4',browser:browser.version(),cacheDisabled:true,fpsOrLoadTimeSampling:false,nodes:[],transitions:[],automatic:[]};
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
  const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const frames=(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++)s.render();},n);
  const state=()=>page.evaluate(()=>({hour:room.timeOfDay.hour,playback:room.timePlayback,pauses:room.pauseReasons,controls:room.controlsEnabled,
    view:room.currentView,locked:!!document.pointerLockElement,position:room.firstPersonCamera.position.asArray(),rotation:room.firstPersonCamera.rotation.asArray(),
    riding:room.scooter.riding,speed:room.scooter.speed,ladder:room.ladder.attached,jumpQueued:room.jump.queued,
    primary:room.timeOfDay.primary,visualHour:s.metadata.timeOfDay.visualHour,light:room.exterior.sun.intensity,
    sky:room.exterior.sky._floats,sea:room.exterior.ocean.material._floats}));
  const shot=async name=>{
    await page.evaluate(()=>{self.savedDelta=e.getDeltaTime;e.getDeltaTime=()=>0;self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
    await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:88});
    await page.evaluate(()=>{e.stopRenderLoop(self.shotRender);e.getDeltaTime=self.savedDelta;});
  };
  const open=async()=>{if(await page.locator('#time-menu').evaluate(n=>n.hidden))await page.locator('#time-toggle').click();};
  try {
    await page.goto(url); await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;room.exterior.ocean.clock.advance=()=>0;});
    record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
    record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
    assert.equal((await state()).hour,12);assert.equal((await state()).playback.automatic,false);
    await page.locator('[data-view="balcony"]').click(); await shot('desktop-collapsed');
    phase='nodes'; await open();
    assert.equal(await page.locator(':focus').getAttribute('data-time-hour'),'12');
    assert.equal(await page.locator('#time-toggle').getAttribute('aria-expanded'),'true');
    for(const hour of [0,3,6,9,12,15,18,21]) {
      await page.locator(`[data-time-hour="${hour}"]`).click();await frames(26);
      const value=await state();assert.equal(value.hour,hour);assert.equal(value.playback.transitioning,false);near(value.light,at(hour).primary.intensity);
      assert.deepEqual(value.pauses,['time-menu']);assert.equal(value.controls,false);
      assert.equal(await page.locator(`[data-time-hour="${hour}"]`).getAttribute('aria-checked'),'true');record.nodes.push(value);
    }
    await shot('desktop-expanded-night');
    phase='rapid-retarget';
    await page.locator('[data-time-hour="12"]').click();await frames(26);
    await page.locator('[data-time-hour="0"]').click();await frames(6);const before=await state();
    await page.locator('[data-time-hour="6"]').click();const after=await state();
    assert.equal(before.hour,after.hour);assert.deepEqual(before.primary,after.primary);assert.equal(after.playback.targetHour,6);
    await frames(4);await page.locator('[data-time-hour="18"]').click();await frames(26);
    assert.equal((await state()).hour,18);record.retarget={before,after,final:await state()};
    phase='transition-frames';
    await page.locator('[data-time-hour="12"]').click();await frames(26);await page.locator('[data-time-hour="0"]').click();
    for(let i=0;i<=24;i++){
      if(i)await frames();const value=await state();record.transitions.push({frame:i,dt:.05,...value});
      if(i%4===0)await shot('transition-'+String(i).padStart(2,'0'));
      near(value.sky.sunStrength,value.sea.sunStrength);near(value.light,value.primary?.intensity||0);
      if(i<12&&value.primary)assert.equal(value.primary.kind,'sun');if(i>12&&value.primary)assert.equal(value.primary.kind,'moon');
    }
    assert.equal(record.transitions[12].primary,null);assert.equal((await state()).hour,0);
    phase='keyboard';
    await page.evaluate(()=>{
      self.openBeforeIgnoredKeys=document.querySelector('#time-toggle').getAttribute('aria-expanded');
      for(const fields of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{isComposing:true}])
        document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyT',key:'t',bubbles:true,...fields}));
    });
    assert.equal(await page.locator('#time-toggle').getAttribute('aria-expanded'),await page.evaluate(()=>self.openBeforeIgnoredKeys));
    await page.locator('[data-time-hour="0"]').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(':focus').getAttribute('data-time-hour'),'3');assert.equal((await state()).playback.targetHour,3);
    await page.keyboard.press('End');assert.equal(await page.locator(':focus').getAttribute('data-time-hour'),'21');
    await page.keyboard.press('Home');await page.keyboard.press('Space');await frames(26);assert.equal((await state()).hour,0);
    await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'time-automatic');
    await page.keyboard.press('Space');assert.equal((await state()).playback.automatic,true);
    await frames(20);assert.equal((await state()).hour,0,'menu pauses automatic time');
    await page.locator('#time-close').click();assert.equal(await page.locator(':focus').getAttribute('id'),'time-toggle');
    phase='automatic';
    await page.evaluate(()=>{room.setTimeOfDay(18);room.setTimeAutomatic(true);room.updateTimeOfDay(3600);});
    assert.equal((await state()).hour,18);
    // Full 24-minute clock through the production frame callback, without drawing 14,400 duplicate frames.
    let previous=0;
    for(const step of [210,225,240,1800,3600,5400,7200,9000,10800,12600,14400]){
      await page.evaluate(n=>{for(let i=0;i<n;i++)room.updateTimeOfDay(.1);},step-previous);previous=step;
      const value=await state(),expected=at(value.hour);near(value.light,expected.primary?.intensity||0);near(value.sky.sunStrength,expected.primary?.strength||0);
      record.automatic.push({step,...value});await shot('auto-'+String(step).padStart(5,'0'));
    }
    near((await state()).hour,18);
    phase='ten-hz';
    record.cadence=await page.evaluate(()=>{
      room.setTimeOfDay(12);room.setTimeAutomatic(true);room.updateTimeOfDay(.0166666667);
      const apply=room.exterior.applyTimeOfDay;let batches=0;
      room.exterior.applyTimeOfDay=function(state){batches++;return apply.call(this,state);};
      for(let i=0;i<60;i++)room.updateTimeOfDay(1/60);
      room.exterior.applyTimeOfDay=apply;const beforeStop=batches;
      room.setTimeAutomatic(false);return {batches:beforeStop,hour:room.timeOfDay.hour,visual:s.metadata.timeOfDay.visualHour};
    });
    assert.ok(record.cadence.batches<=10&&record.cadence.batches>=9);near(record.cadence.hour,record.cadence.visual);
    phase='background';
    record.background=await page.evaluate(()=>{
      room.setTimeAutomatic(true);room.updateTimeOfDay(.1);room.updateTimeOfDay(.1);const start=room.timeOfDay.hour;
      window.dispatchEvent(new Event('blur'));room.updateTimeOfDay(3600);const blurred=room.timeOfDay.hour;
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));room.updateTimeOfDay(3600);const overlapped=room.timeOfDay.hour,pauses=room.pauseReasons;
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));e.stopRenderLoop();
      room.updateTimeOfDay(3600);const first=room.timeOfDay.hour;room.updateTimeOfDay(3600);const clamped=room.timeOfDay.hour;
      return {start,blurred,overlapped,pauses,first,clamped};
    });
    near(record.background.start,record.background.blurred);near(record.background.start,record.background.overlapped);assert.deepEqual(record.background.pauses,['hidden']);
    near(record.background.start,record.background.first);near(record.background.clamped-record.background.first,.1/60);
    phase='panels';
    await open();await page.locator('#settings-btn').click();assert.equal(await page.locator('#time-menu').evaluate(n=>n.hidden),true);
    assert.equal(await page.locator('#settings-menu').evaluate(n=>n.hidden),false);
    await page.locator('#time-toggle').click();assert.equal(await page.locator('#settings-menu').evaluate(n=>n.hidden),true);
    assert.deepEqual((await state()).pauses,['time-menu']);
    await page.keyboard.press('Escape');await page.locator('#settings-btn').click();
    await page.evaluate(()=>room.setPaused('external',true));await page.locator('#settings-close').click();
    assert.deepEqual((await state()).pauses,['external']);assert.equal((await state()).controls,false);
    await page.evaluate(()=>room.setPaused('external',false));await frames(2);
    await page.locator('#floor-plan-toggle').click();assert.equal(await page.locator('#time-controls').evaluate(n=>n.hidden),true);
    const mapHour=(await state()).hour;await frames(20);assert.equal((await state()).hour,mapHour);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#time-controls').evaluate(n=>n.hidden),false);
    phase='inspection-clock';
    await page.evaluate(()=>{
      room.setView('details');room.setTimeOfDay(12);room.setTimeAutomatic(true);
      const mesh=s.meshes.find(mesh=>mesh.metadata?.interactionId==='desk-letter');mesh.computeWorldMatrix(true);
      const target=mesh.getBoundingInfo().boundingBox.centerWorld,camera=room.camera,V=camera.position.constructor;
      camera.setTarget(target);camera.setPosition(target.add(new V(1,4,4)));camera.getViewMatrix(true);s.render();
    });
    await page.mouse.click(640,400);assert.equal(await page.locator('#item-inspection').evaluate(n=>n.open),true);
    const inspectionHour=(await state()).hour;await frames(24);assert.equal((await state()).hour,inspectionHour);
    assert.equal(await page.locator('#time-controls').evaluate(n=>n.hidden),true);assert.ok((await state()).pauses.includes('inspection'));
    await page.keyboard.press('Escape');assert.equal(await page.locator('#item-inspection').evaluate(n=>n.open),false);
    await frames();assert.equal((await state()).hour,inspectionHour);await frames();assert.ok((await state()).hour>inspectionHour);
    record.inspectionPause={hour:inspectionHour,after:await state(),resumedOnSecondFrame:true};
    phase='first-person';
    await page.evaluate(()=>{room.setTimeAutomatic(false);room.setTimeOfDay(12);});
    await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
    await page.keyboard.down('w');await frames(3);await page.keyboard.press('t');
    await page.waitForFunction(()=>!document.pointerLockElement);const paused=await state();
    assert.equal(paused.view,'first-person');assert.equal(paused.controls,false);assert.equal(await page.locator('#time-menu').evaluate(n=>n.hidden),false);
    await page.keyboard.press('Space');await page.mouse.wheel(0,180);await frames(8);
    assert.deepEqual((await state()).position,paused.position);assert.equal((await state()).jumpQueued,false);
    await page.keyboard.press('Escape');assert.equal((await state()).view,'first-person');assert.equal((await state()).locked,false);
    await page.mouse.click(640,350);await page.waitForFunction(()=>!!document.pointerLockElement);await frames(8);
    assert.deepEqual((await state()).position,paused.position,'held key from before the menu must not resume movement');
    await page.keyboard.up('w');await page.keyboard.press('t');await page.keyboard.press('t');
    assert.equal((await state()).view,'first-person');assert.equal((await state()).locked,false);record.walkingPause={paused,after:await state()};
    phase='riding';
    await page.evaluate(()=>{room.scooter.riding=true;room.scooter.speed=3;room.placeRiderCamera();room.updateControls();});
    await page.mouse.click(640,350);await page.waitForFunction(()=>!!document.pointerLockElement);await page.keyboard.down('w');await frames(3);await page.keyboard.press('t');
    const riding=await state();assert.equal(riding.riding,true);assert.equal(riding.speed,0);assert.equal(riding.view,'first-person');
    await frames(12);assert.deepEqual((await state()).position,riding.position);
    await page.keyboard.press('Escape');assert.equal((await state()).riding,true);await page.keyboard.up('w');record.ridingPause={paused:riding,after:await state()};
    await page.evaluate(()=>{room.scooter.riding=false;room.returnHome();room.pointerLock.release();room.setView('balcony');});
    phase='inspector';
    await open();await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});
    assert.equal(await page.locator('#time-controls').evaluate(n=>n.hidden),true);assert.equal((await state()).controls,false);
    await page.evaluate(()=>s.debugLayer.hide());await frames(2);
    assert.equal(await page.locator('#time-controls').evaluate(n=>n.hidden),false);assert.equal((await state()).controls,true);
    record.inspectorInternalHide={passed:true,method:'scene.debugLayer.hide(); two rendered frames release only the inspector pause'};
    phase='reduced-motion';await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>room.setTimeOfDay(6));await open();
    await page.locator('[data-time-hour="18"]').click();await frames(2);assert.equal((await state()).primary,null);await frames(2);assert.equal((await state()).hour,18);
    record.reducedMotion=await state();await shot('reduced-motion-complete');
    phase='dispose';await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));});
    assert.equal(await page.evaluate(()=>s.isDisposed),true);assert.equal(await page.evaluate(()=>s.meshes.length),0);
    await page.keyboard.press('t');assert.equal(await page.locator('#time-menu').evaluate(n=>n.hidden),true);await page.locator('#time-toggle').click();
    assert.equal(await page.locator('#time-menu').evaluate(n=>n.hidden),true,'menu events are removed on scene disposal');
    assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.passed=true;
  } finally {
    if(!record.passed)await page.screenshot({path:path.join(out,'failure-'+phase+'.jpg'),type:'jpeg'}).catch(()=>{});
    Object.assign(record,{phase,errors,warnings,requests});fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(record,null,2)+'\n');await browser.close();
  }
  console.log(JSON.stringify({passed:record.passed,nodes:record.nodes.length,frames:record.transitions.length,automatic:record.automatic.length,initialJsBytes:record.initialJsBytes}));
})().catch(error=>{console.error(error);process.exitCode=1;});
