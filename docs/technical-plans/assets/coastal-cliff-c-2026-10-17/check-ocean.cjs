// Deterministic animation/visual/functional checks. No FPS or loading-time sampling.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const output = __dirname, url = process.env.STUDY_URL || 'http://127.0.0.1:8154/';
const baseline = process.env.STUDY_BASELINE_URL || 'http://127.0.0.1:8155/';
const fault = process.env.STUDY_FAULT === '1';
const shot = (page, name) => page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 });
const render = (page, n = 4) => page.evaluate(async n => {
  s.render();
  // PBR cutaway defines may compile asynchronously. Capture only the settled material variant.
  await new Promise(resolve => s.executeWhenReady(resolve));
  for (let i = 1; i < n; i++) s.render();
}, n);
const pose = (page, position, target) => page.evaluate(({ position, target }) => {
  const c = s.activeCamera, V = c.position.constructor;
  c.lowerRadiusLimit = .05; c.upperRadiusLimit = 10000; c.upperBetaLimit = Math.PI - .01;
  c.inertialAlphaOffset = c.inertialBetaOffset = c.inertialRadiusOffset = 0;
  c.inertialPanningX = c.inertialPanningY = 0;
  c.movement?.resetPanVelocity(); c.movement?.resetRotationVelocity();
  c.setTarget(new V(...target)); c.setPosition(new V(...position));
  c.getViewMatrix(true); c.getProjectionMatrix(true);
  for (let i = 0; i < 4; i++) s.render();
}, { position, target });
const waterTime = page => page.evaluate(() => s.getMaterialByName('coastal-ocean')._floats.oceanTime);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const result = { browser: browser.version(), url, deterministicDeltaMilliseconds: 50, fpsOrLoadTimeSampling: false, fault, views: [] };
  async function ready(context, destination) {
    const page = await context.newPage(), errors = [], warnings = [], responses = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
    page.on('response', r => responses.push({ url: r.url(), status: r.status() }));
    await page.goto(destination, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, { timeout: 120000 });
    await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989991], {}, r => self.req = r]);
      for (const [id, f] of Object.entries(req.m)) if (/get LastCreatedEngine/.test(f.toString()))
        for (const v of Object.values(req(id))) if (typeof v === 'function' && v.LastCreatedEngine?.scenes?.length) {
          self.s = v.LastCreatedScene; self.engine = v.LastCreatedEngine;
          engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
        }
      if (!self.s) throw Error('Production scene not discovered');
    });
    // Audio warming happens after scene readiness. Resolve its normal requests before taking inventory.
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter(e => /\/audio\/study\/.*\.wav$/.test(e.name)).length === 12, null, { timeout: 60000 });
    await render(page);
    return { page, errors, warnings, responses };
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const main = await ready(context, url), { page } = main;
    result.errors = main.errors; result.warnings = main.warnings;
    result.initialAssets = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ url: e.name, initiatorType: e.initiatorType })));
    result.scene = await page.evaluate(() => ({
      version: s.metadata.exteriorVersion, meshes: s.meshes.length, vertices: s.getTotalVertices(),
      materials: s.materials.length, textures: s.textures.length,
      outdoorVertices: s.meshes.filter(m => m.metadata?.exterior).reduce((n, m) => n + m.getTotalVertices(), 0),
      renderTargetTextures: s.textures.filter(t => t.isRenderTarget).map(t => ({ name: t.name, size: t.getSize() })),
      indoorEnvironment: s.environmentTexture.name, imageProcessing: { postprocess: s.imageProcessingConfiguration.applyByPostProcess, aces: s.imageProcessingConfiguration.toneMappingType },
      generatedShore: s.getMaterialByName('coastal-ocean').getActiveTextures().map(t => ({ name: t.name, size: t.getSize(), gamma: t.gammaSpace })),
    }));
    assert.equal(result.scene.indoorEnvironment, './environment/study-interior.hdr');
    await page.locator('[data-view="balcony"]').click(); await render(page, 8);
    await shot(page, fault ? 'fault-balcony' : 'balcony-desktop');
    if (fault) {
      result.fallbacks = await page.evaluate(() => s.metadata.exteriorFallbacks);
      assert.equal(result.fallbacks.length, 2);
      const before = await waterTime(page); await render(page, 10); assert.ok(await waterTime(page) > before);
      assert.ok(!main.errors.some(e => /shader|GLSL|compile|uniform/i.test(e)));
      result.errors = main.errors; result.warnings = main.warnings; result.responses = main.responses;
      fs.writeFileSync(path.join(output, 'fault-browser.json'), JSON.stringify(result, null, 2) + '\n');
      return;
    }
    assert.ok(await page.evaluate(() => s.getMaterialByName('coastal-ocean').getEffect()?.isReady()));
    result.balconyCamera = await page.evaluate(() => ({ position: s.activeCamera.position.asArray(), target: s.activeCamera.target.asArray() }));
    fs.mkdirSync('/tmp/coastal-c-animation', { recursive: true });
    result.animationTimes = [];
    for (let i = 0; i < 20; i++) {
      await render(page, 4);
      result.animationTimes.push(await waterTime(page));
      await page.screenshot({ path: `/tmp/coastal-c-animation/frame-${String(i).padStart(3, '0')}.png` });
    }
    assert.ok(result.animationTimes.every((v, i, a) => !i || v > a[i - 1]));
    // World-space parallax / low gaze / side inspection. No new product presets.
    const eye = (x, y, h) => [(x - 5.4) * 5, -5 + h * 5, (y - 5.4) * 5];
    for (const [name, position, target] of [
      ['balcony-look-down', eye(8.1,11.55,1.6), eye(8.1,27,-22)],
      ['balcony-left', eye(6.6,11.55,1.6), eye(-6,42,-10)],
      ['balcony-right', eye(9.6,11.55,1.6), eye(12,45,-3)],
      ['living-toward-sea', eye(7.3,6.8,1.6), eye(8.1,35,1.2)],
      ['living-shift-right-1m', eye(8.3,6.8,1.6), eye(9.1,35,1.2)],
      ['exterior-side', eye(-65,85,45), eye(5,9,-7)],
      ['sea-grazing', eye(8.1,100,-27), eye(8.1,500,-27)],
      ['sun-glint', eye(8.1,30,1.6), eye(60,65,-24)],
      ['shore-close', eye(22,56,-18), eye(12,25,-28)],
    ]) {
      await pose(page, position, target); await render(page); await shot(page, name);
      if (name === 'exterior-side') result.externalCutaway = await page.evaluate(() => ({
        position: s.activeCamera.position.asArray(), target: s.activeCamera.target.asArray(),
        materials: s.materials.filter(m => /^coastal/.test(m.name)).map(m => ({ name: m.name, clip2: m.clipPlane2?.asArray() || null })),
      }));
      if (name === 'shore-close') for (let i = 0; i < 12; i++) {
        await render(page, 4);
        await page.screenshot({ path: `/tmp/coastal-c-animation/shore-${String(i).padStart(3, '0')}.png` });
      }
    }
    // Hidden view pauses, then resumes continuously without consuming its stale delta.
    await page.locator('[data-view="overview"]').click(); await render(page);
    const hiddenTime = await waterTime(page); await render(page, 12); assert.equal(await waterTime(page), hiddenTime);
    await page.locator('[data-view="balcony"]').click(); await render(page, 1); assert.equal(await waterTime(page), hiddenTime);
    await render(page, 2); assert.ok(await waterTime(page) > hiddenTime);
    result.hiddenAndRestored = true;
    // Exercise the actual document listener with a simulated hidden property (unit test covers clock semantics too).
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const backgroundTime = await waterTime(page); await render(page, 6); assert.equal(await waterTime(page), backgroundTime);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); engine.stopRenderLoop(); engine.getDeltaTime = () => 90000; });
    await render(page, 1); assert.equal(await waterTime(page), backgroundTime);
    await page.evaluate(() => { delete document.hidden; engine.getDeltaTime = () => 50; }); await render(page, 2);
    assert.ok(await waterTime(page) > backgroundTime); result.simulatedBackgroundAndStaleResume = true;
    // Every indoor preset, mirrors, map and settings/Inspector UI on the production output.
    for (const id of ['overview','study','living','master','ensuite','bedroom','kitchen','bathroom','balcony']) {
      await page.locator(`[data-view="${id}"]`).click(); await render(page);
      await shot(page, id + '-regression'); result.views.push({ id, width: 1280, height: 800, dpr: 1 });
    }
    await page.locator('#floor-plan-toggle').click(); await shot(page, 'floor-plan'); await page.keyboard.press('Escape');
    await page.locator('#settings-btn').click(); await page.locator('#settings-close').click();
    await page.locator('#inspect-btn').click(); await page.waitForFunction(() => s.debugLayer.isVisible() && !document.querySelector('#inspect-btn').disabled, null, { timeout: 60000 });
    await page.evaluate(() => document.querySelector('#inspect-btn').click()); await page.waitForFunction(() => !s.debugLayer.isVisible());
    result.settingsAndInspector = true;
    // Drag and zoom remain functional.
    await page.mouse.move(600, 420); await page.mouse.down(); await page.mouse.move(670, 430, { steps: 5 }); await page.mouse.up();
    await page.mouse.wheel(0, -100); await render(page, 10); result.dragZoom = true;
    result.errors = main.errors; result.warnings = main.warnings; result.responses = main.responses;
    assert.deepEqual(result.errors, []); assert.ok(main.responses.every(r => r.status < 400));
    // Baseline same balcony pose, prior production files only.
    const old = await ready(context, baseline); await old.page.locator('[data-view="balcony"]').click(); await render(old.page);
    await pose(old.page, result.balconyCamera.position, result.balconyCamera.target); await shot(old.page, 'before-balcony');
    await old.page.close();
    // Production subpath and both device pixel ratios. Renderer scaling remains its established 1.
    for (const dpr of [1, 2]) {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
      const run = await ready(mobile, url + 'home/');
      for (const [width, height, mode] of [[390,844,'portrait'],[844,390,'landscape']]) {
        await run.page.setViewportSize({ width, height });
        await run.page.locator('[data-view="balcony"]').click(); await render(run.page, 6);
        await shot(run.page, `balcony-${mode}-dpr${dpr}`);
        result.views.push(await run.page.evaluate(() => ({ id: 'balcony', width: innerWidth, height: innerHeight, dpr: devicePixelRatio, render: [engine.getRenderWidth(),engine.getRenderHeight()], camera: s.activeCamera.position.asArray(), waterReady: s.getMaterialByName('coastal-ocean').getEffect().isReady() })));
      }
      if (dpr === 1) result.subpathAssets = await run.page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ url: e.name, initiatorType: e.initiatorType })));
      assert.deepEqual(run.errors, []); assert.ok(run.responses.every(r => r.status < 400));
      await mobile.close();
    }
    // Repeated scene disposal removes the ocean mesh/material/field and its observer.
    result.disposal = await page.evaluate(() => {
      const material = s.getMaterialByName('coastal-ocean'), field = material.getActiveTextures()[0];
      s.dispose(); s.dispose();
      return { meshes: s.meshes.length, materials: s.materials.length, textures: s.textures.length, fieldRetained: s.textures.includes(field), observers: s.onBeforeRenderObservable.observers.length };
    });
    assert.deepEqual(result.disposal, { meshes: 0, materials: 0, textures: 0, fieldRetained: false, observers: 0 });
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('Coastal ocean WebGL visual / animation / lifecycle / subpath checks passed');
  } finally {
    fs.writeFileSync(path.join(output, fault ? 'fault-progress.json' : 'browser-progress.json'), JSON.stringify(result, null, 2) + '\n');
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
