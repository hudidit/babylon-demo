import { COASTAL_SITE } from "./CoastalSite";

/** Existing exterior openings are the reference for each interior viewing level. */
export const LIGHTHOUSE_WINDOWS = Object.freeze([
  Object.freeze({ bottom: 3.8, height: 1.3, width: .48 }),
  Object.freeze({ bottom: 8.4, height: 1.3, width: .44 }),
  Object.freeze({ bottom: 12.5, height: 1.3, width: .4 }),
]);
const tower = COASTAL_SITE.tower;
export const LIGHTHOUSE = Object.freeze({
  wallThickness: .28, floor: tower.ground + .54, entranceHalfWidth: .6, doorY: -tower.radius + .07,
  plinthRadius: tower.radius + .7, lanternRadius: 2, galleryRadius: 3.35, railingRadius: 3.19,
  gallery: tower.ground + 16.64, exitPanel: 1,
  controlPanel: Object.freeze({ x: 2.4, y: -1.8, angle: -Math.atan2(3, 4),
    width: .84, height: .74, depth: .14, centerHeight: 1.5 }),
  ladder: Object.freeze({ x: -1.1, y: .42, width: .66, climbY: .05, landingY: -.95,
    minX: -1.65, maxX: -.55, minY: -.6, maxY: .6, speed: 1.6 }),
  furniture: Object.freeze([
    Object.freeze({ id: "cabinet", x: -2.55, y: .1, width: .54, depth: .9, height: 1.15 }),
    Object.freeze({ id: "workbench", x: .25, y: 2.55, width: 1.35, depth: .45, height: .87 }),
  ]),
  steps: Object.freeze([
    Object.freeze({ y: -tower.radius - .35, width: 1.9, depth: .45, top: tower.ground + .20 }),
    Object.freeze({ y: -tower.radius - .18, width: 1.7, depth: .45, top: tower.ground + .36 }),
  ]),
});
export interface LighthouseFloor { index: number; label: string; height: number; radius: number; thickness: number; hole: boolean; }
export const LIGHTHOUSE_FLOORS: readonly LighthouseFloor[] = Object.freeze([
  { index: 0, label: "首层维护室", height: LIGHTHOUSE.floor, radius: tower.radius + .08, thickness: .05, hole: false },
  { index: 1, label: "顶层灯室", height: LIGHTHOUSE.gallery, radius: LIGHTHOUSE.galleryRadius, thickness: .30, hole: true },
].map(f => Object.freeze(f)));

export function lighthouseInnerRadius(angle: number, height = 0) {
  const sector = Math.PI / 32, local = ((angle + Math.PI / 2) % sector + sector) % sector;
  const radius = tower.radius - height / 15.85 * .8 - LIGHTHOUSE.wallThickness;
  return radius * Math.cos(sector / 2) / Math.cos(local - sector / 2);
}
export function lighthouseHoleAt(x: number, y: number, margin = 0) {
  const l = LIGHTHOUSE.ladder;
  return x > l.minX - margin && x < l.maxX + margin && y > l.minY - margin && y < l.maxY + margin;
}
export function lighthouseFloorAt(x: number, y: number, floor: LighthouseFloor) {
  const angle = Math.atan2(y, x), sector = Math.PI / 32;
  const radius = floor.radius * Math.cos(sector / 2) / Math.cos(((angle % sector + sector) % sector) - sector / 2);
  return Math.hypot(x, y) <= radius + 1e-7 && (!floor.hole || !lighthouseHoleAt(x, y));
}
export function lighthouseGroundAt(x: number, y: number) {
  const dx = x - tower.x, dy = y - tower.y;
  if (Math.hypot(dx, dy) <= lighthouseInnerRadius(Math.atan2(dy, dx))) return { height: LIGHTHOUSE.floor, inside: true };
  if (Math.abs(dx) <= LIGHTHOUSE.entranceHalfWidth && dy >= -tower.radius - .04 && dy <= -tower.radius + .5) return { height: LIGHTHOUSE.floor, inside: false };
  let top: number | undefined;
  for (const step of LIGHTHOUSE.steps)
    if (Math.abs(dx) <= step.width / 2 && Math.abs(dy - step.y) <= step.depth / 2) top = Math.max(top ?? -Infinity, step.top);
  return top === undefined ? undefined : { height: top, inside: false };
}
