const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const out=path.join(__dirname,'engines');fs.mkdirSync(out,{recursive:true});
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
(async()=>{
  const record={baseline:'5569564 + day-night phase3',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,cases:[]};
  try{for(const kind of ['chromium','webkit']){
    const browser=await pw[kind].launch(kind==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true,executablePath:process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE});
    try{for(const dpr of [1,2]){
      const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],warnings=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
      await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8195/');
      await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
      await page.evaluate(()=>{
        webpackChunkbabylon_learning.push([[987643],{},r=>self.req=r]);
        for(const[id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;}
        e.stopRenderLoop();e.getDeltaTime=()=>50;
      });
      const frames=n=>page.evaluate(n=>{for(let i=0;i<n;i++)s.render();},n);
      const shot=async name=>{
        await page.evaluate(()=>{e.getDeltaTime=()=>0;self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
        await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:86});
        await page.evaluate(()=>{e.stopRenderLoop(self.shotRender);e.getDeltaTime=()=>50;});
      };
      await page.locator('[data-view="balcony"]').click();
      for(const [width,height,name]of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
        await page.setViewportSize({width,height});await frames(2);
        const prefix=`${kind}-${name}-dpr${dpr}`;
        const collapsed={time:await page.locator('#time-toggle').boundingBox(),views:await page.locator('.view-controls').boundingBox(),map:await page.locator('#floor-plan-toggle').boundingBox()};
        assert.ok(!intersects(collapsed.time,collapsed.views)&&!intersects(collapsed.time,collapsed.map));
        assert.ok(collapsed.time.x>=0&&collapsed.time.x+collapsed.time.width<=width&&collapsed.time.y+collapsed.time.height<=height);
        await shot(prefix+'-collapsed');
        if(name==='desktop')await page.keyboard.press('t');else await page.locator('#time-toggle').tap();
        assert.equal(await page.locator('#time-toggle').getAttribute('aria-expanded'),'true');
        const panel=await page.locator('#time-menu').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height);
        assert.ok(panel.height<=height*.6+1);assert.ok(!intersects(panel,await page.locator('#time-toggle').boundingBox()));
        const heights=await page.locator('[data-time-hour]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44));
        const alternatives=await page.evaluate(()=>({views:getComputedStyle(document.querySelector('.view-controls')).visibility,map:getComputedStyle(document.querySelector('#floor-plan-toggle')).visibility}));
        if(name!=='desktop')assert.deepEqual(alternatives,{views:'hidden',map:'hidden'});
        await page.locator('[data-time-hour="0"]').tap();await frames(26);assert.equal(await page.evaluate(()=>s.metadata.timeOfDay.state.hour),0);
        await page.locator('#time-close').scrollIntoViewIfNeeded();await shot(prefix+'-expanded');
        await page.locator('#time-automatic').check();await frames(12);assert.equal(await page.evaluate(()=>s.metadata.timeOfDay.state.hour),0);
        await page.locator('#time-close').tap();await frames(12);assert.ok(await page.evaluate(()=>s.metadata.timeOfDay.state.hour>0));
        await page.locator('#time-toggle').tap();await page.locator('[data-time-hour="12"]').tap();await frames(26);
        assert.equal(await page.evaluate(()=>s.metadata.timeOfDay.state.hour),12);assert.equal(await page.evaluate(()=>s.metadata.timeOfDay.playback.automatic),false);
        await page.locator('#time-close').tap();assert.equal(await page.locator('#time-toggle').getAttribute('aria-expanded'),'false');
        const resources=await page.evaluate(()=>({textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,scaling:e.getHardwareScalingLevel()}));
        assert.deepEqual(resources,{textures:148,lights:17,cameras:3,scaling:1});
        assert.deepEqual(errors,[]);record.cases.push({kind,version:browser.version(),dpr,name,collapsed,panel,heights,alternatives,resources,touch:true,errors:[...errors],warnings:[...warnings]});
      }
      await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length),0);await context.close();
    }}finally{await browser.close();}
  }record.passed=true;}finally{fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(record,null,2)+'\n');}
  console.log(JSON.stringify({passed:record.passed,cases:record.cases.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
