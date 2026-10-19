// Only pixels inside the projected, actually displayed mirror face count as cloud evidence.
const assert=require('node:assert/strict'),fixture=require('./browser-fixture.cjs');
(async()=>{
 const h=await fixture.start({roomAccess:true}),{page}=h,record={baseline:'fefe1b3',browser:h.browser.version(),fpsOrLoadTimeSampling:false,
  method:'Actual first-person camera fixtures. Change only sky cloud uniforms, then restore; main-frame differences are masked to the physical mirror face. Doors use real pointer input.'};
 const pose=async(x,y,tx,ty,th=1.7)=>page.evaluate(({x,y,tx,ty,th})=>{
  const c=room.firstPersonCamera,V=c.position.constructor,p=(x,y,h)=>new V((x-5.4)*5,-5+h*5,(y-5.4)*5);
  c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.position.copyFrom(p(x,y,1.6));c.setTarget(p(tx,ty,th));
  Object.assign(room.jump,{feet:0,grounded:true,velocity:0,queued:false,originTop:0});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:0};c.getViewMatrix(true);for(let i=0;i<4;i++)s.render();
 },{x,y,tx,ty,th});
 const firstPersonTime=async hour=>{
  await page.keyboard.press('t');await page.waitForFunction(()=>!document.pointerLockElement);
  await page.locator(`[data-time-hour="${hour}"]`).click();
  await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<26;i++)s.render();e.getDeltaTime=()=>0;});await page.locator('#time-close').click();
 };
 const cloudPixels=(owner,stars=false)=>page.evaluate(async({owner,stars})=>{
  const mesh=s.meshes.find(m=>m.metadata?.reflectionRoom===owner),mat=s.getMaterialByName('coastal-sky'),light=mat._vectors3.skyCloudLight.clone(),shade=mat._vectors3.skyCloudShade.clone(),V=light.constructor;
  const W=e.getRenderWidth(),H=e.getRenderHeight(),M=s.activeCamera.getViewMatrix().constructor;
  const pts=mesh.getBoundingInfo().boundingBox.vectorsWorld.map(p=>V.Project(p,M.Identity(),s.getTransformMatrix(),{x:0,y:0,width:W,height:H})).map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),hull=[];
  for(const p of pts){while(hull.length>=2&&cross(hull[hull.length-2],hull.at(-1),p)<=0)hull.pop();hull.push(p);}const lower=hull.length;
  for(let i=pts.length-2;i>=0;i--){const p=pts[i];while(hull.length>lower&&cross(hull[hull.length-2],hull.at(-1),p)<=0)hull.pop();hull.push(p);}hull.pop();
  const inside=(x,y)=>hull.every((a,i)=>cross(a,hull[(i+1)%hull.length],{x,y})>=0);
  const read=async()=>{for(let i=0;i<3;i++)s.render();return new Uint8Array(await e.readPixels(0,0,W,H));};
  const weight=mat._floats.skyStarVisibility,before=await read();
  if(stars)mat.setFloat('skyStarVisibility',0);else{mat.setVector3('skyCloudLight',new V(0,0,0));mat.setVector3('skyCloudShade',new V(0,0,0));}
  const dark=await read();
  mat.setFloat('skyStarVisibility',weight);mat.setVector3('skyCloudLight',light);mat.setVector3('skyCloudShade',shade);const repeat=await read();
  let changed=0,peak=0,repeated=0,maskPixels=0;
  for(let i=0;i<W*H;i++){const x=i%W+.5,y=H-(Math.floor(i/W)+.5);if(!inside(x,y))continue;maskPixels++;let delta=0;for(let c=0;c<3;c++){delta+=Math.abs(before[i*4+c]-dark[i*4+c]);if(before[i*4+c]!==repeat[i*4+c])repeated++;}if(delta>=3)changed++;peak=Math.max(peak,delta);}
  const target=mesh.material.reflectionTexture;
  return{changedPixels:changed,peakRgbSum:peak,repeatDifferences:repeated,maskPixels,hull,plane:target.mirrorPlane.asArray(),
   eye:s.activeCamera.globalPosition.asArray(),mirroredEye:s.activeCamera.globalPosition.subtract(target.mirrorPlane.normal.scale(2*target.mirrorPlane.signedDistanceTo(s.activeCamera.globalPosition))).asArray(),
   listHasSky:target.renderList.includes(s.getMeshByName('coastal-sky')),listHasSea:target.renderList.includes(s.getMeshByName('coastal-sea'))};
 },{owner,stars});
 try{
  await h.select(12);await page.locator('[data-view="first-person"]').click();
  await pose(1.45,5.10,2.288,5.35,1.72);record.ensuite=await cloudPixels('ensuite');await h.shot('mirror-ensuite-window-clouds');
  assert.ok(record.ensuite.changedPixels>10,JSON.stringify(record.ensuite));assert.equal(record.ensuite.repeatDifferences,0);
  await firstPersonTime(0);await pose(1.45,5.10,2.288,5.35,1.72);record.ensuiteNightStars=await cloudPixels('ensuite',true);await h.shot('mirror-ensuite-night-sky');
  await firstPersonTime(12);
  await pose(3.2,5.25,2.512,5.4,1.64);record.publicClosed=await cloudPixels('bathroom');await h.shot('mirror-public-closed-wall');
  assert.equal(record.publicClosed.changedPixels,0,'windowless bathroom must not leak clouds through the closed door or walls');
  await pose(4.4,6,5.4,6,1.1);
  if(!await page.evaluate(()=>!!document.pointerLockElement)){await page.locator('#gameCanvas').click({position:{x:640,y:400}});await page.waitForFunction(()=>!!document.pointerLockElement);}
  await h.render();
  await page.waitForFunction(()=>document.querySelector('#interaction-hint').textContent.includes('打开'));
  record.publicDoorHint=await page.locator('#interaction-hint').textContent();
  await page.mouse.down();await page.mouse.up();await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<18;i++)s.render();e.getDeltaTime=()=>0;});
  record.publicDoorAngle=await page.evaluate(()=>s.getTransformNodeByName('bathroom-door').rotation.y);assert.ok(Math.abs(record.publicDoorAngle)>1.5);
  await pose(3.2,5.25,2.512,5.4,1.64);record.publicOpen=await cloudPixels('bathroom');await h.shot('mirror-public-open-door');
  // The remote living-room window is only visible from a narrow mirror/camera alignment.
  record.publicOpenHasCloudPixels=record.publicOpen.changedPixels>0;
  for(const owner of ['ensuite','bathroom']){
   assert.ok((owner==='ensuite'?record.ensuite:record.publicOpen).listHasSky);
  }
  record.targets=await page.evaluate(()=>s.meshes.filter(m=>m.metadata?.mirrorPlane).map(m=>({room:m.metadata.reflectionRoom,size:m.material.reflectionTexture.getSize(),noPrePass:m.material.reflectionTexture.noPrePassRenderer,refreshRate:m.material.reflectionTexture.refreshRate})));
  assert.equal(record.targets.length,2);assert.ok(record.targets.every(t=>t.size.width===512&&t.noPrePass&&t.refreshRate===0));
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{Object.assign(record,{errors:h.errors,warnings:h.warnings});h.save('mirror-clouds.json',record);await h.browser.close();}
 console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});
