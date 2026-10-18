import { houseRoomAt } from "./HouseLayout";
import type { PlanPoint } from "./HouseLayout";
import { walkingPointAllowed, walkingSurfaceAt } from "./WalkingSurface";
import { COASTAL_ROUTE_ANCHORS, COASTAL_SITE } from "./CoastalSite";

export const SCOOTER = Object.freeze({ length: 1.65, width: .65, wheelbase: 1.12, wheelRadius: .23,
  // User-facing top speed is 40 km/h; the controller remains metre/second based.
  cruise: 40 / 3.6,
  // A/D yaw response is halved from the original handling after user feedback.
  steerSensitivity: .5,
  slow: 2, reverse: 1, acceleration: 2.5, coastBrake: 3, brake: 7, eyeHeight: 1.42 });
/** Keep the grips readable in portrait without changing the user's field of view. */
export function scooterEyeBack(aspect: number) { return .23 + Math.min(.42, Math.max(0, .9 / Math.max(.2, aspect) - 1) * .45); }
export const SCOOTER_PARKING = Object.freeze([
  { id: "home", label: "家门停车位", x: 14, y: 2.2, heading: Math.PI },
  { id: "lookout", label: "观景点停车位", x: -71.3, y: 25.8, heading: -.9 },
  { id: "tower", label: "灯塔停车位", x: -122, y: 83.5, heading: -.35 },
]);
export type ScooterPose = PlanPoint & { heading: number };
export type ScooterState = ScooterPose & { speed: number; distance: number; steer: number; riding: boolean; exitRequested: boolean };
export type ScooterInput = { forward: boolean; back: boolean; left: boolean; right: boolean; brake: boolean };
export const emptyScooterInput = (): ScooterInput => ({ forward: false, back: false, left: false, right: false, brake: false });
export const createScooterState = (): ScooterState => ({ ...SCOOTER_PARKING[0], speed: 0, distance: 0, steer: 0, riding: false, exitRequested: false });
export function stopScooter(state: ScooterState) { state.speed = 0; state.steer = 0; }
export function resetScooter(state: ScooterState) { Object.assign(state, createScooterState()); }
export function scooterOffset(p: ScooterPose, side: number, along: number): PlanPoint {
  return { x: p.x + Math.cos(p.heading) * side + Math.sin(p.heading) * along,
    y: p.y - Math.sin(p.heading) * side + Math.cos(p.heading) * along };
}

/** Test wheels, corners and the complete body on the actual rendered support, including rotation. */
export function scooterSupport(p: ScooterPose) {
  if (![p.x, p.y, p.heading].every(Number.isFinite)) return undefined;
  const sample = (side: number, along: number) => {
    const q = scooterOffset(p, side, along), s = walkingSurfaceAt(q.x, q.y);
    return !(q.x > 10.65 && q.x < 12.3 && q.y > 3.7 && q.y < 5.6) && !houseRoomAt(q.x, q.y) && walkingPointAllowed(q, .055) && s && s.normal.y >= Math.cos(Math.PI / 10) ? s : undefined;
  };
  const front = sample(0, SCOOTER.wheelbase / 2), rear = sample(0, -SCOOTER.wheelbase / 2);
  const left = sample(-SCOOTER.width / 2, 0), right = sample(SCOOTER.width / 2, 0);
  if (!front || !rear || !left || !right) return undefined;
  const height = (front.height + rear.height) / 2;
  const pitch = Math.atan2(front.height - rear.height, SCOOTER.wheelbase);
  const roll = Math.atan2(right.height - left.height, SCOOTER.width);
  if (Math.abs(pitch) > .18 || Math.abs(roll) > .12) return undefined;
  for (const along of [-SCOOTER.length / 2, -.4, 0, .4, SCOOTER.length / 2])
    for (const side of [-SCOOTER.width / 2, 0, SCOOTER.width / 2]) {
      const s = sample(side, along);
      if (!s || Math.abs(s.height - height - Math.tan(pitch) * along - Math.tan(roll) * side) > .12) return undefined;
    }
  return { height, pitch, roll };
}

