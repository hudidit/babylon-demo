// Production audio clock / accepted controller time, not human listening or an FPS benchmark.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./audio-lab.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const outdoor=load('WalkingSurface').walkingSurfaceAt(14,2.2);assert.ok(outdoor);
const out=path.resolve(process.env.AUDIO_CHECK_OUTPUT||'docs/technical-plans/assets/calm-soundscape-2026-10-24');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=await serve(path.resolve('dist')),base='http://127.0.0.1:'+server.address().port+'/';let browser,page;
 const report={baseline:'2d61ec6',acousticListening:false,fpsOrLoadTimeSampling:false,errors:[],
  method:'Unchanged production bundles on independent host. Debugger captures existing Room. Legal stationary outdoor pose; scooter speeds are isolated input fixtures at the same pose and matched soundscape elapsed time, not native driving. Original Room snapshots/controller and native Audio V2 output. 100 accepted seconds with 40ms wall-clock waits; no accelerated bird timer or forced bird play. These are cadence/output checks, not acoustic approval.'};
 try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(()=>{
   self.contexts=[];self.outputs=[];const Native=AudioContext;self.AudioContext=class extends Native{constructor(...a){super(...a);contexts.push(this);}};
   const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...a){if(a[0]===this.context.destination&&!this.qaProbe)outputs.push(this);return connect.apply(this,a);};
   self.measure=async(ms=180)=>{const ctx=contexts[0],an=ctx.createAnalyser(),zero=ctx.createGain();an.fftSize=4096;zero.gain.value=0;zero.qaProbe=true;
    for(const node of new Set(outputs))node.connect(an);an.connect(zero);zero.connect(ctx.destination);const values=new Float32Array(4096);let peak=0,end=performance.now()+ms;
    while(performance.now()<end){an.getFloatTimeDomainData(values);for(const v of values)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,10));}
    for(const node of new Set(outputs))node.disconnect(an);an.disconnect();zero.disconnect();return peak;};
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(base,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,await context.newCDPSession(page));
  report.beforeGesture=await page.evaluate(async()=>{room.audio.play('bird-call','ambient-birds');return{gestured:room.audio.gestured,peak:await measure(),active:room.audio.diagnostics.active};});
  assert.equal(report.beforeGesture.gestured,false);assert.equal(report.beforeGesture.peak,0);assert.equal(report.beforeGesture.active,0);
  await page.locator('[data-view="first-person"]').click();await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);
  await page.evaluate(feet=>{e.stopRenderLoop();room.setWeather('clear');room.setTimeAutomatic(false);room.setTimeOfDay(12);room.audio.stopAll();room.audio.setMix({actions:0,ambience:1,ui:0});
   room.firstPersonCamera.position.set((14-5.4)*5,-5+(feet+1.6)*5,(2.2-5.4)*5);room.jump.feet=feet;
   self.steps=n=>{for(let i=0;i<n;i++)room.updateSoundscape(.04,true);};
  },outdoor.height);
  report.speedTargets=await page.evaluate(()=>{
   const result=[];for(const speed of [0,5,40/3.6]){room.soundscape.reset();room.soundscape.elapsed=0;room.soundscapeElapsed=0;room.scooter.riding=true;room.scooter.speed=speed;steps(100);
    result.push({speed,targets:room.soundscape.diagnostics.targets.filter(t=>/^(wind|sea|rain)-/.test(t.id))});}
   room.scooter.riding=false;room.scooter.speed=0;return result;
  });
  assert.deepEqual(report.speedTargets[0].targets,report.speedTargets[1].targets);assert.deepEqual(report.speedTargets[0].targets,report.speedTargets[2].targets);
  await page.evaluate(async()=>{await room.audio.preload();steps(2);});await page.waitForTimeout(200);
  report.calmBedPeak=await page.evaluate(()=>measure(400));assert.ok(report.calmBedPeak>0&&report.calmBedPeak<.02);
  report.environmentMute=await page.evaluate(async()=>{room.audio.setMix({actions:0,ambience:0,ui:0});await new Promise(r=>setTimeout(r,150));return measure();});assert.equal(report.environmentMute,0);
  await page.evaluate(()=>{room.audio.setMix({actions:0,ambience:1,ui:0});room.soundscape.reset();room.soundscapeElapsed=0;self.calmTime=0;self.birdStarts=[];
   for(const[id,voices]of room.audio.voices)if(id.startsWith('bird-call-'))for(const voice of voices){const play=voice.play;voice.play=function(...a){birdStarts.push({id,acceptedSeconds:calmTime,audioTime:contexts[0].currentTime,wallTime:performance.now()});return play.apply(this,a);};}
  });
  console.log('Recording 100 accepted seconds of sparse production bird cadence');
  report.cadence=await page.evaluate(async()=>{
   const start=performance.now();for(let i=0;i<2500;i++){room.updateSoundscape(.04,true);calmTime+=.04;await new Promise(r=>setTimeout(r,40));}
   return{acceptedSeconds:calmTime,wallSeconds:(performance.now()-start)/1000,starts:birdStarts,diagnostics:room.soundscape.diagnostics,audio:room.audio.diagnostics};
  });
  const calls=report.cadence.starts;assert.ok(calls.length>=2&&calls.length<=3);assert.ok(calls[0].acceptedSeconds>=17.9&&calls[0].acceptedSeconds<=30.1);
  for(let i=1;i<calls.length;i++){const gap=calls[i].acceptedSeconds-calls[i-1].acceptedSeconds;assert.ok(gap>=31.9&&gap<=62.1);}
  await page.keyboard.press('m');await page.evaluate(()=>steps(1));report.map=await page.evaluate(()=>({wait:room.soundscape.diagnostics.birdInSeconds??null,active:[...room.audio.active].filter(v=>v.entity==='ambient-birds').length}));
  assert.equal(report.map.wait,null);assert.equal(report.map.active,0);await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement&&room.controlsEnabled);await page.evaluate(()=>steps(1));
  report.reentryWait=await page.evaluate(()=>room.soundscape.diagnostics.birdInSeconds);assert.ok(report.reentryWait>=18&&report.reentryWait<=30);
  report.night=await page.evaluate(()=>{room.setTimeOfDay(21);steps(1);return{wait:room.soundscape.diagnostics.birdInSeconds??null};});assert.equal(report.night.wait,null);
  report.indoors=await page.evaluate(()=>{room.setTimeOfDay(12);room.firstPersonCamera.position.set((7-5.4)*5,-5+1.6*5,(5-5.4)*5);room.jump.feet=0;steps(1);return{region:room.soundscape.diagnostics.region,wait:room.soundscape.diagnostics.birdInSeconds??null};});
  assert.equal(report.indoors.region,'house');assert.equal(report.indoors.wait,null);
  await page.evaluate(()=>room.dispose());assert.equal(await page.evaluate(()=>contexts[0].state),'closed');assert.deepEqual(report.errors,[]);report.passed=true;
  console.log(JSON.stringify({passed:true,calls:calls.length,acceptedSeconds:report.cadence.acceptedSeconds,bedPeak:report.calmBedPeak}));
 }catch(error){report.passed=false;report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'cadence-browser.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
})();
