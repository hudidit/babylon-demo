// Only the final dist is served. Capture real browser script requests, including async shaders.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const dist = path.resolve(__dirname, '../../../../dist'), log = path.join(__dirname, 'network.jsonl');
fs.writeFileSync(log, '');
http.createServer((request, response) => {
  let name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/home\//, '/');
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(dist, '.' + name);
  if (!file.startsWith(dist + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404); response.end(); console.error('404', request.url); return; }
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Length': bytes.length,
      'Content-Type': ({'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml',
        '.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)] || 'application/octet-stream' });
    if (request.headers['sec-fetch-dest'] === 'script') fs.appendFileSync(log, JSON.stringify({
      url: request.url, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }) + '\n');
    response.end(bytes);
  });
}).listen(8766, '127.0.0.1', () => console.log('Final dist: http://127.0.0.1:8766/ and /home/'));
