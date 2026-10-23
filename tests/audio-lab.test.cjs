const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { validateLabResources } = require('../tools/audio-lab-resources.cjs');
const root = path.resolve(__dirname, '..');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-lab-resource-test-'));
  fs.cpSync(path.join(root, 'assets/audio-lab'), path.join(temp, 'assets/audio-lab'), { recursive: true });
  fs.cpSync(path.join(root, 'assets/audio-source'), path.join(temp, 'assets/audio-source'), { recursive: true });
  t.after(() => fs.rmSync(temp, { recursive: true, force: true })); return temp;
}
test('phase A samples have reviewed provenance, bounded PCM, compact delivery and continuous loop boundaries', () => {
  const result = validateLabResources(root); assert.equal(result.clips, 7); assert.ok(result.compactBytes < 400000);
});
test('same-length candidate corruption fails the content hash', t => {
  const temp = fixture(t), m = require(path.join(temp, 'assets/audio-lab/manifest.json'));
  const p = path.join(temp, 'assets/audio-lab', m.clips[0].formats[0].file), b = fs.readFileSync(p);
  b[100] ^= 1; fs.writeFileSync(p, b); assert.throws(() => validateLabResources(temp), /Candidate SHA256/);
});
test('unreviewed source license cannot enter an audition build', t => {
  const temp = fixture(t), p = path.join(temp, 'assets/audio-source/soundscape-lab/source.json');
  const m = JSON.parse(fs.readFileSync(p)); m.sources[0].license = 'unknown'; fs.writeFileSync(p, JSON.stringify(m));
  assert.throws(() => validateLabResources(temp), /CC0-1.0/);
});
test('unsafe candidate paths and mismatched derivative provenance are rejected', t => {
  const temp = fixture(t), p = path.join(temp, 'assets/audio-lab/manifest.json'), m = JSON.parse(fs.readFileSync(p));
  m.clips[0].sourceSha256 = '0'.repeat(64); fs.writeFileSync(p, JSON.stringify(m));
  assert.throws(() => validateLabResources(temp), /Derivative source/);
  m.clips[0].sourceSha256 = require(path.join(root, 'assets/audio-lab/manifest.json')).clips[0].sourceSha256;
  m.clips[0].formats[0].file = '../../escape.wav'; fs.writeFileSync(p, JSON.stringify(m));
  assert.throws(() => validateLabResources(temp));
});
