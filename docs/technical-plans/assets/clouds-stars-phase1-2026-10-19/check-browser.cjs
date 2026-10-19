// Unmodified production page. Camera fixtures and fixed time steps test visuals, not performance.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const load = require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {evaluateTimeOfDay: at} = load('RoomTimeOfDay');
const out = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const url = process.env.STUDY_URL || 'http://127.0.0.1:8197/';
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const context = await browser.newContext({viewport: {width:1280,height:800}, deviceScaleFactor:1, serviceWorkers:'block'});
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  const record = {baseline:'bea1db6', url, browser:browser.version(), fpsOrLoadTimeSampling:false,
    method:'Real menu, fixed 50ms steps; existing RoomScene captured with CDP. Sky pixel probes change only existing uniforms and restore them.', nodes:[], transitions:[]};
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text());});
  page.on('response', r => requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', {cacheDisabled:true});
  const frames = n => page.evaluate(n => {for(let i=0;i<n;i++) s.render();}, n);
  const render = async () => {await frames(1); await page.evaluate(async () => {await new Promise(resolve => s.executeWhenReady(() => resolve()));}); await frames(2);};
  const shot = async name => {
    await page.evaluate(() => {e.getDeltaTime=()=>0;});
    await render();
    await page.evaluate(() => {e.getDeltaTime=()=>0; self.shotRender=()=>s.render(); e.runRenderLoop(self.shotRender);});
    await page.waitForTimeout(150); await page.screenshot({path:path.join(out,name+'.png')});
    await page.evaluate(() => {e.stopRenderLoop(self.shotRender); e.getDeltaTime=()=>50;});
  };
  const skyPose = async (azimuth=140, elevation=45, distance=100) => {
    await page.evaluate(({azimuth,elevation,distance}) => {
      room.setView('coast'); const c=room.camera, V=c.position.constructor;
      const a=azimuth*Math.PI/180,h=elevation*Math.PI/180;
      const p=new V(13,5,173),d=new V(Math.cos(h)*Math.sin(a),Math.sin(h),-Math.cos(h)*Math.cos(a));
      c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;
      c.setTarget(p.add(d.scale(distance)));c.setPosition(p);c.getViewMatrix(true);c.getProjectionMatrix(true);
    }, {azimuth,elevation,distance}); await render();
  };
  const select = async hour => {
    await page.locator('#time-toggle').click();await page.locator(`[data-time-hour="${hour}"]`).click();
    await frames(26);await page.locator('#time-close').click();
    near(await page.evaluate(()=>room.timeOfDay.hour),hour);
  };
  const summary = () => page.evaluate(() => ({state:room.timeOfDay,sky:{...room.exterior.sky._floats},
    cloudLight:room.exterior.sky._vectors3.skyCloudLight.asArray(),cloudShade:room.exterior.sky._vectors3.skyCloudShade.asArray(),
    moonDirection:room.exterior.sky._vectors3.skyMoonDirection.asArray(),sea:{...room.exterior.ocean.material._floats},
    skyReady:s.getMeshByName('coastal-sky').isReady(true),seaReady:s.getMeshByName('coastal-sea').isReady(true),
    exposure:s.imageProcessingConfiguration.exposure,ibl:s.iblIntensity,
    resources:{meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length},
    lamps:[...room.lighting.lamps].map(([id,l])=>({id,on:l.on,intensity:l.light.intensity}))}));
  try {
    await page.goto(url);await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>50;room.exterior.ocean.clock.advance=()=>0;});await render();
    record.initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes=record.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.initialJsBytes<=3*1048576);
    const initial=await summary();
    for(const hour of [6,12,18,0]) {
      await select(hour);await page.locator('[data-view="balcony"]').click();await shot(`${String(hour).padStart(2,'0')}-balcony`);
      await skyPose();await shot(`${String(hour).padStart(2,'0')}-sky`);
      const result=await summary(),expected=at(hour);
      assert.ok(result.skyReady&&result.seaReady);near(result.sky.skyStarVisibility,expected.sky.starVisibility);
      near(result.sky.skyStarVisibility,result.sea.skyStarVisibility);assert.deepEqual(result.cloudLight,[...expected.sky.cloudLight]);
      assert.deepEqual(result.cloudShade,[...expected.sky.cloudShade]);assert.deepEqual(result.moonDirection,[...expected.moon.sourceDirection]);
      near(result.exposure,1.12);near(result.ibl,.35);assert.deepEqual(result.resources,initial.resources);assert.deepEqual(result.lamps,initial.lamps);
      record.nodes.push(result);
      if(hour===6||hour===18) {await skyPose(hour===6?90:270,20);await shot(`${hour}-sunward-clouds`);}
    }
    // GPU comparison isolates actual star output, daylight zero, no sub-horizon stars and fixed repeatability.
    const starProbe = async (hour,azimuth,elevation) => {
      await select(hour);await skyPose(azimuth,elevation);
      return page.evaluate(async () => {
        const mat=room.exterior.sky,weight=mat._floats.skyStarVisibility;
        const read=async()=>{s.render();return new Uint8Array(await e.readPixels(320,260,640,360));};
        const visible=await read();mat.setFloat('skyStarVisibility',0);const hidden=await read();
        mat.setFloat('skyStarVisibility',weight);const repeat=await read();
        let changed=0,energy=0,peak=0,repeatDifferences=0;
        for(let i=0;i<visible.length;i+=4){let delta=0;for(let c=0;c<3;c++){delta+=Math.max(0,visible[i+c]-hidden[i+c]);if(visible[i+c]!==repeat[i+c])repeatDifferences++;}
          if(delta>=3)changed++;energy+=delta;peak=Math.max(peak,delta);}
        return {weight,changedPixels:changed,positiveChannelEnergy:energy,peakChannelDelta:peak,repeatDifferences};
      });
    };
    record.starPixels={night:await starProbe(0,40,55),day:await starProbe(12,40,55),belowHorizon:await starProbe(0,40,-35)};
    assert.ok(record.starPixels.night.changedPixels>20,'night stars must produce real GPU pixels');
    assert.equal(record.starPixels.night.repeatDifferences,0);assert.equal(record.starPixels.day.changedPixels,0);assert.equal(record.starPixels.belowHorizon.changedPixels,0);
    for(const hour of [12,0]) {await select(hour);for(const [name,a,h]of [['north',0,45],['east',90,45],['south',180,45],['west',270,45],['zenith',0,89.9]]){
      await skyPose(a,h);await shot(`${String(hour).padStart(2,'0')}-${name}`);
    }}
    await select(12);await skyPose();await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();
    for(let i=0;i<=24;i++) {
      const value=await summary();record.transitions.push({frame:i,hour:value.state.hour,stars:value.sky.skyStarVisibility,cloudLight:value.cloudLight});
      if(i%4===0)await shot(`transition-${String(i).padStart(2,'0')}`);await frames(1);
    }
    assert.equal(record.transitions[0].stars,0);assert.equal(record.transitions.at(-1).stars,1);
    for(let i=1;i<record.transitions.length;i++)assert.ok(record.transitions[i].stars>=record.transitions[i-1].stars);
    await page.locator('[data-time-hour="12"]').click();await frames(7);const before=(await summary()).sky.skyStarVisibility;
    await page.locator('[data-time-hour="6"]').click();near((await summary()).sky.skyStarVisibility,before);
    await frames(1);const after=(await summary()).sky.skyStarVisibility;assert.ok(after>0&&after<before);
    await frames(25);assert.equal((await summary()).sky.skyStarVisibility,0);record.retarget={before,after,passed:true};
    await page.locator('#time-close').click();await page.emulateMedia({reducedMotion:'reduce'});await select(12);
    await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();await frames(2);
    record.reducedMidpoint=await summary();near(record.reducedMidpoint.sky.skyStarVisibility,.5);near(record.reducedMidpoint.sky.skyMoonVisibility,0);
    await frames(2);near((await summary()).state.hour,0);await page.locator('#time-close').click();await shot('reduced-motion-midnight');
    // A focused existing UI regression; full travel and double-mirror acceptance stays in phases 2/3.
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('[data-view="balcony"]').click();
    await page.locator('#floor-plan-toggle').click();await page.keyboard.press('Escape');
    await page.locator('#settings-btn').click();await page.keyboard.press('Escape');
    await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});
    await page.waitForFunction(()=>!document.querySelector('#inspect-btn').disabled);
    await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!s.debugLayer.isVisible());
    record.inspectorLoaded=true;assert.deepEqual((await summary()).resources,initial.resources);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));});
    record.disposed=await page.evaluate(()=>({disposed:s.isDisposed,meshes:s.meshes.length,materials:s.materials.length,lights:s.lights.length}));
    assert.equal(record.disposed.disposed,true);assert.equal(record.disposed.meshes,0);assert.equal(record.disposed.materials,0);
    assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=400),[]);record.passed=true;
  } finally {
    Object.assign(record,{errors,warnings,requests});fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();
  }
  console.log(JSON.stringify({passed:record.passed,nodes:record.nodes.length,initialJsBytes:record.initialJsBytes,starPixels:record.starPixels,errors,warnings}));
})().catch(error=>{console.error(error);process.exitCode=1;});
