// First-person speed/jump smoke test; fixed render delta and heights are not FPS/load-time measurements.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8113/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [], warnings = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('全屋八个房间已布置'), null, { timeout: 120000 });
    await page.evaluate(() => {
      const id = 900000000 + Math.floor(Math.random() * 90000000);
      webpackChunkbabylon_learning.push([[id], {}, requireFn => self.studyRequire = requireFn]);
      for (const [moduleId, factory] of Object.entries(studyRequire.m)) if (/get LastCreatedEngine/.test(factory.toString()))
        for (const value of Object.values(studyRequire(moduleId))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyScene = value.LastCreatedScene; self.studyEngine = value.LastCreatedEngine;
        }
    });
    await page.locator('[data-view="first-person"]').click();
    await page.waitForTimeout(350);
    const initial = await page.evaluate(() => ({ y: studyScene.activeCamera.position.y, speed: studyScene.activeCamera.speed,
      help: document.querySelector('#view-help')?.textContent, locked: !!document.pointerLockElement }));
    assert.equal(initial.y, 3); assert.equal(initial.speed, .825);
    assert.match(initial.help, /空格跳跃/);
    await page.keyboard.press('Space');
    const samples = [];
    for (let i = 0; i < 32; i++) { await page.waitForTimeout(50); samples.push(await page.evaluate(() => studyScene.activeCamera.position.y)); }
    const apex = Math.max(...samples), landed = samples.at(-1);
    assert.ok(apex > 4.5, 'space rises above eye height');
    assert.ok(Math.abs(landed - 3) < 0.01, 'jump returns to eye height');
    await page.screenshot({ path: path.join(output, 'jump-in-place.jpg'), type: 'jpeg', quality: 90 });

    const eyeY = feet => -5 + (feet + 1.6) * 5;
    const targets = [
      ["bed", 2.1, 8.45, .675], ["sofa", 10.24, 8.4, .441], ["coffee-table", 8.7, 8.4, .468],
      ["chair", 6.9, 1.8, .561], ["balcony-floor", 8.1, 11.8, 0], ["floor", 9.4, 5.35, 0],
    ];
    const landings = {};
    for (const [id, x, y, top] of targets) {
      await page.locator('[data-view="living"]').click();
      await page.locator('[data-view="first-person"]').click();
      await page.waitForTimeout(120);
      await page.evaluate(({ x, y }) => {
        const V = studyScene.activeCamera.position.constructor;
        studyScene.activeCamera.position.set((x - 5.4) * 5, 3, (y - 5.4) * 5);
        studyScene.activeCamera.setTarget(new V((x - 5.4) * 5, 3, (y - 5.4) * 5 + 5));
      }, { x, y });
      await page.waitForTimeout(80);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1200);
      landings[id] = await page.evaluate(() => ({ y: studyScene.activeCamera.position.y, x: studyScene.activeCamera.position.x, z: studyScene.activeCamera.position.z }));
      assert.ok(Math.abs(landings[id].y - eyeY(top)) < 0.01, id + ' lands at its top');
      if (id === 'bed') {
        await page.evaluate(() => studyScene.activeCamera.setTarget(new studyScene.activeCamera.position.constructor(-16.5, 6.1, 34)));
        await page.screenshot({ path: path.join(output, 'landed-on-bed.jpg'), type: 'jpeg', quality: 90 });
      }
      if (id === 'sofa') {
        await page.evaluate(() => studyScene.activeCamera.setTarget(new studyScene.activeCamera.position.constructor(15, 3.2, 20)));
        await page.screenshot({ path: path.join(output, 'landed-on-sofa.jpg'), type: 'jpeg', quality: 90 });
      }
    }

    await page.locator('[data-view="overview"]').click();
    await page.waitForTimeout(150);
    const orbitBefore = await page.evaluate(() => studyScene.activeCamera.position.asArray());
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const orbitAfter = await page.evaluate(() => studyScene.activeCamera.position.asArray());
    assert.deepEqual(orbitAfter, orbitBefore, 'space does not move the panorama camera');
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    const record = { passed: true, browser: browser.version(), initial, jump: { samples, apex, landed },
      landings, expected: Object.fromEntries(targets.map(([id, , , top]) => [id, eyeY(top)])), orbitBefore, orbitAfter,
      errors, warnings, failed, fpsOrLoadTimeSampling: false };
    fs.writeFileSync(path.join(output, 'jump.json'), JSON.stringify(record, null, 2) + '\n');
    console.log('First-person speed/jump browser check passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
