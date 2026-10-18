import { planToWorld, HOUSE_COORDINATES } from "./HouseLayout";
import { coastalRoute, COASTAL_SITE, COASTAL_WALK_BOUNDARY } from "./CoastalSite";
import { coastalSurfaceHeight } from "./CoastalCliff";
import type { CoastalGeometry } from "./CoastalCliff";

/** Shared road triangles: rendering and walking consume the same vertices. */
export function coastalPathGeometry(): CoastalGeometry {
  const route = coastalRoute(), positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  let distance = 0;
  route.forEach((p, i) => {
    const a = route[Math.max(0, i - 1)], b = route[Math.min(route.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (i) distance += Math.hypot(p.x - route[i - 1].x, p.y - route[i - 1].y);
    for (let col = 0; col <= 4; col++) {
      const offset = (col / 4 - .5) * COASTAL_SITE.pathWidth, x = p.x - dy / length * offset, y = p.y + dx / length * offset;
      const height = coastalSurfaceHeight(x, y);
      if (height === undefined) throw new Error("Graybox path has no land beneath it");
      const v = planToWorld({ x, y }, height + .025); positions.push(v.x, v.y, v.z); uvs.push(col / 4, distance / 2);
      if (i && col < 4) {
        const n = i * 5 + col;
        indices.push(n - 5, n, n - 4, n - 4, n, n + 1);
      }
    }
  });
  // Choose the winding explicitly: plan Y becomes world Z in the left-handed scene.
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map(index => index * 3);
    if ((positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a])
      - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]) > 0)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  return { positions, indices, uvs };
}

/** A continuous entrance ramp, with its inner edge on the existing indoor floor. */
export function coastalEntryGeometry(): CoastalGeometry {
  const positions: number[] = [];
  for (const [x, y, h] of [[10.65, 3.92, 0], [12.9, 3.92, -.115], [10.65, 5.38, 0], [12.9, 5.38, -.115]]) {
    const p = planToWorld({ x, y }, h); positions.push(p.x, p.y, p.z);
  }
  return { positions, indices: [0, 2, 1, 1, 2, 3], uvs: [0, 0, 1, 0, 0, 1, 1, 1] };
}

/** One batched, visibly supported graybox fence for the finite exploration area. */
export function coastalGuardrailGeometry(): CoastalGeometry {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [], u = HOUSE_COORDINATES.unitsPerMeter;
  const beam = (a: number[], b: number[], width: number, height: number) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    const corners = ([] as number[][]).concat(...[a, b].map(p => [
      [p[0] + nx, p[1] - height / 2, p[2] + nz], [p[0] - nx, p[1] - height / 2, p[2] - nz],
      [p[0] + nx, p[1] + height / 2, p[2] + nz], [p[0] - nx, p[1] + height / 2, p[2] - nz],
    ]));
    for (const face of [[0, 1, 3, 2], [5, 4, 6, 7], [4, 0, 2, 6], [1, 5, 7, 3], [2, 3, 7, 6], [4, 5, 1, 0]]) {
      const first = positions.length / 3;
      for (const index of face) positions.push(...corners[index]);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1); indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  };
  for (let i = 0; i < COASTAL_WALK_BOUNDARY.length; i++) {
    const a = COASTAL_WALK_BOUNDARY[i], b = COASTAL_WALK_BOUNDARY[(i + 1) % COASTAL_WALK_BOUNDARY.length];
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
    let last: number[] | undefined;
    for (let j = 0; j <= count; j++) {
      const x = a.x + (b.x - a.x) * j / count, y = a.y + (b.y - a.y) * j / count;
      const h = coastalSurfaceHeight(x, y);
      if (h === undefined) throw new Error(`Guardrail has no support at ${x},${y}`);
      const p = planToWorld({ x, y }, h), point = [p.x, p.y, p.z];
      if (j < count) beam([p.x - .045 * u, p.y + .52 * u, p.z], [p.x + .045 * u, p.y + .52 * u, p.z], .09 * u, 1.08 * u);
      if (last) for (const level of [.5, 1]) beam([last[0], last[1] + level * u, last[2]],
        [point[0], point[1] + level * u, point[2]], .065 * u, .08 * u);
      last = point;
    }
  }
  return { positions, indices, uvs };
}
