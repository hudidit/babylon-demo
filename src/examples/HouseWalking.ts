import { Vector3 } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, houseRoomAt, planToWorld, worldToPlan } from "./HouseLayout";

export const HOUSE_WALKER_RADIUS = 0.26 * HOUSE_COORDINATES.unitsPerMeter;
export const HOUSE_EYE_Y = HOUSE_COORDINATES.floorY + HOUSE_COORDINATES.eyeHeight * HOUSE_COORDINATES.unitsPerMeter;
export function houseVector(x: number, y: number, height = 0) {
  const p = planToWorld({ x, y }, height);
  return new Vector3(p.x, p.y, p.z);
}
export const HOUSE_SPAWN = { x: 9.4, y: 5.35 };
/** Collision meshes handle internal walls. This final guard only protects the outside L-shaped boundary. */
export function constrainHouseWalking(position: Vector3, previous: Vector3) {
  const p = worldToPlan(position), margin = HOUSE_WALKER_RADIUS / HOUSE_COORDINATES.unitsPerMeter + 0.05;
  p.x = Math.max(margin, Math.min(10.8 - margin, p.x));
  p.y = Math.max(margin, Math.min(12.3 - margin, p.y));
  if (p.y > 10.8 - margin && p.x < 5.4 + margin) {
    // Reject the concave outside corner instead of teleporting across it into the balcony.
    position.copyFrom(previous);
  } else if (houseRoomAt(p.x, p.y)) {
    position.copyFrom(houseVector(p.x, p.y, HOUSE_COORDINATES.eyeHeight));
  } else position.copyFrom(previous);
  position.y = HOUSE_EYE_Y;
  previous.copyFrom(position);
}
