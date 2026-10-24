const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require.resolve('../src/examples/RoomCleaningAudio.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} }; new Function('module', 'exports', code)(loaded, loaded.exports);
const { RoomCleaningAudio } = loaded.exports;
function fixture() {
  const log = [], audio = new RoomCleaningAudio({ play: (...args) => log.push(['play', ...args]), stopEntity: id => log.push(['stop', id]) });
  const state = (entity, active, revision, clean = false) => ({ entity, active, revision, clean, position: () => ({ x: 1, y: 2, z: 3 }) });
  return { audio, log, state, cues: () => log.filter(row => row[0] === 'play').map(row => row[1]) };
}
test('cloth contact starts once; a completed accepted revision emits lift once and leaves recheck to gameplay', () => {
  const { audio, log, state, cues } = fixture();
  audio.sync([state('cover', false, 0)]); assert.deepEqual(log, []);
  audio.sync([state('cover', true, 0)]); audio.sync([state('cover', true, 0)]);
  assert.equal(cues().filter(cue => cue === 'cloth-touch').length, 1);
  audio.sync([state('cover', false, 1, true)]); audio.sync([state('cover', false, 1, true)]);
  assert.equal(cues().filter(cue => cue === 'cloth-lift').length, 1);
  assert.ok(log.some(row => row[0] === 'stop' && row[1] === 'cover'));
});
test('cancel, weather revision changes and reset/read-state do not masquerade as completion', () => {
  for (const end of [{ revision: 0, clean: false }, { revision: 1, clean: false }, { revision: 2, clean: true }]) {
    const { audio, state, cues } = fixture(); audio.sync([state('cover', true, 0)]);
    audio.sync([state('cover', false, end.revision, end.clean)]);
    assert.ok(!cues().includes('cloth-lift'));
  }
  const { audio, state, cues, log } = fixture(); audio.sync([state('cover', true, 0)]);
  audio.reset(); audio.sync([state('cover', false, 1, true)]); assert.ok(!cues().includes('cloth-lift'));
  audio.sync([state('cover', true, 1)]); audio.sync([state('cover', false, 2, true)]);
  log.length = 0; audio.reset(); assert.ok(log.some(row => row[1] === 'cover:lift'), 'reset also cancels an end tail');
});
test('cover and solar have independent revisions and positions; an inactive task never starts', () => {
  const { audio, state, log } = fixture();
  audio.sync([state('cover', true, 7), state('solar', false, 2)]);
  audio.sync([state('cover', false, 7), state('solar', true, 2)]);
  audio.sync([state('cover', false, 7), state('solar', false, 3, true)]);
  assert.deepEqual(log.filter(row => row[1] === 'cloth-lift').map(row => row[2]), ['solar:lift']);
  assert.deepEqual(log.find(row => row[1] === 'cloth-wipe')[3](), { x: 1, y: 2, z: 3 });
});
