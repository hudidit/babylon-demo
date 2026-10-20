// Unmodified independent production build. Reference time steps verify behavior, not FPS or loading time.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const baseline = process.argv.includes('--baseline');
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const url = process.env.STUDY_URL || 'http://127.0.0.1:8214/';
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  const record = {baseline: 'b8d9f12', method: 'Independent dist, existing CDP scene capture, actual menu/map/settings events and accepted clock reference steps.',
    mode: baseline ? 'before' : 'phase1', browser: browser.version(), fpsOrLoadTimeSampling: false, errors: [], warnings: [], requests: [], views: []};
  page.on('pageerror', e => record.errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') record.errors.push(m.text()); if (m.type() === 'warning') record.warnings.push(m.text());});
  page.on('response', r => record.requests.push({url: r.url(), status: r.status(), bytes: Number(r.headers()['content-length'] || 0)}));
  const render = () => page.evaluate(async () => {s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render();});
  const snapshot = () => page.evaluate(() => room.lighthouseOperation);
  const step = n => page.evaluate(n => {for (let i = 0; i < n; i++) room.updateTimeOfDay(.1);}, n);
  try {
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await page.goto(url, {timeout: 120000});
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.initialJs = record.requests.filter(r => new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes = record.initialJs.reduce((n, r) => n + r.bytes, 0);
    assert.ok(record.initialJsBytes <= 3 * 1048576);
    assert.ok(record.initialJs.every(r => new URL(r.url).pathname.startsWith(new URL(url).pathname)));
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    await page.evaluate(() => {e.stopRenderLoop(); e.getDeltaTime = () => 0; room.exterior.ocean.clock.advance = () => 0;});
    record.initial = await page.evaluate(() => ({hour: room.timeOfDay.hour, automatic: room.timePlayback.automatic,
      operation: room.lighthouseOperation, metadata: s.metadata.lighthouseOperation}));
    for (const view of ['balcony', 'reading', 'coast']) {
      await page.evaluate(view => room.setView(view), view); await render();
      record.views.push(await page.evaluate(view => ({view,
        resources: {meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
          textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length},
        lighting: s.lights.map(l => ({name: l.name, enabled: l.isEnabled(), intensity: l.intensity,
          direction: l.direction?.asArray(), diffuse: l.diffuse.asArray()})), camera: s.activeCamera.position.asArray()}), view));
      await page.evaluate(() => e.runRenderLoop(self.shotRender = () => s.render()));
      await page.waitForTimeout(150);
      await page.screenshot({path: path.join(output, `${baseline ? 'before' : 'after'}-${view}.jpg`), type: 'jpeg', quality: 90});
      await page.evaluate(() => e.stopRenderLoop(shotRender));
    }
    if (!baseline) {
      assert.deepEqual(record.views, require('./baseline.json').views);
      assert.equal(record.initial.hour, 12); assert.equal(record.initial.automatic, false);
      assert.equal(record.initial.operation.state, 'day-standby');
      assert.equal(record.initial.metadata.stage, 1); assert.equal(record.initial.metadata.visualApplied, false);
      assert.equal(await page.evaluate(() => room.lighthouseOperation === s.metadata.lighthouseOperation.state), true);

      // Real menu selection is paused; the equipment sees only the completed target.
      await page.locator('#time-toggle').click(); await page.locator('[data-time-hour="21"]').click();
      await step(5); assert.equal((await snapshot()).hour, 12);
      await step(7); assert.equal((await snapshot()).hour, 21);
      const paused = await snapshot(); await step(200); assert.deepEqual(await snapshot(), paused);
      await page.locator('#time-close').click(); await step(1); await step(25);
      near((await snapshot()).rotationTurns, .25);
      assert.equal((await snapshot()).automaticOperatingHours, 0);
      assert.equal((await snapshot()).dutyDay, 1);
      assert.equal(await page.evaluate(() => room.startLighthouseTest()), true);
      const started = await snapshot();
      assert.equal(await page.evaluate(() => room.startLighthouseTest()), false);
      assert.deepEqual(await snapshot(), started);
      await step(300); assert.equal((await snapshot()).state, 'night-running');
      near((await snapshot()).rotationTurns, .25);
      assert.equal((await snapshot()).events.filter(e => e.type === 'state-changed').length, 1);
      record.manualNight = await snapshot();

      await page.evaluate(() => room.setTimeOfDay(12)); await step(1);
      await page.evaluate(() => room.startLighthouseTest()); await step(10);
      const beforePause = await snapshot();
      await page.locator('#settings-btn').click(); await step(100);
      assert.deepEqual(await snapshot(), beforePause);
      await page.evaluate(() => room.setPaused('hidden', true));
      await page.locator('#settings-close').click(); await step(100);
      assert.deepEqual(await snapshot(), beforePause);
      await page.evaluate(() => room.setPaused('hidden', false)); await step(1);
      assert.deepEqual(await snapshot(), beforePause);
      await page.evaluate(() => {window.dispatchEvent(new Event('blur'));}); await step(100);
      assert.deepEqual(await snapshot(), beforePause);
      await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await step(1);
      assert.deepEqual(await snapshot(), beforePause);
      await step(10); near((await snapshot()).testSecondsRemaining, 28);
      await page.locator('#floor-plan-toggle').click(); await step(50);
      const mapPause = await snapshot(); await step(50); assert.deepEqual(await snapshot(), mapPause);
      await page.locator('#floor-plan-return').click(); await step(1);
      assert.deepEqual(await snapshot(), mapPause);
      await page.evaluate(() => room.endLighthouseTest()); record.pauses = true;

      // Reference frames go through the production Room update and the existing single scene clock.
      record.boundaries = await page.evaluate(() => {
        room.setView('study'); room.setTimeOfDay(15); room.setTimeAutomatic(true); room.updateTimeOfDay(.1);
        for (let i = 0; i < 1790; i++) room.updateTimeOfDay(.1);
        const before = room.lighthouseOperation; room.startLighthouseTest();
        for (let i = 0; i < 10; i++) room.updateTimeOfDay(.1);
        const evening = room.lighthouseOperation;
        room.setTimeOfDay(21); room.setTimeAutomatic(true); room.updateTimeOfDay(.1);
        for (let i = 0; i < 1800; i++) room.updateTimeOfDay(.1);
        const midnight = room.lighthouseOperation;
        room.setTimeOfDay(3); room.setTimeAutomatic(true); room.updateTimeOfDay(.1);
        for (let i = 0; i < 1800; i++) room.updateTimeOfDay(.1);
        return {before, evening, midnight, morning: room.lighthouseOperation};
      });
      assert.equal(record.boundaries.before.state, 'day-standby');
      assert.equal(record.boundaries.evening.state, 'night-running');
      assert.equal(record.boundaries.evening.mode, 'automatic');
      assert.equal(record.boundaries.midnight.dutyDay, 2); assert.equal(record.boundaries.midnight.hour, 0);
      assert.equal(record.boundaries.morning.state, 'day-standby');
      assert.equal(record.boundaries.morning.hour, 6);
      near(record.boundaries.morning.automaticOperatingHours, 6 + 1 / 60);
      await page.evaluate(() => {room.setTimeAutomatic(false); room.setTimeOfDay(21); room.setView('overview');});
      const hiddenCoast = await snapshot(); await step(25);
      near((await snapshot()).rotationTurns, hiddenCoast.rotationTurns);
      await page.evaluate(() => room.setView('study')); await step(25);
      near((await snapshot()).rotationTurns, (hiddenCoast.rotationTurns + .25) % 1);
      record.coastHiding = true;

      const disposed = await snapshot();
      await page.evaluate(() => {window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide'));
        room.setTimeOfDay(12); room.transitionTimeOfDay(6); room.setTimeAutomatic(true); room.updateTimeOfDay(3600);});
      assert.deepEqual(await snapshot(), disposed);
      assert.equal(await page.evaluate(() => room.startLighthouseTest() || room.endLighthouseTest()), false);
      assert.equal(await page.evaluate(() => s.isDisposed && s.onBeforeRenderObservable.observers.length === 0), true);
      record.disposed = true;
    }
    assert.deepEqual(record.errors, []); assert.deepEqual(record.requests.filter(r => r.status >= 400), []);
    record.passed = true;
  } catch (error) {record.failure = String(error.stack || error); throw error;}
  finally {fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'browser.json'), JSON.stringify(record, null, 2) + '\n'); await browser.close();}
  console.log(JSON.stringify({passed: record.passed, initialJsBytes: record.initialJsBytes, mode: record.mode}));
})().catch(error => {console.error(error); process.exitCode = 1;});
