// Static visual and resource validation only. Does not sample FPS or CPU/GPU timings.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const output = path.resolve(arg('--output', '/private/tmp/babylon-tree-shaking-20261015/screens'));
const profiles = ['after'];
const url = process.env.BASELINE_URL || 'http://127.0.0.1:8094/';
const poses = [
  ...['overview', 'reading', 'desk', 'details', 'cabinet', 'first-person'].map(view => ({ view })),
  { view: 'cabinet-close', position: [-11, -0.9, -10], target: [-13.5, -2.2, -16.8] },
  { view: 'bookshelf-close', position: [13, 1, -11], target: [11.5, 0.5, -17.3] },
  { view: 'cabinet-first-person-close', preset: 'first-person', position: [-12.5, 1, -15], target: [-13.5, -1.8, -17.2] },
  { view: 'bookshelf-first-person-close', preset: 'first-person', position: [11.5, 1, -15.1], target: [11.5, 0, -17.5] },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  try {
    for (const profile of profiles) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const requests = new Map(), errors = [], warnings = [];
      let phase = 'initial';
      cdp.on('Network.requestWillBeSent', event => {
        if (new URL(event.request.url).pathname === '/favicon.ico') return;
        if (/^https?:/.test(event.request.url)) requests.set(event.requestId,
          { url: event.request.url, phase, receivedBodyBytes: 0 });
      });
      cdp.on('Network.responseReceived', event => {
        const row = requests.get(event.requestId);
        if (row) Object.assign(row, { status: event.response.status,
          contentLength: Number(event.response.headers['Content-Length'] || event.response.headers['content-length'] || 0),
          fromDiskCache: !!event.response.fromDiskCache, fromServiceWorker: !!event.response.fromServiceWorker });
      });
      cdp.on('Network.dataReceived', event => {
        const row = requests.get(event.requestId); if (row) row.receivedBodyBytes += event.dataLength;
      });
      cdp.on('Network.loadingFinished', event => {
        const row = requests.get(event.requestId); if (row) Object.assign(row, { finished: true, encodedTransferBytes: event.encodedDataLength });
      });
      cdp.on('Network.loadingFailed', event => {
        const row = requests.get(event.requestId); if (row) row.failure = event.errorText;
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
        if (message.type() === 'warning') warnings.push(message.text());
      });
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('胡桃木'), null, { timeout: 120000 });
      const environment = await page.evaluate(() => {
        self.webpackChunkbabylon_learning.push([[989899], {}, require => self.__comparisonRequire = require]);
        const require = self.__comparisonRequire;
        for (const [id, factory] of Object.entries(require.m)) {
          if (!/get LastCreatedEngine/.test(factory.toString())) continue;
          for (const value of Object.values(require(id))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
            self.__comparisonEngine = value.LastCreatedEngine; self.__comparisonScene = value.LastCreatedScene;
          }
        }
        if (!self.__comparisonScene) throw new Error('Existing scene not found');
        self.__comparisonEngine.stopRenderLoop();
        return { glInfo: self.__comparisonEngine.getGlInfo(), renderSize: [self.__comparisonEngine.getRenderWidth(), self.__comparisonEngine.getRenderHeight()],
          viewport: [innerWidth, innerHeight], devicePixelRatio, staticCaptureRenderLoopStopped: true };
      });
      phase = 'views';
      const directory = path.join(output, profile); fs.mkdirSync(directory, { recursive: true });
      const views = [];
      for (const pose of poses) {
        await page.locator(`[data-view="${pose.preset || (pose.position ? 'overview' : pose.view)}"]`).click();
        const record = await page.evaluate(pose => {
          const scene = self.__comparisonScene;
          const camera = scene.activeCamera;
          if (pose.position) {
            const Vector3 = camera.position.constructor;
            if (typeof camera.setPosition === 'function') {
              camera.lowerRadiusLimit = 3;
              camera.setTarget(new Vector3(...pose.target)); camera.setPosition(new Vector3(...pose.position));
            } else {
              camera.position.set(...pose.position); camera.setTarget(new Vector3(...pose.target));
            }
          }
          // A few explicit frames settle postprocess targets and shadow refresh for a still image.
          for (let i = 0; i < 3; i++) scene.render();
          return { view: pose.view, vertices: scene.getTotalVertices(), activeMeshes: scene.getActiveMeshes().length,
            camera: { position: camera.position.asArray(), target: camera.getTarget().asArray(), fov: camera.fov,
              minZ: camera.minZ, lowerRadiusLimit: camera.lowerRadiusLimit ?? null } };
        }, pose);
        await page.screenshot({ path: path.join(directory, `${pose.view}.png`) });
        await page.screenshot({ path: path.join(directory, `${pose.view}.jpg`), type: 'jpeg', quality: 95 });
        views.push(record);
      }
      const models = await page.evaluate(() => {
        const scene = self.__comparisonScene;
        return ['antique-cabinet', 'antique-bookshelf'].map(name => ({ name,
          meshes: scene.meshes.filter(mesh => {
            if (!mesh.getTotalVertices()) return false;
            for (let parent = mesh.parent; parent; parent = parent.parent) if (parent.name === name) return true;
            return false;
          }).map(mesh => ({ name: mesh.name, vertices: mesh.getTotalVertices(),
            indices: mesh.getTotalIndices(), receiveShadows: mesh.receiveShadows, collisions: mesh.checkCollisions,
            frozen: mesh.isWorldMatrixFrozen, pickable: mesh.isPickable,
            bounds: { min: mesh.getBoundingInfo().boundingBox.minimumWorld.asArray(), max: mesh.getBoundingInfo().boundingBox.maximumWorld.asArray() },
            castsIntoAllLights: scene.lights.filter(light => light.getShadowGenerator?.()).every(light =>
              light.getShadowGenerator().getShadowMap().renderList.includes(mesh)),
            textures: mesh.material.getActiveTextures().map(texture => ({ name: texture.name, size: texture.getSize(), gammaSpace: texture.gammaSpace })),
          })) }));
      });
      const rendering = await page.evaluate(() => {
        const scene = self.__comparisonScene;
        const pipeline = scene.postProcessRenderPipelineManager.supportedPipelines;
        return {
          environment: { size: scene.environmentTexture.getSize(), intensity: scene.iblIntensity, exposure: scene.imageProcessingConfiguration.exposure,
            toneMapping: scene.imageProcessingConfiguration.toneMappingType, collisions: scene.collisionsEnabled },
          cameras: scene.cameras.map(camera => ({ name: camera.name, inputs: Object.keys(camera.inputs.attached).sort() })),
          pipelines: pipeline.map(p => ({ name: p.name, class: p.getClassName(),
            config: Object.fromEntries(['fxaaEnabled','sharpenEnabled','bloomEnabled','bloomWeight','samples','radius','totalStrength','base','maxZ','bilateralSamples','textureSamples'].filter(k => p[k] !== undefined).map(k => [k,p[k]])) })),
          materials: scene.materials.map(m => ({ name: m.name, class: m.getClassName(), textures: m.getActiveTextures().map(t => ({ name: t.name, size: t.getSize(), gammaSpace: t.gammaSpace })) })),
          shadows: scene.lights.filter(light => light.getShadowGenerator?.()).map(light => ({ name: light.name, intensity: light.intensity,
            casters: light.getShadowGenerator().getShadowMap().renderList.map(m => m.name).sort() })),
        };
      });
      let interactions = null;
      if (profile === 'after') {
        phase = 'interaction';
        await page.locator('[data-view="first-person"]').click();
        await page.locator('#gameCanvas').focus();
        const movementStart = await page.evaluate(() => self.__comparisonScene.activeCamera.position.asArray());
        await page.keyboard.down('w');
        await page.evaluate(() => { for (let i = 0; i < 10; i++) self.__comparisonScene.render(); });
        await page.keyboard.up('w');
        const movementEnd = await page.evaluate(() => self.__comparisonScene.activeCamera.position.asArray());
        await page.locator('#settings-btn').click();
        const settingsVisible = await page.locator('#settings-menu').isVisible();
        await page.locator('#movement-speed').evaluate(input => {
          input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const speedChanged = await page.evaluate(() => self.__comparisonScene.activeCamera.speed);
        await page.locator('#settings-reset').click();
        const speedReset = await page.evaluate(() => self.__comparisonScene.activeCamera.speed);
        await page.locator('#settings-close').click();
        await page.locator('[data-view="overview"]').click();
        await page.evaluate(() => { for (let i = 0; i < 3; i++) self.__comparisonScene.render(); });
        const orbitStart = await page.evaluate(() => ({ alpha: self.__comparisonScene.activeCamera.alpha, radius: self.__comparisonScene.activeCamera.radius }));
        await page.mouse.move(620, 300);
        await page.mouse.down();
        await page.mouse.move(720, 330, { steps: 5 });
        await page.mouse.up();
        await page.evaluate(() => { for (let i = 0; i < 3; i++) self.__comparisonScene.render(); });
        const orbitAfterDrag = await page.evaluate(() => self.__comparisonScene.activeCamera.alpha);
        await page.mouse.wheel(0, -250);
        await page.evaluate(() => { for (let i = 0; i < 3; i++) self.__comparisonScene.render(); });
        const radiusAfterZoom = await page.evaluate(() => self.__comparisonScene.activeCamera.radius);
        await page.locator('[data-view="overview"]').click();
        phase = 'inspector';
        await page.locator('#inspect-btn').click();
        await page.waitForFunction(() => self.__comparisonScene.debugLayer.isVisible() && !document.querySelector('#inspect-btn').disabled, null, { timeout: 60000 });
        const teaching = page.locator('.fui-TeachingPopoverSurface');
        try { await teaching.waitFor({ state: 'visible', timeout: 2000 }); } catch {}
        await page.keyboard.press('Escape');
        if (await teaching.isVisible()) {
          await page.mouse.click(400, 400);
          await page.keyboard.press('Escape');
          await teaching.waitFor({ state: 'hidden', timeout: 3000 });
        }
        await page.locator('#inspect-btn').click();
        await page.waitForFunction(() => !self.__comparisonScene.debugLayer.isVisible());
        const sameEngineAfterInspector = await page.evaluate(() => self.__comparisonScene.getEngine() === self.__comparisonEngine && self.__comparisonEngine.scenes.length === 1);
        interactions = { movementStart, movementEnd, settingsVisible, speedChanged, speedReset,
          orbitStart, orbitAfterDrag, radiusAfterZoom, sameEngineAfterInspector, inspectorOpenedAndClosed: true };
        if (!settingsVisible || movementStart.every((value, i) => value === movementEnd[i]) || speedChanged !== 1.1 || speedReset !== 0.55 ||
            orbitStart.alpha === orbitAfterDrag || orbitStart.radius === radiusAfterZoom || !sameEngineAfterInspector) throw new Error('Interaction regression');
      }
      const rows = [...requests.values()];
      const result = { profile, browserVersion: browser.version(), machine: { cpu: os.cpus()[0]?.model, architecture: os.arch() },
        comparisonBaseline: '6dea648', fpsCpuGpuSampling: false, environment, servedModelsViaRoute: profile !== 'after',
        requests: rows, errors, warnings, views, models, rendering, interactions };
      fs.writeFileSync(path.join(output, `${profile}.json`), JSON.stringify(result, null, 2) + '\n');
      if (errors.length || rows.some(row => row.failure || row.status >= 400)) throw new Error(`Browser error in ${profile}`);
      console.log(JSON.stringify({ profile, screenshots: views.length, errors: errors.length }));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
