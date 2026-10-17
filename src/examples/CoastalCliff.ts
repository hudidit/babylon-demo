import { HOUSE_COORDINATES, planToWorld } from "./HouseLayout";

/** House-plan distances are metres; backdrop radii are world units. South opens onto the sea. */
export const COASTAL_CLIFF = Object.freeze({
  version: "coastal-cliff-static-v1", seed: 41723,
  balconyEdgeY: 12.3, setback: 5, seaDepth: 28,
  westX: -34, eastX: 44, inlandStartY: -50, inlandY: -600,
  capeX: -8, capeReach: 40, columns: 96, rows: 64, nearRows: 20,
  skyRadius: 4800, seaRadius: 4900, cutawayDistance: 50,
});
export type CoastalGeometry = { positions: number[]; indices: number[]; uvs: number[]; normals?: number[] };
export type CoastalPoint = { x: number; y: number; height: number };
export const coastalSeaY = HOUSE_COORDINATES.floorY - COASTAL_CLIFF.seaDepth * HOUSE_COORDINATES.unitsPerMeter;
const empty = (): CoastalGeometry => ({ positions: [], indices: [], uvs: [] });
const gaussian = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2));

/** Shared crest curve, also used by the first wall ring: never independently sampled edges. */
export function coastalCrestY(x: number) {
  const a = COASTAL_CLIFF, centre = 8.1;
  return a.balconyEdgeY + a.setback
    + a.capeReach * (gaussian(x, a.capeX, 6) - gaussian(centre, a.capeX, 6))
    - 4 * (gaussian(x, 28, 8) - gaussian(centre, 28, 8))
    + .55 * (Math.sin(x * .37) - Math.sin(centre * .37));
}

/** The footprint and the strip in front of the balcony stay on one level. */
export function coastalGroundHeight(x: number, y: number) {
  const distance = Math.hypot(Math.max(-2 - x, 0, x - 13), Math.max(-2 - y, 0, y - 18));
  const fade = Math.min(1, distance / 18), phase = COASTAL_CLIFF.seed * .001;
  return -.14 + fade * fade * (1.1 + .6 * Math.sin(x * .13 + phase) * Math.cos(y * .09)
    + .7 * Math.sin(y * .037 + x * .031));
}

/** Near coast uses parallel columns; only the straight inland section fans out to the horizon. */
export function coastalGridPoint(column: number, row: number): CoastalPoint {
  const a = COASTAL_CLIFF;
  const frontX = a.westX + (a.eastX - a.westX) * column / a.columns;
  const near = row <= a.nearRows;
  const s = near ? row / a.nearRows : ((row - a.nearRows) / (a.rows - a.nearRows)) ** 2;
  const x = frontX + (near ? 0 : (column / a.columns - .5) * 1320 * s);
  const y = near ? coastalCrestY(frontX) * (1 - s) + a.inlandStartY * s
    : a.inlandStartY * (1 - s) + a.inlandY * s;
  return { x, y, height: coastalGroundHeight(x, y) };
}

function vertex(g: CoastalGeometry, p: CoastalPoint) {
  const world = planToWorld(p, p.height), index = g.positions.length / 3;
  g.positions.push(world.x, world.y, world.z); g.uvs.push(p.x / 3, p.y / 3);
  return index;
}

export function coastalLandPatch(firstColumn: number, lastColumn: number, firstRow: number, lastRow: number) {
  const g = empty(), stride = lastColumn - firstColumn + 1;
  for (let row = firstRow; row <= lastRow; row++) for (let col = firstColumn; col <= lastColumn; col++)
    {
      const p = coastalGridPoint(col, row); vertex(g, p);
      g.uvs.splice(g.uvs.length - 2, 2, p.x / 15, p.y / 15);
    }
  for (let row = 0; row < lastRow - firstRow; row++) for (let col = 0; col < stride - 1; col++) {
    const a = row * stride + col, b = a + 1, d = a + stride, c = d + 1;
    g.indices.push(a, d, b, b, d, c); // Babylon's left-handed winding, upward normal.
  }
  return g;
}

export function coastalBoundary() {
  const a = COASTAL_CLIFF, points: CoastalPoint[] = [];
  for (let col = 0; col <= a.columns; col++) points.push(coastalGridPoint(col, 0));
  for (let row = 1; row <= a.rows; row++) points.push(coastalGridPoint(a.columns, row));
  for (let col = a.columns - 1; col >= 0; col--) points.push(coastalGridPoint(col, a.rows));
  for (let row = a.rows - 1; row > 0; row--) points.push(coastalGridPoint(0, row));
  return points;
}

