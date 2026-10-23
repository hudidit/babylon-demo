import { planToWorld } from "./HouseLayout";
import type { CoastalGeometry } from "./CoastalCliff";

type Geometry = CoastalGeometry & { colors: number[] };
type Point = [number, number, number]; // plan X, height, plan Y

/** Compact forked coastal tree, sharing a three-clump/bark atlas and its parent static batch. */
export function appendCoastalTree(g: Geometry, x: number, y: number, base: number, h: number,
  far: boolean, shade: number, radius: number, phase: number) {
  g.normals ??= [];
  const add = (p: Point, normal: Point, u: number, v: number, tint: number) => {
    const w = planToWorld({ x: p[0], y: p[2] }, p[1]), i = g.positions.length / 3;
    g.positions.push(w.x, w.y, w.z); g.normals!.push(...normal); g.uvs.push(u, v);
    g.colors.push(tint, tint, tint, 1); return i;
  };
  const lerp = (a: Point, b: Point, t: number): Point => a.map((v, i) => v + (b[i] - v) * t) as Point;
  const unit = (p: Point): Point => { const n = Math.hypot(...p); return p.map(v => v / n) as Point; };
  const tube = (centres: Point[], radii: number[], sides: number) => {
    const first = g.positions.length / 3;
    centres.forEach((p, row) => {
      const a = centres[Math.max(0, row - 1)], b = centres[Math.min(centres.length - 1, row + 1)];
      const d = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const u = unit([d[1], -d[0], 0]), v: Point = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
      for (let col = 0; col < sides; col++) {
        const theta = col / sides * Math.PI * 2, normal = u.map((n, i) => n * Math.cos(theta) + v[i] * Math.sin(theta)) as Point;
        add(p.map((n, i) => n + normal[i] * radii[row]) as Point, normal,
          .53 + col / (sides - 1) * .44, .03 + row / (centres.length - 1) * .44, .85 + row * .1);
      }
      if (row) for (let col = 0; col < sides; col++) {
        const a = first + (row - 1) * sides + col, b = first + (row - 1) * sides + (col + 1) % sides;
        g.indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    });
    return first;
  };
  // Consistent inland lean, with tree-specific curvature instead of a pole-straight trunk.
  const stem: Point[] = [[x, base - .22, y], [x + h * .025, base + h * .43, y - h * .035],
    [x + h * (.09 + .035 * Math.sin(phase)), base + h * .78, y - h * .085]];
  const sides = far ? 4 : 5, girth = h * .025;
  tube(stem, [girth, girth * .62, girth * .18], sides);
  const clusters: { centre: Point; size: number; angle: number }[] = [];
  const branches: { first: number; root: Point; tip: Point }[] = [];
  const count = far ? 2 : 3;
  for (let n = 0; n < count; n++) {
    const t = .13 + n * .19, root = lerp(stem[1], stem[2], t);
    const angle = phase + n * 2.4, length = radius * (.82 + .16 * Math.sin(phase + n));
    const tip: Point = [root[0] + Math.cos(angle) * length + h * .025,
      base + h * (.63 + n * .075), root[2] + Math.sin(angle) * length - h * .035];
    branches.push({ first: tube([root, tip], [girth * .44, girth * .1], 3), root, tip });
    clusters.push({ centre: tip, size: h * (.26 - n * .018), angle });
  }
  clusters.push({ centre: stem[2], size: h * .255, angle: phase + 1 });
  const foliageFirst = g.positions.length / 3;
  for (const [n, cluster] of clusters.entries()) {
    const { centre, size, angle } = cluster, tile = (n + Math.floor(phase)) % 3;
    const atlasX = tile === 1 ? .5 : 0, atlasY = tile === 2 ? 0 : .5;
    // Two crossed upright patches and one sloping roof give foliage volume from ground and gallery.
    for (let plane = 0; plane < 3; plane++) {
      const a = angle + plane * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), first = g.positions.length / 3;
      for (const [u, v] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const offset: Point = plane < 2 ? [c * u * size, v * size * .7, s * u * size]
          : [u * size, v * size * .18, v * size * .9];
        // Canopy normals retain volume while keeping the underside from becoming a black plane.
        const normal = unit([offset[0] / size * .35, .9 + v * .12, offset[2] / size * .35]);
        add(centre.map((p, i) => p + offset[i]) as Point, normal,
          atlasX + .008 + (u + 1) * .242, atlasY + .008 + (v + 1) * .242,
          shade * (1.15 + v * .12));
      }
      g.indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }
  return { foliageFirst, branches, stem, stemSides: sides };
}
