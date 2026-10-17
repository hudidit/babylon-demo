// Regression for walking down from allowed platforms without jumping; fixed sampling is not FPS/load-time evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8113/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const eyeY = top => -5 + (top + 1.6) * 5;
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
    const attach = () => page.evaluate(() => {
      const camera = studyScene.activeCamera, canvas = document.querySelector('#gameCanvas');
      camera.attachControl(canvas, true); canvas.focus();
    });
    const reset = async () => {
      await page.locator('[data-view="living"]').click();
      await page.locator('[data-view="first-person"]').click();
      await page.waitForTimeout(250); await attach();
    };
    const jumpTo = async (x, y) => {
      await page.evaluate(({ x, y }) => {
        const V = studyScene.activeCamera.position.constructor, camera = studyScene.activeCamera;
        camera.position.set((x - 5.4) * 5, 3, (y - 5.4) * 5);
        camera.setTarget(new V((x - 5.4) * 5, 3, (y - 5.4) * 5 + 5));
        camera.attachControl(document.querySelector('#gameCanvas'), true);
        document.querySelector('#gameCanvas').focus();
      }, { x, y });
      await page.waitForTimeout(100); await page.keyboard.press('Space'); await page.waitForTimeout(1400);
      return page.evaluate(() => ({ y: studyScene.activeCamera.position.y, x: studyScene.activeCamera.position.x, z: studyScene.activeCamera.position.z }));
    };
    const walkOff = async (dx, dz) => {
      await page.evaluate(({ dx, dz }) => {
        const V = studyScene.activeCamera.position.constructor, camera = studyScene.activeCamera;
        camera.setTarget(new V(camera.position.x + dx, camera.position.y, camera.position.z + dz));
        camera.speed = 3; // Test-only acceleration; product base speed is 0.825.
        camera.attachControl(document.querySelector('#gameCanvas'), true);
        document.querySelector('#gameCanvas').focus();
      }, { dx, dz });
      const samples = []; await page.keyboard.down('w');
      for (let i = 0; i < 20; i++) { await page.waitForTimeout(200); samples.push(await page.evaluate(() => ({ y: studyScene.activeCamera.position.y, x: studyScene.activeCamera.position.x, z: studyScene.activeCamera.position.z }))); }
      await page.keyboard.up('w');
      return samples;
    };
    const targets = [
      { id: "bed", x: 2.1, y: 8.45, top: .73, dx: 0, dz: 5 },
      { id: "sofa", x: 10.24, y: 8.4, top: .441, dx: -5, dz: 0 },
      { id: "coffee-table", x: 8.7, y: 8.4, top: .468, dx: -5, dz: 0 },
    ];
    const results = {};
    for (const target of targets) {
      await reset();
      const landed = await jumpTo(target.x, target.y);
      assert.ok(Math.abs(landed.y - eyeY(target.top)) < .01, target.id + ' landed on the platform');
      const samples = await walkOff(target.dx, target.dz);
      const final = samples.at(-1), minY = Math.min(...samples.map(sample => sample.y));
      assert.ok(Math.abs(final.y - 3) < .01 && Math.abs(minY - 3) < .01, target.id + ' walks down to the floor without jumping');
      results[target.id] = { landed, final, minY, samples };
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'walk-off.json'), JSON.stringify({ passed: true, testSpeedMultiplier: 3,
      note: 'Walking down only; product base speed remains 0.825. Jumping was not used after landing.',
      targets, results, errors, fpsOrLoadTimeSampling: false }, null, 2) + '\n');
    console.log('Walk-off regression passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
