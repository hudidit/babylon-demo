import { CreateBox, CreateCylinder, Mesh, VertexData } from "@babylonjs/core/pure";
import type { PBRMaterial, Scene } from "@babylonjs/core/pure";
import { planToWorld, HOUSE_COORDINATES } from "./HouseLayout";
import { HOUSE_WINDOWS, houseWindowSide, houseWallSpans } from "./HouseStructure";
import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE, LIGHTHOUSE_WINDOWS } from "./LighthouseLayout";
import { coastalSurfaceHeight } from "./CoastalCliff";
import { coastalPathGeometry, coastalEntryGeometry, coastalGuardrailGeometry } from "./CoastalPath";
import type { CoastalGeometry } from "./CoastalCliff";
import type { CoastalMaterials } from "./CoastalMaterials";

type Layer = "landmark" | "path" | "house-roof";
type Retain = (mesh: Mesh, layer: Layer) => Mesh;

/** Small static batches keep repeated rails, joinery and frames out of the draw-call count. */
export class CoastalBatch {
  private groups = new Map<string, { meshes: Mesh[]; material: PBRMaterial; layer: Layer; detail: boolean }>();
  constructor(private scene: Scene, private retain: Retain) {}
  add(mesh: Mesh, name: string, material: PBRMaterial, layer: Layer = "landmark", detail = false) {
    if (!this.groups.has(name)) this.groups.set(name, { meshes: [], material, layer, detail });
    const group = this.groups.get(name)!;
    if (group.material !== material || group.layer !== layer || group.detail !== detail)
      throw new Error("Incompatible coastal batch: " + name);
    mesh.material = material; this.groups.get(name)!.meshes.push(mesh); return mesh;
  }
  box(name: string, m: PBRMaterial, w: number, h: number, d: number, x: number, y: number, z: number,
    angle = 0, layer: Layer = "landmark", detail = false) {
    const u = HOUSE_COORDINATES.unitsPerMeter, mesh = CreateBox(name, { width: w * u, height: h * u, depth: d * u }, this.scene);
    const p = planToWorld({ x, y }, z); mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = -angle;
    return this.add(mesh, name, m, layer, detail);
  }
  cylinder(name: string, m: PBRMaterial, x: number, y: number, bottom: number, h: number, base: number, top = base, sides = 48) {
    const u = HOUSE_COORDINATES.unitsPerMeter;
    const mesh = CreateCylinder(name, { height: h * u, diameterBottom: base * u, diameterTop: top * u, tessellation: sides }, this.scene);
    const p = planToWorld({ x, y }, bottom + h / 2); mesh.position.set(p.x, p.y, p.z);
    return this.add(mesh, name, m);
  }
  geometry(name: string, m: PBRMaterial, g: CoastalGeometry, layer: Layer = "landmark") {
    const mesh = new Mesh(name, this.scene), data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(g.positions, g.indices, normals);
    data.positions = g.positions; data.indices = g.indices; data.normals = g.normals || normals; data.uvs = g.uvs;
    data.applyToMesh(mesh); return this.add(mesh, name, m, layer);
  }
  finish() {
    const result: Mesh[] = [];
    for (const [name, group] of this.groups) {
      const mesh = group.meshes.length === 1 ? group.meshes[0] : Mesh.MergeMeshes(group.meshes, true, true)!;
      mesh.name = name; mesh.material = group.material;
      this.retain(mesh, group.layer); mesh.metadata.detailDistance = group.detail ? 75 : undefined;
      result.push(mesh);
    }
    return result;
  }
}

