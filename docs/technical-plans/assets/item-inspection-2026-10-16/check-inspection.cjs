// Functional/visual checks of the independently hosted production directory; no timing/FPS samples.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8097/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const near = (actual, expected, label) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.0001, label + ': ' + JSON.stringify({ actual, expected })));
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
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
  const record = { browser: browser.version(), baseline: '1ba3708', deviceScaleFactor: 1,
    cacheDisabled: true, fpsCpuGpuLoadTimeSampling: false, views: [] };
  const render = async (frames = 3) => page.evaluate(frames => { for (let i = 0; i < frames; i++) self.studyScene.render(); }, frames);
  const screenshot = async name => page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 });
  const state = () => page.evaluate(() => {
    const scene = self.studyScene, camera = scene.activeCamera;
    const letter = scene.meshes.find(mesh => mesh.metadata?.interactionId === 'desk-letter');
    const preview = scene.getMeshByName('inspection-desk-letter');
    return { camera: camera.name, position: camera.position.asArray(), rotation: camera.rotation.asArray(),
      target: camera.getTarget().asArray(), meshes: scene.meshes.length, materials: scene.materials.length,
      textures: scene.textures.length, cameras: scene.cameras.length, engines: self.studyEngine.scenes.length,
      pointerLocked: !!document.pointerLockElement,
      originalLetterWorld: Array.from(letter.getWorldMatrix().m),
      dialog: document.querySelector('#item-inspection').open,
      preview: preview ? { sharedGeometry: preview.geometry === letter.geometry,
        sharedTexture: preview.material.emissiveTexture === letter.material.albedoTexture,
        pickable: preview.isPickable, collisions: preview.checkCollisions, layerMask: preview.layerMask } : null };
  });
  const pose = async firstPerson => page.evaluate(firstPerson => {
    const camera = self.studyScene.activeCamera, V = camera.position.constructor;
    const target = new V(-3.5, -0.36, -0.65);
    camera.cameraDirection?.setAll(0); camera.cameraRotation?.setAll(0);
    camera.movement.resetPanVelocity(); camera.movement.resetRotationVelocity();
    if (firstPerson) { camera.position.set(-5, 1, 3.2); camera.setTarget(target); }
    else {
      camera.lowerRadiusLimit = 0.5;
      camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
      camera.inertialPanningX = camera.inertialPanningY = 0;
      camera.setTarget(target); camera.setPosition(new V(-2, 4.6, 3.35));
    }
    camera.getViewMatrix(true); camera.getProjectionMatrix(true);
    for (let i = 0; i < 3; i++) self.studyScene.render();
  }, firstPerson);
  const open = async firstPerson => {
    if (firstPerson) { await page.mouse.down(); await page.mouse.up(); }
    else await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.querySelector('#item-inspection').open && !document.pointerLockElement);
    await render(); await page.waitForFunction(() => self.studyScene.isReady()); await render();
  };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'), null, { timeout: 120000 });
    record.environment = await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989896], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(studyRequire.m)) {
        if (!/get LastCreatedEngine/.test(factory.toString())) continue;
        for (const value of Object.values(studyRequire(id))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene;
        }
      }
      if (!self.studyScene) throw new Error('Scene not found');
      studyEngine.stopRenderLoop(); studyEngine.getDeltaTime = () => 50;
      return { glInfo: studyEngine.getGlInfo(), viewport: [innerWidth, innerHeight], renderLoopStopped: true,
        deterministicAnimationDeltaMilliseconds: 50 };
    });
    record.initialJsBytes = requests.filter(row => /\.js$/.test(row.url)).reduce((sum, row) => sum + row.bytes, 0);
    assert.ok(record.initialJsBytes <= 3 * 1024 * 1024);
    phase = 'orbit';
    await page.locator('[data-view="details"]').click(); await pose(false);
    const before = await state(); await screenshot('letter-on-desk'); await open(false);
    const opened = await state();
    assert.equal(opened.camera, 'study-item-inspection'); assert.equal(opened.engines, 1);
    assert.ok(opened.preview.sharedGeometry && opened.preview.sharedTexture);
    assert.ok(!opened.preview.pickable && !opened.preview.collisions);
    near(opened.originalLetterWorld, before.originalLetterWorld, 'original letter remains on desk');
    assert.equal(await page.locator('#item-inspection-return').evaluate(button => document.activeElement === button), true);
    const fixed = await state();
    await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(820, 400, { steps: 4 }); await page.mouse.up();
    await page.mouse.wheel(0, -350); await page.keyboard.down('w'); await page.keyboard.down('ArrowLeft'); await render(8);
    await page.keyboard.up('w'); await page.keyboard.up('ArrowLeft');
    const afterInputs = await state(); near(afterInputs.position, fixed.position, 'fixed inspection position'); near(afterInputs.rotation, fixed.rotation, 'fixed inspection rotation');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement?.matches('[data-view], #settings-btn, #inspect-btn, #gameCanvas')), false);
    }
    record.inputIsolation = { mouseKeyboardWheelBlocked: true, tabDoesNotReachSceneControls: true };
    for (const [width, height, name] of [[1280, 720, 'inspection-desktop'], [390, 844, 'inspection-portrait'], [844, 390, 'inspection-landscape']]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(({ width, height }) => studyEngine.getRenderWidth() === width && studyEngine.getRenderHeight() === height, { width, height });
      await render();
      const layout = await page.evaluate(() => {
        const camera = studyScene.activeCamera, preview = studyScene.getMeshByName('inspection-desk-letter');
        const V = camera.position.constructor, M = camera.getWorldMatrix().constructor;
        const transform = camera.getViewMatrix(true).multiply(camera.getProjectionMatrix(true));
        const viewport = { x: 0, y: 0, width: innerWidth, height: innerHeight };
        const points = preview.getBoundingInfo().boundingBox.vectorsWorld.map(point => V.Project(point, M.Identity(), transform, viewport));
        const button = document.querySelector('#item-inspection-return').getBoundingClientRect();
        return { viewport: [innerWidth, innerHeight], min: [Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y))],
          max: [Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y))], button: { top: button.top, bottom: button.bottom, left: button.left, right: button.right } };
      });
      assert.ok(Math.abs((layout.min[0] + layout.max[0]) / 2 - width / 2) < 1);
      assert.ok(Math.abs((layout.min[1] + layout.max[1]) / 2 - height / 2) < 1);
      assert.ok(layout.min[0] > 0 && layout.max[0] < width && layout.min[1] > 0);
      if (!(layout.button.top > layout.max[1] && layout.button.bottom < height)) { console.log(layout); await screenshot('failure-layout'); }
      assert.ok(layout.button.top > layout.max[1] && layout.button.bottom < height);
      record.views.push({ name, ...layout }); await screenshot(name);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(() => studyEngine.getRenderWidth() === 1280 && studyEngine.getRenderHeight() === 720);
    await render();
    await page.locator('#item-inspection-return').click(); await render();
    const returned = await state(); assert.equal(returned.camera, before.camera);
    near(returned.position, before.position, 'orbit return position'); near(returned.target, before.target, 'orbit return target');
    assert.equal(returned.meshes, before.meshes); assert.equal(returned.materials, before.materials);
    await screenshot('returned-to-desk');
    record.orbit = { before, opened, returned, cameraRestored: true };
    for (let i = 0; i < 3; i++) {
      await pose(false); await open(false); await page.keyboard.press('Escape'); await render();
      const closed = await state(); assert.equal(closed.dialog, false); assert.equal(closed.meshes, before.meshes); assert.equal(closed.materials, before.materials);
    }
    record.repeatedOpenCloseWithoutMeshOrMaterialLeak = true;
    phase = 'first-person';
    await page.bringToFront();
    await page.waitForTimeout(1500); // Chrome can briefly reject lock requests following Escape.
    await page.evaluate(() => {
      const canvas = document.querySelector('#gameCanvas'), original = canvas.requestPointerLock;
      self.nativeLockErrors = []; self.inspectionNativeRequest = original;
      canvas.requestPointerLock = function(...args) {
        const result = original.apply(this, args);
        return result?.catch(error => { self.nativeLockErrors.push({name:error.name,message:error.message}); throw error; });
      };
    });
    await page.locator('[data-view="first-person"]').click();
    try {
      await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && studyScene.activeCamera.inputs.attachedToElement, null, {timeout: 5000});
    } catch (error) {
      console.log(await state());
      console.log(await page.evaluate(() => ({ help: document.querySelector('#view-help').textContent, hint: document.querySelector('#interaction-hint').textContent, focus: document.hasFocus(), active: document.activeElement?.id, nativeLockErrors: self.nativeLockErrors })));
      throw error;
    }
    await pose(true); await render();
    assert.match(await page.locator('#interaction-hint').textContent(), /查看桌上的信/);
    const walkingBefore = await state(); await screenshot('first-person-letter-focus'); await open(true);
    assert.equal(await page.locator('#interaction-reticle').isVisible(), false);
    await page.keyboard.down('w'); await render(5); await page.keyboard.up('w');
    await page.locator('#item-inspection-return').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && studyScene.activeCamera.inputs.attachedToElement);
    await render(); const walkingReturned = await state();
    assert.equal(walkingReturned.camera, 'study-first-person');
    near(walkingReturned.position, walkingBefore.position, 'walking return must not teleport');
    near(walkingReturned.rotation, walkingBefore.rotation, 'walking return direction');
    assert.ok(await page.locator('#interaction-reticle').isVisible());
    await open(true); await page.keyboard.press('Escape'); await render();
    const escaped = await state(); assert.equal(escaped.camera, 'study-first-person'); assert.equal(escaped.pointerLocked, false);
    near(escaped.position, walkingBefore.position, 'Escape only closes inspection');
    record.firstPerson = { before: walkingBefore, returned: walkingReturned, escape: escaped, buttonRestoresLock: true, escapeClosesOnlyInspection: true };
    await page.waitForTimeout(1500);
    await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && studyScene.activeCamera.inputs.attachedToElement);
    await pose(true); await open(true);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await state()).dialog, true, 'losing focus must not leave the inspection or reset its saved camera');
    await page.evaluate(() => document.querySelector('#gameCanvas').requestPointerLock = () => Promise.reject(new Error('Functional check: return lock denied')));
    await page.locator('#item-inspection-return').click(); await render();
    const denied = await state(); assert.equal(denied.camera, 'study-first-person'); assert.equal(denied.pointerLocked, false);
    near(denied.position, walkingBefore.position, 'denied lock must still restore the walking position');
    await page.keyboard.down('w'); await render(5); await page.keyboard.up('w');
    near((await state()).position, denied.position, 'denied lock must pause walking');
    await page.evaluate(() => document.querySelector('#gameCanvas').requestPointerLock = self.inspectionNativeRequest);
    await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement?.id === 'gameCanvas' && studyScene.activeCamera.inputs.attachedToElement);
    record.firstPerson.deniedReturnKeepsPositionAndPausesInput = true;
    record.firstPerson.canvasClickRetryRestoresLock = true;
    record.firstPerson.simulatedBlurKeepsInspectionOpen = true;
    record.nativeLockErrors = await page.evaluate(() => self.nativeLockErrors);
    await page.keyboard.press('Escape'); await render();
    assert.equal((await state()).camera, 'study-camera');
    record.inspectionExtraRequests = requests.filter(row => row.phase !== 'initial').length;
    record.passed = true;
    assert.equal(errors.length, 0, errors.join('\n')); assert.ok(!requests.some(row => row.status >= 400));
  } finally {
    Object.assign(record, { phase, errors, warnings, requests });
    fs.writeFileSync(path.join(output, 'inspection-browser.json'), JSON.stringify(record, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ passed: record.passed, initialJsBytes: record.initialJsBytes, views: record.views.length, errors, warnings }));
})().catch(error => { console.error(error); process.exitCode = 1; });
