import type { AudioCue, AudioPoint } from "./RoomAudioCatalog";

export type CleaningSoundState = { entity: string; active: boolean; revision: number; clean: boolean; position: () => AudioPoint };
type Sink = { play(cue: AudioCue, entity: string, position?: () => AudioPoint): void; stopEntity(entity: string): void };

/** Translates accepted cleaning transactions, never elapsed wall-clock timers, into sound. */
export class RoomCleaningAudio {
  private readonly active = new Map<string, number>();
  private readonly known = new Set<string>();
  constructor(private readonly audio: Sink) {}
  private stop(entity: string) {
    for (const suffix of ["", ":touch", ":lift"]) this.audio.stopEntity(entity + suffix);
  }
  sync(states: readonly CleaningSoundState[]) {
    for (const state of states) {
      this.known.add(state.entity);
      const previous = this.active.get(state.entity);
      if (state.active) {
        if (previous !== state.revision) {
          this.stop(state.entity);
          this.active.set(state.entity, state.revision);
          this.audio.play("cloth-touch", state.entity + ":touch", state.position);
        }
        // Idempotent loop; if preparation finishes mid-action, only the current motion can start.
        this.audio.play("cloth-wipe", state.entity, state.position);
      } else if (previous !== undefined) {
        this.stop(state.entity); this.active.delete(state.entity);
        if (state.clean && state.revision === previous + 1) this.audio.play("cloth-lift", state.entity + ":lift", state.position);
      }
    }
  }
  reset() { for (const entity of this.known) this.stop(entity); this.active.clear(); }
}
