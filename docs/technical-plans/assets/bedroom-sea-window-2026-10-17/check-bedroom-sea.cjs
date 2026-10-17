// Focused browser check for the sea-facing guest-room window; fixed delta is not an FPS/load-time sample.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8113/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], warnings = [], responses = new Map();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('response', response => {
    const target = response.url();
    if (!responses.has(target)) responses.set(target, { url: target, status: response.status(), bytes: Number(response.headers()['content-length'] || 0) });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const render = (count = 4) => page.evaluate(count => { for (let i = 0; i < count; i++) studyScene.render(); }, count);
  const shot = async name => { await render(); await page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 }); };
  const pose = (position, target) => page.evaluate(({ position, target }) => {
    const camera = studyScene.activeCamera, V = camera.position.constructor;
    camera.cameraDirection?.setAll(0); camera.cameraRotation?.setAll(0);
    camera.position.set(...position); camera.setTarget(new V(...target)); camera.getViewMatrix(true);
    for (let i = 0; i < 3; i++) studyScene.render();
  }, { position, target });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('全屋八个房间已布置'), null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#audio-status')?.dataset.state === 'ready');
    const initialJs = [...responses.values()].filter(response => new URL(response.url).pathname.endsWith('.js'));
    assert.ok(initialJs.length >= 10, 'required initial JS requests were observed');
    assert.ok(initialJs.reduce((sum, response) => sum + response.bytes, 0) <= 3 * 1048576, 'first-screen JS budget');

    await page.evaluate(() => {
      const id = 900000000 + Math.floor(Math.random() * 90000000);
      webpackChunkbabylon_learning.push([[id], {}, requireFn => self.studyRequire = requireFn]);
      for (const [moduleId, factory] of Object.entries(studyRequire.m)) if (/get LastCreatedEngine/.test(factory.toString()))
        for (const value of Object.values(studyRequire(moduleId))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyScene = value.LastCreatedScene; self.studyEngine = value.LastCreatedEngine;
          value.LastCreatedEngine.stopRenderLoop(); value.LastCreatedEngine.getDeltaTime = () => 50;
        }
    });
    assert.ok(await page.evaluate(() => !!window.studyScene), 'scene handle');

    const facts = await page.evaluate(() => {
      const windowMeshes = studyScene.meshes.filter(mesh => mesh.name.startsWith('bedroom-window-'));
      const seatMeshes = studyScene.meshes.filter(mesh => mesh.name.startsWith('bedroom-reading-seat-'));
      const glass = windowMeshes.find(mesh => mesh.material?.name === 'window-glass');
      const daylight = studyScene.getLightByName('bedroom-window-daylight');
      const box = meshes => {
        const all = meshes.map(mesh => mesh.getBoundingInfo().boundingBox);
        const zero = all[0].centerWorld.clone().setAll(0);
        return { center: meshes.reduce((sum, mesh) => sum.add(mesh.getBoundingInfo().boundingBox.centerWorld), zero).scale(1 / meshes.length).asArray(),
          minY: Math.min(...all.map(value => value.minimumWorld.y)), maxY: Math.max(...all.map(value => value.maximumWorld.y)) };
      };
      return {
        windowMeshes: windowMeshes.map(mesh => mesh.name),
        glass: glass ? { name: glass.name, alpha: glass.material.alpha, emissiveTexture: !!glass.material.emissiveTexture } : null,
        windowBox: box(windowMeshes), seatBox: box(seatMeshes),
        soil: studyScene.getTransformNodeByName('bedroom-seat-root').getAbsolutePosition().asArray(),
        daylight: { position: daylight.position.asArray(), direction: daylight.direction.asArray() },
        westWindowMeshes: studyScene.meshes.filter(mesh => mesh.name.startsWith('bedroom-window-') && mesh.getBoundingInfo().boundingBox.centerWorld.x < -20).length,
      };
    });
    assert.ok(facts.windowMeshes.length > 0, 'guest-room window meshes exist');
    assert.ok(facts.glass && facts.glass.alpha > 0 && facts.glass.alpha < .08 && !facts.glass.emissiveTexture, 'transparent glass without scenery');
    assert.ok(facts.windowBox.center[0] < -6 && facts.windowBox.center[0] > -9, 'window is on the guest-room bay');
    assert.ok(facts.windowBox.center[2] > 25 && facts.windowBox.center[2] < 28, 'window is on the south wall');
    assert.ok(facts.seatBox.center[0] < -6 && facts.seatBox.center[0] > -9 && facts.seatBox.center[2] > 24, 'seat is under the south window');
    assert.ok(facts.seatBox.minY >= -5.001, 'seat is grounded');
    assert.equal(facts.westWindowMeshes, 0, 'no window meshes remain on the west wall');
    assert.ok(facts.daylight.position[2] < 27 && facts.daylight.position[2] > 25, 'daylight sits inside the south window');
    assert.ok(facts.daylight.direction[2] < -.5, 'daylight points into the room');

    await page.locator('[data-view="bedroom"]').click();
    const preset = await page.evaluate(() => {
      const camera = studyScene.activeCamera;
      return { fov: camera.fov, lower: camera.lowerRadiusLimit, position: camera.position.asArray(), target: camera.target.asArray(),
        room: document.querySelector('#floor-plan-mini .is-current')?.getAttribute('data-room') };
    });
    assert.equal(preset.fov, .8); assert.equal(preset.lower, 4); assert.equal(preset.room, 'bedroom');
    assert.ok(preset.target[2] > preset.position[2], 'preset looks south to the sea window');
    await shot('bedroom-preset-1280');

    await page.locator('[data-view="first-person"]').click();
    await page.waitForTimeout(250);
    const eye = (x, y, height) => [(x - 5.4) * 5, -5 + height * 5, (y - 5.4) * 5];
    await pose(eye(2.6, 8.5, 1.6), eye(3.9, 10.8, 1.35));
    await shot('window-sea-1280');
    await pose(eye(2.2, 9.1, 1.3), eye(4.1, 10.6, .65));
    await shot('window-seat-1280');
    await pose(eye(2.8, 8.8, 1.6), eye(0, 8.8, 1.5));
    await shot('west-wall-1280');
    // Leave the walk-in constraints for this evidence-only exterior pose; no playable route is added.
    await page.evaluate(() => studyScene.activeCamera.onAfterCheckInputsObservable.clear());
    await pose(eye(4.6, 14.6, 1.7), eye(3.9, 10.8, 1.6));
    await shot('south-facade-1280');

    for (const [width, height, suffix] of [[390, 844, '390x844'], [844, 390, '844x390']]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      await page.locator('[data-view="bedroom"]').click();
      const room = await page.locator('#floor-plan-mini .is-current').getAttribute('data-room');
      assert.equal(room, 'bedroom');
      assert.ok(await page.locator('.view-controls').evaluate(node => node.getBoundingClientRect().right <= innerWidth));
      await shot('bedroom-preset-' + suffix);
      await page.locator('[data-view="first-person"]').click();
      await page.waitForTimeout(200);
      await pose(eye(2.2, 8.3, 1.6), eye(3.9, 10.8, 1.4));
      await shot('window-sea-' + suffix);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);
    await page.locator('[data-view="bedroom"]').click();

    const failed = [...responses.values()].filter(response => response.status >= 400);
    assert.deepEqual(errors, [], 'no runtime or shader errors');
    assert.deepEqual(failed, [], 'no failed requests');
    const record = {
      passed: true, browser: browser.version(), viewportChecks: ['1280x800', '390x844', '844x390'], dpr: 1,
      fpsOrLoadTimeSampling: false, errors, warnings, failedRequests: failed,
      initialJsFiles: initialJs.length, initialJsBytes: initialJs.reduce((sum, response) => sum + response.bytes, 0),
      facts, preset,
      scene: await page.evaluate(() => ({ meshes: studyScene.meshes.length, vertices: studyScene.getTotalVertices(),
        materials: studyScene.materials.length, textures: studyScene.textures.length, lights: studyScene.lights.length, cameras: studyScene.cameras.length })),
      requests: [...responses.values()],
    };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(record, null, 2) + '\n');
    console.log('Bedroom sea-window browser check passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
