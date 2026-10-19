// Unmodified production bundle; CDP captures the existing scene for API assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const baseline = process.argv.includes('--baseline');
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
const url = process.env.STUDY_URL || 'http://127.0.0.1:8192/';

(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  const record = {baseline: 'af11fae', mode: baseline ? 'before' : 'stage1', browser: browser.version(),
    fpsOrLoadTimeSampling: false, method: 'Unmodified independent dist; scene API assertions and deterministic ocean/camera screenshot fixtures.', cases: []};
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text());});
  page.on('response', response => requests.push({url: response.url(), status: response.status(), bytes: Number(response.headers()['content-length'] || 0)}));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  const render = () => page.evaluate(async () => {s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render();});
  const visual = () => page.evaluate(() => ({
    lights: s.lights.map(l => ({name: l.name, enabled: l.isEnabled(), intensity: l.intensity,
      direction: l.direction?.asArray(), diffuse: l.diffuse.asArray()})),
    resources: {meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
      textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length},
    exposure: s.imageProcessingConfiguration.exposure, ibl: s.iblIntensity,
    camera: {name: s.activeCamera.name, position: s.activeCamera.position.asArray()}
  }));
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
    await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    record.initialJs = requests.filter(r => new URL(r.url).pathname.endsWith('.js'));
    record.initialJsBytes = record.initialJs.reduce((sum, r) => sum + r.bytes, 0);
    assert.ok(record.initialJsBytes <= 3 * 1048576);
    await page.evaluate(() => {e.stopRenderLoop(); room.exterior.ocean.clock.advance = () => 0;});
    for (const view of ['balcony', 'reading', 'coast']) {
      if (view === 'coast') await page.evaluate(() => room.setView('coast'));
      else await page.locator(`[data-view="${view}"]`).click();
      await render();
      const prefix = baseline ? 'before' : 'after';
      await page.evaluate(() => {self.shotRender = () => s.render(); e.runRenderLoop(self.shotRender);});
      await page.waitForTimeout(250);
      await page.screenshot({path: path.join(output, `${prefix}-${view}.png`)});
      await page.evaluate(() => e.stopRenderLoop(self.shotRender));
      record.cases.push({view, visual: await visual()});
    }
    if (!baseline) {
      const previous = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
      assert.deepEqual(record.cases, previous.cases, 'the three original daylight views retain their lighting, resources and camera pose');
      assert.equal(await page.evaluate(() => room.timeOfDay.hour), 12);
      assert.equal(await page.evaluate(() => s.metadata.timeOfDay.visualApplied), false);
      const before = await visual();
      record.nodes = [];
      for (const hour of [12, 6, 0, 3, 9, 15, 18, 21]) {
        const state = await page.evaluate(hour => room.setTimeOfDay(hour), hour);
        assert.equal(state.hour, hour); assert.equal(state.periodHour, hour);
        assert.equal(state.primary.kind, [0, 3, 21].includes(hour) ? 'moon' : 'sun');
        assert.equal(await page.evaluate(() => room.timeOfDay === s.metadata.timeOfDay.state), true);
        await render(); assert.deepEqual(await visual(), before, 'model stage must not partially apply lighting or move the camera');
        record.nodes.push(state);
      }
      assert.equal(await page.evaluate(() => {try {room.setTimeOfDay(7); return false;} catch {return room.timeOfDay.hour === 21;}}), true);
      for (const view of ['study', 'living', 'overview']) {
        await page.locator(`[data-view="${view}"]`).click(); await render();
        assert.equal(await page.evaluate(() => room.timeOfDay.hour), 21);
      }
      await page.locator('#floor-plan-toggle').click();
      await page.locator('#map-scope-coast').click();
      await page.locator('#coast-return-home').click();
      await page.waitForFunction(() => !!document.pointerLockElement);
      assert.equal(await page.evaluate(() => room.timeOfDay.hour), 21);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.pointerLockElement);
      await page.locator('#settings-btn').click(); await page.locator('#settings-close').click();
      assert.equal(await page.evaluate(() => room.timeOfDay.hour), 21);
      const beforeDispose = await page.evaluate(() => room.timeOfDay);
      await page.evaluate(() => {window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide')); room.setTimeOfDay(6);});
      assert.deepEqual(await page.evaluate(() => room.timeOfDay), beforeDispose);
      assert.equal(await page.evaluate(() => s.isDisposed), true);
      assert.equal(await page.evaluate(() => s.meshes.length), 0);
      record.disposed = true;
    }
    assert.ok(record.initialJs.every(r => new URL(r.url).pathname.startsWith(new URL(url).pathname)));
    assert.deepEqual(errors, []); assert.deepEqual(requests.filter(r => r.status >= 400), []);
    record.passed = true;
  } finally {
    Object.assign(record, {errors, warnings, requests});
    fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'stage1.json'), JSON.stringify(record, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({passed: record.passed, mode: record.mode, initialJsBytes: record.initialJsBytes, nodes: record.nodes?.length}));
})().catch(error => {console.error(error); process.exitCode = 1;});
