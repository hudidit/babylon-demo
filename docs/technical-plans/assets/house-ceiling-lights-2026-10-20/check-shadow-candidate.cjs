// Visual candidate probe on unmodified dist; only ceiling shadow uniforms vary in memory.
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const output=process.env.STUDY_CHECK_OUTPUT||'/private/tmp/ceiling-shadow-candidates';
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8210/');
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await page.context().newCDPSession(page));
    await page.evaluate(()=>{
      e.stopRenderLoop();e.getDeltaTime=()=>50;room.setView('coast');room.setTimeOfDay(0);for(let i=0;i<28;i++)s.render();
      const c=room.camera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
      c.lowerRadiusLimit=.1;c.setTarget(p(6.3,.952,1.05));c.setPosition(p(7.83,2.754,1.6));
    });
    for(const bias of [.00012,.0005,.001,.003,.005]) {
      await page.evaluate(async bias=>{
        for(const [id,l]of room.lighting.lamps)if(id.includes('ceiling')) {
          const shadow=l.light.getShadowGenerator();shadow.bias=bias;shadow.normalBias=.03;shadow.getShadowMap().resetRefreshCounter();
        }
        s.render();await new Promise(resolve=>s.executeWhenReady(resolve));self.renderCandidate=()=>s.render();e.runRenderLoop(renderCandidate);
      },bias);
      await page.waitForTimeout(200);await page.screenshot({path:path.join(output,'bias-'+bias+'.jpg')});
      await page.evaluate(()=>e.stopRenderLoop(renderCandidate));
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
