// Settled per-view draw/object snapshots, never a frame-rate, GPU-time or memory benchmark.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const record={sourceCommit:'d1ae3a1',browser:browser.version(),fpsOrLoadTimeSampling:false,gpuMemoryMeasured:false,views:[]};
  try{
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8160/');
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'));
    await page.evaluate(()=>{webpackChunkbabylon_learning.push([[989993],{},r=>self.req=r]);
      for(const[id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;e.stopRenderLoop();e.getDeltaTime=()=>50;}});
    for(const id of ['overview','living','bedroom','balcony','first-person']){
      await page.locator(`[data-view="${id}"]`).click();
      await page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=0;i<6;i++)s.render();});
      const state=await page.evaluate(()=>{e._drawCalls.fetchNewFrame();s.render();return{
        drawCallsIncludingMirrorShadowAndPostprocessPasses:e._drawCalls.current,activeMeshCount:s.getActiveMeshes().length,
        meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,
        exterior:s.meshes.filter(m=>m.metadata?.exterior).map(m=>({name:m.name,vertices:m.getTotalVertices(),visible:m.isVisible,active:s.getActiveMeshes().data.includes(m)})),
        renderTargets:s.textures.filter(t=>t.isRenderTarget).map(t=>({name:t.name,size:t.getSize()})),
        shoreField:s.getMaterialByName('coastal-ocean').getActiveTextures().map(t=>({name:t.name,size:t.getSize(),gamma:t.gammaSpace})),
        pointerLocked:!!document.pointerLockElement};});
      assert.ok(state.drawCallsIncludingMirrorShadowAndPostprocessPasses>0);record.views.push({id,...state});
    }
    fs.writeFileSync(path.join(__dirname,'draw-resource-snapshots.json'),JSON.stringify(record,null,2)+'\n');
    console.log(JSON.stringify(record.views.map(v=>({id:v.id,draws:v.drawCallsIncludingMirrorShadowAndPostprocessPasses,activeMeshes:v.activeMeshCount}))));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
