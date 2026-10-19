// Reference render steps isolate jump behavior; synchronized poses are fixtures, not route claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const output=path.resolve(process.env.STUDY_CHECK_OUTPUT||path.join(__dirname,'jump'));
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],warnings=[],failed=[];
  const record={baseline:'69606ac',fpsOrLoadTimeSampling:false,referenceDelta:1/60,landings:{}};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  const frames=n=>page.evaluate(n=>{for(let i=0;i<n;i++)s.render();},n);
  const snapshot=()=>page.evaluate(()=>({position:room.firstPersonCamera.position.asArray(),previous:room.previousWalk.asArray(),jump:{...room.jump},locked:room.pointerLocked}));
  const pose=(x,y,feet=0)=>page.evaluate(({x,y,feet})=>{
    const c=room.firstPersonCamera,V=c.position.constructor;
    c.position.set((x-5.4)*5,-5+(feet+1.6)*5,(y-5.4)*5);c.setTarget(c.position.add(new V(0,0,5)));
    c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
    Object.assign(room.jump,{feet,velocity:0,grounded:true,queued:false,originTop:feet});
    room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};
  },{x,y,feet});
  const shot=async name=>{
    await page.evaluate(()=>{self.shotRender=()=>s.render();e.runRenderLoop(self.shotRender);});await page.waitForTimeout(150);
    await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:86});await page.evaluate(()=>e.stopRenderLoop(self.shotRender));
  };
  try{
    await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8196/');
    await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await page.context().newCDPSession(page));
    await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>1000/60;e.getFps=()=>60;});
    await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
    assert.equal(await page.evaluate(()=>room.firstPersonCamera.speed),.825);
    await page.keyboard.press('Space');
    const samples=[];for(let i=0;i<80;i++){await frames(1);samples.push((await snapshot()).position[1]);}
    assert.ok(Math.max(...samples)>4.5);assert.equal(samples.at(-1),3);record.floorJump={apex:Math.max(...samples),landed:samples.at(-1),samples};await shot('jump-in-place');
    for(const [id,x,y,top]of [['bed',2.1,8.45,.73],['sofa',10.24,8.4,.441],['coffee-table',8.7,8.4,.468],['chair',6.9,1.8,.561],['balcony-floor',8.1,11.8,0],['floor',9.4,5.35,0]]){
      await pose(x,y);const before=await snapshot();assert.deepEqual(before.position,before.previous);
      await page.keyboard.press('Space');await frames(80);const after=await snapshot(),expected=-5+(top+1.6)*5;
      record.landings[id]={x,y,top,before,after,expectedEyeY:expected};
      assert.ok(Math.abs(after.position[1]-expected)<.01,JSON.stringify(record.landings[id]));
      assert.equal(after.jump.grounded,true);if(['bed','sofa'].includes(id))await shot('landed-on-'+id);
    }
    await pose(2.1,8.45,.73);await page.evaluate(()=>{const c=room.firstPersonCamera,V=c.position.constructor;c.setTarget(c.position.add(new V(5,0,0)));});
    const walkOff=[];await page.keyboard.down('w');
    try{for(let i=0;i<80;i++){await frames(1);const state=await snapshot();walkOff.push(state);if(state.position[0]/5+5.4>3.5)break;}}
    finally{await page.keyboard.up('w');await page.evaluate(()=>{room.firstPersonCamera.cameraDirection.setAll(0);room.firstPersonCamera.movement.resetPanVelocity();});}
    await frames(80);const landed=await snapshot();assert.equal(landed.position[1],3);assert.equal(landed.jump.feet,0);assert.ok(landed.position[0]/5+5.4>3.2);
    record.walkOffBed={samples:walkOff,landed};
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.pointerLockElement);await page.locator('[data-view="overview"]').click();
    await page.locator('#gameCanvas').focus();await frames(2);
    const orbitBefore=await page.evaluate(()=>s.activeCamera.position.asArray());await page.keyboard.press('Space');await frames(20);
    const orbitAfter=await page.evaluate(()=>s.activeCamera.position.asArray());
    assert.ok(orbitAfter.every((value,index)=>Math.abs(value-orbitBefore[index])<1e-8));
    record.orbitSpaceIgnored={before:orbitBefore,after:orbitAfter,maxDifference:Math.max(...orbitAfter.map((value,index)=>Math.abs(value-orbitBefore[index])))};
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);record.passed=true;
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  }finally{Object.assign(record,{errors,warnings,failed});fs.writeFileSync(path.join(output,'jump.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
  console.log(JSON.stringify({passed:record.passed,landings:Object.keys(record.landings),walkOff:!!record.walkOffBed}));
})().catch(error=>{console.error(error);process.exitCode=1;});
