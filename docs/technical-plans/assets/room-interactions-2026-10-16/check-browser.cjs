// Functional/visual checks only: no FPS, CPU/GPU or load-time sampling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8096/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], warnings = [], requests = [];
  let phase = 'initial';
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('response', response => requests.push({ url: response.url(), status: response.status(), phase,
    bytes: Number(response.headers()['content-length'] || 0) }));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const record = { browser: browser.version(), viewport: [1280, 720], deviceScaleFactor: 1,
    cacheDisabled: true, fpsCpuGpuLoadTimeSampling: false, drawers: [], lamps: [], views: [] };
  const render = async (frames = 12) => page.evaluate(frames => {
    for (let i = 0; i < frames; i++) self.studyScene.render();
  }, frames);
  const screenshot = async name => page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 90 });
  const pose = async (position, target) => page.evaluate(({ position, target }) => {
    const camera = self.studyScene.activeCamera, V = camera.position.constructor;
    if (camera.setPosition) camera.lowerRadiusLimit = 0.5; // Allow the close test camera to fit the furniture aisle.
    camera.cameraDirection?.setAll(0); camera.cameraRotation?.setAll(0);
    if (camera.setPosition) {
      camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
      camera.inertialPanningX = camera.inertialPanningY = 0;
    }
    camera.movement.resetPanVelocity(); camera.movement.resetRotationVelocity();
    if (camera.setPosition) camera.setPosition(new V(...position)); else camera.position.set(...position);
    camera.setTarget(new V(...target));
    camera.getViewMatrix(true); camera.getProjectionMatrix(true);
    for (let i = 0; i < 3; i++) self.studyScene.render();
  }, { position, target });
  const drawerState = async id => page.evaluate(id => {
    const scene = self.studyScene;
    const root = id.startsWith('cabinet') ? scene.getMeshByName(`GothicCommode_01_door${({
      'cabinet-drawer-1': '03', 'cabinet-drawer-2': '02', 'cabinet-drawer-3': '01',
    })[id]}`) : scene.getTransformNodeByName(id);
    root.computeWorldMatrix(true);
    const meshes = scene.meshes.filter(mesh => mesh.metadata?.interactionId === id);
    meshes.forEach(mesh => mesh.computeWorldMatrix(true));
    return { position: root.position.asArray(), absolute: root.getAbsolutePosition().asArray(),
      target: meshes[0].getBoundingInfo().boundingBox.centerWorld.asArray(),
      collisions: meshes.every(mesh => mesh.checkCollisions), frozen: meshes.some(mesh => mesh.isWorldMatrixFrozen) };
  }, id);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('胡桃木'), null, { timeout: 120000 });
    record.environment = await page.evaluate(() => {
      self.webpackChunkbabylon_learning.push([[989898], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(self.studyRequire.m)) {
        if (!/get LastCreatedEngine/.test(factory.toString())) continue;
        for (const value of Object.values(self.studyRequire(id))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene;
        }
      }
      if (!self.studyScene) throw new Error('Existing scene not found');
      self.studyEngine.stopRenderLoop();
      self.originalDeltaTime = self.studyEngine.getDeltaTime;
      self.studyEngine.getDeltaTime = () => 50; // Deterministically advance animation; not a performance sample.
      return { glInfo: self.studyEngine.getGlInfo(), staticCaptureRenderLoopStopped: true,
        deterministicAnimationDeltaMilliseconds: 50,
        interactionIds: [...new Set(self.studyScene.meshes.map(mesh => mesh.metadata?.interactionId).filter(Boolean))] };
    });
    record.initialJsBytes = requests.filter(row => /\.js$/.test(row.url)).reduce((sum, row) => sum + row.bytes, 0);
    assert.ok(record.initialJsBytes <= 3 * 1024 * 1024);
    assert.equal(record.environment.interactionIds.length, 10);
    phase = 'views';
    for (const view of ['overview', 'reading', 'desk', 'details', 'cabinet']) {
      await page.locator(`[data-view="${view}"]`).click(); await render(3);
      record.views.push(view); await screenshot(view);
    }
    phase = 'drawers';
    for (const id of ['writing-drawer-1', 'writing-drawer-2', 'console-drawer-1', 'console-drawer-2', 'console-drawer-3',
      'cabinet-drawer-1', 'cabinet-drawer-2', 'cabinet-drawer-3']) {
      await page.locator('[data-view="overview"]').click();
      const closed = await drawerState(id), target = closed.target;
      const position = id.startsWith('console') ? [target[0] + 2.5, target[1] + 0.5, target[2]]
        : [target[0], target[1] + 0.6, target[2] + 6];
      await pose(position, target);
      if (id === 'writing-drawer-1') {
        await page.mouse.click(640, 360, { button: 'right' }); await render(3);
        assert.deepEqual((await drawerState(id)).position, closed.position);
        await page.mouse.move(640, 360); await page.mouse.down();
        await page.mouse.move(660, 360); await page.mouse.move(640, 360); await page.mouse.up(); await render(3);
        assert.deepEqual((await drawerState(id)).position, closed.position, 'dragging out and back must not toggle a drawer');
        await pose(position, target);
        record.clickGuards = { rightClickDoesNotToggle: true, dragOutAndBackDoesNotToggle: true };
      }
      await page.mouse.click(640, 360); await render();
      const opened = await drawerState(id);
      if (JSON.stringify(opened.position) === JSON.stringify(closed.position)) {
        await screenshot('failure-' + id);
        console.log(await page.evaluate(() => {
          const hit = self.studyScene.pickWithRay(self.studyScene.activeCamera.getForwardRay(100), mesh => mesh.isVisible && mesh.isEnabled() && mesh.getTotalVertices() > 0);
          return { camera: self.studyScene.activeCamera.position.asArray(), hit: hit?.pickedMesh?.name, id: hit?.pickedMesh?.metadata?.interactionId };
        }));
      }
      assert.notDeepEqual(opened.position, closed.position, `${id} must open with a real pointer click`);
      assert.ok(opened.collisions && !opened.frozen);
      if (['writing-drawer-1', 'console-drawer-2', 'cabinet-drawer-2'].includes(id)) {
        const photoPosition = id.startsWith('console') ? [opened.target[0] + 5, opened.target[1] + 3, opened.target[2] - 2]
          : [opened.target[0] + 2, opened.target[1] + 3, opened.target[2] + 7];
        await pose(photoPosition, opened.target); await screenshot(id + '-open');
      }
      // The drawer front moved toward the camera; aim at its new centre before closing.
      await pose(position, opened.target);
      await page.mouse.click(640, 360); await render();
      const reclosed = await drawerState(id);
      assert.deepEqual(reclosed.position, closed.position, `${id} must close`);
      record.drawers.push({ id, closed, opened, reclosed });
    }
    phase = 'lamps';
    for (const [id, light, material, target] of [
      ['desk-lamp', 'banker-lamp-light', 'desk-lamp-glow', [-0.55, 1.25, -2.65]],
      ['floor-lamp', 'reading-lamp-light', 'floor-lamp-shade', [16, 2.6, 5]],
    ]) {
      await page.locator('[data-view="overview"]').click();
      await pose([target[0], target[1] + 0.4, target[2] + 7], target);
      const state = () => page.evaluate(({ light, material }) => ({ intensity: self.studyScene.getLightByName(light).intensity,
        emission: self.studyScene.getMaterialByName(material).emissiveColor.asArray() }), { light, material });
      const before = await state(); await screenshot(id + '-on');
      await page.mouse.click(640, 360); await render(3);
      const off = await state(); assert.equal(off.intensity, 0); assert.deepEqual(off.emission, [0, 0, 0]);
      await screenshot(id + '-off');
      await page.mouse.click(640, 360); await render(3);
      assert.deepEqual(await state(), before);
      record.lamps.push({ id, before, off, restored: await state() });
    }
    phase = 'first-person';
    await page.locator('[data-view="desk"]').click();
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && self.studyScene.activeCamera.inputs.attachedToElement);
    assert.ok(await page.locator('#interaction-reticle').isVisible());
    const rotation = await page.evaluate(() => self.studyScene.activeCamera.rotation.asArray());
    await page.mouse.move(710, 375); await render(3);
    const looked = await page.evaluate(() => self.studyScene.activeCamera.rotation.asArray());
    assert.notDeepEqual(looked, rotation, 'mouse must look around without a held button');
    const start = await page.evaluate(() => self.studyScene.activeCamera.position.asArray());
    await page.keyboard.down('w'); await render(5); await page.keyboard.up('w');
    const moved = await page.evaluate(() => self.studyScene.activeCamera.position.asArray());
    assert.notDeepEqual(moved, start);
    await pose([-4.65, 1, 7], [-4.65, -1.14, 1.69]); await render(3);
    assert.match(await page.locator('#interaction-hint').textContent(), /打开书桌左侧抽屉/);
    const closed = await drawerState('writing-drawer-1');
    await page.mouse.down(); await page.mouse.up(); await render();
    const opened = await drawerState('writing-drawer-1');
    assert.notDeepEqual(opened.position, closed.position);
    assert.match(await page.locator('#interaction-hint').textContent(), /关上书桌左侧抽屉/);
    await screenshot('first-person');
    await page.mouse.down(); await page.mouse.up(); await render();
    record.centredLampClicks = [];
    for (const [label, light, position, target] of [
      ['台灯', 'banker-lamp-light', [3, 1, 1], [-0.55, 1.25, -2.65]],
      ['落地灯', 'reading-lamp-light', [16, 1, 9], [16, 2.6, 5]],
    ]) {
      await pose(position, target); await render(3);
      assert.match(await page.locator('#interaction-hint').textContent(), new RegExp('关闭' + label));
      const intensity = await page.evaluate(light => self.studyScene.getLightByName(light).intensity, light);
      await page.mouse.down(); await page.mouse.up(); await render(3);
      assert.equal(await page.evaluate(light => self.studyScene.getLightByName(light).intensity, light), 0);
      assert.match(await page.locator('#interaction-hint').textContent(), new RegExp('打开' + label));
      await page.mouse.down(); await page.mouse.up(); await render(3);
      assert.equal(await page.evaluate(light => self.studyScene.getLightByName(light).intensity, light), intensity);
      record.centredLampClicks.push(label);
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement && document.querySelector('[data-view="desk"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#interaction-reticle').isVisible(), false);
    record.firstPerson = { pointerLockAcquired: true, freeMouseLook: true, rotation, looked, start, moved,
      centredDrawerClick: true, escapeRestoredView: 'desk', reticleHiddenOnExit: true };
    await page.waitForTimeout(1500); // Chrome briefly blocks immediate relocking after a user Escape.
    // Browser release without a page keydown follows the same exit path.
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && self.studyScene.activeCamera.inputs.attachedToElement);
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => self.studyScene.activeCamera.name === 'study-camera');
    record.firstPerson.browserReleaseExits = true;
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && self.studyScene.activeCamera.inputs.attachedToElement);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => !document.pointerLockElement && self.studyScene.activeCamera.name === 'study-camera');
    record.firstPerson.simulatedWindowBlurExits = true;
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && self.studyScene.activeCamera.inputs.attachedToElement);
    await page.evaluate(() => document.querySelector('#settings-btn').click());
    await page.waitForFunction(() => !document.pointerLockElement && !document.querySelector('#settings-menu').hidden);
    assert.equal(await page.evaluate(() => self.studyScene.activeCamera.inputs.attachedToElement), false);
    await page.locator('#settings-close').click();
    await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && self.studyScene.activeCamera.inputs.attachedToElement);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement && self.studyScene.activeCamera.name === 'study-camera');
    record.firstPerson.settingsPauseAndCanvasClickResume = true;
    // A denied request leaves controls detached; the page offers a retry and Escape still exits.
    await page.evaluate(() => {
      const canvas = document.querySelector('#gameCanvas'); self.originalRequestPointerLock = canvas.requestPointerLock;
      canvas.requestPointerLock = () => Promise.reject(new Error('Functional check: lock denied'));
    });
    await page.locator('[data-view="first-person"]').click(); await render(3);
    assert.equal(await page.evaluate(() => !!document.pointerLockElement), false);
    assert.match(await page.locator('#interaction-hint').textContent(), /点击画面/);
    const waiting = await page.evaluate(() => self.studyScene.activeCamera.position.asArray());
    await page.keyboard.down('w'); await render(3); await page.keyboard.up('w');
    assert.deepEqual(await page.evaluate(() => self.studyScene.activeCamera.position.asArray()), waiting);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#gameCanvas').requestPointerLock = self.originalRequestPointerLock);
    record.firstPerson.deniedLockPausesMovement = true;
    phase = 'regression';
    await page.locator('[data-view="overview"]').click();
    const orbit = await page.evaluate(() => ({ alpha: self.studyScene.activeCamera.alpha, radius: self.studyScene.activeCamera.radius }));
    await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(740, 390, { steps: 5 }); await page.mouse.up(); await render(3);
    assert.notEqual(await page.evaluate(() => self.studyScene.activeCamera.alpha), orbit.alpha);
    await page.mouse.wheel(0, -250); await render(3);
    assert.notEqual(await page.evaluate(() => self.studyScene.activeCamera.radius), orbit.radius);
    await page.locator('#settings-btn').click(); assert.ok(await page.locator('#settings-menu').isVisible());
    await page.locator('#movement-speed').evaluate(input => { input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => self.studyScene.getCameraByName('study-first-person').speed), 1.1);
    await page.locator('#settings-reset').click(); await page.locator('#settings-close').click();
    await page.locator('#inspect-btn').click();
    await page.waitForFunction(() => self.studyScene.debugLayer.isVisible() && !document.querySelector('#inspect-btn').disabled, null, { timeout: 60000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#inspect-btn').click());
    await page.waitForFunction(() => !self.studyScene.debugLayer.isVisible());
    const alphaAfterInspector = await page.evaluate(() => self.studyScene.activeCamera.alpha);
    await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(700, 375, { steps: 3 }); await page.mouse.up(); await render(3);
    assert.notEqual(await page.evaluate(() => self.studyScene.activeCamera.alpha), alphaAfterInspector);
    record.regression = { orbitDrag: true, wheelZoom: true, settingsSpeedAndReset: true, inspectorOpenedAndClosed: true,
      orbitControlsWorkAfterInspector: true };
    phase = 'release';
    const releaseRoot = path.resolve(process.env.STUDY_DIST || 'dist');
    const manifest = JSON.parse(fs.readFileSync(path.join(releaseRoot, 'release-manifest.json')));
    record.release = { filesVerified: 0, ...manifest.totals,
      manifestBytes: fs.statSync(path.join(releaseRoot, 'release-manifest.json')).size,
      initialStaticJsBytes: JSON.parse(fs.readFileSync(path.join(releaseRoot, 'bundle-analysis.json'))).initialJsBytes };
    const files = [];
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file); else files.push(file);
      }
    }
    walk(releaseRoot);
    for (const file of files) {
      const response = await context.request.get(new URL(path.relative(releaseRoot, file).split(path.sep).join('/'), url).href);
      assert.equal(response.status(), 200);
      assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),
        crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
      record.release.filesVerified++;
    }
    record.release.completeBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    assert.ok(record.release.completeBytes <= 41 * 1024 * 1024);
    record.interactionExtraRequests = requests.filter(row => row.phase !== 'initial' && row.phase !== 'regression' && row.phase !== 'release').length;
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(!requests.some(row => row.status >= 400));
    record.passed = true;
  } finally {
    Object.assign(record, { phase, errors, warnings, requests });
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(record, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ passed: true, drawers: record.drawers.length, lamps: record.lamps.length,
    initialJsBytes: record.initialJsBytes, release: record.release, errors, warnings }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
