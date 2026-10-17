import { Vector3 } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, houseRoomAt, planToWorld, worldToPlan } from "./HouseLayout";

export const HOUSE_WALKER_RADIUS = 0.26 * HOUSE_COORDINATES.unitsPerMeter;
export const HOUSE_EYE_Y = HOUSE_COORDINATES.floorY + HOUSE_COORDINATES.eyeHeight * HOUSE_COORDINATES.unitsPerMeter;
export function houseVector(x: number, y: number, height = 0) {
  const p = planToWorld({ x, y }, height);
  return new Vector3(p.x, p.y, p.z);
}
export const HOUSE_SPAWN = { x: 9.4, y: 5.35 };
/** Horizontal-only guard for the outside L-shaped boundary; vertical height is controlled separately. */
export function constrainHouseXZ(position: Vector3, previous: Vector3) {
  const p = worldToPlan(position), margin = HOUSE_WALKER_RADIUS / HOUSE_COORDINATES.unitsPerMeter + 0.05;
  p.x = Math.max(margin, Math.min(10.8 - margin, p.x));
  p.y = Math.max(margin, Math.min(12.3 - margin, p.y));
  if (p.y > 10.8 - margin && p.x < 5.4 + margin) {
    // Reject the concave outside corner instead of teleporting across it into the balcony.
    position.x = previous.x; position.z = previous.z; return false;
  }
  if (!houseRoomAt(p.x, p.y)) { position.x = previous.x; position.z = previous.z; return false; }
  const world = planToWorld(p); position.x = world.x; position.z = world.z; return true;
}

/** Legacy eye-height helper retained for tests and non-jumping callers. */
export function constrainHouseWalking(position: Vector3, previous: Vector3) {
  constrainHouseXZ(position, previous);
  position.y = HOUSE_EYE_Y;
  previous.copyFrom(position);
}
