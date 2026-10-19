// Match GPU-detected star centroids in world directions across reference pan/zoom frames and DPRs.
const assert=require('node:assert/strict'),fixture=require('./browser-fixture.cjs');
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((n,v,i)=>n+v*b[i],0))));
function match(a,b){
 const used=new Set(),pairs=[];
 for(const p of a){let best=-1,distance=.0025;for(let j=0;j<b.length;j++){if(used.has(j))continue;const d=angle(p.direction,b[j].direction);if(d<distance){best=j;distance=d;}}
  if(best>=0){used.add(best);pairs.push({angle:distance,fluxRatio:b[best].flux/p.flux});}}
 return{matched:pairs.length,source:a.length,target:b.length,ratio:pairs.length/Math.min(a.length,b.length),maxAngle:Math.max(0,...pairs.map(p=>p.angle)),
  maxFluxRatio:Math.max(0,...pairs.map(p=>p.fluxRatio)),minFluxRatio:Math.min(...pairs.map(p=>p.fluxRatio))};
}
async function stars(page){return page.evaluate(async()=>{
 const sky=s.getMaterialByName('coastal-sky'),weight=sky._floats.skyStarVisibility,W=e.getRenderWidth(),H=e.getRenderHeight();
 const read=async()=>{s.render();return new Uint8Array(await e.readPixels(0,0,W,H));};
 const before=await read();sky.setFloat('skyStarVisibility',0);const dark=await read();sky.setFloat('skyStarVisibility',weight);
 const signal=new Float32Array(W*H),visited=new Uint8Array(W*H),points=[];
 for(let i=0;i<signal.length;i++){const k=i*4;signal[i]=Math.max(0,before[k]-dark[k])+Math.max(0,before[k+1]-dark[k+1])+Math.max(0,before[k+2]-dark[k+2]);}
 const camera=s.activeCamera,V=camera.position.constructor,M=camera.getViewMatrix().constructor,margin=20*devicePixelRatio;
 for(let i=0;i<signal.length;i++){
  if(visited[i]||signal[i]<3)continue;const queue=[i];visited[i]=1;let flux=0,sx=0,sy=0,peak=0;
  for(let k=0;k<queue.length;k++){const at=queue[k],x=at%W,y=Math.floor(at/W),v=signal[at];flux+=v;sx+=(x+.5)*v;sy+=(y+.5)*v;peak=Math.max(peak,v);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*W+xx;if(xx<0||xx>=W||yy<0||yy>=H||visited[j]||signal[j]<3)continue;visited[j]=1;queue.push(j);}}
  const x=sx/flux,y=sy/flux;if(peak<12||flux<20||x<margin||x>W-margin||y<margin||y>H-margin)continue;
  const p=V.Unproject(new V(x,H-y,1),W,H,M.Identity(),camera.getViewMatrix(),camera.getProjectionMatrix());
  points.push({x:x/devicePixelRatio,y:y/devicePixelRatio,peak,area:queue.length,flux:flux*Math.pow(2*Math.tan(camera.fov/2)/H,2),direction:p.subtract(camera.globalPosition).normalize().asArray()});
 }
 return{width:W,height:H,fov:camera.fov,points};
 });}
(async()=>{
 const record={baseline:'fefe1b3',fpsOrLoadTimeSampling:false,physicalDevicesTested:false,method:'13 reference pan/zoom frames, each with actual-star minus zero-star GPU pixels. Centroids are unprojected into world directions; flux is normalised by angular pixel area.',cases:[],dprMatches:[]};
 try{for(const kind of ['chromium','webkit']){
  const byViewport=new Map();
  for(const dpr of [1,2]){
   const h=await fixture.start({kind,dpr}),{page}=h;
   try{for(const[width,height,name]of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]){
    await page.setViewportSize({width,height});await page.locator('[data-view="balcony"]').click();const nodes=[];
    for(const hour of [0,3,6,9,12,15,18,21]){await h.select(hour);const value=await page.evaluate(()=>({hour:s.metadata.timeOfDay.state.hour,stars:s.getMaterialByName('coastal-sky')._floats.skyStarVisibility,
      seaStars:s.getMaterialByName('coastal-ocean')._floats.skyStarVisibility,resources:[s.meshes.length,s.materials.length,s.textures.length,s.lights.length,s.cameras.length],
      skyReady:s.getMeshByName('coastal-sky').isReady(true),seaReady:s.getMeshByName('coastal-sea').isReady(true),webgl:e.webGLVersion}));
     assert.equal(value.hour,hour);assert.equal(value.stars,value.seaStars);assert.ok(value.skyReady&&value.seaReady);assert.deepEqual(value.resources,[670,95,148,17,3]);nodes.push(value);}
    await h.select(0);const frames=[],matches=[];
    for(let i=0;i<=12;i++){
     const a=40+i*.025,el=55+.03*Math.sin(i*Math.PI/12),fov=.8-.1*Math.sin(i*Math.PI/12);
     await h.skyPose(a,el,fov);const sample=await stars(page);assert.ok(sample.points.length>=5,`${kind}/${name}/DPR${dpr}: too few visible stars`);
     frames.push({frame:i,azimuth:a,elevation:el,...sample});
     if(i){const m=match(frames[i-1].points,sample.points);assert.ok(m.ratio>=.80,JSON.stringify({kind,name,dpr,frame:i,...m}));assert.ok(m.maxFluxRatio<1.8&&m.minFluxRatio>.5,JSON.stringify({kind,name,dpr,frame:i,...m}));matches.push(m);}
     if(i===0||i===6||i===12)await h.shot(`${kind}-${name}-dpr${dpr}-motion-${String(i).padStart(2,'0')}`);
    }
    if(dpr===1)byViewport.set(name,frames[0].points);else{const m=match(byViewport.get(name),frames[0].points);assert.ok(m.ratio>=.80);assert.ok(m.maxFluxRatio<1.8&&m.minFluxRatio>.5,JSON.stringify(m));record.dprMatches.push({kind,name,...m});}
    assert.deepEqual(h.errors,[]);assert.deepEqual(h.requests.filter(r=>r.status>=400),[]);
    record.cases.push({kind,version:h.browser.version(),dpr,viewport:{width,height},name,nodes,frames,matches,errors:[...h.errors],warnings:[...h.warnings],passed:true});
   }}finally{await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>s.meshes.length),0);await h.browser.close();}
  }
 }record.passed=true;}finally{require('node:fs').writeFileSync(require('node:path').join(fixture.out,'stability.json'),JSON.stringify(record,null,2)+'\n');}
 console.log(JSON.stringify({passed:record.passed,cases:record.cases.length,nodeChecks:record.cases.reduce((n,c)=>n+c.nodes.length,0),referenceFrames:record.cases.reduce((n,c)=>n+c.frames.length,0),dprMatches:record.dprMatches}));
})().catch(error=>{console.error(error);process.exitCode=1;});
