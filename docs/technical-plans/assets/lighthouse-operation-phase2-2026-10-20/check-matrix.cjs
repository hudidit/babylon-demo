// GPU component fixtures; application clock callback is suspended only in this visual suite.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const pw = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const load = require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {planToWorld} = load('HouseLayout'), {LIGHTHOUSE: a} = load('LighthouseLayout'), {COASTAL_SITE: {tower: t}} = load('CoastalSite');
const far = {x: -4.621460526472498, y: -4.264954249549052};
const farHeight = load('WalkingSurface').walkingSurfaceAt(far.x, far.y).height;
const poses = [{name: 'near', ...planToWorld({x: t.x + 1.1, y: t.y - .65}, a.gallery + 1.6)},
  {name: 'house', ...planToWorld(far, farHeight + 1.6)}];
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || path.join(__dirname, 'engines')); fs.mkdirSync(output, {recursive: true});
(async () => {
  const record = {baseline: '31f88dc', method: 'Final dist; real time menu to 21:00; then fixed real optical-head transforms/uniforms with Room update suspended for peak/opposite GPU comparison. No application state-machine or performance claim from these fixtures.',
    physicalDevicesTested: false, fpsOrLoadTimeSampling: false, cases: []};
  try {
    for (const kind of ['chromium', 'webkit']) {
      const executable = kind === 'chromium' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE;
      const browser = await pw[kind].launch({headless: true, ...(executable ? {executablePath: executable} : {})});
      try {
        for (const dpr of [1, 2]) {
          const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: dpr, serviceWorkers: 'block'});
          const page = await context.newPage(), errors = [], warnings = [];
          record.pending = {kind, dpr, stage: 'initial scene', errors, warnings};
          page.on('pageerror', e => errors.push(e.message));
          page.on('console', m => {if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text());});
          page.on('response', r => {if (r.status() >= 400) errors.push(r.status() + ' ' + r.url());});
          await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:8215/', {timeout: 120000});
          await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('全屋八个房间已布置'), null, {timeout: 120000});
          await require('../day-night-phase4-2026-10-19/browser-harness.cjs').capture(page);
          await page.locator('[data-view="balcony"]').click();
          await page.locator('#time-toggle').click(); await page.locator('[data-time-hour="21"]').click();
          await page.evaluate(() => {for (let i = 0; i < 30; i++) s.render();}); await page.locator('#time-close').click();
          assert.equal(await page.evaluate(() => s.metadata.lighthouseOperation.state.state), 'night-running');
          await page.evaluate(() => {
            const observer = s.onBeforeRenderObservable.observers.find(o => o.callback.toString().includes('updateTimeOfDay'));
            if (!observer) throw new Error('Equipment update observer not found'); s.onBeforeRenderObservable.remove(observer);
            e.getDeltaTime = () => 0;
          });
          const frames = () => page.evaluate(async () => {s.render(); await new Promise(resolve => s.executeWhenReady(resolve)); s.render(); s.render();});
          for (const [width, height, viewport] of [[1280, 800, 'desktop'], [390, 844, 'portrait'], [844, 390, 'landscape']]) {
            await page.setViewportSize({width, height});
            for (const pose of poses) {
              await page.evaluate(pose => {
                e.setHardwareScalingLevel(1 / devicePixelRatio); e.resize();
                const c = s.activeCamera, V = c.position.constructor, root = s.getTransformNodeByName('coastal-lighthouse-optical-head');
                c.minZ = .1; c.lowerRadiusLimit = .1; c.upperRadiusLimit = 10000; c.lowerBetaLimit = .001; c.upperBetaLimit = Math.PI - .001;
                c.inertialAlphaOffset = c.inertialBetaOffset = c.inertialRadiusOffset = c.inertialPanningX = c.inertialPanningY = 0;
                c.setTarget(root.position); c.setPosition(new V(pose.x, pose.y, pose.z)); c.getViewMatrix(true); c.getProjectionMatrix(true);
              }, pose);
              const mode = async peak => {
                await page.evaluate(peak => {
                  const root = s.getTransformNodeByName('coastal-lighthouse-optical-head'), eye = s.activeCamera.globalPosition;
                  const angle = Math.atan2(eye.x - root.position.x, eye.z - root.position.z) + (peak ? 0 : Math.PI);
                  root.rotation.y = angle;
                  const material = s.getMaterialByName('lighthouse-directional-emission');
                  material.setVector3('beamDirection', new (eye.constructor)(Math.sin(angle), 0, Math.cos(angle))); material.setFloat('beaconOn', 1);
                }, peak);
                await frames();
                return page.evaluate(() => {
                  s.render(); // Read before the browser discards the default drawing buffer.
                  const gl = e._gl, w = e.getRenderWidth(), h = e.getRenderHeight(), n = 12 * devicePixelRatio;
                  const pixels = new Uint8Array(n * n * 4); gl.readPixels(Math.floor(w / 2 - n / 2), Math.floor(h / 2 - n / 2), n, n, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                  let luma = 0; for (let j = 0; j < pixels.length; j += 4) luma += pixels[j] * .2126 + pixels[j + 1] * .7152 + pixels[j + 2] * .0722;
                  return {luma: luma / (n * n), ready: s.getMaterialByName('lighthouse-directional-emission').getEffect()?.isReady(), renderSize: [w, h]};
                });
              };
              const off = await mode(false), on = await mode(true);
              const entry = {kind, version: browser.version(), dpr, viewport, pose: pose.name, off, on, errors: [...errors], warnings: [...warnings]}; record.cases.push(entry);
              assert.equal(on.ready, true); assert.ok(on.luma > off.luma + (pose.name === 'near' ? 8 : .1), JSON.stringify(entry));
              await page.evaluate(() => e.runRenderLoop(self.shotRender = () => s.render())); await page.waitForTimeout(100);
              await page.screenshot({path: path.join(output, `${kind}-${viewport}-${pose.name}-dpr${dpr}.jpg`), type: 'jpeg', quality: 86});
              await page.evaluate(() => e.stopRenderLoop(shotRender));
            }
          }
          assert.deepEqual(errors, []); await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
          assert.equal(await page.evaluate(() => s.meshes.length + s.transformNodes.length + s.materials.length), 0);
          await context.close();
          delete record.pending;
        }
      } finally {await browser.close();}
    }
    record.passed = true;
  } catch (error) {record.failure = String(error.stack || error); throw error;}
  finally {fs.writeFileSync(path.join(output, 'matrix.json'), JSON.stringify(record, null, 2) + '\n');}
  console.log(JSON.stringify({passed: record.passed, cases: record.cases.length}));
})().catch(error => {console.error(error); process.exitCode = 1;});
