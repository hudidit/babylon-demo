// Audit completed same-build cycle components, then verify fresh sessions in both engines.
// The optional eight-cycle stress attempt remains interrupted; its unfinished component is never passed.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const output = process.env.STUDY_CHECK_OUTPUT || path.join(__dirname, 'continuity'); fs.mkdirSync(output, {recursive: true});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex'), near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, a + ' != ' + b);
const provenance = require('./diagnostic-eight-day-stress-provenance.json'), stress = require('./diagnostic-eight-day-stress.json');
assert.equal(sha(fs.readFileSync(path.join(__dirname, '../../../../dist/release-manifest.json'))), provenance.releaseManifestSha256);
assert.equal(sha(fs.readFileSync(path.join(__dirname, 'diagnostic-eight-day-stress.cjs'))), provenance.sourceSha256);
assert.equal(sha(fs.readFileSync(path.join(__dirname, 'diagnostic-eight-day-stress.json'))), provenance.resultSha256);
assert.equal(provenance.sourceSha256, provenance.originalSuite.scriptSha256);
assert.equal(provenance.resultSha256, provenance.originalSuite.resultSha256);
assert.equal(stress.releaseManifestSha256, provenance.releaseManifestSha256);
const record = {baseline: '8aea9e9', fpsOrLoadTimeSampling: false, physicalDevicesTested: false,
  method: 'Audit only completed production-observer cycles from the identical-manifest stress record (Chrome 8, WebKit 4), then new bounded fresh-session/reload checks. Overall eight-cycle-per-engine stress was deliberately interrupted; no unfinished fifth WebKit cycle or performance claim.',
  stressAttemptPassed: false, completedCycles: [], freshSessions: [], provenance};
