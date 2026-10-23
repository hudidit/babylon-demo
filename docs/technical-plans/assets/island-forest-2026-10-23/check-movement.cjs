const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = process.cwd(), dist = path.join(root, 'dist');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const load = require(path.join(root, 'docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs'));
const walking = load('WalkingSurface');
const record = { baseline: '554fc99', method: 'Final production dist; Playwright keyboard events, local grounded starting poses, 60 Hz reference camera updates. Old speed uses a temporary camera parameter for comparison. No FPS, wall-clock travel or load-time measurement.', errors: [], warnings: [], firstScreenJs: [], movement: [], collisions: [] };
const server = http.createServer((req,res) => {
  let name = new URL(req.url, 'http://localhost').pathname.replace(/^\/home\//, '/');
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(dist, '.' + name);
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err,data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': ({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)] || 'application/octet-stream', 'Content-Length':data.length, 'Cache-Control':'no-store'}); res.end(data);
  });
});
(async () => {
 let browser;
 try {
  record.release = require(path.join(root,'tools/verify-study-release.cjs')).verifyRelease(dist);
  const raw = fs.readFileSync(path.join(dist, 'release-manifest.json'));
  record.manifestSha256 = sha(raw);
  const manifest = JSON.parse(raw);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const files = [...manifest.files, {path:'release-manifest.json',bytes:raw.length,sha256:sha(raw)}];
  for (const prefix of ['', 'home/']) {
   for (let i=0;i<files.length;i+=12) await Promise.all(files.slice(i,i+12).map(async f=>{
    const r=await fetch(base+prefix+f.path); assert.equal(r.status,200); const data=Buffer.from(await r.arrayBuffer()); assert.equal(data.length,f.bytes); assert.equal(sha(data),f.sha256);
   }));
  }
  record.hosted = {prefixes:['/','/home/'],filesPerPrefix:files.length};
  const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  record.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'}), page=await context.newPage();
  page.on('pageerror',e=>record.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
  let collecting=true; const pending=[];
  page.on('response',r=>{if(r.status()>=400)record.errors.push(`${r.status()} ${r.url()}`);if(collecting&&new URL(r.url()).pathname.endsWith('.js'))pending.push(r.body().then(data=>record.firstScreenJs.push({path:new URL(r.url()).pathname,bytes:data.length,sha256:sha(data)})));});
  await page.goto(base,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'),null,{timeout:120000});
  await require(path.join(root,'docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs')).captureRoom(page,await context.newCDPSession(page));
  await page.evaluate(async()=>{await new Promise(resolve=>s.executeWhenReady(resolve));s.render();});
  await page.waitForLoadState('networkidle'); collecting=false;await Promise.all(pending);
  record.firstScreenBytes=record.firstScreenJs.reduce((n,r)=>n+r.bytes,0);assert.ok(record.firstScreenBytes<=3*1048576);
  assert.equal(await page.evaluate(()=>room.firstPersonCamera.speed),1.0725);
  await page.locator('#settings-btn').click();
  await page.locator('#movement-speed').fill('2');
  record.custom=await page.evaluate(()=>({speed:room.firstPersonCamera.speed,saved:localStorage.getItem('study-movement-speed'),label:document.querySelector('#movement-speed-value').value}));
  assert.deepEqual(record.custom,{speed:2.145,saved:'2',label:'2.00×'});
  await page.locator('#settings-reset').click();
  record.reset=await page.evaluate(()=>({speed:room.firstPersonCamera.speed,saved:localStorage.getItem('study-movement-speed'),label:document.querySelector('#movement-speed-value').value}));
  assert.deepEqual(record.reset,{speed:1.0725,saved:'1',label:'1.00×'});
  await page.locator('#settings-close').click();
  await page.locator('[data-view="first-person"]').click();
  await page.waitForFunction(()=>room.controlsEnabled&&room.currentView==='first-person');
  await page.evaluate(()=>{e.stopRenderLoop();e.getDeltaTime=()=>1000/60;e.getFps=()=>60;});
  const pose=async(p,speed)=>page.evaluate(({p,speed})=>{
   const c=room.firstPersonCamera;room.setMovementSpeed(1);c.speed=speed;
   c.cameraDirection.setAll(0);c.cameraRotation.setAll(0);c.movement.resetPanVelocity();c.movement.resetRotationVelocity();c.rotation.set(0,p.heading,0);
   c.position.set((p.x-5.4)*5,-5+(p.height+1.6)*5,(p.y-5.4)*5);
   Object.assign(room.jump,{feet:p.height,grounded:true,velocity:0,queued:false,originTop:p.height});room.previousWalk.copyFrom(c.position);room.stableWalk={position:c.position.clone(),feet:p.height};c.getViewMatrix(true);document.querySelector('#gameCanvas').focus();
  },{p:{...p,height:walking.walkingSurfaceAt(p.x,p.y).height},speed});
  const run=async(frames)=>{
   await page.keyboard.down('w');const result=await page.evaluate(frames=>{const c=room.firstPersonCamera;const start=c.position.clone();for(let i=0;i<frames;i++)c._checkInputs();return{distance:Math.hypot(c.position.x-start.x,c.position.z-start.z)/5,point:{x:c.position.x/5+5.4,y:c.position.z/5+5.4},grounded:room.jump.grounded};},frames);await page.keyboard.up('w');return result;
  };
  for(const speed of [.825,1.0725]){await pose({x:-1.204,y:-3.099,heading:0},speed);record.movement.push({speed,frames:120,...await run(120)});}
  assert.ok(record.movement.every(x=>x.distance>1&&x.grounded));
  record.distanceRatio=record.movement[1].distance/record.movement[0].distance;
  assert.ok(Math.abs(record.distanceRatio-1.3)<1e-6);
  for(const speed of [1.0725,3.2175]){await pose({x:14,y:0,heading:Math.PI/2},speed);const result=await run(240);assert.ok(walking.walkingPointAllowed(result.point));assert.ok(result.point.x<=16-.26-.04+1e-6);const continued=await run(120);assert.ok(continued.distance<.03);record.collisions.push({speed,...result,continued});}
  await page.evaluate(()=>room.setMovementSpeed(1));
  assert.deepEqual(record.errors,[]);record.passed=true;
 } catch(error) {record.failure=error.stack;throw error;} finally {
  fs.writeFileSync(path.join(__dirname,'movement.json'),JSON.stringify(record,null,2)+'\n');
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 }
 console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
