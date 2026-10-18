const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),output=path.join(__dirname,'engines');
const {walkingSurfaceAt}=require('./source-loader.cjs')('WalkingSurface');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const record={baseline:'8110fe7 + lighthouse B',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,cases:[]};
 try{
  for(const kind of ['chromium','webkit']){
   const browser=await pw[kind].launch(kind==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
   try{for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,serviceWorkers:'block'}),page=await context.newPage(),errors=[],warnings=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8171/',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await page.evaluate(()=>{webpackChunkbabylon_learning.push([[987625],{},r=>self.req=r]);for(const[id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;e.stopRenderLoop();e.getDeltaTime=()=>50;}});
    const render=()=>page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=0;i<6;i++)s.render();});
    for(const[width,height,name]of[[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
     await page.setViewportSize({width,height});await page.keyboard.press('m');await page.locator('#map-scope-coast').click();
     assert.equal(await page.locator('#floor-plan-drawing [role="img"]').count(),1);
     await page.locator('#coast-preview').click();await render();
     const state=await page.evaluate(()=>{
      const c=s.activeCamera,V=c.position.constructor,M=c.getViewMatrix().constructor;
      const project=(h)=>V.Project(new V((-125-5.4)*5,-5+h*5,(90-5.4)*5),M.Identity(),s.getTransformMatrix(),c.viewport.toGlobal(innerWidth,innerHeight)).asArray();
      const rect=document.querySelector('#floor-plan-toggle').getBoundingClientRect();
      return{size:[innerWidth,innerHeight],dpr:devicePixelRatio,renderSize:[e.getRenderWidth(),e.getRenderHeight()],scaling:e.getHardwareScalingLevel(),
       towerTop:project(23.04),towerBase:project(3.04),mapRect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},
       eye:c.position.asArray(),roof:s.getMeshByName('coastal-house-roof-graybox').isVisible,waterReady:s.getMaterialByName('coastal-ocean').getEffect()?.isReady(),
       shoreSize:s.getMaterialByName('coastal-ocean').getActiveTextures()[0].getSize(),time:s.getMaterialByName('coastal-ocean')._floats.oceanTime};
     });
     assert.equal(state.scaling,1);assert.ok(state.roof&&state.waterReady);assert.equal(state.shoreSize.width,512);
     for(const point of[state.towerTop,state.towerBase]){
      assert.ok(point[0]>20&&point[0]<width-20&&point[1]>30&&point[1]<height-75,'tower stays in the overview frame');
      assert.ok(!(point[0]>state.mapRect.left&&point[0]<state.mapRect.right&&point[1]>state.mapRect.top&&point[1]<state.mapRect.bottom),'minimap must not cover the destination');
     }
     await page.screenshot({path:path.join(output,`${kind}-coast-${name}-dpr${dpr}.jpg`),type:'jpeg',quality:85});
     await render();state.nextTime=await page.evaluate(()=>s.getMaterialByName('coastal-ocean')._floats.oceanTime);assert.ok(state.nextTime>state.time);
     await page.keyboard.press('m');await page.locator('#map-scope-coast').click();await page.locator('#coast-return-home').click();await render();await page.waitForTimeout(80);
     const before=await page.evaluate(()=>{const c=s.activeCamera;return {position:c.position.asArray(),locked:!!document.pointerLockElement,map:document.querySelector('#floor-plan-location').textContent,mini:document.querySelector('#map-mini-title').textContent};});
     assert.ok(Math.abs(before.position[0]/5+5.4-12.2)<.01);assert.equal(before.mini,'海岸地图');
     if(before.locked){await page.keyboard.down('w');await render();await page.keyboard.up('w');await render();}
     const after=await page.evaluate(()=>{const c=s.activeCamera;return{position:c.position.asArray(),map:document.querySelector('#floor-plan-location').textContent,marker:document.querySelector('#floor-plan-mini .plan-position').getAttribute('transform')};});
     const ground=walkingSurfaceAt(after.position[0]/5+5.4,after.position[2]/5+5.4);assert.ok(ground);assert.ok(Math.abs((after.position[1]+5)/5-1.6-ground.height)<.03);
     if(before.locked)assert.ok(Math.hypot(after.position[0]-before.position[0],after.position[2]-before.position[2])>.1);
     await page.keyboard.press('m');const held=await page.evaluate(()=>s.activeCamera.position.asArray());await page.keyboard.down('w');await render();await page.keyboard.up('w');assert.deepEqual(await page.evaluate(()=>s.activeCamera.position.asArray()),held);
     await page.locator('#floor-plan-return').click();await render();await page.screenshot({path:path.join(output,`${kind}-walking-${name}-dpr${dpr}.jpg`),type:'jpeg',quality:85});
     state.walking={before,after,ground,modalPaused:true,keyboardVerified:before.locked};
     record.cases.push({kind,version:browser.version(),dpr,name,...state});
    }
    await page.evaluate(()=>document.exitPointerLock?.());await page.waitForFunction(()=>!document.pointerLockElement);
    await page.locator('[data-view="overview"]').click();await render();const time=await page.evaluate(()=>s.getMaterialByName('coastal-ocean')._floats.oceanTime);
    await render();assert.equal(await page.evaluate(()=>s.getMaterialByName('coastal-ocean')._floats.oceanTime),time);
    assert.equal(await page.evaluate(()=>s.getMeshByName('coastal-house-roof-graybox').isVisible),false);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pagehide'));});
    assert.equal(await page.evaluate(()=>s.meshes.length),0);assert.deepEqual(errors,[]);
    record.cases.filter(c=>c.kind===kind&&c.dpr===dpr).forEach(c=>{c.errors=errors;c.warnings=warnings;c.disposalPassed=true;});
    await context.close();
   }}finally{await browser.close();}
  }
 }finally{fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({cases:record.cases.length,engines:[...new Set(record.cases.map(c=>c.kind))]}));
})().catch(e=>{console.error(e);process.exitCode=1;});
