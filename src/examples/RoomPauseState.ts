export type RoomPauseReason = "time-menu" | "settings" | "map" | "inspection" | "lighthouse-panel" | "story-panel" | "inspector" | "blur" | "hidden" | "external";

/** Independent owners remove only their own pause; a remaining owner still blocks controls. */
export class RoomPauseState {
  private readonly reasons = new Set<RoomPauseReason>();
  get snapshot(): readonly RoomPauseReason[] { return Object.freeze(Array.from(this.reasons)); }
  get blocked() { return this.reasons.size > 0; }
  get transitionBlocked() { return this.snapshot.some(reason => reason !== "time-menu"); }
  has(reason: RoomPauseReason) { return this.reasons.has(reason); }
  set(reason: RoomPauseReason, paused: boolean): boolean {
    if (this.reasons.has(reason) === paused) return false;
    if (paused) this.reasons.add(reason); else this.reasons.delete(reason);
    return true;
  }
}
