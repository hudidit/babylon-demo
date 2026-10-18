import { houseRoomAt, HOUSE_COORDINATES, worldToPlan } from "./HouseLayout";
import type { PlanPoint } from "./HouseLayout";
import { houseWallSpans } from "./HouseStructure";
import { coastalSurfaceAt, coastalSurfaceHeight, coastalTriangleAt } from "./CoastalCliff";
import type { CoastalPoint, CoastalSurface } from "./CoastalCliff";
import { coastalPathGeometry, coastalEntryGeometry } from "./CoastalPath";
import { COASTAL_SITE, COASTAL_WALK_BOUNDARY } from "./CoastalSite";
import { coastalRockObstacles } from "./CoastalScatter";
import { HOUSE_JUMP, jumpBlockedAt } from "./HouseJump";
import { LIGHTHOUSE, lighthousePointAllowed, lighthouseSurfaceAt } from "./LighthouseLayout";

export type WalkingSurface = CoastalSurface & { kind: "floor" | "terrain" | "path" | "platform"; region: string; ceiling?: number };
const flat = { x: 0, y: 1, z: 0 };
const distance = (p: PlanPoint, a: PlanPoint, b: PlanPoint) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

/** Radius-aware polygon containment; the same polygon produces the visible guardrail. */
export function withinWalkingBoundary(p: PlanPoint, radius = 0) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  let inside = false;
  for (let i = 0; i < COASTAL_WALK_BOUNDARY.length; i++) {
    const a = COASTAL_WALK_BOUNDARY[i], b = COASTAL_WALK_BOUNDARY[(i + 1) % COASTAL_WALK_BOUNDARY.length];
    if (radius > 0 && distance(p, a, b) < radius + .04) return false;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

type Triangle = [CoastalPoint, CoastalPoint, CoastalPoint];
let roadIndex: Map<string, Triangle[]> | undefined;
const cell = (x: number, y: number) => `${Math.floor(x / 2)},${Math.floor(y / 2)}`;
function indexSurfaces() {
  const index = new Map<string, Triangle[]>();
  for (const geometry of [coastalPathGeometry(), coastalEntryGeometry()]) {
    const points: CoastalPoint[] = [];
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const p = worldToPlan({ x: geometry.positions[i], z: geometry.positions[i + 2] });
      points.push({ ...p, height: (geometry.positions[i + 1] - HOUSE_COORDINATES.floorY) / HOUSE_COORDINATES.unitsPerMeter });
    }
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const triangle = geometry.indices.slice(i, i + 3).map(n => points[n]) as Triangle;
      for (let x = Math.floor(Math.min(...triangle.map(p => p.x)) / 2); x <= Math.floor(Math.max(...triangle.map(p => p.x)) / 2); x++)
        for (let y = Math.floor(Math.min(...triangle.map(p => p.y)) / 2); y <= Math.floor(Math.max(...triangle.map(p => p.y)) / 2); y++) {
          const key = `${x},${y}`, bucket = index.get(key) || []; bucket.push(triangle); index.set(key, bucket);
        }
    }
  }
  return index;
}

