// Deliberately missing coastal downloads must retain the house and procedural ocean.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],warnings=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  try{
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8161/');
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'));
    await page.evaluate(()=>{webpackChunkbabylon_learning.push([[989990],{},r=>self.req=r]);for(const[id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.e=v.LastCreatedEngine;e.stopRenderLoop();e.getDeltaTime=()=>50;}});
    await page.locator('[data-view="balcony"]').click();
    const state=await page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));for(let i=0;i<5;i++)s.render();
      const m=s.getMaterialByName('coastal-ocean'),before=m._floats.oceanTime;for(let i=0;i<8;i++)s.render();
      return{ready:m.getEffect().isReady(),before,after:m._floats.oceanTime,fallbacks:s.metadata.exteriorFallbacks,indoorEnvironment:s.environmentTexture.name};});
    assert.equal(state.fallbacks.length,2);assert.ok(state.ready&&state.after>state.before);assert.equal(state.indoorEnvironment,'./environment/study-interior.hdr');
    assert.equal(failed.length,2);assert.ok(failed.every(r=>/coastal\/rock-color.jpg|coastal-daylight.hdr/.test(r.url)));
    assert.ok(!errors.some(e=>/shader|compile|GLSL|uniform/i.test(e)));
    await page.screenshot({path:path.join(__dirname,'fault-balcony.jpg'),type:'jpeg',quality:90});
    fs.writeFileSync(path.join(__dirname,'fault-browser.json'),JSON.stringify({passed:true,state,errors,warnings,expected404:failed,fpsOrLoadTimeSampling:false},null,2)+'\n');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
