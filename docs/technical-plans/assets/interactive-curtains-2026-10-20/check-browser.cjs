// Real pointer input on final dist. Fixed poses/deltas are functional checks, not FPS/load-time samples.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const output=path.resolve(process.env.STUDY_CHECK_OUTPUT||__dirname),url=process.env.STUDY_URL||'http://127.0.0.1:8211/';
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],warnings=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const record={baseline:'603342d',browser:browser.version(),fpsOrLoadTimeSampling:false,curtains:[]};
  const frames=(n=4)=>page.evaluate(async n=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=1;i<n;i++)s.render();},n);
  const shot=async name=>{await page.evaluate(()=>{e.getDeltaTime=()=>0;self.shotRender=()=>s.render();e.runRenderLoop(shotRender);});await page.waitForTimeout(160);await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:86});await page.evaluate(()=>{e.stopRenderLoop(shotRender);e.getDeltaTime=()=>50;});};
  const select=async hour=>{
    if(await page.evaluate(()=>!!document.pointerLockElement))await page.evaluate(()=>document.exitPointerLock());
    await page.locator('#time-toggle').click();await page.locator(`[data-time-hour="${hour}"]`).click();await frames(28);await page.locator('#time-close').click();
  };
  const aim=async(id,closed=false,firstPerson=false)=>{
    await page.evaluate(({id,closed,firstPerson})=>{
      room.setView(firstPerson?'first-person':'coast');const c=firstPerson?room.firstPersonCamera:room.camera;
      const curtain=room.interactions.curtains.find(state=>state.curtain.id===id).curtain,V=c.position.constructor;
      const matrix=curtain.root.computeWorldMatrix(true).clone(),p=(x,y,z)=>V.TransformCoordinates(new V(x,y,z),matrix);
      const target=p(closed?0:5.8,0,-.75),from=p(closed?0:5.8,0,-4.4);
      if(c.setPosition){c.minZ=.1;c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;c.movement.resetPanVelocity();c.movement.resetRotationVelocity();c.setTarget(target);c.setPosition(from);}
      else{c.position.copyFrom(from);c.setTarget(target);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);const feet=(from.y+5)/5-1.6;Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(from);room.stableWalk={position:from.clone(),feet};}
      c.getViewMatrix(true);c.getProjectionMatrix(true);
    },{id,closed,firstPerson});await frames();
  };
  const state=id=>page.evaluate(id=>{const entry=room.interactions.curtains.find(state=>state.curtain.id===id);return{progress:entry.progress,closed:entry.closed,tie:entry.curtain.meshes[2].visibility,position:Array.from(entry.curtain.meshes[0].getVerticesData('position'))};},id);
  const viewWindow=id=>page.evaluate(id=>{
    room.setView('coast');const c=room.camera,V=c.position.constructor,root=room.interactions.curtains.find(state=>state.curtain.id===id).curtain.root;
    const matrix=root.computeWorldMatrix(true).clone(),p=(x,y,z)=>V.TransformCoordinates(new V(x,y,z),matrix);
    c.minZ=.1;c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
    c.setTarget(p(0,0,-.75));c.setPosition(p(0,0,-root.scaling.x*10.3*1.4));c.getViewMatrix(true);c.getProjectionMatrix(true);
    e.getDeltaTime=()=>0;s.render();e.getDeltaTime=()=>50;
  },id);
  try{
    await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;});await frames();
    record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
    record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
    record.originalLamps=await page.evaluate(()=>[...room.lighting.lamps].map(([id,l])=>({id,on:l.on,intensity:l.light.intensity})));
    const ids=await page.evaluate(()=>room.interactions.curtains.map(state=>state.curtain.id));assert.equal(ids.length,6);
    for(const id of ids){
      await select(id.startsWith('living')?9:12);await aim(id);const open=await state(id);
      const action=await page.evaluate(()=>room.interactions.pick(s.activeCamera.getForwardRay(7.5))?.label());assert.ok(action?.startsWith('关闭'),id+' reachable fabric');
      await viewWindow(id);await shot(id+'-open');await aim(id);await page.mouse.click(640,400);await frames(6);const middle=await state(id);
      record.current={id,progress:middle.progress,closed:middle.closed,camera:await page.evaluate(()=>({position:room.camera.position.asArray(),target:room.camera.target.asArray(),radius:room.camera.radius,active:s.activeCamera.name,action:room.interactions.pick(s.activeCamera.getForwardRay(7.5))?.label()}))};
      assert.ok(middle.progress>0&&middle.progress<1);await viewWindow(id);await shot(id+'-moving');
      // Reverse using the actual moving fabric, then recover the exact initial vertices.
      const x=await page.evaluate(id=>{const c=room.interactions.curtains.find(state=>state.curtain.id===id).curtain;const p=c.meshes[0].getVerticesData('position');return p[(20*41+20)*3];},id);
      await page.evaluate(({id,x})=>{const c=room.camera,V=c.position.constructor,m=room.interactions.curtains.find(state=>state.curtain.id===id).curtain.root.computeWorldMatrix(true);const p=z=>V.TransformCoordinates(new V(x,0,z),m);c.setTarget(p(-.75));c.setPosition(p(-4.4));c.getViewMatrix(true);},{id,x});
      // Aiming does not advance a frame, so the mid-motion toggle must not snap geometry.
      const before=await state(id);await page.mouse.click(640,400);assert.deepEqual((await state(id)).position,before.position);
      await frames(22);assert.deepEqual((await state(id)).position,open.position);
      await aim(id);await page.mouse.click(640,400);await frames(22);const closed=await state(id);assert.equal(closed.progress,1);assert.equal(closed.tie,0);
      await viewWindow(id);await shot(id+'-closed');
      await select(0);assert.equal((await state(id)).progress,1,'night preserves closure');
      if(id.startsWith('living'))await shot(id+'-midnight-closed');
      await aim(id,true);await page.mouse.click(640,400);await frames(22);assert.deepEqual((await state(id)).position,open.position);assert.equal((await state(id)).tie,1);
      record.curtains.push({id,pointerCloseOpen:true,reverse:true,dayNightPreserved:true,restoredExactly:true});
    }
    await aim('living-window-curtains');await page.mouse.click(640,400);await frames(4);
    const paused=await state('living-window-curtains');await page.locator('#floor-plan-toggle').click();await frames(20);
    assert.equal((await state('living-window-curtains')).progress,paused.progress,'map pauses the current fold without resetting');
    await page.keyboard.press('Escape');await frames(22);assert.equal((await state('living-window-curtains')).progress,1);
    await aim('living-window-curtains',true);await page.mouse.click(640,400);await frames(22);record.mapPause=true;
    await aim('living-window-curtains',false,true);
    if(!await page.evaluate(()=>!!document.pointerLockElement))await page.mouse.click(640,400);
    await page.waitForFunction(()=>!!document.pointerLockElement);await page.mouse.down();await page.mouse.up();await frames(22);
    assert.equal((await state('living-window-curtains')).progress,1);await shot('first-person-closed');
    await page.evaluate(()=>document.exitPointerLock());await aim('living-window-curtains',true);await page.mouse.click(640,400);await frames(22);
    assert.equal((await state('living-window-curtains')).progress,0);record.firstPersonPointer=true;
    const lamps=await page.evaluate(()=>[...room.lighting.lamps].map(([id,l])=>({id,on:l.on,intensity:l.light.intensity})));assert.deepEqual(lamps,record.originalLamps);
    record.collision=await page.evaluate(()=>s.meshes.filter(m=>m.metadata?.softCurtain).every(m=>!m.checkCollisions));assert.equal(record.collision,true);
    record.mirrors=await page.evaluate(()=>s.textures.filter(t=>t.name.includes('-mirror-target-')).map(t=>({name:t.name,curtainMeshes:t.renderList.filter(m=>m.metadata?.softCurtain).map(m=>m.name)})));assert.equal(record.mirrors.length,2);assert.ok(record.mirrors.some(t=>t.curtainMeshes.some(n=>n.startsWith('ensuite-window'))));
    const finalResources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));assert.deepEqual(finalResources,record.resources);
    record.disposed=await page.evaluate(()=>{room.dispose();return{meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length};});assert.deepEqual(record.disposed,{meshes:0,materials:0,textures:0,lights:0});
    assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.passed=true;
  }catch(error){record.failure=String(error.stack||error);throw error;}
  finally{record.errors=errors;record.warnings=warnings;record.failedRequests=requests.filter(r=>r.status>=400);fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
