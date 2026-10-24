// Unmodified production bundles; actual controller and native input; output is not human listening.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {serve}=require('./audio-lab.cjs'),{verifyRelease}=require('./verify-study-release.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LIGHTHOUSE}=load('LighthouseLayout'),{COASTAL_SITE:{tower}}=load('CoastalSite');
const dist=path.resolve(process.env.AUDIO_GAME_DIST||'dist'),out=path.resolve(process.env.AUDIO_CHECK_OUTPUT||'docs/technical-plans/assets/audio-phase-d-2026-10-24');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function nativeProbe(){
 self.audioContexts=[];self.outputs=[];self.sources=[];
 const Native=AudioContext;self.AudioContext=class extends Native{constructor(...a){super(...a);audioContexts.push(this);}};
 const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...a){if(a[0]===this.context.destination)outputs.push(this);return connect.apply(this,a);};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...a){sources.push(this);return start.apply(this,a);};
 AudioBufferSourceNode.prototype.stop=function(...a){this.qaStopped=true;return stop.apply(this,a);};
 self.meter=()=>{const ctx=audioContexts[0],analyser=ctx.createAnalyser(),zero=ctx.createGain();zero.gain.value=0;analyser.fftSize=4096;
  for(const node of new Set(outputs.filter(n=>n.context===ctx)))node.connect(analyser);analyser.connect(zero);zero.connect(ctx.destination);
  self.measure=async(ms=180)=>{const data=new Float32Array(4096);let peak=0,until=performance.now()+ms;while(performance.now()<until){analyser.getFloatTimeDomainData(data);for(const x of data)peak=Math.max(peak,Math.abs(x));await new Promise(r=>setTimeout(r,10));}return peak;};};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=await serve(dist),base='http://127.0.0.1:'+server.address().port+'/';let browser,page,phase='hosting';
 const report={baseline:process.env.AUDIO_BASELINE||'cd57fc1',acousticListening:false,fpsOrLoadTimeSampling:false,errors:[],warnings:[],firstScreen:[],outputs:[],cases:{},
  method:'Only dist served, unchanged bundles. Native keyboard/clicks with original scene render/collision/jump/ladder controllers. Legal starting poses isolate surfaces, no in-path pose changes. Fixed accepted frame deltas, not a travel-time or FPS benchmark. Individual prepared voices tested explicitly, then real cue routing checked separately. Native post-master analysis is engineering evidence, not human listening.'};
 try{
  report.release=verifyRelease(dist);const raw=fs.readFileSync(path.join(dist,'release-manifest.json'));report.manifestSha256=sha(raw);
  const files=[...JSON.parse(raw).files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
  for(const prefix of ['','audio-lab/'])for(let i=0;i<files.length;i+=16)await Promise.all(files.slice(i,i+16).map(async f=>{
   const res=await fetch(base+prefix+f.path),b=Buffer.from(await res.arrayBuffer());assert.equal(res.status,200);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);
  }));report.hosted={prefixes:['/','/audio-lab/'],files:files.length};
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});await context.addInitScript(nativeProbe);
  page=await context.newPage();const cdp=await context.newCDPSession(page),pending=[];let initial=true;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());if(initial&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(b=>report.firstScreen.push({path:new URL(r.url()).pathname,bytes:b.length,sha256:sha(b)})));});
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});phase='cold start';
  await page.goto(base,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');await page.waitForLoadState('networkidle');initial=false;await Promise.all(pending);
  report.firstScreenBytes=report.firstScreen.reduce((n,f)=>n+f.bytes,0);assert.ok(report.firstScreenBytes<=require('./study-bundle-analysis.cjs').initialJsBudgetBytes);
  report.beforeGesture=await page.evaluate(async()=>{meter();return {sources:sources.length,peak:await measure(),worldRequests:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.m4a')).length};});
  assert.equal(report.beforeGesture.peak,0);assert.equal(report.beforeGesture.worldRequests,0);
  await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
  await page.locator('#settings-btn').click();await page.locator('#audio-preview').click();
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;e.getFps=()=>60;self.events=[];
   const wrap=(v,id)=>{const play=v.play,stop=v.stop;v.play=function(...a){events.push({type:'play',id,position:a[2],at:performance.now()});return play.apply(this,a);};v.stop=function(...a){events.push({type:'stop',id,at:performance.now()});return stop.apply(this,a);};return v;};
   for(const [id,voices]of room.audio.voices)for(const v of voices)wrap(v,id);
   const factory=room.audio.backend.voice;room.audio.backend.voice=async function(...a){return wrap(await factory.apply(this,a),a[1].replace(/-\d$/,''));};
  });
  const all=load('RoomAudioCatalog').AUDIO_CLIPS;
  phase='every delivered buffer';console.log(phase);
  for(const clip of all){
   const result=await page.evaluate(async clip=>{room.audio.stopAll();await new Promise(r=>setTimeout(r,80));
    if(clip.preload==='world'){room.audio.world([{id:clip.id,gain:.1}]);await room.audio.preload();room.audio.world([]);await new Promise(r=>setTimeout(r,80));}
    const v=room.audio.voices.get(clip.id)?.[0];if(!v)throw Error('Missing '+clip.id);v.play(clip.preload==='world'?.1:clip.gain,1);
    const peak=await measure(170);v.stop(false);return {peak,ready:room.audio.diagnostics.readyFiles};},clip);
   assert.ok(result.peak>1e-6&&result.peak<1,clip.id);report.outputs.push({id:clip.id,...result});
  }
  report.decodedBytes=await page.evaluate(()=>room.audio.diagnostics.decodedBytes);assert.equal(report.decodedBytes,require('./study-audio-resources.cjs').validateAudioResources(dist).decodedBytes);
  await page.evaluate(()=>{room.audio.stopAll();room.audio.setMix({actions:1,ambience:0,ui:1});room.setWeather('clear');room.setTimeAutomatic(false);room.setTimeOfDay(12);});
  await page.locator('#settings-close').click();await page.locator('[data-view="first-person"]').click();
  const locked=async()=>{await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);};await locked();
  const tick=(n=1,dt=1/60)=>page.evaluate(async({n,dt})=>{e.getDeltaTime=()=>dt*1000;for(let i=0;i<n;i++){s.render();await new Promise(r=>setTimeout(r,dt*1000));}e.getDeltaTime=()=>0;},{n,dt});
  const pose=(x,y,feet,dx=0,dy=1)=>page.evaluate(({x,y,feet,dx,dy})=>{const c=room.firstPersonCamera,V=c.position.constructor;
   room.dailyAudio.reset();room.soundscape.reset();room.scooter.riding=false;room.scooterTransition=undefined;room.pauseScooter();room.ladder.attached=false;room.ladderTransition=undefined;
   c.position.set((x-5.4)*5,-5+(feet+1.6)*5,(y-5.4)*5);c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();
   Object.assign(room.jump,{feet,grounded:true,velocity:0,queued:false,originTop:feet});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet};
   c.setTarget(c.position.add(new V(dx*5,0,dy*5)));c.getViewMatrix(true);room.updateControls();room.updateInteractionHint();room.updateFloorPlan();},{x,y,feet,dx,dy});
  const contacts=()=>page.evaluate(()=>events.filter(e=>e.type==='play'&&/^(footstep|landing|ladder-rung)/.test(e.id)));
  const clear=()=>page.evaluate(()=>{events.length=0;});
  const position=()=>page.evaluate(()=>({x:room.firstPersonCamera.position.x/5+5.4,y:room.firstPersonCamera.position.z/5+5.4,feet:room.jump.feet}));
  phase='native supported walking and landing';console.log(phase);
  const walkCases=[{name:'wood',x:6.05,y:3.04,feet:0,dx:1,dy:0},{name:'soft',x:6.05,y:2.6,feet:0,dx:1,dy:0},
   {name:'metal',x:tower.x-.65,y:tower.y-1.12,feet:LIGHTHOUSE.gallery,dx:1,dy:0}];
  const walking=load('WalkingSurface');for(const kind of ['terrain','platform']){
   const center=kind==='terrain'?{x:14,y:2}:{x:tower.x+4.5,y:tower.y-5};let found;
   for(let x=center.x-1;x<=center.x+1&&!found;x+=.25)for(let y=center.y-1;y<=center.y+1;y+=.25){const surface=walking.walkingSurfaceAt(x,y);
    if(surface?.kind===kind&&walking.walkingPointAllowed({x,y},.26,surface.height)){found={name:kind==='terrain'?'earth':'hard',x,y,feet:surface.height,dx:1,dy:0};break;}}
   assert.ok(found,'legal '+kind+' fixture');walkCases.push(found);
  }
  for(const c of walkCases){
   await pose(c.x,c.y,c.feet,c.dx,c.dy);await tick(2);await clear();const before=await position();await page.keyboard.down('w');await tick(64);await page.keyboard.up('w');await tick(6);
   const after=await position(),played=await contacts();report.cases['walk-'+c.name]={before,after,played};assert.ok(Math.hypot(before.x-c.x,before.y-c.y)<.1,c.name+' fixture must remain at legal start');assert.ok(played.some(e=>e.id.startsWith('footstep-'+c.name)),c.name+' contact missing');
   assert.ok(Math.hypot(before.x-after.x,before.y-after.y)>.6,c.name+' actual movement');report.cases['walk-'+c.name]={before,after,played};
   // A native jump from the final actual position, then settle. No position fixture during the jump.
   await clear();await page.keyboard.press('Space');await tick(65);const jumping=await contacts();
   assert.equal(jumping.filter(e=>e.id.startsWith('landing-')).length,1,c.name+' one landing');
   assert.equal(jumping.filter(e=>e.id.startsWith('footstep-')).length,0,c.name+' no air steps');report.cases['jump-'+c.name]={played:jumping,after:await position()};
  }
  phase='native riding excludes feet';console.log(phase);
  const car=await page.evaluate(()=>{const p=room.scooterModel.root.position;return{x:(p.x-5.5)/5+5.4,y:p.z/5+5.4,feet:(p.y+5)/5,target:[p.x,p.y+3.5,p.z+1.75]};});
  await pose(car.x,car.y,car.feet);await page.evaluate(target=>{const V=room.firstPersonCamera.position.constructor;room.firstPersonCamera.setTarget(new V(...target));},car.target);await tick(2);
  assert.equal(await page.evaluate(()=>room.scooterTarget()),true);await page.keyboard.press('e');await tick(24);assert.equal(await page.evaluate(()=>room.scooter.riding),true);await clear();
  await page.keyboard.down('w');await tick(40);await page.keyboard.up('w');report.cases.riding=await page.evaluate(()=>({riding:room.scooter.riding,speed:room.scooter.speed}));
  assert.ok(report.cases.riding.speed>0);await page.keyboard.down('Space');await tick(50);await page.keyboard.up('Space');
  report.cases.riding.contacts=await contacts();assert.deepEqual(report.cases.riding.contacts,[]);
  phase='wall, ladder and curtain';console.log(phase);
  await pose(6.05,3.04,0,0,1);await tick(2);await page.keyboard.down('w');await tick(60);await clear();const wallBefore=await position();await tick(35);await page.keyboard.up('w');
  const wallAfter=await position();report.cases.wall={before:wallBefore,after:wallAfter,played:await contacts()};assert.equal(report.cases.wall.played.length,0);assert.ok(Math.hypot(wallBefore.x-wallAfter.x,wallBefore.y-wallAfter.y)<.005);
  const ladder=load('LighthouseLadder'),anchor=ladder.lighthouseLadderLanding();await pose(anchor.x,anchor.y,LIGHTHOUSE.floor,0,1);await tick(2);await clear();
  await page.keyboard.press('e');await tick(23);assert.equal(await page.evaluate(()=>room.ladder.attached),true);
  await page.keyboard.down('w');await tick(40);await page.keyboard.up('w');await tick(8);const mid=await page.evaluate(()=>room.ladder.feet);
  const climbed=await contacts();assert.ok(climbed.length>=3);assert.ok(climbed.every(e=>e.id.startsWith('ladder-rung')));
  await clear();await tick(20);assert.equal((await contacts()).length,0);
  await page.keyboard.press('e');await tick(3);report.cases.rejectedLadderExit=await page.evaluate(()=>({attached:room.ladder.attached,feet:room.ladder.feet}));
  assert.equal(report.cases.rejectedLadderExit.attached,true);assert.equal(report.cases.rejectedLadderExit.feet,mid);assert.equal((await contacts()).length,0);
  await page.keyboard.down('s');await tick(12);await page.keyboard.up('s');await tick(3);assert.ok(await page.evaluate(()=>room.ladder.feet)<mid);
  await page.keyboard.down('w');await tick(220,.05);await page.keyboard.up('w');const top=await page.evaluate(()=>room.ladder.feet);assert.ok(Math.abs(top-LIGHTHOUSE.gallery)<.001);
  await clear();await tick(15);assert.equal((await contacts()).length,0);await page.keyboard.press('e');await tick(23);assert.equal(await page.evaluate(()=>room.ladder.attached),false);
  report.cases.ladder={mid,top,firstContacts:climbed,after:await position()};
  // Curtain fixture: real window, accepted native click, no direct toggle or fabricated motion progress.
  const curtain=await page.evaluate(()=>{const state=room.interactions.curtains.find(s=>s.curtain.windowId==='bedroom-window'),mesh=state.curtain.meshes[0],V=room.firstPersonCamera.position.constructor;mesh.computeWorldMatrix(true);const vertices=mesh.getVerticesData('position'),local=new V(0,0,0);let n=0;for(let i=0;i<vertices.length;i+=3)if(vertices[i]<0){local.addInPlace(new V(vertices[i],vertices[i+1],vertices[i+2]));n++;}local.scaleInPlace(1/n);return{id:state.curtain.id,target:V.TransformCoordinates(local,mesh.getWorldMatrix()).asArray()};});
  const target=curtain.target;await pose(target[0]/5+5.4,target[2]/5+5.4-1,0,0,1);
  await page.evaluate(target=>{const V=room.firstPersonCamera.position.constructor;room.firstPersonCamera.setTarget(new V(...target));},target);await tick(2);await clear();
  report.cases.curtainFixture={target,pose:await position(),action:await page.evaluate(()=>room.interactions.pick(room.firstPersonCamera.getForwardRay(7.5))?.label())};assert.ok(report.cases.curtainFixture.action,'curtain must be reachable by native click');
  const aimCurtain=()=>page.evaluate(id=>{const state=room.interactions.curtains.find(s=>s.curtain.id===id),mesh=state.curtain.meshes[0],c=room.firstPersonCamera,V=c.position.constructor;
   const p=mesh.getVerticesData('position'),indices=mesh.getIndices();mesh.computeWorldMatrix(true);
   for(let i=0;i<indices.length;i+=3){const center=new V(0,0,0);for(let n=0;n<3;n++){const at=indices[i+n]*3;center.addInPlace(new V(p[at],p[at+1],p[at+2]));}center.scaleInPlace(1/3);
    const world=V.TransformCoordinates(center,mesh.getWorldMatrix());if(V.Distance(world,c.position)>7.4)continue;
    c.setTarget(world);c.cameraRotation.setAll(0);c.movement.resetRotationVelocity();c.getViewMatrix(true);
    if(room.interactions.pick(c.getForwardRay(7.5))?.label().includes('次卧窗帘'))return state.progress;
   }throw Error('No visible reachable curtain triangle');},curtain.id);
  await page.mouse.click(640,400);await tick(20);report.cases.curtainReverseAt=await aimCurtain();
  assert.ok(report.cases.curtainReverseAt>0&&report.cases.curtainReverseAt<1);await page.mouse.click(640,400);await tick(60);
  report.cases.curtain=await page.evaluate(id=>({state:room.interactions.curtains.find(s=>s.curtain.id===id).progress,events:events.filter(e=>e.id.startsWith('curtain-move'))}),curtain.id);
  assert.equal(report.cases.curtain.events.filter(e=>e.type==='play').length,2);assert.equal(report.cases.curtain.state,0);
  await aimCurtain();await page.mouse.click(640,400);await tick(12);await page.keyboard.press('m');await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>room.audio.diagnostics.active),0,'map pauses curtain and feet; ambience intentionally muted');
  await page.locator('#floor-plan-return').click();await locked();await tick(65);
  phase='beacon, native pages and lifecycle';console.log(phase);
  await pose(tower.x+.9,tower.y-1.1,LIGHTHOUSE.gallery);await page.evaluate(()=>{room.setTimeAutomatic(false);room.setTimeOfDay(21);});await tick(30);await clear();
  await page.evaluate(()=>{room.updateSoundscape(.04,true);});await page.waitForTimeout(100);
  const beaconBefore=await page.evaluate(()=>({running:room.lighthouseOperation.running,automatic:room.timePlayback.automatic,active:room.audio.diagnostics.worldActive}));
  const peak=await page.evaluate(()=>measure(4500));const starts=await page.evaluate(()=>events.filter(e=>e.type==='play'&&e.id==='beacon-drive').length);
  assert.equal(beaconBefore.running,true);assert.equal(beaconBefore.automatic,false);assert.ok(peak>0&&peak<1);assert.equal(starts,0,'already started device does not restart');
  await page.keyboard.press('m');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>room.audio.diagnostics.worldActive),0);await page.locator('#floor-plan-return').click();await locked();await tick(6);
  assert.ok(await page.evaluate(()=>room.audio.diagnostics.worldActive)>0);
  report.cases.lowPower=await page.evaluate(()=>{self.qaPower=room.lighthousePowerState;
   room.lighthousePowerState=new qaPower.constructor({mainWh:200,backupWh:80});room.notifyLighthouseOperation();room.updateSoundscape(.04,true);
   return {protected:room.lighthousePower.protected,running:room.lighthouseOperation.running};});await page.waitForTimeout(100);
  assert.equal(report.cases.lowPower.protected,true);assert.equal(report.cases.lowPower.running,false);
  assert.equal(await page.evaluate(()=>room.audio.diagnostics.worldActive),0,'real unavailable state silences device');
  await page.evaluate(()=>{room.lighthousePowerState=qaPower;room.notifyLighthouseOperation();room.setTimeOfDay(12);room.updateSoundscape(.04,true);});await tick(5);assert.equal(await page.evaluate(()=>room.audio.diagnostics.worldActive),0);
  const started=await page.evaluate(()=>room.startLighthouseTest());assert.equal(started,true);await tick(8);assert.ok(await page.evaluate(()=>room.audio.diagnostics.worldActive)>0);
  const repeated=await page.evaluate(()=>room.startLighthouseTest());assert.equal(repeated,false);await page.evaluate(()=>room.endLighthouseTest());await tick(5);assert.equal(await page.evaluate(()=>room.audio.diagnostics.worldActive),0);
  report.cases.beacon={...beaconBefore,peak,soakSeconds:4.5,restarts:starts,started,repeated};
  await clear();await page.keyboard.press('j');await page.waitForTimeout(120);
  const paperOpen=await page.evaluate(()=>events.filter(e=>e.type==='play'&&e.id.startsWith('paper-')).length);assert.ok(paperOpen>=1);
  await page.locator('#story-return').click();await page.waitForTimeout(120);report.cases.storyCover={paperOpen,total:await page.evaluate(()=>events.filter(e=>e.type==='play'&&e.id.startsWith('paper-')).length)};
  assert.ok(report.cases.storyCover.total>paperOpen);await locked();
  const panelPoint=load('LighthouseLayout').LIGHTHOUSE.controlPanel;await pose(tower.x+panelPoint.x-.75,tower.y+panelPoint.y-.35,LIGHTHOUSE.floor,1,0);
  const device=await page.evaluate(()=>{const m=room.exterior.lighthouseDetails.panel.meshes[0];m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.centerWorld.asArray();});
  await page.evaluate(target=>{room.firstPersonCamera.setTarget(new room.firstPersonCamera.position.constructor(...target));},device);await tick(2);await clear();
  await page.mouse.click(640,400);await page.waitForFunction(()=>room.lighthousePanel.isOpen);
  await page.locator('#lighthouse-record-toggle').click();await page.waitForTimeout(120);const changed=await page.evaluate(()=>events.filter(e=>e.type==='play').length);
  await page.locator('#lighthouse-record-toggle').click();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>events.filter(e=>e.type==='play').length),changed,'same tab no sound');
  await page.locator('#lighthouse-instrument-tab').click();await page.waitForTimeout(120);report.cases.pages=await page.evaluate(()=>events.filter(e=>e.type==='play'));
  assert.ok(report.cases.pages.some(e=>e.id.startsWith('paper-')));assert.ok(report.cases.pages.some(e=>e.id.startsWith('ui-contact-')));assert.ok(!report.cases.pages.some(e=>e.id.startsWith('switch-')));
  await page.locator('#lighthouse-panel-return').click();await locked();
  await page.keyboard.press('Escape');await page.locator('#settings-btn').click();await page.locator('#audio-actions-volume').focus();await page.keyboard.press('Home');
  await page.evaluate(()=>room.audio.setMix({actions:0,ambience:0,ui:1}));await page.locator('#audio-preview').click();report.cases.uiOnly=await page.evaluate(()=>measure());assert.ok(report.cases.uiOnly>0);
  await page.locator('#audio-ui-volume').focus();await page.keyboard.press('Home');await page.waitForTimeout(150);
  await page.locator('#audio-preview').click();report.cases.uiMuted=await page.evaluate(()=>measure());assert.equal(report.cases.uiMuted,0);
  await page.evaluate(()=>room.audio.setMix({actions:1,ambience:.7,ui:1}));await page.locator('#settings-close').click();await page.locator('[data-view="first-person"]').click();await locked();await tick(3);
  const laterJs=[];page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))laterJs.push(new URL(r.url()).pathname);});
  await page.keyboard.press('Escape');await page.locator('#inspect-btn').click();await page.waitForFunction(()=>s.debugLayer.isVisible(),null,{timeout:60000});await page.waitForTimeout(160);
  assert.equal(await page.evaluate(()=>measure()),0);await page.evaluate(()=>s.debugLayer.hide());report.inspectorJs=[...new Set(laterJs)];await tick(2);
  // Two production screenshots verify current geometry/UI; pixels say nothing about audio quality.
  await page.locator('[data-view="first-person"]').click();await locked();await pose(tower.x+.9,tower.y-1.1,LIGHTHOUSE.gallery);await tick(2);
  await page.screenshot({path:path.join(out,'lantern.jpg'),type:'jpeg',quality:87});
  await page.keyboard.press('Escape');await page.locator('#settings-btn').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(out,'settings-portrait.jpg'),type:'jpeg',quality:87});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1280,height:800});await page.locator('#settings-close').click();await page.locator('[data-view="first-person"]').click();await locked();
  await page.evaluate(()=>{room.setTimeOfDay(21);room.soundscape.reset();});await tick(25);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(150);
  report.cases.blur=await page.evaluate(()=>({context:audioContexts[0].state,active:room.audio.diagnostics.active,unstopped:sources.filter(s=>s.loop&&!s.qaStopped).length}));
  assert.equal(report.cases.blur.context,'suspended');assert.equal(report.cases.blur.active,0);assert.equal(report.cases.blur.unstopped,0);
  await page.evaluate(()=>room.dispose());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>audioContexts[0].state),'closed');
  phase='isolated missing daily variation';console.log(phase);
  const missing=await context.newPage(),attempts=[];
  await missing.route('**/audio/daily/footstep-wood-4.*',route=>{attempts.push(route.request().url());return route.fulfill({status:404,body:'controlled QA missing foley'});});
  await missing.goto(base,{timeout:120000});await missing.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await missing.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='partial');await missing.waitForTimeout(2000);assert.equal(attempts.length,2);
  const missingCdp=await context.newCDPSession(missing);await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(missing,missingCdp);
  await missing.locator('#settings-btn').click();await missing.locator('#audio-preview').click();
  report.cases.missingVariation=await missing.evaluate(async()=>{e.stopRenderLoop();room.audio.stopAll();room.audio.setMix({actions:1,ambience:0,ui:1});meter();await new Promise(r=>setTimeout(r,120));
   room.audio.play('footstep-wood','qa-missing');return {diagnostics:room.audio.diagnostics,peak:await measure()};});
  assert.deepEqual(report.cases.missingVariation.diagnostics.failedFiles,['footstep-wood-4']);assert.ok(report.cases.missingVariation.peak>0);
  report.cases.missingVariation.attempts=attempts.length;
  await missing.locator('#settings-close').click();await missing.locator('#story-open').click();await missing.locator('#story-new').click();await missing.locator('#story-new-confirm').click();
  await missing.waitForFunction(()=>!!room.lighthouseStory);await missing.waitForTimeout(200);
  await missing.evaluate(()=>{self.pageFeedback=[];const play=room.audio.play;room.audio.play=function(cue,...a){pageFeedback.push(cue);return play.call(this,cue,...a);};});
  await missing.locator('#story-tab-duty').click();await missing.waitForTimeout(150);const duty=await missing.evaluate(()=>pageFeedback.length);
  assert.equal(duty,1);await missing.locator('#story-tab-duty').click();assert.equal(await missing.evaluate(()=>pageFeedback.length),duty);
  await missing.locator('#story-tab-radio').click();await missing.waitForTimeout(150);await missing.locator('#story-tab-life').click();await missing.waitForTimeout(150);
  report.cases.storyPages=await missing.evaluate(()=>({feedback:pageFeedback,played:room.audio.diagnostics.played}));assert.deepEqual(report.cases.storyPages.feedback,['paper','paper','paper']);
  await missing.close();
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.passed=true;
  fs.writeFileSync(path.join(out,'release-manifest.json'),raw);console.log(JSON.stringify({passed:true,firstScreenBytes:report.firstScreenBytes,outputs:report.outputs.length,errors:report.errors.length,warnings:report.warnings.length}));
 }catch(error){report.passed=false;report.failedAt=phase;report.failure=error.stack;console.error(phase,error);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
})();
