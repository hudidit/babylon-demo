const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = data => createHash('sha256').update(data).digest('hex');
const audioBudgets = { encodedBytes: 524288, coreBytes: 131072, decodedBytes: 8 * 1048576 };

function validateAudioResources(root) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'audio/study/source.json')));
  assert.equal(source.schemaVersion, 1, 'Unsupported audio manifest');
  assert.equal(source.license, 'CC0-1.0', 'New audio needs a reviewed license');
  assert.ok(source.page.startsWith('https://') && source.author && source.verifiedOn, 'Missing audio provenance');
  const expected = ['drawer-slide', 'drawer-stop', 'door-move', 'door-latch', 'switch', 'paper']
    .flatMap(cue => [cue + '-1', cue + '-2']).sort();
  assert.deepEqual(source.files.map(row => row.id).sort(), expected, 'Audio catalog is incomplete or duplicated');
  let encodedBytes = 0, coreBytes = 0, decodedBytes = 0;
  for (const row of source.files) {
    assert.match(row.file, /^audio\/study\/[a-z0-9-]+\.[a-f0-9]{10}\.wav$/, 'Unsafe audio path');
    assert.equal(row.license, 'CC0-1.0', 'Unverified audio license');
    assert.match(row.sourceSha256, /^[a-f0-9]{64}$/);
    const data = fs.readFileSync(path.join(root, row.file));
    assert.equal(data.length, row.bytes, 'Audio bytes mismatch');
    assert.equal(hash(data), row.sha256, 'Audio SHA256 mismatch');
    assert.ok(row.file.endsWith('.' + row.sha256.slice(0, 10) + '.wav'), 'Audio version mismatch');
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WAVE');
    assert.equal(data.toString('ascii', 12, 16), 'fmt ');
    assert.equal(data.readUInt32LE(16), 16); assert.equal(data.readUInt16LE(20), 1, 'Audio must be PCM');
    assert.equal(data.readUInt16LE(22), 1, 'Audio must be mono');
    assert.equal(data.readUInt16LE(34), 16, 'Audio must be 16 bit');
    assert.equal(row.channels, data.readUInt16LE(22)); assert.equal(row.bitDepth, data.readUInt16LE(34));
    assert.equal(data.readUInt32LE(24), row.sampleRate);
    assert.equal(data.toString('ascii', 36, 40), 'data');
    assert.equal(data.readUInt32LE(40), data.length - 44);
    assert.equal((data.length - 44) / 2, row.frames);
    assert.equal(row.frames / row.sampleRate, row.durationSeconds);
    assert.ok(row.durationSeconds > 0 && row.durationSeconds <= 0.7, 'Unexpected long sound');
    let peak = 0;
    for (let i = 44; i < data.length; i += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(i)) / 32768);
    assert.ok(peak > 0.05 && peak < 0.71, 'Silent or clipped audio');
    assert.equal(row.peak, peak);
    encodedBytes += data.length;
    if (row.id.endsWith('-1')) coreBytes += data.length;
    decodedBytes += row.frames * row.channels * 4;
  }
  assert.equal(encodedBytes, source.totalBytes); assert.equal(decodedBytes, source.decodedBytes);
  assert.ok(encodedBytes <= audioBudgets.encodedBytes, 'Audio encoded budget exceeded');
  assert.ok(coreBytes <= audioBudgets.coreBytes, 'Audio core budget exceeded');
  assert.ok(decodedBytes <= audioBudgets.decodedBytes, 'Audio PCM budget exceeded');
  return { files: source.files.map(row => row.file), encodedBytes, coreBytes, decodedBytes };
}
module.exports = { validateAudioResources, audioBudgets };
