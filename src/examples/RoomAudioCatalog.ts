/** Small typed catalog; source hashes and processing live in the published source.json. */
export type AudioCue = "drawer-slide" | "drawer-stop" | "door-move" | "door-latch" | "switch" | "paper";
export type AudioPoint = { x: number; y: number; z: number };
export type RoomAudioEvent = { cue: AudioCue | "stop"; entity: string; position?: () => AudioPoint };
export type AudioClip = { id: string; cue: AudioCue; file: string; priority: number; gain: number; preload: "core" | "variation" };
export const AUDIO_CLIPS: readonly AudioClip[] = [
  {"id": "drawer-slide-1", "cue": "drawer-slide", "file": "audio/study/drawer-slide-1.8353e0a53c.wav", "priority": 1, "gain": 0.25, "preload": "core"},
  {"id": "drawer-slide-2", "cue": "drawer-slide", "file": "audio/study/drawer-slide-2.71ff63e71c.wav", "priority": 1, "gain": 0.25, "preload": "variation"},
  {"id": "drawer-stop-1", "cue": "drawer-stop", "file": "audio/study/drawer-stop-1.6840b8eb30.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "drawer-stop-2", "cue": "drawer-stop", "file": "audio/study/drawer-stop-2.b34d827382.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  {"id": "door-move-1", "cue": "door-move", "file": "audio/study/door-move-1.f0162ae1b8.wav", "priority": 1, "gain": 0.25, "preload": "core"},
  {"id": "door-move-2", "cue": "door-move", "file": "audio/study/door-move-2.9dea4bdbfd.wav", "priority": 1, "gain": 0.25, "preload": "variation"},
  {"id": "door-latch-1", "cue": "door-latch", "file": "audio/study/door-latch-1.a220e2fe5d.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "door-latch-2", "cue": "door-latch", "file": "audio/study/door-latch-2.fb255ede74.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  {"id": "switch-1", "cue": "switch", "file": "audio/study/switch-1.702a81fab4.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "switch-2", "cue": "switch", "file": "audio/study/switch-2.927c10f6e3.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  {"id": "paper-1", "cue": "paper", "file": "audio/study/paper-1.ce7576efe6.wav", "priority": 3, "gain": 0.2, "preload": "core"},
  {"id": "paper-2", "cue": "paper", "file": "audio/study/paper-2.862694da2b.wav", "priority": 3, "gain": 0.2, "preload": "variation"},
];
export const AUDIO_LIMITS = { voices: 6, voicesPerClip: 2, decodedBytes: 8 * 1048576, fileBytes: 524288, coreBytes: 131072 };
export const AUDIO_DEFAULTS = { enabled: true, volume: 0.5 };
export const AUDIO_STORAGE_KEY = "study-audio-v1";
export function audioPreferences(value: unknown): { enabled: boolean; volume: number } {
  const candidate = value as { enabled?: unknown; volume?: unknown } | null;
  return { enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : AUDIO_DEFAULTS.enabled,
    volume: typeof candidate?.volume === "number" && Number.isFinite(candidate.volume)
      ? Math.min(1, Math.max(0, candidate.volume)) : AUDIO_DEFAULTS.volume };
}
