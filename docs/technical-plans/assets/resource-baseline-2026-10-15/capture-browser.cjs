// Measure an unchanged production bundle in a fresh browser context.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwrightPackage = process.env.PLAYWRIGHT_PACKAGE || 'playwright';
const { chromium } = require(playwrightPackage);
const playwrightVersion = require(path.join(playwrightPackage, 'package.json')).version;
const report = __dirname;
const url = process.env.BASELINE_URL || 'http://127.0.0.1:8091/';
const save = (name, data) => fs.writeFileSync(path.join(report, name), JSON.stringify(data, null, 2) + '\n');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const requests = new Map();
    const errors = [];
    const warnings = [];
    let phase = 'initial';
    cdp.on('Network.requestWillBeSent', event => {
      if (!/^https?:/.test(event.request.url)) return;
      requests.set(event.requestId, {
        id: event.requestId, phase, url: event.request.url, method: event.request.method,
        type: event.type, startedSeconds: event.timestamp, receivedBodyBytes: 0,
      });
    });
    cdp.on('Network.responseReceived', event => {
      const item = requests.get(event.requestId);
      if (item) Object.assign(item, {
        status: event.response.status, mimeType: event.response.mimeType,
        fromDiskCache: !!event.response.fromDiskCache, fromServiceWorker: !!event.response.fromServiceWorker,
        contentLength: Number(event.response.headers['Content-Length'] || event.response.headers['content-length'] || 0),
        contentEncoding: event.response.headers['Content-Encoding'] || event.response.headers['content-encoding'] || null,
      });
    });
    cdp.on('Network.dataReceived', event => {
      const item = requests.get(event.requestId);
      if (item) item.receivedBodyBytes += event.dataLength;
    });
    cdp.on('Network.loadingFinished', event => {
      const item = requests.get(event.requestId);
      if (item) Object.assign(item, {
        finished: true, durationMs: (event.timestamp - item.startedSeconds) * 1000,
        encodedTransferBytes: event.encodedDataLength,
      });
    });
    cdp.on('Network.loadingFailed', event => {
      const item = requests.get(event.requestId);
      if (item) item.failure = event.errorText;
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(2000);
      window.__baselineSceneReadyMs = null;
      const observer = new MutationObserver(() => {
        if (window.__baselineSceneReadyMs === null &&
            document.querySelector('#scene-status')?.textContent.includes('胡桃木')) {
          window.__baselineSceneReadyMs = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__baselineSceneReadyMs !== null, null, { timeout: 120000 });
    const initialTiming = await page.evaluate(() => ({
      sceneReadyMs: window.__baselineSceneReadyMs,
      navigation: performance.getEntriesByType('navigation')[0].toJSON(),
      resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
    }));
    phase = 'views';
    // Read Engine.LastCreatedScene from already loaded webpack modules. No source patch or
    // extra bundle is served; these references are used only by this temporary browser session.
    const environment = await page.evaluate(() => {
      self.webpackChunkbabylon_learning.push([[989899], {}, require => self.__baselineRequire = require]);
      const require = self.__baselineRequire;
      for (const [id, factory] of Object.entries(require.m)) {
        if (!/get LastCreatedEngine/.test(factory.toString())) continue;
        for (const value of Object.values(require(id))) {
          if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
            self.__baselineEngine = value.LastCreatedEngine;
            self.__baselineScene = value.LastCreatedScene;
          }
        }
      }
      if (!self.__baselineScene) throw new Error('Could not read the existing Babylon scene');
      const engine = self.__baselineEngine;
      const gl = engine._gl;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        userAgent: navigator.userAgent, devicePixelRatio: devicePixelRatio,
        renderSize: [engine.getRenderWidth(), engine.getRenderHeight()],
        glInfo: engine.getGlInfo(), webglVersion: engine.webGLVersion,
        unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
        maxFps: engine.maxFPS, hardwareScaling: engine.getHardwareScalingLevel(),
      };
    });
    const records = [];
    const views = ['overview', 'reading', 'desk', 'details', 'cabinet', 'first-person'];
    const closeups = [
      { view: 'cabinet-close', position: [-11, -0.9, -10], target: [-13.5, -2.2, -16.8] },
      { view: 'bookshelf-close', position: [13, 1, -11], target: [11.5, 0.5, -17.3] },
    ];
    for (const pose of [...views.map(view => ({ view })), ...closeups]) {
      await page.locator(`[data-view="${pose.position ? 'overview' : pose.view}"]`).click();
      if (pose.position) await page.evaluate(pose => {
        const camera = self.__baselineScene.activeCamera;
        const Vector3 = camera.position.constructor;
        camera.lowerRadiusLimit = 3;
        camera.setTarget(new Vector3(...pose.target));
        camera.setPosition(new Vector3(...pose.position));
      }, pose);
      const record = await page.evaluate(view => new Promise(resolve => {
        const scene = self.__baselineScene;
        const engine = self.__baselineEngine;
        const frames = [];
        let start;
        const before = scene.onBeforeRenderObservable.add(() => { start = performance.now(); });
        const after = scene.onAfterRenderObservable.add(() => {
          frames.push({ startedMs: start, cpuSubmissionMs: performance.now() - start });
          if (frames.length < 150) return;
          scene.onBeforeRenderObservable.remove(before);
          scene.onAfterRenderObservable.remove(after);
          const samples = frames.slice(30);
          const sorted = samples.map(frame => frame.cpuSubmissionMs).sort((a, b) => a - b);
          const camera = scene.activeCamera;
          const target = camera.getTarget();
          resolve({
            view, frames: 150, warmupFrames: 30,
            fps: 119000 / (samples[119].startedMs - samples[0].startedMs),
            cpuMedianMs: (sorted[59] + sorted[60]) / 2, cpuP95Ms: sorted[Math.ceil(0.95 * 120) - 1],
            vertices: scene.getTotalVertices(), activeMeshes: scene.getActiveMeshes().length,
            renderSize: [engine.getRenderWidth(), engine.getRenderHeight()],
            camera: { position: camera.position.asArray(), target: target.asArray(), fov: camera.fov,
                      minZ: camera.minZ, lowerRadiusLimit: camera.lowerRadiusLimit ?? null },
            samples,
          });
        });
      }), pose.view);
      record.screenshot = `${pose.view}.jpg`;
      await page.screenshot({ path: path.join(report, record.screenshot), type: 'jpeg', quality: 90 });
      records.push(record);
      console.log(JSON.stringify({ view: pose.view, fps: record.fps, cpuMedianMs: record.cpuMedianMs }));
    }
    phase = 'interaction';
    await page.locator('[data-view="first-person"]').click();
    const beforeMovement = await page.evaluate(() => self.__baselineScene.activeCamera.position.asArray());
    await page.locator('#gameCanvas').focus();
    await page.keyboard.down('w');
    await page.waitForTimeout(350);
    await page.keyboard.up('w');
    const afterMovement = await page.evaluate(() => self.__baselineScene.activeCamera.position.asArray());
    await page.locator('#settings-btn').click();
    const settingsOpened = await page.locator('#settings-menu').isVisible();
    await page.locator('#settings-close').click();
    await page.locator('[data-view="overview"]').click();
    phase = 'inspector';
    await page.locator('#inspect-btn').click();
    await page.waitForFunction(() => self.__baselineScene.debugLayer.isVisible(), null, { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('#inspect-btn').disabled, null, { timeout: 60000 });
    const inspectorVisible = await page.evaluate(() => self.__baselineScene.debugLayer.isVisible());
    const inspectorDialogs = await page.getByRole('dialog').allTextContents();
    // A fresh Inspector session shows a teaching popover above the application's button.
    // Dismiss the popover through its normal keyboard interaction before toggling the tool.
    await page.keyboard.press('Escape');
    await page.locator('#inspect-btn').click();
    await page.waitForFunction(() => !self.__baselineScene.debugLayer.isVisible());
    const resourceTiming = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.toJSON()));
    const rows = [...requests.values()].map(({ startedSeconds, ...row }) => row);
    const summary = Object.fromEntries(['initial', 'views', 'interaction', 'inspector'].map(name => {
      const selected = rows.filter(row => row.phase === name && !row.url.endsWith('/favicon.ico'));
      return [name, {
        requests: selected.length, completed: selected.filter(row => row.finished).length,
        responseBodyBytes: selected.filter(row => row.finished).reduce((sum, row) => sum + row.receivedBodyBytes, 0),
        encodedTransferBytes: selected.filter(row => row.finished).reduce((sum, row) => sum + row.encodedTransferBytes, 0),
      }];
    }));
    save('requests.json', { url, cacheDisabled: true, serviceWorkers: 'blocked', httpCompression: false,
      initialTiming, summary, requests: rows, resourceTiming });
    save('browser.json', {
      baselineCommit: JSON.parse(fs.readFileSync(path.join(report, 'files.json'))).baselineCommit,
      browserVersion: browser.version(), playwrightVersion, headless: true,
      machine: { platform: os.platform(), release: os.release(), architecture: os.arch(),
                 cpu: os.cpus()[0]?.model, logicalCpuCount: os.cpus().length, memoryBytes: os.totalmem() },
      viewport: [1280, 720], deviceScaleFactor: 1, environment, initialSceneReadyMs: initialTiming.sceneReadyMs,
      sampleMethod: '150 scene render frames per view, discard first 30; CPU from onBeforeRender to onAfterRender, not GPU completion',
      records, interactions: { beforeMovement, afterMovement, settingsOpened, inspectorVisible, inspectorDialogs }, errors, warnings,
    });
    console.log(JSON.stringify({ summary, errors, warningCount: warnings.length }));
    if (errors.length || rows.some(row => row.failure || row.status >= 400) || !inspectorVisible ||
        !settingsOpened || beforeMovement.every((value, index) => value === afterMovement[index])) {
      throw new Error('Browser baseline validation failed; see saved reports');
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
