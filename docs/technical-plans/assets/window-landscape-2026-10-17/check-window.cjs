// Deterministic camera/visual checks; no FPS or load-time experiment.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
(async () => {
  const output = process.env.STUDY_CHECK_OUTPUT || __dirname;
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [], warnings = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => requests.push({ url: r.url(), status: r.status(), bytes: Number(r.headers()['content-length'] || 0) }));
  const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const render = () => page.evaluate(() => { for (let i = 0; i < 6; i++) s.render(); });
  const shot = async name => { await render(); await page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 90 }); };
  const pose = (position, target) => page.evaluate(({ position, target }) => {
    const c = s.activeCamera, V = c.position.constructor;
    const world = ([x, y, h]) => new V((x - 5.4) * 5, -5 + h * 5, (y - 5.4) * 5);
    c.cameraDirection.setAll(0); c.cameraRotation.setAll(0); c.movement.resetPanVelocity(); c.movement.resetRotationVelocity();
    c.position.copyFrom(world(position)); c.setTarget(world(target)); c.getViewMatrix(true); c.getProjectionMatrix(true);
    for (let i = 0; i < 5; i++) s.render();
  }, { position, target });
  try {
    await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:8120/', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('次卧已布置'));
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    const firstScreenJsBytes = requests.filter(r => new URL(r.url).pathname.endsWith('.js')).reduce((n, r) => n + r.bytes, 0);
    assert.ok(firstScreenJsBytes <= 3 * 1048576);
    await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989995], {}, r => self.req = r]);
      for (const [id, f] of Object.entries(req.m)) if (/get LastCreatedEngine/.test(f.toString()))
        for (const v of Object.values(req(id))) if (typeof v === 'function' && v.LastCreatedEngine?.scenes?.length) {
          self.s = v.LastCreatedScene; v.LastCreatedEngine.stopRenderLoop(); v.LastCreatedEngine.getDeltaTime = () => 50;
        }
    });
    await shot('overview');
    await page.locator('[data-view="study"]').click(); await shot('study-preset');
    await page.locator('[data-view="first-person"]').click();
    for (const [name, p, t] of [
      ['study-front', [6.9, 1.3, 1.6], [6.9, -8, 1.6]],
      ['study-left', [6.4, .75, 1.6], [6.4, -8, 1.6]],
      ['study-right', [7.4, .75, 1.6], [7.4, -8, 1.6]],
      ['study-oblique', [7.8, 1.1, 1.6], [6.6, -.8, 1.6]],
      ['master-front', [2.4, 1.15, 1.6], [2.4, -8, 1.6]],
      ['bedroom-front', [1.2, 9, 1.6], [-8, 9, 1.6]],
      ['living-front', [9.5, 8.4, 1.6], [18, 8.4, 1.6]],
      ['balcony', [8, 11.6, 1.6], [8, 25, 1.6]],
    ]) { await pose(p, t); await shot(name); }
    const scene = await page.evaluate(() => ({ meshes: s.meshes.length, vertices: s.getTotalVertices(), materials: s.materials.length,
      textures: s.textures.length, lights: s.lights.length, cameras: s.cameras.length,
      textureInventory: s.textures.map(t => ({ name: t.name, size: [t.getSize().width, t.getSize().height], target: t.isRenderTarget })),
      exterior: s.meshes.filter(m => m.metadata?.exterior).map(m => ({ name: m.name, vertices: m.getTotalVertices(), bounds: [m.getBoundingInfo().boundingBox.minimumWorld.asArray(), m.getBoundingInfo().boundingBox.maximumWorld.asArray()] })) }));
    let parallax;
    if (scene.exterior.length) {
      const anchors = await page.evaluate(() => {
        const mesh = s.getMeshByName('exterior-trees-0'), p = mesh.getVerticesData('position');
        let x = 0, z = -50, distance = Infinity;
        for (let i = 0; i < p.length; i += 3) if (p[i + 1] < -4 && Math.abs(p[i] - 7.5) < distance) {
          x = p[i]; z = p[i + 2]; distance = Math.abs(x - 7.5);
        }
        return { near: [x, 3, z], far: [x, 3, -Math.sqrt(220 ** 2 - x ** 2)] };
      });
      const project = () => page.evaluate(anchors => {
        const c = s.activeCamera, V = c.position.constructor, matrix = c.getWorldMatrix().constructor;
        const viewport = c.viewport.toGlobal(s.getEngine().getRenderWidth(), s.getEngine().getRenderHeight());
        return Object.fromEntries(Object.entries(anchors).map(([key, p]) => [key, V.Project(new V(...p), matrix.Identity(), s.getTransformMatrix(), viewport).asArray()]));
      }, anchors);
      await pose([6.4, .75, 1.6], [6.4, -8, 1.6]); const left = await project();
      await pose([7.4, .75, 1.6], [7.4, -8, 1.6]); const right = await project();
      const nearPixels = Math.abs(right.near[0] - left.near[0]), farPixels = Math.abs(right.far[0] - left.far[0]);
      assert.ok(nearPixels > farPixels * 4 && nearPixels > 60, 'actual near tree moves more than the distant background');
      assert.ok(await page.evaluate(() => s.meshes.filter(m => m.metadata?.exterior).every(m => !m.isPickable && !m.checkCollisions)));
      parallax = { movementMetres: 1, anchors, left, right, nearPixels, farPixels };
    }
    await page.setViewportSize({ width: 390, height: 844 }); await pose([6.9, .9, 1.6], [6.9, -8, 1.6]); await shot('study-portrait');
    assert.deepEqual(errors, []); assert.ok(requests.every(r => r.status < 400));
    fs.writeFileSync(path.join(output, 'window.json'), JSON.stringify({ passed: true, browser: browser.version(), firstScreenJsBytes, scene, parallax, errors, warnings, requests, fpsOrLoadTimeSampling: false }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log('Window visual checks passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
