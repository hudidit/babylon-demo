// Independent production dist; fixed camera/render steps are functional evidence, not a performance sample.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const load = require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {HOUSE_CEILING_LIGHTS: fixtures} = load('HouseCeilingLights'), {houseRoom} = load('HouseLayout');
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const url = process.env.STUDY_URL || 'http://127.0.0.1:8210/';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  const page = await context.newPage(), errors=[], warnings=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
  const cdp=await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const record={baseline:'08fb5ae',browser:browser.version(),cacheDisabled:true,fpsOrLoadTimeSampling:false,rooms:[]};
  const render=()=>page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=0;i<4;i++)s.render();});
  const shot=async name=>{
    await render(); await page.evaluate(()=>{self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
    await page.waitForTimeout(180); await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:86});
    await page.evaluate(()=>e.stopRenderLoop(self.shotRender));
  };
  const select=async hour=>{
    if(await page.evaluate(()=>!!document.pointerLockElement))await page.evaluate(()=>document.exitPointerLock());
    await page.locator('#time-toggle').click();await page.locator(`[data-time-hour="${hour}"]`).click();
    await page.evaluate(()=>{for(let i=0;i<28;i++)s.render();});await page.locator('#time-close').click();
    assert.equal(await page.evaluate(()=>room.timeOfDay.hour),hour);
  };
  const pose=async (id,up=false)=>{
    const r=houseRoom(id);
    await page.evaluate(({r,up})=>{
      room.setView('coast'); const c=room.camera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
      c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;
      const x=r.x+r.width/2,y=r.y+r.depth/2;
      c.setTarget(p(up?x:x-r.width*.2,up?y:y-r.depth*.22,up?2.73:1.05));
      c.setPosition(p(up?x+.7:x+r.width*.31,up?y+.9:y+r.depth*.31,1.6));
      c.getViewMatrix(true);c.getProjectionMatrix(true);
    },{r,up}); await render();
  };
  const luminance=()=>page.evaluate(async()=>{
    s.render();const pixels=await e.readPixels(160,180,960,440);let sum=0;
    for(let i=0;i<pixels.length;i+=4)sum+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
    return sum/(pixels.length/4);
  });
  try {
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;}); await render();
    record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
    record.resources=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
    for (const fixture of fixtures) {
      const entry={id:fixture.id,nodes:[]}; await select(0);await pose(fixture.room);
      entry.onLuminance=await luminance();await shot(fixture.room+'-midnight-on');
      await pose(fixture.room,true);await shot(fixture.room+'-fixture');
      // Aim from standing height, using the existing left-click switch after acquiring pointer lock.
      const r=houseRoom(fixture.room);
      await page.evaluate(r=>{
        room.setView('first-person');const c=room.firstPersonCamera,V=c.position.constructor;
        c.position.set((r.x+r.width/2-5.4)*5,3,(r.y+r.depth/2+.22-5.4)*5);
        c.setTarget(new V((r.x+r.width/2-5.4)*5,8.65,(r.y+r.depth/2-5.4)*5));
        c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);
        Object.assign(room.jump,{feet:0,grounded:true,velocity:0,queued:false,originTop:0});
        room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:0};
      },r);await render();
      if(!await page.evaluate(()=>!!document.pointerLockElement))await page.mouse.click(640,400);
      await page.waitForFunction(()=>!!document.pointerLockElement);
      await page.mouse.down();await page.mouse.up();await render();
      assert.equal(await page.evaluate(id=>room.lighting.isLampOn(id),fixture.id),false,fixture.id+' real pointer switch');
      await page.evaluate(()=>document.exitPointerLock());await pose(fixture.room);
      entry.offLuminance=await luminance();await shot(fixture.room+'-midnight-off');
      assert.ok(entry.onLuminance>entry.offLuminance+8,fixture.id+' lights the room rather than only glowing');
      for(const hour of [3,12,21]) {
        await select(hour);
        assert.equal(await page.evaluate(id=>room.lighting.isLampOn(id),fixture.id),false);
      }
      await page.evaluate(id=>room.lighting.toggleLamp(id),fixture.id); await select(0);await pose(fixture.room);
      entry.restoredLuminance=await luminance();assert.ok(Math.abs(entry.restoredLuminance-entry.onLuminance)<1);
      for(const hour of [3,12,21]) {await select(hour);await pose(fixture.room);entry.nodes.push({hour,luminance:await luminance()});}
      await shot(fixture.room+'-evening-on');record.rooms.push(entry);
    }
    record.lightSlots=await page.evaluate(()=>s.meshes.filter(m=>m.getTotalVertices()&&m.material?.maxSimultaneousLights&&m.metadata?.ownerRooms?.some(id=>['living','study','master','bedroom'].includes(id))&&!m.metadata.exterior).map(m=>({name:m.name,slots:m.material.maxSimultaneousLights,sources:m.lightSources.map(l=>l.name),shaderLights:Math.max(0,...m.subMeshes.map(part=>Object.entries(part.materialDefines||{}).filter(([key,value])=>/^LIGHT\d+$/.test(key)&&value===true).length))})));
    for(const m of record.lightSlots)assert.ok(m.sources.length<=m.slots,m.name+' has enough shader slots');
    for(const id of ['living','study','master','bedroom'])assert.ok(record.lightSlots.some(m=>m.sources.includes(id+'-ceiling-lamp-light')));
    record.compiledFloorLights=record.lightSlots.filter(m=>/oak-floor$/.test(m.name));
    assert.equal(record.compiledFloorLights.length,4);
    for(const m of record.compiledFloorLights)assert.ok(m.shaderLights>=m.sources.length,m.name+' compiled shader retains its ceiling source');
    record.originalLampStates=await page.evaluate(()=>[...room.lighting.lamps].filter(([id])=>!id.includes('ceiling')).map(([id,l])=>({id,on:l.on})));
    assert.ok(record.originalLampStates.every(l=>l.on));
    for(const view of ['overview','study','living','master','bedroom','first-person']) {
      await page.evaluate(view=>room.setView(view),view);await render();
      const visible=await page.evaluate(()=>s.transformNodes.filter(n=>n.metadata?.ceilingFixture).every(n=>n.getChildMeshes().every(m=>m.isVisible===(room.currentView==='first-person'))));
      assert.ok(visible,'ceiling fixture visibility '+view);
    }
    if(await page.evaluate(()=>!!document.pointerLockElement))await page.evaluate(()=>document.exitPointerLock());
    const disposed=await page.evaluate(()=>{room.dispose();return{meshes:s.meshes.length,lights:s.lights.length,textures:s.textures.length};});
    assert.deepEqual(disposed,{meshes:0,lights:0,textures:0});record.disposed=disposed;
    record.errors=errors;record.warnings=warnings;record.failedRequests=requests.filter(r=>r.status>=400);
    assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);assert.deepEqual(record.failedRequests,[]);
    record.passed=true;
  } catch(error) {record.failure=String(error.stack||error);throw error;}
  finally {record.errors=errors;record.warnings=warnings;record.failedRequests=requests.filter(r=>r.status>=400);fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
