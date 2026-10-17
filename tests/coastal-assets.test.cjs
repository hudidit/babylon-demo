const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = require('../public/textures/coastal/source.json');
const lock = require('../tools/coastal-material-inputs.json');
const { RGBE_ReadHeader, RGBE_ReadPixels } = require('@babylonjs/core/Misc/HighDynamicRange/hdr.js');
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    assert.equal(b[i], 255); const marker = b[i + 1], size = b.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + size;
  }
  throw Error('JPEG dimensions missing');
}
test('coastal deliveries are locked, correctly sized and contain only the reviewed sources', () => {
  assert.equal(source.files.length, 7); assert.equal(lock.inputs.length, 6);
  assert.ok(source.runtimeBytes < 1.55 * 1048576);
  for (const file of source.files) {
    const b = fs.readFileSync(path.join(root, 'public', file.file));
    assert.equal(b.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), file.deliverySha256);
    if (!file.input) continue;
    const input = lock.inputs.find(i => i.input === file.input);
    assert.equal(input.sha256, file.sha256); assert.match(input.sha256, /^[a-f0-9]{64}$/);
    assert.equal(input.license, 'CC0-1.0');
    assert.ok(['seaside_rock', 'aerial_grass_rock'].includes(input.asset));
    assert.match(input.url, /^https:\/\/dl.polyhaven.org\/file\/ph-assets\/Textures\/png\//);
    assert.deepEqual(jpegSize(b), file.size);
    if (file.input.includes('normal')) assert.match(file.semantic, /OpenGL/);
    if (file.input.includes('arm')) assert.match(file.semantic, /R=AO G=roughness B=metalness/);
  }
});
test('generated RGBE environment is valid and places its bright sun in the shared daylight direction', () => {
  const raw = fs.readFileSync(path.join(root, 'public/environment/coastal-daylight.hdr'));
  const info = RGBE_ReadHeader(raw), pixels = RGBE_ReadPixels(raw, info);
  assert.deepEqual([info.width, info.height], [256, 128]);
  assert.equal(pixels.length, 256 * 128 * 3);
  assert.ok(pixels.every(n => Number.isFinite(n) && n >= 0));
  const sky = JSON.parse(fs.readFileSync(path.join(root, 'src/examples/CoastalSky.ts'), 'utf8').match(/export const COASTAL_SKY = (.*?) as const;/)[1]);
  assert.deepEqual(source.files.at(-1).parameters, sky, 'regenerate HDR whenever sky parameters change');
  let brightest = 0;
  for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > pixels[brightest]) brightest = i;
  assert.ok(pixels[brightest] > 8, 'sun radiance must not be clipped to LDR');
  const pixel = brightest / 3, theta = (Math.floor(pixel / 256) + .5) / 128 * Math.PI;
  const phi = (pixel % 256 + .5) / 256 * 2 * Math.PI - Math.PI;
  const direction = [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
  const length = Math.hypot(...sky.sun), dot = direction.reduce((sum, v, i) => sum + v * sky.sun[i] / length, 0);
  assert.ok(dot > .999, 'outdoor environment and direct sunlight must agree');
});
