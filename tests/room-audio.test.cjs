const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const ts = require('typescript');
const { validateAudioResources } = require('../tools/study-audio-resources.cjs');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/examples', name + '.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', compiled)(id => id.startsWith('./') ? load(id.slice(2)) : require(id), module, module.exports);
  cache.set(name, module.exports); return module.exports;
}
const { RoomAudio } = load('RoomAudio');
const { AUDIO_CLIPS, audioPreferences, AUDIO_DEFAULTS, AUDIO_LIMITS } = load('RoomAudioCatalog');
const BASE_CLIPS = AUDIO_CLIPS.filter(c => c.preload !== 'world');
const WORLD_CLIPS = AUDIO_CLIPS.filter(c => c.preload === 'world');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) { for (let i=0;i<100;i++) { if(predicate())return; await delay(2); } assert.fail('audio preparation did not reach expected state'); }
function fixture(t, overrides = {}) {
  const log = { fetches: [], decoded: 0, voices: [], played: [], disposed: false, backendCalls: 0 };
  const context = { state: 'suspended', currentTime: 0,
    resume: async () => { context.state = 'running'; }, suspend: async () => { context.state = 'suspended'; },
    close: async () => { context.state = 'closed'; } };
  let now = 1000;
  const backend = { decode: async () => { log.decoded++; return { length: 2048, channelCount: 1 }; },
    voice: async (_buffer, name, ui, loop, group) => {
      const voice = { name, ui, loop, group, played: false, disposed: false, callback: () => {},
        play(gain, rate, position) { assert.equal(context.state, 'running', 'never queue in Audio V2 while locked');
          this.played = true; log.played.push({ name, gain, rate, position }); },
        update(gain, rate, pan) { this.parameters = {gain,rate,pan}; },
        position(point) { this.point = point; }, stop() { this.played = false; },
        ended(callback) { this.callback = callback; }, dispose() { this.disposed = true; },
        finish() { this.played = false; this.callback(); } };
      log.voices.push(voice); return voice;
    }, mix(value) { log.mix = value; }, volume(value) { log.volume = value; }, listener(camera) { log.listener = camera; },
    dispose() { log.disposed = true; context.state = 'closed'; } };
  const audio = new RoomAudio({ context: () => context, backend: async () => { log.backendCalls++; return backend; },
    fetch: async url => { log.fetches.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; },
    now: () => now, ...overrides });
  t.after(() => audio.dispose());
  return { audio, log, backend, context, advance: ms => { now += ms; } };
}
async function prepared(t, overrides) { const f = fixture(t, overrides); f.audio.sceneReady(); await f.audio.preload(); return f; }

