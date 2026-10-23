import { Color3 } from "@babylonjs/core/pure";
import { COASTAL_CLIFF, coastalGridPoint, coastalSurfaceHeight, coastalTriangleAt } from "./CoastalCliff";
import type { CoastalGeometry, CoastalPoint } from "./CoastalCliff";
import { appendCoastalTree } from "./CoastalTree";
import { planToWorld } from "./HouseLayout";

type LandscapeGeometry = CoastalGeometry & { colors: number[] };
type Anchor = { x: number; y: number; first: number; kind: "shrub" | "grass" | "rock" };
type DetailShape = { kind: "shrub" | "grass" | "chip"; first: number };
type Tree = ReturnType<typeof appendCoastalTree> & { x: number; y: number; base: number; height: number; first: number; last: number };
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

/** Static landscape batches with CC0 needle cards; tree layout and terrain stay deterministic. */
export function coastalLandscape() {
  let seed = 231023;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const groups: { name: string; plants: LandscapeGeometry; ground?: LandscapeGeometry; rocks?: LandscapeGeometry; phase?: 2; anchors?: Anchor[]; trees: Tree[]; details?: { plants: number; rocks: number; shapes: DetailShape[] } }[] = [];
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
  // Closed low shrubs and stone chips retain the previous ground-detail geometry.
  const crown = (g: LandscapeGeometry, x: number, y: number, z: number,
    radius: number, depth: number, height: number, phase: number, color: Color3, sides = 7) => {
    const first = g.positions.length / 3;
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
  const tree = (group: typeof groups[number], x: number, y: number, height: number, far: boolean) => {
    let base = supported(x, y);
    if (far) for (const p of hillTriangles) base = Math.max(base, coastalTriangleAt(x, y, p[0], p[1], p[2])?.height ?? -Infinity);
    const g = group.plants, first = g.positions.length / 3;
    // Preserve the original scatter RNG, root positions, heights and all ground details.
    const shade = .85 + random() * .3, radius = height * (.32 + random() * .06), phase = random() * Math.PI * 2;
    const structure = appendCoastalTree(g, x, y, base, height, far, shade, radius, phase);
    group.trees.push({ x, y, base, height, first, last: g.positions.length / 3, ...structure });
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
  // A separate seed preserves all phase-one silhouettes byte for byte.
  seed = 231024;
  const zone = (name: string, rocks = false): typeof groups[number] => {
    const group: typeof groups[number] = { name, plants: empty(), trees: [], phase: 2, anchors: [] };
    if (rocks) group.rocks = empty();
    groups.push(group); return group;
  };
  const shrub = (group: typeof groups[number], x: number, y: number, h: number) => {
    const first = group.plants.positions.length / 3;
    crown(group.plants, x, y, supported(x, y) + h * .4, h * 1.15, h * .9, h * .6,
      random() * 6, Color3.FromHexString("#7e875c").toLinearSpace().scale(.85 + random() * .25));
    group.anchors!.push({ x, y, first, kind: "shrub" });
  };
  const grass = (group: typeof groups[number], x: number, y: number) => {
    const g = group.plants, color = Color3.FromHexString("#9b9c6b").toLinearSpace().scale(.85 + random() * .3);
    for (let n = 0; n < 5; n++) {
      const px = x + (random() - .5) * .6, py = y + (random() - .5) * .6;
      const z = supported(px, py) - .08, width = .12 + random() * .12, h = .45 + random() * .45;
      const a = vertex(g, px - width, py, z, color.scale(.7));
      vertex(g, px + width, py, z, color.scale(.7));
      vertex(g, px, py + width, z, color.scale(.7));
      vertex(g, px + .25, py + .1, z + h, color);
      g.indices.push(a, a + 2, a + 1, a, a + 1, a + 3, a + 1, a + 2, a + 3, a + 2, a, a + 3);
      group.anchors!.push({ x: px, y: py, first: a, kind: "grass" });
    }
  };
  const rock = (group: typeof groups[number], x: number, y: number, radius: number, h: number) => {
    const g = group.rocks!, first = g.positions.length / 3, base = supported(x, y), color = Color3.White();
    const phase = random() * 6;
    for (let ring = 0; ring < 3; ring++) for (let n = 0; n < 8; n++) {
      const angle = n / 8 * Math.PI * 2, r = radius * [1, .92, .66][ring] * (1 + .13 * Math.sin(n * 3 + phase));
      const px = x + Math.cos(angle) * r + ring * h * .12, py = y + Math.sin(angle) * r * .55;
      const z = ring ? base + h * (ring === 1 ? .48 : .88 + .08 * Math.sin(n + phase)) : supported(px, py) - .22;
      vertex(g, px, py, z, color.scale(ring ? 1 : .85));
      // Reuse the existing rock texture at its metre-scale projection.
      g.uvs.splice(g.uvs.length - 2, 2, (px + z * .3) / 2, (py + z * .7) / 2);
    }
    const top = vertex(g, x + h * .24, y, base + h, color);
    const bottom = vertex(g, x, y, base - .35, color.scale(.85));
    for (let n = 0; n < 8; n++) {
      const a = first + n, b = first + (n + 1) % 8;
      g.indices.push(a, b, a + 8, b, b + 8, a + 8, a + 8, b + 8, a + 16,
        b + 8, b + 16, a + 16, a + 16, b + 16, top, a, bottom, b);
    }
    group.anchors!.push({ x, y, first, kind: "rock" });
  };
  const edge = zone("grove-edge");
  for (const [x, y] of [[-17, -30], [-2, -37], [17, -32], [10, -22]]) for (let n = 0; n < 6; n++) {
    const angle = n * 2.4, distance = 4.5 + random() * 2;
    shrub(edge, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .8, .6 + random() * .55);
  }
  // B: two broken outcrops, with grass concentrated at their toes and open space between.
  for (const [i, [x, y]] of [[-48, -13], [-84, -9]].entries()) {
    const group = zone(`meadow-${i}`, true);
    for (let n = 0; n < 7; n++) rock(group, x + (n - 3) * 2.5, y + Math.sin(n * 1.6) * 1.2,
      1.8 + random() * 1.1, .5 + random() * .7);
    for (let n = 0; n < 34; n++) {
      const angle = n * 2.4, distance = 2.5 + random() * 8;
      grass(group, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .55);
    }
  }
  // C: sparse inland trees taper toward the lighthouse; the seaward skyline remains open.
  for (const [i, [x, y]] of [[-133, 21], [-125, 35]].entries()) {
    const group = zone(`tower-grove-${i}`);
    for (let n = 0; n < 8; n++) {
      const angle = n * 2.4, distance = 1.5 + random() * 4;
      tree(group, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 2.2 + (1 - i * .35) * random() * 2.6, false);
    }
  }
  // D: only low, wind-shaped masses on the narrow cape; no new tall focal point.
  const cape = zone("cape", true);
  for (const [x, y] of [[-8, 25], [-7, 29], [-8, 34], [-7, 38]]) {
    rock(cape, x, y, 1 + random() * .7, .55 + random() * .65);
    for (let n = 0; n < 3; n++) shrub(cape, x + (random() - .5) * 3, y + (random() - .5) * 2, .45 + random() * .4);
  }
  // Limited near-view detail shares the existing batches; untouched prefixes remain reproducible.
  seed = 231025;
  const detail = (group: typeof groups[number]) => group.details ??= {
    plants: group.plants.positions.length / 3, rocks: (group.rocks?.positions.length ?? 0) / 3, shapes: []
  };
  // The old 12-tree branch/lobe pass consumed 120 random values. Preserve all ground-detail placement.
  for (let n = 0; n < 120; n++) random();
  for (const group of [edge, cape]) {
    const d = detail(group), g = group.plants, shrubs = group.anchors!.filter(a => a.kind === "shrub");
    const chosen = group === edge ? [0, 6, 12, 18].reduce((chosen, start) => chosen.concat(shrubs.slice(start, start + 6).sort((a, b) => b.y - a.y).slice(0, 2)), [] as Anchor[])
      : shrubs.filter((_, i) => i % 3 === 0);
    for (const a of chosen) for (let n = 0; n < 2; n++) {
      const h = .35 + random() * .2, x = a.x + (n ? -.65 : .65), y = a.y + .35;
      d.shapes.push({ kind: "shrub", first: g.positions.length / 3 });
      crown(g, x, y, supported(x, y) + h * .4, h * 1.2, h, h * .6, random() * 6,
        Color3.FromHexString("#7e875c").toLinearSpace().scale(.8 + random() * .25));
    }
  }
  for (const group of groups.filter(g => g.name.startsWith("meadow-") || g === cape)) {
    const d = detail(group), g = group.plants, stones = group.rocks!, rocks = group.anchors!.filter(a => a.kind === "rock");
    for (let n = 0; n < (group === cape ? 4 : 8); n++) {
      const a = rocks[n % rocks.length];
      const front = Math.max(...Array.from({ length: 8 }, (_, i) => stones.positions[(a.first + i) * 3 + 2] / 5 + 5.4));
      const x = a.x + (random() - .5) * 1.8, y = front + .35 + random() * .35, first = g.positions.length / 3;
      grass(group, x + .5, y + .2);
      for (let i = first; i < g.positions.length / 3; i += 4) {
        d.shapes.push({ kind: "grass", first: i });
        const cx = (g.positions[i * 3] + g.positions[(i + 1) * 3]) / 2, cy = g.positions[i * 3 + 2], base = g.positions[i * 3 + 1];
        for (let j = i; j < i + 4; j++) {
          g.positions[j * 3] = cx + (g.positions[j * 3] - cx) * .4;
          g.positions[j * 3 + 2] = cy + (g.positions[j * 3 + 2] - cy) * .4;
          g.positions[j * 3 + 1] = base + (g.positions[j * 3 + 1] - base) * .6;
          for (let k = 0; k < 3; k++) g.colors[j * 4 + k] *= .8;
        }
      }
      d.shapes.push({ kind: "chip", first: stones.positions.length / 3 });
      crown(stones, x, y, supported(x, y) + .07, .3 + random() * .25, .25, .16, random() * 6, Color3.White());
    }
  }
  return groups;
}
