/** Small typed catalog; source hashes and processing live in the published source.json. */
import { ACTION_AUDIO_CLIPS } from "./RoomActionAudioCatalog";
import { SOUNDSCAPE_AUDIO_CLIPS } from "./RoomSoundscapeAudioCatalog";
import { DAILY_AUDIO_CLIPS } from "./RoomDailyAudioCatalog";
import { BIRD_AUDIO_CLIPS } from "./RoomBirdAudioCatalog";
export type FootMaterial = "wood" | "hard" | "earth" | "metal" | "soft";
export type AudioCue = "drawer-slide" | "drawer-stop" | "door-move" | "door-latch" | "switch" | "paper"
  | "metal-door-move" | "metal-door-latch" | "slide-move" | "slide-stop" | "cloth-touch" | "cloth-wipe" | "cloth-lift"
  | "scooter-mount" | "scooter-brake" | "motor-loop" | "roll-loop" | "wind-open" | "wind-sheltered"
  | "rain-open" | "rain-sheltered" | "sea-open" | "sea-sheltered"
  | `footstep-${FootMaterial}` | `landing-${FootMaterial}` | "ladder-rung" | "curtain-move" | "beacon-drive" | "ui-contact" | "bird-call";
export type AudioPoint = { x: number; y: number; z: number };
export type RoomAudioEvent = { cue: AudioCue | "stop"; entity: string; position?: () => AudioPoint };
export type AudioGroup = "actions" | "vehicle" | "ambience" | "ui";
export type AudioMix = {actions: number; ambience: number; ui: number};
export type WorldAudioTarget = {id: string; gain: number; rate?: number; pan?: number; position?: AudioPoint};
export type AudioClip = { id: string; cue: AudioCue; file: string; priority: number; gain: number; preload: "core" | "variation" | "world"; loop?: boolean; group?: AudioGroup };
export const AUDIO_CLIPS: readonly AudioClip[] = [
  {"id": "drawer-slide-1", "cue": "drawer-slide", "file": "audio/study/drawer-slide-1.8353e0a53c.wav", "priority": 1, "gain": 0.25, "preload": "core"},
  {"id": "drawer-slide-2", "cue": "drawer-slide", "file": "audio/study/drawer-slide-2.71ff63e71c.wav", "priority": 1, "gain": 0.25, "preload": "variation"},
  {"id": "drawer-stop-1", "cue": "drawer-stop", "file": "audio/study/drawer-stop-1.6840b8eb30.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "drawer-stop-2", "cue": "drawer-stop", "file": "audio/study/drawer-stop-2.b34d827382.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  // A door's 0.7s motion outlasts these clips; looping repeats the same opening sound.
  {"id": "door-move-1", "cue": "door-move", "file": "audio/study/door-move-1.f0162ae1b8.wav", "priority": 1, "gain": 0.21, "preload": "core", "loop": false},
  {"id": "door-move-2", "cue": "door-move", "file": "audio/study/door-move-2.9dea4bdbfd.wav", "priority": 1, "gain": 0.21, "preload": "variation", "loop": false},
  {"id": "door-latch-1", "cue": "door-latch", "file": "audio/study/door-latch-1.a220e2fe5d.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "door-latch-2", "cue": "door-latch", "file": "audio/study/door-latch-2.fb255ede74.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  {"id": "switch-1", "cue": "switch", "file": "audio/study/switch-1.702a81fab4.wav", "priority": 3, "gain": 0.25, "preload": "core"},
  {"id": "switch-2", "cue": "switch", "file": "audio/study/switch-2.927c10f6e3.wav", "priority": 3, "gain": 0.25, "preload": "variation"},
  {"id": "paper-1", "cue": "paper", "file": "audio/study/paper-1.ce7576efe6.wav", "priority": 3, "gain": 0.2, "preload": "core"},
  {"id": "paper-2", "cue": "paper", "file": "audio/study/paper-2.862694da2b.wav", "priority": 3, "gain": 0.2, "preload": "variation"},
  ...ACTION_AUDIO_CLIPS,
  ...SOUNDSCAPE_AUDIO_CLIPS,
  ...DAILY_AUDIO_CLIPS,
  ...BIRD_AUDIO_CLIPS,
];
export const AUDIO_LIMITS = { voices: 14, actionVoices: 6, worldVoices: 8, voicesPerClip: 2,
  decodedBytes: 16 * 1048576, fileBytes: 2.1 * 1048576, coreBytes: 393216 };
export const AUDIO_DEFAULTS = { enabled: true, volume: 0.5 };
export const AUDIO_MIX_DEFAULTS: AudioMix = {actions: 1, ambience: .7, ui: 1};
export function audioMixPreferences(value: unknown): AudioMix {
  const saved = value as Partial<AudioMix> | null, result = {...AUDIO_MIX_DEFAULTS};
  for (const key of Object.keys(result) as (keyof AudioMix)[]) {
    if (typeof saved?.[key] === "number" && Number.isFinite(saved[key])) result[key] = Math.max(0,Math.min(1,saved[key]));
  }
  return result;
}
export const AUDIO_STORAGE_KEY = "study-audio-v1";
export function audioPreferences(value: unknown): { enabled: boolean; volume: number } {
  const candidate = value as { enabled?: unknown; volume?: unknown } | null;
  return { enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : AUDIO_DEFAULTS.enabled,
    volume: typeof candidate?.volume === "number" && Number.isFinite(candidate.volume)
      ? Math.min(1, Math.max(0, candidate.volume)) : AUDIO_DEFAULTS.volume };
}
