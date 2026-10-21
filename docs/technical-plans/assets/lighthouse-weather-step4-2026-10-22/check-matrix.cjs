const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core'),out=path.join(__dirname,'matrix');
const record={manifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../dist/release-manifest.json'))).digest('hex'),method:'Unmodified production bundle, native time/weather menu; orbit observation fixtures. Fixed deltas verify rendering and state, not FPS.',cases:[],errors:[],warnings:[]};
(async()=>{fs.mkdirSync(out,{recursive:true});try{for(const kind of ['chromium','webkit']){
const browser=await pw[kind].launch({headless:true,...(kind==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});try{
for(const dpr of [1,2]){const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,serviceWorkers:'block'}),page=await context.newPage();
page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
await page.goto(process.env.STUDY_URL||'http://127.0.0.1:8254/',{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);await page.locator('[data-view="balcony"]').click();
for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);
await page.evaluate(()=>{e.setHardwareScalingLevel(1/devicePixelRatio);e.resize();const c=s.activeCamera,V=c.position.constructor;c.lowerRadiusLimit=1;c.upperRadiusLimit=5000;c.setTarget(new V((-124-5.4)*5,80,(108-5.4)*5));c.setPosition(new V((-65-5.4)*5,85,(150-5.4)*5));});
for(const [weather,hour]of [['clear',0],['fog',0],['storm',0],['clear',12]]){
await page.locator('#time-toggle').click();await page.locator('#weather-mode').selectOption(weather);await page.locator(`[data-time-hour="${hour}"]`).click();await page.evaluate(()=>{e.getDeltaTime=()=>50;for(let i=0;i<26;i++)s.render();e.getDeltaTime=()=>0;});await page.locator('#time-close').click();
const sample=await page.evaluate(async()=>{s.render();await new Promise(r=>s.executeWhenReady(r));s.render();const b=s.getMeshByName('coastal-lighthouse-visible-beam'),o=s.getMaterialByName('coastal-ocean');return{size:[e.getRenderWidth(),e.getRenderHeight()],volumeReady:b.material.isReady(b),oceanReady:o.isReady(s.getMeshByName('coastal-sea')),transmission:s.metadata.lighthouseOperation.inspection.transmission,power:b.material._floats.shaftPower,oceanPower:o._floats.shaftPower,fog:b.material._floats.weatherFogDensity,sceneFog:s.fogDensity,running:s.metadata.lighthouseOperation.state.running};});
assert.equal(sample.volumeReady,true);assert.equal(sample.oceanReady,true);assert.equal(sample.running,hour===0);assert.equal(sample.power,hour===0?sample.transmission:0);assert.equal(sample.oceanPower,sample.power);assert.equal(sample.fog,sample.sceneFog);assert.deepEqual(sample.size,[viewport.width*dpr,viewport.height*dpr]);record.cases.push({kind,version:browser.version(),dpr,viewport,weather,hour,...sample});
if(dpr===1&&weather==='clear'){await page.screenshot({path:path.join(out,`${kind}-${viewport.width}-${hour}.jpg`),type:'jpeg',quality:84});}
}
}await context.close();}
}finally{await browser.close();}
}assert.deepEqual(record.errors,[]);record.passed=true;
}finally{fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(record,null,2)+'\n');}console.log(JSON.stringify({passed:record.passed,cases:record.cases.length,errors:record.errors,warnings:record.warnings}));})().catch(e=>{console.error(e);process.exitCode=1;});
