// Unmodified final dist. Bounded clock callbacks validate behavior; these are not FPS measurements.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),dist=path.join(root,'dist'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),{LIGHTHOUSE:a}=load('LighthouseLayout'),{COASTAL_SITE:{tower:t}}=load('CoastalSite');
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-6,`${x} != ${y}`);
const record={baseline:'93974e4',method:'Final dist only; cold Chromium DPR 1, no service workers; native controls and local pose fixtures; actual shared-clock updates, no phase/Wh/evidence overrides.',prefixes:[],cases:[]};
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/home\//,'/');if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);
 if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,b)=>{if(error){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);});});
(async()=>{let browser;try{
 const raw=fs.readFileSync(path.join(dist,'release-manifest.json')),manifest=JSON.parse(raw);record.manifestSha256=sha(raw);record.release=require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(dist);
 const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'../lighthouse-visible-beam-2026-10-22/release-manifest.json'))),runtime=m=>m.files.filter(f=>f.kind==='runtime');
 assert.deepEqual(runtime(manifest),runtime(previous));record.unchangedRuntimeAssets=runtime(manifest).length;
 record.sources=Object.fromEntries(['public/index.html','public/environment/coastal-cliff-source.json','public/STUDY_ASSET_SOURCES.md','src/components/BasicExamples.ts','src/examples/Room.ts','src/examples/LighthouseOperation.ts','src/examples/LighthouseInspection.ts',
  'src/examples/LighthouseExperience.ts','src/examples/LighthousePanel.ts','src/examples/LighthouseMaintenance.ts','tests/lighthouse-operation.test.cjs','tests/lighthouse-inspection.test.cjs',
  'tests/lighthouse-experience.test.cjs','tests/lighthouse-maintenance.test.cjs','tests/lighthouse-save.test.cjs','tests/lighthouse-story-save.test.cjs'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}/`;
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of ['','home/']){for(let n=0;n<files.length;n+=8)await Promise.all(files.slice(n,n+8).map(async f=>{const response=await fetch(new URL(prefix+f.path,base));assert.equal(response.status,200,f.path);
  const b=Buffer.from(await response.arrayBuffer());assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}));record.prefixes.push({path:'/'+prefix,files:files.length,passed:true});}
 browser=await require(process.env.PLAYWRIGHT_PACKAGE||'/private/tmp/dsh-playwright/node_modules/playwright-core').chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});record.browser=browser.version();
 for(const prefix of ['','home/']){
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),pending=[];
  const item={path:'/'+prefix,errors:[],warnings:[],firstScreenJs:[],viewports:[]};record.cases.push(item);let collecting=true;
  page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());if(m.type()==='warning')item.warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)item.errors.push(`${r.status()} ${r.url()}`);if(collecting&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>item.firstScreenJs.push({path:new URL(r.url()).pathname,bytes:b.length,sha256:sha(b)})));});
  await page.goto(new URL(prefix,base).href,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
  await page.evaluate(async()=>{await new Promise(r=>s.executeWhenReady(r));s.render();s.render();});await page.waitForLoadState('networkidle');collecting=false;await Promise.all(pending);
  item.firstScreenBytes=item.firstScreenJs.reduce((n,f)=>n+f.bytes,0);assert.ok(item.firstScreenBytes<=3*1048576);
  assert.deepEqual(await page.locator('[data-view]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.view,n.textContent,n.getAttribute('aria-pressed')])),[['coast','岛屿远景','true'],['first-person','自由探索','false']]);
  assert.equal(await page.evaluate(()=>room.currentView),'coast');assert.equal(await page.locator('#floor-plan-mini svg').count(),1);
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;});
  const draw=async()=>{await page.evaluate(async()=>{s.render();await new Promise(r=>s.executeWhenReady(r));e.runRenderLoop(self.checkRender=()=>s.render());});await page.waitForTimeout(140);};
  const stop=()=>page.evaluate(()=>e.stopRenderLoop(checkRender));
  for(const viewport of prefix?[{width:1280,height:800}]:[{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await draw();
   const layout=await page.evaluate(()=>{const V=room.camera.position.constructor,project=(x,y,h)=>{const p=V.TransformCoordinates(new V((x-5.4)*5,-5+h*5,(y-5.4)*5),s.getTransformMatrix());return{x:p.x,y:p.y,z:p.z};};
    const points={house:[[0,0,0],[10.8,0,3],[0,10.8,3],[10.8,10.8,0]],lighthouse:[[-125,90,3],[-125,90,23.2]]};
    return{landmarks:Object.fromEntries(Object.entries(points).map(([k,ps])=>[k,ps.map(p=>project(...p))])),buttons:[...document.querySelectorAll('[data-view]')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),overflow:document.documentElement.scrollWidth>innerWidth,miniCoast:room.floorPlan.miniCoast};});
   for(const ps of Object.values(layout.landmarks))for(const p of ps){assert.ok(Math.abs(p.x)<.96&&Math.abs(p.y)<.96&&p.z>0&&p.z<1,JSON.stringify(p));}
   for(const b of layout.buttons)assert.ok(b.x>=0&&b.y>=0&&b.right<=viewport.width&&b.bottom<=viewport.height);
   assert.equal(layout.overflow,false);assert.equal(layout.miniCoast,true);item.viewports.push({viewport,...layout,passed:true});
   if(!prefix)await page.screenshot({path:path.join(__dirname,`overview-${viewport.width}.jpg`),type:'jpeg',quality:88});await stop();
  }
  if(!prefix){
   await page.setViewportSize({width:1280,height:800});await draw();
   const orbit=await page.evaluate(()=>({alpha:room.camera.alpha,radius:room.camera.radius}));await page.mouse.move(620,310);await page.mouse.down();await page.mouse.move(700,340,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-160);await page.waitForTimeout(150);
   const moved=await page.evaluate(()=>({alpha:room.camera.alpha,radius:room.camera.radius}));assert.ok(Math.abs(orbit.alpha-moved.alpha)>.01);assert.ok(Math.abs(orbit.radius-moved.radius)>1);await stop();item.dragAndZoom=true;
   await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement&&room.currentView==='first-person');
   const walk=await page.evaluate(()=>room.firstPersonCamera.position.asArray());await page.keyboard.press('Escape');await page.waitForFunction(()=>room.currentView==='coast');
   await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);assert.deepEqual(await page.evaluate(()=>room.firstPersonCamera.position.asArray()),walk);await page.keyboard.press('Escape');await page.waitForFunction(()=>room.currentView==='coast');item.exploreAndEscapeReturn=true;
   await page.locator('#floor-plan-toggle').click();assert.equal(await page.locator('#map-scope-coast').getAttribute('aria-pressed'),'true');for(const scope of ['house','coast']){await page.locator('#map-scope-'+scope).click();
    for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390},{width:320,height:640}]){
     await page.setViewportSize(viewport);const value=await page.locator('#floor-plan-dialog').evaluate(n=>{const r=n.getBoundingClientRect();return {within:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:n.scrollWidth>n.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};});
     assert.equal(value.within,true);assert.equal(value.overflow,false);assert.equal(value.pageOverflow,false);(item.mapLayouts??=[]).push({scope,viewport,...value});
    }
   }await page.setViewportSize({width:1280,height:800});await page.locator('#coast-preview').click();assert.equal(await page.evaluate(()=>room.currentView),'coast');item.maps=true;
   await page.locator('#settings-btn').click();assert.equal(await page.locator('#settings-menu').isVisible(),true);await page.keyboard.press('Escape');
   await page.evaluate(()=>room.setTimeOfDay(21));await page.evaluate(()=>room.updateTimeOfDay(.1));
   item.rotation=await page.evaluate(()=>{const samples=[],before=room.lighthouseOperation.rotationTurns;for(let n=1;n<=300;n++){room.updateTimeOfDay(.1);if([75,150,300].includes(n)){
    const b=room.exterior.lighthouseDetails.beacon,o=room.exterior.ocean.material; samples.push({seconds:n/10,phase:room.lighthouseOperation.rotationTurns,radians:b.root.rotation.y,ocean:o._vectors3.shaftDirection.asArray(),volume:b.volume.material._vectors3.shaftDirection.asArray()});}}
    return{before,samples};});
   for(const sample of item.rotation.samples){near((sample.phase-item.rotation.before+1)%1,(sample.seconds/30)%1);near(sample.radians,sample.phase*Math.PI*2);assert.deepEqual(sample.ocean,sample.volume);}
   await page.locator('#time-toggle').click();const paused=await page.evaluate(()=>room.lighthouseOperation);await page.evaluate(()=>{for(let n=0;n<100;n++)room.updateTimeOfDay(.1);});assert.deepEqual(await page.evaluate(()=>room.lighthouseOperation),paused);await page.locator('#time-close').click();
   item.resume=await page.evaluate(()=>{const before=room.lighthouseOperation.rotationTurns;room.updateTimeOfDay(.1);const first=room.lighthouseOperation.rotationTurns;room.updateTimeOfDay(.1);return{before,first,second:room.lighthouseOperation.rotationTurns};});near(item.resume.before,item.resume.first);near((item.resume.second-item.resume.first+1)%1,.1/30);item.pauseAndResume=true;
   // Place a grounded observer at the existing top-floor test station. Commands still use local range, ray and panel authority.
   const pose=async location=>page.evaluate(({location,a,t})=>{const floor=location==='control'?a.floor:a.gallery,c=room.firstPersonCamera,d=room.exterior.lighthouseDetails,p=location==='control'?{x:a.furniture[0].x+.5,y:-.8}:{x:.25,y:-1.1};
    c.position.set((t.x+p.x-5.4)*5,-5+(floor+1.6)*5,(t.y+p.y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
    Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.ladder.attached=false;room.scooter.riding=false;room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};
    c.setTarget((location==='control'?d.panel:d.test).meshes[0].getBoundingInfo().boundingBox.centerWorld);c.getViewMatrix(true);room.updateControls();room.updateInteractionHint();},{location,a,t});
   await page.evaluate(()=>room.setTimeOfDay(12));await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);await pose('test');await draw();await stop();
   await page.mouse.down();await page.mouse.up();assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),true);await page.locator('#lighthouse-test-toggle').click();await page.waitForFunction(()=>!!document.pointerLockElement);near(await page.evaluate(()=>room.lighthouseOperation.testSecondsRemaining),60);
   await page.evaluate(()=>{room.firstPersonCamera.setTarget(room.exterior.lighthouseDetails.beacon.root.position);room.firstPersonCamera.getViewMatrix(true);room.updateTimeOfDay(.1);});
   item.observation=await page.evaluate(()=>{const sight=room.canObserveLighthouse({id:'lighthouse-beacon-main',meshes:room.exterior.lighthouseDetails.beacon.meshes},[room.exterior.lighthouseDetails.cover.pane]),samples=[];
    for(let n=1;n<=300;n++){room.updateTimeOfDay(.1);if([150,299,300].includes(n))samples.push({seconds:n/10,observation:room.lighthouseInspection.observationSeconds,turns:room.lighthouseInspection.observedTurns,proof:!!room.lighthouseInspection.optic,remaining:room.lighthouseOperation.testSecondsRemaining,outputSeen:room.lighthouseInspection.outputSeen});}
    return{sight,samples,result:room.lighthouseInspection.optic?.result};});
   assert.equal(item.observation.sight,true);assert.equal(item.observation.samples[0].proof,false);near(item.observation.samples[0].observation,15);assert.equal(item.observation.samples[1].proof,false);assert.equal(item.observation.samples[2].proof,true);near(item.observation.samples[2].remaining,30);assert.match(item.observation.result,/连续观察30秒/);
   await page.evaluate(()=>{for(let n=0;n<300;n++)room.updateTimeOfDay(.1);});assert.equal(await page.evaluate(()=>room.lighthouseOperation.state),'day-standby');item.testExpiresAt60=true;
   await pose('test');await draw();await stop();await page.mouse.down();await page.mouse.up();await page.locator('#lighthouse-test-toggle').click();await page.waitForFunction(()=>!!document.pointerLockElement);
   await pose('test');await draw();await stop();await page.mouse.down();await page.mouse.up();assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),'test');
   const gauges=await page.locator('#lighthouse-gauges').innerText();assert.match(gauges,/2(?:\.0)?\s*rpm/);assert.match(gauges,/每30秒一圈/);item.gauge=gauges;
   await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await pose('control');await draw();await stop();await page.mouse.down();await page.mouse.up();
   item.beforeSave=await page.evaluate(()=>({open:room.lighthousePanel.isOpen,location:room.lighthousePanel.activeLocation,locked:room.pointerLocked,browserLocked:!!document.pointerLockElement,view:room.currentView,pauses:room.pauseReasons,eye:room.firstPersonCamera.position.asArray(),floor:room.jump.feet,reachable:room.canAccessLighthouse('control'),pick:room.interactions.pick(room.firstPersonCamera.getForwardRay(7.5))?.id}));assert.equal(item.beforeSave.open,true,JSON.stringify(item.beforeSave));
   await page.locator('#lighthouse-save-toggle').click();await page.locator('#lighthouse-save').click();assert.ok(await page.evaluate(()=>localStorage.getItem('babylon-lighthouse-duty-v1')));await page.locator('#lighthouse-continue').click();item.saveAndContinue=true;await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.keyboard.press('Escape');await page.waitForFunction(()=>room.currentView==='coast');
   await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible()&&!document.querySelector('#inspect-btn').disabled,null,{timeout:60000});await draw();
   await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!s.debugLayer.isVisible());await stop();item.inspector=true;
  }
  await page.evaluate(()=>room.dispose());item.disposed=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));assert.ok(Object.values(item.disposed).every(n=>n===0));
  assert.deepEqual(item.errors,[]);item.knownInspectorWarnings=item.warnings.filter(w=>w.startsWith("The keyword 'slider-vertical' specified to an 'appearance' property is not standardized."));
  assert.deepEqual(item.warnings.filter(w=>!item.knownInspectorWarnings.includes(w)),[]);assert.ok(item.knownInspectorWarnings.length<=1);item.passed=true;await context.close();
 }
 record.passed=true;
 }catch(error){record.failure=String(error.stack||error);throw error;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(__dirname,'regression.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({passed:record.passed,release:record.release,prefixes:record.prefixes,cases:record.cases.map(c=>({path:c.path,js:c.firstScreenBytes,passed:c.passed}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
