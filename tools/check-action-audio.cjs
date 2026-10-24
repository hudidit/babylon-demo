// Stage-B functional/audio-output evidence on independently hosted, unmodified production dist.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { serve } = require('./audio-lab.cjs'), { verifyRelease } = require('./verify-study-release.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const { COASTAL_SITE: { tower } } = load('CoastalSite'), { LIGHTHOUSE } = load('LighthouseLayout');
const layout = load('LighthouseEquipmentLayout');
const dist = path.resolve(process.env.AUDIO_GAME_DIST || 'dist');
const out = path.resolve(process.env.AUDIO_CHECK_OUTPUT || 'docs/technical-plans/assets/audio-phase-b-2026-10-24');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function captureNative() {
  self.audioContexts = []; self.outputNodes = [];
  const Native = self.AudioContext;
  self.AudioContext = class extends Native { constructor(...args) { super(...args); audioContexts.push(this); } };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (...args) {
    if (args[0] === this.context.destination) outputNodes.push(this);
    return connect.apply(this, args);
  };
  self.attachMeter = () => {
    const ctx = audioContexts[0], meter = ctx.createAnalyser(), zero = ctx.createGain();
    meter.fftSize = 4096; zero.gain.value = 0;
    for (const node of new Set(outputNodes.filter(n => n.context === ctx))) node.connect(meter);
    meter.connect(zero); zero.connect(ctx.destination);
    self.measure = async (duration = 150) => {
      let peak = 0; const until = performance.now() + duration, a = new Float32Array(4096);
      while (performance.now() < until) {
        meter.getFloatTimeDomainData(a); for (const v of a) peak = Math.max(peak, Math.abs(v));
        await new Promise(r => setTimeout(r, 12));
      }
      return peak;
    };
  };
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = await serve(dist), base = 'http://127.0.0.1:' + server.address().port + '/';
  const report = { baseline: '3ad2d8e', acousticListening: false, fpsOrLoadSpeedSampling: false,
    method: 'Original production dist; native clicks/pointer lock. Grounded nearby pose fixtures; original updateTimeOfDay(.05) receipts. Solar soiling seeded once through soilFromWeather(). AudioVoice wrappers only observe real play calls; native output taps are after master gain.',
    errors: [], warnings: [], outputs: [], cases: {}, firstScreen: [] };
  let browser, phase = 'hosting';
  try {
    report.release = verifyRelease(dist);
    const raw = fs.readFileSync(path.join(dist, 'release-manifest.json')), manifest = JSON.parse(raw);
    report.manifestSha256 = sha(raw);
    const files = [...manifest.files, { path: 'release-manifest.json', bytes: raw.length, sha256: sha(raw) }];
    for (const prefix of ['', 'audio-lab/']) for (let i = 0; i < files.length; i += 16) await Promise.all(files.slice(i, i + 16).map(async f => {
      const r = await fetch(base + prefix + f.path), b = Buffer.from(await r.arrayBuffer());
      assert.equal(r.status, 200); assert.equal(b.length, f.bytes); assert.equal(sha(b), f.sha256);
    }));
    report.hosted = { prefixes: ['/', '/audio-lab/'], filesPerPrefix: files.length };
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(captureNative);
    const page = await context.newPage(), cdp = await context.newCDPSession(page), bodies = []; let initial = true;
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', r => {
      if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url());
      if (initial && new URL(r.url()).pathname.endsWith('.js')) bodies.push(r.body().then(b => report.firstScreen.push({ path: new URL(r.url()).pathname, bytes: b.length, sha256: sha(b) })));
    });
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    phase = 'cold start'; await page.goto(base, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'), null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    await page.waitForLoadState('networkidle'); initial = false; await Promise.all(bodies);
    report.firstScreenBytes = report.firstScreen.reduce((n, f) => n + f.bytes, 0);
    assert.ok(report.firstScreenBytes <= require('./study-bundle-analysis.cjs').initialJsBudgetBytes);
    report.beforeGesture = await page.evaluate(async () => { attachMeter(); return { peak: await measure(200), context: audioContexts[0].state }; });
    assert.equal(report.beforeGesture.peak, 0);
    await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    await page.locator('#settings-btn').click(); await page.locator('#audio-preview').click();
    await page.evaluate(() => {
      e.stopRenderLoop(); e.getDeltaTime = () => 0; room.audio.setSpatialCamera(undefined);
      self.voiceEvents = [];
      for (const [clip, voices] of room.audio.voices) for (const voice of voices) {
        const play = voice.play; voice.play = function (...args) { voiceEvents.push({ clip, gain: args[0], rate: args[1], position: args[2], time: performance.now() }); return play.apply(this, args); };
      }
    });
    phase = '26 delivered buffers'; console.log(phase);
    const clips = [...require('../public/audio/study/source.json').files, ...require('../public/audio/actions/source.json').files];
    for (const clip of clips) {
      const result = await page.evaluate(async id => {
        room.audio.stopAll(); await new Promise(r => setTimeout(r, 80));
        const cue = id.replace(/-[12]$/, ''); room.audio.previous.set(cue, id.endsWith('-1') ? id.slice(0, -1) + '2' : id.slice(0, -1) + '1');
        const before = room.audio.diagnostics.played; room.audio.play(cue, 'delivered-' + id);
        const peak = await measure(650), activeAfter650ms = room.audio.diagnostics.active;
        return { peak, activeAfter650ms, playedDelta: room.audio.diagnostics.played - before };
      }, clip.id);
      assert.ok(result.peak > .000001 && result.peak < 1, clip.id); assert.equal(result.playedDelta, 1);
      if (clip.loop) assert.equal(result.activeAfter650ms, 1, 'loop survives its source duration');
      else assert.equal(result.activeAfter650ms, 0, 'single action ends without repeating');
      report.outputs.push({ id: clip.id, ...result });
    }
    await page.locator('#settings-close').click();
    const resetEvents = () => page.evaluate(async () => { room.audio.stopAll(); await new Promise(r => setTimeout(r, 100)); voiceEvents.length = 0; });
    const events = () => page.evaluate(() => voiceEvents);
    const frames = n => page.evaluate(async n => { s.render(); await new Promise(r => s.executeWhenReady(r)); for (let i = 1; i < n; i++) s.render(); }, n);
    const shot = async name => { await frames(2); await page.evaluate(() => e.runRenderLoop(self.audioShot = () => s.render())); await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 87 }); await page.evaluate(() => e.stopRenderLoop(audioShot)); };
    const moveDoor = async (id, count) => {
      for (let i = 0; i < count; i++) { await page.evaluate(() => { room.interactions.update(.05); room.audio.update(); }); await page.waitForTimeout(25); }
    };
    const aimDoor = async id => {
      await page.evaluate(id => {
        const state = [...room.interactions.doors, ...room.interactions.slidingDoors].find(row => row.door.id === id);
        const mesh = state.door.meshes[0], V = room.camera.position.constructor; mesh.computeWorldMatrix(true);
        const target = mesh.getBoundingInfo().boundingBox.centerWorld, normal = V.TransformNormal(new V(1, 0, 0), state.door.root.computeWorldMatrix(true)).normalize();
        const c = room.camera; c.lowerRadiusLimit = .5; c.inertialAlphaOffset = c.inertialBetaOffset = c.inertialRadiusOffset = 0;
        c.setTarget(target); c.setPosition(target.add(normal.scale(8)).add(new V(0, .8, 0))); c.getViewMatrix(true); c.getProjectionMatrix(true);
      }, id); await frames(2);
    };
    phase = 'native material door clicks'; console.log(phase);
    report.doors = [];
    for (const [id, view, motion, end] of [['entry-door', 'coast', 'door-move', 'door-latch'], ['balcony-door', 'coast', 'slide-move', 'slide-stop'], ['lighthouse-entry-door', 'coast', 'metal-door-move', 'metal-door-latch']]) {
      await page.locator(`[data-view="${view}"]`).click(); await resetEvents(); await aimDoor(id); await page.mouse.click(640, 400);
      await moveDoor(id, 1); const openPeak = await page.evaluate(() => measure(180)); await moveDoor(id, 22);
      let opened = await page.evaluate(id => [...room.interactions.doors, ...room.interactions.slidingDoors].find(row => row.door.id === id).progress, id);
      assert.equal(opened, 1, id); assert.ok(openPeak > .000001); assert.ok((await events()).some(row => row.clip.startsWith(motion + '-')));
      assert.ok(!(await events()).some(row => row.clip.startsWith(end + '-')), 'opening never latches');
      await aimDoor(id); await page.mouse.click(640, 400); await moveDoor(id, 26); await page.waitForTimeout(120);
      const closed = await page.evaluate(id => [...room.interactions.doors, ...room.interactions.slidingDoors].find(row => row.door.id === id).progress, id);
      assert.equal(closed, 0, id); assert.equal((await events()).filter(row => row.clip.startsWith(end + '-')).length, 1);
      const silence = await page.evaluate(() => measure()); assert.equal(silence, 0);
      console.log('Door passed: ' + id);
      report.doors.push({ id, opened, closed, openPeak, silence, events: await events() });
    }
    phase = 'native cleaning'; console.log(phase);
    await page.locator('[data-view="first-person"]').click();
    const locked = async () => { await page.waitForFunction(() => !!document.pointerLockElement && room.controlsEnabled); await page.waitForTimeout(80); };
    await locked();
    await page.evaluate(() => { room.setWeather('clear'); room.setTimeAutomatic(false); room.setTimeOfDay(12); });
    const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) room.updateTimeOfDay(.05); room.audio.update(); }, n);
    const state = () => page.evaluate(() => ({ i: room.lighthouseInspection, m: room.lighthouseMaintenance, audio: room.audio.diagnostics }));
    const open = async id => {
      let x, y, floor;
      if (id === 'cover') { x = .25; y = -1.1; floor = LIGHTHOUSE.gallery; }
      else { const d = layout.lighthouseEquipmentDefinition(id), v = d.sign; x = v.x + v.nx * .75; y = v.y + v.ny * .75; floor = d.floor; }
      await page.evaluate(({ id, x, y, floor, tower }) => {
        const c = room.firstPersonCamera, V = c.position.constructor;
        const d = room.exterior.lighthouseDetails, mesh = id === 'cover' ? d.cover.pane : d.equipment.device(id).meshes.find(m => m.name.endsWith('-labels'));
        mesh.computeWorldMatrix(true); const target = mesh.getBoundingInfo().boundingBox.centerWorld;
        c.position.set((tower.x + x - 5.4) * 5, -5 + (floor + 1.6) * 5, (tower.y + y - 5.4) * 5);
        c.cameraDirection.setAll(0); c.cameraRotation.setAll(0); c.movement.resetPanVelocity(); c.movement.resetRotationVelocity();
        Object.assign(room.jump, { feet: floor, grounded: true, velocity: 0, queued: false, originTop: floor });
        room.previousWalk.copyFrom(c.position); room.stableWalk = { position: c.position.clone(), feet: floor };
        c.setTarget(new V(target.x, target.y, target.z)); c.getViewMatrix(true); room.updateInteractionHint();
      }, { id, x, y, floor, tower });
      await frames(2); assert.equal(await page.evaluate(id => room.canAccessLighthouse(id), id), true);
      await page.mouse.down(); await page.mouse.up();
      assert.equal(await page.evaluate(() => room.lighthousePanel.activeLocation), id);
    };
    await open('cover'); await page.locator('#lighthouse-cover-check').click(); await resetEvents();
    await page.locator('#lighthouse-clean-start').click(); await locked(); await step(13);
    assert.equal((await state()).i.cleaning, true); const coverRunningPeak = await page.evaluate(() => measure(650));
    assert.ok(coverRunningPeak > .000001); assert.equal((await events()).filter(row => row.clip.startsWith('cloth-wipe-')).length, 1);
    await shot('cover-cleaning');
    await page.evaluate(() => { const c = room.firstPersonCamera; c.setTarget(c.position.add(c.getForwardRay().direction.scale(-5))); c.getViewMatrix(true); });
    await step(1); await page.waitForTimeout(120);
    const cancelled = { state: await state(), events: await events(), peak: await page.evaluate(() => measure()) };
    assert.equal(cancelled.state.i.dirty, true); assert.equal(cancelled.state.i.cleaning, false); assert.equal(cancelled.peak, 0);
    assert.ok(!cancelled.events.some(row => row.clip.startsWith('cloth-lift-'))); report.cases.coverCancelled = cancelled;
    await open('cover'); await resetEvents(); await page.locator('#lighthouse-clean-start').click(); await locked(); await step(32);
    const cover = { state: await state(), events: await events() }; assert.equal(cover.state.i.dirty, false);
    assert.equal(cover.state.i.checks['check-cover'], 'awaiting-recheck'); assert.equal(cover.events.filter(row => row.clip.startsWith('cloth-lift-')).length, 1);
    await page.waitForTimeout(260); assert.equal(await page.evaluate(() => measure()), 0); report.cases.coverCompleted = cover;
    await page.evaluate(() => { room.lighthouseMaintenanceState.soilFromWeather(room.lighthouseOperation); room.notifyLighthouseOperation(); });
    await open('lighthouse-solar-array'); await page.locator('#lighthouse-solar-inspect').click(); await locked(); await step(43);
    await open('lighthouse-solar-array'); await resetEvents(); await page.locator('#lighthouse-solar-clean').click(); await locked(); await step(17);
    assert.equal((await state()).m.action.command, 'clean'); assert.equal((await state()).m.solarDirty, true);
    const solarPeak = await page.evaluate(() => measure(650)); assert.ok(solarPeak > .000001);
    assert.equal((await events()).filter(row => row.clip.startsWith('cloth-wipe-')).length, 1);
    await shot('solar-cleaning');
    // Opening an actual map must cancel the accepted transaction immediately, with no end cue.
    await page.keyboard.press('m'); await page.waitForTimeout(120);
    assert.equal((await state()).m.action, undefined); assert.equal((await state()).m.solarDirty, true);
    assert.equal(await page.evaluate(() => measure()), 0); assert.ok(!(await events()).some(row => row.clip.startsWith('cloth-lift-')));
    report.cases.solarMapCancelled = { state: await state(), events: await events() };
    await page.locator('#floor-plan-return').click(); await locked();
    await open('lighthouse-solar-array'); await resetEvents(); await page.locator('#lighthouse-solar-clean').click(); await locked(); await step(44);
    const solar = { state: await state(), events: await events(), solarPeak }; assert.equal(solar.state.m.solarDirty, false);
    assert.equal(solar.state.m.solarRecheck, true); assert.equal(solar.events.filter(row => row.clip.startsWith('cloth-lift-')).length, 1);
    await page.waitForTimeout(260); assert.equal(await page.evaluate(() => measure()), 0); report.cases.solarCompleted = solar;
    phase = 'mute, blur, settings and Inspector';
    await page.keyboard.press('Escape'); await page.locator('#settings-btn').click();
    await page.locator('#audio-enabled').uncheck(); report.cases.muted = await page.evaluate(async () => { room.audio.play('cloth-wipe', 'test'); return { peak: await measure(200), state: room.audio.diagnostics }; });
    assert.equal(report.cases.muted.peak, 0); await page.locator('#audio-enabled').check();
    const normalSpeed = await page.evaluate(() => room.firstPersonCamera.speed);
    await page.locator('#movement-speed').evaluate(n => { n.value = '2'; n.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => room.firstPersonCamera.speed), normalSpeed * 2);
    await page.locator('#settings-close').click(); await page.locator('[data-view="coast"]').click();
    await page.locator('#inspect-btn').click(); await page.waitForFunction(() => s.debugLayer.isVisible(), null, { timeout: 60000 });
    report.cases.inspector = await page.evaluate(() => ({ visible: s.debugLayer.isVisible(), paused: room.pauseReasons.includes('inspector') }));
    assert.equal(report.cases.inspector.paused, true); await page.evaluate(() => s.debugLayer.hide()); await shot('coast-after-inspector');
    await page.evaluate(() => { room.audio.setSpatialCamera(undefined); room.audio.play('cloth-wipe', 'blur-test'); window.dispatchEvent(new Event('blur')); });
    await page.waitForTimeout(120); report.cases.blur = await page.evaluate(async () => ({ state: room.audio.diagnostics, peak: await measure() }));
    assert.equal(report.cases.blur.state.active, 0); assert.equal(report.cases.blur.state.context, 'suspended'); assert.equal(report.cases.blur.peak, 0);
    assert.deepEqual(report.errors, []);
    phase = 'isolated missing action file';
    const failureContext = await browser.newContext({ viewport: { width: 1280, height: 800 } }), failure = await failureContext.newPage();
    const missing = require('../public/audio/actions/source.json').files[0]; let failedRequests = 0;
    await failure.route('**/' + missing.file, route => { failedRequests++; return route.fulfill({ status: 404, body: 'controlled missing audio' }); });
    await failure.goto(base + 'audio-lab/'); await failure.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'), null, { timeout: 120000 });
    await failure.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'partial');
    await failure.waitForTimeout(1800);
    await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(failure, await failureContext.newCDPSession(failure));
    report.cases.missingClip = await failure.evaluate(() => room.audio.diagnostics); report.cases.missingClip.requests = failedRequests;
    assert.equal(report.cases.missingClip.readyFiles, 25); assert.equal(failedRequests, 2); assert.deepEqual(report.cases.missingClip.failedFiles, [missing.id]);
    await failureContext.close(); await page.evaluate(() => room.dispose());
    report.cases.disposed = await page.evaluate(() => room.audio.diagnostics); assert.equal(report.cases.disposed.state, 'closed');
    report.passed = true; await context.close();
  } catch (error) { report.failurePhase = phase; report.error = error.stack; throw error; }
  finally { fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  console.log(JSON.stringify({ passed: report.passed, firstScreenBytes: report.firstScreenBytes, outputs: report.outputs.length, doors: report.doors.length, errors: report.errors.length, warnings: report.warnings.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
