const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = process.env.STUDY_URL || 'http://127.0.0.1:8096/demo/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const requests = [], errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    page.on('response', r => { if (/^https?:/.test(r.url())) requests.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] }); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#audio-status').dataset.state === 'ready');
    assert.equal(requests.filter(r => /\/audio\/study\/.*\.wav$/.test(r.url)).length, 12);
    assert.ok(requests.every(r => r.url.startsWith(url)), 'all network assets must retain the deployment subpath');
    assert.ok(requests.every(r => r.status === 200));
    const heading = await page.evaluate(() => {
      const brand = document.querySelector('.eyebrow').getBoundingClientRect(), tools = document.querySelector('.tools').getBoundingClientRect();
      return { brandRight: brand.right, toolsLeft: tools.left };
    });
    assert.ok(heading.brandRight <= heading.toolsLeft, 'mobile branding must not overlap the audio toolbar');
    await page.locator('#settings-btn').click(); await page.locator('#audio-preview').click();
    await page.screenshot({ path: path.join(__dirname, 'audio-settings-portrait.jpg'), type: 'jpeg', quality: 90 });
    await page.setViewportSize({ width: 844, height: 390 }); await page.locator('#settings-reset').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#settings-reset').isVisible());
    const credits = await page.request.get(url + 'audio/study/credits.html'); assert.equal(credits.status(), 200);
    assert.match(await credits.text(), /laleksic/); assert.deepEqual(errors, []);
    const record = { passed: true, baseUrl: url, browser: browser.version(), portrait: [390, 844], landscape: [844, 390],
      audioFiles: 12, creditsStatus: credits.status(), heading, requests, errors };
    fs.writeFileSync(path.join(__dirname, 'subpath-browser.json'), JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, audioFiles: 12, requests: requests.length, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
