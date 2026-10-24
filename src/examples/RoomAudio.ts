import type { Camera } from "@babylonjs/core/pure";
import type { AudioBackend, AudioVoice } from "./RoomAudioBackend";
import { AUDIO_CLIPS, AUDIO_DEFAULTS, AUDIO_LIMITS, AUDIO_MIX_DEFAULTS, audioMixPreferences } from "./RoomAudioCatalog";
import type { AudioClip, AudioCue, AudioPoint, AudioMix, WorldAudioTarget, RoomAudioEvent } from "./RoomAudioCatalog";

type ActiveVoice = { voice: AudioVoice; clip: AudioClip; entity: string; position?: () => AudioPoint;
  started: number; stopping: boolean; world?: boolean; ui?: boolean; timer?: ReturnType<typeof setTimeout> };
type Dependencies = {
  context: () => AudioContext;
  backend: (context: AudioContext) => Promise<AudioBackend>;
  fetch: typeof fetch;
  now: () => number;
};

/** Optional audio never gates scene actions; loading, browser permission and preference are independent. */
export class RoomAudio {
  enabled = AUDIO_DEFAULTS.enabled;
  volume = AUDIO_DEFAULTS.volume;
  private mixValues = {...AUDIO_MIX_DEFAULTS};
  onChange = () => {};
  private context?: AudioContext;
  private backend?: AudioBackend;
  private preparation?: Promise<void>;
  private readonly voices = new Map<string, AudioVoice[]>();
  private readonly active = new Set<ActiveVoice>();
  private readonly worldActive = new Map<string, ActiveVoice>();
  private readonly requestedWorld = new Set<string>();
  private readonly loads = new Map<string, Promise<void>>();
  private readonly failures = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private readonly previous = new Map<AudioCue, string>();
  private readonly cooldown = new Map<string, number>();
  private readonly generations = new Map<string, number>();
  private readonly pendingLoops = new Map<string, { cue: AudioCue }>();
  private readonly controllers = new Set<AbortController>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private camera?: Camera;
  private ready = false;
  private paused = false;
  private disposed = false;
  private unsupported = false;
  private decodedBytes = 0;
  private reservedBytes = 0;
  private played = 0;
  private dropped = 0;
  private unlocking = false;
  private gestured = false;
  private actionGeneration = 0;
  private readonly dependencies: Dependencies;

  constructor(dependencies: Partial<Dependencies> = {}) {
    this.dependencies = {
      context: () => new AudioContext({ latencyHint: "interactive" }),
      backend: async context => (await import("./RoomAudioBackend")).createAudioBackend(context),
      fetch: (...args) => fetch(...args), now: () => performance.now(), ...dependencies,
    };
  }

  get diagnostics() {
    return { state: this.disposed ? "closed" : !this.enabled ? "muted" : this.unsupported ? "unavailable"
      : this.failures.size ? "partial" : AUDIO_CLIPS.filter(c => c.preload !== "world" || this.requestedWorld.has(c.id)).every(c => this.voices.has(c.id)) ? "ready"
      : this.preparation ? "loading" : "idle", context: this.context?.state || "uninitialized",
      preparing: !!this.preparation,
      readyFiles: this.voices.size, failedFiles: [...this.failures], active: this.active.size, worldActive: this.worldActive.size,
      decodedBytes: this.decodedBytes, played: this.played, dropped: this.dropped };
  }

  sceneReady() { this.ready = true; void this.preload(); }
  get mix() { return {...this.mixValues}; }
  private groupLevel(clip: AudioClip, ui = false) { return this.mixValues[ui || clip.cue === "paper" ? "ui" : clip.group === "vehicle" ? "actions" : clip.group || "actions"]; }
  setMix(value: AudioMix) {
    this.actionGeneration++; this.pendingLoops.clear();
    this.mixValues = audioMixPreferences(value); this.backend?.mix(this.mixValues);
    for (const entry of this.active) if (!this.groupLevel(entry.clip,entry.ui)) this.stop(entry);
    this.onChange();
  }

  setPreferences(enabled: boolean, volume: number) {
    if (this.disposed) return;
    this.enabled = !!enabled;
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : AUDIO_DEFAULTS.volume;
    if (!this.enabled || !this.volume) this.stopAll();
    this.applyVolume();
    if (this.enabled && this.ready) void this.preload();
    this.onChange();
  }

