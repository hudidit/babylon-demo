import { CreateBox, CreateCylinder, Mesh, VertexData } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { planToWorld, HOUSE_COORDINATES } from "./HouseLayout";
import { coastalRoute, COASTAL_SITE } from "./CoastalSite";
import { coastalSurfaceHeight } from "./CoastalCliff";
import type { CoastalMaterials } from "./CoastalMaterials";

/** Stage A massing only. These meshes deliberately do not unlock outdoor walking. */
export function createCoastalLandmark(scene: Scene, surfaces: CoastalMaterials,
  retain: (mesh: Mesh, layer: "landmark" | "path" | "house-roof") => Mesh) {
  const u = HOUSE_COORDINATES.unitsPerMeter, site = COASTAL_SITE, t = site.tower;
  const white = surfaces.solid("coastal-graybox-white", "#e4ddd0");
  const dark = surfaces.solid("coastal-graybox-slate", "#454d4b");
  const red = surfaces.solid("coastal-graybox-cap", "#8d5144");
  const path = surfaces.solid("coastal-graybox-path", "#a49477");
  const box = (name: string, width: number, height: number, depth: number, x: number, y: number, h: number,
    material = dark, layer: "landmark" | "path" | "house-roof" = "landmark") => {
    const mesh = CreateBox(name, { width: width * u, height: height * u, depth: depth * u }, scene);
    const p = planToWorld({ x, y }, h); mesh.position.set(p.x, p.y, p.z);
    mesh.material = material; return retain(mesh, layer);
  };
  const cylinder = (name: string, bottom: number, height: number, baseDiameter: number, topDiameter: number, material = white) => {
    const mesh = CreateCylinder(name, { height: height * u, diameterBottom: baseDiameter * u, diameterTop: topDiameter * u, tessellation: 32 }, scene);
    const p = planToWorld(t, bottom + height / 2); mesh.position.set(p.x, p.y, p.z);
    mesh.material = material; return retain(mesh, "landmark");
  };
  box("coastal-lighthouse-plaza", site.plaza.width, .08, site.plaza.depth, t.x, t.y, t.ground, path);
  let bottom = t.ground + .04;
  for (const [name, height, base, top, material] of [
    ["plinth", .45, 7, 7, dark], ["shaft", 15.85, t.radius * 2, 4, white],
    ["gallery", .3, 6, 6, dark], ["lantern", 2, 3.6, 3.6, dark], ["cap", 1.4, 5.2, 0, red],
  ] as const) {
    cylinder("coastal-lighthouse-" + name, bottom, height, base, top, material); bottom += height;
  }
  // A closed entrance identifies the scale; an interior is not part of this stage.
  box("coastal-lighthouse-door", 1.05, 2.1, .12, t.x, t.y - 2.78, t.ground + 1.54, dark);
  const route = coastalRoute(), positions: number[] = [], indices: number[] = [], normals: number[] = [], uvs: number[] = [];
  let distance = 0;
  route.forEach((p, i) => {
    const a = route[Math.max(0, i - 1)], b = route[Math.min(route.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (i) distance += Math.hypot(p.x - route[i - 1].x, p.y - route[i - 1].y);
    for (let col = 0; col <= 4; col++) {
      const offset = (col / 4 - .5) * site.pathWidth, x = p.x - dy / length * offset, y = p.y + dx / length * offset;
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
  VertexData.ComputeNormals(positions, indices, normals);
  const road = new Mesh("coastal-lighthouse-path", scene), data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
  data.applyToMesh(road); road.material = path; retain(road, "path");
  const l = site.lookout, h = coastalSurfaceHeight(l.x, l.y)!;
  const lookout = CreateCylinder("coastal-lighthouse-lookout", { height: .08 * u, diameter: l.radius * 2 * u, tessellation: 32 }, scene);
  const p = planToWorld(l, h); lookout.position.set(p.x, p.y, p.z); lookout.material = path; retain(lookout, "landmark");
  box("coastal-lookout-seat", 2, .15, .5, l.x, l.y, h + .45);
  box("coastal-lookout-back", 2, .65, .12, l.x, l.y - .23, h + .65);
  for (const dx of [-.75, .75]) box("coastal-lookout-leg", .12, .4, .45, l.x + dx, l.y, h + .2);
  return box("coastal-house-roof-graybox", 10.96, .16, 10.96, 5.4, 5.4, 3.01, dark, "house-roof");
}