/** Permanent shell with actual openings. Window reveals/panes sit behind the outer wall. */
export function coastalTowerShaft(): CoastalGeometry {
  const t = COASTAL_SITE.tower, positions: number[] = [], normals: number[] = [], indices: number[] = [], uvs: number[] = [];
  const levels = [0, 2.15, ...LIGHTHOUSE_WINDOWS.reduce<number[]>((levels, w) => levels.concat(w.bottom, w.bottom + w.height), []), 15.85], count = 64;
  for (const h of levels) for (let i = 0; i <= count; i++) {
    const angle = i / count * Math.PI * 2 - Math.PI / 2, radius = 2.8 - h / 15.85 * .8;
    const p = planToWorld({ x: t.x + Math.cos(angle) * radius, y: t.y + Math.sin(angle) * radius }, t.ground + .49 + h);
    positions.push(p.x, p.y, p.z); normals.push(Math.cos(angle), .8 / 15.85, Math.sin(angle)); uvs.push(i / count * 16, h);
  }
  levels.slice(1).forEach((h, row) => {
    for (let col = 0; col < count; col++) {
      const centre = Math.min(col + .5, count - col - .5), window = centre < 1 && LIGHTHOUSE_WINDOWS.some(w => w.bottom === levels[row]);
      if (centre < 2 && row === 0 || window) continue;
      const a = row * (count + 1) + col;
      indices.push(a, a + 1, a + count + 1, a + 1, a + count + 2, a + count + 1);
    }
  });
  return { positions, normals, indices, uvs };
}

/** Inner masonry and boundary reveals are derived from the exact exterior opening edges. */
export function coastalTowerLining(thickness: number): CoastalGeometry {
  const g = coastalTowerShaft(), t = planToWorld(COASTAL_SITE.tower), u = HOUSE_COORDINATES.unitsPerMeter;
  const positions: number[] = [], normals: number[] = [], indices: number[] = [], uvs = g.uvs.slice();
  for (let i = 0; i < g.positions.length; i += 3) {
    const dx = g.positions[i] - t.x, dz = g.positions[i + 2] - t.z, r = Math.hypot(dx, dz);
    positions.push(g.positions[i] - dx / r * thickness * u, g.positions[i + 1], g.positions[i + 2] - dz / r * thickness * u);
    normals.push(-g.normals![i], -g.normals![i + 1], -g.normals![i + 2]);
  }
  const edges = new Map<string, { a: number; b: number; count: number }>();
  const key = (i: number) => g.positions.slice(i * 3, i * 3 + 3).map(v => v.toFixed(4)).join(",");
  for (let i = 0; i < g.indices.length; i += 3) {
    const [a, b, c] = g.indices.slice(i, i + 3); indices.push(c, b, a);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const k = [key(from), key(to)].sort().join("/");
      const edge = edges.get(k); if (edge) edge.count++; else edges.set(k, { a: from, b: to, count: 1 });
    }
  }
  for (const { a, b, count } of edges.values()) if (count === 1) {
    const start = positions.length / 3;
    positions.push(...g.positions.slice(b * 3, b * 3 + 3), ...g.positions.slice(a * 3, a * 3 + 3),
      ...positions.slice(a * 3, a * 3 + 3), ...positions.slice(b * 3, b * 3 + 3));
    const face: number[] = [];
    VertexData.ComputeNormals(positions.slice(start * 3), [0, 1, 2, 0, 2, 3], face);
    normals.push(...face); uvs.push(0, 0, 1, 0, 1, thickness, 0, thickness);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return { positions, normals, indices, uvs };
}