  /** Call synchronously inside a real gesture, before any await or Pointer Lock request. */
  unlockFromGesture() {
    if (this.disposed || this.paused || !this.enabled || !this.volume) return;
    try {
      this.gestured = true;
      const context = this.getContext();
      if (context.state !== "running" && context.state !== "closed") {
        this.unlocking = true;
        void context.resume().catch(() => {}).then(() => {
          this.unlocking = false;
          if (!this.disposed && this.paused && context.state !== "closed") void context.suspend().catch(() => {});
          if (!this.disposed) this.onChange();
        });
      }
      if (this.ready) void this.preload();
    } catch { this.unsupported = true; this.onChange(); }
  }

  private getContext() {
    if (!this.context) this.context = this.dependencies.context();
    return this.context;
  }

  preload(retry = false): Promise<void> {
    if (retry && !this.disposed && this.context?.state !== "closed") this.unsupported = false;
    if (this.disposed || this.paused || !this.ready || !this.enabled || this.unsupported) return Promise.resolve();
    if (this.preparation) return this.preparation;
    if (this.backend && !AUDIO_CLIPS.some(clip => (clip.preload !== "world" || this.requestedWorld.has(clip.id)) && !this.voices.has(clip.id)
      && (!this.failures.has(clip.id) || retry) && (this.attempts.get(clip.id) || 0) < 2)) return Promise.resolve();
    this.preparation = this.prepare(retry).catch(() => {
      if (!this.disposed) this.unsupported = true;
    }).then(() => {
      this.preparation = undefined;
      if (!this.disposed) {
        this.onChange();
        if (!this.paused && this.enabled && [...this.failures].some(id => this.attempts.get(id) < 2)) {
          this.later(() => { void this.preload(true); }, 1500);
        }
      }
    });
    this.onChange();
    return this.preparation;
  }

  /** An explicit user retry starts a new bounded attempt, preserving every already-ready buffer. */
  retryFailed(): Promise<void> {
    if (this.preparation) return this.preparation;
    this.failures.forEach(id => this.attempts.delete(id));
    return this.preload(true);
  }

  private async prepare(retry: boolean) {
    if (!this.backend) {
      const backend = await this.dependencies.backend(this.getContext());
      if (this.disposed) { backend.dispose(); return; }
      this.backend = backend;
      this.backend.mix(this.mixValues);
      this.applyVolume();
    }
    for (const group of ["core", "variation", "world"]) {
      const queue = AUDIO_CLIPS.filter(clip => clip.preload === group && (group !== "world" || this.requestedWorld.has(clip.id)) && !this.voices.has(clip.id)
        && (!this.failures.has(clip.id) || retry));
      const worker = async () => {
        while (queue.length && !this.disposed && !this.paused && this.enabled) {
          const clip = queue.shift()!;
          if (clip.preload !== "world" || this.requestedWorld.has(clip.id)) await this.load(clip);
        }
      };
      await Promise.all([worker(), worker()]);
      if (this.disposed || this.paused || !this.enabled) break;
      if (group === "core") await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    this.onChange();
  }

  private load(clip: AudioClip): Promise<void> {
    if (this.loads.has(clip.id)) return this.loads.get(clip.id)!;
    if ((this.attempts.get(clip.id) || 0) >= 2) return Promise.resolve();
    this.attempts.set(clip.id, (this.attempts.get(clip.id) || 0) + 1);
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 8000);
    const job = (async () => {
      const response = await this.dependencies.fetch("./" + clip.file, { signal: controller.signal });
      if (!response.ok) throw new Error("Audio HTTP " + response.status);
      const data = await response.arrayBuffer();
      if (this.disposed) return;
      const buffer = await this.backend!.decode(data);
      if (this.disposed) return;
      const bytes = buffer.length * buffer.channelCount * 4;
      if (!Number.isFinite(bytes) || bytes <= 0 || this.decodedBytes + this.reservedBytes + bytes > AUDIO_LIMITS.decodedBytes) throw new Error("Audio PCM budget exceeded");
      this.reservedBytes += bytes;
      const prepared: AudioVoice[] = [];
      try {
        for (let i = 0; i < (clip.preload === "world" ? 1 : AUDIO_LIMITS.voicesPerClip); i++) {
          const voice = await this.backend!.voice(buffer, clip.id + "-" + i, clip.cue === "paper" || clip.group === "ui", !!clip.loop, clip.group);
          if (this.disposed) { voice.dispose(); prepared.forEach(value => value.dispose()); return; }
          prepared.push(voice);
          voice.ended(() => {
            const entry = [...this.active].find(active => active.voice === voice);
            if (entry) this.release(entry);
          });
        }
        this.voices.set(clip.id, prepared);
        this.decodedBytes += bytes;
        this.failures.delete(clip.id);
      } catch (error) { prepared.forEach(voice => voice.dispose()); throw error; }
      finally { this.reservedBytes -= bytes; }
    })().catch(() => { if (!this.disposed) this.failures.add(clip.id); }).then(() => {
      clearTimeout(timer); this.controllers.delete(controller); this.onChange();
    });
    this.loads.set(clip.id, job);
    return job.then(() => { this.loads.delete(clip.id); });
  }