test('audio preferences tolerate null, malformed values and clamp valid levels', () => {
  for (const value of [null, [], 'bad', 3, { enabled: 'yes', volume: Infinity }]) assert.deepEqual(audioPreferences(value), AUDIO_DEFAULTS);
  assert.deepEqual(audioPreferences({ enabled: false, volume: -1 }), { enabled: false, volume: 0 });
  assert.equal(audioPreferences({ volume: 2 }).volume, 1);
});
test('saved mute does not initialize or request assets; preload shares fetch/decode and prepared objects', async t => {
  const { audio, log } = fixture(t);
  audio.setPreferences(false, .5); audio.sceneReady(); await audio.preload();
  assert.equal(log.backendCalls, 0); assert.equal(log.fetches.length, 0);
  audio.setPreferences(true, .5);
  await Promise.all([audio.preload(), audio.preload(), audio.preload()]);
  assert.equal(log.backendCalls, 1); assert.equal(new Set(log.fetches).size, BASE_CLIPS.length);
  assert.equal(log.fetches.length, BASE_CLIPS.length); assert.equal(log.decoded, BASE_CLIPS.length); assert.equal(log.voices.length, BASE_CLIPS.length * 2);
  assert.equal(audio.diagnostics.decodedBytes, BASE_CLIPS.length * 2048 * 4);
  const coreOrder = log.fetches.slice(0, AUDIO_CLIPS.filter(clip => clip.preload === 'core').length).map(url => AUDIO_CLIPS.find(clip => './' + clip.file === url).preload);
  assert.ok(coreOrder.every(group => group === 'core'));
});
test('locked, muted and background actions never reach the backend or replay after recovery', async t => {
  const { audio, log, context } = await prepared(t);
  audio.play('switch'); await delay(35); assert.equal(log.played.length, 0);
  audio.unlockFromGesture(); await delay(0); audio.play('switch'); assert.equal(log.played.length, 1);
  audio.setPreferences(false, .5); audio.play('switch');
  audio.setPreferences(true, .5); await delay(30); assert.equal(log.played.length, 1);
  audio.pause(); audio.play('paper'); audio.foreground(); await delay(35);
  assert.equal(context.state, 'suspended'); assert.equal(log.played.length, 1);
});
test('gesture candidate is short-lived and reversal invalidates it before unlock resolves', async t => {
  const { audio, log, context } = await prepared(t);
  let unlock; context.resume = () => new Promise(resolve => { unlock = () => { context.state = 'running'; resolve(); }; });
  audio.unlockFromGesture(); audio.play('drawer-slide', 'drawer'); audio.stopEntity('drawer'); unlock();
  await delay(40); assert.equal(log.played.length, 0);
});
test('blur during a pending unlock remains suspended after the resume Promise resolves', async t => {
  const { audio, context } = await prepared(t);
  let resolve; context.resume = () => new Promise(done => resolve = () => { context.state = 'running'; done(); });
  audio.unlockFromGesture(); audio.pause(); resolve(); await delay(0);
  assert.equal(context.state, 'suspended');
});
test('per-item HTTP/decode failure degrades independently, retries at most once and never backfills events', async t => {
  let failedFetches = 0, offline = true;
  const f = await prepared(t, { fetch: async url => {
    if (url.includes('switch-1')) { failedFetches++; if (offline) return { ok: false, status: 404 }; }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  } });
  assert.equal(f.audio.diagnostics.readyFiles, BASE_CLIPS.length - 1); assert.equal(f.audio.diagnostics.failedFiles.length, 1);
  f.audio.unlockFromGesture(); await delay(0); f.audio.play('switch'); assert.equal(f.log.played.length, 1);
  await f.audio.preload(true); await f.audio.preload(true); assert.equal(failedFetches, 2);
  assert.equal(f.audio.diagnostics.readyFiles, BASE_CLIPS.length - 1);
  offline = false; await f.audio.retryFailed();
  assert.equal(failedFetches, 3); assert.equal(f.audio.diagnostics.readyFiles, BASE_CLIPS.length);
  assert.equal(f.log.played.length, 1, 'manual recovery never replays earlier actions');
});
test('bad decode and excessive decoded PCM do not allocate playable objects', async t => {
  const f = fixture(t); f.backend.decode = async () => ({ length: AUDIO_LIMITS.decodedBytes / 4 + 1, channelCount: 1 });
  f.audio.sceneReady(); await f.audio.preload(); assert.equal(f.log.voices.length, 0);
  assert.equal(f.audio.diagnostics.failedFiles.length, BASE_CLIPS.length); assert.equal(f.audio.diagnostics.decodedBytes, 0);
});
test('bounded polyphony, high-priority replacement and ended cleanup respect the six-voice cap', async t => {
  const f = await prepared(t); f.audio.unlockFromGesture(); await delay(0);
  for (const [i, cue] of ['drawer-slide', 'drawer-slide', 'door-move', 'door-move', 'paper', 'switch'].entries()) {
    f.audio.play(cue, 'entity-' + i); f.advance(100);
  }
  assert.equal(f.audio.diagnostics.active, 6);
  f.audio.play('door-latch', 'door'); assert.equal(f.audio.diagnostics.active, 6);
  await delay(35); assert.equal(f.audio.diagnostics.active, 6); assert.equal(f.log.played.length, 7);
  f.log.voices.forEach(voice => voice.finish()); assert.equal(f.audio.diagnostics.active, 0);
});
test('moving entities update only in first-person; paper stays 2D; view change stops old voices', async t => {
  const f = await prepared(t); f.audio.unlockFromGesture(); await delay(0);
  let point = { x: 1, y: 2, z: 3 }; const camera = {};
  f.audio.setSpatialCamera(camera); f.audio.play('switch', 'lamp', () => point);
  assert.deepEqual(f.log.played[0].position, point);
  point = { x: 4, y: 5, z: 6 }; f.audio.update();
  assert.deepEqual(f.log.voices.find(voice => voice.played).point, point);
  f.audio.play('paper', 'inspection', () => point); assert.equal(f.log.played[1].position, undefined);
  f.audio.setSpatialCamera(); await delay(30); assert.equal(f.audio.diagnostics.active, 0);
  f.audio.play('switch', 'lamp', () => point); assert.equal(f.log.played.at(-1).position, undefined);
});
test('disposing in-flight download cancels it and ignores late results', async t => {
  let release; const f = fixture(t, { fetch: async (_url, options) => {
    await new Promise(resolve => release = resolve);
    assert.equal(options.signal.aborted, true);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  } });
  // Use one blocked task and one immediate failure so no dangling second download remains.
  let calls = 0; f.audio.dependencies.fetch = async (_url, options) => {
    if (++calls > 1) throw new Error('offline');
    await new Promise(resolve => release = resolve); assert.equal(options.signal.aborted, true);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  f.audio.sceneReady(); await delay(0); f.audio.dispose(); release(); await f.audio.preload(); await delay(5);
  assert.equal(f.log.decoded, 0); assert.equal(f.log.voices.length, 0); assert.equal(f.log.disposed, true);
  assert.equal(f.audio.diagnostics.state, 'closed');
});
test('reviewed audio is reproducible, catalog matches whitelist and corrupt/long/unlicensed files fail validation', t => {
  const root = path.resolve(__dirname, '../public'), source = require('../public/audio/study/source.json');
  const summary = validateAudioResources(root);
  assert.equal(summary.encodedBytes, source.totalBytes + require('../public/audio/actions/source.json').totalBytes + require('../public/audio/soundscape/source.json').totalBytes + require('../public/audio/daily/source.json').totalBytes); assert.ok(summary.coreBytes <= AUDIO_LIMITS.coreBytes);
  assert.deepEqual([...AUDIO_CLIPS.map(row => row.file)].sort(), [...summary.files].sort());
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-audio-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  for (const dir of ['actions','soundscape','daily']) fs.cpSync(path.join(root, 'audio',dir), path.join(temporary, 'audio',dir), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'audio/study'), { recursive: true });
  fs.copyFileSync(path.join(root, 'audio/study/source.json'), path.join(temporary, 'audio/study/source.json'));
  source.files.forEach(row => fs.copyFileSync(path.join(root, row.file), path.join(temporary, row.file)));
  const row = source.files[0], file = path.join(temporary, row.file), original = fs.readFileSync(file);
  const changed = Buffer.from(original); changed[60] ^= 1; fs.writeFileSync(file, changed);
  assert.throws(() => validateAudioResources(temporary), /SHA256/); fs.writeFileSync(file, original);
  const manifestFile = path.join(temporary, 'audio/study/source.json');
  const unlicensed = structuredClone(source); unlicensed.files[0].license = 'unverified';
  fs.writeFileSync(manifestFile, JSON.stringify(unlicensed)); assert.throws(() => validateAudioResources(temporary), /license/);
  fs.writeFileSync(manifestFile, JSON.stringify(source)); fs.unlinkSync(file);
  assert.throws(() => validateAudioResources(temporary), /ENOENT/);
});

