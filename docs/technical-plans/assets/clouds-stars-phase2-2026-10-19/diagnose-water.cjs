// A diagnostic of the currently served version, written separately from the historical failed candidate.
const fixture=require('./browser-fixture.cjs');
(async()=>{
 const h=await fixture.start();try{
  await h.page.locator('[data-view="balcony"]').click();await h.select(0);await h.pose(20,55,-23,20,95,-28);
  const data=await h.page.evaluate(async()=>{
   const mat=s.getMaterialByName('coastal-ocean'),weight=mat._floats.skyStarVisibility;
   const read=async()=>{s.render();return new Uint8Array(await e.readPixels(320,180,640,280));};
   const on=await read();mat.setFloat('skyStarVisibility',0);const off=await read();mat.setFloat('skyStarVisibility',weight);const repeat=await read();
   let peak=0,example,repeatDifferences=0;
   for(let i=0;i<on.length;i+=4)for(let c=0;c<3;c++){
    const delta=Math.abs(on[i+c]-off[i+c]);if(delta>peak){peak=delta;example={x:320+(i/4)%640,y:180+Math.floor(i/4/640),channel:c,on:[...on.slice(i,i+3)],off:[...off.slice(i,i+3)]};}
    if(on[i+c]!==repeat[i+c])repeatDifferences++;
   }
   return{peak,example,repeatDifferences,postProcesses:s.activeCamera._postProcesses.filter(Boolean).map(p=>({name:p.name,inputType:p.inputTexture?.texture?.type,outputType:p._outputTexture?.texture?.type}))};
  });h.save('water-current-diagnostic.json',{baseline:'fefe1b3',parameters:require('../lighthouse-d-2026-10-18/source-loader.cjs')('CoastalSky').COASTAL_SKY_DETAILS,acceptance:false,...data});console.log(JSON.stringify(data));
 }finally{await h.browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
