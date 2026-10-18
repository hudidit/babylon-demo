// Production WebGL/viewport/animation matrix; emulation is not physical mobile-device acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const pw = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8160/';
const output = path.join(__dirname, 'engines'); fs.mkdirSync(output, { recursive: true });
const matrix = { sourceCommit: 'd1ae3a1', physicalMobileDevices: false, fpsOrLoadTimeSampling: false, engines: [] };
const render = (page, frames = 4) => page.evaluate(async frames => {
  s.render(); await new Promise(resolve => s.executeWhenReady(resolve));
  for (let i = 1; i < frames; i++) s.render();
}, frames);
const shot = (page, name) => page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 88 });
async function discover(page) {
  await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('全屋八个房间已布置'), null, { timeout: 120000 });
  await page.evaluate(() => {
    webpackChunkbabylon_learning.push([[989992], {}, r => self.req = r]);
    for (const [id, f] of Object.entries(req.m)) if (/get LastCreatedEngine/.test(f.toString()))
      for (const v of Object.values(req(id))) if (typeof v === 'function' && v.LastCreatedEngine?.scenes?.length) {
        self.s = v.LastCreatedScene; self.engine = v.LastCreatedEngine;
        engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
      }
    if (!self.s) throw Error('Production scene not found');
  });
}
(async () => {
  for (const kind of (process.env.STUDY_ENGINES || 'chromium,firefox,webkit').split(',')) {
    const record = { kind, passed: false, cases: [], errors: [], warnings: [], failedResponses: [] }; matrix.engines.push(record);
    let browser;
    try {
      browser = await pw[kind].launch({ headless: true, timeout: 20000,
        ...(kind === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
      record.version = browser.version();
      for (const dpr of [1, 2]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr, serviceWorkers: 'block' });
        const page = await context.newPage();
        page.on('pageerror', e => record.errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') record.errors.push(m.text()); if (m.type() === 'warning') record.warnings.push(m.text()); });
        page.on('response', r => { if (r.status() >= 400) record.failedResponses.push({ url: r.url(), status: r.status() }); });
        await page.goto(url + (dpr === 2 ? 'home/' : ''), { timeout: 120000 }); await discover(page);
        await page.locator('#settings-btn').click();
        await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready', null, { timeout: 120000 });
        await page.locator('#settings-close').click();
        record['initialAssetsDpr' + dpr] = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name));
        if (dpr === 1) {
          record.capabilities = await page.evaluate(() => ({ webglVersion: engine.webGLVersion, gl: engine.getGlInfo(),
            indoorEnvironment: s.environmentTexture.name, metadata: s.metadata,
            geometry: { meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length, textures: s.textures.length,
              lights: s.lights.length, cameras: s.cameras.length },
            renderTargets: s.textures.filter(t => t.isRenderTarget).map(t => ({ name: t.name, size: t.getSize() })) }));
          assert.equal(record.capabilities.indoorEnvironment, './environment/study-interior.hdr');
          for (const id of ['overview','study','living','master','ensuite','bedroom','kitchen','bathroom']) {
            await page.locator(`[data-view="${id}"]`).click(); await render(page); await shot(page, `${kind}-${id}`);
          }
        }
        for (const [width, height, name] of [[1280,800,'desktop'],[390,844,'portrait'],[844,390,'landscape']]) {
          await page.setViewportSize({ width, height });
          await page.locator('[data-view="balcony"]').click(); await render(page, 6);
          const state = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
            renderSize: [engine.getRenderWidth(), engine.getRenderHeight()], scaling: engine.getHardwareScalingLevel(),
            eye: s.activeCamera.position.asArray(), seaVertices: s.getMeshByName('coastal-sea').getTotalVertices(),
            waterReady: s.getMaterialByName('coastal-ocean').getEffect()?.isReady(), oceanTime: s.getMaterialByName('coastal-ocean')._floats.oceanTime,
            clipping: s.getMaterialByName('coastal-ocean').clipPlane2?.asArray() || null,
            texture: s.getMaterialByName('coastal-ocean').getActiveTextures().map(t => ({ name: t.name, size: t.getSize(), gamma: t.gammaSpace })) }));
          assert.ok(state.waterReady); assert.equal(state.clipping, null); assert.equal(state.scaling, 1);
          await shot(page, `${kind}-balcony-${name}-dpr${dpr}`); record.cases.push(state);
          if (name === 'desktop' && dpr === 1) {
            record.animationTimes = [];
            for (let i = 0; i < 12; i++) {
              await render(page, 4); record.animationTimes.push(await page.evaluate(() => s.getMaterialByName('coastal-ocean')._floats.oceanTime));
              await page.screenshot({ path: path.join(output, `${kind}-frame-${String(i).padStart(2,'0')}.png`) });
            }
            assert.ok(record.animationTimes.every((t, i, times) => !i || t > times[i-1]));
            await page.locator('[data-view="overview"]').click(); await render(page);
            const paused = await page.evaluate(() => s.getMaterialByName('coastal-ocean')._floats.oceanTime);
            await render(page, 8); assert.equal(await page.evaluate(() => s.getMaterialByName('coastal-ocean')._floats.oceanTime), paused);
            await page.locator('[data-view="balcony"]').click(); await render(page, 1);
            assert.equal(await page.evaluate(() => s.getMaterialByName('coastal-ocean')._floats.oceanTime), paused);
            record.hiddenResume = true;
          }
        }
        record['disposalDpr' + dpr] = await page.evaluate(() => { s.dispose(); s.dispose(); return { meshes: s.meshes.length, materials: s.materials.length, textures: s.textures.length, observers: s.onBeforeRenderObservable.observers.length }; });
        assert.deepEqual(record['disposalDpr' + dpr], { meshes: 0, materials: 0, textures: 0, observers: 0 });
        await context.close();
      }
      assert.deepEqual(record.failedResponses, []); assert.deepEqual(record.errors, []);
      record.passed = true;
    } catch (error) { record.failure = error.stack; record.launchUnavailable = !browser; }
    finally {
      if (browser) await browser.close();
      fs.writeFileSync(path.join(output, 'matrix.json'), JSON.stringify(matrix, null, 2) + '\n');
      console.log(JSON.stringify({ kind, passed: record.passed, cases: record.cases.length, failure: record.failure, warnings: record.warnings.length }));
    }
  }
  assert.ok(matrix.engines.every(r => r.passed), 'Launched engines must all pass; unavailable engines are not passes');
})().catch(error => { console.error(error); process.exitCode = 1; });
