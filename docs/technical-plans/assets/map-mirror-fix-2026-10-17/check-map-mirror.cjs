// Functional reflection/projection evidence; no FPS or load-time sampling.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
 const output=process.env.STUDY_CHECK_OUTPUT||__dirname;fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const record={baseline:'db500b3',browser:browser.version(),fpsOrLoadTimeSampling:false};
 const render=(n=5)=>page.evaluate(n=>{for(let i=0;i<n;i++)s.render();},n);
 const shot=async name=>{await render();await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:92});};
 const pose=async(x,y,tx,ty,h=1.6,th=1.6)=>page.evaluate(({x,y,tx,ty,h,th})=>{
  const c=s.activeCamera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
  c.position.copyFrom(p(x,y,h));c.setTarget(p(tx,ty,th));c.getViewMatrix(true);for(let i=0;i<5;i++)s.render();
 },{x,y,tx,ty,h,th});
 const pixels=()=>page.evaluate(async()=>{
  const copy=(await self.currentMirrorPixels).slice();
  let changed=0;if(self.lastMirrorPixels)for(let i=0;i<copy.length;i+=4)if(copy[i]!==lastMirrorPixels[i]||copy[i+1]!==lastMirrorPixels[i+1]||copy[i+2]!==lastMirrorPixels[i+2])changed++;
  self.lastMirrorPixels=copy;
  return {hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',copy))].map(n=>n.toString(16).padStart(2,'0')).join(''),changedPixels:changed};
 });
 try {
  await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8113/');
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('主卧套间已布置'));
  await page.evaluate(()=>{
   webpackChunkbabylon_learning.push([[989995],{},r=>self.req=r]);
   for(const [id,f]of Object.entries(req.m))if(/get LastCreatedEngine/.test(f.toString()))for(const v of Object.values(req(id)))if(typeof v==='function'&&v.LastCreatedEngine?.scenes?.length){self.s=v.LastCreatedScene;self.engine=v.LastCreatedEngine;engine.stopRenderLoop();engine.getDeltaTime=()=>50;}
   self.mirrorMesh=s.meshes.find(m=>m.metadata?.mirrorPlane);self.mirror=mirrorMesh.material.reflectionTexture;self.mirrorRenders=0;mirror.onBeforeRenderObservable.add(()=>mirrorRenders++);mirror.onAfterRenderObservable.add(()=>{self.currentMirrorPixels=engine.readPixels(0,0,512,512);});
  });
  record.mirror=await page.evaluate(()=>({plane:mirror.mirrorPlane.asArray(),size:[mirror.getSize().width,mirror.getSize().height],texture:mirror.name,cameras:s.cameras.length,hasMirrorPrePass:s.textures.some(t=>t.name.includes('mirror-target')&&t.name.includes('prePass')),mainPrePass:s.textures.some(t=>t.name==='sceneprePassRT'),list:mirror.renderList.map(m=>({name:m.name,owners:m.metadata?.ownerRooms})),selfExcluded:!mirror.renderList.includes(mirrorMesh),usesSceneHDR:mirror===s.environmentTexture}));
  assert.deepEqual(record.mirror.size,[512,512]);assert.equal(record.mirror.hasMirrorPrePass,false);assert.equal(record.mirror.mainPrePass,true);assert.equal(record.mirror.cameras,3);assert.equal(record.mirror.selfExcluded,true);assert.equal(record.mirror.usesSceneHDR,false);assert.ok(record.mirror.list.every(m=>m.owners.some(id=>['ensuite','master'].includes(id))));
  await page.locator('[data-view="overview"]').click();await shot('overview');
  // A real north-up orthographic camera projects the actual floor centres for comparison.
  record.mapProjection=await page.evaluate(()=>{
   const V=s.activeCamera.position.constructor,Camera=s.getCameraByName('study-first-person').constructor;
   const c=new Camera('north-projection-check',new V(0,100,0),s);
   c.mode=1;c.upVector=new V(0,0,-1);c.setTarget(new V(0,-5,0));c.orthoLeft=-35;c.orthoRight=35;c.orthoTop=35;c.orthoBottom=-35;c.getViewMatrix(true);c.getProjectionMatrix(true);
   const matrix=c.getTransformationMatrix(),points=[];
   for(const id of ['master','study','kitchen','ensuite','bathroom','bedroom','living','balcony']){
    const floor=s.getMeshByName(id+'-oak-floor'),p=V.TransformCoordinates(floor.position,matrix),rect=document.querySelector(`#floor-plan-mini [data-room="${id}"] rect`);
    points.push({id,screenX:p.x,screenY:-p.y,mapX:+rect.getAttribute('x')+ +rect.getAttribute('width')/2,mapY:+rect.getAttribute('y')+ +rect.getAttribute('height')/2});
   }
   c.dispose();return points;
  });
  for(const a of record.mapProjection)for(const b of record.mapProjection){assert.equal(Math.abs(a.screenX-b.screenX)<1e-6?0:Math.sign(a.screenX-b.screenX),Math.sign(a.mapX-b.mapX));assert.equal(Math.abs(a.screenY-b.screenY)<1e-6?0:Math.sign(a.screenY-b.screenY),Math.sign(a.mapY-b.mapY));}
  await page.locator('#floor-plan-toggle').click();await shot('map-desktop');await page.keyboard.press('Escape');
  await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await pose(1.45,5.25,2.288,5.35);
  await shot('mirror-front');record.front=await pixels();assert.ok(await page.evaluate(()=>mirrorRenders>0));
  await page.evaluate(()=>{self.toilet=s.meshes.filter(m=>m.name.startsWith('ensuite-toilet-'));toilet.forEach(m=>m.setEnabled(false));});
  await render();record.hiddenToilet=await pixels();assert.ok(record.hiddenToilet.changedPixels>20,'the actual toilet must appear in the reflection');
  await page.evaluate(()=>toilet.forEach(m=>m.setEnabled(true)));await render();record.restoredToilet=await pixels();assert.equal(record.restoredToilet.hash,record.front.hash);
  await pose(1.2,5.9,1.2,4.8,1.6,1.1);await page.mouse.click(640,400);await render(18);
  assert.ok(Math.abs(await page.evaluate(()=>s.getTransformNodeByName('ensuite-door').rotation.y))>1.5);
  await pose(1.45,5.25,2.288,5.35);record.doorOpen=await pixels();assert.notEqual(record.doorOpen.hash,record.front.hash);await shot('mirror-door-open');
  await pose(1.2,5.9,.84,5.16,1.6,1.1);await page.mouse.click(640,400);await render(18);
  assert.ok(Math.abs(await page.evaluate(()=>s.getTransformNodeByName('ensuite-door').rotation.y))<1e-6);
  await pose(1.2,5.5,2.288,5.35);record.otherView=await pixels();assert.notEqual(record.otherView.hash,record.front.hash);await shot('mirror-other-view');
  // Click the actual mirror light and inspect its reflected effect at a fixed camera position.
  await pose(1.3,5.85,1.85,5.35,1.6,2.18);await page.mouse.click(640,400);await render();
  assert.equal(await page.evaluate(()=>s.getLightByName('ensuite-lamp-light').intensity),0);
  await pose(1.45,5.25,2.288,5.35);record.lightOff=await pixels();assert.notEqual(record.lightOff.hash,record.front.hash);await shot('mirror-light-off');
  await pose(1.3,5.85,1.85,5.35,1.6,2.18);await page.mouse.click(640,400);await render();
  assert.ok(await page.evaluate(()=>s.getLightByName('ensuite-lamp-light').intensity>0));
  // Back-facing and off-screen mirrors must keep their cached target.
  await pose(3.1,5.3,2.288,5.35);const back=await page.evaluate(()=>mirrorRenders);await render(8);assert.equal(await page.evaluate(()=>mirrorRenders),back);
  await pose(1.45,5.25,.2,5.25);const away=await page.evaluate(()=>mirrorRenders);await render(8);assert.equal(await page.evaluate(()=>mirrorRenders),away);record.visibilityGating=true;
  record.headings=[];
  for(const [dx,dz,expected]of [[0,-1,0],[1,0,-90],[0,1,180],[-1,0,90]]){
   await pose(7,7,7+dx,7+dz);const angle=await page.locator('#floor-plan-mini .plan-position').getAttribute('transform');const actual=+angle.match(/rotate\(([^)]+)\)/)[1];assert.ok(Math.cos((actual-expected)*Math.PI/180)>1-1e-6);record.headings.push({dx,dz,actual});
  }
  await page.evaluate(()=>document.exitPointerLock?.());
  for(const [width,height,mode]of [[390,844,'portrait'],[844,390,'landscape']]){
   await page.setViewportSize({width,height});await page.locator('[data-view="ensuite"]').scrollIntoViewIfNeeded();await page.locator('[data-view="ensuite"]').click();await shot('ensuite-'+mode);
   await page.locator('#floor-plan-toggle').click();await shot('map-'+mode);await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);record.passed=true;
 } finally {Object.assign(record,{errors,warnings});fs.writeFileSync(path.join(output,'mirror-map.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,mirror:record.mirror,front:record.front,hiddenToilet:record.hiddenToilet,lightOff:record.lightOff},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
