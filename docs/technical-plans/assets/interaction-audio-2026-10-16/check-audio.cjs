// Functional audio-graph checks, not acoustic listening or FPS/load-speed measurements.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8095/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true }); // Keep the browser's real autoplay policy. Headless playback is not speaker verification.
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  const record = { browser: browser.version(), mode: 'headless, default autoplay policy', acousticListening: false,
    fpsCpuGpuLoadSpeedSampling: false };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => requests.push({ url: response.url(), status: response.status(),
    bytes: Number(response.headers()['content-length'] || 0) }));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const render = (frames = 1) => page.evaluate(frames => {
    for (let i = 0; i < frames; i++) studyScene.render();
  }, frames);
  const pose = (position, target, frames = 1) => page.evaluate(({ position, target, frames }) => {
    const camera = studyScene.activeCamera, V = camera.position.constructor;
    camera.cameraDirection?.setAll(0); camera.cameraRotation?.setAll(0);
    camera.movement.resetPanVelocity(); camera.movement.resetRotationVelocity();
    camera.setTarget(new V(...target));
    if (camera.setPosition) { camera.lowerRadiusLimit = .5; camera.setPosition(new V(...position)); }
    else { camera.position.set(...position); camera.setTarget(new V(...target)); }
    camera.getViewMatrix(true); camera.getProjectionMatrix(true);
    for (let i = 0; i < frames; i++) studyScene.render();
  }, { position, target, frames });
  const installMeter = () => page.evaluate(async () => {
    const code = `class PeakMeter extends AudioWorkletProcessor {
      constructor() { super(); this.peaks=[0,0]; this.port.onmessage=e=>{
        if(e.data.kind==='reset') this.peaks=[0,0];
        this.port.postMessage({id:e.data.id,peaks:this.peaks}); }; }
      process(inputs) { const input=inputs[0]; for(let c=0;c<2;c++)
        for(const value of input[c]||[]) this.peaks[c]=Math.max(this.peaks[c],Math.abs(value)); return true; }
    } registerProcessor('room-test-peaks',PeakMeter);`;
    const module = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await audioContext.audioWorklet.addModule(module); URL.revokeObjectURL(module);
    const node = new AudioWorkletNode(audioContext, 'room-test-peaks', { channelCount: 2, channelCountMode: 'explicit',
      outputChannelCount: [2] });
    audioEngine.mainOut._inNode.connect(node); node.connect(audioContext.destination); // The test processor emits silence.
    let id = 0; const waiting = new Map();
    node.port.onmessage = event => { waiting.get(event.data.id)?.(event.data.peaks); waiting.delete(event.data.id); };
    self.peakCommand = kind => new Promise(resolve => { const current = id++; waiting.set(current, resolve); node.port.postMessage({ id: current, kind }); });
  });
  const resetMeter = () => page.evaluate(() => peakCommand('reset'));
  const meter = async milliseconds => { await page.waitForTimeout(milliseconds); return page.evaluate(() => peakCommand('read')); };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'));
    record.sceneReadyJsBytes = requests.filter(row => /\.js$/.test(row.url)).reduce((sum, row) => sum + row.bytes, 0);
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.preheatedJsBytes = requests.filter(row => /\.js$/.test(row.url)).reduce((sum, row) => sum + row.bytes, 0);
    assert.ok(record.preheatedJsBytes <= 3 * 1048576);
    record.initial = await page.evaluate(() => {
      self.webpackChunkbabylon_learning.push([[979798], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(studyRequire.m)) {
        if (!/get LastCreatedEngine|static get Instances/.test(factory.toString())) continue;
        for (const value of Object.values(studyRequire(id))) {
          if (typeof value !== 'function') continue;
          if (value.LastCreatedEngine?.scenes?.length) { self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene; }
          if (value.Instances?.some?.(instance => typeof instance.createSoundBufferAsync === 'function')) self.audioType = value;
        }
      }
      if (!self.studyScene || !self.audioType) throw new Error('Runtime not found');
      self.audioEngine = audioType.Instances[0]; self.audioContext = audioEngine._audioContext;
      self.audioEvents = [];
      for (const sound of audioEngine.sounds) {
        const original = sound.play.bind(sound);
        sound.play = (...args) => { audioEvents.push({ name: sound.name, state: audioContext.state,
          at: performance.now(), panning: sound.spatial.panningEnabled, position: sound.spatial.position.asArray() }); return original(...args); };
      }
      studyEngine.stopRenderLoop(); studyEngine.getDeltaTime = () => 50;
      return { contexts: audioType.Instances.length, state: audioContext.state, sounds: audioEngine.sounds.length,
        stoppedBeforeGesture: audioEngine.sounds.every(sound => sound.state === 1),
        decodedFrames: [...new Set(audioEngine.sounds.map(sound => sound.buffer))].reduce((sum, buffer) => sum + buffer.length, 0) };
    });
    assert.equal(record.initial.contexts, 1); assert.equal(record.initial.sounds, 24);
    assert.equal(record.initial.stoppedBeforeGesture, true);
    await installMeter(); await resetMeter();
    record.beforeGestureOutput = await meter(60); assert.deepEqual(record.beforeGestureOutput, [0, 0]);
    await page.locator('#settings-btn').click();
    await page.locator('#audio-preview').click();
    record.previewOutput = await meter(220);
    assert.ok(Math.max(...record.previewOutput) > 0.0001, 'real graph must have nonzero PCM output');
    assert.equal(await page.evaluate(() => audioContext.state), 'running');
    await page.locator('#audio-volume').evaluate(element => { element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(35);
    await resetMeter();
    await page.evaluate(() => {
      // Stress the calibrated output graph with six known sound objects; policy cap is tested separately.
      for (const sound of audioEngine.sounds.filter(sound => /-1-0$/.test(sound.name))) {
        sound.spatial.panningEnabled = false; sound.spatial.rolloffFactor = 0;
        sound.setVolume(sound.name.startsWith('paper') ? .2 : .25, { duration: 0 }); sound.play();
      }
    });
    record.sixVoiceOutput = await meter(650); assert.ok(Math.max(...record.sixVoiceOutput) > .005);
    assert.ok(Math.max(...record.sixVoiceOutput) < 1, 'six calibrated voices must not clip');
    await page.screenshot({ path: path.join(output, 'audio-settings.jpg'), type: 'jpeg', quality: 90 });
    await page.locator('#audio-enabled').uncheck();
    const mutedCount = await page.evaluate(() => audioEvents.length);
    await page.locator('#audio-preview').isDisabled().then(disabled => assert.equal(disabled, true));
    await page.locator('#settings-close').click();
    await pose([-6, 5, 6], [-7, 0, -2]); await page.mouse.click(640, 360); await render(20);
    await page.waitForTimeout(100); assert.equal(await page.evaluate(() => audioEvents.length), mutedCount);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'));
    assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'), 'false');
    record.mutePersists = true;
    // A second page verifies per-file failure without damaging the normal context.
    const broken = await context.newPage();
    let missing = true;
    await broken.addInitScript(() => localStorage.setItem('study-audio-v1', JSON.stringify({ enabled: true, volume: .5 })));
    await broken.route('**/audio/study/switch-1.*.wav', route => missing
      ? route.fulfill({ status: 404, body: 'missing fixture' }) : route.continue());
    await broken.goto(url);
    await broken.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'partial');
    assert.ok((await broken.locator('#scene-status').textContent()).includes('胡桃木'));
    await broken.locator('#settings-btn').click();
    await broken.waitForFunction(() => !document.querySelector('#audio-retry').disabled);
    missing = false; await broken.locator('#audio-retry').click();
    await broken.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.manualRetryRecovers = true;
    await broken.locator('#audio-toggle').click(); assert.equal(await broken.locator('#audio-toggle').getAttribute('aria-pressed'), 'false');
    record.failedFileKeepsSceneUsable = true; await broken.close();
    await page.bringToFront();
    await page.locator('#audio-toggle').click();
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    // Reuse setup after reload, with a fresh context; the first page's captured references are gone.
    await page.evaluate(() => {
      self.webpackChunkbabylon_learning.push([[979799], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(studyRequire.m)) {
        if (!/get LastCreatedEngine|static get Instances/.test(factory.toString())) continue;
        for (const value of Object.values(studyRequire(id))) if (typeof value === 'function') {
          if (value.LastCreatedEngine?.scenes?.length) { self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene; }
          if (value.Instances?.some?.(engine => engine.createSoundBufferAsync)) self.audioEngine = value.Instances[0];
        }
      }
      self.audioContext = audioEngine._audioContext; self.audioEvents = [];
      for (const sound of audioEngine.sounds) { const original = sound.play.bind(sound);
        sound.play = (...args) => { audioEvents.push({ name: sound.name, panning: sound.spatial.panningEnabled,
          position: sound.spatial.position.asArray(), at: performance.now() }); return original(...args); }; }
      studyEngine.stopRenderLoop(); studyEngine.getDeltaTime = () => 50;
    });
    await installMeter();
    await page.locator('[data-view="first-person"]').click();
    await page.waitForFunction(() => !!document.pointerLockElement && studyScene.activeCamera.inputs.attachedToElement);
    await pose([16, 1, -5], [20, 1, -5]);
    record.aimDebug = await page.evaluate(() => {
      const ray = studyScene.activeCamera.getForwardRay(7.5), hit = studyScene.pickWithRay(ray, mesh =>
        mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.getTotalVertices() > 0);
      return { direction: ray.direction.asArray(), hit: hit?.pickedMesh?.name, metadata: hit?.pickedMesh?.metadata,
        distance: hit?.distance, locked: !!document.pointerLockElement, attached: studyScene.activeCamera.inputs.attachedToElement,
        angle: studyScene.getTransformNodeByName('connecting-door').rotation.y };
    });
    await resetMeter();
    await page.mouse.down(); await page.mouse.up();
    await pose([16, 1, -5], [16, 1, 5]); record.spatialRight = await meter(180);
    record.spatialDebug = await page.evaluate(() => ({ state: audioContext.state, events: audioEvents,
      focused: document.hasFocus(), visible: document.visibilityState, view: studyScene.activeCamera.name,
      now: performance.now(), actualGain: audioEngine.mainOut._inNode.gain.value,
      position: studyScene.activeCamera.position.asArray(), listener: [audioContext.listener.forwardX.value,
        audioContext.listener.forwardZ.value], button: document.querySelector('#audio-toggle').textContent }));
    assert.ok(record.spatialRight[1] > record.spatialRight[0] * 1.4, 'right-side door must be louder in right channel');
    await render(20); await page.waitForTimeout(60);
    await pose([16, 1, -5], [22, 0.4, -7.06]); // Aim at the opened leaf, not the now-empty closed doorway.
    await resetMeter();
    await page.mouse.down(); await page.mouse.up();
    await pose([16, 1, -5], [16, 1, -15]); record.spatialLeft = await meter(180);
    assert.ok(record.spatialLeft[0] > record.spatialLeft[1] * 1.4, 'left-side door must be louder in left channel');
    await render(20); await page.waitForTimeout(250);
    const events = await page.evaluate(() => audioEvents);
    assert.equal(events.filter(event => event.name.startsWith('door-latch')).length, 1);
    assert.ok(events.filter(event => event.name.startsWith('door-move')).every(event => event.panning));
    record.doorSounds = events;
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => audioContext.state === 'suspended');
    const afterBlur = await page.evaluate(() => audioEvents.length);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => audioEvents.length), afterBlur);
    record.blurStopsWithoutReplay = true;
    record.errors = errors; record.warnings = [...new Set(warnings)]; record.requests = requests;
    assert.deepEqual(errors, []);
    assert.ok(!requests.some(row => row.status >= 400));
    record.passed = true;
    fs.writeFileSync(path.join(output, 'audio-browser.json'), JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, ...record, requests: requests.length }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(output, 'audio-browser-failure.json'), JSON.stringify({ ...record, errors, warnings, requests, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
