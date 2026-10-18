import { COASTAL_SITE } from "./CoastalSite";

/** Metres above the house floor; geometry and movement share these dimensions. */
export const LIGHTHOUSE = Object.freeze({
  wallThickness: .28,
  floor: COASTAL_SITE.tower.ground + .54,
  clearHeight: 3.8,
  entranceHalfWidth: .48,
  doorY: -2.73,
  // The stair system is reserved for phase two; these are design parameters, not walkable surfaces.
  stair: Object.freeze({ innerRadius: .45, outerRadius: 1.55, walkingRadius: 1.1, stepAngle: Math.PI / 10 }),
  furniture: Object.freeze([
    Object.freeze({ id: "cabinet", x: -1.72, y: .1, width: .54, depth: .9, height: 1.15 }),
    Object.freeze({ id: "workbench", x: .25, y: 1.82, width: 1.35, depth: .45, height: .87 }),
  ]),
  steps: Object.freeze([
    Object.freeze({ y: -3.15, width: 1.5, depth: .45, top: COASTAL_SITE.tower.ground + .20 }),
    Object.freeze({ y: -2.98, width: 1.3, depth: .45, top: COASTAL_SITE.tower.ground + .36 }),
  ]),
});

/** Exact radial extent of the existing 64-sided shaft rather than a circumscribed circle. */
export function lighthouseInnerRadius(angle: number, height = 0) {
  const sector = Math.PI / 32, local = ((angle + Math.PI / 2) % sector + sector) % sector;
  const radius = COASTAL_SITE.tower.radius - height / 15.85 * .8 - LIGHTHOUSE.wallThickness;
  return radius * Math.cos(sector / 2) / Math.cos(local - sector / 2);
}

export function lighthouseSurfaceAt(x: number, y: number) {
  const t = COASTAL_SITE.tower, dx = x - t.x, dy = y - t.y;
  if (Math.hypot(dx, dy) <= lighthouseInnerRadius(Math.atan2(dy, dx)))
    return { height: LIGHTHOUSE.floor, inside: true };
  if (Math.abs(dx) <= LIGHTHOUSE.entranceHalfWidth && dy >= -2.84 && dy <= -2.3)
    return { height: LIGHTHOUSE.floor, inside: false };
  let top: number | undefined;
  for (const step of LIGHTHOUSE.steps)
    if (Math.abs(dx) <= step.width / 2 && Math.abs(dy - step.y) <= step.depth / 2) top = Math.max(top ?? -Infinity, step.top);
  return top === undefined ? undefined : { height: top, inside: false };
}

/** Solid tower base and masonry stay blocked except for the narrow north entrance. */
export function lighthousePointAllowed(x: number, y: number, radius: number) {
  const t = COASTAL_SITE.tower, dx = x - t.x, dy = y - t.y, r = Math.hypot(dx, dy);
  if (r >= 3.5 + radius) return true;
  const inner = lighthouseInnerRadius(Math.atan2(dy, dx), 2.05);
  const inRoom = r + radius + .025 <= inner;
  const inEntry = Math.abs(dx) + radius <= LIGHTHOUSE.entranceHalfWidth && dy <= -2.05;
  if (!inRoom && !inEntry) return false;
  return !LIGHTHOUSE.furniture.some(f => Math.abs(dx - f.x) < f.width / 2 + radius + .025
    && Math.abs(dy - f.y) < f.depth / 2 + radius + .025);
}
