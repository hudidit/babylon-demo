import { HOUSE_COORDINATES, houseRoom } from "./HouseLayout";
import type { HouseRoomId, PlanPoint } from "./HouseLayout";
import { HOUSE_CONTENT } from "./HouseContent";
import { HOUSE_SUITE } from "./HouseSuite";
import { HOUSE_BEDROOM } from "./HouseBedroom";

/** Jump physics and landable surfaces are authored in metres above the house floor. */
export const HOUSE_JUMP = Object.freeze({
  gravity: 9.81,
  apex: 0.72,
  speed: Math.sqrt(2 * 9.81 * 0.72), // Max floor jump; headroom reduces it under a ceiling.
  mantle: 0.3,
  playerRadius: 0.26,
  eyeHeight: HOUSE_COORDINATES.eyeHeight,
});

export interface JumpPlatform {
  id: string;
  room: HouseRoomId;
  minX: number; maxX: number; minY: number; maxY: number;
  top: number;
}

const platform = (id: string, room: HouseRoomId, centre: PlanPoint, width: number, depth: number,
  yaw: number, top: number): JumpPlatform => {
  // All landable furniture is axis-aligned or rotated by 90 degrees.
  const quarterTurn = Math.abs(Math.sin(yaw)) > 0.5;
  const w = quarterTurn ? depth : width, d = quarterTurn ? width : depth;
  return Object.freeze({ id, room, minX: centre.x - w / 2, maxX: centre.x + w / 2,
    minY: centre.y - d / 2, maxY: centre.y + d / 2, top });
};
const roomPoint = (room: HouseRoomId, local: PlanPoint = { x: 0, y: 0 }): PlanPoint => {
  const r = houseRoom(room); return { x: r.x + local.x, y: r.y + local.y };
};
const bedroomBed = roomPoint("bedroom", HOUSE_BEDROOM.bed);
const bedroomSeat = roomPoint("bedroom", HOUSE_BEDROOM.seat);
const masterBed = roomPoint("master", HOUSE_SUITE.bed);

/**
 * Explicit whitelist: upholstered seats, the living-room coffee table and the beds.
 * Desks, consoles, cabinets, nightstands and the balcony rail deliberately have no platform.
 */
export const HOUSE_JUMP_PLATFORMS: readonly JumpPlatform[] = Object.freeze([
  // seat(): frame 0.45 + cushion 0.85 around 1.78 world / 5 -> 0.441m; 4.2 world depth.
  platform("living-sofa", "living", HOUSE_CONTENT.sofa, 12 / 5, 4.2 / 5, Math.PI / 2, 2.205 / 5),
  // Imported reading sofa/armchair: their scanned frames are 0.76m/0.95m tall; land on the seat.
  platform("reading-sofa", "living", HOUSE_CONTENT.readingSofa, HOUSE_CONTENT.readingSofa.width / 5, 3.15 / 5, 0, 0.46),
  platform("reading-armchair", "living", HOUSE_CONTENT.readingChair, HOUSE_CONTENT.readingChair.width / 5, 4.57 / 5, Math.PI, 0.48),
  // chair(): cushion top at 2.805 world above the group floor / 5 -> 0.561m.
  platform("study-chair", "study", HOUSE_CONTENT.chair, 2.35 / 5, 2.35 / 5, 0, 2.805 / 5),
  // Coffee table top: 2.2 + 0.14 world / 5 -> 0.468m; 7.5 x 4.4 world, rotated.
  platform("coffee-table", "living", HOUSE_CONTENT.coffeeTable, 7.5 / 5, 4.4 / 5, Math.PI / 2, 2.34 / 5),
  // bedroomBed(): duvet top at 0.675m; mattress footprint 1.5/1.8 x 2.03m.
  platform("guest-bed", "bedroom", bedroomBed, HOUSE_BEDROOM.bed.width, 2.03, 0, 0.675),
  platform("master-bed", "master", masterBed, HOUSE_SUITE.bed.width, 2.03, Math.PI / 2, 0.675),
  // The window bench is a seat too; cushion top 0.5m.
  platform("bedroom-bench", "bedroom", bedroomSeat, 0.45, 1.3, Math.PI / 2, 0.5),
]);


