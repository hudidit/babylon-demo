// Independent production hosting; native local driving and original controller/clock updates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {serve}=require('./audio-lab.cjs'),{verifyRelease}=require('./verify-study-release.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LIGHTHOUSE}=load('LighthouseLayout'),site=load('CoastalSite'),vehicle=load('CoastalScooter');
const dist=path.resolve(process.env.AUDIO_GAME_DIST||'dist'),out=path.resolve(process.env.AUDIO_CHECK_OUTPUT||'docs/technical-plans/assets/audio-phase-c-2026-10-24');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function captureNative(){
 self.audioContexts=[];self.outputNodes=[];self.nativeSources=[];
 const Native=AudioContext;self.AudioContext=class extends Native{constructor(...args){super(...args);audioContexts.push(this);}};
 const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){if(args[0]===this.context.destination)outputNodes.push(this);return connect.apply(this,args);};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){nativeSources.push(this);return start.apply(this,args);};
 AudioBufferSourceNode.prototype.stop=function(...args){this.qaStopped=true;return stop.apply(this,args);};
 self.attachMeter=()=>{const ctx=audioContexts[0],meter=ctx.createAnalyser(),zero=ctx.createGain();zero.gain.value=0;meter.fftSize=4096;
  for(const node of new Set(outputNodes.filter(n=>n.context===ctx)))node.connect(meter);meter.connect(zero);zero.connect(ctx.destination);
  self.measure=async(duration=200)=>{const until=performance.now()+duration,a=new Float32Array(4096);let peak=0;
   while(performance.now()<until){meter.getFloatTimeDomainData(a);for(const v of a)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,12));}return peak;};};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=await serve(dist),base='http://127.0.0.1:'+server.address().port+'/';
 const report={baseline:'f1c1a01',acousticListening:false,fpsOrLoadTimeSampling:false,errors:[],warnings:[],firstScreen:[],shorts:[],loops:[],cases:{},
  method:'Unmodified dist. Native clicks/keys for local driving/boarding, map and settings. Grounded start/region pose fixtures. Manual calls to original updateScooter/updateTimeOfDay plus 25Hz soundscape updates. Full route uses generated input flags with the original controller and no in-trip pose changes. Native post-master tap and AudioBufferSourceNode observations; not physical-device listening.'};
 let browser,page,phase='hosting';
 try{
  report.release=verifyRelease(dist);const raw=fs.readFileSync(path.join(dist,'release-manifest.json')),manifest=JSON.parse(raw);report.manifestSha256=sha(raw);
  const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
  for(const prefix of ['', 'audio-lab/'])for(let i=0;i<files.length;i+=16)await Promise.all(files.slice(i,i+16).map(async f=>{
   const r=await fetch(base+prefix+f.path),b=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);
  }));report.hosted={prefixes:['/','/audio-lab/'],filesPerPrefix:files.length};
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(captureNative);
  await context.addInitScript(()=>{if(!localStorage.getItem('qa-legacy')){localStorage.setItem('qa-legacy','1');localStorage.setItem('study-audio-v1',JSON.stringify({enabled:true,volume:.5}));}});
  page=await context.newPage();const cdp=await context.newCDPSession(page),pending=[],requests=[];let initial=true;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
  page.on('response',r=>{requests.push({path:new URL(r.url()).pathname,status:r.status()});if(r.status()>=400)report.errors.push(r.status()+' '+r.url());
   if(initial&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>report.firstScreen.push({path:new URL(r.url()).pathname,bytes:b.length,sha256:sha(b)})));});
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});phase='cold start';
  await page.goto(base,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');await page.waitForLoadState('networkidle');initial=false;await Promise.all(pending);
  report.firstScreenBytes=report.firstScreen.reduce((n,f)=>n+f.bytes,0);assert.ok(report.firstScreenBytes<=require('./study-bundle-analysis.cjs').initialJsBudgetBytes);
  report.beforeGesture=await page.evaluate(async()=>{attachMeter();return{peak:await measure(),sources:nativeSources.length,context:audioContexts[0].state};});
  assert.equal(report.beforeGesture.peak,0);assert.equal(requests.filter(r=>r.path.endsWith('.m4a')).length,0);
  await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  report.legacyGroups=await page.evaluate(()=>room.audio.mix);assert.deepEqual(report.legacyGroups,{actions:1,ambience:.7,ui:1});
  await page.locator('#settings-btn').click();await page.locator('#audio-preview').click();
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;self.voiceEvents=[];self.parameterEvents=[];
   const instrument=(voice,id)=>{const play=voice.play,update=voice.update;voice.play=function(...args){voiceEvents.push({id,rate:args[1],ui:args[3],at:performance.now()});return play.apply(this,args);};
    voice.update=function(...args){parameterEvents.push({id,gain:args[0],rate:args[1],pan:args[2]});return update.apply(this,args);};return voice;};
   for(const [id,voices]of room.audio.voices)for(const voice of voices)instrument(voice,id);
   const factory=room.audio.backend.voice;room.audio.backend.voice=async function(...args){const voice=await factory.apply(this,args);return instrument(voice,args[1].replace(/-0$/,''));};
  });
  phase='all short outputs';console.log(phase);
  const all=load('RoomAudioCatalog').AUDIO_CLIPS;
  for(const clip of all.filter(c=>c.preload!=='world')){
   const output=await page.evaluate(async({id,cue})=>{room.audio.stopAll();await new Promise(r=>setTimeout(r,150));room.audio.previous.set(cue,id.endsWith('-1')?id.slice(0,-1)+'2':id.slice(0,-1)+'1');
    const before=room.audio.diagnostics.played;room.audio.play(cue,'qa-'+id);return{peak:await measure(260),playedDelta:room.audio.diagnostics.played-before};},{id:clip.id,cue:clip.cue});
   assert.ok(output.peak>1e-6&&output.peak<1,clip.id);assert.equal(output.playedDelta,1);report.shorts.push({id:clip.id,...output});
  }
  await page.evaluate(()=>room.audio.stopAll());await page.locator('#settings-close').click();
  await page.locator('[data-view="first-person"]').click();
  const locked=async()=>{await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.waitForTimeout(70);};await locked();
  const sync=(n=1)=>page.evaluate(n=>{for(let i=0;i<n;i++)room.updateSoundscape(.04,true);room.audio.update();},n);
  const frames=(n=2)=>page.evaluate(async n=>{s.render();await new Promise(r=>s.executeWhenReady(r));for(let i=1;i<n;i++)s.render();},n);
  const shot=async name=>{await frames();await page.evaluate(()=>e.runRenderLoop(self.qaShot=()=>s.render()));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87});await page.evaluate(()=>e.stopRenderLoop(qaShot));};
  const pose=(x,y,feet,target)=>page.evaluate(({x,y,feet,target})=>{const c=room.firstPersonCamera,V=c.position.constructor;
   c.position.set((x-5.4)*5,-5+(feet+1.6)*5,(y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
   room.scooter.riding=false;room.scooterTransition=undefined;room.pauseScooter();
   Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.ladder.attached=false;
   room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};
   if(target)c.setTarget(new V(...target));c.getViewMatrix(true);room.updateInteractionHint();},{x,y,feet,target});
  const state=()=>page.evaluate(()=>({scooter:{...room.scooter},audio:room.audio.diagnostics,sound:room.soundscape.diagnostics,pauses:room.pauseReasons}));
  const drive=n=>page.evaluate(n=>{e.getDeltaTime=()=>40;for(let i=0;i<n;i++){room.updateScooter();room.firstPersonCamera.getViewMatrix(true);room.updateSoundscape(.04,true);}e.getDeltaTime=()=>0;room.audio.update();},n);
  phase='native boarding and driving';console.log(phase);
  await page.evaluate(()=>{room.setWeather('clear');room.setTimeAutomatic(false);room.setTimeOfDay(12);});
  const boarding=await page.evaluate(()=>{const p=room.scooterModel.root.position;return{x:(p.x-5.5)/5+5.4,y:p.z/5+5.4,feet:(p.y+5)/5,target:[p.x,p.y+3.5,p.z+1.75]};});
  await pose(boarding.x,boarding.y,boarding.feet,boarding.target);await frames();await page.waitForFunction(()=>room.scooterTarget());
  const beforeMount=await page.evaluate(()=>voiceEvents.filter(e=>e.id.startsWith('scooter-mount')).length);
  await page.keyboard.press('e');await drive(10);assert.equal((await state()).scooter.riding,true);
  assert.equal(await page.evaluate(()=>voiceEvents.filter(e=>e.id.startsWith('scooter-mount')).length),beforeMount+1);
  await page.keyboard.down('w');await drive(25);await page.keyboard.up('w');await sync();await page.evaluate(()=>room.audio.preload());await sync();await page.waitForTimeout(100);
  report.cases.accelerating=await state();assert.ok(report.cases.accelerating.scooter.speed>2);assert.ok(report.cases.accelerating.audio.worldActive>=2);
  const motorStarts=await page.evaluate(()=>voiceEvents.filter(e=>e.id==='motor-loop').length);
  const motorRate=()=>page.evaluate(()=>nativeSources.filter(n=>n.loop&&n.buffer?.length===144000&&!n.qaStopped).at(-1)?.playbackRate.value);
  const lowRate=await motorRate();await page.keyboard.down('w');await drive(22);await page.keyboard.up('w');await page.waitForTimeout(150);
  const highRate=await motorRate();assert.ok(highRate>lowRate);assert.equal(await page.evaluate(()=>voiceEvents.filter(e=>e.id==='motor-loop').length),motorStarts);
  report.cases.continuousRate={lowRate,highRate,motorStarts};
  await drive(10);report.cases.coasting=await state();
  const brakes=await page.evaluate(()=>voiceEvents.filter(e=>e.id.startsWith('scooter-brake')).length);
  await page.keyboard.down('Space');await drive(30);await page.keyboard.up('Space');await page.waitForTimeout(150);
  report.cases.braked=await state();assert.equal(report.cases.braked.scooter.speed,0);
  assert.equal(await page.evaluate(()=>voiceEvents.filter(e=>e.id.startsWith('scooter-brake')).length),brakes+1);
  assert.ok(!report.cases.braked.sound.targets.some(t=>(t.id==='motor-loop'||t.id==='roll-loop')&&t.gain>0));
  await page.keyboard.down('s');await drive(15);await page.keyboard.up('s');report.cases.reverse=await state();assert.ok(report.cases.reverse.scooter.speed<0);
  await page.keyboard.press('m');await sync(60);await page.waitForTimeout(130);report.cases.map=await state();assert.equal(report.cases.map.scooter.speed,0);
  assert.ok(!report.cases.map.sound.targets.some(t=>t.id==='motor-loop'&&t.gain>0));assert.ok(report.cases.map.sound.targets.find(t=>t.id==='sea-open').gain>0);
  await page.locator('#floor-plan-return').click();await locked();
  // Valid supported stop fixture for a successful native dismount, then one blocked driving fixture.
  await page.evaluate(()=>{room.pauseScooter();Object.assign(room.scooter,{...{x:14,y:2.2,heading:Math.PI},speed:0});room.placeRiderCamera();});
  await page.keyboard.press('e');await drive(12);assert.equal((await state()).scooter.riding,false);
  assert.equal(await page.evaluate(()=>voiceEvents.filter(e=>e.id.startsWith('scooter-mount')).length),beforeMount+2);
  report.cases.nativeMountDismount=true;
  // Domain guard failure: callback rejects boarding; the sound count must stay unchanged.
  const rejected=await page.evaluate(()=>{const c=room.firstPersonCamera;c.setTarget(c.position.add(c.getForwardRay().direction.scale(-5)));c.getViewMatrix(true);const before=voiceEvents.filter(e=>e.id.startsWith('scooter-mount')).length;const accepted=room.boardScooter();return{accepted,delta:voiceEvents.filter(e=>e.id.startsWith('scooter-mount')).length-before};});
  assert.equal(rejected.accepted,false);assert.equal(rejected.delta,0);report.cases.rejectedBoarding=rejected;
  phase='route and held-throttle obstacle';console.log(phase);
  const middle=site.coastalRoute().filter(p=>p.y<82&&p.x<13.1).filter(p=>!(p.x>10&&p.y>1));
  const route=[{x:13,y:0},...middle.filter(p=>p.x<12.9||p.y<0),{x:-123.5,y:82.3}];
  report.cases.route=await page.evaluate(async points=>{
   room.pauseScooter();Object.assign(room.scooter,{x:14,y:2.2,heading:Math.PI,riding:true,speed:0,distance:0,steer:0,exitRequested:false});
   room.firstPersonCamera.rotation.y=Math.PI;room.placeRiderCamera();e.getDeltaTime=()=>1000/60;
   let index=0,stuck=0,steps=0;const trace=[];
   for(;steps<7200;steps++){
    const v=room.scooter;let closest=index,d=Infinity;
    for(let j=index;j<Math.min(points.length,index+18);j++){const n=Math.hypot(points[j].x-v.x,points[j].y-v.y);if(n<d){d=n;closest=j;}}index=closest;
    const endDistance=Math.hypot(points.at(-1).x-v.x,points.at(-1).y-v.y);
    if(index>points.length-5&&endDistance<1.1&&Math.abs(v.speed)<.1)break;
    let goal=points[index],j=index;while(j<points.length-1&&Math.hypot(goal.x-v.x,goal.y-v.y)<.8+Math.abs(v.speed)*.22)goal=points[++j];
    const desired=Math.atan2(goal.x-v.x,goal.y-v.y),error=Math.atan2(Math.sin(desired-v.heading),Math.cos(desired-v.heading)),predicted=error-v.steer*.16;
    const brake=Math.abs(error)>=.8||index>points.length-40&&endDistance<v.speed*v.speed/14+.8;
    room.scooterInput={forward:!brake,brake,right:predicted>.06,left:predicted<-.06,back:false};
    const before=v.distance;room.updateScooter();room.updateSoundscape(1/60);
    stuck=room.scooterInput.forward&&v.distance-before<.0001?stuck+1:0;if(stuck>=60)throw new Error('Route blocked at '+index);
    if(steps%120===0){trace.push({x:v.x,y:v.y,speed:v.speed,sound:room.soundscape.diagnostics});await new Promise(r=>setTimeout(r,0));}
   }
   room.pauseScooter();room.updateSoundscape(.04,true);e.getDeltaTime=()=>0;
   return{steps,distance:room.scooter.distance,end:{x:room.scooter.x,y:room.scooter.y},trace};
  },route);
  assert.ok(report.cases.route.steps<7200);assert.ok(report.cases.route.distance>150);
  await page.evaluate(()=>{room.pauseScooter();Object.assign(room.scooter,{x:14,y:0,heading:Math.PI/2,riding:true,speed:0});room.placeRiderCamera();room.firstPersonCamera.rotation.y=Math.PI/2;});
  await page.keyboard.down('w');await drive(120);await page.waitForTimeout(150);report.cases.obstacle=await state();report.cases.obstacle.activeWorld=await page.evaluate(()=>[...room.audio.worldActive.keys()]);assert.ok(!report.cases.obstacle.activeWorld.includes('motor-loop')&&!report.cases.obstacle.activeWorld.includes('roll-loop'));
  assert.equal(report.cases.obstacle.scooter.speed,0);assert.equal(report.cases.obstacle.sound.targets.find(t=>t.id==='motor-loop').gain,0);await page.keyboard.up('w');
  phase='weather and acoustic regions';console.log(phase);report.regions=[];
  for(const kind of ['clear','overcast','fog','storm']){
   await page.evaluate(kind=>room.setWeather(kind),kind);await pose(14,0,0);await sync(150);await page.evaluate(()=>room.audio.preload());await sync(3);await page.waitForTimeout(130);
   const observed=await state();report.regions.push({kind,region:'outside',sound:observed.sound,audio:observed.audio});assert.equal(observed.sound.rain,kind==='storm'?1:0);
  }
  for(const [name,x,y,feet]of [['house',7,5,0],['tower',site.COASTAL_SITE.tower.x,site.COASTAL_SITE.tower.y,LIGHTHOUSE.floor],
    ['lantern',site.COASTAL_SITE.tower.x,site.COASTAL_SITE.tower.y,LIGHTHOUSE.gallery],['gallery',site.COASTAL_SITE.tower.x+2.6,site.COASTAL_SITE.tower.y,LIGHTHOUSE.gallery],['solar',site.COASTAL_SITE.tower.x+4.8,site.COASTAL_SITE.tower.y+5.8,site.COASTAL_SITE.tower.ground+.04]]){
   await pose(x,y,feet);await sync(160);await page.evaluate(()=>room.audio.preload());await sync(3);await page.waitForTimeout(130);
   const observed=await state();assert.equal(observed.sound.region,name==='solar'?'outside':name);report.regions.push({kind:'storm',region:name,sound:observed.sound,audio:observed.audio});
   if(name==='house')assert.ok(observed.sound.targets.find(t=>t.id==='rain-open').gain<.01);
   if(name==='gallery')assert.ok(observed.sound.exposure>.8);
  }
  // Real audio-clock transition in addition to the fixed-step region matrix.
  await pose(14,0,0);await sync(160);await pose(7,5,0);
  report.cases.liveShelterFade=await page.evaluate(async()=>{const trace=[];
   for(let i=0;i<45;i++){room.updateSoundscape(.04,true);trace.push(room.soundscape.diagnostics.targets.map(t=>({id:t.id,gain:t.gain})));await new Promise(r=>setTimeout(r,40));}
   return{trace,peak:await measure(250),audio:room.audio.diagnostics};});
  const live=report.cases.liveShelterFade.trace;assert.ok(live.at(-1).find(t=>t.id==='rain-open').gain<.01);
  assert.ok(live.at(-1).find(t=>t.id==='rain-sheltered').gain>0);assert.ok(report.cases.liveShelterFade.peak>1e-6);
  await pose(site.COASTAL_SITE.tower.x+4.8,site.COASTAL_SITE.tower.y+5.8,site.COASTAL_SITE.tower.ground+.04);await sync(150);
  await shot('storm-solar');
  phase='world output and two-cycle soak';console.log(phase);
  await page.evaluate(()=>{room.soundscape.reset();room.soundscapeElapsed=0;});
  for(const clip of all.filter(c=>c.preload==='world')){
   await page.evaluate(async id=>{room.audio.resetWorld();await new Promise(r=>setTimeout(r,150));room.audio.world([{id,gain:.25}]);await room.audio.preload();room.audio.world([{id,gain:.25}]);},clip.id);
   await page.waitForTimeout(100);const output=await page.evaluate(async()=>({peak:await measure(500),world:room.audio.diagnostics.worldActive}));
   assert.ok(output.peak>1e-6&&output.peak<1,clip.id);assert.equal(output.world,1);report.loops.push({id:clip.id,...output});
  }
  await page.evaluate(async()=>{room.audio.resetWorld();await new Promise(r=>setTimeout(r,150));room.audio.world(['motor-loop','roll-loop','wind-open','wind-sheltered','rain-open','rain-sheltered','sea-open','sea-sheltered'].map(id=>({id,gain:.08})));});
  const startCount=await page.evaluate(()=>voiceEvents.length),soakPeak=await page.evaluate(()=>measure(16500));
  const afterSoak=await page.evaluate(()=>({diagnostics:room.audio.diagnostics,events:voiceEvents.length,
   buffers:nativeSources.filter(n=>n.loop&&n.buffer?.duration>=2).map(n=>{const b=n.buffer;let zeros=0;
    for(let i=0;i<b.length;i+=4800){let peak=0;for(let j=i;j<Math.min(i+4800,b.length);j++)peak=Math.max(peak,Math.abs(b.getChannelData(0)[j]));if(peak<1e-8)zeros++;}
    const data=b.getChannelData(0);return{frames:b.length,channels:b.numberOfChannels,duration:b.duration,zero100msWindows:zeros,boundaryStep:Math.abs(data[0]-data.at(-1))};})}));
  assert.equal(afterSoak.diagnostics.worldActive,8);assert.equal(afterSoak.events,startCount);assert.ok(soakPeak>1e-6&&soakPeak<1);
  assert.ok(afterSoak.buffers.every(b=>b.zero100msWindows===0));assert.ok(afterSoak.diagnostics.decodedBytes<=16*1048576);
  report.cases.soak={seconds:16.5,peak:soakPeak,...afterSoak};
  phase='groups, settings, Inspector and lifecycle';console.log(phase);
  await page.evaluate(()=>{room.soundscape.reset();room.setPaused('external',false);});await page.keyboard.press('Escape');
  await page.locator('#settings-btn').click();await page.waitForTimeout(160);
  assert.equal(await page.evaluate(()=>measure()),0);
  await page.locator('#audio-ambience-volume').focus();await page.keyboard.press('Home');
  await page.locator('#settings-close').click();await page.locator('[data-view="coast"]').click();await sync(120);await page.waitForTimeout(160);
  const noEnvironment=await page.evaluate(()=>measure());assert.equal(noEnvironment,0);
  const physicalPeak=await page.evaluate(async()=>{room.audio.play('switch','qa-physical-lamp');return await measure(240);});assert.ok(physicalPeak>1e-6);
  report.cases.environmentMute={peak:noEnvironment,physicalPeak};await page.locator('#settings-btn').click();
  await page.locator('#audio-ambience-volume').focus();await page.keyboard.press('End');
  await page.locator('#audio-actions-volume').focus();await page.keyboard.press('Home');await page.locator('#audio-preview').click();
  assert.ok(await page.evaluate(()=>measure())>1e-6,'UI preview survives actions at zero');
  await page.locator('#audio-ui-volume').focus();await page.keyboard.press('Home');await page.waitForTimeout(200);await page.locator('#audio-preview').click();assert.equal(await page.evaluate(()=>measure()),0);
  await page.locator('#audio-actions-volume').focus();await page.keyboard.press('End');
  for(const [width,height]of [[1280,800],[390,844],[844,390]]){await page.setViewportSize({width,height});
   const shape=await page.locator('#settings-menu').evaluate(n=>{const r=n.getBoundingClientRect();return{within:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:n.scrollWidth>n.clientWidth+1};});
   assert.equal(shape.within,true);assert.equal(shape.overflow,false);if(width===390)await shot('settings-portrait');}
  await page.setViewportSize({width:1280,height:800});await shot('settings-desktop');
  report.cases.savedGroups=await page.evaluate(()=>JSON.parse(localStorage.getItem('study-audio-v1')));assert.equal(report.cases.savedGroups.groups.ui,0);
  await page.locator('#settings-close').click();await page.locator('[data-view="coast"]').click();await sync(100);
  await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});await page.waitForTimeout(160);
  assert.equal(await page.evaluate(()=>measure()),0);await page.evaluate(()=>s.debugLayer.hide());await frames();
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));});await page.waitForTimeout(150);
  report.cases.blur=await page.evaluate(async()=>({audio:room.audio.diagnostics,frozenAnalyserPeak:await measure(),unstoppedLoops:nativeSources.filter(n=>n.loop&&!n.qaStopped).length}));assert.equal(report.cases.blur.audio.context,'suspended');assert.equal(report.cases.blur.unstoppedLoops,0);assert.equal(report.cases.blur.audio.active,0);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));});await page.locator('[data-view="coast"]').click();await page.waitForFunction(()=>room.audio.diagnostics.context==='running');await sync(120);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>measure())>1e-6);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(150);report.cases.hidden=await page.evaluate(async()=>({audio:room.audio.diagnostics,frozenAnalyserPeak:await measure(),unstoppedLoops:nativeSources.filter(n=>n.loop&&!n.qaStopped).length}));
  assert.equal(report.cases.hidden.audio.active,0);assert.equal(report.cases.hidden.audio.context,'suspended');assert.equal(report.cases.hidden.unstoppedLoops,0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;e.stopRenderLoop();});
  await page.locator('[data-view="coast"]').click();await page.waitForFunction(()=>room.audio.diagnostics.context==='running');await sync(120);
  // A complete session replacement clears loops; the next accepted snapshot recreates only current weather/position.
  report.cases.sessionReset=await page.evaluate(()=>{room.setLighthouseSessionMode('duty');return{audio:room.audio.diagnostics,region:room.soundscape.diagnostics};});
  await sync(160);await page.waitForTimeout(130);assert.equal((await state()).sound.rain,0);
  await page.evaluate(()=>room.dispose());assert.equal(await page.evaluate(()=>room.audio.diagnostics.context),'closed');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready',null,{timeout:120000});
  assert.equal(await page.locator('#audio-ui-volume').inputValue(),'0');report.cases.groupReload=true;
  await page.locator('#settings-btn').click();await page.locator('#audio-enabled').uncheck();await page.reload();
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  report.cases.mutedReload=await page.evaluate(()=>({contexts:audioContexts.length,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/audio/')&&/\.(wav|m4a)$/.test(r.name)).length}));
  assert.deepEqual(report.cases.mutedReload,{contexts:0,requests:0});
  phase='missing world file';
  const failureContext=await browser.newContext(),failure=await failureContext.newPage();let missingRequests=0;
  const missing=all.find(c=>c.id==='wind-open');await failure.route('**/'+missing.file,route=>{missingRequests++;return route.fulfill({status:404,body:'controlled missing wind'});});
  await failure.goto(base+'audio-lab/');await failure.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await failure.locator('#settings-btn').click();await failure.locator('#audio-preview').click();await failure.locator('#settings-close').click();
  await failure.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='partial');await failure.waitForTimeout(2000);
  await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(failure,await failureContext.newCDPSession(failure));
  report.cases.missingWind=await failure.evaluate(()=>room.audio.diagnostics);report.cases.missingWind.requests=missingRequests;assert.equal(missingRequests,2);assert.deepEqual(report.cases.missingWind.failedFiles,['wind-open']);
  assert.ok(report.cases.missingWind.worldActive>0);await failureContext.close();assert.deepEqual(report.errors,[]);
  report.passed=true;report.requests=requests;await context.close();
 }catch(error){report.failurePhase=phase;report.error=error.stack;report.debug=await page?.evaluate(()=>self.room?{view:room.currentView,pauses:room.pauseReasons,scooter:room.scooter,sound:room.soundscape.diagnostics,audio:room.audio.diagnostics}:null).catch(()=>null);throw error;}
 finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
 console.log(JSON.stringify({passed:report.passed,firstScreenBytes:report.firstScreenBytes,shorts:report.shorts.length,loops:report.loops.length,errors:report.errors.length,warnings:report.warnings.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
