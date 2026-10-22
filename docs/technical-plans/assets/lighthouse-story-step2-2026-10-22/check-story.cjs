// Final dist only. Native UI, local pose fixtures and bounded shared-clock receipts; no fabricated work facts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),dist=path.join(root,'dist'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),{LIGHTHOUSE:a}=load('LighthouseLayout'),{COASTAL_SITE:{tower:t}}=load('CoastalSite');
const key='babylon-lighthouse-story-v1',duty='babylon-lighthouse-duty-v1',exercise='babylon-lighthouse-exercise-v2';
const record={baseline:'285963a',method:'Final dist, native controls, actual device geometry/rays and shared clock. Poses are fixtures; no full-walk or FPS claim.',cases:[],prefixes:[]};
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/home\//,'/');if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);
 if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,b)=>{if(error){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);});});
(async()=>{let browser;try{
 const raw=fs.readFileSync(path.join(dist,'release-manifest.json')),manifest=JSON.parse(raw);record.manifestSha256=sha(raw);record.release=require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(dist);
 fs.writeFileSync(path.join(__dirname,'release-manifest.json'),raw);
 record.sources=Object.fromEntries(['src/examples/Room.ts','src/examples/LighthouseStoryBridge.ts','src/examples/LighthouseStoryPanel.ts','src/examples/LighthouseStory.ts','src/examples/LighthouseStorySave.ts','src/examples/LighthouseInspection.ts','src/examples/LighthousePanel.ts','src/examples/RoomPauseState.ts','src/components/RoomTimeMenu.ts','public/index.html','tests/lighthouse-story-bridge.test.cjs'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}/`;
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of ['','home/']){for(let n=0;n<files.length;n+=8)await Promise.all(files.slice(n,n+8).map(async f=>{const response=await fetch(new URL(prefix+f.path,base));assert.equal(response.status,200,f.path);
  const b=Buffer.from(await response.arrayBuffer());assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}));record.prefixes.push({path:'/'+prefix,files:files.length,passed:true});}
 browser=await require(process.env.PLAYWRIGHT_PACKAGE||'/private/tmp/dsh-playwright/node_modules/playwright-core').chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});record.browser=browser.version();
 for(const prefix of ['','home/']){
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
  const item={path:'/'+prefix,errors:[],warnings:[],firstScreenJs:[],screens:[]};record.cases.push(item);let collecting=true;const pending=[];
  page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());if(m.type()==='warning')item.warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)item.errors.push(`${r.status()} ${r.url()}`);if(collecting&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>item.firstScreenJs.push({path:new URL(r.url()).pathname,bytes:b.length,sha256:sha(b)})));});
  const capture=async()=>{await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
   await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
   await page.evaluate(async()=>{await new Promise(r=>s.executeWhenReady(r));e.stopRenderLoop();e.getDeltaTime=()=>0;s.render();s.render();});};
  await page.goto(new URL(prefix,base).href,{timeout:120000});await capture();
  await page.evaluate(({duty,exercise})=>{localStorage.setItem(duty,'untouched-legacy-exploration');localStorage.setItem(exercise,'untouched-exercise');},{duty,exercise});
  const original=await page.evaluate(()=>({hour:room.timeOfDay.hour,power:room.lighthousePower.mainWh,random:room.weather.random,mode:room.lighthouseSessionMode}));
  await page.locator('#story-open').click();await page.locator('#story-new').click();await page.locator('#story-new-confirm').click();
  assert.equal(await page.evaluate(()=>room.lighthouseSessionMode),'story');assert.equal(await page.evaluate(()=>room.currentView),'first-person');
  assert.equal(await page.locator('#story-accept').isDisabled(),true);await page.locator('#story-letter-read').click();await page.locator('#story-accept').click();
  assert.equal(await page.evaluate(()=>room.lighthouseStory.objective.id),'ST02');
  await page.waitForLoadState('networkidle');collecting=false;await Promise.all(pending);item.firstScreenBytes=item.firstScreenJs.reduce((n,f)=>n+f.bytes,0);assert.ok(item.firstScreenBytes<=3*1048576);
  if(!prefix)for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.evaluate(async()=>{document.querySelector('#story-panel').scrollTop=0;room.engine.resize();s.render();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const box=await page.locator('#story-panel').evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:n.scrollWidth>n.clientWidth,documentOverflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(box.x>=0&&box.y>=0&&box.right<=viewport.width&&box.bottom<=viewport.height);assert.equal(box.overflow,false);assert.equal(box.documentOverflow,false);
   const name=`chapter-one-${viewport.width}.jpg`;await page.screenshot({path:path.join(__dirname,name),type:'jpeg',quality:82});item.screens.push({viewport,box,path:name});
  }
  await page.setViewportSize({width:1280,height:800});
  item.lockedTime=await page.evaluate(()=>{const before={hour:room.timeOfDay.hour,seed:room.weather.random.seed};room.setTimeOfDay(21);room.transitionTimeOfDay(0);room.setWeather('storm');const mode=room.setLighthouseSessionMode('exercise'),restart=room.restartLighthouseExercise(2);
   for(let n=0;n<20;n++)room.updateTimeOfDay(.1);return{before,after:{hour:room.timeOfDay.hour,seed:room.weather.random.seed},mode,restart};});
  assert.deepEqual(item.lockedTime.before,item.lockedTime.after);assert.equal(item.lockedTime.mode,false);assert.equal(item.lockedTime.restart,false);
  await page.locator('#story-save').click();assert.ok(await page.evaluate(key=>localStorage.getItem(key),key));
  await page.locator('#story-leave').click();assert.equal(await page.evaluate(()=>room.lighthouseSessionMode),original.mode);
  const restored=await page.evaluate(()=>({hour:room.timeOfDay.hour,power:room.lighthousePower.mainWh,random:room.weather.random,mode:room.lighthouseSessionMode}));assert.deepEqual(restored,original);item.explorationRestored=true;
  await page.locator('#story-resume').click();assert.equal(await page.evaluate(()=>room.timePlayback.automatic),false);
  await page.locator('#story-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await page.keyboard.press('KeyT');assert.equal(await page.locator('[data-time-hour="21"]').isDisabled(),true);assert.equal(await page.locator('#weather-mode').isDisabled(),true);
  await page.locator('#time-automatic').check();await page.locator('#time-close').click();await page.locator('#gameCanvas').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  const draw=async()=>{await page.evaluate(()=>{s.render();e.runRenderLoop(self.checkRender=()=>s.render());});await page.waitForTimeout(140);};
  const stop=()=>page.evaluate(()=>e.stopRenderLoop(checkRender));
  const pose=async location=>page.evaluate(({location,a,t})=>{const floor=['cover','test','optic'].includes(location)?a.gallery:a.floor,c=room.firstPersonCamera,d=room.exterior.lighthouseDetails,p=location==='log'?{x:.08,y:1.6}:floor===a.floor?{x:a.furniture[0].x+.5,y:-.8}:{x:.25,y:-1.1};
   c.position.set((t.x+p.x-5.4)*5,-5+(floor+1.6)*5,(t.y+p.y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
   Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.ladder.attached=false;room.scooter.riding=false;room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};
   const target=location==='optic'?d.beacon.root.position:(location==='cover'?d.cover.device:location==='test'?d.test:location==='log'?d.log:d.panel).meshes[0].getBoundingInfo().boundingBox.centerWorld;
   c.setTarget(target);c.getViewMatrix(true);room.updateControls();room.updateInteractionHint();},{location,a,t});
  const local=async location=>{await pose(location);await draw();await stop();await page.mouse.down();await page.mouse.up();assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),location,`local ${location}`);};
  if(!prefix){
   await draw();await stop();await page.mouse.down();await page.mouse.up();assert.equal(await page.evaluate(()=>room.storyPanel.isOpen),true);item.nativeDeskLetter=true;
   await page.locator('#story-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await local('control');await page.locator('#lighthouse-confirm-control').click();await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await local('cover');await page.locator('#lighthouse-cover-check').click();await page.locator('#lighthouse-clean-start').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await page.evaluate(()=>{room.updateTimeOfDay(0);for(let n=0;n<5;n++)room.updateTimeOfDay(.1);});
   await page.keyboard.press('KeyJ');assert.equal(await page.evaluate(()=>room.lighthouseInspection.cleaning),false);assert.equal(await page.evaluate(()=>room.lighthouseInspection.dirty),true);item.interruptedCleaning=true;
   await page.locator('#story-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await local('cover');await page.locator('#lighthouse-clean-start').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await page.evaluate(()=>{room.updateTimeOfDay(0);for(let n=0;n<15;n++)room.updateTimeOfDay(.1);});assert.equal(await page.evaluate(()=>room.lighthouseInspection.dirty),false);
   assert.equal(await page.evaluate(()=>room.storyBridge.story.arrivalChecks.cover),false);
   await local('cover');await page.locator('#lighthouse-cover-check').click();await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await local('test');await page.locator('#lighthouse-test-toggle').click();await page.waitForFunction(()=>!!document.pointerLockElement);await pose('optic');
   item.observation=await page.evaluate(()=>{room.updateTimeOfDay(0);for(let n=0;n<299;n++)room.updateTimeOfDay(.1);const before={seconds:room.lighthouseInspection.observationSeconds,complete:!!room.lighthouseInspection.optic};room.updateTimeOfDay(.1);
    return{before,after:{seconds:room.lighthouseInspection.observationSeconds,turns:room.lighthouseInspection.observedTurns,output:room.lighthouseInspection.outputSeen,complete:!!room.lighthouseInspection.optic},objective:room.lighthouseStory.objective.id};});
   assert.equal(item.observation.before.complete,false);assert.equal(item.observation.after.complete,true);assert.equal(item.observation.objective,'ST03');
   await local('log');await page.locator('#lighthouse-story-record').click();assert.equal(await page.locator('#story-report').isDisabled(),false);item.nativeTowerRecords=true;
   await page.locator('#story-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await pose('optic');
   await page.keyboard.press('KeyJ');assert.equal(await page.locator('#story-report').isDisabled(),true);await page.locator('#story-save').click();
   await page.locator('#story-load').click();item.deskResume=await page.evaluate(()=>({eye:room.firstPersonCamera.position.asArray(),checks:room.storyBridge.story.arrivalChecks,canUse:room.canUseStoryRecords(),canSubmit:room.storyBridge.story.canSubmitArrival,clear:room.walkPoseIsValid(room.walkPose)}));
   assert.equal(await page.evaluate(()=>room.timePlayback.automatic),false);assert.equal(await page.locator('#story-report').isDisabled(),false,JSON.stringify(item.deskResume));assert.equal(item.deskResume.clear,true);
   await page.locator('#story-report').click();assert.equal(await page.locator('#story-reply').isVisible(),true);await page.locator('#story-save').click();
   const pendingRaw=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(JSON.parse(pendingRaw).story.messages.filter(m=>m.id==='arrival-report').length,1);
   await page.reload({timeout:120000});await capture();await page.locator('#story-open').click();await page.locator('#story-load').click();
   assert.equal(await page.evaluate(()=>room.lighthouseStory.objective.id),'ST03');await page.locator('#story-reply').click();await page.locator('#story-save').click();
   await page.locator('#story-load').click();assert.equal(await page.evaluate(()=>room.lighthouseStory.messages.find(m=>m.id==='arrival-ack').state),'unread');
   await page.locator('[data-story-read="arrival-ack"]').click();assert.equal(await page.evaluate(()=>room.lighthouseStory.tasks[2].status),'complete');
   await page.locator('#story-save').click();item.firstChapterComplete=true;
   await page.locator('#story-goal').scrollIntoViewIfNeeded();await page.evaluate(()=>s.render());await page.screenshot({path:path.join(__dirname,'chapter-complete.jpg'),type:'jpeg',quality:82});
   item.failureProtection=await page.evaluate(key=>{self.originalSet=Storage.prototype.setItem;self.savedStory=localStorage.getItem(key);Storage.prototype.setItem=function(k,v){if(k===key)throw Error('acceptance quota');return originalSet.call(this,k,v);};return true;},key);
   await page.locator('#story-leave').click();assert.equal(await page.evaluate(()=>room.lighthouseSessionMode),'story');assert.match(await page.locator('#story-notice').innerText(),/保存失败/);
   await page.evaluate(key=>{Storage.prototype.setItem=originalSet;assertSame=localStorage.getItem(key)===savedStory;},key);assert.equal(await page.evaluate(()=>assertSame),true);
   await page.evaluate(key=>localStorage.setItem(key,'future-story-checkpoint'),key);await page.locator('#story-load').click();assert.equal(await page.evaluate(()=>room.lighthouseStory.tasks[2].status),'complete');
   await page.locator('#story-save').click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'future-story-checkpoint');
   await page.locator('#story-clear').click();await page.locator('#story-save').click();assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).story.completions.length,key),3);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>room.currentView),'first-person');assert.equal(await page.evaluate(()=>room.storyPanel.isOpen),false);
   await page.keyboard.press('KeyJ');await page.locator('#story-leave').click();item.saveFailuresPreserveSession=true;
  } else {
   await page.keyboard.press('KeyJ');await page.locator('#story-save').click();await page.reload({timeout:120000});await capture();await page.locator('#story-open').click();await page.locator('#story-load').click();
   assert.equal(await page.evaluate(()=>room.lighthouseStory.objective.id),'ST02');assert.equal(await page.evaluate(()=>room.timePlayback.automatic),false);item.subpathResume=true;
  }
  const slots=await page.evaluate(({duty,exercise})=>[localStorage.getItem(duty),localStorage.getItem(exercise)],{duty,exercise});assert.deepEqual(slots,['untouched-legacy-exploration','untouched-exercise']);item.otherSlotsUnchanged=true;
  await page.evaluate(()=>room.dispose());item.disposed=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));assert.ok(Object.values(item.disposed).every(n=>n===0));
  assert.deepEqual(item.errors,[]);assert.deepEqual(item.warnings,[]);item.passed=true;await context.close();
 }
 record.passed=true;
 }catch(error){record.failure=String(error.stack||error);throw error;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(__dirname,'story-browser.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({passed:record.passed,release:record.release,prefixes:record.prefixes,cases:record.cases.map(c=>({path:c.path,js:c.firstScreenBytes,passed:c.passed}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
