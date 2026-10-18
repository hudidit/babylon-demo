// Targeted browser check for the 40 km/h top speed and halved steering response.
// Fixtures only place the walker/rider for the parameter probes; route travel uses real keys.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),walking=load('WalkingSurface'),site=load('CoastalSite');
const out=__dirname,base=process.env.STUDY_URL||'http://127.0.0.1:8180/';
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 const record={baseline:'66221d4 + 40 km/h / half steering',fpsOrLoadingBenchmark:false,url:base,errors:[],warnings:[],badResponses:[],
  parameters:{cruiseMps:v.SCOOTER.cruise,cruiseKmh:v.SCOOTER.cruise*3.6,steerSensitivity:v.SCOOTER.steerSensitivity},
  method:'Production dist, Chrome headless, normal render loop. Real W/A/D/Space key events. The rider is fixture-placed only for the isolated top-speed/steering probes; route travel never sets vehicle position or heading.',checks:{},travel:[]};
 page.on('pageerror',e=>record.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)record.badResponses.push({url:r.url(),status:r.status()});});
 const shot=name=>page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:86});
 const state=()=>page.evaluate(()=>({vehicle:{...room.scooter},hint:document.querySelector('#interaction-hint').textContent,locked:!!document.pointerLockElement,view:room.currentView}));
 const placeRider=async(x,y,heading,speed=0)=>page.evaluate(({x,y,heading,speed})=>{
  room.pauseScooter();Object.assign(room.scooter,{x,y,heading,speed,distance:0,riding:true,exitRequested:false,steer:0});
  room.scooterModel.update(room.scooter,true);room.placeRiderCamera();
 },{x,y,heading,speed});
 const placeWalker=async(p,target)=>{
  const h=walking.walkingSurfaceAt(p.x,p.y).height;await page.evaluate(({p,h,target})=>{const c=room.firstPersonCamera,V=c.position.constructor;
   c.position.set((p.x-5.4)*5,-5+(h+1.6)*5,(p.y-5.4)*5);c.setTarget(new V((target.x-5.4)*5,-5+(h+.7)*5,(target.y-5.4)*5));
   c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();room.previousWalk.copyFrom(c.position);
   Object.assign(room.jump,{feet:h,grounded:true,velocity:0,queued:false,originTop:h});room.stableWalk={position:c.position.clone(),feet:h};},{p,h,target});
 };
 let pressed=new Set();
 const keys=async next=>{const n=new Set(next);for(const key of pressed)if(!n.has(key))await page.keyboard.up(key);for(const key of n)if(!pressed.has(key))await page.keyboard.down(key);pressed=n;};
 try{
  await page.goto(base,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);

  // Isolated top-speed probe on the long, straight supported stretch east of the tower.
  const startHeading=Math.atan2(-24,19);
  await placeRider(-80,33,startHeading);await page.waitForTimeout(200);
  const samples=[];await page.keyboard.down('w');const started=Date.now();
  for(let i=0;i<10;i++){await page.waitForTimeout(500);const s=await state();samples.push({elapsed:(Date.now()-started)/1000,speedMps:s.vehicle.speed,speedKmh:s.vehicle.speed*3.6,hint:s.hint,supported:!!v.scooterSupport(s.vehicle)});}
  const fast=await state();await shot('top-speed-40');
  await page.keyboard.up('w');await page.keyboard.down('Space');await page.waitForTimeout(1800);await page.keyboard.up('Space');
  assert.ok(Math.abs(fast.vehicle.speed-40/3.6)<.01,`top speed ${fast.vehicle.speed}`);assert.match(fast.hint,/骑行 40 km\/h/);
  assert.ok(samples.every(s=>s.supported));
  record.checks.topSpeed={samples,maxSpeedMps:Math.max(...samples.map(s=>s.speedMps)),hudHint:fast.hint,passed:true};

  // One second at full standstill lock: the old response turned about 88 degrees.
  await placeRider(-80,33,startHeading);await page.waitForTimeout(150);
  const before=await state();await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');const after=await state();
  const delta=Math.abs(angleDiff(after.vehicle.heading,before.vehicle.heading));
  assert.ok(delta>.70&&delta<.84,`one-second standstill turn ${delta}`);assert.ok(v.scooterSupport(after.vehicle));
  record.checks.steering={durationSeconds:1,headingDeltaRadians:delta,headingDeltaDegrees:delta*180/Math.PI,estimatedPreviousDeltaRadians:delta*2,ratio:delta/(delta*2),supported:true,passed:true};

  // Full route with real keys. The scooter starts at its normal home parking pose.
  await placeRider(14,2.2,Math.PI);await page.waitForTimeout(250);
  const route=site.coastalRoute().filter(p=>p.y<82&&p.x<13.1).filter(p=>!(p.x>10&&p.y>1));
  const outbound=[{x:13,y:0},...route.filter(p=>p.x<12.9||p.y<0),{x:-123.5,y:82.3}];
  const drive=async(name,points)=>{
   let index=0,stuck=0,lastDistance=0,maxSpeed=0;const startedAt=Date.now(),samples=[];
   while(index<points.length){
    const s=(await state()).vehicle;let closest=index,d=Infinity;
    for(let j=index;j<Math.min(points.length,index+18);j++){const dist=Math.hypot(points[j].x-s.x,points[j].y-s.y);if(dist<d){d=dist;closest=j;}}
    index=closest;const end=points[points.length-1],endDistance=Math.hypot(end.x-s.x,end.y-s.y);
    if(index>points.length-5&&endDistance<.65)break;
    let goal=points[index],j=index;const look=.8+Math.abs(s.speed)*.22;
    while(j<points.length-1&&Math.hypot(goal.x-s.x,goal.y-s.y)<look)goal=points[++j];
    const desired=Math.atan2(goal.x-s.x,goal.y-s.y),error=angleDiff(desired,s.heading),predicted=error-s.steer*.16;
    const input=[];
    // At 40 km/h the old 5 m/s driver overshot the final point before braking. Stop within
    // the real 7 m/s2 brake distance, then creep the last metres at the existing 2 m/s limit.
    const finalApproach=endDistance<Math.max(4,s.speed*s.speed/(2*v.SCOOTER.brake)+3);
    if(finalApproach){if(s.speed>2)input.push('Space');else input.push('w');}
    else if(Math.abs(error)<.8)input.push('w');else input.push('Space');
    if(predicted>.06)input.push('d');if(predicted<-.06)input.push('a');
    await keys(input);await page.waitForTimeout(60);
    maxSpeed=Math.max(maxSpeed,s.speed);
    if(Math.abs(s.distance-lastDistance)<.02)stuck++;else stuck=0;lastDistance=s.distance;
    if(samples.length===0||(Date.now()-startedAt)/1000-samples.at(-1).elapsed>.48){
     const current=await state();
     samples.push({elapsed:(Date.now()-startedAt)/1000,index,...current.vehicle,supported:!!v.scooterSupport(current.vehicle)});
     if(samples.length%5===0)console.log(name,'progress',index.toFixed(0),s.x.toFixed(1),s.y.toFixed(1),(s.speed*3.6).toFixed(0)+'km/h');
    }
    assert.ok(stuck<18,'stuck '+JSON.stringify({name,index,s,error,goal}));assert.ok(Date.now()-startedAt<100000,'trip timeout '+name);
   }
   await keys(['Space']);await page.waitForTimeout(2000);await keys([]);
   const end=await state(),elapsed=(Date.now()-startedAt)/1000;
   for(const sample of samples)assert.ok(sample.supported,JSON.stringify(sample));
   const endDistance=Math.hypot(points.at(-1).x-end.vehicle.x,points.at(-1).y-end.vehicle.y);
   assert.ok(endDistance<.7,`${name} endpoint ${endDistance}`);assert.equal(end.vehicle.riding,true);
   record.travel.push({name,elapsed,maxSpeed,index,samples: samples.length,end:{x:end.vehicle.x,y:end.vehicle.y,speed:end.vehicle.speed,heading:end.vehicle.heading},samplesTail:samples.slice(-3)});
   await shot(name);return end;
  };
  const outboundEnd=await drive('ride-home-to-lighthouse',outbound);
  const turnStart=outboundEnd.vehicle.heading,turnStarted=Date.now();await page.keyboard.down('a');
  while(Math.abs(angleDiff((await state()).vehicle.heading,turnStart+Math.PI))>.12){
   assert.ok(Date.now()-turnStarted<7000,'turnaround timeout');await page.waitForTimeout(100);
  }
  await page.keyboard.up('a');await page.waitForTimeout(150);
  record.checks.turnaround={seconds:(Date.now()-turnStarted)/1000,from:turnStart,to:(await state()).vehicle.heading};
  const back=outbound.slice().reverse().slice(1);back.push({x:14,y:2.2});
  await drive('ride-lighthouse-to-home',back);
  const end=await state();assert.ok(Math.hypot(end.vehicle.x-14,end.vehicle.y-2.2)<.7,'did not return to home parking');record.checks.routes=true;
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.badResponses,[]);record.passed=true;
 }finally{await keys([]);fs.writeFileSync(path.join(out,record.passed?'tuning.json':'tuning-partial.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({passed:record.passed,topSpeed:record.checks.topSpeed?.maxSpeedMps,steering:record.checks.steering?.headingDeltaDegrees,travel:record.travel.map(t=>({name:t.name,elapsed:t.elapsed,maxSpeed:t.maxSpeed}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
