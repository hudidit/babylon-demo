// Final dist, real pointer/keyboard controls. Fixed reference steps are not FPS/load-time samples.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const load = require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {LIGHTHOUSE: a} = load('LighthouseLayout'), {COASTAL_SITE: {tower: t}} = load('CoastalSite');
const out = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname), url = process.env.STUDY_URL || 'http://127.0.0.1:8215/';
const near = (x, y, epsilon = 1e-6) => assert.ok(Math.abs(x - y) < epsilon, `${x} != ${y}`);
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  const record = {baseline: '31f88dc', browser: browser.version(), method: 'Unmodified final dist; actual local clicks, native dialog keyboard, pose fixtures and shared-clock reference steps; separate continuous journey.',
    fpsOrLoadTimeSampling: false, errors: [], warnings: [], requests: [], cases: {}, layout: []};
  page.on('pageerror', e => record.errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') record.errors.push(m.text()); if (m.type() === 'warning') record.warnings.push(m.text());});
  page.on('response', r => record.requests.push({url: r.url(), status: r.status(), bytes: Number(r.headers()['content-length'] || 0)}));
  const frames = n => page.evaluate(async n => {s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); for (let i = 1; i < n; i++) s.render();}, n);
  const step = n => page.evaluate(n => {for (let i = 0; i < n; i++) room.updateTimeOfDay(.05);}, n);
  const state = () => page.evaluate(() => room.lighthouseOperation);
  const click = async () => {await page.mouse.down(); await page.mouse.up();};
  const locked = async () => {await page.waitForFunction(() => !!document.pointerLockElement && room.controlsEnabled); await page.waitForTimeout(150);};
  const pose = async location => page.evaluate(({location, a, t}) => {
    const floor = location === 'control' ? a.floor : a.gallery;
    const c = room.firstPersonCamera, details = room.exterior.lighthouseDetails;
    const p = location === 'control' ? {x: -1.8, y: -.95} : {x: .25, y: -1.1};
    c.position.set((t.x + p.x - 5.4) * 5, -5 + (floor + 1.6) * 5, (t.y + p.y - 5.4) * 5);
    c.cameraDirection.setAll(0); c.cameraRotation.setAll(0); c.movement.resetPanVelocity(); c.movement.resetRotationVelocity();
    Object.assign(room.jump, {feet: floor, grounded: true, velocity: 0, queued: false, originTop: floor});
    room.ladder.attached = false; room.scooter.riding = false;
    room.previousWalk.copyFrom(c.position); room.stableWalk = {position: c.position.clone(), feet: floor};
    const device = location === 'control' ? details.panel : details.test;
    const target = device.meshes[0].getBoundingInfo().boundingBox.centerWorld;
    c.setTarget(target); c.getViewMatrix(true); room.updateControls(); room.updateInteractionHint();
  }, {location, a, t});
  const shot = async name => {
    await page.evaluate(() => e.runRenderLoop(self.shotRender = () => s.render())); await page.waitForTimeout(120);
    await page.screenshot({path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 88});
    await page.evaluate(() => e.stopRenderLoop(shotRender));
  };
  try {
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await page.goto(url, {timeout: 120000});
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.initialJs = record.requests.filter(r => new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes = record.initialJs.reduce((n, r) => n + r.bytes, 0); assert.ok(record.initialJsBytes <= 3 * 1048576);
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    await page.locator('[data-view="first-person"]').click(); await locked();
    await page.evaluate(() => {e.stopRenderLoop(); e.getDeltaTime = () => 0;});
    record.resources = await page.evaluate(() => ({meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
      textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length, metadata: s.metadata.lighthouseOperation,
      moving: room.exterior.lighthouseDetails.beacon.meshes.map(m => ({name: m.name, vertices: m.getTotalVertices()}))}));
    assert.equal(record.resources.metadata.stage, 2); assert.equal(record.resources.metadata.visualApplied, true);
    assert.equal(record.resources.lights, 22); assert.equal(record.resources.cameras, 3); assert.equal(record.resources.textures, 152);

    await pose('control'); await frames(2);
    assert.match(await page.locator('#interaction-hint').textContent(), /首层运行面板/);
    await click(); assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true);
    assert.equal(await page.locator('#lighthouse-panel-state').textContent(), '日间待机');
    assert.equal(await page.locator('#lighthouse-test-toggle').isVisible(), false);
    assert.equal(await page.locator('#time-controls').evaluate(n => n.hidden), true);
    const paused = await state(); await step(200); assert.deepEqual(await state(), paused);
    assert.ok((await page.evaluate(() => room.pauseReasons)).includes('lighthouse-panel'));
    await shot('ground-panel'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), false);
    assert.equal(await page.evaluate(() => room.currentView), 'first-person');
    await page.mouse.click(640, 400); await locked();
    await pose('control'); await click(); await page.locator('#lighthouse-panel-return').click(); await locked();
    record.cases.readOnlyPanelAndReturn = true;

    await pose('test'); await frames(2); assert.match(await page.locator('#interaction-hint').textContent(), /灯室试灯控制/);
    await click(); assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true);
    for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
      await page.setViewportSize({width, height});
      const layout = await page.locator('#lighthouse-panel').evaluate(n => {const r = n.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height,
        inside: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, horizontalOverflow: n.scrollWidth > n.clientWidth + 1};});
      assert.equal(layout.inside, true); assert.equal(layout.horizontalOverflow, false);
      await page.keyboard.press('Tab'); assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.contains(document.activeElement)), true);
      record.layout.push({viewport: [width, height], ...layout}); await shot('test-panel-' + width);
    }
    await page.setViewportSize({width: 1280, height: 800});
    await page.locator('#lighthouse-test-toggle').click(); await locked();
    assert.equal((await state()).state, 'test-running'); near((await state()).testSecondsRemaining, 30);
    await page.evaluate(() => room.firstPersonCamera.setTarget(room.exterior.lighthouseDetails.beacon.root.position));
    await step(1); await step(40); near((await state()).testSecondsRemaining, 28);
    await shot('optic-day-test');
    const phaseBefore = (await state()).rotationTurns;
    await pose('test'); await click(); const remaining = (await state()).testSecondsRemaining;
    await step(100); near((await state()).testSecondsRemaining, remaining);
    await page.evaluate(() => room.setPaused('external', true)); await step(10);
    await page.locator('#lighthouse-test-toggle').click(); assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true);
    near((await state()).testSecondsRemaining, remaining);
    await page.evaluate(() => room.setPaused('external', false));
    await page.locator('#lighthouse-test-toggle').click(); await locked();
    assert.equal((await state()).state, 'day-standby'); near((await state()).rotationTurns, phaseBefore);
    record.cases.testStartPauseEndAndRevalidation = true;

    // A stale control command may not execute after a pose has moved outside the legal floor/range.
    await pose('test'); await click();
    await page.evaluate(() => room.firstPersonCamera.position.x += 30);
    await page.locator('#lighthouse-test-toggle').click(); assert.equal((await state()).state, 'day-standby');
    assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true);
    await page.locator('#lighthouse-panel-return').click(); await locked();
    await pose('test');
    await page.evaluate(() => {room.setTimeOfDay(21); room.exterior.lighthouseDetails.toggle();});
    const workOff = await page.evaluate(() => room.exterior.lighthouseDetails.on);
    assert.equal(workOff, false); assert.equal((await state()).state, 'night-running');
    await click(); await page.locator('#lighthouse-test-toggle').click(); await locked();
    await step(1); await step(600); assert.equal((await state()).state, 'night-running');
    assert.equal((await state()).testSecondsRemaining, 0);
    assert.equal(await page.evaluate(() => room.exterior.lighthouseDetails.on), false);
    record.cases.nightTestDoesNotStopNavigation = true;

    // Actual model phases reach the rendered source. No overridden bundle, shader or clock state.
    record.signal = await page.evaluate(async () => {
      room.firstPersonCamera.setTarget(room.exterior.lighthouseDetails.beacon.root.position); room.firstPersonCamera.getViewMatrix(true);
      const samples = [], gl = e._gl, w = e.getRenderWidth(), h = e.getRenderHeight();
      for (let i = 0; i < 201; i++) {
        if (i) room.updateTimeOfDay(.05);
        s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render();
        const size = 18, pixels = new Uint8Array(size * size * 4);
        gl.readPixels(Math.floor(w / 2 - size / 2), Math.floor(h / 2 - size / 2), size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let luma = 0; for (let n = 0; n < pixels.length; n += 4) luma += pixels[n] * .2126 + pixels[n + 1] * .7152 + pixels[n + 2] * .0722;
        samples.push({seconds: i * .05, phase: room.lighthouseOperation.rotationTurns, luma: luma / (size * size)});
      }
      return samples;
    });
    const bright = record.signal.map(p => p.luma); assert.ok(Math.max(...bright) - Math.min(...bright) > 8);
    record.cases.directionalGpuChange = true;
    await pose('control'); await click(); assert.equal(await page.locator('#lighthouse-panel-state').textContent(), '夜间导航运行');
    await shot('night-panel'); await page.locator('#lighthouse-panel-return').click(); await locked();

    const beforeDispose = await state(); await page.evaluate(() => {room.dispose(); room.dispose(); room.startLighthouseTest(); room.setTimeOfDay(12);});
    assert.deepEqual(await state(), beforeDispose);
    assert.equal(await page.evaluate(() => s.meshes.length + s.materials.length + s.transformNodes.length + s.lights.length), 0);
    assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), false); record.cases.disposal = true;
    assert.deepEqual(record.errors, []); assert.deepEqual(record.requests.filter(r => r.status >= 400), []); record.passed = true;
  } catch (error) {record.failure = String(error.stack || error);
    record.failureContext = await page.evaluate(() => ({view: room.currentView, locked: room.pointerLocked,
      browserLocked: !!document.pointerLockElement, controls: room.controlsEnabled, pauses: room.pauseReasons,
      dialog: room.lighthousePanel.isOpen, jump: {...room.jump}, attached: room.ladder.attached,
      eye: room.firstPersonCamera.position.asArray(), target: room.firstPersonCamera.getTarget().asArray(),
      active: document.activeElement?.outerHTML, hasFocus: document.hasFocus(), modal: room.lighthousePanel.dialog.matches(':modal')}));
    throw error;}
  finally {fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(record, null, 2) + '\n'); await browser.close();}
  console.log(JSON.stringify({passed: record.passed, initialJsBytes: record.initialJsBytes, resources: record.resources, cases: record.cases}));
})().catch(error => {console.error(error); process.exitCode = 1;});