  event(event: RoomAudioEvent) {
    if (event.cue === "stop") this.stopEntity(event.entity);
    else this.play(event.cue, event.entity, event.position);
  }

  play(cue: AudioCue, entity = "preview", position?: () => AudioPoint) {
    if (this.pendingLoops.get(entity)?.cue === cue) return;
    if ([...this.active].some(entry => !entry.stopping && entry.entity === entity && entry.clip.cue === cue && entry.clip.loop)) return;
    if (!this.canPlay()) { this.dropped++; return; }
    const candidates = AUDIO_CLIPS.filter(clip => clip.preload !== "world" && clip.cue === cue && this.voices.has(clip.id));
    if (!candidates.length) { this.dropped++; return; }
    const variations = candidates.filter(value => value.id !== this.previous.get(cue));
    const clip = variations.length ? variations[Math.floor(Math.random()*variations.length)] : candidates[0];
    // Autonomous ambience must never exploit a browser that happens to allow a running context.
    if (clip.group === "ambience" && !this.gestured) { this.dropped++; return; }
    const isUI = clip.group === "ui" || cue === "paper" || entity === "preview" || entity === "lighthouse-control-panel";
    if (!this.groupLevel(clip,isUI)) return;
    const now = this.dependencies.now();
    if (clip.priority === 1 && now - (this.cooldown.get(entity) ?? -Infinity) < 80) return;
    const generation = this.generations.get(entity) || 0;
    const actionGeneration = this.actionGeneration;
    const attempt = () => {
      if (!this.canPlay() || this.context?.state !== "running" || generation !== (this.generations.get(entity) || 0)
        || actionGeneration !== this.actionGeneration || !this.groupLevel(clip,isUI) || this.dependencies.now() - now > 100) return;
      if (clip.loop && [...this.active].some(entry => !entry.stopping && entry.entity === entity && entry.clip.cue === cue)) return;
      const free = this.voices.get(clip.id)?.find(voice => ![...this.active].some(entry => entry.voice === voice));
      if ([...this.active].filter(e => !e.world).length >= AUDIO_LIMITS.actionVoices || this.active.size >= AUDIO_LIMITS.voices || !free) { this.dropped++; return; }
      const entry: ActiveVoice = { voice: free, clip, entity, ui:isUI, position: this.camera && !isUI ? position : undefined,
        started: now, stopping: false };
      this.active.add(entry);
      try {
        if (this.camera) this.backend!.listener(this.camera);
        free.play(clip.gain, clip.priority === 1 ? 0.98 + Math.random() * 0.04 : 1, entry.position?.(),isUI);
        this.previous.set(cue, clip.id); this.cooldown.set(entity, now); this.played++;
      } catch { this.active.delete(entry); this.dropped++; }
    };
    const defer = () => {
      const pending = { cue };
      if (clip.loop) this.pendingLoops.set(entity, pending);
      this.later(() => {
        if (this.pendingLoops.get(entity) === pending) this.pendingLoops.delete(entity);
        attempt();
      }, 25);
    };
    // Never invoke Audio V2 play while locked: it can queue sounds until a later unlock.
    if (this.context!.state !== "running") {
      if (this.unlocking) defer(); // Single short-lived gesture candidate, never a loading queue.
      else this.dropped++;
      return;
    }
    if ([...this.active].filter(e => !e.world).length >= AUDIO_LIMITS.actionVoices) {
      const victim = [...this.active].filter(entry => !entry.world && !entry.stopping && entry.clip.priority < clip.priority)
        .sort((a, b) => a.clip.priority - b.clip.priority || a.started - b.started)[0];
      if (!victim && ![...this.active].some(entry => entry.stopping)) { this.dropped++; return; }
      if (victim) this.stop(victim);
      defer();
    } else attempt();
  }

