// Regression for one movement event accidentally looping its short source within one door action.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { serve } = require('./audio-lab.cjs'), { verifyRelease } = require('./verify-study-release.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dist = path.resolve(process.env.AUDIO_GAME_DIST || 'dist');
const out = path.resolve(process.env.AUDIO_CHECK_OUTPUT || 'docs/technical-plans/assets/door-audio-2026-10-25');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function observeAudio() {
  self.audioSources = []; self.voiceEvents = []; self.audioContexts = []; self.outputNodes = [];
  const Native = self.AudioContext;
  self.AudioContext = class extends Native { constructor(...args) { super(...args); audioContexts.push(this); } };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const row = { clip: self.currentAudioClip, loop: this.loop, duration: this.buffer?.duration,
      rate: this.playbackRate.value, started: this.context.currentTime, ended: false };
    audioSources.push(row);
    this.addEventListener('ended', () => { row.ended = true; row.endTime = this.context.currentTime; });
    return start.apply(this, args);
  };
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
    self.outputPeak = () => {
      const samples = new Float32Array(4096); meter.getFloatTimeDomainData(samples);
      return samples.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);
    };
  };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const report = { acousticListening: false, fpsOrLoadSpeedSampling: false, errors: [], warnings: [], doors: [], firstScreen: [],
    method: 'Unmodified production dist. Native door clicks with nearby orbit pose fixtures; original interactions advance .05 every 50ms. Observe AudioVoice.play and native AudioBufferSourceNode.loop/start/ended; no audio rate or timer acceleration.' };
  const server = await serve(dist), base = 'http://127.0.0.1:' + server.address().port + '/';
  let browser;
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
    await context.addInitScript(observeAudio);
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
    await page.locator('#settings-btn').click(); await page.locator('#audio-preview').click();
    await page.evaluate(() => {
      e.stopRenderLoop(); e.getDeltaTime = () => 0; room.audio.setSpatialCamera(undefined); attachMeter();
      for (const [clip, voices] of room.audio.voices) for (const voice of voices) {
        const play = voice.play;
        voice.play = function (...args) {
          voiceEvents.push({ clip, rate: args[1], time: performance.now() }); self.currentAudioClip = clip;
          try { return play.apply(this, args); } finally { self.currentAudioClip = undefined; }
        };
      }
    });
    await page.locator('#settings-close').click(); await page.locator('[data-view="coast"]').click();
    const aim = async id => {
      await page.evaluate(id => {
        const state = [...room.interactions.doors, ...room.interactions.slidingDoors].find(row => row.door.id === id);
        const mesh = state.door.meshes[0], V = room.camera.position.constructor; mesh.computeWorldMatrix(true);
        const target = mesh.getBoundingInfo().boundingBox.centerWorld;
        const normal = V.TransformNormal(new V(1, 0, 0), state.door.root.computeWorldMatrix(true)).normalize();
        const c = room.camera; c.lowerRadiusLimit = .5; c.inertialAlphaOffset = c.inertialBetaOffset = c.inertialRadiusOffset = 0;
        c.setTarget(target); c.setPosition(target.add(normal.scale(8)).add(new V(0, .8, 0)));
        c.getViewMatrix(true); c.getProjectionMatrix(true); s.render();
      }, id);
    };
    const motion = async (id, cue, variant) => {
      await aim(id);
      await page.evaluate(async ({ cue, variant }) => {
        room.audio.stopAll(); await new Promise(r => setTimeout(r, 100));
        voiceEvents.length = 0; audioSources.length = 0;
        room.audio.previous.set(cue, cue + '-' + (variant === 1 ? 2 : 1));
      }, { cue, variant });
      await page.mouse.click(640, 400);
      let peak = 0, beforeEndpoint;
      for (let i = 0; i < 18; i++) {
        peak = Math.max(peak, await page.evaluate(() => {
          room.interactions.update(.05); room.audio.update(); return outputPeak();
        }));
        await page.waitForTimeout(50);
        if (i === 12) beforeEndpoint = await page.evaluate(() => ({ sources: structuredClone(audioSources), active: room.audio.diagnostics.active }));
      }
      await page.waitForTimeout(200);
      return page.evaluate(({ id, peak, beforeEndpoint }) => ({ peak, beforeEndpoint, sources: audioSources, events: voiceEvents,
        progress: room.interactions.doorProgress(id), silentPeak: outputPeak(), active: room.audio.diagnostics.active }), { id, peak, beforeEndpoint });
    };
    for (const [id, cue, latch] of [['entry-door', 'door-move', 'door-latch'], ['balcony-door', 'slide-move', 'slide-stop'], ['lighthouse-entry-door', 'metal-door-move', 'metal-door-latch']]) {
      for (const variant of [1, 2]) {
        const opened = await motion(id, cue, variant), closed = await motion(id, cue, variant);
        report.doors.push({ id, cue, latch, variant, opened, closed });
        console.log(id + ' variation ' + variant + ': ' + JSON.stringify(opened.sources.map(s => ({ clip: s.clip, loop: s.loop, ended: s.ended }))));
      }
    }
    for (const { id, cue, latch, variant, opened, closed } of report.doors) {
      assert.equal(opened.progress, 1, id); assert.equal(closed.progress, 0, id);
      for (const result of [opened, closed]) {
        assert.ok(result.peak > .000001 && result.peak < 1, id + ' audible output');
        assert.equal(result.events.filter(e => e.clip === cue + '-' + variant).length, 1, id + ' one play');
        const sources = result.sources.filter(s => s.clip?.startsWith(cue + '-'));
        assert.equal(sources.length, 1, id + ' one native source');
        assert.equal(sources[0].loop, false, id + ' must not repeat inside one action');
        assert.ok(result.beforeEndpoint.sources.find(s => s.clip === cue + '-' + variant)?.ended, id + ' naturally ends before endpoint');
        assert.equal(result.active, 0); assert.equal(result.silentPeak, 0);
      }
      assert.equal(opened.events.filter(e => e.clip.startsWith(latch + '-')).length, 0);
      assert.equal(closed.events.filter(e => e.clip.startsWith(latch + '-')).length, 1);
    }
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error); }
  finally {
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})();
