import { AUDIO_CLIPS } from '../../src/examples/RoomAudioCatalog';

const $ = id => document.getElementById(id);
const names = { 'drawer-slide': '抽屉滑动', 'drawer-stop': '抽屉到位', 'door-move': '门运动', 'door-latch': '门扣', switch: '开关', paper: '纸张' };
let engine, context, manifest, ready = false, preparing, generation = 0, disposed = false;
let wipeTimer, master = .35, motorEnabled = false, weatherEnabled = false, compareId;
const buffers = new Map(), sounds = new Map(), active = new Map(), ramps = new Map();
const report = { plays: [], events: [], errors: [], engineImports: 0, maxActive: 0 };
const status = text => { $('status').textContent = text; };
const keyFor = (id, format = 'wav') => id + ':' + format;
const gain = (sound, value) => {
  if (!sound) return;
  // V2 refuses overlapping ramps. Coalesce updates instead of touching private nodes.
  ramps.set(sound, Math.max(0, Math.min(1, value)));
};
const timer = setInterval(() => {
  if (!engine) return;
  for (const [sound, value] of ramps) {
    const current = sound.volume;
    sound.setVolume(current + (value - current) * .65, { duration: .025 });
    if (Math.abs(value - current) < .001) ramps.delete(sound);
  }
}, 50);