/** Original lighthouse, outdoor joinery and a low-pitch roof. Indoor materials stay untouched. */
export function createCoastalLandmark(scene: Scene, surfaces: CoastalMaterials, retain: Retain) {
  const site = COASTAL_SITE, t = site.tower, b = new CoastalBatch(scene, retain);
  const plaster = surfaces.finish("coastal-lighthouse-plaster", "#e8e1cf", "plaster");
  const metal = surfaces.solid("coastal-painted-metal", "#343f40"); metal.metallic = .55; metal.roughness = .48;
  const red = surfaces.solid("coastal-oxide-cap", "#844a3b"); red.metallic = .25; red.roughness = .68;
  const wood = surfaces.finish("coastal-weathered-timber", "#807461", "wood");
  const door = surfaces.solid("coastal-lighthouse-door", "#334d49");
  const path = surfaces.finish("coastal-gravel-path", "#d1bfa4", "path");
  const paving = surfaces.finish("coastal-stone-paving", "#b7b4a6", "paving");
  const roof = surfaces.finish("coastal-standing-seam-roof", "#5b6462", "roof"); roof.metallic = .35; roof.roughness = .66;
  const glass = surfaces.solid("coastal-lantern-glass", "#92b5ba");
  glass.alpha = .24; glass.metallic = .1; glass.roughness = .16; glass.backFaceCulling = false;
  const brass = surfaces.solid("coastal-lantern-brass", "#ad8a4b"); brass.metallic = .7; brass.roughness = .28;
  b.box("coastal-lighthouse-plaza", paving, site.plaza.width, .08, site.plaza.depth, t.x, t.y, t.ground);
  b.cylinder("coastal-lighthouse-plinth", paving, t.x, t.y, t.ground + .04, .45, 7);
  b.geometry("coastal-lighthouse-shaft", plaster, coastalTowerShaft());
  // The interior supplies a hollow cornice and a gallery with the shared ladder opening.
  for (const [z, h, diameter] of [[18.55, .13, 3.9]])
    b.cylinder("coastal-lighthouse-metalwork", metal, t.x, t.y, t.ground + z, h, diameter);
  b.cylinder("coastal-lighthouse-cap", red, t.x, t.y, t.ground + 18.68, 1.36, 5.2, 0);
  // Entrance steps and threshold are authored by the shared interior layout.
  const shaftRadius = (h: number) => 2.8 - h / 15.85 * .8;
  for (const [bottom, height, width] of [[0, 2.15, 1.07], ...LIGHTHOUSE_WINDOWS.map(w => [w.bottom, w.height, w.width])]) {
    const z = t.ground + .49 + bottom, radius = shaftRadius(bottom + height / 2);
    // Stone borders surround the shared shell/lining openings.
    for (const sign of [-1, 1]) {
      b.box("coastal-lighthouse-plinth", paving, .09, height + .18, .37, t.x + sign * (width / 2 + .04), t.y - radius + .06, z + height / 2);
      b.box("coastal-lighthouse-plinth", paving, width + .17, .09, .39, t.x, t.y - radius + .06, z + (sign < 0 ? -.035 : height + .035));
    }
    if (bottom) {
      b.box("coastal-lighthouse-glazing", glass, width - .08, height - .08, .025, t.x, t.y - radius + .19, z + height / 2);
      b.box("coastal-lighthouse-fine-metal", metal, .035, height, .03, t.x, t.y - radius + .17, z + height / 2, 0, "landmark", true);
      b.box("coastal-lighthouse-fine-metal", metal, width, .035, .03, t.x, t.y - radius + .17, z + height / 2, 0, "landmark", true);
    }
  }
  // Fixed octagonal glazing; the independent optical head is built by LighthouseBeacon.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = t.x + Math.cos(a) * 1.75, y = t.y + Math.sin(a) * 1.75;
    b.box("coastal-lighthouse-metalwork", metal, .1, 1.8, .1, x, y, t.ground + 17.62);
    const mid = a + Math.PI / 8;
    if (i !== LIGHTHOUSE.exitPanel) b.box("coastal-lighthouse-glazing", glass, 1.28, 1.7, .025,
      t.x + Math.cos(mid) * 1.617, t.y + Math.sin(mid) * 1.617, t.ground + 17.62, mid + Math.PI / 2);
  }
  b.cylinder("coastal-lighthouse-metalwork", metal, t.x, t.y, t.ground + 16.7, .75, .18, .18, 12);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, next = (i + 1) / 32 * Math.PI * 2;
    b.box("coastal-lighthouse-metalwork", metal, .045, 1.10, .045, t.x + 2.84 * Math.cos(a), t.y + 2.84 * Math.sin(a), LIGHTHOUSE.gallery + .55);
    for (const level of [16.99, 17.74]) b.box("coastal-lighthouse-metalwork", metal, 2 * 2.84 * Math.sin(Math.PI / 32) + .025, .045, .045,
      t.x + 2.84 * (Math.cos(a) + Math.cos(next)) / 2, t.y + 2.84 * (Math.sin(a) + Math.sin(next)) / 2, t.ground + level, (a + next) / 2 + Math.PI / 2);
  }
  b.geometry("coastal-lighthouse-path", path, coastalPathGeometry(), "path");
  b.geometry("coastal-entry-ramp", paving, coastalEntryGeometry(), "path");
  b.geometry("coastal-walk-guardrail", wood, coastalGuardrailGeometry());
  const l = site.lookout, h = coastalSurfaceHeight(l.x, l.y)!, seat = site.lookoutSeat;
  b.cylinder("coastal-lighthouse-lookout", paving, l.x, l.y, h - .04, .08, l.radius * 2, l.radius * 2, 32);
  for (let i = 0; i < 4; i++) {
    b.box("coastal-lookout-timber", wood, 2, .065, .105, seat.x, seat.y - .18 + i * .12, h + .48);
    if (i < 3) b.box("coastal-lookout-timber", wood, 2, .13, .07, seat.x, seat.y - .23, h + .67 + i * .15);
  }
  for (const dx of [-.75, .75]) {
    b.box("coastal-lookout-frame", metal, .065, .85, .065, seat.x + dx, seat.y - .23, h + .42);
    b.box("coastal-lookout-frame", metal, .065, .44, .065, seat.x + dx, seat.y + .19, h + .2);
    b.box("coastal-lookout-frame", metal, .065, .065, .5, seat.x + dx, seat.y, h + .38);
  }
  // Wayfinding is geometry with an arrow silhouette; it never intercepts item/door picking.
  for (const [x, y] of [[-3, -6.6], [-69, 23]]) {
    const z = coastalSurfaceHeight(x, y)!;
    b.box("coastal-route-signs", wood, .09, 1.45, .09, x, y, z + .7);
    b.box("coastal-route-signs", wood, .85, .22, .06, x - .25, y, z + 1.22);
    b.box("coastal-route-signs", wood, .22, .22, .06, x - .7, y, z + 1.22, Math.PI / 4);
    for (const side of [-1, 1]) b.box("coastal-route-sign-marks", plaster, .25, .035, .015, x - .25, y + side * .04, z + 1.22);
  }
  // Low pitched roof, physically separated 0.15m above the indoor ceiling. Eaves retain real window openings.
  for (const side of [-1, 1]) {
    const panel = b.box("coastal-house-roof", roof, 5.68, .12, 11.35, 5.4 + side * 2.82, 5.4, 3.25, 0, "house-roof");
    panel.rotation.z = -side * .055;
  }
  b.box("coastal-house-roof", roof, .15, .08, 11.4, 5.4, 5.4, 3.43, 0, "house-roof");
  for (const x of [-.24, 11.04]) b.box("coastal-house-eaves", wood, .12, .35, 11.48, x, 5.4, 3, 0, "house-roof");
  for (const y of [-.3, 11.1]) {
    b.box("coastal-house-eaves", wood, 11.4, .35, .12, 5.4, y, 3, 0, "house-roof");
    const points = [-.24, 5.4, 11.04].map((x, i) => planToWorld({ x, y }, i === 1 ? 3.4 : 3.09));
    const positions = [...points, ...points.slice().reverse()].reduce<number[]>((a, p) => a.concat(p.x, p.y, p.z), []);
    b.geometry("coastal-house-eaves", wood,
      { positions, indices: [0, 1, 2, 3, 4, 5], uvs: [0, 0, .5, 1, 1, 0, 1, 0, .5, 1, 0, 0] }, "house-roof");
  }
  for (const w of HOUSE_WINDOWS) {
    const side = houseWindowSide(w), horizontal = w.axis === "x", outward = side === "north" || side === "west" ? -1 : 1;
    const x = w.x + (horizontal ? w.width / 2 : outward * .11), y = w.y + (horizontal ? outward * .11 : w.width / 2);
    // The sill lies outside the wall slab; it cannot coincide with the cut faces in the window reveal.
    b.box("coastal-house-sills", paving, horizontal ? w.width + .2 : .18, .065, horizontal ? .18 : w.width + .2,
      x, y, w.sill - .09, 0, "house-roof");
  }
  for (const span of houseWallSpans().filter(s => s.owners.length === 1 && !s.rail && s.bottom === 0)) {
    const horizontal = span.axis === "x", offset = span.at === 0 ? -.085 : .085;
    b.box("coastal-house-sills", paving, horizontal ? span.end - span.start : .065, .18, horizontal ? .065 : span.end - span.start,
      horizontal ? (span.start + span.end) / 2 : span.at + offset, horizontal ? span.at + offset : (span.start + span.end) / 2, .07, 0, "house-roof");
  }
  return b.finish().filter(m => m.metadata.exteriorLayer === "house-roof");
}
