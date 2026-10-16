// Cross-engine buffer playback, gesture, controls and lifecycle checks. No physical-device listening.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const playwright = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8095/';
(async () => {
  const records = [];
  for (const kind of ['firefox', 'webkit']) {
    let browser;
    const record = { engine: kind, acousticListening: false, errors: [], warnings: [], requests: [] };
    try {
      browser = await playwright[kind].launch({ headless: true, timeout: 15000 });
      record.version = browser.version();
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await context.newPage(); let phase = 'initial';
      page.on('pageerror', error => record.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text());
        if (message.type() === 'warning') record.warnings.push(message.text()); });
      page.on('response', response => { if (/^https?:/.test(response.url())) record.requests.push({
        url: response.url(), status: response.status(), bytes: Number(response.headers()['content-length'] || 0), phase }); });
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      await page.locator('#settings-btn').click(); // A real gesture also supports engines that defer audio setup until unlock.
      await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready', null, { timeout: 120000 });
      record.preheatedJsBytes = record.requests.filter(row => /\.js$/.test(row.url)).reduce((sum, row) => sum + row.bytes, 0);
      assert.ok(record.preheatedJsBytes <= 3 * 1048576);
      record.initial = await page.evaluate(() => {
        self.webpackChunkbabylon_learning.push([[979800], {}, require => self.studyRequire = require]);
        for (const [id, factory] of Object.entries(studyRequire.m)) {
          if (!/get LastCreatedEngine|static get Instances/.test(factory.toString())) continue;
          for (const value of Object.values(studyRequire(id))) if (typeof value === 'function') {
            if (value.LastCreatedEngine?.scenes?.length) self.studyEngine = value.LastCreatedEngine;
            if (value.Instances?.some?.(engine => engine.createSoundBufferAsync)) self.audioEngine = value.Instances[0];
          }
        }
        studyEngine.stopRenderLoop(); self.audioContext = audioEngine._audioContext; self.audioEvents = [];
        for (const sound of audioEngine.sounds) { const original = sound.play.bind(sound);
          sound.play = (...args) => { audioEvents.push(sound.name); return original(...args); }; }
        return { state: audioContext.state, sounds: audioEngine.sounds.length,
          stoppedBeforePreview: audioEngine.sounds.every(sound => sound.state === 1), sampleRate: audioContext.sampleRate };
      });
      assert.equal(record.initial.sounds, 24); assert.equal(record.initial.stoppedBeforePreview, true);
      await page.waitForFunction(() => audioContext.state === 'running');
      await page.evaluate(() => {
        const analyser = audioContext.createAnalyser(), zero = audioContext.createGain(); zero.gain.value = 0;
        audioEngine.mainOut._inNode.connect(analyser); analyser.connect(zero); zero.connect(audioContext.destination);
        const samples = new Float32Array(2048); self.outputPeak = 0;
        self.audioSampleTimer = setInterval(() => { analyser.getFloatTimeDomainData(samples);
          for (const value of samples) self.outputPeak = Math.max(self.outputPeak, Math.abs(value)); }, 4);
      });
      await page.locator('#audio-preview').click(); await page.waitForTimeout(220);
      record.previewPeak = await page.evaluate(() => outputPeak); assert.ok(record.previewPeak > .0001);
      record.playedClips = await page.evaluate(async () => {
        const names = [];
        for (const sound of audioEngine.sounds.filter(sound => /-0$/.test(sound.name))) {
          sound.spatial.panningEnabled = false; sound.spatial.rolloffFactor = 0;
          sound.setVolume(.25, { duration: 0 }); sound.play(); names.push(sound.name);
          await new Promise(resolve => setTimeout(resolve, sound.buffer.duration * 1000 + 40));
        }
        return names;
      });
      assert.equal(record.playedClips.length, 12);
      record.allClipPeak = await page.evaluate(() => outputPeak); assert.ok(record.allClipPeak < 1);
      const before = await page.evaluate(() => audioEvents.length);
      await page.locator('#audio-volume').focus(); await page.keyboard.press('Home');
      assert.equal(await page.locator('#audio-volume').inputValue(), '0');
      await page.locator('#audio-preview').click(); await page.waitForTimeout(180);
      assert.equal(await page.evaluate(() => audioEvents.length), before);
      await page.locator('#audio-enabled').uncheck();
      await page.evaluate(() => clearInterval(audioSampleTimer));
      phase = 'muted-reload'; await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'));
      assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'), 'false');
      assert.equal(record.requests.filter(row => row.phase === phase && /\.wav$/.test(row.url)).length, 0);
      record.zeroVolumeSilent = true; record.mutedReloadSkipsAudio = true;
      assert.deepEqual(record.errors, []); assert.ok(record.requests.every(row => row.status === 200));
      record.passed = true;
    } catch (error) { record.passed = false; record.launchUnavailable = !browser; record.failure = error.stack; }
    finally { if (browser) await browser.close(); }
    records.push(record);
    console.log(JSON.stringify({ ...record, requests: record.requests.length }));
  }
  fs.writeFileSync(path.join(__dirname, 'audio-engines.json'), JSON.stringify(records, null, 2) + '\n');
  assert.ok(records.every(record => record.passed || record.launchUnavailable), 'one or more launched-engine checks failed');
  if (records.some(record => record.launchUnavailable)) process.exitCode = 2; // Incomplete platform coverage is not a passing matrix.
})().catch(error => { console.error(error); process.exitCode = 1; });
