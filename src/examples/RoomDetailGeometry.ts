import { Mesh, Vector3, VertexData } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";

/** Flat board faces joined by small, smooth bevels, without changing the outer dimensions. */
export function beveledBox(name: string, size: readonly number[], radius: number, scene: Scene) {
  const half = size.map(value => value / 2);
  const r = Math.min(radius, ...half.map(value => value * 0.45));
  const inner = half.map(value => value - r);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const steps = (axis: number) => [-half[axis], -half[axis] + r * 0.4, -inner[axis],
    inner[axis], half[axis] - r * 0.4, half[axis]];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const us = steps(u), vs = steps(v), offset = positions.length / 3;
    for (const y of vs) for (const x of us) {
      const point = [0, 0, 0]; point[axis] = half[axis] * sign; point[u] = x; point[v] = y;
      const nearest = point.map((value, i) => Math.max(-inner[i], Math.min(inner[i], value)));
      const normal = Vector3.FromArray(point.map((value, i) => value - nearest[i])).normalize();
      positions.push(...nearest.map((value, i) => value + [normal.x, normal.y, normal.z][i] * r));
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(x / size[u] + 0.5, y / size[v] + 0.5);
    }
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const a = offset + y * 6 + x, b = a + 1, c = a + 6, d = c + 1;
      // Babylon's left-handed front faces use clockwise winding.
      indices.push(...(sign > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  return apply(name, positions, normals, uvs, indices, scene);
}

/** A tied linen panel: fullness above/below the tie, continuous pleats, a weighted hem. */
export function curtainPanel(name: string, side: number, scene: Scene) {
  const { positions, normals, uvs, indices } = curtainPanelGeometry(side);
  return apply(name, positions, normals, uvs, indices, scene);
}

/** Same topology at both endpoints, so opening preserves the original tied silhouette exactly. */
export function curtainPanelGeometry(side: number, closed = false) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 40, rows = 36;
  for (let y = 0; y <= rows; y++) {
    const t = y / rows;
    const gathered = Math.exp(-Math.pow((t - 0.64) / 0.14, 2));
    const width = closed ? 6.4 : 1.65 - gathered * 0.95 + t * 0.2;
    const center = side * (closed ? 3.18 : 5.55 + gathered * 0.26);
    for (let x = 0; x <= columns; x++) {
      const u = x / columns;
      const pleat = Math.sin(u * Math.PI * 12 + t * 0.25);
      positions.push(center + (u - 0.5) * width,
        4.4 - t * 8.95 - 0.055 * Math.sin(u * Math.PI * 6) * Math.pow(t, 12),
        // The sill projects to local Z=-.8; released fabric bows in front of it while
        // its header stays at the hanging rings. Preserve the original open endpoint.
        -0.68 + pleat * (0.16 - (closed ? 0 : gathered * 0.09)) - 0.13 * Math.sin(t * Math.PI)
          - (closed ? .04 + .32 * Math.min(1, t * 8) : 0));
      uvs.push(u * 0.8, (1 - t) * 2.1);
    }
  }
  gridIndices(columns, rows, indices);
  VertexData.ComputeNormals(positions, indices, normals);
  VertexData._ComputeSides(Mesh.DOUBLESIDE, positions, indices, normals, uvs);
  return { positions, normals, uvs, indices };
}

/** A thin pointed leaf with a raised midrib and a drooping tip; no alpha transparency. */
export function ficusLeaf(name: string, length: number, width: number, scene: Scene) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 8, rows = 14;
  for (let y = 0; y <= rows; y++) {
    const t = y / rows, profile = Math.max(0.003, Math.pow(Math.sin(Math.PI * t), 0.8));
    for (let x = 0; x <= columns; x++) {
      const across = x / columns * 2 - 1;
      positions.push(across * width * 0.5 * profile,
        length * (0.12 * Math.sin(t * Math.PI) - 0.2 * t * t) - Math.abs(across) * width * 0.11 * profile,
        t * length);
      uvs.push(x / columns, t);
    }
  }
  gridIndices(columns, rows, indices);
  VertexData.ComputeNormals(positions, indices, normals);
  VertexData._ComputeSides(Mesh.DOUBLESIDE, positions, indices, normals, uvs);
  return apply(name, positions, normals, uvs, indices, scene);
}

/** A mostly supported sheet with a small fold and one softly curled corner. */
export function creasedLetter(name: string, scene: Scene) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 16, rows = 22;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const curl = Math.pow(u, 10) * Math.pow(1 - v, 10) * 0.055;
      const fold = Math.exp(-Math.pow((v - 0.5) / 0.025, 2)) * Math.sin(u * Math.PI) * 0.007;
      positions.push((u - 0.5) * 1.5, curl + fold, (v - 0.5) * 2);
      uvs.push(u, v);
    }
  }
  gridIndices(columns, rows, indices);
  // The generic grid is used for vertical cloth; this X/Z sheet needs upward front faces.
  for (let i = 0; i < indices.length; i += 3) {
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  VertexData.ComputeNormals(positions, indices, normals);
  VertexData._ComputeSides(Mesh.DOUBLESIDE, positions, indices, normals, uvs);
  return apply(name, positions, normals, uvs, indices, scene);
}

function gridIndices(columns: number, rows: number, indices: number[]) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
}

function apply(name: string, positions: number[], normals: number[], uvs: number[], indices: number[], scene: Scene) {
  const mesh = new Mesh(name, scene), data = new VertexData();
  data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
}
