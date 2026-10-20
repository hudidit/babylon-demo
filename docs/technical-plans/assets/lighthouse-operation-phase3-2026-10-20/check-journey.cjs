// Extend the established continuous route, preserving its real input and no-pose-correction rules.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), Module = require('node:module');
const source = require.resolve('../lighthouse-finish-2026-10-19/check-journey.cjs');
let code = fs.readFileSync(source, 'utf8');
const replace = (before, after) => {assert.equal(code.split(before).length, 2, before); code = code.replace(before, after);};
replace("record.cases.inward=await walk(0,-1.9);await walk(a.ladder.x,a.ladder.landingY);", `record.cases.inward=await walk(0,-1.9);
await walk(-1.8,-.95);await aim(-1.69,.1,a.floor+1.55);await click();
assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),true);
assert.equal(await page.locator('#lighthouse-panel-state').textContent(),'日间待机');await page.locator('#lighthouse-confirm-control').click();assert.equal(await page.evaluate(()=>room.lighthouseInspection.checks['check-control']),'complete');await shot('journey-ground-panel');
await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);
record.cases.localGroundPanel=true;await walk(a.ladder.x,a.ladder.landingY);`);
replace("await walk(0,-1.05);await walk(.95,-.6);", `await walk(.25,-1.1);await aim(0,-.37,a.gallery+.44);await click();
assert.equal(await page.locator('#lighthouse-panel').evaluate(n=>n.open),true);await shot('journey-test-panel');
await page.locator('#lighthouse-test-toggle').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);
assert.equal(await page.evaluate(()=>room.lighthouseOperation.state),'test-running');
await aim(0,0,t.ground+17.85);const startPhase=await page.evaluate(()=>room.lighthouseOperation.rotationTurns);await render(201);
const observed=await page.evaluate(()=>room.lighthouseOperation);assert.ok(Math.min(Math.abs(observed.rotationTurns-startPhase),1-Math.abs(observed.rotationTurns-startPhase))<.006);
assert.ok(observed.testSecondsRemaining>19&&observed.testSecondsRemaining<21);assert.equal(await page.evaluate(()=>room.lighthouseInspection.checks['check-optic']),'complete');record.cases.fullLiveTestCycle=observed;await shot('journey-optic-after-cycle');
await aim(0,-.37,a.gallery+.44);await click();await page.locator('#lighthouse-test-toggle').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);
assert.equal(await page.evaluate(()=>room.lighthouseOperation.state),'day-standby');
await aim(0,-.38,a.gallery+1.21);await click();assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),'cover');
await page.locator('#lighthouse-cover-check').click();assert.equal(await page.evaluate(()=>room.lighthouseInspection.checks['check-cover']),'dirty');await shot('journey-salt-observed');
await page.locator('#lighthouse-clean-start').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);await render(10);
assert.equal(await page.evaluate(()=>room.lighthouseInspection.cleaning),true);await shot('journey-wipe-visible');
await page.keyboard.press('m');assert.equal(await page.evaluate(()=>room.lighthouseInspection.cleaning),false);assert.equal(await page.evaluate(()=>room.lighthouseInspection.dirty),true);
await page.locator('#floor-plan-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);
await aim(0,-.38,a.gallery+1.21);await click();await page.locator('#lighthouse-clean-start').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);await render(32);
assert.equal(await page.evaluate(()=>room.lighthouseInspection.dirty),false);assert.equal(await page.evaluate(()=>room.lighthouseInspection.checks['check-cover']),'awaiting-recheck');await shot('journey-clean-awaiting-recheck');
await aim(0,-.38,a.gallery+1.21);await click();await page.locator('#lighthouse-cover-check').click();assert.equal(await page.evaluate(()=>room.lighthouseInspection.completed),true);await shot('journey-round-complete');
await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);
record.cases.fullInspectionLoop=await page.evaluate(()=>room.lighthouseInspection);await walk(.95,-.6);`);
replace("await walk(0,-1.9);record.cases.outward=await walk(0,-4.1);", `await walk(.65,-1.05);await walk(.65,1.15);await aim(.08,1.998,a.floor+1.50);await click();
assert.equal(await page.evaluate(()=>room.lighthousePanel.activeLocation),'log');assert.match(await page.locator('#lighthouse-round-summary').textContent(),/本轮三项检查已完成/);await shot('journey-session-journal');
await page.locator('#lighthouse-panel-return').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);record.cases.dynamicJournalAtOriginalClipboard=true;
await walk(.65,-1.05);await walk(0,-1.9);record.cases.outward=await walk(0,-4.1);`);
replace("record.routeBack=[];for(const p of [...route].reverse())record.routeBack.push((await walk(p.x-t.x,p.y-t.y,150)).end);", `record.routeBack=[];for(const p of [...route].reverse()){
record.routeBack.push((await walk(p.x-t.x,p.y-t.y,150)).end);
if(!record.cases.houseSignal&&p.x<-4&&p.x>-5.5&&Math.hypot(p.x,p.y)<7){
 await page.keyboard.press('t');await page.locator('[data-time-hour="21"]').click();await render(28);await page.locator('#time-close').click();
 await page.mouse.click(640,400);await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(150);await aim(0,0,t.ground+17.85);
 const samples=[];for(let i=0;i<201;i++){await render(1);samples.push(await page.evaluate(()=>{const oldDelta=e.getDeltaTime;e.getDeltaTime=()=>0;s.render();e.getDeltaTime=oldDelta;const gl=e._gl,w=e.getRenderWidth(),h=e.getRenderHeight(),n=8,pixels=new Uint8Array(n*n*4);gl.readPixels(Math.floor(w/2-n/2),Math.floor(h/2-n/2),n,n,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let luma=0;for(let j=0;j<pixels.length;j+=4)luma+=pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722;return{phase:room.lighthouseOperation.rotationTurns,luma:luma/(n*n)};}));}
 const values=samples.map(s=>s.luma),peak=values.indexOf(Math.max(...values));assert.ok(Math.max(...values)-Math.min(...values)>.1,JSON.stringify({p,min:Math.min(...values),max:Math.max(...values)}));
 record.cases.houseSignal={position:p,samples,min:Math.min(...values),max:Math.max(...values)};await render(peak);await shot('house-visible-whiteflash');
}
}assert.ok(record.cases.houseSignal);`);
code = code.replace("baseline:'c77c7d2 + lighthouse interior finish'", "baseline:'b10e876 + lighthouse operation phase3'")
  .replaceAll('path.join(__dirname,', 'path.join(output,');
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || path.join(__dirname, 'journey')); fs.mkdirSync(output, {recursive: true});
process.env.STUDY_URL ||= 'http://127.0.0.1:8216/';
const copy = new Module(__filename, module); copy.filename = __filename; copy.paths = Module._nodeModulePaths(__dirname);
copy._compile('const output=' + JSON.stringify(output) + ';\n' + code, __filename);
