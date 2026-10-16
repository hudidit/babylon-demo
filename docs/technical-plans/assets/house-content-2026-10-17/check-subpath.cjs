// Verify a dist-only subdirectory host; no rendering performance measurements.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>requests.push({url:r.url(),status:r.status()}));
 try{
  await page.goto(process.env.STUDY_SUBPATH_URL||'http://127.0.0.1:8102/home/');
  await page.waitForFunction(()=>document.querySelector('#floor-plan-drawing [data-room="living"]').dataset.state==='ready'&&document.querySelector('#floor-plan-drawing [data-room="study"]').dataset.state==='ready');
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');
  const httpRequests=requests.filter(r=>new URL(r.url).protocol==='http:');assert.ok(httpRequests.every(r=>new URL(r.url).pathname.startsWith('/home/')&&r.status<400));assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(process.env.STUDY_CHECK_OUTPUT||__dirname,'subpath.json'),JSON.stringify({passed:true,errors,requests},null,2)+'\n');
 }finally{await browser.close();}
 console.log('Subdirectory deployment passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
