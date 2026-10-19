// Shader compilation and four-node smoke checks. Emulated viewports are not physical devices.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const {evaluateTimeOfDay:at}=require('../lighthouse-d-2026-10-18/source-loader.cjs')('RoomTimeOfDay');
const out=path.resolve(process.env.STUDY_CHECK_OUTPUT||__dirname),url=process.env.STUDY_URL||'http://127.0.0.1:8197/';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
(async()=>{
  const record={baseline:'bea1db6',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,cases:[]};
  try{for(const kind of ['chromium','webkit']){
    const browser=await pw[kind].launch({executablePath:kind==='chromium'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,headless:true});
    try{for(const dpr of [1,2]){
      const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
      const errors=[],warnings=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
      await page.goto(url);await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
      await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);
      await page.evaluate(()=>{e.getDeltaTime=()=>50;});
      const initial=await page.evaluate(()=>[s.meshes.length,s.materials.length,s.textures.length,s.lights.length,s.cameras.length]);
      for(const [width,height,name]of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
        await page.setViewportSize({width,height});await page.locator('[data-view="balcony"]').tap();
        await page.locator('#time-toggle').tap();const nodes=[];
        for(const hour of [6,12,18,0]){
          await page.locator(`[data-time-hour="${hour}"]`).tap();
          await page.evaluate(()=>{for(let i=0;i<26;i++)s.onBeforeRenderObservable.notifyObservers(s);s.render();});
          const value=await page.evaluate(()=>{const mat=s.getMaterialByName('coastal-sky');return {
            hour:s.metadata.timeOfDay.state.hour,stars:mat._floats.skyStarVisibility,cloudLight:mat._vectors3.skyCloudLight.asArray(),
            skyReady:s.getMeshByName('coastal-sky').isReady(true),seaReady:s.getMeshByName('coastal-sea').isReady(true),
            resources:[s.meshes.length,s.materials.length,s.textures.length,s.lights.length,s.cameras.length],
            webgl:e.webGLVersion,derivatives:e.getCaps().standardDerivatives};});
          near(value.hour,hour);near(value.stars,at(hour).sky.starVisibility);assert.deepEqual(value.cloudLight,[...at(hour).sky.cloudLight]);
          assert.ok(value.skyReady&&value.seaReady&&value.derivatives);assert.deepEqual(value.resources,initial);nodes.push(value);
        }
        await page.locator('#time-close').scrollIntoViewIfNeeded();await page.locator('#time-close').tap();
        await page.evaluate(()=>{const c=s.activeCamera,V=c.position.constructor;const p=new V(13,5,173),d=new V(.36,.72,.59).normalize();
          c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
          c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;c.setTarget(p.add(d.scale(100)));c.setPosition(p);c.getViewMatrix(true);
          e.getDeltaTime=()=>0;self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
        await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`${kind}-${name}-dpr${dpr}-night.png`)});
        await page.evaluate(()=>{e.stopRenderLoop(self.shotRender);e.getDeltaTime=()=>50;});
        assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
        record.cases.push({kind,version:browser.version(),dpr,viewport:{width,height},name,nodes,errors:[...errors],warnings:[...warnings],failed:[...failed],passed:true});
      }
      await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length),0);await context.close();
    }}finally{await browser.close();}
  }record.passed=true;}finally{fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(record,null,2)+'\n');}
  console.log(JSON.stringify({passed:record.passed,cases:record.cases.length,nodeChecks:record.cases.reduce((n,c)=>n+c.nodes.length,0)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
