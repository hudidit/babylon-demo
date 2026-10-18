import { CreateBox, Mesh, TransformNode } from "@babylonjs/core/pure";
import type { PBRMaterial, Scene } from "@babylonjs/core/pure";
import { CoastalBatch, coastalTowerLining } from "./CoastalLandmark";
import { COASTAL_SITE } from "./CoastalSite";
import { HOUSE_COORDINATES, planToWorld } from "./HouseLayout";
import { LIGHTHOUSE } from "./LighthouseLayout";
import type { InteractiveDoor } from "./RoomInteractions";

/** Phase one: a usable maintenance room, with a closed upper floor reserved for the staircase. */
export function createLighthouseInterior(scene: Scene, retain: (mesh: Mesh, layer: "landmark") => Mesh): InteractiveDoor {
  const t = COASTAL_SITE.tower, a = LIGHTHOUSE, u = HOUSE_COORDINATES.unitsPerMeter;
  const material = (name: string) => scene.getMaterialByName(name) as PBRMaterial;
  const plaster = material("coastal-lighthouse-plaster"), stone = material("coastal-stone-paving");
  const metal = material("coastal-painted-metal"), green = material("coastal-lighthouse-door"), wood = material("coastal-weathered-timber");
  const brass = material("coastal-lantern-brass"), b = new CoastalBatch(scene, retain);
  b.geometry("coastal-lighthouse-inner-wall", plaster, coastalTowerLining(a.wallThickness));
  b.cylinder("coastal-lighthouse-ground-floor", stone, t.x, t.y, t.ground + .49, .05, 5.76, 5.76, 64);
  // A genuine closed diaphragm gives the first room a ceiling and keeps phase two visibly separate.
  const ceilingRadius = 2.8 - (a.floor - t.ground - .49 + a.clearHeight) / 15.85 * .8 - a.wallThickness;
  b.cylinder("coastal-lighthouse-ground-ceiling", plaster, t.x, t.y, a.floor + a.clearHeight, .14, ceilingRadius * 2 + .04, ceilingRadius * 2 + .04, 64);
  b.cylinder("coastal-lighthouse-service-cover", metal, t.x, t.y, a.floor + .002, .008, .88, .88, 32);
  for (const x of [-.3, .3]) b.box("coastal-lighthouse-service-hardware", brass, .12, .015, .035, t.x + x, t.y, a.floor + .018);
  for (const step of a.steps)
    b.box("coastal-lighthouse-entry-steps", stone, step.width, .16, step.depth, t.x, t.y + step.y, step.top - .08);
  b.box("coastal-lighthouse-entry-steps", stone, a.entranceHalfWidth * 2, .18, .58, t.x, t.y - 2.56, a.floor - .09);
  for (const f of a.furniture) {
    if (f.id === "cabinet") {
      b.box("coastal-lighthouse-maintenance-cabinet", green, f.width, f.height, f.depth, t.x + f.x, t.y + f.y, a.floor + f.height / 2);
      for (const offset of [-.22, .22]) b.box("coastal-lighthouse-service-hardware", brass, .035, .14, .035,
        t.x + f.x + f.width / 2 + .025, t.y + f.y + offset, a.floor + .7);
    } else {
      b.box("coastal-lighthouse-workbench", wood, f.width, .08, f.depth, t.x + f.x, t.y + f.y, a.floor + f.height - .04);
      for (const dx of [-f.width / 2 + .06, f.width / 2 - .06]) for (const dy of [-f.depth / 2 + .06, f.depth / 2 - .06])
        b.box("coastal-lighthouse-workbench-frame", metal, .055, f.height - .08, .055,
          t.x + f.x + dx, t.y + f.y + dy, a.floor + (f.height - .08) / 2);
      b.box("coastal-lighthouse-workbench", wood, f.width - .1, .045, f.depth - .06, t.x + f.x, t.y + f.y, a.floor + .21);
    }
  }
  b.finish();

  const mount = new TransformNode("lighthouse-door-mount", scene), root = new TransformNode("lighthouse-entry-door", scene);
  const origin = planToWorld({ x: t.x + .5, y: t.y + a.doorY }, a.floor + .02);
  mount.position.set(origin.x, origin.y, origin.z); mount.rotation.y = -Math.PI / 2; root.parent = mount;
  const parts: Mesh[] = [], width = u, height = 2.02 * u;
  const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, m: PBRMaterial) => {
    const mesh = CreateBox(name, { width: w * u, height: h * u, depth: d * u }, scene);
    mesh.position.set(x * u, y * u, z * u); mesh.material = m; parts.push(mesh);
  };
  part("coastal-lighthouse-entry-door", .055, height / u, 1, 0, height / u / 2, .5, green);
  for (const side of [-1, 1]) {
    for (let i = 1; i < 7; i++) part("coastal-lighthouse-door-rib", .012, 1.88, .012, side * .034, 1.03, i / 7, metal);
    part("coastal-lighthouse-door-handle", .065, .04, .16, side * .06, 1.02, .86, brass);
  }
  const meshes = [green, metal, brass].map(material => {
    const group = parts.filter(p => p.material === material), mesh = Mesh.MergeMeshes(group, true, true)!;
    mesh.name = material === green ? "coastal-lighthouse-entry-door" : material === metal ? "coastal-lighthouse-door-ribs" : "coastal-lighthouse-door-handle";
    mesh.parent = root; retain(mesh, "landmark"); mesh.unfreezeWorldMatrix(); mesh.checkCollisions = true;
    mesh.metadata.movingLighthouseDoor = true; return mesh;
  });
  return { id: "lighthouse-entry-door", label: "灯塔入口门", root, meshes, width,
    openAngle: -Math.PI / 2, walkerRadius: .26 * u + .08 };
}