  /** Only current continuous targets may use late buffers; short events never enter this path. */
  world(targets: readonly WorldAudioTarget[]) {
    const desired = new Map<string, WorldAudioTarget>();
    for (const value of targets) {
      const clip = AUDIO_CLIPS.find(c => c.id === value.id && c.preload === "world");
      if (clip && this.groupLevel(clip) && Number.isFinite(value.gain) && value.gain > .0008) desired.set(value.id,
        {id:value.id,gain:Math.min(.5,value.gain),rate:Number.isFinite(value.rate) ? Math.max(.5,Math.min(2,value.rate)) : 1,
          pan:Number.isFinite(value.pan) ? Math.max(-.18,Math.min(.18,value.pan)) : 0,
          position:value.position && Object.values(value.position).every(Number.isFinite) ? value.position : undefined});
    }
    this.requestedWorld.clear();
    if (!this.canPlay() || !this.gestured || this.context?.state !== "running") {
      for (const entry of this.worldActive.values()) this.stop(entry); return;
    }
    for (const id of desired.keys()) this.requestedWorld.add(id);
    for (const [id, entry] of this.worldActive) if (!desired.has(id)) this.stop(entry);
    for (const [id, target] of desired) {
      const entry = this.worldActive.get(id);
      if (entry) { if (!entry.stopping) {entry.voice.update(target.gain,target.rate!,target.pan!); if(target.position)entry.voice.position(target.position);} continue; }
      const clip = AUDIO_CLIPS.find(c => c.id === id)!, voice = this.voices.get(id)?.[0];
      if (!voice || this.worldActive.size >= AUDIO_LIMITS.worldVoices || this.active.size >= AUDIO_LIMITS.voices) continue;
      const next: ActiveVoice = {voice,clip,entity:"soundscape:"+id,started:this.dependencies.now(),stopping:false,world:true};
      this.active.add(next); this.worldActive.set(id,next);
      try { if(this.camera)this.backend!.listener(this.camera); voice.play(0,target.rate!,target.position); voice.update(target.gain,target.rate!,target.pan!); this.played++; }
      catch { this.release(next); this.dropped++; }
    }
    if ([...desired.keys()].some(id => !this.voices.has(id) && !this.failures.has(id))) void this.preload();
  }
  resetWorld() { this.requestedWorld.clear(); for (const entry of this.worldActive.values()) this.stop(entry); }

  private canPlay() { return !this.disposed && !this.paused && this.enabled && this.volume > 0 && !!this.backend; }
  private applyVolume() { this.backend?.volume(this.enabled && !this.paused ? this.volume * this.volume : 0); }
  private later(callback: () => void, milliseconds: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, milliseconds);
    this.timers.add(timer);
  }
  private release(entry: ActiveVoice) {
    clearTimeout(entry.timer); this.active.delete(entry);
    if (entry.world && this.worldActive.get(entry.clip.id) === entry) this.worldActive.delete(entry.clip.id);
  }
  private stop(entry: ActiveVoice, immediate = false) {
    if (entry.stopping && !immediate) return;
    entry.stopping = true;
    entry.voice.stop(!immediate);
    if (immediate || this.context?.state !== "running") this.release(entry);
    else entry.timer = setTimeout(() => this.release(entry), 22);
  }
  stopEntity(entity: string) {
    this.pendingLoops.delete(entity);
    this.generations.set(entity, (this.generations.get(entity) || 0) + 1);
    for (const entry of this.active) if (entry.entity === entity) this.stop(entry);
  }
  stopAll(immediate = false) {
    this.pendingLoops.clear();
    this.timers.forEach(clearTimeout); this.timers.clear();
    this.actionGeneration++; this.requestedWorld.clear();
    for (const entry of this.active) this.stop(entry, immediate);
  }
  stopActions() {
    this.actionGeneration++; this.pendingLoops.clear();
    for (const entry of this.active) if (!entry.world) this.stop(entry);
  }
  setSpatialCamera(camera?: Camera) { this.stopAll(); this.camera = camera; }
  update() {
    if (!this.camera || !this.active.size || !this.canPlay() || this.context?.state !== "running") return;
    this.backend!.listener(this.camera);
    for (const entry of this.active) if (entry.position && !entry.stopping) entry.voice.position(entry.position());
  }
  pause() {
    this.paused = true; this.stopAll(true); this.applyVolume();
    if (this.context && this.context.state !== "closed") void this.context.suspend().catch(() => {});
  }
  foreground() { if (!this.disposed && this.paused) { this.paused = false; this.applyVolume(); } } // The next gesture resumes.
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stopAll(true);
    this.controllers.forEach(controller => controller.abort()); this.controllers.clear();
    this.voices.forEach(voices => voices.forEach(voice => voice.dispose())); this.voices.clear();
    this.loads.clear(); this.decodedBytes = 0; this.backend?.dispose();
    if (!this.backend && this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.onChange = () => {};
  }
}
