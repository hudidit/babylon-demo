import { Color3 } from "@babylonjs/core/pure";
import { COASTAL_CLIFF, coastalGridPoint, coastalSurfaceHeight, coastalTriangleAt } from "./CoastalCliff";
import type { CoastalGeometry, CoastalPoint } from "./CoastalCliff";
import { planToWorld } from "./HouseLayout";

type LandscapeGeometry = CoastalGeometry & { colors: number[] };
type Tree = { x: number; y: number; base: number; height: number; first: number; last: number };
const empty = (): LandscapeGeometry => ({ positions: [], indices: [], uvs: [], colors: [] });

/** Visual support only. The walking surface and its finite boundary are unchanged. */
export function landscapeGroundHeight(x: number, y: number): number | undefined {
  const a = COASTAL_CLIFF;
  if (y >= a.inlandStartY) return coastalSurfaceHeight(x, y);
  if (!Number.isFinite(x + y) || y < a.inlandY) return undefined;
  const s = (y - a.inlandStartY) / (a.inlandY - a.inlandStartY);
  const row = Math.min(a.rows - 1, a.nearRows + Math.floor(Math.sqrt(s) * (a.rows - a.nearRows)));
  const width = a.eastX - a.westX + 1320 * s;
  const column = Math.floor((x - a.westX + 660 * s) / width * a.columns);
  for (let c = Math.max(0, column - 1); c <= Math.min(a.columns - 1, column + 1); c++) {
    const p = [coastalGridPoint(c, row), coastalGridPoint(c + 1, row),
      coastalGridPoint(c + 1, row + 1), coastalGridPoint(c, row + 1)];
    for (const [i, j, k] of [[0, 3, 1], [1, 3, 2]]) {
      const hit = coastalTriangleAt(x, y, p[i], p[j], p[k]);
      if (hit) return hit.height;
    }
  }
  return undefined;
}

