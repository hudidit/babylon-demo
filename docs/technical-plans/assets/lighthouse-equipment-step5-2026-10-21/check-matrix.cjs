// Actual GPU component comparisons, with original production materials and geometry.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {COASTAL_SITE:{tower:t}}=load('CoastalSite'),{LIGHTHOUSE:a}=load('LighthouseLayout'),layout=load('LighthouseEquipmentLayout');
const {planToWorld}=load('HouseLayout'),out=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'matrix'));
const backup=layout.LIGHTHOUSE_BACKUP_MOUNT,room=layout.LIGHTHOUSE_SERVICE_ROOM;
const point=(x,y,h)=>planToWorld({x:t.x+x,y:t.y+y},h);
const poses=[{name:'charger',id:'lighthouse-solar-charger',eye:point(2.35,-1,a.floor+1.6),target:point(2.35,-.242,a.floor+1.64)},
 {name:'drive-hatch',id:'lighthouse-drive-hatch',eye:point(.3,-.95,a.gallery+1.6),target:point(.15,-.322,a.gallery+.72)},
 {name:'sensor',id:'lighthouse-light-sensor',eye:point(2.7,-.5,a.gallery+1.6),target:point(layout.LIGHTHOUSE_SENSOR.x,-.5,a.gallery+1.52)},
 {name:'battery',id:'lighthouse-battery-main',eye:point(2.35,-1,a.floor+1.6),target:point(2.35,-.218,a.floor+1.16)},
 {name:'solar',id:'lighthouse-solar-array',eye:point(4.8,8.1,3.04+1.6),target:point(4.8,5.8,3.04+1.12)},
 {name:'room',id:'lighthouse-generator-room',eye:point(room.x,room.y-3,room.floor+1.6),target:point(room.x-.67,room.y-room.depth/2,room.floor+1.05)},
 {name:'generator',id:'lighthouse-generator',eye:point(room.x,room.y-.55,room.floor+1.6),target:point(room.x,room.y+.65,room.floor+.68)},
 {name:'backup-gallery',id:'lighthouse-beacon-backup',eye:point(2.8,-.45,a.gallery+1.6),target:point(backup.x-.09,-.06,backup.lensBottom+backup.lensHeight*.86)},
];
const record={baseline:'9ebc1ce',releaseManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))).digest('hex'),
 fpsOrLoadTimeSampling:false,physicalDevicesTested:false,method:'Unmodified final dist, Chrome/WebKit GPU. Original camera fixtures; equipment hidden/restored only for visible-geometry pixel comparisons. Backup lens view uses an allowed gallery standing position.',cases:[],errors:[],warnings:[]};
(async()=>{fs.mkdirSync(out,{recursive:true});try{
 for(const kind of ['chromium','webkit']){
  const executablePath=kind==='chromium'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE;
  const browser=await pw[kind].launch({headless:true,...(executablePath?{executablePath}:{}),...(kind==='webkit'&&executablePath&&!executablePath.endsWith('.sh')?{env:{...process.env,DYLD_FRAMEWORK_PATH:path.resolve(path.dirname(executablePath),'../../..'),DYLD_LIBRARY_PATH:path.resolve(path.dirname(executablePath),'../../..')}}:{})});
  try{for(const dpr of [1,2]){
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,serviceWorkers:'block'}),page=await context.newPage();
   page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)record.errors.push(r.status()+' '+r.url());});
   await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8245/',{timeout:120000});
   await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
   await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);await page.locator('[data-view="balcony"]').click();
   await page.evaluate(()=>{e.getDeltaTime=()=>0;});
   for(const [width,height,viewport]of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
    await page.setViewportSize({width,height});
    for(const pose of poses){
     await page.evaluate(pose=>{
      e.setHardwareScalingLevel(1/devicePixelRatio);e.resize();const c=s.activeCamera,V=c.position.constructor;
      c.minZ=.1;c.lowerRadiusLimit=.1;c.upperRadiusLimit=10000;c.lowerBetaLimit=.001;c.upperBetaLimit=Math.PI-.001;
      c.inertialAlphaOffset=c.inertialBetaOffset=c.inertialRadiusOffset=c.inertialPanningX=c.inertialPanningY=0;
      c.setTarget(new V(pose.target.x,pose.target.y,pose.target.z));c.setPosition(new V(pose.eye.x,pose.eye.y,pose.eye.z));c.getViewMatrix(true);c.getProjectionMatrix(true);
     },pose);
     const frame=async hidden=>page.evaluate(async({hidden,id})=>{
      const meshes=s.meshes.filter(m=>m.metadata?.equipmentId===id);meshes.forEach(m=>m.isVisible=!hidden);
      s.render();await new Promise(resolve=>s.executeWhenReady(resolve));s.render();s.render();
      const gl=e._gl,n=128*devicePixelRatio,w=e.getRenderWidth(),h=e.getRenderHeight(),pixels=new Uint8Array(n*n*4);
      gl.readPixels(Math.floor((w-n)/2),Math.floor((h-n)/2),n,n,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let luma=0,difference=0;for(let i=0;i<pixels.length;i+=4){luma+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;if(!hidden)difference+=(Math.abs(pixels[i]-self.beforePixels[i])+Math.abs(pixels[i+1]-self.beforePixels[i+1])+Math.abs(pixels[i+2]-self.beforePixels[i+2]))/3;}
      if(hidden)self.beforePixels=pixels;
      return{luma:luma/(n*n),difference:difference/(n*n),ready:meshes.every(m=>m.material.isReady(m)),renderSize:[w,h]};
     },{hidden,id:pose.id});
     const off=await frame(true),on=await frame(false),entry={kind,version:browser.version(),dpr,viewport,pose:pose.name,off,on};record.cases.push(entry);
     assert.ok(on.ready);assert.ok(on.difference>.1,JSON.stringify(entry));
     if(dpr===1&&viewport==='desktop'||dpr===2&&viewport==='portrait'){
      await page.evaluate(()=>e.runRenderLoop(self.matrixShot=()=>s.render()));await page.waitForTimeout(100);
      await page.screenshot({path:path.join(out,`${kind}-${viewport}-${pose.name}-dpr${dpr}.jpg`),type:'jpeg',quality:86});await page.evaluate(()=>e.stopRenderLoop(matrixShot));
     }
    }
   }
   if(dpr===1){
    await page.setViewportSize({width:1280,height:800});
    await page.evaluate(({eye,target})=>{const c=s.activeCamera,V=c.position.constructor;e.setHardwareScalingLevel(1);e.resize();
      c.setTarget(new V(target.x,target.y,target.z));c.setPosition(new V(eye.x,eye.y,eye.z));c.getViewMatrix(true);c.getProjectionMatrix(true);
      e.runRenderLoop(self.siteShot=()=>s.render());},{eye:point(0,26,t.ground+13),target:point(0,2,t.ground+9.5)});
    await page.waitForTimeout(120);await page.screenshot({path:path.join(out,`${kind}-site-overview.jpg`),type:'jpeg',quality:88});await page.evaluate(()=>e.stopRenderLoop(siteShot));
   }
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length+s.materials.length+s.transformNodes.length+s.lights.length),0);await context.close();
  }}finally{await browser.close();}
 }
 assert.deepEqual(record.errors,[]);record.passed=true;
 }finally{fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({passed:record.passed,cases:record.cases.length,minDifference:Math.min(...record.cases.map(c=>c.on.difference))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
