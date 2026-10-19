// Existing production objects only. Reference frames/poses are visual tests, never performance samples.
const fs=require('node:fs'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
exports.out=path.resolve(process.env.STUDY_CHECK_OUTPUT||__dirname);
exports.start=async({kind='chromium',dpr=1,viewport={width:1280,height:800},roomAccess=false}={})=>{
  const browser=await pw[kind].launch({executablePath:kind==='chromium'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,headless:true});
  const context=await browser.newContext({viewport,deviceScaleFactor:dpr,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
  const errors=[],warnings=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
  let cdp;if(kind==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});}
  await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8200/');
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  if(roomAccess)await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  else await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;
    // The application normally keeps a CSS-sized framebuffer. Exercise genuine DPR-sized buffers too.
    e.setHardwareScalingLevel(1/devicePixelRatio);e.resize();
    const sea=s.getMaterialByName('coastal-ocean');sea.onBindObservable.add(()=>sea.getEffect()?.setFloat('oceanTime',0));});
  const render=()=>page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(()=>resolve()));s.render();});
  await render();
  const initialJs=requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));
  const select=async hour=>{
    await page.locator('#time-toggle').click();await page.locator(`[data-time-hour="${hour}"]`).click();
    await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<26;i++)s.onBeforeRenderObservable.notifyObservers(s);e.getDeltaTime=()=>0;s.render();});
    await page.locator('#time-close').scrollIntoViewIfNeeded();await page.locator('#time-close').click();await render();
  };
  const shot=async(name,png=false)=>{
    await render();await page.evaluate(()=>{self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});
    await page.waitForTimeout(120);await page.screenshot({path:path.join(exports.out,name+(png?'.png':'.jpg')),type:png?'png':'jpeg',...(png?{}:{quality:88})});
    await page.evaluate(()=>e.stopRenderLoop(self.shotRender));
  };
  const skyPose=async(azimuth=40,elevation=55,fov=.8)=>{
    await page.evaluate(({azimuth,elevation,fov})=>{
      const c=s.activeCamera,V=c.position.constructor,a=azimuth*Math.PI/180,h=elevation*Math.PI/180;
      const p=new V(13,5,173),d=new V(Math.cos(h)*Math.sin(a),Math.sin(h),-Math.cos(h)*Math.cos(a));
      c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;
      c.fov=fov;c.setTarget(p.add(d.scale(100)));c.setPosition(p);c.getViewMatrix(true);c.getProjectionMatrix(true);
    },{azimuth,elevation,fov});await render();
  };
  const pose=async(x,y,h,tx,ty,th)=>{
    await page.evaluate(({x,y,h,tx,ty,th})=>{const c=s.activeCamera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
      c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=0;c.fov=.8;c.setTarget(p(tx,ty,th));c.setPosition(p(x,y,h));c.getViewMatrix(true);c.getProjectionMatrix(true);
    },{x,y,h,tx,ty,th});await render();
  };
  const save=(name,result)=>fs.writeFileSync(path.join(exports.out,name),JSON.stringify(result,null,2)+'\n');
  return{browser,context,page,errors,warnings,requests,initialJs,render,select,shot,skyPose,pose,save};
};