/** Original static shapes: four broken groves and three low, overlapping inland hills. */
export function coastalLandscape() {
  let seed = 231023;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const groups: { name: string; plants: LandscapeGeometry; ground?: LandscapeGeometry; trees: Tree[] }[] = [];
  const hillTriangles: CoastalPoint[][] = [];
  const supported = (x: number, y: number) => {
    const height = landscapeGroundHeight(x, y);
    if (height === undefined) throw new Error("Landscape has no terrain support");
    return height;
  };
  const vertex = (g: LandscapeGeometry, x: number, y: number, height: number, color: Color3) => {
    const p = planToWorld({ x, y }, height), index = g.positions.length / 3;
    g.positions.push(p.x, p.y, p.z); g.uvs.push(x / 15, y / 15);
    g.colors.push(color.r, color.g, color.b, 1); return index;
  };
  // Closed ring profiles give rounded, uneven branch masses instead of leaf cards.
  const crown = (g: LandscapeGeometry, x: number, y: number, z: number,
    radius: number, depth: number, height: number, phase: number, color: Color3) => {
    const first = g.positions.length / 3, sides = 7;
    vertex(g, x, y, z + height, color);
    for (let row = 1; row <= 2; row++) for (let col = 0; col < sides; col++) {
      const theta = row / 3 * Math.PI, phi = col / sides * Math.PI * 2;
      const shape = 1 + .12 * Math.sin(phi * 3 + phase) + .07 * Math.cos(phi * 2 - phase);
      vertex(g, x + Math.cos(phi) * Math.sin(theta) * radius * shape,
        y + Math.sin(phi) * Math.sin(theta) * depth * shape,
        z + Math.cos(theta) * height, color.scale(.58 + .42 * (1 + Math.cos(theta)) / 2));
    }
    const bottom = vertex(g, x, y, z - height, color.scale(.58));
    for (let col = 0; col < sides; col++) {
      const a = first + 1 + col, b = first + 1 + (col + 1) % sides;
      g.indices.push(first, a, b, a, a + sides, b, b, a + sides, b + sides,
        a + sides, bottom, b + sides);
    }
  };
  const trunk = (g: LandscapeGeometry, x: number, y: number, z: number, h: number, radius: number) => {
    const first = g.positions.length / 3, color = Color3.FromHexString("#706a57").toLinearSpace();
    for (let ring = 0; ring < 2; ring++) for (let col = 0; col <= 6; col++) {
      const angle = col / 6 * Math.PI * 2, r = radius * (1 - ring * .65);
      vertex(g, x + Math.cos(angle) * r + ring * h * .08, y + Math.sin(angle) * r,
        z + ring * h, color.scale(ring ? 1 : .65));
    }
    for (let col = 0; col < 6; col++) {
      const i = first + col; g.indices.push(i, i + 1, i + 7, i + 1, i + 8, i + 7);
    }
  };
  const tree = (group: typeof groups[number], x: number, y: number, height: number, far: boolean) => {
    let base = supported(x, y);
    if (far) for (const p of hillTriangles) base = Math.max(base, coastalTriangleAt(x, y, p[0], p[1], p[2])?.height ?? -Infinity);
    const g = group.plants, first = g.positions.length / 3;
    trunk(g, x, y, base - .22, height * .83, height * .027);
    const color = Color3.FromHexString(far ? "#687761" : "#52664b").toLinearSpace().scale(.85 + random() * .3);
    const radius = height * (.32 + random() * .06), phase = random() * Math.PI * 2;
    crown(g, x + height * .08, y, base + height * .8, radius, radius * .8, height * .2, phase, color);
    crown(g, x - radius * .5, y + radius * .23, base + height * .61, radius * .8, radius * .65, height * .15, phase + 1, color.scale(.9));
    if (!far) crown(g, x + radius * .7, y - radius * .35, base + height * .56,
      radius * .7, radius * .6, height * .13, phase + 2, color.scale(.82));
    group.trees.push({ x, y, base, height, first, last: g.positions.length / 3 });
  };
  // Hand-placed cluster centres and intentional gaps; no uniform scatter over the island.
  for (const [i, centre] of [[-17, -30], [-2, -37], [17, -32], [10, -22]].entries()) {
    const group = { name: `grove-${i}`, plants: empty(), trees: [] as Tree[] }; groups.push(group);
    for (let n = 0; n < 6; n++) {
      const angle = n * 2.4 + random() * .5, distance = 1.1 + random() * 3.7;
      tree(group, centre[0] + Math.cos(angle) * distance, centre[1] + Math.sin(angle) * distance * .7, 4.4 + random() * 2.4, false);
    }
  }
  const hills = [[-108, -99, 45, 25, 9], [-50, -117, 49, 29, 13], [7, -94, 36, 24, 8]];
  for (const [i, [x, y, rx, ry, height]] of hills.entries()) {
    const ground = empty(), points: CoastalPoint[] = [], sides = 24, rings = 6;
    const group = { name: `hill-${i}`, plants: empty(), ground, trees: [] as Tree[] }; groups.push(group);
    const color = Color3.FromHexString(i === 1 ? "#c3cbb4" : "#ced2b8").toLinearSpace();
    for (let row = 0; row <= rings; row++) for (let col = 0; col <= sides; col++) {
      const r = row / rings, phi = col / sides * Math.PI * 2;
      const px = x + Math.cos(phi) * rx * r, py = y + Math.sin(phi) * ry * r;
      const z = supported(px, py) - .18 + height * (1 - r * r) ** 2 * (1 + .12 * Math.sin(phi * 3 + i) * r);
      vertex(ground, px, py, z, Color3.Lerp(color, Color3.White(), r * r));
      points.push({ x: px, y: py, height: z });
    }
    for (let row = 0; row < rings; row++) for (let col = 0; col < sides; col++) {
      const a = row * (sides + 1) + col, b = a + 1, c = a + sides + 1, d = c + 1;
      ground.indices.push(a, c, b, b, c, d);
      hillTriangles.push([points[a], points[b], points[c]], [points[b], points[d], points[c]]);
    }
  }
  // Place roots only after every hill exists, so overlap cannot bury a neighbouring tree.
  hills.forEach(([x, y, rx, ry], i) => {
    const group = groups[i + 4];
    for (let n = 0; n < 16; n++) {
      const angle = n * 2.4 + random() * .6, radius = .22 + random() * .48;
      tree(group, x + Math.cos(angle) * rx * radius, y + Math.sin(angle) * ry * radius, 4.1 + random() * 2, true);
    }
  });
  return groups;
}
