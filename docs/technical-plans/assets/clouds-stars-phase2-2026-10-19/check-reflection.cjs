// Compile the exact shared source in a temporary diagnostic material, then test actual production water.
const assert=require('node:assert/strict');
const fixture=require('./browser-fixture.cjs');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const sky=load('CoastalSky');
const fragment=`#extension GL_OES_standard_derivatives : enable
precision highp float;
${sky.coastalSkyGLSL}
${sky.coastalSkyCloudsGLSL}
${sky.coastalSkyReflectionGLSL}
${sky.coastalSkyDetailsGLSL}
uniform vec3 probeDirection;uniform float probeMode,probeFilter,probeRoughness;
void main(){vec3 d=normalize(probeDirection),normal,color;
 if(probeMode<.5)color=vec3(coastalCloudDensity(d,probeFilter,normal));
 else if(probeMode<1.5)color=coastalSkyGradient(d);
 else if(probeMode<2.5)color=coastalSkyReflection(d,probeFilter,probeRoughness);
 else if(probeMode<3.5)color=coastalSkyRadiance(d);
 else color=vec3(coastalStarVisibility(d));
 gl_FragColor=vec4(color,1.);}`;
(async()=>{
 const h=await fixture.start(),{page}=h,record={baseline:'fefe1b3',fpsOrLoadTimeSampling:false,browser:h.browser.version(),
   method:'Temporary diagnostic material uses exact source hashes; no served application code changes. Production water probes change and restore existing uniforms only.'};
 try{
  await page.locator('[data-view="balcony"]').click();await h.select(12);await h.skyPose();
  await page.evaluate(({fragment,uniforms})=>{
   self.dome=s.getMeshByName('coastal-sky');self.originalSky=dome.material;self.originalMasks=[dome.layerMask,s.activeCamera.layerMask];
   self.probe=new originalSky.constructor('clouds-stars-diagnostic',s,{vertexSource:'precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;void main(){gl_Position=worldViewProjection*vec4(position,1.);}',fragmentSource:fragment},
    {attributes:['position'],uniforms:['worldViewProjection',...uniforms,'probeDirection','probeMode','probeFilter','probeRoughness']});
   for(const[name,value]of Object.entries(originalSky._floats))probe.setFloat(name,value);
   for(const[name,value]of Object.entries(originalSky._vectors3))probe.setVector3(name,value.clone());
   probe.setFloat('probeMode',0);probe.setFloat('probeFilter',0);probe.setFloat('probeRoughness',0);probe.setVector3('probeDirection',originalSky._vectors3.sunDirection.clone());
   dome.material=probe;dome.layerMask=s.activeCamera.layerMask=0x20000000;
  },{fragment,uniforms:sky.skyTimeUniforms});await h.render();
  const sample=async(mode,direction,filter=0,rough=0)=>page.evaluate(async({mode,direction,filter,rough})=>{
   probe.setFloat('probeMode',mode);probe.setFloat('probeFilter',filter);probe.setFloat('probeRoughness',rough);
   const V=s.activeCamera.position.constructor;probe.setVector3('probeDirection',new V(...direction));s.render();return [...new Uint8Array(await e.readPixels(640,400,1,1))].slice(0,3);
  },{mode,direction,filter,rough});
  const dirs=[];for(let y=0;y<6;y++)for(let x=0;x<16;x++){const up=(y+.5)/6,a=x/16*Math.PI*2;dirs.push([Math.sqrt(1-up*up)*Math.sin(a),up,Math.sqrt(1-up*up)*Math.cos(a)]);}
  record.filter=[];
  for(const filter of [0,.04,.1156,.65]){const pixels=[];for(const d of dirs)pixels.push((await sample(0,d,filter))[0]);
   let variation=0;for(let y=0;y<6;y++)for(let x=0;x<16;x++)variation+=Math.abs(pixels[y*16+x]-pixels[y*16+(x+1)%16]);
   record.filter.push({angle:filter,mean:pixels.reduce((a,b)=>a+b,0)/pixels.length,variation,pixels});}
  assert.ok(record.filter.at(-1).variation<record.filter[0].variation*.15,'large footprints must converge to diffuse coverage');
  assert.ok(record.filter[2].variation<record.filter[0].variation,'rough reflection must have less angular detail');
  const d=[.4,.5,.768];record.gradientBefore=await sample(1,d);
  await page.evaluate(()=>{const V=s.activeCamera.position.constructor;probe.setVector3('skyCloudLight',new V(5,0,0));probe.setVector3('skyCloudShade',new V(0,5,0));probe.setFloat('skyStarVisibility',1);probe.setFloat('sunStrength',10);});
  record.gradientAfter=await sample(1,d);assert.deepEqual(record.gradientBefore,record.gradientAfter,'sea haze gradient is independent of clouds/stars/disks');
  const body=await page.evaluate(()=>originalSky._vectors3.sunDirection.asArray());record.reflectionWithBody=await sample(2,body,.01,.2);
  await page.evaluate(()=>{probe.setFloat('sunStrength',0);});record.reflectionWithoutBody=await sample(2,body,.01,.2);
  assert.deepEqual(record.reflectionWithBody,record.reflectionWithoutBody,'reflection cannot add a second celestial disk');
  await page.evaluate(()=>{for(const[name,value]of Object.entries(originalSky._floats))probe.setFloat(name,value);for(const[name,value]of Object.entries(originalSky._vectors3))probe.setVector3(name,value.clone());probe.setFloat('skyStarVisibility',0);probe.setFloat('sunStrength',0);});
  record.unfiltered=[];
  for(const d of dirs.slice(0,16)){const reflection=await sample(2,d),background=await sample(3,d);assert.deepEqual(reflection,background);record.unfiltered.push({d,reflection,background});}
  // Probe the real night visibility factors independently of cloud occlusion and pixel placement.
  const night=load('RoomTimeOfDay').evaluateTimeOfDay(0);
  await page.evaluate(state=>{probe.setFloat('skyStarVisibility',state.sky.starVisibility);probe.setVector3('skyMoonDirection',new (s.activeCamera.position.constructor)(...state.moon.sourceDirection));probe.setFloat('skyMoonVisibility',1);},night);
  record.moonFade=[];
  for(const angle of [0,1,3,6,10,14,18]){const a=angle*Math.PI/180,m=night.moon.sourceDirection,d=[m[0]*Math.cos(a)+Math.sin(a),m[1]*Math.cos(a),m[2]*Math.cos(a)];record.moonFade.push({angle,color:await sample(4,d)});}
  assert.equal(record.moonFade[0].color[0],0);assert.ok(record.moonFade.at(-1).color[0]>100);
  for(let i=1;i<record.moonFade.length;i++)assert.ok(record.moonFade[i].color[0]>=record.moonFade[i-1].color[0]);
  record.horizonFade=[];
  for(const up of [-.1,0,.035,.06,.1,.15,.2,.4])record.horizonFade.push({up,color:await sample(4,[0,up,-Math.sqrt(1-up*up)])});
  assert.equal(record.horizonFade[0].color[0],0);assert.equal(record.horizonFade[2].color[0],0);assert.ok(record.horizonFade.at(-1).color[0]>100);
  await page.evaluate(()=>{dome.material=originalSky;dome.layerMask=originalMasks[0];s.activeCamera.layerMask=originalMasks[1];probe.dispose();});
  await h.select(12);await h.pose(20,55,-23,20,95,-28);await h.shot('sea-noon-cloud-reflection');
  record.seaClouds=await page.evaluate(async()=>{
   const sea=s.getMaterialByName('coastal-ocean'),light=sea._vectors3.skyCloudLight.clone(),shade=sea._vectors3.skyCloudShade.clone(),V=light.constructor;
   const read=async()=>{s.render();return new Uint8Array(await e.readPixels(320,180,640,280));};
   const before=await read();sea.setVector3('skyCloudLight',new V(0,0,0));sea.setVector3('skyCloudShade',new V(0,0,0));const dark=await read();
   sea.setVector3('skyCloudLight',light);sea.setVector3('skyCloudShade',shade);const repeat=await read();
   let changed=0,peak=0,repeatDiff=0;for(let i=0;i<before.length;i+=4){let delta=0;for(let c=0;c<3;c++){delta+=Math.abs(before[i+c]-dark[i+c]);if(before[i+c]!==repeat[i+c])repeatDiff++;}if(delta>=3)changed++;peak=Math.max(peak,delta);}
   return{changedPixels:changed,peakChannelDelta:peak,repeatDifferences:repeatDiff};
  });assert.ok(record.seaClouds.changedPixels>100,'real water must reflect the cloud colour');assert.equal(record.seaClouds.repeatDifferences,0);
  await h.select(0);await h.shot('sea-midnight-filtered-stars');
  record.seaStars=await page.evaluate(async()=>{
   const sea=s.getMaterialByName('coastal-ocean'),weight=sea._floats.skyStarVisibility;
   const read=async()=>{s.render();return new Uint8Array(await e.readPixels(320,180,640,280));};
   const before=await read();sea.setFloat('skyStarVisibility',0);const dark=await read();sea.setFloat('skyStarVisibility',weight);
   let changed=0,peak=0,peakChannel=0,total=0;for(let i=0;i<before.length;i+=4){let delta=0;for(let c=0;c<3;c++){const v=Math.abs(before[i+c]-dark[i+c]);delta+=v;peakChannel=Math.max(peakChannel,v);}if(delta)changed++;peak=Math.max(peak,delta);total+=delta;}
   return{changedPixels:changed,peakRgbSum:peak,peakChannelDelta:peakChannel,totalChannelDelta:total};
  });assert.ok(record.seaStars.peakChannelDelta<=5,'rough-water starlight stays within 5/255 per channel, far below a bright point');
  for(const hour of [0,3,6,9,12,15,18,21]){await h.select(hour);for(const[name,a,el]of [['north',0,45],['east',90,45],['south',180,45],['west',270,45],['zenith',0,89.9]]){await h.skyPose(a,el);await h.shot(`${String(hour).padStart(2,'0')}-${name}`);}}
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.requests.filter(r=>r.status>=400),[]);record.passed=true;
 }finally{Object.assign(record,{errors:h.errors,warnings:h.warnings});h.save('reflection.json',record);await h.browser.close();}
 console.log(JSON.stringify({passed:record.passed,seaClouds:record.seaClouds,seaStars:record.seaStars,errors:h.errors,warnings:h.warnings}));
})().catch(error=>{console.error(error);process.exitCode=1;});