/** Highest actual rendered top surface; water, roofs and void never supply a fallback floor. */
export function walkingSurfaceAt(x: number, y: number): WalkingSurface | undefined {
  if (!withinWalkingBoundary({ x, y })) return undefined;
  const room = houseRoomAt(x, y);
  if (room) return { height: 0, normal: flat, kind: "floor", region: room.id,
    ceiling: room.id === "balcony" ? undefined : HOUSE_COORDINATES.clearHeight };
  const lighthouse = lighthouseSurfaceAt(x, y);
  if (lighthouse) return { height: lighthouse.height, normal: flat, kind: lighthouse.inside ? "floor" : "platform",
    region: lighthouse.inside ? "灯塔首层" : "灯塔入口",
    ceiling: lighthouse.inside ? LIGHTHOUSE.floor + LIGHTHOUSE.clearHeight : undefined };
  const terrain = coastalSurfaceAt(x, y);
  if (!terrain) return undefined;
  const t = COASTAL_SITE.tower, l = COASTAL_SITE.lookout;
  const region = Math.hypot(x - t.x, y - t.y) < 13 ? "灯塔前场"
    : Math.hypot(x - l.x, y - l.y) < 5 ? "观景点" : x > -7 ? "屋外" : "崖顶步道";
  let result: WalkingSurface = { ...terrain, kind: "terrain", region };
  const use = (surface: CoastalSurface, kind: WalkingSurface["kind"]) => {
    if (surface.height > result.height) result = { ...surface, kind, region };
  };
  roadIndex ??= indexSurfaces();
  for (const triangle of roadIndex.get(cell(x, y)) || []) {
    const hit = coastalTriangleAt(x, y, ...triangle); if (hit) use(hit, "path");
  }
  if (Math.abs(x - t.x) <= COASTAL_SITE.plaza.width / 2 && Math.abs(y - t.y) <= COASTAL_SITE.plaza.depth / 2)
    use({ height: t.ground + .04, normal: flat }, "platform");
  // The lookout is a 32-sided cylinder, so test its real footprint instead of its bounding circle.
  const dx = x - l.x, dy = y - l.y, angle = Math.atan2(dy, dx), sector = Math.PI / 16;
  const radius = l.radius * Math.cos(sector / 2) / Math.cos(((angle % sector + sector) % sector) - sector / 2);
  if (Math.hypot(dx, dy) <= radius) use({ height: coastalSurfaceHeight(l.x, l.y)! + .04, normal: flat }, "platform");
  return result;
}

const outerWalls = houseWallSpans().filter(span => (span.owners.length === 1 || span.rail) && span.bottom === 0)
  .map(s => ({ a: { x: s.axis === "x" ? s.start : s.at, y: s.axis === "x" ? s.at : s.start },
    b: { x: s.axis === "x" ? s.end : s.at, y: s.axis === "x" ? s.at : s.end } }));

/** Height-independent protection also covers jumping through windows or over the balcony rail. */
export function walkingPointAllowed(p: PlanPoint, radius: number = HOUSE_JUMP.playerRadius) {
  if (!withinWalkingBoundary(p, radius) || jumpBlockedAt(p.x, p.y)) return false;
  if (outerWalls.some(w => distance(p, w.a, w.b) < radius + HOUSE_COORDINATES.wallThickness / 2 - .002)) return false;
  const t = COASTAL_SITE.tower, l = COASTAL_SITE.lookoutSeat;
  if (!lighthousePointAllowed(p.x, p.y, radius)) return false;
  if (Math.abs(p.x - l.x) < 1 + radius && Math.abs(p.y - l.y) < .31 + radius) return false;
  if (coastalRockObstacles().some(r => Math.hypot(p.x - r.x, p.y - r.y) < r.radius + radius)) return false;
  const support = walkingSurfaceAt(p.x, p.y);
  if (!support || support.normal.y < Math.cos(Math.PI / 6)) return false;
  // All of the player's footprint must have real land support, also at the cliff and map edges.
  for (const [dx, dy] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]])
    if (!walkingSurfaceAt(p.x + dx, p.y + dy)) return false;
  return true;
}

/** Sweep every 10cm, retaining the last valid point rather than accepting only the destination. */
export function sweepWalking(from: PlanPoint, to: PlanPoint) {
  if (!walkingPointAllowed(from) || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return undefined;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length > 20) return undefined; // Abnormal coordinates recover from a stable checkpoint.
  const steps = Math.max(1, Math.ceil(length / .1));
  let point = from, height = walkingSurfaceAt(from.x, from.y)!.height;
  for (let i = 1; i <= steps; i++) {
    const next = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps };
    const support = walkingSurfaceAt(next.x, next.y);
    if (!walkingPointAllowed(next) || !support || support.height > height + .18 + 1e-6) break;
    point = next; height = support.height;
  }
  return point;
}
