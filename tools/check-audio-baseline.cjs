// Recheck the unmodified game release and its existing 12 sounds, including real hand-gesture unlock.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { serve } = require('./audio-lab.cjs');
const { verifyRelease } = require('./verify-study-release.cjs');
const root = path.resolve(__dirname, '..'), dist = path.resolve(process.env.AUDIO_GAME_DIST || 'dist');
const out = path.resolve(process.env.AUDIO_CHECK_OUTPUT || 'docs/technical-plans/assets/audio-phase-a-2026-10-24');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const sha = b => createHash('sha256').update(b).digest('hex');
(async () => {
  fs.mkdirSync(out, { recursive: true }); const server = await serve(dist), base = 'http://127.0.0.1:' + server.address().port + '/';
  let browser; const report = { acousticListening: false, fpsOrLoadSpeedSampling: false, errors: [], warnings: [], firstScreen: [], outputs: [] };
  try {
    report.release = verifyRelease(dist);
    const raw = fs.readFileSync(path.join(dist, 'release-manifest.json')), manifest = JSON.parse(raw);
    const files = [...manifest.files, { path: 'release-manifest.json', bytes: raw.length, sha256: sha(raw) }];
    for (const prefix of ['', 'audio-lab/']) for (let n = 0; n < files.length; n += 16) await Promise.all(files.slice(n, n + 16).map(async f => {
      const r = await fetch(base + prefix + f.path); assert.equal(r.status, 200); const b = Buffer.from(await r.arrayBuffer()); assert.equal(b.length, f.bytes); assert.equal(sha(b), f.sha256);
    }));
    report.hosted = { prefixes: ['/', '/audio-lab/'], filesPerPrefix: files.length };
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const captureNative = () => {
      self.outputNodes = []; self.audioContexts = [];
      const Native = self.AudioContext; self.AudioContext = class extends Native { constructor(...args) { super(...args); audioContexts.push(this); } };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (...args) { if (args[0] === this.context.destination) outputNodes.push(this); return connect.apply(this, args); };
    };
    await context.addInitScript(captureNative);
    const page = await context.newPage(), pending = []; let collecting = true;
    page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); if (collecting && new URL(r.url()).pathname.endsWith('.js')) pending.push(r.body().then(b => report.firstScreen.push({ path: new URL(r.url()).pathname, bytes: b.length, sha256: sha(b) }))); });
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(base); await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('住宅与灯塔已就绪'), null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready'); await page.waitForLoadState('networkidle'); collecting = false; await Promise.all(pending);
    report.firstScreenBytes = report.firstScreen.reduce((n, f) => n + f.bytes, 0); assert.ok(report.firstScreenBytes <= require('./study-bundle-analysis.cjs').initialJsBudgetBytes);
    await require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/browser-harness.cjs').captureRoom(page, cdp);
    report.beforeGesture = await page.evaluate(() => ({ diagnostics: room.audio.diagnostics, contexts: audioContexts.length }));
    // Capturing Room uses an existing settings input gesture, so evaluate unlock separately on a clean page.
    await page.locator('#settings-btn').click(); await page.locator('#audio-preview').click();
    await page.evaluate(() => {
      e.stopRenderLoop(); self.ctx = audioContexts[0]; self.meter = ctx.createAnalyser(); meter.fftSize = 4096;
      for (const node of outputNodes.filter(n => n.context === ctx)) node.connect(meter);
      self.measure = async duration => { let peak = 0; const until = performance.now() + duration, a = new Float32Array(4096); while (performance.now() < until) { meter.getFloatTimeDomainData(a); for (const v of a) peak = Math.max(peak, Math.abs(v)); await new Promise(r => setTimeout(r, 12)); } return peak; };
      room.audio.setPreferences(true, .5); room.audio.setSpatialCamera(undefined);
    });
    const clips = require('../public/audio/study/source.json').files;
    for (const c of clips) {
      const cue = c.id.replace(/-[12]$/, '');
      const result = await page.evaluate(async ({ cue, id }) => {
        room.audio.stopAll(); await new Promise(r => setTimeout(r, 100));
        const clipId = id; const previous = room.audio.previous;
        // Force this variation through the real public cue policy without changing the served game.
        previous.set(cue, clipId.endsWith('-1') ? clipId.slice(0, -1) + '2' : clipId.slice(0, -1) + '1');
        const before = room.audio.diagnostics.played; room.audio.play(cue, 'phase-a-baseline-' + id);
        return { peak: await measure(700), playedDelta: room.audio.diagnostics.played - before };
      }, { cue, id: c.id });
      assert.ok(result.peak > .000001 && result.peak < 1, c.id + ' real game output'); assert.equal(result.playedDelta, 1);
      report.outputs.push({ id: c.id, ...result });
    }
    await page.locator('#audio-enabled').uncheck();
    report.mute = await page.evaluate(async () => { room.audio.play('switch'); await new Promise(r => setTimeout(r, 100)); return { peak: await measure(200), diagnostics: room.audio.diagnostics }; }); assert.equal(report.mute.peak, 0);
    await page.locator('#audio-enabled').check();
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); }); await page.waitForTimeout(100);
    report.blur = await page.evaluate(() => room.audio.diagnostics); assert.equal(report.blur.context, 'suspended'); assert.equal(report.blur.active, 0);
    await page.screenshot({ path: path.join(out, 'game-audio-settings.jpg'), type: 'jpeg', quality: 85 });
    const cleanContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await cleanContext.addInitScript(captureNative);
    const clean = await cleanContext.newPage(); await clean.goto(base + 'audio-lab/');
    await clean.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    report.cleanBeforeGesture = await clean.evaluate(async () => {
      const ctx = audioContexts[0], meter = ctx.createAnalyser(), zero = ctx.createGain(); zero.gain.value = 0;
      for (const node of outputNodes) node.connect(meter);
      meter.connect(zero); zero.connect(ctx.destination);
      await new Promise(r => setTimeout(r, 100)); const data = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(data);
      return { contexts: audioContexts.length, state: ctx.state, outputPeak: Math.max(...data.map(Math.abs)),
        note: 'Context suspension depends on browser autoplay permission; absence of unsolicited output is the invariant.' };
    });
    assert.equal(report.cleanBeforeGesture.outputPeak, 0);
    await clean.locator('#settings-btn').click(); await clean.locator('#audio-preview').click();
    assert.equal(await clean.evaluate(() => audioContexts[0].state), 'running'); report.subpathReady = true;
    await cleanContext.close(); assert.deepEqual(report.errors, []);
    fs.writeFileSync(path.join(out, 'game-browser.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(out, 'game-release-manifest.json'), raw);
    console.log(JSON.stringify({ release: report.release, firstScreenBytes: report.firstScreenBytes, outputs: report.outputs.length, errors: report.errors }));
  } catch (error) { report.failure = String(error.stack || error); fs.writeFileSync(path.join(out, 'game-browser-failure.json'), JSON.stringify(report, null, 2) + '\n'); throw error; }
  finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