for (const [kind, count] of [['chromium', 8], ['webkit', 4]]) {
  const item = stress.cases.find(c => c.kind === kind); assert.ok(item); assert.equal(item.days.length, count);
  assert.equal(item.firstDay.length, 24); assert.equal(item.manualSelectionsDoNotCreateEvidence, true);
  assert.equal(item.settingsAndFirstResumeFrameFreeze, true); assert.equal(item.focusDoesNotCatchUp, true);
  assert.deepEqual(item.hidden, {frozen: true, resumedWithoutCatchup: true});
  for (const point of item.firstDay) {
    near(point.hour, (12 + point.step / 600) % 24); near(point.operation.hour, point.hour);
    assert.equal(point.operation.running, point.hour >= 18 || point.hour < 6);
    assert.equal(point.operation.dutyDay, point.step < 7200 ? 1 : 2);
    assert.ok(Object.values(point.checks).every(v => v === 'pending'));
  }
  for (const [index, day] of item.days.entries()) {
    near(day.hour, 12); assert.equal(day.operation.dutyDay, index + 2); near(day.operation.automaticOperatingHours, (index + 1) * 12);
    assert.equal(day.inspection.dutyDay, index + 2); assert.equal(day.inspection.dirty, true); assert.equal(day.inspection.coverRevision, 0);
    const retained = Array.from({length: Math.min(index + 2, 7)}, (_, i) => Math.max(1, index - 4) + i);
    assert.deepEqual(day.inspection.days.map(d => d.dutyDay), retained);
    assert.ok(day.inspection.days.every(d => !d.completed && Object.values(d.checks).every(v => v === 'pending')));
    for (const events of [day.operation.events, day.inspection.events]) {
      assert.ok(events.every(e => e.dutyDay >= retained[0] && e.dutyDay <= index + 2));
      assert.ok(events.every((e, i) => i === 0 || e.id > events[i - 1].id));
    }
  }
  assert.deepEqual(item.errors, []); assert.deepEqual(item.warnings, []); assert.deepEqual(item.failedRequests, []);
  if (kind === 'chromium') assert.equal(item.passed, true);
  else assert.equal(item.passed, undefined, 'Interrupted whole WebKit stress must remain incomplete');
  record.completedCycles.push({kind, version: item.version, completeCycles: count, checkpoints: item.firstDay.length,
    dutyDay: item.days.at(-1).operation.dutyDay, retainedDays: item.days.at(-1).inspection.days.map(d => d.dutyDay),
    automaticOperatingHours: item.days.at(-1).operation.automaticOperatingHours, completedComponentPassed: true});
}
(async () => {
  try {
    for (const kind of ['chromium', 'webkit']) {
      console.log('START bounded fresh session ' + kind);
      const browser = await pw[kind].launch({headless: true, executablePath: kind === 'chromium'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE});
      const page = await browser.newPage({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
      const item = {kind, version: browser.version(), errors: [], warnings: [], failedRequests: []};
      page.on('pageerror', e => item.errors.push(e.message));
      page.on('console', m => {if (m.type() === 'error') item.errors.push(m.text()); if (m.type() === 'warning') item.warnings.push(m.text());});
      page.on('response', r => {if (r.status() >= 400) item.failedRequests.push(r.status() + ' ' + r.url());});
      const current = () => page.evaluate(() => ({operation: s.metadata.lighthouseOperation.state,
        inspection: s.metadata.lighthouseOperation.inspection, hour: s.metadata.timeOfDay.state.hour,
        automatic: document.querySelector('#time-automatic').checked}));
      const tick = (n = 1, delta = 100) => page.evaluate(({n, delta}) => {
        e.getDeltaTime = () => delta; for (let i = 0; i < n; i++) s.onBeforeRenderObservable.notifyObservers(s); e.getDeltaTime = () => 0;
      }, {n, delta});
      const load = async () => {
        await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:8217/', {timeout: 120000});
        await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
        await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page); await page.evaluate(() => {e.getDeltaTime = () => 0;});
      };
      const initial = state => {
        assert.equal(state.hour, 12); assert.equal(state.operation.dutyDay, 1); assert.equal(state.operation.automaticOperatingHours, 0);
        assert.equal(state.automatic, false); assert.equal(state.inspection.dirty, true); assert.equal(state.inspection.coverRevision, 0);
        assert.equal(state.inspection.events.length, 0); assert.equal(state.inspection.days.length, 1);
        assert.ok(Object.values(state.inspection.checks).every(v => v === 'pending'));
      };
      try {
        await load(); item.initial = await current(); initial(item.initial);
        await page.locator('[data-view="balcony"]').click(); await page.locator('#time-toggle').click();
        await page.locator('[data-time-hour="21"]').click(); await tick(26, 50);
        assert.equal((await current()).operation.state, 'night-running');
        await page.locator('#time-close').click(); await tick(); const before = await current(); await tick(100);
        item.liveCycle = await current(); near(item.liveCycle.operation.rotationTurns, before.operation.rotationTurns);
        assert.equal(item.liveCycle.operation.dutyDay, 1); assert.equal(item.liveCycle.inspection.completed, false);
        await page.locator('#time-toggle').click(); await page.locator('#time-automatic').check(); await page.locator('#time-close').click();
        await tick(); await tick(10); item.automatic = await current(); assert.ok(item.automatic.hour > 21);
        await page.evaluate(() => {window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide'));});
        item.disposed = await page.evaluate(() => ({meshes: s.meshes.length, materials: s.materials.length, observers: s.onBeforeRenderObservable.observers.length}));
        assert.deepEqual(item.disposed, {meshes: 0, materials: 0, observers: 0});
        await load(); item.refreshed = await current(); initial(item.refreshed);
        assert.deepEqual(item.errors, []); assert.deepEqual(item.warnings, []); assert.deepEqual(item.failedRequests, []); item.passed = true;
      } catch (error) {item.failure = String(error.stack || error); throw error;}
      finally {record.freshSessions.push(item); await browser.close();}
    }
    record.passed = true;
  } finally {fs.writeFileSync(path.join(output, 'continuity.json'), JSON.stringify(record, null, 2) + '\n');}
  console.log(JSON.stringify({passed: record.passed, completedCycles: record.completedCycles, freshSessions: record.freshSessions.map(c => ({kind: c.kind, passed: c.passed})), stressAttemptPassed: false}));
})().catch(error => {console.error(error); process.exitCode = 1;});
