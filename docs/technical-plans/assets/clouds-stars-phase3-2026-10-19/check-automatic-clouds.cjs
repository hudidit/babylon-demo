// Advance the production frame callbacks with reference deltas; this is not an elapsed-time benchmark.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=require('../clouds-stars-phase2-2026-10-19/browser-fixture.cjs');
const {evaluateTimeOfDay:at}=require('../lighthouse-d-2026-10-18/source-loader.cjs')('RoomTimeOfDay');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const record={baseline:'47eb076',fpsOrLoadTimeSampling:false,method:'Two engines; 14,400 production callbacks at 100 ms cover a full 24-minute cycle. Every six steps records the shared cloud/star state; actual GPU frames straddle both solar gates and midnight. Screenshots freeze the clock.',cases:[]};
(async()=>{
 try{for(const kind of ['chromium','webkit']){
  const h=await fixture.start({kind}),{page}=h;
  const current={kind,version:h.browser.version(),samples:[],referencePixels:[],images:[]};
  try{
   await page.locator('[data-view="balcony"]').click();await h.select(18);await h.skyPose(40,55);
   await page.locator('#time-toggle').click();await page.locator('#time-automatic').check();await page.locator('#time-close').click();
   await page.evaluate(()=>{e.getDeltaTime=()=>100;s.onBeforeRenderObservable.notifyObservers(s);e.getDeltaTime=()=>0;});
   // Solar elevation -4/-12 degrees at 18.675/19.275 and 05.325/04.725 hours.
   const gates=[405,765,3600,6435,6795];
   const stops=new Set([0,1800,3600,5400,7200,9000,10800,12600,14400,...gates.flatMap(n=>[n-1,n,n+1])]);
   let previous=0;
   for(const stop of [...stops].sort((a,b)=>a-b)){
    const values=await page.evaluate(({count,offset})=>{
     const sky=s.getMaterialByName('coastal-sky'),sea=s.getMaterialByName('coastal-ocean'),samples=[];
     e.getDeltaTime=()=>100;
     for(let i=1;i<=count;i++){
      s.onBeforeRenderObservable.notifyObservers(s);
      if((i+offset)%6===0||i===count){const t=s.metadata.timeOfDay;
       samples.push({step:i+offset,hour:t.state.hour,visual:t.visualHour,stars:sky._floats.skyStarVisibility,seaStars:sea._floats.skyStarVisibility,
        light:sky._vectors3.skyCloudLight.asArray(),seaLight:sea._vectors3.skyCloudLight.asArray(),shade:sky._vectors3.skyCloudShade.asArray(),seaShade:sea._vectors3.skyCloudShade.asArray()});}
     }
     e.getDeltaTime=()=>0;return samples;
    },{count:stop-previous,offset:previous});previous=stop;
    for(const value of values){const expected=at(value.hour);near(value.visual,value.hour);near(value.stars,expected.sky.starVisibility);near(value.stars,value.seaStars);
     expected.sky.cloudLight.forEach((v,i)=>near(v,value.light[i]));expected.sky.cloudShade.forEach((v,i)=>near(v,value.shade[i]));
     assert.deepEqual(value.light,value.seaLight);assert.deepEqual(value.shade,value.seaShade);current.samples.push(value);}
    if(gates.some(n=>Math.abs(stop-n)<=1)){
     const pixel=await page.evaluate(async step=>{
      s.render();await new Promise(resolve=>s.executeWhenReady(()=>resolve()));s.render();
      const pixels=new Uint8Array(await e.readPixels(0,0,e.getRenderWidth(),e.getRenderHeight()));
      s.render();const repeat=new Uint8Array(await e.readPixels(0,0,e.getRenderWidth(),e.getRenderHeight()));
      let repeatDifferences=0;for(let i=0;i<pixels.length;i++)if(pixels[i]!==repeat[i])repeatDifferences++;
      let maximum=0,total=0,changed=0,overEight=0;
      if(self.previousGatePixels&&step-self.previousGateStep===1)for(let i=0;i<pixels.length;i+=4){let different=false;
       let peak=0;for(let c=0;c<3;c++){const d=Math.abs(pixels[i+c]-self.previousGatePixels[i+c]);peak=Math.max(peak,d);maximum=Math.max(maximum,d);total+=d;different ||= d!==0;}if(different)changed++;if(peak>8)overEight++;}
      const compared=!!self.previousGatePixels&&step-self.previousGateStep===1;
      self.previousGatePixels=pixels;self.previousGateStep=step;return{step,hour:s.metadata.timeOfDay.state.hour,compared,maximum,mean:total/(pixels.length/4*3),changed,overEightFraction:overEight/(pixels.length/4),repeatDifferences};
     },stop);
     current.referencePixels.push(pixel);
    }
    if(stop%1800===0||gates.includes(stop)){
     const name=`${kind}-automatic-${String(stop).padStart(5,'0')}`;await h.shot(name);current.images.push(name+'.jpg');
    }
   }
   near(current.samples.at(-1).hour,18);
   for(let i=1;i<current.samples.length;i++){
    const a=current.samples[i-1],b=current.samples[i];assert.ok(Math.abs(a.stars-b.stars)<.02,'no layer switching');
    b.light.forEach((v,j)=>assert.ok(Math.abs(v-a.light[j])<.01));
   }
   // These are six scene seconds apart. Keep the mean below one 8-bit code value and bound
   // sparse star/8-bit postprocess quantisation separately from a whole-layer discontinuity.
   for(const pixel of current.referencePixels){assert.equal(pixel.repeatDifferences,0,JSON.stringify(pixel));if(pixel.compared){assert.ok(pixel.mean<1,JSON.stringify(pixel));assert.ok(pixel.maximum<=16,JSON.stringify(pixel));assert.ok(pixel.overEightFraction<.001,JSON.stringify(pixel));}}
   // Stop halfway through a 10 Hz visual batch: exact snapshot must be applied immediately.
   await page.evaluate(()=>{e.getDeltaTime=()=>16;s.onBeforeRenderObservable.notifyObservers(s);e.getDeltaTime=()=>0;});
   await page.locator('#time-toggle').click();await page.locator('#time-automatic').uncheck();
   current.stopped=await page.evaluate(()=>{const t=s.metadata.timeOfDay,sky=s.getMaterialByName('coastal-sky'),sea=s.getMaterialByName('coastal-ocean');
    return{hour:t.state.hour,visual:t.visualHour,stars:sky._floats.skyStarVisibility,seaStars:sea._floats.skyStarVisibility,light:sky._vectors3.skyCloudLight.asArray(),seaLight:sea._vectors3.skyCloudLight.asArray()};});
   near(current.stopped.hour,current.stopped.visual);near(current.stopped.stars,at(current.stopped.hour).sky.starVisibility);near(current.stopped.stars,current.stopped.seaStars);assert.deepEqual(current.stopped.light,current.stopped.seaLight);
   current.resources=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
   assert.deepEqual(current.resources,{meshes:670,materials:95,textures:148,lights:17,cameras:3});
   assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);assert.deepEqual(h.requests.filter(r=>r.status>=400),[]);current.passed=true;
  }finally{Object.assign(current,{errors:h.errors,warnings:h.warnings,requests:h.requests});record.cases.push(current);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await h.browser.close();}
 }record.passed=true;}finally{fs.writeFileSync(path.join(fixture.out,'automatic-clouds.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({passed:record.passed,cases:record.cases.length,samples:record.cases.map(c=>c.samples.length),gpuFrames:record.cases.map(c=>c.referencePixels.length)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
