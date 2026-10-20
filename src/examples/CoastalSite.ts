import type { PlanPoint } from "./HouseLayout";

/** Shared metre-based layout shared by the exterior, map and walking surfaces. */
export const COASTAL_SITE = Object.freeze({
  version: "lighthouse-visual-c-v1",
  pathWidth: 1.8,
  tower: Object.freeze({ x: -125, y: 90, ground: 3, height: 20, radius: 3.4 }),
  plaza: Object.freeze({ width: 14, depth: 18 }),
  lookout: Object.freeze({ x: -70, y: 25, radius: 3 }),
  lookoutSeat: Object.freeze({ x: -68.8, y: 26.4 }),
});

export const COASTAL_ROUTE_ANCHORS: readonly PlanPoint[] = Object.freeze([
  { x: 10.8, y: 4.65 }, { x: 12.2, y: 4.65 }, { x: 13, y: -3 }, { x: -4, y: -5 }, { x: -18, y: 10 },
  { x: -40, y: 12 }, { x: -56, y: 8 }, // An inland bend clears the original v1 cliff at x=-30m.
  COASTAL_SITE.lookout, { x: -94, y: 44 }, { x: -116, y: 63 }, COASTAL_SITE.tower,
].map(p => Object.freeze({ x: p.x, y: p.y })));

/** A finite exploration area, visibly enclosed by the stage B timber guardrail. */
export const COASTAL_WALK_BOUNDARY: readonly PlanPoint[] = Object.freeze([
  [16, -7], [-6, -10], [-21, 4], [-40, 6], [-55, 2], [-61, 8],
  [-72, 19], [-99, 39], [-122, 60], [-134, 83], [-134, 99],
  [-118, 99], [-109, 84], [-110, 69], [-103, 56], [-96, 49], [-90, 46], [-66, 31],
  [-53, 15], [-40, 18], [-34, 14], [-23, 14], [-16, 16], [-7, 14], [-4, 14.4], [16, 14.4],
].map(([x, y]) => Object.freeze({ x, y })));

export const COASTAL_HOME = Object.freeze({ x: 12.2, y: 4.65 });

/** West-to-east crest controls; the last height joins the unchanged v1 coast exactly. */
export const COASTAL_EXTENSION: readonly (readonly [number, number])[] = [
  [-151, 50], [-145, 92], [-137, 103], [-125, 106], [-116, 104], [-110, 90],
  [-102, 60], [-94, 54], [-78, 39], [-70, 36], [-54, 34], [-40, 28],
];

const mix = (a: PlanPoint, b: PlanPoint, t: number): PlanPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const distance = (a: PlanPoint, b: PlanPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Short quadratic corner rounds keep the path outside the house and avoid spline overshoot. */
function routeCorners() {
  const a = COASTAL_ROUTE_ANCHORS, result: PlanPoint[] = [a[0]];
  for (let i = 1; i < a.length - 1; i++) {
    const radius = Math.min(1.5, distance(a[i - 1], a[i]) / 4, distance(a[i], a[i + 1]) / 4);
    const enter = mix(a[i], a[i - 1], radius / distance(a[i - 1], a[i]));
    const leave = mix(a[i], a[i + 1], radius / distance(a[i], a[i + 1]));
    result.push(enter);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      result.push(mix(mix(enter, a[i], t), mix(a[i], leave, t), t));
    }
  }
  result.push(a[a.length - 1]); return result;
}

/** At most 0.3m between samples; the same centreline drives geometry and the SVG. */
export function coastalRoute() {
  const corners = routeCorners(), result: PlanPoint[] = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const count = Math.max(1, Math.ceil(distance(corners[i - 1], corners[i]) / .3));
    for (let j = 1; j <= count; j++) result.push(mix(corners[i - 1], corners[i], j / count));
  }
  return result;
}

export function coastalRouteLength(height: (x: number, y: number) => number = () => 0) {
  const route = coastalRoute(); let length = 0;
  for (let i = 1; i < route.length; i++) length += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y,
    height(route[i].x, route[i].y) - height(route[i - 1].x, route[i - 1].y));
  return length;
}

export function coastalRouteDistance(x: number, y: number, route = coastalRoute()) {
  let squared = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    squared = Math.min(squared, (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2);
  }
  return Math.sqrt(squared);
}

/** Grade the road's earthwork corridor; the final 14m meets the level tower plaza. */
export function coastalPathGrade(x: number, y: number) {
  const heights = [-.14, -.14, -.14, -.14, .2, .6, .8, 1, 1.6, 2.3, 3], a = COASTAL_ROUTE_ANCHORS;
  let squared = Infinity, height = 0;
  for (let i = 1; i < a.length; i++) {
    const dx = a[i].x - a[i - 1].x, dy = a[i].y - a[i - 1].y, length = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - a[i - 1].x) * dx + (y - a[i - 1].y) * dy) / (length * length)));
    const d = (x - a[i - 1].x - t * dx) ** 2 + (y - a[i - 1].y - t * dy) ** 2;
    if (d < squared) {
      squared = d;
      const grade = i === a.length - 1 ? Math.min(1, t * length / (length - 14)) : t;
      height = heights[i - 1] + (heights[i] - heights[i - 1]) * grade;
    }
  }
  return { distance: Math.sqrt(squared), height };
}