test('continuous motions prepare loops, remain idempotent and cancel delayed replacement attempts', async t => {
  const f = await prepared(t); f.audio.unlockFromGesture(); await delay(0);
  const loop = f.log.voices.find(v => v.name.startsWith('cloth-wipe-1'));
  assert.equal(loop.loop, true);
  f.audio.play('cloth-wipe', 'cover'); f.audio.play('cloth-wipe', 'cover');
  assert.equal(f.log.played.length, 1); assert.equal(f.audio.diagnostics.active, 1);
  f.audio.stopEntity('cover'); await delay(30); assert.equal(f.audio.diagnostics.active, 0);
  for (const [i, cue] of ['drawer-slide', 'drawer-slide', 'door-move', 'door-move', 'paper', 'switch'].entries()) {
    f.audio.play(cue, 'occupied-' + i); f.advance(100);
  }
  const before = f.log.played.length;
  for (let i = 0; i < 5; i++) f.audio.play('cloth-wipe', 'new-cover');
  assert.equal([...f.audio.active].filter(entry => entry.stopping).length, 1, 'one pending loop only displaces one voice');
  await delay(35); assert.equal(f.log.played.length, before + 1, 'pending attempts also deduplicate');
  f.audio.stopAll(); await delay(30);
  for (const [i, cue] of ['drawer-slide', 'drawer-slide', 'door-move', 'door-move', 'paper', 'switch'].entries()) {
    f.audio.play(cue, 'occupied-again-' + i); f.advance(100);
  }
  const cancelled = f.log.played.length;
  f.audio.play('cloth-wipe', 'new-cover'); f.audio.stopEntity('new-cover');
  await delay(35); assert.equal(f.log.played.length, cancelled, 'cancelled pending loop never starts');
});
test('action provenance, loop metadata and the phase B allowance are enforced', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-action-audio-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const dir of ['study', 'actions', 'soundscape', 'daily']) fs.cpSync(path.resolve(__dirname, '../public/audio', dir), path.join(temp, 'audio', dir), { recursive: true });
  const file = path.join(temp, 'audio/actions/source.json'), original = fs.readFileSync(file), m = JSON.parse(original);
  m.sources[0].license = 'unknown'; fs.writeFileSync(file, JSON.stringify(m));
  assert.throws(() => validateAudioResources(temp), /source license/);
  fs.writeFileSync(file, original); m.sources[0].license = 'CC0-1.0'; m.files[0].sourceSha256 = '0'.repeat(64);
  fs.writeFileSync(file, JSON.stringify(m)); assert.throws(() => validateAudioResources(temp), /Unreviewed audio source/);
  fs.writeFileSync(file, original);
  const limits = require('../tools/study-audio-resources.cjs').audioBudgets, previous = limits.actionBytes;
  limits.actionBytes = JSON.parse(original).totalBytes - 1;
  try { assert.throws(() => validateAudioResources(temp), /Phase B audio allowance/); }
  finally { limits.actionBytes = previous; }
});

