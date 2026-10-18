import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE as a, LIGHTHOUSE_FLOORS, lighthouseGroundAt, lighthouseInnerRadius, lighthouseFloorAt, lighthouseHoleAt } from "./LighthouseLayout";
import type { LighthouseFloor } from "./LighthouseLayout";

export interface LighthouseSupport { height: number; kind: "floor" | "platform"; region: string; ceiling?: number; lighthouse: true; level?: LighthouseFloor; }
const distanceToSegment = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
export function withinLighthouseLantern(x: number, y: number) {
  for (let i = 0; i < 8; i++) { const angle = (i + .5) * Math.PI / 4; if (x * Math.cos(angle) + y * Math.sin(angle) > 1.617) return false; }
  return true;
}
/** Select the current level by feet height; a higher floor never becomes a ground-level support. */
export function lighthouseSurfaceAt(x: number, y: number, feet = a.floor, maxStep = .18): LighthouseSupport | undefined {
  const t = COASTAL_SITE.tower, dx = x - t.x, dy = y - t.y, r = Math.hypot(dx, dy);
  if (r > 3.7) return undefined;
  const ground = lighthouseGroundAt(x, y);
  let best: LighthouseSupport | undefined = ground && { height: ground.height, kind: ground.inside ? "floor" : "platform",
    region: ground.inside ? "灯塔首层维护室" : "灯塔入口", lighthouse: true, level: ground.inside ? LIGHTHOUSE_FLOORS[0] : undefined };
  const floors = LIGHTHOUSE_FLOORS.slice(1).filter(f => lighthouseFloorAt(dx, dy, f));
  for (const floor of floors) if (floor.height <= feet + maxStep + 1e-6 && (!best || floor.height > best.height)) {
    best = { height: floor.height, kind: "floor", lighthouse: true, level: floor,
      region: floor.index === 4 && !withinLighthouseLantern(dx, dy) ? "灯塔观景外廊" : `灯塔${floor.label}` };
  }
  if (!best) return undefined;
  let ceiling = Infinity;
  for (const floor of floors) if (floor.height > best.height + .18 + 1e-6) ceiling = Math.min(ceiling, floor.height - floor.thickness);
  if (best.height >= a.gallery - .05 && r < 2.6) ceiling = Math.min(ceiling, r <= 1.95 ? t.ground + 18.55 : t.ground + 18.68);
  if (Number.isFinite(ceiling)) best.ceiling = ceiling;
  return best;
}
/** The ladder well stays protected during walking and jumping; only attached climbing enters it. */
export function lighthousePointAllowed(x: number, y: number, radius: number, feet = a.floor, support?: LighthouseSupport) {
  const t = COASTAL_SITE.tower, dx = x - t.x, dy = y - t.y, r = Math.hypot(dx, dy), theta = Math.atan2(dy, dx);
  if (r >= 3.5 + radius) return true;
  const s = support ?? lighthouseSurfaceAt(x, y, feet);
  if (s?.ceiling !== undefined && s.ceiling < Math.max(feet, s.height) + 1.68 - 1e-6 || feet - (s?.height ?? a.floor) > .85) return false;
  if (lighthouseHoleAt(dx, dy, radius + .035)) return false;
  if (s?.level?.index === 4) {
    const outer = 2.84 * Math.cos(Math.PI / 32) / Math.cos(((theta % (Math.PI / 16) + Math.PI / 16) % (Math.PI / 16)) - Math.PI / 32);
    if (r + radius + .04 > outer || r < .44 + radius + .035) return false;
    for (let i = 0; i < 8; i++) if (i !== a.exitPanel) {
      const start = i / 8 * Math.PI * 2, end = (i + 1) / 8 * Math.PI * 2;
      if (distanceToSegment(dx, dy, 1.75 * Math.cos(start), 1.75 * Math.sin(start), 1.75 * Math.cos(end), 1.75 * Math.sin(end)) < radius + .055) return false;
    }
    return true;
  }
  const inner = lighthouseInnerRadius(theta, Math.min(15.85, Math.max(0, feet - a.floor + 2.05)));
  const inRoom = r + radius + .025 <= inner, inEntry = feet < a.floor + .2 && Math.abs(dx) + radius <= a.entranceHalfWidth && dy <= -2.05;
  if (!inRoom && !inEntry) return false;
  return !a.furniture.some(f => feet < a.floor + f.height && Math.abs(dx - f.x) < f.width / 2 + radius + .025 && Math.abs(dy - f.y) < f.depth / 2 + radius + .025);
}
