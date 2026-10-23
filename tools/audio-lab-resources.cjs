const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const hash = b => createHash('sha256').update(b).digest('hex');
function validateLabResources(root = path.resolve(__dirname, '..')) {
  const folder = path.join(root, 'assets/audio-lab');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio-source/soundscape-lab/source.json')));
  const study = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio-source/study/source.json')));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.clips.map(c => c.id).sort(), ['cloth-wipe','door-latch','door-motion','motor-loop','rain-loop','sea-loop','wind-loop']);
  assert.equal(sources.sources.length, 5);
  for (const s of sources.sources) {
    assert.equal(s.license, 'CC0-1.0'); assert.ok(s.author && s.verifiedOn && s.pageLicenseEvidence);
    assert.match(s.file, /^[a-z-]+\.(?:mp3|wav|flac)$/);
    assert.ok(s.page.startsWith('https://') && s.url.startsWith('https://'));
    const data = fs.readFileSync(path.join(root, 'assets/audio-source/soundscape-lab', s.file));
    assert.equal(hash(data), s.sha256, 'Source SHA256 mismatch'); assert.equal(data.length, s.bytes);
  }
  let decodedBytes = 0, compactBytes = 0, wavBytes = 0;
  for (const c of manifest.clips) {
    assert.equal(c.license, 'CC0-1.0'); assert.equal(c.status, 'audition-candidate');
    const expected = c.sourceId.startsWith('study/') ? study.files[c.sourceId.slice(6)] : sources.sources.find(s => s.id === c.sourceId)?.sha256;
    assert.equal(c.sourceSha256, expected, 'Derivative source mismatch');
    assert.equal(c.sampleRate, 48000); assert.ok(c.channels === 1 || c.channels === 2);
    assert.equal(c.duration, c.frames / c.sampleRate); assert.equal(c.decodedBytes, c.frames * c.channels * 4);
    assert.equal(c.formats[0].format, 'wav'); assert.equal(c.formats.length, c.loop ? 2 : 1);
    for (const f of c.formats) {
      assert.match(f.file, /^[a-z-]+\.[a-f0-9]{10}\.(?:wav|m4a)$/);
      assert.equal(f.file.split('.')[1], f.sha256.slice(0, 10));
      const data = fs.readFileSync(path.join(folder, f.file));
      assert.equal(hash(data), f.sha256, 'Candidate SHA256 mismatch'); assert.equal(data.length, f.bytes);
      if (f.format === 'wav') {
        assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.toString('ascii', 8, 12), 'WAVE');
        assert.equal(data.readUInt16LE(20), 1); assert.equal(data.readUInt16LE(22), c.channels);
        assert.equal(data.readUInt32LE(24), c.sampleRate); assert.equal(data.length, 44 + c.frames * c.channels * 2);
        let peak = 0, boundary = 0;
        for (let i = 44; i < data.length; i += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(i)) / 32768);
        for (let channel = 0; channel < c.channels; channel++) boundary = Math.max(boundary,
          Math.abs(data.readInt16LE(44 + channel * 2) - data.readInt16LE(data.length - c.channels * 2 + channel * 2)) / 32768);
        assert.ok(peak > .1 && peak < .7, 'Silent or clipped candidate');
        if (c.loop) assert.ok(boundary / c.adjacentStepRms < 2, 'Loop boundary outlier');
      } else {
        assert.equal(f.format, 'aac'); assert.equal(data.toString('ascii', 4, 8), 'ftyp');
      }
    }
    decodedBytes += c.decodedBytes; wavBytes += c.formats[0].bytes; compactBytes += c.formats.at(-1).bytes;
  }
  assert.equal(decodedBytes, manifest.decodedBytes); assert.equal(wavBytes, manifest.wavBytes); assert.equal(compactBytes, manifest.compactBytes);
  assert.ok(decodedBytes + 574080 <= 8 * 1048576, 'Single-format candidates plus existing sounds exceed 8 MiB PCM');
  assert.ok(compactBytes <= 524288, 'Phase A compact candidate set exceeds 0.5 MiB');
  return { clips: manifest.clips.length, decodedBytes, wavBytes, compactBytes };
}
module.exports = { validateLabResources };