test('world buffers wait for a gesture, load only requested clips and update one persistent voice', async t => {
  const f = await prepared(t); f.context.state = 'running';
  f.audio.world([{id:'motor-loop',gain:.1}]); await delay(0);
  assert.equal(f.log.fetches.length,BASE_CLIPS.length); assert.equal(f.audio.diagnostics.worldActive,0);
  f.audio.unlockFromGesture(); f.audio.world([{id:'motor-loop',gain:.1}]); await f.audio.preload();
  assert.equal(f.log.fetches.length,BASE_CLIPS.length+1); assert.equal(f.audio.diagnostics.worldActive,0,'load never starts playback itself');
  for (let n=0;n<20;n++) f.audio.world([{id:'motor-loop',gain:.13,rate:9,pan:1}]);
  assert.equal(f.log.played.length,1); assert.equal(f.audio.diagnostics.worldActive,1);
  const voice=f.log.voices.find(v=>v.name==='motor-loop-0'); assert.deepEqual(voice.parameters,{gain:.13,rate:2,pan:.18});
  f.audio.world([]); await delay(30); assert.equal(f.audio.diagnostics.worldActive,0);
});
test('cancelled current state cannot start a late world buffer, and world pause never queues an old sound', async t => {
  let release; const f=await prepared(t,{fetch:async url=>{
    if(url.includes('motor-loop')) await new Promise(r=>release=r);
    return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
  }});
  f.audio.unlockFromGesture(); await delay(0); f.audio.world([{id:'motor-loop',gain:.1}]); await until(()=>release);
  f.audio.resetWorld(); release(); await f.audio.preload();
  assert.equal(f.log.played.length,0); f.audio.world([]); assert.equal(f.audio.diagnostics.worldActive,0);
  f.audio.world([{id:'motor-loop',gain:.1}]); assert.equal(f.audio.diagnostics.worldActive,1);
  f.audio.pause(); f.audio.world([{id:'motor-loop',gain:.2}]); f.audio.foreground(); await delay(30);
  assert.equal(f.audio.diagnostics.worldActive,0); assert.equal(f.log.played.length,1);
});
test('eight continuous layers and six short voices have separate reservations and one total cap', async t => {
  const f=await prepared(t); f.audio.unlockFromGesture(); await delay(0);
  const targets=WORLD_CLIPS.map(c=>({id:c.id,gain:.1})); f.audio.world(targets); await f.audio.preload(); f.audio.world(targets);
  assert.equal(f.audio.diagnostics.worldActive,8);
  for (const [i,cue] of ['drawer-slide','drawer-slide','door-move','door-move','paper','switch'].entries()) { f.audio.play(cue,'poly-'+i); f.advance(100); }
  assert.equal(f.audio.diagnostics.active,14); f.audio.play('cloth-lift','cover:lift'); await delay(35);
  assert.equal(f.audio.diagnostics.active,14); assert.equal(f.audio.diagnostics.worldActive,8);
  f.audio.stopActions(); await delay(30); assert.equal(f.audio.diagnostics.active,8);
  f.audio.setMix({actions:0,ambience:.7,ui:1}); f.audio.world(targets); await delay(30);
  assert.equal(f.audio.diagnostics.worldActive,6); const count=f.log.played.length;
  f.audio.play('switch','lamp'); assert.equal(f.log.played.length,count); f.audio.play('paper'); assert.equal(f.log.played.length,count+1);
  f.audio.setPreferences(false,.5); assert.equal(f.audio.diagnostics.active,7); await delay(30); assert.equal(f.audio.diagnostics.active,0);
});
test('concurrent decode preparation reserves the PCM limit before awaiting voice creation', async t => {
  const f=await prepared(t); f.audio.unlockFromGesture(); await delay(0);
  f.backend.decode=async()=>({length:3*1048576,channelCount:1});
  const original=f.backend.voice; let release;
  f.backend.voice=async(...args)=>{ if(args[1]==='motor-loop-0') await new Promise(r=>release=r); return original(...args); };
  f.audio.world([{id:'motor-loop',gain:.1},{id:'roll-loop',gain:.1}]); await until(()=>release && f.audio.diagnostics.failedFiles.includes('roll-loop'));
  assert.ok(f.audio.diagnostics.failedFiles.includes('roll-loop')); release(); await f.audio.preload();
  assert.ok(f.audio.diagnostics.decodedBytes<=AUDIO_LIMITS.decodedBytes);
});