const depths = [0, -.8, -4, -8, -13, -18, -23, -27, -32];
const ledges = [0, .25, .8, .45, 1.7, 1.2, 3, 4.5, 7];
export function coastalWallPoint(boundary: readonly CoastalPoint[], index: number, ring: number): CoastalPoint {
  const n = boundary.length;
  index = index % n;
  const p = boundary[index];
  const before = boundary[(index - 1 + n) % n], after = boundary[(index + 1) % n];
  const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
  const chipped = ring > 0 && ring < depths.length - 1;
  const offset = ledges[ring] * (1 + .12 * Math.sin(index * .47 + ring * .8))
    + (chipped ? .25 * Math.sin(index * 1.8 + ring * .7) + .12 * Math.sin(index * .79 + ring * 2.3) : 0);
  return { x: p.x - dy / length * offset, y: p.y + dx / length * offset,
    height: depths[ring] + p.height * (1 - ring / (depths.length - 1))
      + (chipped ? .28 * Math.sin(index * .71 + ring * .8) + .13 * Math.sin(index * 1.9 + ring) : 0) };
}

/** Closed perimeter, real ledges and four metres of rock below the sea. */
export function coastalWallPatch(boundary: readonly CoastalPoint[], first: number, last: number) {
  const g = empty(), arc = [0]; g.normals = [];
  for (let i = 0; i < boundary.length; i++) {
    const p = boundary[i], q = boundary[(i + 1) % boundary.length];
    arc.push(arc[i] + Math.hypot(q.x - p.x, q.y - p.y));
  }
  // Keep hard vertical ledges; average tangents along the coast to avoid a checkerboard of lit faces.
  for (let i = first; i < last; i++) for (let ring = 0; ring < depths.length - 1; ring++) {
    const a = vertex(g, coastalWallPoint(boundary, i, ring));
    vertex(g, coastalWallPoint(boundary, i + 1, ring));
    vertex(g, coastalWallPoint(boundary, i + 1, ring + 1));
    vertex(g, coastalWallPoint(boundary, i, ring + 1));
    // Same metre density across patches and corners; vertical height must not collapse into XZ.
    const points = [coastalWallPoint(boundary, i, ring), coastalWallPoint(boundary, i + 1, ring),
      coastalWallPoint(boundary, i + 1, ring + 1), coastalWallPoint(boundary, i, ring + 1)];
    for (let j = 0; j < 4; j++) {
      g.uvs[(a + j) * 2] = arc[i + (j === 1 || j === 2 ? 1 : 0)] / 2;
      g.uvs[(a + j) * 2 + 1] = points[j].height / 2;
      const col = i + (j === 1 || j === 2 ? 1 : 0), row = ring + (j >= 2 ? 1 : 0), n = boundary.length;
      const before = coastalWallPoint(boundary, (col - 1 + n) % n, row), after = coastalWallPoint(boundary, col + 1, row);
      const top = coastalWallPoint(boundary, col, ring), bottom = coastalWallPoint(boundary, col, ring + 1);
      const tx = after.x - before.x, ty = after.height - before.height, tz = after.y - before.y;
      const vx = bottom.x - top.x, vy = bottom.height - top.height, vz = bottom.y - top.y;
      const normal = [vy * tz - vz * ty, vz * tx - vx * tz, vx * ty - vy * tx];
      const length = Math.hypot(...normal);
      g.normals.push(...normal.map(v => v / length));
    }
    g.indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  return g;
}

export function coastalUnderside(boundary: readonly CoastalPoint[]) {
  const g = empty();
  vertex(g, { x: 5.4, y: 0, height: -32 });
  boundary.forEach((_, index) => vertex(g, coastalWallPoint(boundary, index, depths.length - 1)));
  for (let i = 0; i < boundary.length; i++) g.indices.push(0, i + 1, (i + 1) % boundary.length + 1);
  return g;
}

export function coastalFoundation() {
  const g = empty(); let distance = 0;
  const outline = [[-.07, -.07], [10.87, -.07], [10.87, 12.37], [5.33, 12.37], [5.33, 10.87], [-.07, 10.87]];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length];
    const a = vertex(g, { x: p[0], y: p[1], height: -.07 });
    vertex(g, { x: p[0], y: p[1], height: -.35 });
    vertex(g, { x: q[0], y: q[1], height: -.35 });
    vertex(g, { x: q[0], y: q[1], height: -.07 });
    const end = distance + Math.hypot(q[0] - p[0], q[1] - p[1]);
    g.uvs.splice(a * 2, 8, distance / 2, -.07 / 2, distance / 2, -.35 / 2, end / 2, -.35 / 2, end / 2, -.07 / 2);
    distance = end;
    g.indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  return g;
}

export function coastalSea() {
  const g = empty(), u = HOUSE_COORDINATES.unitsPerMeter, segments = 128;
  const radii = [20, 50, 100, 250, 600, COASTAL_CLIFF.seaRadius / u];
  vertex(g, { x: 5.4, y: 5.4, height: -COASTAL_CLIFF.seaDepth });
  for (const radius of radii) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    vertex(g, { x: 5.4 + Math.cos(angle) * radius, y: 5.4 + Math.sin(angle) * radius, height: -COASTAL_CLIFF.seaDepth });
  }
  for (let i = 0; i < segments; i++) g.indices.push(0, i + 2, i + 1);
  for (let ring = 0; ring < radii.length - 1; ring++) for (let i = 0; i < segments; i++) {
    const a = 1 + ring * (segments + 1) + i, b = a + 1, d = a + segments + 1, c = d + 1;
    g.indices.push(a, d, b, b, d, c);
  }
  return g;
}
