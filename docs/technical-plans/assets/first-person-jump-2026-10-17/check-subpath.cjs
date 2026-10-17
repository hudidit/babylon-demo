// Verify only the released dist under a /home/ subdirectory; no rendering performance measurement.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
(async () => {
  const output = process.env.STUDY_CHECK_OUTPUT || __dirname;
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => requests.push({ url: response.url(), status: response.status() }));
  try {
    await page.goto(process.env.STUDY_SUBPATH_URL || 'http://127.0.0.1:8115/home/', { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#scene-status')?.textContent.includes('全屋八个房间已布置'), null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#audio-status')?.dataset.state === 'ready', null, { timeout: 120000 });
    const http = requests.filter(request => new URL(request.url).protocol === 'http:');
    assert.ok(http.length > 20, 'assets and bundles requested');
    assert.ok(http.every(request => new URL(request.url).pathname.startsWith('/home/') && request.status < 400),
      'all requests stay under /home/ and succeed');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'subpath.json'), JSON.stringify({ passed: true, errorCount: errors.length,
      requestCount: http.length, jsRequests: http.filter(request => new URL(request.url).pathname.endsWith('.js')).length }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log('subpath passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