test('four step variants are all selectable without adjacent repetition; spatial device loops update in place',async t=>{
  const f=await prepared(t);f.audio.unlockFromGesture();await delay(0);
  const saved=Math.random,choices=[0,.99,.5,.99,0,.5];let calls=0;t.after(()=>Math.random=saved);Math.random=()=>calls++%2?.5:choices.shift()??0;
  for(let i=0;i<6;i++){f.audio.play('footstep-wood','feet');f.log.voices.forEach(v=>{if(v.played)v.finish();});f.advance(150);}
  const names=f.log.played.map(v=>v.name.replace(/-[01]$/,''));assert.equal(new Set(names).size,4);
  for(let i=1;i<names.length;i++)assert.notEqual(names[i],names[i-1]);
  const position={x:1,y:8,z:2};f.audio.world([{id:'beacon-drive',gain:.1,position}]);await f.audio.preload();f.audio.world([{id:'beacon-drive',gain:.1,position}]);
  const voice=f.log.voices.find(v=>v.name==='beacon-drive-0');assert.equal(f.log.played.at(-1).position,position);
  f.audio.world([{id:'beacon-drive',gain:.12,position:{x:2,y:9,z:3}}]);assert.deepEqual(voice.point,{x:2,y:9,z:3});
  f.audio.setMix({actions:0,ambience:.7,ui:1});await delay(30);assert.equal(f.audio.diagnostics.worldActive,0);
  f.audio.play('ui-contact','local-read');assert.equal(f.log.played.at(-1).name.startsWith('ui-contact-'),true);
});
test('group preferences accept the old setting, clamp each field and do not mutate defaults', () => {
  const {audioMixPreferences,AUDIO_MIX_DEFAULTS}=load('RoomAudioCatalog');
  for (const v of [null,[],false,'bad',{}]) assert.deepEqual(audioMixPreferences(v),AUDIO_MIX_DEFAULTS);
  assert.deepEqual(audioMixPreferences({actions:2,ambience:-1,ui:NaN}),{actions:1,ambience:0,ui:1});
  const value=audioMixPreferences(null); value.ambience=0; assert.equal(AUDIO_MIX_DEFAULTS.ambience,.7);
});
