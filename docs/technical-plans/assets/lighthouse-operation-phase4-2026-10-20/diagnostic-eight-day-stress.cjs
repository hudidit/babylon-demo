// Both engines execute the original production observers, with explicit reference deltas.
// Eight simulated 24-minute cycles test calendar/state integration, never wall-time performance.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const pw = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const output = process.env.STUDY_CHECK_OUTPUT || path.join(__dirname, 'continuity'); fs.mkdirSync(output, {recursive: true});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const record = {baseline: '8aea9e9', fpsOrLoadTimeSampling: false, physicalDevicesTested: false,
  method: 'Final dist; real time/settings UI; original scene observers at 100 ms reference steps. No equipment/clock/model replacement. Synthetic focus/visibility events isolate pause boundaries; no physical background-time claim.', cases: []};
(async () => {
  try {
    for (const kind of ['chromium', 'webkit']) {
      const browser = await pw[kind].launch({headless: true, executablePath: kind === 'chromium'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE});
      const page = await browser.newPage({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
      const item = {kind, version: browser.version(), errors: [], warnings: [], failedRequests: [], days: []};
      page.on('pageerror', e => item.errors.push(e.message));
      page.on('console', m => {if (m.type() === 'error') item.errors.push(m.text()); if (m.type() === 'warning') item.warnings.push(m.text());});
      page.on('response', r => {if (r.status() >= 400) item.failedRequests.push(r.status() + ' ' + r.url());});
      const current = () => page.evaluate(() => ({operation: s.metadata.lighthouseOperation.state,
        inspection: s.metadata.lighthouseOperation.inspection, hour: s.metadata.timeOfDay.state.hour,
        automatic: document.querySelector('#time-automatic').checked,
        playback: s.metadata.timeOfDay.playback, pauses: s.metadata.timeOfDay.pauseReasons}));
      const tick = (n = 1, delta = 100) => page.evaluate(({n, delta}) => {
        e.getDeltaTime = () => delta; for (let i = 0; i < n; i++) s.onBeforeRenderObservable.notifyObservers(s); e.getDeltaTime = () => 0;
      }, {n, delta});
      const load = async () => {
        await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:8217/', {timeout: 120000});
        await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
        await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);
        await page.evaluate(() => {e.getDeltaTime = () => 0;});
      };
      try {
        await load(); item.initial = await current();
        assert.equal(item.initial.hour, 12); assert.equal(item.initial.operation.dutyDay, 1);
        assert.equal(item.initial.inspection.dirty, true); assert.equal(item.initial.automatic, false);
        await page.locator('[data-view="balcony"]').click();
        await page.locator('#time-toggle').click();
        for (const hour of [21, 0, 6, 18, 12]) {
          await page.locator(`[data-time-hour="${hour}"]`).click(); await tick(26, 50);
          const state = await current(); assert.equal(state.hour, hour); assert.equal(state.operation.dutyDay, 1);
          assert.equal(state.operation.automaticOperatingHours, 0); assert.equal(state.operation.rotationTurns, 0);
          assert.ok(Object.values(state.inspection.checks).every(v => v === 'pending'));
        }
        item.manualSelectionsDoNotCreateEvidence = true;
        await page.locator('#time-automatic').check();
        const menu = await current(); await tick(40); assert.deepEqual(await current(), menu);
        await page.locator('#time-close').click(); await tick();
        const start = await current(); assert.equal(start.hour, 12);
        // At the residence, the full equipment state follows the single automatic calendar.
        item.firstDay = await page.evaluate(() => {
          const values = []; e.getDeltaTime = () => 100;
          for (let i = 1; i <= 14400; i++) {
            s.onBeforeRenderObservable.notifyObservers(s);
            if (i % 600 === 0) values.push({step: i, hour: s.metadata.timeOfDay.state.hour,
              operation: s.metadata.lighthouseOperation.state, checks: s.metadata.lighthouseOperation.inspection.checks});
          }
          e.getDeltaTime = () => 0; return values;
        });
        for (const value of item.firstDay) {
          near(value.hour, (12 + value.step / 600) % 24); near(value.operation.hour, value.hour);
          assert.equal(value.operation.running, value.hour >= 18 || value.hour < 6);
          assert.equal(value.operation.dutyDay, value.step < 7200 ? 1 : 2);
          assert.ok(Object.values(value.checks).every(v => v === 'pending'));
        }
        let day = await current(); near(day.operation.automaticOperatingHours, 12);
        assert.equal(day.operation.dutyDay, 2); item.days.push(day);
        const switches = day.operation.events.filter(e => e.type === 'state-changed' && e.source === 'automatic-clock');
        assert.deepEqual(switches.map(e => [e.hour, e.result]), [[18, 'night-running'], [6, 'day-standby']]);
        await page.locator('#settings-btn').click(); const settings = await current();
        await tick(30, 300000); assert.deepEqual(await current(), settings); await page.locator('#settings-close').click();
        const resumed = await current(); await tick(1, 300000); assert.deepEqual(await current(), resumed);
        item.settingsAndFirstResumeFrameFreeze = true;
        await page.evaluate(() => window.dispatchEvent(new Event('blur'))); const blurred = await current();
        await tick(30, 300000); assert.deepEqual(await current(), blurred);
        await page.evaluate(() => window.dispatchEvent(new Event('focus'))); const focused = await current();
        await tick(1, 300000); assert.deepEqual(await current(), focused); item.focusDoesNotCatchUp = true;
        item.hidden = await page.evaluate(() => {
          const before = JSON.stringify(s.metadata.lighthouseOperation);
          Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'));
          e.getDeltaTime = () => 300000; for (let i = 0; i < 10; i++) s.onBeforeRenderObservable.notifyObservers(s);
          const frozen = before === JSON.stringify(s.metadata.lighthouseOperation);
          Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange'));
          e.stopRenderLoop(); s.onBeforeRenderObservable.notifyObservers(s); e.getDeltaTime = () => 0; delete document.hidden;
          return {frozen, resumedWithoutCatchup: before === JSON.stringify(s.metadata.lighthouseOperation)};
        });
        assert.deepEqual(item.hidden, {frozen: true, resumedWithoutCatchup: true});
        for (let index = 2; index <= 8; index++) {
          await tick(14400); day = await current();
          near(day.hour, 12); assert.equal(day.operation.dutyDay, index + 1); near(day.operation.automaticOperatingHours, index * 12);
          assert.equal(day.inspection.dutyDay, day.operation.dutyDay); assert.equal(day.inspection.dirty, true);
          assert.equal(day.inspection.coverRevision, 0); assert.equal(day.inspection.completed, false);
          const retained = Array.from({length: Math.min(index + 1, 7)}, (_, i) => Math.max(1, index - 5) + i);
          assert.deepEqual(day.inspection.days.map(d => d.dutyDay), retained);
          assert.ok(day.inspection.days.every(d => Object.values(d.checks).every(v => v === 'pending')));
          for (const events of [day.operation.events, day.inspection.events]) {
            assert.ok(events.every(e => e.dutyDay >= retained[0] && e.dutyDay <= index + 1));
            assert.ok(events.every((e, i) => i === 0 || e.id > events[i - 1].id));
          }
          item.days.push(day);
        }
        item.resources = await page.evaluate(() => ({meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
          textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length}));
        assert.deepEqual(item.resources, {meshes: 693, vertices: 575224, materials: 103, textures: 152, lights: 22, cameras: 3});
        await page.evaluate(() => {self.finishedScene = s; window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide'));});
        assert.equal(await page.evaluate(() => finishedScene.meshes.length + finishedScene.materials.length + finishedScene.onBeforeRenderObservable.observers.length), 0);
        await load(); item.refreshed = await current();
        assert.equal(item.refreshed.hour, 12); assert.equal(item.refreshed.operation.dutyDay, 1);
        assert.equal(item.refreshed.operation.automaticOperatingHours, 0); assert.equal(item.refreshed.automatic, false);
        assert.equal(item.refreshed.inspection.dirty, true); assert.equal(item.refreshed.inspection.coverRevision, 0);
        assert.equal(item.refreshed.inspection.events.length, 0); assert.equal(item.refreshed.inspection.days.length, 1);
        assert.deepEqual(item.errors, []); assert.deepEqual(item.warnings, []); assert.deepEqual(item.failedRequests, []);
        item.passed = true;
      } catch (error) {item.failure = String(error.stack || error); throw error;}
      finally {record.cases.push(item); await browser.close();}
    }
    record.passed = true;
  } finally {fs.writeFileSync(path.join(output, 'continuity.json'), JSON.stringify(record, null, 2) + '\n');}
  console.log(JSON.stringify({passed: record.passed, cases: record.cases.map(c => ({kind: c.kind, cycles: c.days.length, passed: c.passed}))}));
})().catch(error => {console.error(error); process.exitCode = 1;});
