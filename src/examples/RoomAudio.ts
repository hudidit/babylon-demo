import type { Camera } from "@babylonjs/core/pure";
import type { AudioBackend, AudioVoice } from "./RoomAudioBackend";
import { AUDIO_CLIPS, AUDIO_DEFAULTS, AUDIO_LIMITS } from "./RoomAudioCatalog";
import type { AudioClip, AudioCue, AudioPoint, RoomAudioEvent } from "./RoomAudioCatalog";

type ActiveVoice = { voice: AudioVoice; clip: AudioClip; entity: string; position?: () => AudioPoint;
  started: number; stopping: boolean; timer?: ReturnType<typeof setTimeout> };
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
  onChange = () => {};
  private context?: AudioContext;
  private backend?: AudioBackend;
  private preparation?: Promise<void>;
  private readonly voices = new Map<string, AudioVoice[]>();
  private readonly active = new Set<ActiveVoice>();
  private readonly loads = new Map<string, Promise<void>>();
  private readonly failures = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private readonly previous = new Map<AudioCue, string>();
  private readonly cooldown = new Map<string, number>();
  private readonly generations = new Map<string, number>();
  private readonly controllers = new Set<AbortController>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private camera?: Camera;
  private ready = false;
  private paused = false;
  private disposed = false;
  private unsupported = false;
  private decodedBytes = 0;
  private played = 0;
  private dropped = 0;
  private unlocking = false;
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
      : this.failures.size ? "partial" : this.voices.size === AUDIO_CLIPS.length ? "ready"
      : this.preparation ? "loading" : "idle", context: this.context?.state || "uninitialized",
      preparing: !!this.preparation,
      readyFiles: this.voices.size, failedFiles: [...this.failures], active: this.active.size,
      decodedBytes: this.decodedBytes, played: this.played, dropped: this.dropped };
  }

  sceneReady() { this.ready = true; void this.preload(); }

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
    if (this.backend && !AUDIO_CLIPS.some(clip => !this.voices.has(clip.id)
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
      this.applyVolume();
    }
    for (const group of ["core", "variation"]) {
      const queue = AUDIO_CLIPS.filter(clip => clip.preload === group && !this.voices.has(clip.id)
        && (!this.failures.has(clip.id) || retry));
      const worker = async () => {
        while (queue.length && !this.disposed && !this.paused && this.enabled) {
          await this.load(queue.shift()!);
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
      if (this.decodedBytes + bytes > AUDIO_LIMITS.decodedBytes) throw new Error("Audio PCM budget exceeded");
      const prepared: AudioVoice[] = [];
      try {
        for (let i = 0; i < AUDIO_LIMITS.voicesPerClip; i++) {
          const voice = await this.backend!.voice(buffer, clip.id + "-" + i, clip.cue === "paper");
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
    if (!this.canPlay()) { this.dropped++; return; }
    const candidates = AUDIO_CLIPS.filter(clip => clip.cue === cue && this.voices.has(clip.id));
    if (!candidates.length) { this.dropped++; return; }
    const clip = candidates.find(value => value.id !== this.previous.get(cue)) || candidates[0];
    const now = this.dependencies.now();
    if (clip.priority === 1 && now - (this.cooldown.get(entity) ?? -Infinity) < 80) return;
    const generation = this.generations.get(entity) || 0;
    const attempt = () => {
      if (!this.canPlay() || this.context?.state !== "running" || generation !== (this.generations.get(entity) || 0)
        || this.dependencies.now() - now > 100) return;
      const free = this.voices.get(clip.id)?.find(voice => ![...this.active].some(entry => entry.voice === voice));
      if (this.active.size >= AUDIO_LIMITS.voices || !free) { this.dropped++; return; }
      const entry: ActiveVoice = { voice: free, clip, entity, position: this.camera && cue !== "paper" ? position : undefined,
        started: now, stopping: false };
      this.active.add(entry);
      try {
        if (this.camera) this.backend!.listener(this.camera);
        free.play(clip.gain, clip.priority === 1 ? 0.98 + Math.random() * 0.04 : 1, entry.position?.());
        this.previous.set(cue, clip.id); this.cooldown.set(entity, now); this.played++;
      } catch { this.active.delete(entry); this.dropped++; }
    };
    // Never invoke Audio V2 play while locked: it can queue sounds until a later unlock.
    if (this.context!.state !== "running") {
      if (this.unlocking) this.later(attempt, 25); // Single short-lived gesture candidate, never a loading queue.
      else this.dropped++;
      return;
    }
    if (this.active.size >= AUDIO_LIMITS.voices) {
      const victim = [...this.active].filter(entry => !entry.stopping && entry.clip.priority < clip.priority)
        .sort((a, b) => a.clip.priority - b.clip.priority || a.started - b.started)[0];
      if (!victim) { this.dropped++; return; }
      this.stop(victim); this.later(attempt, 25);
    } else attempt();
  }

  private canPlay() { return !this.disposed && !this.paused && this.enabled && this.volume > 0 && !!this.backend; }
  private applyVolume() { this.backend?.volume(this.enabled && !this.paused ? this.volume * this.volume : 0); }
  private later(callback: () => void, milliseconds: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, milliseconds);
    this.timers.add(timer);
  }
  private release(entry: ActiveVoice) { clearTimeout(entry.timer); this.active.delete(entry); }
  private stop(entry: ActiveVoice, immediate = false) {
    if (entry.stopping && !immediate) return;
    entry.stopping = true;
    entry.voice.stop(!immediate);
    if (immediate || this.context?.state !== "running") this.release(entry);
    else entry.timer = setTimeout(() => this.release(entry), 22);
  }
  stopEntity(entity: string) {
    this.generations.set(entity, (this.generations.get(entity) || 0) + 1);
    for (const entry of this.active) if (entry.entity === entity) this.stop(entry);
  }
  stopAll(immediate = false) {
    this.timers.forEach(clearTimeout); this.timers.clear();
    for (const entry of this.active) this.stop(entry, immediate);
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
