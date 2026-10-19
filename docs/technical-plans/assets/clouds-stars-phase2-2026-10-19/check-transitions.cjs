const assert=require('node:assert/strict'),fixture=require('./browser-fixture.cjs');
(async()=>{
 const h=await fixture.start(),{page}=h,record={baseline:'fefe1b3',fpsOrLoadTimeSampling:false,frames:[],retargets:[]};
 const sample=()=>page.evaluate(()=>{
  const sky=s.getMaterialByName('coastal-sky'),sea=s.getMaterialByName('coastal-ocean');
  return{hour:s.metadata.timeOfDay.state.hour,stars:sky._floats.skyStarVisibility,seaStars:sea._floats.skyStarVisibility,moon:sky._floats.skyMoonVisibility,
   light:sky._vectors3.skyCloudLight.asArray(),seaLight:sea._vectors3.skyCloudLight.asArray(),shade:sky._vectors3.skyCloudShade.asArray(),seaShade:sea._vectors3.skyCloudShade.asArray()};
 });
 const step=n=>page.evaluate(n=>{e.getDeltaTime=()=>50;for(let i=0;i<n;i++)s.render();e.getDeltaTime=()=>0;},n);
 const synced=value=>{assert.equal(value.stars,value.seaStars);assert.deepEqual(value.light,value.seaLight);assert.deepEqual(value.shade,value.seaShade);};
 try{
  await page.locator('[data-view="balcony"]').click();await h.select(12);await h.skyPose(140,35);
  await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();
  for(let i=0;i<=24;i++){const v=await sample();synced(v);record.frames.push({frame:i,...v});if(i%4===0)await h.shot(`transition-${String(i).padStart(2,'0')}`);if(i<24)await step(1);}
  assert.equal(record.frames[0].stars,0);assert.equal(record.frames.at(-1).stars,1);
  for(let i=1;i<record.frames.length;i++)assert.ok(record.frames[i].stars>=record.frames[i-1].stars);
  for(const target of [6,18,12]){
   const before=await sample();await page.locator(`[data-time-hour="${target}"]`).click();const immediate=await sample();assert.deepEqual(before,immediate);
   await step(5);const after=await sample();synced(after);record.retargets.push({target,before,after});
  }
  await step(26);assert.equal((await sample()).hour,12);await page.locator('#time-close').click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#time-toggle').click();await page.locator('[data-time-hour="0"]').click();
  await step(2);record.reducedMidpoint=await sample();synced(record.reducedMidpoint);assert.equal(record.reducedMidpoint.stars,.5);assert.equal(record.reducedMidpoint.moon,0);
  await step(2);record.reducedEnd=await sample();assert.equal(record.reducedEnd.hour,0);assert.equal(record.reducedEnd.stars,1);await page.locator('#time-close').click();
  await h.shot('reduced-motion-midnight');assert.deepEqual(h.errors,[]);assert.deepEqual(h.requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{Object.assign(record,{errors:h.errors,warnings:h.warnings});h.save('transitions.json',record);await h.browser.close();}
 console.log(JSON.stringify({passed:record.passed,frames:record.frames.length,retargets:record.retargets.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