const sharpBends = COASTAL_ROUTE_ANCHORS.filter((p, i, all) => {
  if (!i || i === all.length - 1) return false;
  const a = all[i - 1], b = all[i + 1];
  return ((p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)) /
    (Math.hypot(p.x - a.x, p.y - a.y) * Math.hypot(b.x - p.x, b.y - p.y)) < .72;
});
export function scooterSpeedLimit(p: PlanPoint) {
  const distance = (q: PlanPoint) => Math.hypot(q.x - p.x, q.y - p.y);
  if (distance(SCOOTER_PARKING[0]) < 7 || distance(COASTAL_SITE.lookout) < 3.4 || distance(COASTAL_SITE.tower) < 8)
    return SCOOTER.slow;
  const nearest = Math.min(...sharpBends.map(distance));
  // A continuous approach ramp prevents entering a tight corner at cruise speed.
  return Math.min(SCOOTER.cruise, SCOOTER.slow + Math.max(0, nearest - 2) * .9);
}
const approach = (value: number, target: number, step: number) => value + Math.max(-step, Math.min(step, target - value));

/** Independent metre/second state; no camera, walking multiplier, browser or physics dependency. */
export function advanceScooter(state: ScooterState, input: ScooterInput, seconds: number) {
  if (!state.riding) { stopScooter(state); return; }
  if (!Number.isFinite(seconds) || seconds < 0 || !scooterSupport(state)) { stopScooter(state); return; }
  const ahead = { ...scooterOffset(state, 0, (state.speed < 0 ? -1 : 1) * 1.3), heading: state.heading };
  const limit = scooterSupport(ahead) ? scooterSpeedLimit(state) : SCOOTER.slow;
  let remaining = Math.min(.2, seconds);
  while (remaining > 1e-8) {
    const dt = Math.min(1 / 120, remaining); remaining -= dt;
    const braking = input.brake || state.exitRequested || input.forward && input.back;
    const target = braking ? 0 : input.forward ? Math.min(limit, scooterSpeedLimit(state)) : input.back ? -SCOOTER.reverse : 0;
    const reversing = target * state.speed < 0;
    state.speed = approach(state.speed, reversing ? 0 : target,
      (braking || reversing ? SCOOTER.brake : target === 0 ? SCOOTER.coastBrake : SCOOTER.acceleration) * dt);
    if (Math.abs(state.speed) < .001) state.speed = 0;
    const steer = Number(input.right) - Number(input.left);
    state.steer = approach(state.steer, steer, dt * 7);
    const angle = state.steer * SCOOTER.steerSensitivity * (Math.abs(state.speed) > .1 ? Math.sign(state.speed) : 1) *
      (1.65 + Math.min(1, Math.abs(state.speed) / 2) * .55) * dt;
    const travel = state.speed * dt, count = Math.max(1, Math.ceil(Math.abs(travel) / .04), Math.ceil(Math.abs(angle) / .025));
    for (let i = 0; i < count; i++) {
      const heading = state.heading + angle / count;
      const next = { x: state.x + Math.sin(heading) * travel / count, y: state.y + Math.cos(heading) * travel / count, heading };
      if (!scooterSupport(next)) { stopScooter(state); break; }
      state.x = next.x; state.y = next.y; state.heading = Math.atan2(Math.sin(heading), Math.cos(heading));
      state.distance += travel / count;
    }
  }
}

/** A real supported standing footprint, clear of the vehicle and any moving door leaf. */
export function scooterDismount(state: ScooterPose, clear: (p: PlanPoint, height: number) => boolean = () => true) {
  const base = scooterSupport(state); if (!base) return undefined;
  for (const [side, along] of [[.82, 0], [-.82, 0], [.82, -.4], [-.82, -.4], [0, -1.25], [0, 1.25]]) {
    const p = scooterOffset(state, side, along), support = walkingSurfaceAt(p.x, p.y);
    if (!support || houseRoomAt(p.x, p.y) || !walkingPointAllowed(p) || Math.abs(support.height - base.height) > .22) continue;
    if ([[-.26, 0], [.26, 0], [0, -.26], [0, .26]].some(([dx, dy]) => {
      const s = walkingSurfaceAt(p.x + dx, p.y + dy); return !s || Math.abs(s.height - support.height) > .1;
    })) continue;
    if (clear(p, support.height)) return { ...p, height: support.height };
  }
  return undefined;
}