function stop(id) {
  const sound = active.get(id);
  if (!sound) return;
  ramps.delete(sound);
  sound.setVolume(0, { duration: 0 });
  sound.stop();
  active.delete(id);
  report.events.push({ kind: 'stop', id, at: context.currentTime });
}
function stopAll() {
  generation++;
  clearTimeout(wipeTimer);
  for (const id of [...active.keys()]) stop(id);
  motorEnabled = weatherEnabled = false;
}
function play(id, volume = .4, loop = false, format = 'wav') {
  if (!ready || disposed || document.hidden || context.state !== 'running') return false;
  if (loop && active.has(id)) return true;
  stop(id);
  const sound = sounds.get(keyFor(id, format));
  if (!sound) return false;
  sound.loop = loop;
  sound.setVolume(volume, { duration: 0 });
  sound.play(); active.set(id, sound);
  report.plays.push({ id, format, volume, loop, at: context.currentTime });
  report.maxActive = Math.max(report.maxActive, active.size);
  return true;
}
function wipe() {
  if (!ready) return;
  clearTimeout(wipeTimer); stop('cloth-wipe');
  const token = ++generation;
  if (!play('cloth-wipe', .6)) return;
  report.events.push({ kind: 'wipe-start', token, at: context.currentTime });
  wipeTimer = setTimeout(() => {
    if (token !== generation || !ready || disposed) return;
    stop('cloth-wipe');
    report.events.push({ kind: 'wipe-complete', token, at: context.currentTime });
  }, 1500);
}
function cancelWipe() {
  generation++; clearTimeout(wipeTimer); stop('cloth-wipe');
  report.events.push({ kind: 'wipe-cancel', at: context?.currentTime });
}
function updateMotor() {
  const speed = Number($('speed').value), normalized = speed / 40;
  $('speed-value').value = speed + ' km/h';
  if (!motorEnabled || !normalized) { stop('motor-drive'); return; }
  play('motor-drive', 0, true);
  const sound = active.get('motor-drive');
  if (sound) { sound.playbackRate = .85 + .5 * normalized; gain(sound, .15 + .27 * normalized); }
}
function updateWeather() {
  const rain = Number($('rain').value) / 100, inside = $('shelter').value === 'inside';
  $('rain-value').value = Math.round(rain * 100) + '%';
  if (!weatherEnabled) return;
  for (const id of ['wind-loop', 'rain-loop', 'sea-loop']) play(id, 0, true);
  gain(active.get('wind-loop'), inside ? .07 : .22);
  gain(active.get('rain-loop'), rain * (inside ? .10 : .30));
  gain(active.get('sea-loop'), inside ? .04 : .18);
}
async function prepare() {
  if (ready || disposed) return;
  if (preparing) return preparing;
  context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  const resumed = context.resume(); // Started in the actual click callback.
  $('prepare').disabled = true; status('正在准备声音…');
  preparing = (async () => {
    const { CreateAudioEngineAsync } = await import('@babylonjs/core/AudioV2/webAudio/webAudioEngine');
    report.engineImports++;
    engine = await CreateAudioEngineAsync({ audioContext: context, disableDefaultUI: true, resumeOnInteraction: false,
      resumeOnPause: false, disableIOSRingerSwitchWorkaround: true, listenerEnabled: false, volume: master });
    await resumed;
    manifest = await fetch('./candidates.json').then(r => r.json());
    const all = [...AUDIO_CLIPS.map(clip => ({ id: clip.id, format: 'wav', file: clip.file })),
      ...manifest.clips.flatMap(clip => clip.formats.map(f => ({ id: clip.id, format: f.format, file: 'candidates/' + f.file })))];
    for (const item of all) {
      const response = await fetch('./' + item.file);
      if (!response.ok) throw new Error('音频文件读取失败：' + item.id);
      const buffer = await engine.createSoundBufferAsync(await response.arrayBuffer());
      const sound = await engine.createSoundAsync(item.id + '-' + item.format, buffer,
        { autoplay: false, loop: false, maxInstances: 1 });
      const key = keyFor(item.id, item.format);
      buffers.set(key, buffer); sounds.set(key, sound);
      sound.onEndedObservable.add(() => { if (active.get(item.id) === sound) active.delete(item.id); });
    }
    sounds.set(keyFor('motor-drive'), await engine.createSoundAsync('motor-drive', buffers.get(keyFor('motor-loop')),
      { autoplay: false, loop: true, maxInstances: 1, playbackRate: .85 }));
    if (disposed) { engine.dispose(); return; }
    ready = true;
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
    $('prepare').disabled = true; status('已准备。选择一组声音开始试听。');
    $('metrics').textContent = '同时缓存 WAV 与 AAC 用于比较：' + (stats().decodedBytes / 1048576).toFixed(2) + ' MiB PCM\n正式加载时只选一种格式，且按区域准备。';
  })().catch(error => {
    report.errors.push(String(error)); status('声音准备失败。刷新后重试。');
    engine?.dispose(); if (context.state !== 'closed') void context.close();
    throw error;
  });
  return preparing;
}
function stats() {
  return { ready, contextState: context?.state, sampleRate: context?.sampleRate, buffers: buffers.size,
    decodedBytes: [...buffers.values()].reduce((n, b) => n + b.length * b.channelCount * 4, 0),
    sounds: sounds.size, active: [...active.keys()], maxActive: report.maxActive, report };
}
for (const clip of AUDIO_CLIPS) {
  const button = document.createElement('button'); button.disabled = true; button.dataset.baseline = clip.id;
  button.textContent = names[clip.cue] + ' ' + (clip.id.endsWith('-1') ? '1' : '2');
  button.onclick = () => play(clip.id, clip.gain); $('baseline').append(button);
}
document.querySelectorAll('[data-clip]').forEach(button => { button.onclick = () => play(button.dataset.clip); });
$('prepare').onclick = () => { void prepare().catch(() => {}); };
$('stop').onclick = () => { stopAll(); status('已停止。'); };
$('wipe').onclick = wipe; $('cancel-wipe').onclick = cancelWipe;
$('motor').onclick = () => { motorEnabled = true; updateMotor(); };
$('motor-stop').onclick = () => { motorEnabled = false; updateMotor(); };
$('speed').oninput = updateMotor;
$('weather').onclick = () => { weatherEnabled = true; updateWeather(); };
$('rain').oninput = updateWeather; $('shelter').onchange = updateWeather;
$('volume').oninput = () => { master = Number($('volume').value) / 100; $('volume-value').value = Math.round(master * 100) + '%'; if (engine) engine.volume = master; };
for (const format of ['wav', 'aac']) $('compare-' + format).onclick = () => {
  if (compareId) stop(compareId);
  compareId = $('compare-clip').value;
  stop(compareId);
  play(compareId, .35, true, format);
};
window.addEventListener('blur', () => { stopAll(); if (context?.state === 'running') void context.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAll(); if (context?.state === 'running') void context.suspend(); } });
document.addEventListener('pointerdown', () => { if (ready && context.state === 'suspended' && !document.hidden) void context.resume(); });
window.addEventListener('pagehide', () => { disposed = true; stopAll(); clearInterval(timer); engine?.dispose(); });
// Test/authoring boundary only; this module is never imported by the game.
window.audioLab = { prepare, play, stop, stopAll, wipe, cancelWipe, updateMotor, updateWeather, stats,
  get engine() { return engine; }, get context() { return context; }, sounds, buffers };
