// Real browser PCM and lifecycle checks. These do not certify acoustic listening or FPS.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { serve, defaultOutput } = require('./audio-lab.cjs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.AUDIO_CHECK_OUTPUT || path.join(root, 'docs/technical-plans/assets/audio-phase-a-2026-10-24'));
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/Users/huzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const hash = b => createHash('sha256').update(b).digest('hex');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = await serve(defaultOutput), base = 'http://127.0.0.1:' + server.address().port + '/';
  let browser;
  const report = { acousticListening: false, fpsOrLoadSpeedSampling: false, errors: [], warnings: [], outputs: [], codecs: [] };
  try {
    const manifestRaw = fs.readFileSync(path.join(defaultOutput, 'lab-manifest.json'));
    const manifest = JSON.parse(manifestRaw);
    const files = [...manifest.files, { path: 'lab-manifest.json', bytes: manifestRaw.length, sha256: hash(manifestRaw) }];
    for (const prefix of ['', 'audio-lab/']) for (const f of files) {
      const r = await fetch(base + prefix + f.path); assert.equal(r.status, 200);
      const data = Buffer.from(await r.arrayBuffer()); assert.equal(data.length, f.bytes); assert.equal(hash(data), f.sha256);
    }
    report.hosted = { prefixes: ['/', '/audio-lab/'], filesPerPrefix: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), allJsBytes: manifest.jsBytes };
    assert.ok(!manifest.modules.some(m => /@babylonjs\/core\/index\.js$|@babylonjs\/(inspector|gui)|src\/examples\/Room\.ts/.test(m.path)), 'Lab must use exact audio imports');
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      self.audioOutputNodes = [];
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (...args) { if (args[0] === this.context.destination) audioOutputNodes.push(this); return connect.apply(this, args); };
    });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
    const requests = [], cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    page.on('response', r => requests.push(r.url()));
    await page.goto(base);
    report.beforeGesture = await page.evaluate(() => audioLab.stats());
    assert.equal(report.beforeGesture.ready, false); assert.equal(report.beforeGesture.contextState, undefined);
    assert.equal(requests.some(u => /candidates\/|audio\/study\//.test(u)), false, 'No pre-gesture media requests');
    await page.locator('#prepare').click(); await page.waitForFunction(() => audioLab.stats().ready);
    report.ready = await page.evaluate(() => audioLab.stats());
    assert.equal(report.ready.contextState, 'running'); assert.equal(report.ready.buffers, 23);
    assert.ok(report.ready.decodedBytes < 24 * 1048576); assert.deepEqual(report.ready.active, []);
    // Native public AudioNode outputs capture post-master PCM. V2's main-bus analyzer is pre-master.
    await page.evaluate(async () => {
      self.meter = audioLab.context.createAnalyser(); meter.fftSize = 4096;
      for (const node of audioOutputNodes) node.connect(meter);
      const silent = audioLab.context.createGain(); silent.gain.value = 0; meter.connect(silent); silent.connect(audioLab.context.destination);
      self.measure = async duration => {
        const until = performance.now() + duration; let peak = 0, squares = 0, samples = 0;
        while (performance.now() < until) {
          const data = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(data);
          for (const value of data) { peak = Math.max(peak, Math.abs(value)); squares += value * value; samples++; }
          await new Promise(r => setTimeout(r, 15));
        }
        return { peak, rms: Math.sqrt(squares / Math.max(1, samples)) };
      };
    });
    const baseline = JSON.parse(fs.readFileSync(path.join(root, 'public/audio/study/source.json')));
    for (const clip of baseline.files) {
      const result = await page.evaluate(async id => { audioLab.stopAll(); await new Promise(r => setTimeout(r, 100)); audioLab.play(id, .25); return measure(700); }, clip.id);
      assert.ok(result.peak > .00001 && result.peak < 1, clip.id + ' must have nonzero unclipped graph output');
      report.outputs.push({ id: clip.id, ...result });
    }
    for (const id of ['door-motion', 'door-latch', 'cloth-wipe']) {
      const result = await page.evaluate(async id => { audioLab.stopAll(); await new Promise(r => setTimeout(r, 100)); audioLab.play(id, .5); return measure(id === 'cloth-wipe' ? 1600 : 700); }, id);
      assert.ok(result.peak > .00001 && result.peak < 1); report.outputs.push({ id, ...result });
    }
    // Real signal frequency is the acceptance check, rather than trusting a property getter.
    report.liveRate = await page.evaluate(async () => {
      audioLab.stopAll(); const buffer = audioLab.context.createBuffer(1, 48000, 48000);
      for (let i = 0; i < 48000; i++) buffer.getChannelData(0)[i] = .2 * Math.sin(2 * Math.PI * 440 * i / 48000);
      const sound = await audioLab.engine.createSoundAsync('rate-probe', buffer, { loop: true, maxInstances: 1 });
      await sound.analyzer.enableAsync(); sound.analyzer.fftSize = 8192;
      const frequency = () => { const a = sound.analyzer.getFloatTimeDomainData(); let count = 0; for (let i = 1; i < a.length; i++) if (a[i - 1] <= 0 && a[i] > 0) count++; return count * audioLab.context.sampleRate / a.length; };
      sound.play(); await new Promise(r => setTimeout(r, 250)); const beforeHz = frequency();
      sound.playbackRate = 2; await new Promise(r => setTimeout(r, 250)); const afterHz = frequency(); sound.dispose();
      return { beforeHz, afterHz, publicSetter: true };
    });
    assert.ok(report.liveRate.beforeHz > 420 && report.liveRate.beforeHz < 460);
    assert.ok(report.liveRate.afterHz / report.liveRate.beforeHz > 1.8);
    const candidates = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio-lab/manifest.json')));
    for (const clip of candidates.clips.filter(c => c.loop)) for (const format of ['wav', 'aac']) {
      const result = await page.evaluate(async ({ id, format, duration }) => {
        audioLab.stopAll(); await new Promise(r => setTimeout(r, 120));
        const sound = audioLab.sounds.get(id + ':' + format), buffer = sound.buffer;
        audioLab.play(id, .4, true, format);
        const chunks = []; for (let i = 0; i < Math.ceil((duration * 2 + .3) / .1); i++) chunks.push(await measure(100));
        const active = audioLab.stats().active; audioLab.stopAll();
        return { duration: buffer.duration, sampleRate: buffer.sampleRate, frames: buffer.length, channels: buffer.channelCount,
          peak: Math.max(...chunks.map(v => v.peak)), minWindowRms: Math.min(...chunks.map(v => v.rms)), active };
      }, { id: clip.id, format, duration: clip.duration });
      assert.ok(result.peak > .00001 && result.peak < 1); assert.ok(result.minWindowRms > .000001, 'No 100ms silent hole in two loops');
      assert.deepEqual(result.active, [clip.id]); report.codecs.push({ id: clip.id, format, ...result });
    }
    await page.evaluate(() => audioLab.stopAll());
    await page.locator('#wipe').click(); await page.waitForTimeout(300); await page.locator('#cancel-wipe').click(); await page.waitForTimeout(1500);
    report.wipeCancelled = await page.evaluate(async () => ({ stats: audioLab.stats(), silence: await measure(180) }));
    assert.equal(report.wipeCancelled.stats.report.events.filter(e => e.kind === 'wipe-complete').length, 0);
    assert.equal(report.wipeCancelled.silence.peak, 0);
    await page.locator('#wipe').click(); await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => audioLab.stats().report.events.filter(e => e.kind === 'wipe-complete').length), 1);
    await page.locator('#speed').fill('20'); await page.locator('#motor').click();
    const playsBefore = await page.evaluate(() => audioLab.stats().report.plays.length);
    for (const speed of ['30', '40', '10', '25']) await page.locator('#speed').fill(speed);
    assert.equal(await page.evaluate(() => audioLab.stats().report.plays.length), playsBefore, 'Speed updates must not restart the loop');
    await page.locator('#weather').click(); await page.waitForTimeout(400);
    report.denseMix = await page.evaluate(async () => ({ stats: audioLab.stats(), output: await measure(400) }));
    assert.ok(report.denseMix.output.peak > 0 && report.denseMix.output.peak < 1);
    assert.equal(report.denseMix.stats.active.length, 4);
    await page.locator('#shelter').selectOption('inside'); await page.waitForTimeout(400);
    report.inside = await page.evaluate(async () => ({ windGain: audioLab.sounds.get('wind-loop:wav').volume, output: await measure(250) }));
    assert.ok(report.inside.windGain < .08);
    await page.locator('#volume').fill('0'); await page.waitForTimeout(150);
    report.zeroVolume = await page.evaluate(() => measure(200)); assert.equal(report.zeroVolume.peak, 0);
    await page.locator('#volume').fill('35');
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(150);
    report.blur = await page.evaluate(() => audioLab.stats()); assert.equal(report.blur.contextState, 'suspended'); assert.deepEqual(report.blur.active, []);
    const oldPlays = report.blur.report.plays.length;
    await page.locator('#stop').click(); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => audioLab.stats().report.plays.length), oldPlays, 'Recovery cannot backfill events');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(200);
    report.narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(report.narrowOverflow, false);
    await page.screenshot({ path: path.join(output, 'lab-portrait.jpg'), fullPage: true, type: 'jpeg', quality: 85 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(output, 'lab-desktop.jpg'), fullPage: true, type: 'jpeg', quality: 85 });
    await page.goto(base + 'audio-lab/'); await page.waitForFunction(() => !!window.audioLab); report.subpath = true;
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(path.join(output, 'lab-browser.json'), JSON.stringify(report, null, 2) + '\n');
    fs.copyFileSync(path.join(defaultOutput, 'lab-manifest.json'), path.join(output, 'lab-manifest.json'));
    console.log(JSON.stringify({ hosted: report.hosted, browser: report.browser, outputs: report.outputs.length,
      loopCodecChecks: report.codecs.length, liveRate: report.liveRate, densePeak: report.denseMix.output.peak, errors: report.errors }));
  } catch (error) {
    report.failure = String(error.stack || error); fs.writeFileSync(path.join(output, 'lab-browser-failure.json'), JSON.stringify(report, null, 2) + '\n'); throw error;
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
