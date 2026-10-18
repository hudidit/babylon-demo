import { Color3, CreateBox, CreateCylinder, Mesh, TransformNode, VertexBuffer } from "@babylonjs/core/pure";
import type { DirectionalLight, Scene, PBRMaterial } from "@babylonjs/core/pure";
import { beveledBox } from "./RoomDetailGeometry";
import { HOUSE_COORDINATES, planToWorld } from "./HouseLayout";
import { SCOOTER, SCOOTER_PARKING, scooterSupport } from "./CoastalScooter";
import type { ScooterState } from "./CoastalScooter";
import type { CoastalMaterials } from "./CoastalMaterials";
import { walkingSurfaceAt } from "./WalkingSurface";

/** Original compact geometry. Vertex colours share two materials across all moving parts. */
export class CoastalScooterModel {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private readonly front: TransformNode;
  private readonly wheels: Mesh[] = [];
  private readonly materials: PBRMaterial[] = [];
  private disposed = false;
  constructor(private readonly scene: Scene, private readonly sun: DirectionalLight, private readonly surfaces: CoastalMaterials) {
    this.root = new TransformNode("coastal-scooter", scene);
    this.root.scaling.setAll(HOUSE_COORDINATES.unitsPerMeter);
    this.front = new TransformNode("scooter-steering", scene); this.front.parent = this.root; this.front.position.z = .56;
    const paint = surfaces.solid("scooter-enamel", "#ffffff"), dark = surfaces.solid("scooter-rubber", "#ffffff");
    for (const m of [paint, dark]) { m.albedoColor = Color3.White(); m.maxSimultaneousLights = 1; }
    paint.metallic = .22; paint.roughness = .4; dark.metallic = .05; dark.roughness = .82;
    this.materials.push(paint, dark);
    const groups = new Map<string, { parts: Mesh[]; material: PBRMaterial; parent: TransformNode }>();
    const add = (mesh: Mesh, group: string, material: PBRMaterial, color: string, parent = this.root) => {
      const c = Color3.FromHexString(color).toLinearSpace(), colors: number[] = [];
      for (let i = 0; i < mesh.getTotalVertices(); i++) colors.push(c.r, c.g, c.b, 1);
      mesh.setVerticesData(VertexBuffer.ColorKind, colors); mesh.material = material;
      if (!groups.has(group)) groups.set(group, { parts: [], material, parent });
      groups.get(group)!.parts.push(mesh); return mesh;
    };
    const box = (group: string, material: PBRMaterial, color: string, size: number[], pos: number[], parent = this.root, tilt = 0) => {
      const mesh = beveledBox(group, size, .035, scene); mesh.position.set(pos[0], pos[1], pos[2]); mesh.rotation.x = tilt;
      return add(mesh, group, material, color, parent);
    };
    const cylinder = (group: string, material: PBRMaterial, color: string, diameter: number, length: number, pos: number[], parent = this.root, axle = false) => {
      const m = CreateCylinder(group, { diameter, height: length, tessellation: 16 }, scene);
      m.position.set(pos[0], pos[1], pos[2]); if (axle) m.rotation.z = Math.PI / 2;
      return add(m, group, material, color, parent);
    };
    const green = "#788a70", cream = "#e5dfcb", black = "#303736", silver = "#a5aaa1";
    box("scooter-body", paint, green, [.46, .37, .62], [0, .48, -.39]);
    box("scooter-body", paint, green, [.45, .11, 1.05], [0, .25, -.04]);
    box("scooter-body", paint, cream, [.47, .66, .13], [0, .68, .43], this.root, -.15);
    box("scooter-body", paint, green, [.45, .14, .47], [0, .48, .5]);
    box("scooter-body", paint, "#aa6e50", [.21, .06, .035], [0, .56, -.72]);
    box("scooter-trim", dark, black, [.47, .12, .65], [0, .74, -.35]);
    box("scooter-trim", dark, "#59605a", [.37, .025, .6], [0, .32, .03]);
    cylinder("scooter-trim", dark, silver, .035, .32, [0, .19, -.33]);
    // Front assembly pivots at the fork. The complete handlebar stays inside the 65cm envelope.
    cylinder("scooter-front", paint, silver, .055, .78, [0, .74, 0], this.front);
    box("scooter-front", paint, green, [.29, .16, .14], [0, 1.13, 0], this.front);
    box("scooter-front", paint, cream, [.22, .1, .018], [0, 1.13, .08], this.front);
    box("scooter-front", paint, "#55695c", [.16, .015, .09], [0, 1.22, -.015], this.front);
    cylinder("scooter-controls", dark, silver, .03, .61, [0, 1.14, -.025], this.front, true);
    for (const x of [-.25, .25]) {
      cylinder("scooter-controls", dark, black, .052, .14, [x, 1.14, -.025], this.front, true);
      box("scooter-controls", dark, silver, [.12, .016, .022], [x, 1.13, .045], this.front);
    }
    for (const front of [false, true]) {
      const group = front ? "scooter-front-wheel" : "scooter-rear-wheel", parent = front ? this.front : this.root;
      // Model centred on its axle so spin does not orbit the wheel around the vehicle.
      cylinder(group, dark, black, SCOOTER.wheelRadius * 2, .12, [0, 0, 0], parent, true);
      cylinder(group, dark, silver, .23, .13, [0, 0, 0], parent, true);
    }
    for (const [name, g] of groups) {
      const mesh = Mesh.MergeMeshes(g.parts, true, true)!; mesh.name = name; mesh.material = g.material; mesh.parent = g.parent;
      if (name.includes("wheel")) { mesh.position.set(0, SCOOTER.wheelRadius, name.includes("rear") ? -.56 : 0); this.wheels.push(mesh); }
      mesh.metadata = { scooter: true, exterior: true, exteriorLayer: "vehicle", castsShadows: false, lightRooms: [] }; mesh.receiveShadows = true;
      mesh.isPickable = true; mesh.checkCollisions = false; this.meshes.push(mesh);
    }
    // Three subtle parking outlines on the existing support; no new texture or light.
    const markings: Mesh[] = [];
    for (const p of SCOOTER_PARKING) for (const side of [-1, 1]) for (const end of [-1, 1]) {
      for (const [w, d, x, z] of [[.025, .32, side * .52, end * .78], [.24, .025, side * .4, end * .94]]) {
        const m = CreateBox("scooter-parking-line", { width: w * 5, height: .008 * 5, depth: d * 5 }, scene);
        const offset = { x: p.x + Math.cos(p.heading) * x + Math.sin(p.heading) * z,
          y: p.y - Math.sin(p.heading) * x + Math.cos(p.heading) * z };
        const v = planToWorld(offset, walkingSurfaceAt(offset.x, offset.y)!.height + .009);
        m.position.set(v.x, v.y, v.z); m.rotation.y = p.heading; markings.push(m);
      }
    }
    const parking = Mesh.MergeMeshes(markings, true, true)!; parking.name = "scooter-parking";
    parking.material = scene.getMaterialByName("coastal-lighthouse-plaster");
    parking.metadata = { scooter: true, exterior: true, exteriorLayer: "vehicle", castsShadows: false, lightRooms: [] }; parking.isPickable = false;
    this.meshes.push(parking); this.sun.includedOnlyMeshes.push(...this.meshes);
    scene.metadata.scooter = { version: "coastal-scooter-v1", parking: SCOOTER_PARKING };
  }
  update(state: ScooterState, visible: boolean) {
    const support = scooterSupport(state); if (!support) return false;
    const p = planToWorld(state, support.height); this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(-support.pitch, state.heading, support.roll);
    this.front.rotation.y = state.steer * .32;
    for (const wheel of this.wheels) wheel.rotation.x = state.distance / SCOOTER.wheelRadius;
    this.meshes.forEach(m => m.isVisible = visible); return true;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const light of this.scene.lights) {
      light.includedOnlyMeshes = light.includedOnlyMeshes.filter(m => !this.meshes.includes(m as Mesh));
      light.excludedMeshes = light.excludedMeshes.filter(m => !this.meshes.includes(m as Mesh));
    }
    this.root.dispose(); this.meshes.forEach(m => { if (!m.isDisposed()) m.dispose(false, false); });
    this.materials.forEach(m => {
      const index = this.surfaces.materials.indexOf(m); if (index >= 0) this.surfaces.materials.splice(index, 1);
      m.dispose(false, false);
    });
  }
}
