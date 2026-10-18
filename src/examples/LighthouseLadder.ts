import { LIGHTHOUSE as a, LIGHTHOUSE_FLOORS } from "./LighthouseLayout";
import { COASTAL_SITE } from "./CoastalSite";
import type { PlanPoint } from "./HouseLayout";

export interface LighthouseLadderState { attached: boolean; feet: number; }
export interface LighthouseLadderInput { up: boolean; down: boolean; }
export const createLighthouseLadderState = (): LighthouseLadderState => ({ attached: false, feet: a.floor });
export const emptyLighthouseLadderInput = (): LighthouseLadderInput => ({ up: false, down: false });
export const lighthouseLadderPoint = () => ({ x: COASTAL_SITE.tower.x + a.ladder.x, y: COASTAL_SITE.tower.y + a.ladder.climbY });
export const lighthouseLadderLanding = () => ({ x: COASTAL_SITE.tower.x + a.ladder.x, y: COASTAL_SITE.tower.y + a.ladder.landingY });
export function lighthouseLadderFloor(feet: number, tolerance = .035) {
  return LIGHTHOUSE_FLOORS.find(f => Math.abs(f.height - feet) <= tolerance);
}
export function canBoardLighthouseLadder(p: PlanPoint, feet: number, grounded: boolean) {
  const anchor = lighthouseLadderLanding();
  return grounded && !!lighthouseLadderFloor(feet, .08) && Math.hypot(p.x - anchor.x, p.y - anchor.y) <= .85;
}
/** Crossing a level consumes the held direction; a fresh press continues to the next level. */
export function advanceLighthouseLadder(state: LighthouseLadderState, input: LighthouseLadderInput, seconds: number) {
  if (!state.attached || !Number.isFinite(state.feet) || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const direction = Number(input.up) - Number(input.down);
  if (!direction) return undefined;
  const next = Math.max(a.floor, Math.min(a.gallery, state.feet + direction * a.ladder.speed * Math.min(.2, seconds)));
  const crossed = (direction > 0 ? LIGHTHOUSE_FLOORS : [...LIGHTHOUSE_FLOORS].reverse()).find(f =>
    direction > 0 ? f.height > state.feet + 1e-6 && f.height <= next + 1e-6 : f.height < state.feet - 1e-6 && f.height >= next - 1e-6);
  state.feet = crossed?.height ?? next;
  if (crossed || state.feet === a.floor || state.feet === a.gallery) { input.up = false; input.down = false; }
  return crossed;
}
export function lighthouseClimbLabel(feet: number) {
  const floor = lighthouseLadderFloor(feet);
  if (floor) return `灯塔${floor.label} · 梯上`;
  const next = LIGHTHOUSE_FLOORS.find(f => f.height > feet), previous = [...LIGHTHOUSE_FLOORS].reverse().find(f => f.height < feet);
  return `灯塔垂直梯 · ${previous?.label ?? "首层"}与${next?.label ?? "顶层"}之间`;
}
