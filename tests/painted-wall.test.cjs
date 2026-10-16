const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { inflateSync } = require('node:zlib');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const source = require('../public/textures/study/painted_wall/source.json');

function pixels(data) {
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16), 512); assert.equal(data.readUInt32BE(20), 512);
  assert.equal(data[24], 8);
  const channels = data[25] === 0 ? 1 : 3, chunks = [];
  for (let offset = 8; offset < data.length;) {
    const size = data.readUInt32BE(offset), type = data.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const decoded = inflateSync(Buffer.concat(chunks)), rows = [];
  for (let y = 0; y < 512; y++) {
    const offset = y * (512 * channels + 1);
    assert.equal(decoded[offset], 0); rows.push(decoded.subarray(offset + 1, offset + 1 + 512 * channels));
  }
  return Buffer.concat(rows);
}

test('paint maps are reproducible, seamless-periodic and retain subtle opaque nonmetal paint channels', () => {
  const baked = JSON.parse(execFileSync('python3', ['-c',
    'import hashlib,json,runpy; m=runpy.run_path("tools/generate-painted-wall.py"); print(json.dumps({n:hashlib.sha256(b).hexdigest() for n,b in m["build_maps"]().items()})); assert m["smooth_noise"](0,17,8)==m["smooth_noise"](512,17,8); assert m["smooth_noise"](19,0,64)==m["smooth_noise"](19,512,64)',
  ], { cwd: root, encoding: 'utf8' }));
  for (const [name, record] of Object.entries(source.files)) {
    const data = fs.readFileSync(path.join(root, 'public', record.file));
    assert.equal(data.length, record.bytes);
    const hash = createHash('sha256').update(data).digest('hex');
    assert.equal(hash, record.sha256); assert.equal(hash, baked[name]);
    const values = pixels(data);
    if (name === 'color.png') {
      assert.ok(values.every(value => value >= 246 && value <= 254), 'paint must avoid strong stains or masonry contrast');
      assert.ok(new Set(values).size >= 3, 'colour must retain fine variation');
    } else for (let i = 0; i < values.length; i += 3) {
      if (name === 'arm.png') {
        assert.equal(values[i], 255); assert.equal(values[i + 2], 0);
        assert.ok(values[i + 1] >= 228 && values[i + 1] <= 236);
      } else {
        const normal = [values[i], values[i + 1], values[i + 2]].map(value => value / 127.5 - 1);
        assert.ok(Math.abs(Math.hypot(...normal) - 1) < 0.01);
        assert.ok(normal[2] > 0.98, 'fine paint must not acquire heavy relief');
      }
    }
  }
});
