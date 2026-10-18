import { CreateBox, CreateCylinder, Mesh, VertexData } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { planToWorld, HOUSE_COORDINATES } from "./HouseLayout";
import { COASTAL_SITE } from "./CoastalSite";
import { coastalSurfaceHeight } from "./CoastalCliff";
import { coastalPathGeometry, coastalEntryGeometry, coastalGuardrailGeometry } from "./CoastalPath";
import type { CoastalMaterials } from "./CoastalMaterials";

/** Simple landmark massing with stage B access surfaces and a visible exploration fence. */
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
  for (const [name, geometry, material, layer] of [
    ["coastal-lighthouse-path", coastalPathGeometry(), path, "path"],
    ["coastal-entry-ramp", coastalEntryGeometry(), path, "path"],
    ["coastal-walk-guardrail", coastalGuardrailGeometry(), dark, "landmark"],
  ] as const) {
    const mesh = new Mesh(name, scene), data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(geometry.positions, geometry.indices, normals);
    data.positions = geometry.positions; data.indices = geometry.indices; data.normals = normals; data.uvs = geometry.uvs;
    data.applyToMesh(mesh); mesh.material = material; retain(mesh, layer);
  }
  const l = site.lookout, h = coastalSurfaceHeight(l.x, l.y)!;
  const lookout = CreateCylinder("coastal-lighthouse-lookout", { height: .08 * u, diameter: l.radius * 2 * u, tessellation: 32 }, scene);
  const p = planToWorld(l, h); lookout.position.set(p.x, p.y, p.z); lookout.material = path; retain(lookout, "landmark");
  const seat = site.lookoutSeat;
  box("coastal-lookout-seat", 2, .15, .5, seat.x, seat.y, h + .45);
  box("coastal-lookout-back", 2, .65, .12, seat.x, seat.y - .23, h + .65);
  for (const dx of [-.75, .75]) box("coastal-lookout-leg", .12, .4, .45, seat.x + dx, seat.y, h + .2);
  return box("coastal-house-roof-graybox", 10.96, .16, 10.96, 5.4, 5.4, 3.01, dark, "house-roof");
}
