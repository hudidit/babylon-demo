// Native production-panel regression; pose fixtures locate the player, all checks use the real clock.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { serve } = require('./audio-lab.cjs'), { verifyRelease } = require('./verify-study-release.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const { LIGHTHOUSE } = load('LighthouseLayout'), { COASTAL_SITE: { tower } } = load('CoastalSite');
const { planToWorld } = load('HouseLayout'), { lighthouseEquipmentDefinition } = load('LighthouseEquipmentLayout');
const dist = path.resolve(process.env.LAMP_GAME_DIST || 'dist');
const out = path.resolve(process.env.LAMP_CHECK_OUTPUT || 'docs/technical-plans/assets/lamp-panel-2026-10-25');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const report = { baseline: 'cd5c978', errors: [], warnings: [], firstScreen: [], cases: {}, fpsOrLoadSpeedSampling: false,
    method: 'Unmodified production dist. Native world/panel clicks and real render clock for three-second checks. Nearby grounded pose fixtures only. Low-power case uses the original power model with legal 200Wh starting energy; recovery advances original shared active-clock receipts, then native battery recovery button.' };
  const server = await serve(dist), base = 'http://127.0.0.1:' + server.address().port + '/'; let browser;
  try {
    report.release = verifyRelease(dist);
    const raw = fs.readFileSync(path.join(dist, 'release-manifest.json')), manifest = JSON.parse(raw);
    const files = [...manifest.files, { path: 'release-manifest.json', bytes: raw.length, sha256: sha(raw) }];
    for (const prefix of ['', 'audio-lab/']) for (let i = 0; i < files.length; i += 16) await Promise.all(files.slice(i, i + 16).map(async f => {
      const r = await fetch(base + prefix + f.path), b = Buffer.from(await r.arrayBuffer());
      assert.equal(r.status, 200); assert.equal(b.length, f.bytes); assert.equal(sha(b), f.sha256);
    }));
    report.hosted = { prefixes: ['/', '/audio-lab/'], filesPerPrefix: files.length };
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage(), cdp = await context.newCDPSession(page), bodies = []; let initial = true;
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', r => {
      if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url());
      if (initial && new URL(r.url()).pathname.endsWith('.js')) bodies.push(r.body().then(b => report.firstScreen.push({ path: new URL(r.url()).pathname, bytes: b.length, sha256: sha(b) })));
    });
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(base, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'), null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    await page.waitForLoadState('networkidle'); initial = false; await Promise.all(bodies);
    report.firstScreenBytes = report.firstScreen.reduce((n, f) => n + f.bytes, 0);
    assert.ok(report.firstScreenBytes <= require('./study-bundle-analysis.cjs').initialJsBudgetBytes);
    await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    await page.locator('[data-view="first-person"]').click(); await page.waitForFunction(() => !!document.pointerLockElement);
    await page.evaluate(() => room.setTimeAutomatic(false));
    const state = () => page.evaluate(() => ({ panel: room.lighthousePanel.isOpen, location: room.lighthousePanel.activeLocation,
      mainCheck: room.mainCheck, seconds: room.lighthouseInspection.observationSeconds, optic: !!room.lighthouseInspection.optic,
      observed: room.lighthouseInspection.events.filter(e => e.type === 'optic-observed').length,
      mode: room.lighthouseOperation.mode, running: room.lighthouseOperation.running, available: room.lighthouseOperation.available,
      protected: room.lighthousePower.protected, ready: room.lighthousePower.recoveryReady, mainWh: room.lighthousePower.mainWh,
      pauses: room.pauseReasons, guide: document.querySelector('#lighthouse-panel-guide').textContent,
      status: document.querySelector('#lighthouse-panel-state').textContent,
      activity: { hidden: document.querySelector('#lighthouse-activity').hidden, label: document.querySelector('#lighthouse-activity-label').textContent } }));
    const pose = async (x, y, feet, location = 'test') => {
      await page.evaluate(({ position, feet, location }) => {
        const c = room.firstPersonCamera; c.position.copyFromFloats(position.x, position.y, position.z);
        c.cameraDirection.setAll(0); c.cameraRotation.setAll(0); c.movement.resetPanVelocity(); c.movement.resetRotationVelocity();
        Object.assign(room.jump, { feet, grounded: true, velocity: 0, queued: false, originTop: feet });
        room.previousWalk.copyFrom(c.position); room.stableWalk = { position: c.position.clone(), feet };
        const d = room.exterior.lighthouseDetails;
        const mesh = location === 'test' ? d.test.meshes[0] : d.equipment.device(location).meshes.find(m => m.name.endsWith('-labels'));
        mesh.computeWorldMatrix(true); c.setTarget(mesh.getBoundingInfo().boundingBox.centerWorld); c.getViewMatrix(true);
        room.updateInteractionHint();
      }, { position: planToWorld({ x: tower.x + x, y: tower.y + y }, feet + 1.6), feet, location });
      await page.waitForTimeout(180);
    };
    const open = async () => {
      if (!await page.evaluate(() => !!document.pointerLockElement)) {
        await page.locator('#gameCanvas').click(); await page.waitForFunction(() => !!document.pointerLockElement);
      }
      await page.mouse.down(); await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('#lighthouse-panel').open);
    };
    const start = async () => {
      await pose(.25, -1.1, LIGHTHOUSE.gallery); await open();
      const before = await state(); await page.locator('#lighthouse-test-toggle').click();
      return before;
    };
    const complete = async before => {
      await page.waitForFunction(count => room.lighthouseInspection.events.filter(e => e.type === 'optic-observed').length === count + 1, before.observed, { timeout: 12000 });
      const after = await state(); assert.equal(after.panel, false); assert.equal(after.seconds, 3);
      assert.equal(after.mainCheck, undefined); assert.equal(after.optic, true); return after;
    };
    for (const hour of [12, 21]) {
      await page.evaluate(hour => room.setTimeOfDay(hour), hour);
      const before = await start(); await page.waitForTimeout(450); const progress = await state();
      assert.equal(progress.panel, false); assert.ok(progress.seconds > 0 && progress.seconds < 3);
      assert.equal(progress.activity.hidden, false);
      await page.screenshot({ path: path.join(out, 'progress-' + hour + '.jpg'), type: 'jpeg', quality: 85 });
      if (hour === 12) {
        await page.keyboard.press('m'); const paused = await state(); await page.waitForTimeout(700);
        assert.equal((await state()).seconds, paused.seconds); await page.locator('#floor-plan-return').click();
        report.cases.paused = paused;
      }
      const after = await complete(before); assert.equal(after.mode, 'automatic'); assert.equal(after.running, hour === 21);
      report.cases['normal-' + hour] = { before, progress, after };
    }
    await page.evaluate(() => room.setTimeOfDay(12));
    let before = await start(); await page.waitForTimeout(350);
    const battery = lighthouseEquipmentDefinition('lighthouse-battery-main'), sign = battery.sign;
    await pose(sign.x + sign.nx * .75, sign.y + sign.ny * .75, battery.floor, battery.id);
    await page.waitForTimeout(200); const cancelled = await state(); assert.equal(cancelled.mainCheck, undefined);
    assert.equal(cancelled.observed, before.observed); assert.equal(cancelled.running, false); report.cases.departure = cancelled;
    await pose(.25, -1.1, LIGHTHOUSE.gallery);
    await page.evaluate(() => {
      room.lighthousePowerState = new room.lighthousePowerState.constructor({ mainWh: 200 });
      room.synchronizeLighthousePower(); room.notifyLighthouseOperation();
    });
    before = await start(); const rejected = await state();
    assert.equal(rejected.panel, true); assert.equal(rejected.mainCheck, undefined); assert.equal(rejected.available, false);
    assert.match(rejected.guide, /低电保护.*首层.*电池柜/); assert.equal(rejected.status, '大灯检查暂不可用');
    await page.waitForTimeout(800); assert.equal((await state()).observed, before.observed);
    await page.screenshot({ path: path.join(out, 'low-power-desktop.jpg'), type: 'jpeg', quality: 85 });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    await page.locator('#lighthouse-test-toggle').click();
    const narrow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.querySelector('#lighthouse-panel').scrollWidth,
      clientWidth: document.querySelector('#lighthouse-panel').clientWidth, guide: document.querySelector('#lighthouse-panel-guide').textContent }));
    assert.equal(narrow.width, 390); assert.ok(narrow.scrollWidth <= narrow.clientWidth);
    await page.screenshot({ path: path.join(out, 'low-power-portrait.jpg'), type: 'jpeg', quality: 85 });
    report.cases.rejected = { before, after: await state(), narrow };
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#lighthouse-panel-return').click();
    // Accepted scene time charges the original low-energy model; this is not wall-clock recovery timing.
    report.cases.charging = await page.evaluate(() => {
      room.setTimeAutomatic(true); const beforeWh = room.lighthousePower.mainWh; let seconds = 0, frames = 0;
      while (!room.lighthousePower.recoveryReady && frames < 1800) {
        room.updateTimeOfDay(.1); seconds += room.timeState.lastAdvance.activeSeconds; frames++;
      }
      room.setTimeAutomatic(false); return { beforeWh, afterWh: room.lighthousePower.mainWh, ready: room.lighthousePower.recoveryReady, seconds, frames };
    });
    assert.equal(report.cases.charging.ready, true);
    await pose(sign.x + sign.nx * .75, sign.y + sign.ny * .75, battery.floor, battery.id); await open();
    await page.locator('#lighthouse-power-restore').click();
    await page.waitForFunction(() => !room.lighthousePower.protected, null, { timeout: 12000 });
    assert.equal((await state()).available, true); report.cases.recovered = await state();
    before = await start(); report.cases.retried = await complete(before);
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error); }
  finally {
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})();
