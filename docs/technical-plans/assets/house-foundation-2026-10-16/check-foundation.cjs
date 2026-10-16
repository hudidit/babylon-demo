// Functional state/lifecycle checks, no FPS or loading-time sampling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8099/';
const output = path.resolve(process.env.STUDY_CHECK_OUTPUT || __dirname);
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const record = { baseline: '05ca8b0', browser: browser.version(), fpsOrLoadTimeSampling: false };
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#scene-status').textContent.includes('胡桃木'));
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    record.before = await page.evaluate(() => {
      webpackChunkbabylon_learning.push([[989880], {}, require => self.studyRequire = require]);
      for (const [id, factory] of Object.entries(studyRequire.m)) {
        if (!/get LastCreatedEngine/.test(factory.toString())) continue;
        for (const value of Object.values(studyRequire(id))) if (typeof value === 'function' && value.LastCreatedEngine?.scenes?.length) {
          self.studyEngine = value.LastCreatedEngine; self.studyScene = value.LastCreatedScene;
        }
      }
      studyEngine.stopRenderLoop();
      return { metadata: studyScene.metadata, meshes: studyScene.meshes.length, materials: studyScene.materials.length,
        vertices: studyScene.getTotalVertices(), cameras: studyScene.cameras.length, lights: studyScene.lights.length,
        unownedGeometry: studyScene.meshes.filter(mesh => mesh.getTotalVertices() > 0 && !mesh.metadata?.ownerRooms?.length).map(mesh => mesh.name),
        unownedContentNodes: studyScene.transformNodes.filter(node => node.name !== 'first-person-room-shell' && !node.metadata?.ownerRooms?.length).map(node => node.name),
        sharedDoorOwners: studyScene.getTransformNodeByName('connecting-door').metadata.ownerRooms,
        roomStates: [...document.querySelectorAll('#floor-plan-drawing [data-room]')].map(node => ({ id: node.dataset.room, state: node.dataset.state })),
        mapLayoutVersion: document.querySelector('#floor-plan-drawing').dataset.layoutVersion,
        exactPositionPoints: document.querySelectorAll('.plan-position').length };
    });
    assert.equal(record.before.metadata.layoutVersion, 'legacy-two-room');
    assert.equal(record.before.metadata.targetLayoutVersion, 'house-plan-v1');
    assert.equal(record.before.mapLayoutVersion, 'legacy-two-room');
    assert.deepEqual(record.before.unownedGeometry, []);
    assert.deepEqual(record.before.unownedContentNodes, []);
    assert.deepEqual(record.before.sharedDoorOwners, ['living', 'study']);
    assert.deepEqual([record.before.meshes, record.before.vertices, record.before.materials, record.before.cameras, record.before.lights], [145, 269624, 64, 3, 6]);
    assert.deepEqual(record.before.roomStates.filter(room => room.state === 'ready').map(room => room.id).sort(), ['living', 'study']);
    assert.equal(record.before.roomStates.filter(room => room.state === 'planned').length, 6);
    assert.equal(record.before.exactPositionPoints, 0);
    await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide')); });
    record.afterDispose = await page.evaluate(() => ({ disposed: studyScene.isDisposed, meshes: studyScene.meshes.length,
      materials: studyScene.materials.length, lights: studyScene.lights.length, engineScenes: studyEngine.scenes.length }));
    assert.equal(record.afterDispose.disposed, true);
    assert.deepEqual([record.afterDispose.meshes, record.afterDispose.materials, record.afterDispose.lights, record.afterDispose.engineScenes], [0, 0, 0, 0]);
    assert.deepEqual(errors, []); record.passed = true;
  } finally {
    fs.writeFileSync(path.join(output, 'foundation-browser.json'), JSON.stringify({ ...record, errors }, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify(record, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
