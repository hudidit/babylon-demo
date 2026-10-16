// Functional/layout/request checks only; no FPS or loading-time measurement.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8098/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  const record = { baseline: 'c1e6961', browser: browser.version(), cacheDisabled: true, deviceScaleFactor: 1, fpsOrLoadTimeSampling: false, layouts: [] };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => requests.push({ url: response.url(), status: response.status(), bytes: Number(response.headers()['content-length'] || 0) }));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const render = (count = 4) => page.evaluate(count => { for (let i = 0; i < count; i++) studyScene.render(); }, count);
  const screenshot = async name => {
    await render(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 });
  };
  const state = () => page.evaluate(() => ({ camera: studyScene.activeCamera.name, position: studyScene.activeCamera.position.asArray(),
    rotation: studyScene.activeCamera.rotation.asArray(), target: studyScene.activeCamera.getTarget().asArray(),
    attached: studyScene.activeCamera.inputs.attachedToElement, meshes: studyScene.meshes.length, materials: studyScene.materials.length,
    cameras: studyScene.cameras.length, textures: studyScene.textures.length, locked: !!document.pointerLockElement }));
  const samePose = (a, b) => {
    assert.equal(a.camera, b.camera);
    for (const key of ['position', 'rotation', 'target']) for (let i = 0; i < a[key].length; i++) assert.ok(Math.abs(a[key][i] - b[key][i]) < 0.0001, key);
    for (const key of ['meshes', 'materials', 'cameras', 'textures']) assert.equal(a[key], b[key]);
  };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'));
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.actualInitialJsBytesIncludingAudioPreheat = requests.filter(r => /\.js$/.test(r.url)).reduce((sum, r) => sum + r.bytes, 0);
    assert.ok(record.actualInitialJsBytesIncludingAudioPreheat <= 3 * 1048576);
    await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989890], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(studyRequire.m)) {
        if (!/get LastCreatedEngine/.test(factory.toString())) continue;
        for (const value of Object.values(studyRequire(id))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene;
        }
      }
      studyEngine.stopRenderLoop(); studyEngine.getDeltaTime = () => 50;
    });
    const initial = await state(); record.scene = initial;
    await screenshot('minimap-desktop');
    await page.locator('#floor-plan-toggle').click();
    assert.equal(await page.locator('#floor-plan-dialog').evaluate(node => node.open), true);
    assert.equal(await page.locator('#floor-plan-return').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#floor-plan-drawing [data-room]').count(), 8);
    assert.equal(await page.locator('#floor-plan-drawing .has-content').count(), 2);
    assert.equal(await page.locator('#floor-plan-drawing .plan-room-size').count(), 8);
    assert.equal(await page.locator('.plan-position').count(), 0, 'revised planning dimensions must not pretend to provide exact old-geometry coordinates');
    const beforeInputs = await state(); assert.equal(beforeInputs.attached, false);
    await page.mouse.move(320, 360); await page.mouse.down(); await page.mouse.move(580, 420, { steps: 3 }); await page.mouse.up();
    await page.mouse.wheel(0, -200); await page.keyboard.down('w'); await page.keyboard.down('ArrowLeft'); await render(8);
    await page.keyboard.up('w'); await page.keyboard.up('ArrowLeft');
    await page.evaluate(() => document.querySelector('[data-view="living"]').click());
    samePose(beforeInputs, await state());
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.querySelector('#floor-plan-dialog').contains(document.activeElement)), true); }
    record.orbitInputIsolationAndFocus = true;
    const standaloneSvg = await page.evaluate(() => {
      const svg = document.querySelector('#floor-plan-drawing svg').cloneNode(true);
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = [...document.styleSheets[0].cssRules].filter(rule => rule.selectorText?.startsWith('.plan-')).map(rule => rule.cssText).join('\n');
      svg.prepend(style); return svg.outerHTML;
    });
    fs.writeFileSync(path.join(output, 'floor-plan.svg'), standaloneSvg.replace(/[ \t]+$/gm, '').trimEnd() + '\n');
    for (const [width, height, name] of [[1280, 800, 'map-desktop'], [390, 844, 'map-portrait'], [844, 390, 'map-landscape'], [320, 568, 'map-small-phone']]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { viewport: [innerWidth, innerHeight], dialog: rect(document.querySelector('#floor-plan-dialog')),
          button: rect(document.querySelector('#floor-plan-return')), svg: rect(document.querySelector('#floor-plan-drawing svg')),
          horizontalOverflow: document.querySelector('.map-body').scrollWidth > document.querySelector('.map-body').clientWidth,
          textBounds: [...document.querySelectorAll('#floor-plan-drawing .plan-room text')].every(text => {
            const a = text.getBoundingClientRect(), b = text.parentElement.querySelector('rect').getBoundingClientRect();
            return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom;
          }) };
      });
      assert.ok(layout.dialog.left >= 0 && layout.dialog.right <= width && layout.dialog.top >= 0 && layout.dialog.bottom <= height);
      assert.ok(layout.button.left >= 0 && layout.button.right <= width && layout.button.bottom <= height);
      if (!layout.textBounds || layout.horizontalOverflow) { console.log(layout); await screenshot('failure-layout'); }
      assert.equal(layout.horizontalOverflow, false); assert.equal(layout.textBounds, true);
      record.layouts.push({ name, ...layout }); await screenshot(name);
      if (name === 'map-portrait' || name === 'map-landscape') {
        await page.locator('#floor-plan-room-sizes').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#floor-plan-room-sizes dd').count(), 8);
        assert.ok(await page.locator('#floor-plan-room-sizes').isVisible());
        await screenshot(name + '-dimensions');
        await page.evaluate(() => { document.querySelector('.map-body').scrollTop = 0; document.querySelector('.map-notes').scrollTop = 0; });
      }
    }
    await page.keyboard.press('Escape'); await render(); samePose(initial, await state());
    for (const [width, height, name] of [[390, 844, 'minimap-portrait'], [844, 390, 'minimap-landscape']]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const map = document.querySelector('#floor-plan-toggle').getBoundingClientRect(), nav = document.querySelector('.view-controls').getBoundingClientRect();
        const brand = document.querySelector('.identity').getBoundingClientRect();
        return { map: { top: map.top, left: map.left, bottom: map.bottom, right: map.right }, navTop: nav.top, brandBottom: brand.bottom, brandRight: brand.right };
      });
      assert.ok(layout.map.bottom < layout.navTop && layout.map.left >= 0 && layout.map.right <= width && (layout.map.top > layout.brandBottom || layout.map.left > layout.brandRight));
      await page.locator('[data-view="first-person"]').scrollIntoViewIfNeeded();
      await page.locator('[data-view="overview"]').scrollIntoViewIfNeeded();
      record.layouts.push({ name, ...layout }); await render(); await screenshot(name);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-view="living"]').click(); await render();
    assert.match(await page.locator('#floor-plan-location').textContent(), /正在看客厅/);
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => !!document.pointerLockElement && studyScene.activeCamera.inputs.attachedToElement);
    await page.keyboard.down('w'); await render(4); await page.keyboard.up('w'); await render(12);
    await page.evaluate(() => { studyScene.activeCamera.setTarget(new (studyScene.activeCamera.position.constructor)(50, 1, 12)); });
    await render();
    const walking = await state();
    assert.ok(walking.position[2] < 16); assert.match(await page.locator('#floor-plan-location').textContent(), /你在客厅/);
    assert.equal(await page.locator('#floor-plan-mini [data-room="living"]').getAttribute('class').then(value => value.includes('is-current')), true);
    await page.keyboard.press('m');
    await page.waitForFunction(() => document.querySelector('#floor-plan-dialog').open && !document.pointerLockElement);
    assert.equal(await page.locator('#floor-plan-drawing [data-room="living"].is-current').count(), 1);
    await page.keyboard.down('w'); await page.keyboard.down('ArrowRight'); await render(6); await page.keyboard.up('w'); await page.keyboard.up('ArrowRight');
    samePose(walking, await state()); await screenshot('map-first-person');
    await page.locator('#floor-plan-return').click();
    await page.waitForFunction(() => !!document.pointerLockElement && studyScene.activeCamera.inputs.attachedToElement);
    samePose(walking, await state());
    await page.keyboard.press('m'); await page.waitForFunction(() => !document.pointerLockElement);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#floor-plan-dialog').evaluate(node => node.open), false);
    assert.equal(await page.locator('[data-view="first-person"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => !!document.pointerLockElement), false);
    samePose(walking, await state());
    await page.mouse.click(640, 400);
    await page.waitForFunction(() => !!document.pointerLockElement && studyScene.activeCamera.inputs.attachedToElement);
    // Lock rejection on Return must preserve position, with a real click-to-retry path.
    await page.keyboard.press('m'); await page.waitForFunction(() => !document.pointerLockElement);
    await page.evaluate(() => { const canvas = document.querySelector('#gameCanvas'); self.requestLock = canvas.requestPointerLock; canvas.requestPointerLock = () => Promise.reject(new Error('test denial')); });
    await page.locator('#floor-plan-return').click(); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => !!document.pointerLockElement), false); samePose(walking, await state());
    assert.match(await page.locator('#interaction-hint').textContent(), /点击画面/);
    await page.evaluate(() => document.querySelector('#gameCanvas').requestPointerLock = self.requestLock);
    await page.mouse.click(640, 400); await page.waitForFunction(() => !!document.pointerLockElement);
    await page.keyboard.press('Escape');
    record.firstPerson = { movement: true, currentRoomHighlight: true, shortcut: true, paused: true, buttonResumesLock: true, escapeKeepsPose: true, deniedLockRetry: true };
    await page.locator('[data-view="study"]').click();
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await render(); await page.keyboard.press('m');
    assert.equal(await page.locator('#floor-plan-mini [data-room="study"].is-current').count(), 1);
    assert.equal(await page.locator('#floor-plan-drawing [data-room="study"].is-current').count(), 1);
    assert.equal(await page.locator('.plan-room.is-planned.is-current').count(), 0);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    record.semanticRoomHighlight = true;
    // Repeated toggles must not create Babylon geometry/material/camera resources.
    await page.locator('[data-view="overview"]').click(); await render(); const baseline = await state();
    for (let i = 0; i < 5; i++) { await page.locator('#floor-plan-toggle').click(); await page.locator('#floor-plan-return').click(); }
    samePose(baseline, await state()); record.repeatedOpenCleanup = true;
    await page.locator('#settings-btn').click(); await page.keyboard.press('m');
    assert.equal(await page.locator('#floor-plan-dialog').evaluate(node => node.open), false);
    await page.locator('#settings-close').click(); record.settingsGuard = true;
    // The existing paper modal owns input and hides the map while inspecting the letter.
    await page.locator('[data-view="details"]').click();
    await page.evaluate(() => { const camera = studyScene.activeCamera, V = camera.position.constructor;
      camera.lowerRadiusLimit = .5; camera.setTarget(new V(-3.5, -.36, -.65)); camera.setPosition(new V(-2, 4.6, 3.35));
      camera.getViewMatrix(true); camera.getProjectionMatrix(true); studyScene.render(); });
    await page.mouse.click(640, 400);
    await page.waitForFunction(() => document.querySelector('#item-inspection').open);
    assert.equal(await page.locator('#floor-plan-toggle').isVisible(), false);
    await page.keyboard.press('m'); assert.equal(await page.locator('#floor-plan-dialog').evaluate(node => node.open), false);
    await page.locator('#item-inspection-return').click(); record.paperRegression = true;
    const root = path.resolve('dist'), manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json')));
    for (const file of manifest.files) {
      const response = await context.request.get(new URL(file.path, url).href); assert.equal(response.status(), 200);
      assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'), file.sha256);
    }
    const response = await context.request.get(new URL('release-manifest.json', url).href); assert.equal(response.status(), 200);
    assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'release-manifest.json'))).digest('hex'));
    record.release = { filesVerified: manifest.files.length + 1, totals: manifest.totals, completeBytes: Object.values(manifest.totals).reduce((a, b) => a + b, 0) + fs.statSync(path.join(root, 'release-manifest.json')).size,
      staticInitialJsBytes: JSON.parse(fs.readFileSync(path.join(root, 'bundle-analysis.json'))).initialJsBytes };
    assert.ok(record.release.completeBytes <= 41 * 1048576);
    assert.deepEqual(errors, []); assert.ok(requests.every(r => r.status < 400)); record.passed = true;
  } finally {
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify({ ...record, errors, warnings, requests }, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ passed: record.passed, initialJsBytes: record.actualInitialJsBytesIncludingAudioPreheat, release: record.release, errors, warnings }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
