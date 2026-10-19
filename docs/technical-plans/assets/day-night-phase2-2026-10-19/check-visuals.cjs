// Functional light/sky/water assertions and camera-fixture images, not FPS/load-time samples.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const load = require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {evaluateTimeOfDay: at} = load('RoomTimeOfDay');
const {coastalRoute} = load('CoastalSite'), {coastalSurfaceHeight} = load('CoastalCliff');
const {LIGHTHOUSE} = load('LighthouseLayout');
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const url = process.env.STUDY_URL || 'http://127.0.0.1:8194/';
const quick = process.argv.includes('--quick');
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  const record = {baseline: 'ed703e8 + day-night phase2', url, browser: browser.version(), quick,
    fpsOrLoadTimeSampling: false, method: 'Independent unmodified dist; captured RoomScene public keyframe API and camera fixtures; continuous hour inputs use the pure evaluator.', nodes: []};
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text());});
  page.on('response', r => requests.push({url: r.url(), status: r.status(), bytes: Number(r.headers()['content-length'] || 0)}));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  const render = () => page.evaluate(async () => {s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); for (let i=0;i<3;i++) s.render();});
  const shot = async name => {
    await render(); await page.evaluate(() => {self.shotRender=()=>s.render(); e.runRenderLoop(self.shotRender);});
    await page.waitForTimeout(200); await page.screenshot({path: path.join(output, name+'.jpg'), type: 'jpeg', quality: 88});
    await page.evaluate(() => e.stopRenderLoop(self.shotRender));
  };
  const pose = async (x,y,h,tx,ty,th) => {
    await page.evaluate(({x,y,h,tx,ty,th}) => {
      room.setView('coast'); const c=room.camera, V=c.position.constructor;
      const p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
      c.lowerRadiusLimit=.1; c.upperRadiusLimit=10000; c.lowerBetaLimit=.001; c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;
      c.setTarget(p(tx,ty,th)); c.setPosition(p(x,y,h)); c.getViewMatrix(true); c.getProjectionMatrix(true);
    },{x,y,h,tx,ty,th}); await render();
  };
  const summary = () => page.evaluate(() => ({
    time: room.timeOfDay.hour, metadata: s.metadata.timeOfDay,
    sun: {enabled: room.exterior.sun.isEnabled(), intensity: room.exterior.sun.intensity, direction: room.exterior.sun.direction.asArray(),
      position: room.exterior.sun.position.asArray(), body: room.exterior.sun.metadata.timeBody},
    sky: room.exterior.sky._floats, ocean: room.exterior.ocean.material._floats,
    lamps: [...room.lighting.lamps].map(([id,l])=>({id,on:l.on,intensity:l.light.intensity})),
    windows: [...room.lighting.natural].map(([l])=>({name:l.name,intensity:l.intensity,direction:l.direction.asArray()})),
    exteriorEnvironment: room.exterior.surfaces.ground.environmentIntensity,
    fill: s.getLightByName('room-bounce-light').intensity, ibl: s.iblIntensity, exposure: s.imageProcessingConfiguration.exposure,
    resources: {meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}
  }));
  try {
    await page.goto(url);
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    await page.evaluate(()=>{e.stopRenderLoop(); room.exterior.ocean.clock.advance=()=>0;}); await render();
    record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0); assert.ok(record.initialJsBytes<=3*1048576);
    await page.evaluate(()=>room.setView('coast')); await render();
    const original=await summary(); assert.equal(original.time,12); assert.equal(original.metadata.visualApplied,true);
    const route=coastalRoute(), p=route[Math.floor(route.length*.5)], target=route[Math.floor(route.length*.5)+30];
    for (const hour of quick ? [12,0,6,18] : [0,3,6,9,12,15,18,21]) {
      await page.evaluate(hour=>room.setTimeOfDay(hour),hour); await render();
      const state=await summary(), expected=at(hour);
      assert.equal(state.metadata.stage,2); assert.equal(state.sun.body,expected.primary.kind);
      assert.equal(state.sun.enabled,true);
      assert.ok(Math.abs(state.sun.intensity-expected.primary.intensity)<1e-8);
      expected.primary.lightDirection.forEach((v,i)=>assert.ok(Math.abs(v-state.sun.direction[i])<1e-8));
      assert.deepEqual(state.resources,original.resources); assert.deepEqual(state.lamps,original.lamps);
      assert.equal(state.ibl,.35); assert.equal(state.exposure,1.12);
      assert.ok(Math.abs(state.exteriorEnvironment-3.8*expected.environment.exterior)<1e-8);
      const name=String(hour).padStart(2,'0');
      for (const view of ['balcony','bedroom']) {await page.locator(`[data-view="${view}"]`).click(); await shot(`${name}-${view}`);}
      await pose(16,15,2.1,7,7,1.4); await shot(`${name}-house`);
      await pose(p.x+.5,p.y,coastalSurfaceHeight(p.x,p.y)+1.6,target.x,target.y,coastalSurfaceHeight(target.x,target.y)+1.3); await shot(`${name}-path`);
      await pose(-125,81,5,-125,90,5); await shot(`${name}-tower`);
      await pose(17,5,1.65,14,2.2,.6); await shot(`${name}-scooter`);
      record.nodes.push(state);
    }
    for (const hour of [0,6,12,18]) {
      await page.evaluate(hour=>room.setTimeOfDay(hour),hour);
      const d=at(hour).primary.sourceDirection;
      await pose(8,40,2,8+d[0]*100,40+d[2]*100,2+d[1]*100);
      await shot(`${String(hour).padStart(2,'0')}-sky-body`);
    }
    for (const hour of [5.49,5.55,5.64,18.36,18.4,18.51,23.9999,0.0001]) {
      await page.evaluate(state=>room.applyTimeOfDay(state),at(hour)); await render();
      const s=await summary(); assert.ok(Math.abs(s.sun.intensity-(at(hour).primary?.intensity||0))<1e-8);
      if(!at(hour).primary){assert.equal(s.sun.enabled,false);assert.equal(s.ocean.sunStrength,0);assert.ok(s.windows.every(w=>w.intensity===0));}
    }
    record.twilightInputsVerified=true;
    for (const [name,boundary,tx] of [['dawn',5.625,108],['dusk',18.375,-92]]) {
      await pose(8,40,2,tx,40,2);
      for (const [side,offset] of [['before',-.0001],['after',.0001]]) {
        await page.evaluate(state=>room.applyTimeOfDay(state),at(boundary+offset));
        await shot(`${name}-handoff-${side}`);
      }
    }
    await page.evaluate(()=>{room.setTimeOfDay(0); for(const [id,l]of room.lighting.lamps) if(l.on)room.lighting.toggleLamp(id);});
    await page.locator('[data-view="bedroom"]').click(); await shot('night-bedroom-all-lamps-off');
    await page.evaluate(()=>{room.setTimeOfDay(12);for(const [id,l]of room.lighting.lamps)if(!l.on)room.lighting.toggleLamp(id);});
    await pose(-124.8,88.9,LIGHTHOUSE.floor+1.6,-124.92,91.99,LIGHTHOUSE.floor+1.5); await page.evaluate(()=>room.setTimeOfDay(0)); await shot('night-maintenance-light-on');
    await page.evaluate(()=>room.exterior.lighthouseDetails.toggle()); await shot('night-maintenance-light-off');
    assert.equal(await page.evaluate(()=>room.exterior.lighthouseDetails.on),false);
    await page.evaluate(()=>room.setTimeOfDay(12)); assert.equal(await page.evaluate(()=>room.exterior.lighthouseDetails.on),false);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));room.setTimeOfDay(6);});
    assert.equal(await page.evaluate(()=>s.isDisposed),true); assert.equal(await page.evaluate(()=>s.meshes.length),0);
    assert.deepEqual(errors,[]); assert.deepEqual(requests.filter(r=>r.status>=400),[]); record.passed=true;
  } finally {
    Object.assign(record,{errors,warnings,requests}); fs.writeFileSync(path.join(output,'visuals.json'),JSON.stringify(record,null,2)+'\n'); await browser.close();
  }
  console.log(JSON.stringify({passed:record.passed,nodes:record.nodes.length,initialJsBytes:record.initialJsBytes,errors,warnings}));
})().catch(e=>{console.error(e);process.exitCode=1;});
