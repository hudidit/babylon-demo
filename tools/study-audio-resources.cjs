const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = data => createHash('sha256').update(data).digest('hex');
const audioBudgets = { encodedBytes: 2.1 * 1048576, coreBytes: 393216, actionBytes: .35 * 1048576, decodedBytes: 16 * 1048576 };

function validateAudioResources(root) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'audio/study/source.json')));
  assert.equal(source.schemaVersion, 1, 'Unsupported audio manifest');
  assert.equal(source.license, 'CC0-1.0', 'New audio needs a reviewed license');
  assert.ok(source.page.startsWith('https://') && source.author && source.verifiedOn, 'Missing audio provenance');
  const expected = ['drawer-slide', 'drawer-stop', 'door-move', 'door-latch', 'switch', 'paper']
    .flatMap(cue => [cue + '-1', cue + '-2']).sort();
  assert.deepEqual(source.files.map(row => row.id).sort(), expected, 'Audio catalog is incomplete or duplicated');
  const actions = JSON.parse(fs.readFileSync(path.join(root, 'audio/actions/source.json')));
  assert.equal(actions.schemaVersion, 1); assert.equal(actions.license, 'CC0-1.0');
  const actionIds = ['metal-door-move', 'metal-door-latch', 'slide-move', 'slide-stop', 'cloth-touch', 'cloth-wipe', 'cloth-lift']
    .flatMap(cue => [cue + '-1', cue + '-2']).sort();
  assert.deepEqual(actions.files.map(row => row.id).sort(), actionIds, 'Action audio catalog incomplete or duplicated');
  const sources = new Map(actions.sources.map(row => [row.id, row]));
  assert.equal(sources.size, actions.sources.length, 'Duplicate audio source');
  for (const row of actions.sources) {
    assert.equal(row.license, 'CC0-1.0', 'Unverified audio source license');
    assert.ok(row.page.startsWith('https://') && row.author && row.verifiedOn && row.tier && row.pageLicenseEvidence, 'Missing provenance');
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
  }
  let encodedBytes = 0, coreBytes = 0, decodedBytes = 0, actionBytes = 0, actionDecodedBytes = 0;
  for (const row of [...source.files, ...actions.files]) {
    const action = actions.files.includes(row);
    if (action) {
      assert.match(row.file, /^audio\/actions\/[a-z0-9-]+\.[a-f0-9]{10}\.wav$/, 'Unsafe action audio path');
      assert.equal(row.sourceSha256, sources.get(row.sourceId)?.sha256, 'Unreviewed audio source');
      assert.equal(row.loop, /^(metal-door-move|slide-move|cloth-wipe)-/.test(row.id), 'Unexpected audio loop policy');
    } else {
      assert.match(row.file, /^audio\/study\/[a-z0-9-]+\.[a-f0-9]{10}\.wav$/, 'Unsafe audio path');
    }
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
    let peak = 0, stepSquares = 0;
    for (let i = 44; i < data.length; i += 2) {
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)) / 32768);
      if (i > 44) stepSquares += (data.readInt16LE(i) - data.readInt16LE(i - 2)) ** 2;
    }
    assert.ok(peak > 0.05 && peak < 0.71, 'Silent or clipped audio');
    assert.equal(row.peak, peak);
    if (action) {
      actionBytes += data.length; actionDecodedBytes += row.frames * 4;
      const boundary = Math.abs(data.readInt16LE(44) - data.readInt16LE(data.length - 2)) / 32768;
      assert.equal(boundary, row.boundaryStep);
      assert.equal(Math.sqrt(stepSquares / (row.frames - 1)) / 32768, row.adjacentStepRms);
      if (row.loop) assert.ok(boundary <= Math.max(.002, row.adjacentStepRms * 2), 'Loop boundary discontinuity');
    }
    encodedBytes += data.length;
    if (row.id.endsWith('-1')) coreBytes += data.length;
    decodedBytes += row.frames * row.channels * 4;
  }
  assert.equal(encodedBytes - actionBytes, source.totalBytes); assert.equal(decodedBytes - actionDecodedBytes, source.decodedBytes);
  assert.equal(actionBytes, actions.totalBytes); assert.equal(actionDecodedBytes, actions.decodedBytes);
  assert.ok(actionBytes <= audioBudgets.actionBytes, 'Phase B audio allowance exceeded');
  const soundscape = require('./soundscape-audio-resources.cjs').validateSoundscapeAudio(root);
  encodedBytes += soundscape.encodedBytes; decodedBytes += soundscape.decodedBytes; coreBytes += soundscape.coreBytes;
  const daily = require('./daily-audio-resources.cjs').validateDailyAudio(root);
  encodedBytes += daily.encodedBytes; decodedBytes += daily.decodedBytes; coreBytes += daily.coreBytes;
  const birds = require('./bird-audio-resources.cjs').validateBirdAudio(root);
  encodedBytes += birds.encodedBytes; decodedBytes += birds.decodedBytes;
  assert.ok(encodedBytes <= audioBudgets.encodedBytes, 'Audio encoded budget exceeded');
  assert.ok(coreBytes <= audioBudgets.coreBytes, 'Audio core budget exceeded');
  assert.ok(decodedBytes <= audioBudgets.decodedBytes, 'Audio PCM budget exceeded');
  return { files: [...source.files, ...actions.files].map(row => row.file).concat(soundscape.files,daily.files,birds.files), encodedBytes, coreBytes, decodedBytes, actionBytes };
}
module.exports = { validateAudioResources, audioBudgets };
