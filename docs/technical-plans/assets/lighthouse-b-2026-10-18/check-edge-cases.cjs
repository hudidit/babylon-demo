// Controlled long-frame/input reference cases; these are not FPS or wall-clock travel measurements.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const load=require('./source-loader.cjs'),walking=load('WalkingSurface'),jump=load('HouseJump');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 const record={baseline:'8110fe7 + lighthouse B',fpsOrLoadTimeSampling:false,method:'Real production camera input/collision controller with fixed reference timesteps; fixtures reset starting poses only',cases:[],walkOff:[]};page.on('pageerror',e=>errors.push(e.message));
 const place=async(p,feet)=>page.evaluate(({p,feet})=>{const c=room.firstPersonCamera;c.position.set((p.x-5.4)*5,-5+(feet+1.6)*5,(p.y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};},{p,feet:feet??walking.walkingSurfaceAt(p.x,p.y).height});
 try{await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8171/');await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  await require('./browser-harness.cjs').captureRoom(page,await page.context().newCDPSession(page));await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>200;e.getFps=()=>5;s.render();});
  const fixtures=[{name:'cliff-fence',a:{x:14,y:0},z:{x:19,y:0}},{name:'balcony-rail',a:{x:8,y:11.5},z:{x:8,y:15}},{name:'window-wall',a:{x:-1,y:8},z:{x:1,y:8}},{name:'solid-tower',a:{x:-125,y:84.5},z:{x:-125,y:95.5}},{name:'closed-entry',a:{x:9.35,y:4.65},z:{x:13,y:4.65}}];
  for(const multiplier of [.25,1,3])for(const f of fixtures){await place(f.a);await page.evaluate(({z,multiplier})=>{const c=room.firstPersonCamera,V=c.position.constructor;room.setMovementSpeed(multiplier);c.setTarget(new V((z.x-5.4)*5,c.position.y,(z.y-5.4)*5));c.getViewMatrix(true);},{z:f.z,multiplier});await page.keyboard.press('Space');
   const result=await page.evaluate(()=>{const c=room.firstPersonCamera;c.inputs.attached.keyboard._keys=[87];let airborne=false;for(let i=0;i<160;i++){c._checkInputs();airborne ||= !room.jump.grounded;}c.inputs.attached.keyboard._keys=[];c.cameraDirection.setAll(0);c.movement.resetPanVelocity();return{x:c.position.x/5+5.4,y:c.position.z/5+5.4,feet:room.jump.feet,grounded:room.jump.grounded,airborne};});
   assert.ok(result.airborne);assert.ok(walking.walkingPointAllowed(result),JSON.stringify({f,multiplier,result}));assert.ok(Math.hypot(result.x-f.z.x,result.y-f.z.y)>.5);
   if(f.name==='closed-entry')assert.ok(result.x<10.8);record.cases.push({name:f.name,multiplier,referenceDelta:.2,result});
  }
  await page.evaluate(()=>{e.getDeltaTime=()=>1000/60;e.getFps=()=>60;room.setMovementSpeed(1);});
  for(const [name,p,z,top]of [['bed',{x:2.1,y:8.45},{x:2.1,y:10.4},.73],['sofa',{x:10.24,y:8.4},{x:8.5,y:8.4},.441],['coffee-table',{x:8.7,y:8.4},{x:7,y:8.4},.468]]){
   await place(p,top);const result=await page.evaluate(z=>{const c=room.firstPersonCamera,V=c.position.constructor;c.setTarget(new V((z.x-5.4)*5,c.position.y,(z.y-5.4)*5));c.getViewMatrix(true);c.inputs.attached.keyboard._keys=[87];for(let i=0;i<180;i++)c._checkInputs();c.inputs.attached.keyboard._keys=[];c.cameraDirection.setAll(0);c.movement.resetPanVelocity();return{point:{x:c.position.x/5+5.4,y:c.position.z/5+5.4},feet:room.jump.feet,grounded:room.jump.grounded};},z);
   record.walkOff.push({name,result});assert.ok(result.grounded&&Math.abs(result.feet)<.01,name+' walks down without another jump: '+JSON.stringify(result));
  }
  await place({x:-120,y:85});await page.keyboard.press('Space');await page.evaluate(()=>{for(let i=0;i<12;i++)room.firstPersonCamera._checkInputs();});
  const paused=await page.evaluate(()=>room.jump.feet);await page.keyboard.press('m');await page.evaluate(()=>{for(let i=0;i<120;i++)room.firstPersonCamera._checkInputs();});assert.equal(await page.evaluate(()=>room.jump.feet),paused);
  await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.evaluate(()=>{for(let i=0;i<120;i++)room.firstPersonCamera._checkInputs();});assert.equal(await page.evaluate(()=>room.jump.feet),3.04);record.mapPausesAirborneState=true;
  assert.deepEqual(errors,[]);record.passed=true;
 }finally{record.errors=errors;fs.writeFileSync(path.join(__dirname,'edge-cases.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}console.log(JSON.stringify({passed:record.passed,longFrameCases:record.cases.length,walkOff:record.walkOff.length,mapPausesAirborneState:record.mapPausesAirborneState}));
})().catch(e=>{console.error(e);process.exitCode=1;});
