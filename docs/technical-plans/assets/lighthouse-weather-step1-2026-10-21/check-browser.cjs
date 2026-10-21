const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core');
const root=path.resolve(__dirname,'../../../../dist'),out=__dirname,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(path.join(root,'release-manifest.json')),manifest=JSON.parse(raw),base=process.env.STUDY_URL||'http://127.0.0.1:8253/';
const record={baseline:'1f9ef6c',manifestSha256:sha(raw),method:'Unmodified production dist, real render-loop time advancement without enabling automatic first. Native time/settings/map controls, synthetic window blur/focus for pause checks, one bounded-receipt reset check. No energy/day/evidence setters. Stage-one weather/risk modules are deliberately not connected to Room. Checks unchanged current production clock/UI; no weather visual or performance claim.',pages:[],files:[]};
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});record.browser=browser.version();
try{for(const prefix of ['','home/']){
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 const item={url:new URL(prefix,base).href,requests:[],errors:[],warnings:[],cases:{}};record.pages.push(item);
 page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());if(m.type()==='warning')item.warnings.push(m.text());});
 page.on('response',r=>item.requests.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length']||0)}));
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');};
 await page.goto(item.url,{timeout:120000});await ready();
 item.initialJs=item.requests.filter(r=>new URL(r.url).pathname.endsWith('.js'));item.initialJsBytes=item.initialJs.reduce((n,r)=>n+r.bytes,0);assert.ok(item.initialJsBytes<=3*1048576);
 await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
 const sample=()=>page.evaluate(()=>({hour:room.timeOfDay.hour,automatic:room.timePlayback.automatic,mainWh:room.lighthousePower.mainWh,solarW:room.lighthousePower.solarW,mainNetW:room.lighthousePower.mainNetW,opHour:room.lighthouseOperation.hour,operatingHours:room.lighthouseOperation.automaticOperatingHours,running:room.lighthouseOperation.running,pauses:room.pauseReasons}));
 const progressed=async(before)=>{await page.waitForFunction(hour=>room.timeOfDay.hour>hour+.0005,before.hour,{timeout:10000});return sample();};
 const frozen=async()=>{const before=await sample();await page.waitForTimeout(450);const after=await sample();assert.equal(after.hour,before.hour);assert.equal(after.mainWh,before.mainWh);return after;};
 const closeTime=()=>page.locator('#time-close').click();
 const defaultBefore=await sample();assert.equal(defaultBefore.automatic,true);assert.equal(await page.locator('#time-automatic').isChecked(),true);
 const defaultAfter=await progressed(defaultBefore);assert.ok(defaultAfter.mainWh>defaultBefore.mainWh);assert.equal(defaultAfter.opHour,defaultAfter.hour);item.cases.defaultClockAndSolarAdvance={before:defaultBefore,after:defaultAfter};
 await page.locator('#time-toggle').click();assert.equal((await sample()).pauses.includes('time-menu'),true);item.cases.menuPauses=await frozen();
 await page.screenshot({path:path.join(out,prefix?'menu-subpath.jpg':'menu-default.jpg'),type:'jpeg',quality:85});
 await page.locator('#time-automatic').uncheck();await closeTime();assert.equal((await sample()).automatic,false);item.cases.manualOffFreezes=await frozen();
 await page.locator('#time-toggle').click();await page.locator('#time-automatic').check();await closeTime();await progressed(await sample());
 await page.locator('#settings-btn').click();assert.equal((await sample()).pauses.includes('settings'),true);item.cases.settingsPause=await frozen();await page.locator('#settings-close').click();await progressed(await sample());
 await page.locator('#floor-plan-toggle').click();assert.equal((await sample()).pauses.includes('map'),true);item.cases.mapPause=await frozen();await page.locator('#floor-plan-return').click();await progressed(await sample());
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await sample()).pauses.includes('blur'),true);item.cases.blurPause=await frozen();
 const reset=await page.evaluate(()=>{const before=room.timeOfDay.hour;window.dispatchEvent(new Event('focus'));room.updateTimeOfDay(3600);return{before,after:room.timeOfDay.hour};});assert.equal(reset.before,reset.after);item.cases.resumeNeverCatchesUp=reset;await progressed(await sample());
 await page.locator('#time-toggle').click();await page.locator('[data-time-hour="21"]').click();await page.waitForFunction(()=>!room.timePlayback.transitioning&&room.timeOfDay.hour===21);
 assert.equal(await page.locator('#time-automatic').isChecked(),false);await closeTime();item.cases.manualNodeRemainsStopped=await frozen();
 await page.locator('#time-toggle').click();await page.locator('#time-automatic').check();await closeTime();const nightBefore=await sample(),nightAfter=await progressed(nightBefore);
 assert.equal(nightAfter.running,true);assert.ok(nightAfter.mainWh<nightBefore.mainWh);assert.ok(nightAfter.operatingHours>nightBefore.operatingHours);item.cases.nightNavigationAndEnergy={before:nightBefore,after:nightAfter};
 await page.locator('#time-toggle').click();await page.locator('#time-automatic').uncheck();await closeTime();
 await page.reload({timeout:120000});await ready();await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
 const reloaded=await sample();assert.equal(reloaded.automatic,true);assert.equal(await page.locator('#time-automatic').isChecked(),true);assert.ok(reloaded.hour>=12&&reloaded.hour<13);await progressed(reloaded);item.cases.reloadRestartsAutomaticFromNoon=reloaded;
 assert.deepEqual(item.errors,[]);assert.deepEqual(item.requests.filter(r=>r.status>=400),[]);item.passed=true;await context.close();
}
 const previous=require('../lighthouse-equipment-step5-2026-10-21/release-manifest.json'),runtime=m=>m.files.filter(f=>f.kind==='runtime').map(({path,bytes,sha256})=>({path,bytes,sha256}));assert.deepEqual(runtime(manifest),runtime(previous));
 assert.deepEqual(manifest.files,previous.files,'Isolated pure logic must not change any delivered file');
 const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
 for(const prefix of ['','home/']){for(let n=0;n<files.length;n+=2)await Promise.all(files.slice(n,n+2).map(async file=>{const r=await fetch(new URL(prefix+file.path,base));assert.equal(r.status,200,file.path);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,file.bytes,file.path);assert.equal(sha(b),file.sha256,file.path);}));record.files.push({prefix,files:files.length,passed:true});}
 record.totals=require('../../../../tools/verify-study-release.cjs').verifyRelease(root);record.unchangedRuntimeFiles=runtime(manifest).length;record.passed=true;
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(record,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:record.passed,pages:record.pages.map(p=>({url:p.url,passed:p.passed,initialJsBytes:p.initialJsBytes,cases:Object.keys(p.cases)})),totals:record.totals}));
})().catch(e=>{console.error(e);process.exitCode=1;});
