const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),dist=path.join(root,'dist'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const {verifyRelease}=require(path.join(root,'tools/verify-study-release.cjs'));
const baseline=require('../lighthouse-weather-step4-2026-10-22/release-manifest.json');
const record={baseline:'9b80607',node:process.version,prefixes:[],browserCases:[]};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/home\//,'/');if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
 });
});
(async()=>{let browser;
 try{
  record.totals=verifyRelease(dist);const raw=fs.readFileSync(path.join(dist,'release-manifest.json')),manifest=JSON.parse(raw);record.manifestSha256=sha(raw);
  const runtime=m=>m.files.filter(f=>f.kind==='runtime');assert.deepEqual(runtime(manifest),runtime(baseline));record.unchangedRuntimeAssets=runtime(manifest).length;
  assert.deepEqual(manifest.entryFiles,baseline.entryFiles);assert.deepEqual(manifest.chunkFiles,baseline.chunkFiles);
  const original=new Map(baseline.files.map(f=>[f.path,f]));assert.deepEqual(manifest.files.map(f=>f.path),baseline.files.map(f=>f.path));
  record.changedFiles=manifest.files.filter(f=>f.sha256!==original.get(f.path).sha256).map(f=>({path:f.path,before:original.get(f.path).bytes,after:f.bytes}));
  assert.ok(record.changedFiles.every(f=>['js/main.js','bundle-analysis.json'].includes(f.path)));record.firstScreenDelta=manifest.files.find(f=>f.path==='js/main.js').bytes-original.get('js/main.js').bytes;
  record.sources=Object.fromEntries(['src/examples/LighthouseStory.ts','src/examples/LighthouseStorySave.ts','src/examples/LighthouseWeatherSession.ts',
   'tests/lighthouse-story.test.cjs','tests/lighthouse-story-save.test.cjs','tests/lighthouse-weather-save.test.cjs'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
  const analysis=JSON.parse(fs.readFileSync(path.join(dist,'bundle-analysis.json')));record.unconnectedStoryModules=true;
  assert.equal(/LighthouseStory/.test(JSON.stringify(analysis)),false);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/`;
  const files=[...manifest.files,{path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
  for(const prefix of ['','home/']){
   const url=new URL(prefix,base);
   for(let n=0;n<files.length;n+=8)await Promise.all(files.slice(n,n+8).map(async file=>{const response=await fetch(new URL(file.path,url));assert.equal(response.status,200,file.path);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);}));
   record.prefixes.push({path:url.pathname,files:files.length,passed:true});
  }
  const pw=require(process.env.PLAYWRIGHT_PACKAGE||'playwright-core');
  browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});record.browser=browser.version();
  for(const prefix of ['','home/']){
   const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),page=await context.newPage();
   const item={path:'/'+prefix,errors:[],warnings:[],firstScreenJs:[],viewports:[]},pending=[];record.browserCases.push(item);
   page.on('pageerror',e=>item.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());if(m.type()==='warning')item.warnings.push(m.text());});
   let firstScreen=true;page.on('response',response=>{if(response.status()>=400)item.errors.push(`${response.status()} ${response.url()}`);
    if(firstScreen&&new URL(response.url()).pathname.endsWith('.js'))pending.push(response.body().then(b=>item.firstScreenJs.push({path:new URL(response.url()).pathname,bytes:b.length,sha256:sha(b)})));});
   await page.goto(new URL(prefix,base).href,{timeout:120000});await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'),null,{timeout:120000});
   const cdp=await context.newCDPSession(page);await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page,cdp);
   await page.evaluate(async()=>{await new Promise(resolve=>s.executeWhenReady(resolve));s.render();s.render();});
   await page.waitForLoadState('networkidle');firstScreen=false;await Promise.all(pending);item.firstScreenBytes=item.firstScreenJs.reduce((sum,f)=>sum+f.bytes,0);assert.equal(item.firstScreenBytes,3074217+record.firstScreenDelta);assert.ok(item.firstScreenBytes<=3*1048576);
   await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>0;});
   const state=()=>page.evaluate(()=>JSON.parse(JSON.stringify({operation:room.lighthouseState.exportState(),inspection:room.lighthouseInspectionState.exportState(),maintenance:room.lighthouseMaintenanceState.exportState(),
    power:room.lighthousePowerState.exportState(),weather:room.weatherState.exportState(),discovery:room.discovery.exportState()})));
   await page.locator('#time-toggle').click();const original=await state();await page.locator('#weather-mode').selectOption('fog');assert.equal(await page.locator('#lighthouse-session-mode').inputValue(),'exercise');
   await page.locator('#lighthouse-session-mode').selectOption('duty');assert.deepEqual(await state(),original);item.originalModeIsolation=true;
   for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);await page.locator('#lighthouse-exercise-restart').scrollIntoViewIfNeeded();
    await page.evaluate(async()=>{s.render();await new Promise(resolve=>s.executeWhenReady(resolve));s.render();});
    const bounds=await page.locator('#lighthouse-exercise-restart').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);item.viewports.push({...viewport,passed:true});
   }
   assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('babylon-lighthouse-duty-v1'),localStorage.getItem('babylon-lighthouse-exercise-v2'),localStorage.getItem('babylon-lighthouse-story-v1')]),[null,null,null]);item.noImplicitSave=true;
   if(!prefix){await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{s.render();s.render();});await page.screenshot({path:path.join(__dirname,'original-time-menu.jpg'),type:'jpeg',quality:85});}
   await page.locator('#time-close').click();item.midnight=await page.evaluate(()=>{
    room.setTimeOfDay(21);room.setTimeAutomatic(true);const before=room.lighthouseOperation.dutyDay;let crossings=0;
    for(let n=0;n<1805;n++){room.updateTimeOfDay(.1);crossings+=room.timeState.lastAdvance.midnightCrossings;}
    room.setTimeAutomatic(false);return{before,after:room.lighthouseOperation.dutyDay,crossings,hour:room.timeOfDay.hour,inspectionDay:room.lighthouseInspection.dutyDay,callbacks:1805};
   });assert.equal(item.midnight.crossings,1);assert.equal(item.midnight.after,item.midnight.before+1);assert.equal(item.midnight.inspectionDay,item.midnight.after);
   await page.evaluate(()=>room.dispose());item.disposed=await page.evaluate(()=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,lights:s.lights.length,cameras:s.cameras.length}));
   assert.ok(Object.values(item.disposed).every(n=>n===0));assert.deepEqual(item.errors,[]);assert.deepEqual(item.warnings,[]);item.passed=true;await context.close();
  }
  record.passed=true;
 }finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(__dirname,'release-browser.json'),JSON.stringify(record,null,2)+'\n');
 }
 console.log(JSON.stringify({passed:record.passed,manifestSha256:record.manifestSha256,totals:record.totals,prefixes:record.prefixes,browsers:record.browserCases.map(v=>({path:v.path,js:v.firstScreenBytes,passed:v.passed}))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