/** Non-landable furniture that must also reject airborne entry. Tops are informational. */
export interface JumpBlocker { id: string; minX: number; maxX: number; minY: number; maxY: number; top: number; }
const blocker = (id: string, centre: PlanPoint, width: number, depth: number, yaw: number, top: number): JumpBlocker => {
  const quarterTurn = Math.abs(Math.sin(yaw)) > 0.5;
  const w = quarterTurn ? depth : width, d = quarterTurn ? width : depth;
  return Object.freeze({ id, minX: centre.x - w / 2, maxX: centre.x + w / 2,
    minY: centre.y - d / 2, maxY: centre.y + d / 2, top });
};
export const HOUSE_JUMP_BLOCKERS: readonly JumpBlocker[] = Object.freeze([
  blocker("writing-desk", HOUSE_CONTENT.desk, 8.3 / 5, 6 / 5, 0, .782),
  blocker("window-console", HOUSE_CONTENT.console, 8 / 5, 2.9 / 5, Math.PI / 2, .85),
  blocker("antique-cabinet", HOUSE_CONTENT.cabinet, 2.65 / 5, 5.5 / 5, Math.PI / 2, 1.11),
  blocker("master-nightstand-west", roomPoint("master", HOUSE_SUITE.nightstands[0]), .56, .5, 0, .553),
  blocker("master-nightstand-east", roomPoint("master", HOUSE_SUITE.nightstands[1]), .56, .5, 0, .553),
  blocker("guest-nightstand", roomPoint("bedroom", HOUSE_BEDROOM.nightstand), .56, .5, 0, .553),
]);
export function jumpBlockedAt(x: number, y: number, margin = 0.08) {
  return HOUSE_JUMP_BLOCKERS.some(b => x >= b.minX - margin && x <= b.maxX + margin
    && y >= b.minY - margin && y <= b.maxY + margin);
}

export interface JumpState { feet: number; velocity: number; grounded: boolean; queued: boolean; }
export interface JumpFrame { feet: number; grounded: boolean; snapped?: PlanPoint; landed?: string; }

export function createJumpState(): JumpState { return { feet: 0, velocity: 0, grounded: true, queued: false }; }
export function resetJumpState(state: JumpState) { state.feet = 0; state.velocity = 0; state.grounded = true; state.queued = false; }
export function requestJump(state: JumpState) { if (state.grounded) state.queued = true; }

/** Highest landable surface under a plan point; the floor is the implicit fallback. */
export function jumpPlatformAt(x: number, y: number, margin = 0): JumpPlatform | undefined {
  let best: JumpPlatform | undefined;
  for (const p of HOUSE_JUMP_PLATFORMS)
    if (x >= p.minX - margin && x <= p.maxX + margin && y >= p.minY - margin && y <= p.maxY + margin
      && (!best || p.top > best.top)) best = p;
  return best;
}
export function jumpSupportAt(x: number, y: number) { return jumpPlatformAt(x, y)?.top ?? 0; }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Advance the vertical state after horizontal collision. Landing is checked only while falling,
 * with a small mantle assist from the edge so a 0.72m jump can reach a 0.675m bed.
 */
export function advanceJump(state: JumpState, dt: number, point: PlanPoint): JumpFrame {
  if (!(dt > 0)) return { feet: state.feet, grounded: state.grounded };
  if (state.grounded) {
    if (state.queued) {
      state.queued = false;
      const headroom = Math.max(0.15, HOUSE_COORDINATES.clearHeight - 0.08 - HOUSE_JUMP.eyeHeight - state.feet);
      const height = Math.min(HOUSE_JUMP.apex, headroom);
      state.velocity = Math.sqrt(2 * HOUSE_JUMP.gravity * height);
      state.grounded = false;
    } else {
      const support = jumpSupportAt(point.x, point.y);
      if (support < state.feet - 1e-6) { state.grounded = false; state.velocity = 0; }
      else {
        if (support <= state.feet + 1e-6) state.feet = support;
        return { feet: state.feet, grounded: true };
      }
    }
  }
  state.velocity -= HOUSE_JUMP.gravity * dt;
  const next = state.feet + state.velocity * dt;
  if (state.velocity <= 0) {
    const inside = jumpPlatformAt(point.x, point.y);
    if (inside && state.feet >= inside.top - 1e-6 && next <= inside.top) {
      state.feet = inside.top; state.velocity = 0; state.grounded = true;
      return { feet: state.feet, grounded: true, landed: inside.id };
    }
    if (!inside) {
      const near = jumpPlatformAt(point.x, point.y, HOUSE_JUMP.playerRadius + 0.12);
      if (near && state.feet >= near.top - HOUSE_JUMP.mantle && next <= near.top) {
        state.feet = near.top; state.velocity = 0; state.grounded = true;
        return { feet: state.feet, grounded: true, landed: near.id, snapped: {
          x: clamp(point.x, near.minX + 0.06, near.maxX - 0.06),
          y: clamp(point.y, near.minY + 0.06, near.maxY - 0.06),
        } };
      }
    }
  }
  if (next <= 0) { state.feet = 0; state.velocity = 0; state.grounded = true; return { feet: 0, grounded: true, landed: "floor" }; }
  state.feet = next;
  return { feet: next, grounded: false };
}
