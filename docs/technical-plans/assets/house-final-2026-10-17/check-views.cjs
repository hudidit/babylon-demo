// Supplemental close-up and responsive visual checks, never an FPS/load-time sample.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
(async () => {
  const output = process.env.STUDY_CHECK_OUTPUT || __dirname;
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [], requests = [], views = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => requests.push({ url: r.url(), status: r.status() }));
  const shot = name => page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 });
  try {
    await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:8113/');
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'));
    await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989996], {}, r => self.req = r]);
      for (const [id, f] of Object.entries(req.m)) if (/get LastCreatedEngine/.test(f.toString()))
        for (const v of Object.values(req(id))) if (typeof v === 'function' && v.LastCreatedEngine?.scenes?.length) {
          self.s = v.LastCreatedScene; v.LastCreatedEngine.stopRenderLoop();
          v.LastCreatedEngine.getDeltaTime = () => 50;
        }
    });
    for(const id of ['overview','study','living','master','ensuite','bedroom','kitchen','bathroom','balcony']){
      await page.locator(`[data-view="${id}"]`).click();await page.evaluate(()=>{for(let i=0;i<4;i++)s.render();});await shot(id);views.push({id,width:1280,height:800});
    }
    for (const [width, height, mode] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
      await page.setViewportSize({ width, height });
      for (const id of ['overview', 'study', 'living', 'master', 'ensuite', 'bedroom', 'kitchen', 'bathroom', 'balcony']) {
        const button = page.locator(`[data-view="${id}"]`);
        await button.scrollIntoViewIfNeeded(); await button.click();
        await page.evaluate(() => { for (let i = 0; i < 4; i++) s.render(); });
        if(id==='overview')assert.equal(await page.locator('#floor-plan-mini .is-current').count(),0);else assert.equal(await page.locator('#floor-plan-mini .is-current').getAttribute('data-room'), id);
        assert.ok(await page.evaluate(()=>s.activeCamera.radius<=s.activeCamera.upperRadiusLimit));
        assert.ok(await page.evaluate(id=>s.meshes.filter(m=>m.metadata?.exterior).every(m=>id==='overview'?m.material.clipPlane2==null:!!m.material.clipPlane2),id));
        assert.ok(await page.locator('.view-controls').evaluate(n => n.getBoundingClientRect().right <= innerWidth));
        const framing={id,width,height};
        if(id==='overview') {
          framing.floorBounds=await page.evaluate(()=>{
            const c=s.activeCamera,V=c.position.constructor,M=s.getTransformMatrix().constructor;
            const viewport=c.viewport.toGlobal(s.getEngine().getRenderWidth(),s.getEngine().getRenderHeight());
            return s.meshes.filter(m=>m.metadata?.structure==='floor').map(m=>({name:m.name,points:m.getBoundingInfo().boundingBox.vectorsWorld.map(p=>V.Project(p,M.Identity(),s.getTransformMatrix(),viewport).asArray())}));
          });
          assert.equal(framing.floorBounds.length,8);
          assert.ok(framing.floorBounds.every(r=>r.points.every(p=>p[0]>=0&&p[0]<=width&&p[1]>=0&&p[1]<=height)),'all eight actual floors fit the overview');
        }
        await shot(id + '-' + mode); views.push(framing);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await page.evaluate(() => {
      const c = s.activeCamera, V = c.position.constructor;
      const eye = (x, y, h) => new V((x - 5.4) * 5, -5 + h * 5, (y - 5.4) * 5);
      c.position.copyFrom(eye(1.3, 5.55, 1.6)); c.setTarget(eye(1.94, 6.82, 1.6));
      c.getViewMatrix(true); for (let i = 0; i < 4; i++) s.render();
    });
    await shot('ensuite-shower-hardware');
    assert.deepEqual(errors, []); assert.ok(requests.every(r => r.status < 400));
    fs.writeFileSync(path.join(output, 'views.json'), JSON.stringify({ passed: true, views, errors, requests, fpsOrLoadTimeSampling: false }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log('Bedroom and suite responsive views passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
