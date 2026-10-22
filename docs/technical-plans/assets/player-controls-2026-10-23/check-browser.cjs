// Final dist only. Native keyboard/pointer input; local grounded poses avoid a full walk to the tower.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const dist = path.join(root, 'dist');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const record = { baseline: '3dc759d', cases: [], prefixes: [] };
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/home\//, '/');
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(dist, '.' + name);
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' })[path.extname(file)] || 'application/octet-stream',
      'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

(async () => {
  let browser;
  try {
    const raw = fs.readFileSync(path.join(dist, 'release-manifest.json'));
    const manifest = JSON.parse(raw);
    record.manifestSha256 = sha(raw);
    record.release = require(path.join(root, 'tools/verify-study-release.cjs')).verifyRelease(dist);
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../lighthouse-story-step5-2026-10-22/release-manifest.json')));
    assert.deepEqual(manifest.files.filter(f => f.kind === 'runtime'), baseline.files.filter(f => f.kind === 'runtime'));
    record.unchangedRuntimeAssets = manifest.files.filter(f => f.kind === 'runtime').length;
    record.sources = Object.fromEntries(['src/examples/Room.ts', 'public/index.html', 'src/examples/LighthouseLayout.ts',
      'src/examples/LighthouseDetails.ts', 'src/examples/LighthouseStoryChapters.ts', 'src/examples/LighthousePanel.ts',
      'public/environment/coastal-cliff-source.json', 'public/STUDY_ASSET_SOURCES.md'].map(p => [p, sha(fs.readFileSync(path.join(root, p)))]));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const files = [...manifest.files, { path: 'release-manifest.json', bytes: raw.length, sha256: sha(raw) }];
    for (const prefix of ['', 'home/']) {
      for (let i = 0; i < files.length; i += 8) await Promise.all(files.slice(i, i + 8).map(async f => {
        const response = await fetch(new URL(prefix + f.path, base));
        assert.equal(response.status, 200, f.path);
        const data = Buffer.from(await response.arrayBuffer());
        assert.equal(data.length, f.bytes); assert.equal(sha(data), f.sha256);
      }));
      record.prefixes.push({ path: '/' + prefix, files: files.length, passed: true });
    }
    browser = await require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core').chromium.launch({
      headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    record.browser = browser.version();
    for (const prefix of ['', 'home/']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await context.newPage();
      const item = { path: '/' + prefix, errors: [], warnings: [], firstScreenJs: [], checks: [], pointerAttempts: [] };
      record.cases.push(item);
      let collecting = true;
      const pending = [];
      page.on('pageerror', error => item.errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') item.errors.push(message.text());
        if (message.type() === 'warning') item.warnings.push(message.text());
      });
      page.on('response', response => {
        if (response.status() >= 400) item.errors.push(`${response.status()} ${response.url()}`);
        if (collecting && new URL(response.url()).pathname.endsWith('.js')) pending.push(response.body().then(data =>
          item.firstScreenJs.push({ path: new URL(response.url()).pathname, bytes: data.length, sha256: sha(data) })));
      });
      await page.goto(new URL(prefix, base).href, { timeout: 120000 });
      await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'), null, { timeout: 120000 });
      await require('../lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, await context.newCDPSession(page));
      await page.evaluate(async () => { await new Promise(resolve => s.executeWhenReady(resolve)); s.render(); });
      await page.waitForLoadState('networkidle'); collecting = false; await Promise.all(pending);
      item.firstScreenBytes = item.firstScreenJs.reduce((n, f) => n + f.bytes, 0);
      assert.ok(item.firstScreenBytes <= 3 * 1048576);
      await page.evaluate(() => { e.stopRenderLoop(); e.getDeltaTime = () => 0; });
      const view = expected => page.waitForFunction(expected => room.currentView === expected, expected);
      const state = () => page.evaluate(() => ({ view: room.currentView, firstPersonCamera: s.activeCamera === room.firstPersonCamera,
        position: room.firstPersonCamera.position.asArray(), rotation: room.firstPersonCamera.rotation.asArray(),
        locked: document.pointerLockElement === document.querySelector('#gameCanvas'),
        buttons: [...document.querySelectorAll('[data-view]')].map(n => [n.dataset.view, n.getAttribute('aria-pressed')]),
        help: document.querySelector('#view-help').textContent, aria: document.querySelector('#gameCanvas').getAttribute('aria-label') }));
      const enter = async label => {
        await page.keyboard.press('Escape'); await view('first-person'); await page.waitForTimeout(180);
        const current = await state();
        assert.equal(current.firstPersonCamera, true);
        assert.deepEqual(current.buttons, [['coast', 'false'], ['first-person', 'true']]);
        item.pointerAttempts.push({ label, lockedFromEscape: current.locked });
        if (!current.locked) {
          await page.mouse.click(630, 310);
          await page.waitForFunction(() => !!document.pointerLockElement);
        }
      };
      const leave = async () => {
        await page.keyboard.press('Escape'); await view('coast');
        const current = await state(); assert.equal(current.firstPersonCamera, false); assert.equal(current.locked, false);
        assert.deepEqual(current.buttons, [['coast', 'true'], ['first-person', 'false']]);
        assert.match(current.help, /ESC 自由探索/); assert.match(current.aria, /ESC 自由探索/);
      };
      await view('coast'); await enter('initial overview'); await leave();
      item.checks.push('initial ESC entry and browser ESC exit');
      if (!prefix) {
        await enter('tower fixture');
        item.towerPose = await page.evaluate(() => {
          const c = room.firstPersonCamera;
          const feet = 3, x = -120, y = 90;
          c.position.set((x - 5.4) * 5, -5 + (feet + 1.6) * 5, (y - 5.4) * 5);
          c.rotation.set(.13, 1.27, 0); c.cameraDirection.setAll(0); c.cameraRotation.setAll(0);
          room.jump.feet = feet; room.jump.grounded = true; room.jump.velocity = 0;
          room.stableWalk = { position: c.position.clone(), feet }; room.previousWalk.copyFrom(c.position);
          return { position: c.position.asArray(), rotation: c.rotation.asArray() };
        });
        for (let i = 0; i < 3; i++) {
          await leave(); await enter('tower return ' + (i + 1));
          const current = await state();
          assert.deepEqual(current.position, item.towerPose.position); assert.deepEqual(current.rotation, item.towerPose.rotation);
        }
        item.checks.push('three tower round trips preserve position and heading');
        await page.keyboard.down('Escape'); await view('coast');
        await page.keyboard.down('Escape'); await page.keyboard.down('Escape'); await view('coast');
        await page.keyboard.up('Escape'); item.checks.push('native held ESC never re-enters overview');
        for (const selector of ['#settings-btn', '#time-toggle', '#floor-plan-toggle']) {
          await page.locator(selector).click(); await page.keyboard.press('Escape');
          await view('coast'); assert.deepEqual(await page.evaluate(() => room.pauseReasons), []);
        }
        await page.keyboard.press('j'); await page.keyboard.press('Escape'); await view('coast');
        assert.equal(await page.locator('#story-panel').evaluate(n => n.open), false);
        item.checks.push('settings, time, map and story own ESC in overview');
        // These synthetic events cover filters only; all mode transitions above use native input.
        const filtered = await page.evaluate(() => {
          const canvas = document.querySelector('#gameCanvas');
          const samples = [];
          for (const options of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
            canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true, ...options }));
            samples.push(room.currentView);
          }
          const input = document.querySelector('#lighthouse-exercise-seed');
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          samples.push(room.currentView);
          room.setControlsEnabled(false);
          canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          samples.push(room.currentView); room.setControlsEnabled(true);
          return samples;
        });
        assert.ok(filtered.every(v => v === 'coast')); item.checks.push('repeat, composition, modifier, input and pause filters');
        await enter('first-person map');
        await page.keyboard.press('m'); await page.keyboard.press('Escape'); await view('first-person');
        assert.equal(await page.locator('#floor-plan-dialog').evaluate(n => n.open), false);
        await leave(); item.checks.push('first-person map closes without changing view');
        await enter('relocated operation panel');
        const aimPanel = async (lateral, across, up) => page.evaluate(({ lateral, across, up }) => {
          const a = room.exterior.lighthouseDetails.panel.meshes[0].getBoundingInfo().boundingBox.centerWorld;
          const c = room.firstPersonCamera, V = c.position.constructor;
          const nx = .8, ny = -.6, tx = .6, ty = .8, floor = 3.54;
          c.position.set(a.x - nx * 5.5 + tx * lateral * 5, -5 + (floor + 1.6) * 5, a.z - ny * 5.5 + ty * lateral * 5);
          c.setTarget(new V(a.x - nx * .07 * 5 + tx * across * 5, a.y + up * 5, a.z - ny * .07 * 5 + ty * across * 5));
          c.cameraDirection.setAll(0); c.cameraRotation.setAll(0);
          Object.assign(room.jump, { feet: floor, grounded: true, velocity: 0, queued: false });
          room.stableWalk = { position: c.position.clone(), feet: floor }; room.previousWalk.copyFrom(c.position);
          room.updateControls(); room.updateInteractionHint(); s.render();
          return { hint: document.querySelector('#interaction-hint').textContent, ladderTarget: room.ladderTarget(), canAccess: room.canAccessLighthouse('control') };
        }, { lateral, across, up });
        item.panelClicks = [];
        for (const lateral of [-.25, 0, .25]) for (const [across, up] of [[0, 0], [-.3, .25], [.3, -.25], [.24, 0]]) {
          if (!await page.evaluate(() => !!document.pointerLockElement)) {
            await page.waitForTimeout(180);
            await page.mouse.click(630, 310);
            try { await page.waitForFunction(() => !!document.pointerLockElement, null, { timeout: 3000 }); }
            catch (error) {
              item.failure = await page.evaluate(() => ({ pauses: room.pauseReasons, view: room.currentView,
                panel: document.querySelector('#lighthouse-panel').open, pointerRequested: room.pointerLock.requested,
                topElement: document.elementFromPoint(630, 310)?.outerHTML.slice(0, 400) }));
              await page.screenshot({ path: path.join(__dirname, 'failure.jpg') }); throw error;
            }
          }
          const aim = await aimPanel(lateral, across, up);
          assert.equal(aim.ladderTarget, false); assert.equal(aim.canAccess, true); assert.match(aim.hint, /首层运行面板/);
          await page.mouse.down(); await page.mouse.up();
          assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true, JSON.stringify({ lateral, across, up }));
          assert.equal(await page.evaluate(() => room.ladder.attached), false);
          await page.keyboard.press('Escape'); await view('first-person');
          assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), false);
          item.panelClicks.push({ lateral, across, up, singleClick: true });
        }
        for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport); await aimPanel(0, 0, 0);
          await page.evaluate(async () => { e.resize(); s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render(); });
          await page.screenshot({ path: path.join(__dirname, `panel-${viewport.width}.jpg`), type: 'jpeg', quality: 88 });
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        // Start a real story at its formal desk entry. Local pose fixtures do not alter device evidence.
        await page.evaluate(() => {
          const c = room.firstPersonCamera, letter = room.storyLetter.mesh;
          c.position.copyFrom(letter.getBoundingInfo().boundingBox.centerWorld); c.position.y = 3; c.position.z += 4;
          Object.assign(room.jump, { feet: 0, grounded: true, velocity: 0 });
          room.openStoryPanel();
        });
        await page.locator('#story-new').click();
        await page.locator('#story-new-confirm').click();
        // Accept duty through the visible letter and confirmation controls.
        await page.waitForFunction(() => !!room.storyChapters);
        await page.locator('[data-story-page="letter"]').click();
        await page.locator('#story-letter-read').click();
        await page.locator('#story-accept').click();
        item.storyGuide = await page.locator('#story-checks').textContent();
        assert.match(item.storyGuide, /白天先在灯座开启60秒试灯/);
        for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: path.join(__dirname, `story-guide-${viewport.width}.jpg`), type: 'jpeg', quality: 88 });
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
          const c = room.firstPersonCamera, floor = 19.64, V = c.position.constructor;
          c.position.set((-125 + .25 - 5.4) * 5, -5 + (floor + 1.6) * 5, (90 - 1.1 - 5.4) * 5);
          c.setTarget(room.exterior.lighthouseDetails.test.meshes[0].getBoundingInfo().boundingBox.centerWorld);
          c.cameraDirection.setAll(0); c.cameraRotation.setAll(0);
          Object.assign(room.jump, { feet: floor, grounded: true, velocity: 0, queued: false });
          room.previousWalk.copyFrom(c.position); room.stableWalk = { position: c.position.clone(), feet: floor };
          room.updateControls(); room.updateInteractionHint(); s.render();
        });
        await page.mouse.click(630, 310); await page.waitForFunction(() => !!document.pointerLockElement);
        await page.mouse.down(); await page.mouse.up();
        assert.equal(await page.locator('#lighthouse-panel').evaluate(n => n.open), true);
        assert.match(await page.locator('#lighthouse-panel-guide').textContent(), /原地看整盏灯/);
        await page.locator('#lighthouse-test-toggle').click();
        await page.waitForFunction(() => !!document.pointerLockElement);
        item.dayTest = await page.evaluate(() => {
          const before = room.lighthouseOperation;
          // Fixed eye and heading for the entire cycle; no source tracking or walking.
          room.firstPersonCamera.position.z -= 2.5;
          room.firstPersonCamera.setTarget(room.exterior.lighthouseDetails.beacon.root.position);
          room.firstPersonCamera.getViewMatrix(true); room.updateTimeOfDay(.1);
          const position = room.firstPersonCamera.position.asArray(), rotation = room.firstPersonCamera.rotation.asArray();
          const samples = [];
          for (let n = 1; n <= 300; n++) {
            room.updateTimeOfDay(.1);
            if ([299, 300].includes(n)) samples.push({ seconds: n / 10, confirmed: !!room.lighthouseInspection.optic,
              observation: room.lighthouseInspection.observationSeconds, turns: room.lighthouseInspection.observedTurns,
              outputSeen: room.lighthouseInspection.outputSeen, remaining: room.lighthouseOperation.testSecondsRemaining });
          }
          return { hour: before.hour, running: before.running, remaining: before.testSecondsRemaining, position, rotation,
            endPosition: room.firstPersonCamera.position.asArray(), endRotation: room.firstPersonCamera.rotation.asArray(),
            weather: room.weather.weather.kind, samples, fact: room.storyBridge.story.fieldWork.checks.find(c => c.id === 'main') };
        });
        assert.ok(item.dayTest.hour >= 6 && item.dayTest.hour < 18); assert.equal(item.dayTest.weather, 'clear');
        assert.equal(item.dayTest.running, true); assert.equal(item.dayTest.remaining, 60);
        assert.equal(item.dayTest.samples[0].confirmed, false); assert.equal(item.dayTest.samples[1].confirmed, true);
        assert.equal(item.dayTest.fact.complete, true); item.checks.push('clear midday native 60-second test confirms actual 30-second cycle and story check');
        assert.deepEqual(item.dayTest.position, item.dayTest.endPosition); assert.deepEqual(item.dayTest.rotation, item.dayTest.endRotation);
        await leave();
        for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport); await page.evaluate(async () => { e.resize(); s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render(); });
          const layout = await page.locator('#view-help').evaluate(n => ({ text: n.textContent,
            scrollWidth: n.scrollWidth, clientWidth: n.clientWidth, right: n.getBoundingClientRect().right, viewport: innerWidth }));
          assert.match(layout.text, /ESC 自由探索/); assert.ok(layout.right <= viewport.width);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          item.checks.push({ viewport, help: layout });
          await page.screenshot({ path: path.join(__dirname, `overview-${viewport.width}.jpg`), type: 'jpeg', quality: 85 });
        }
      }
      assert.deepEqual(item.errors, []);
      await context.close();
    }
    record.passed = true;
    fs.copyFileSync(path.join(dist, 'release-manifest.json'), path.join(__dirname, 'release-manifest.json'));
    console.log(JSON.stringify(record.cases.map(c => ({ path: c.path, firstScreenBytes: c.firstScreenBytes, checks: c.checks, pointerAttempts: c.pointerAttempts, warnings: c.warnings }))));
  } finally {
    fs.writeFileSync(path.join(__dirname, 'browser.json'), JSON.stringify(record, null, 2) + '\n');
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
