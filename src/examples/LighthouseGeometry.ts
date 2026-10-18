import { HOUSE_COORDINATES, planToWorld } from "./HouseLayout";
import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE as a, LIGHTHOUSE_FLOORS } from "./LighthouseLayout";
import type { LighthouseFloor } from "./LighthouseLayout";
import type { CoastalGeometry } from "./CoastalCliff";

type Point = [number, number];
const empty = (): CoastalGeometry => ({ positions: [], indices: [], uvs: [] });
const world = (x: number, y: number, height: number) => {
  const t = COASTAL_SITE.tower, p = planToWorld({ x: t.x + x, y: t.y + y }, height); return [p.x, p.y, p.z];
};
function clip(poly: Point[], axis: number, edge: number, less: boolean): Point[] {
  const inside = (p: Point) => less ? p[axis] <= edge : p[axis] >= edge, result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], pi = inside(p), qi = inside(q);
    if (pi) result.push(p);
    if (pi !== qi) { const t = (edge - p[axis]) / (q[axis] - p[axis]); result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return result.filter((p, i) => Math.hypot(p[0] - result[(i + 1) % result.length][0], p[1] - result[(i + 1) % result.length][1]) > 1e-8);
}
export function lighthouseFloorPolygons(floor: LighthouseFloor): Point[][] {
  const circle: Point[] = Array.from({ length: 64 }, (_, i) => [floor.radius * Math.cos(i / 64 * Math.PI * 2), floor.radius * Math.sin(i / 64 * Math.PI * 2)]);
  if (!floor.hole) return [circle];
  const l = a.ladder, middle = clip(clip(circle, 0, l.minX, false), 0, l.maxX, true);
  return [clip(circle, 0, l.minX, true), clip(circle, 0, l.maxX, false), clip(middle, 1, l.minY, true), clip(middle, 1, l.maxY, false)].filter(p => p.length >= 3);
}
function quad(g: CoastalGeometry, points: number[][]) {
  const n = g.positions.length / 3; points.forEach(p => g.positions.push(...p)); g.uvs.push(0, 0, 1, 0, 1, 1, 0, 1); g.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
}
export function lighthouseFloorGeometry(floors: readonly LighthouseFloor[]) {
  const g = empty();
  for (const floor of floors) for (const polygon of lighthouseFloorPolygons(floor)) {
    for (const top of [true, false]) {
      const n = g.positions.length / 3, points = top ? [...polygon].reverse() : polygon;
      for (const p of points) { g.positions.push(...world(p[0], p[1], floor.height - (top ? 0 : floor.thickness))); g.uvs.push(p[0] / 1.2, p[1] / 1.2); }
      for (let i = 1; i < points.length - 1; i++) g.indices.push(n, n + i, n + i + 1);
    }
    polygon.forEach((p, i) => { const q = polygon[(i + 1) % polygon.length]; quad(g, [world(...p, floor.height - floor.thickness), world(...q, floor.height - floor.thickness), world(...q, floor.height), world(...p, floor.height)]); });
  }
  return g;
}
function bar(g: CoastalGeometry, from: number[], to: number[], width = .045) {
  const d = to.map((v, i) => v - from[i]), length = Math.hypot(...d); if (length < 1e-8) return;
  const axis = d.map(v => v / length), across = Math.hypot(axis[0], axis[2]);
  const side = across > 1e-8 ? [-axis[2] / across, 0, axis[0] / across] : [1, 0, 0];
  const up = [axis[1] * side[2] - axis[2] * side[1], axis[2] * side[0] - axis[0] * side[2], axis[0] * side[1] - axis[1] * side[0]], n = g.positions.length / 3, w = width * HOUSE_COORDINATES.unitsPerMeter / 2;
  for (const end of [from, to]) for (const [s, u] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.positions.push(...end.map((v, i) => v + w * (s * side[i] + u * up[i]))); g.uvs.push(s, u); }
  for (const [i, j, k, l] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) g.indices.push(n + i, n + j, n + k, n + i, n + k, n + l);
}
export function lighthouseLadderGeometry(rungs: boolean) {
  const g = empty(), l = a.ladder;
  if (rungs) for (let h = a.floor + .2; h < a.gallery + .95; h += .28) bar(g, world(l.x - l.width / 2, l.y, h), world(l.x + l.width / 2, l.y, h), .045);
  else {
    for (const side of [-1, 1]) bar(g, world(l.x + side * l.width / 2, l.y, a.floor), world(l.x + side * l.width / 2, l.y, a.gallery + 1.1), .055);
    for (const floor of LIGHTHOUSE_FLOORS) for (const side of [-1, 1]) bar(g, world(l.x + side * l.width / 2, l.y, floor.height + .1), world(l.x + side * .5, .6, floor.height + .1), .035);
  }
  return g;
}
export function lighthouseHoleGuards() {
  const g = empty(), l = a.ladder, corners: Point[] = [[l.minX, l.minY], [l.minX, l.maxY], [l.maxX, l.maxY], [l.maxX, l.minY]];
  for (const floor of LIGHTHOUSE_FLOORS) {
    for (const p of corners) bar(g, world(...p, floor.height), world(...p, floor.height + 1.1));
    for (let i = 0; i < 3; i++) for (const h of [.45, 1.1]) bar(g, world(...corners[i], floor.height + h), world(...corners[i + 1], floor.height + h));
  }
  return g;
}
