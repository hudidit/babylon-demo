// Production-only visual/functional checks. No FPS or load-time sampling.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),dist=path.resolve(process.env.LANDSCAPE_DIST||path.join(root,'dist'));
const baseline=!!process.env.LANDSCAPE_BASELINE,out=path.join(__dirname,baseline?'before':'after');fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),{walkingSurfaceAt}=load('WalkingSurface'),{LIGHTHOUSE}=load('LighthouseLayout');
const record={baseline:'b9194a0',method:'Unmodified production dist, Chrome DPR1 cold cache, fixed cameras and manual renders; screenshots and structural counters only, no FPS/load-time measurements.',errors:[],warnings:[],firstScreenJs:[],views:[]};
const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname.replace(/^\/home\//,'/');if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);
 if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':data.length});res.end(data);});});
(async()=>{let browser;try{
 record.release=require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(dist);
 const raw=fs.readFileSync(path.join(dist,'release-manifest.json')),manifest=JSON.parse(raw);record.manifestSha256=sha(raw);
 fs.copyFileSync(path.join(dist,'release-manifest.json'),path.join(out,'release-manifest.json'));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}/`;
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of ['', 'home/'])for(let n=0;n<files.length;n+=12)await Promise.all(files.slice(n,n+12).map(async f=>{const r=await fetch(base+prefix+f.path);assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}));
 record.hosted={prefixes:['/','/home/'],filesPerPrefix:files.length};
 browser=await require(process.env.PLAYWRIGHT_PACKAGE||'/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core').chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 record.browser=browser.version();const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
 let collecting=true;const pending=[];page.on('response',r=>{if(r.status()>=400)record.errors.push(`${r.status()} ${r.url()}`);if(collecting&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>record.firstScreenJs.push({path:new URL(r.url()).pathname,bytes:b.length,sha256:sha(b)})));});
 await page.goto(base,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
 await page.waitForLoadState('networkidle');collecting=false;await Promise.all(pending);
 record.firstScreenBytes=record.firstScreenJs.reduce((n,f)=>n+f.bytes,0);assert.ok(record.firstScreenBytes<=3*1048576);
 await page.evaluate(()=>{e.stopRenderLoop();room.setTimeAutomatic(false);room.setTimeOfDay(15);
  // Fixed-pose visual fixtures must not be moved by the walker collision/gravity observer.
  self.originalCameraInputs=room.firstPersonCamera._checkInputs;room.firstPersonCamera._checkInputs=()=>{};});
 const draw=async()=>{await page.evaluate(async()=>{e.resize();s.render();await new Promise(resolve=>s.executeWhenReady(resolve));s.render();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.waitForTimeout(120);};
 const cameras=[{id:'overview',view:'coast'},{id:'balcony',view:'balcony'},
  {id:'entry',point:[13,-3],target:[4,-29,4]}, {id:'path',point:[-51,8],target:[-125,90,13]},
  {id:'lookout',point:[-70,25],target:[5.4,5.4,2]}, {id:'gallery',point:[-125,87],floor:LIGHTHOUSE.gallery,target:[-30,-20,3]},
  {id:'meadow',point:[-55,8],target:[-62,-12,1]},
  {id:'tower-grove',point:[-116,63],target:[-129,28,3]},
  {id:'cape',point:[-4,12.9],target:[-8,31,1]}];
 const pose=async camera=>{await page.evaluate(({camera,floor})=>{
  room.setView(camera.view||'first-person');if(!camera.point)return;
  const c=room.firstPersonCamera,p=camera.point;c.position.set((p[0]-5.4)*5,-5+(floor+1.6)*5,(p[1]-5.4)*5);
  c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
  Object.assign(room.jump,{feet:floor,grounded:true,velocity:0,queued:false,originTop:floor});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:floor};
  const target=c.position.clone().set((camera.target[0]-5.4)*5,-5+camera.target[2]*5,(camera.target[1]-5.4)*5);c.setTarget(target);c.getViewMatrix(true);
 },{camera,floor:camera.floor??(camera.point?walkingSurfaceAt(...camera.point)?.height:0)});await draw();};
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>room.resize());
  for(const camera of cameras){await pose(camera);const actual=await page.evaluate(()=>({position:s.activeCamera.position.asArray(),target:s.activeCamera.getTarget().asArray()}));
   if(camera.point){assert.ok(Math.abs(actual.position[0]/5+5.4-camera.point[0])<1e-5);assert.ok(Math.abs(actual.position[2]/5+5.4-camera.point[1])<1e-5);}
   let landmarks;
   if(camera.id==='overview'){
    landmarks=await page.evaluate(()=>{const V=room.camera.position.constructor;return [[0,0,0],[10.8,0,3],[0,10.8,3],[10.8,10.8,0],[-125,90,3],[-125,90,23.2]].map(([x,y,h])=>{const p=V.TransformCoordinates(new V((x-5.4)*5,-5+h*5,(y-5.4)*5),s.getTransformMatrix());return{x:p.x,y:p.y,z:p.z};});});
    for(const p of landmarks)assert.ok(Math.abs(p.x)<.96&&Math.abs(p.y)<.96&&p.z>0&&p.z<1,JSON.stringify(p));
   }
   record.views.push({id:camera.id,viewport,camera:actual,landmarks});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,`${camera.id}-${viewport.width}.jpg`),type:'jpeg',quality:82});}
 }
 await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>room.resize());await pose(cameras[0]);
 record.scene=await page.evaluate(()=>({meshes:s.meshes.length,vertices:s.getTotalVertices(),materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length,
  shadowMaps:s.lights.filter(l=>!!l.getShadowGenerator?.()).length,
  landscape:s.meshes.filter(m=>m.name.startsWith('coastal-landscape-')).map(m=>({name:m.name,phase:m.metadata.landscapePhase||1,vertices:m.getTotalVertices(),triangles:m.getTotalIndices()/3,material:m.material.name,pickable:m.isPickable,collisions:m.checkCollisions,receiveShadows:m.receiveShadows,casts:room.exterior.shadow.getShadowMap().renderList.includes(m)}))}));
 if(!baseline){
  assert.equal(record.scene.landscape.length,19);assert.ok(record.scene.landscape.every(m=>!m.pickable&&!m.collisions&&!m.casts&&!m.receiveShadows));
  for(const [name,hour,weather]of [['noon',12,'clear'],['sunset',18,'clear'],['night',0,'clear'],['fog',12,'fog'],['rain',12,'storm']]){
   await page.evaluate(({hour,weather})=>{room.setWeather(weather);room.setTimeAutomatic(false);room.setTimeOfDay(hour);room.applyTimeOfDay(room.timeOfDay);},{hour,weather});
   await pose(cameras[0]);await page.screenshot({path:path.join(out,`weather-${name}.jpg`),type:'jpeg',quality:82});
  }
  await page.evaluate(()=>{room.setWeather('clear');room.setTimeOfDay(15);});await pose(cameras[0]);
  await page.evaluate(()=>{room.firstPersonCamera._checkInputs=self.originalCameraInputs;});
  const before=await page.evaluate(()=>({alpha:room.camera.alpha,radius:room.camera.radius}));
  await page.mouse.move(600,400);await page.mouse.down();await page.mouse.move(710,420,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-160);for(let i=0;i<12;i++)await draw();
  const after=await page.evaluate(()=>({alpha:room.camera.alpha,radius:room.camera.radius}));assert.ok(before.alpha!==after.alpha&&before.radius!==after.radius);record.orbit=true;
  await page.locator('#floor-plan-toggle').click();await page.locator('#map-scope-house').click();await page.locator('#map-scope-coast').click();await page.locator('#coast-preview').click();record.maps=true;
  await page.locator('#settings-btn').click();await page.locator('#movement-speed').fill('2');assert.equal(await page.evaluate(()=>room.firstPersonCamera.speed),2.145);await page.locator('#settings-reset').click();assert.equal(await page.evaluate(()=>room.firstPersonCamera.speed),1.0725);await page.locator('#settings-close').click();record.settings=true;
  await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible()&&!document.querySelector('#inspect-btn').disabled,null,{timeout:60000});await draw();await page.evaluate(()=>document.querySelector('#inspect-btn').click());await page.waitForFunction(()=>!s.debugLayer.isVisible());record.inspector=true;
  await page.goto(base+'home/',{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});record.subpathReady=true;
 }
 assert.deepEqual(record.errors,[]);record.passed=true;
 }catch(error){record.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(record,null,2)+'\n');if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
 console.log(JSON.stringify({passed:record.passed,bytes:record.firstScreenBytes,scene:record.scene,errors:record.errors}));
})().catch(error=>{console.error(error);process.exitCode=1;});
