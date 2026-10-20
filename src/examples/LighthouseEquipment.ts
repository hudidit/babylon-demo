import { RawTexture, Texture, ShaderMaterial } from "@babylonjs/core/pure";
import type { Mesh, PBRMaterial, Scene } from "@babylonjs/core/pure";
import { CoastalBatch } from "./CoastalLandmark";
import type { CoastalMaterials } from "./CoastalMaterials";
import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE } from "./LighthouseLayout";
import { planToWorld } from "./HouseLayout";
import { LIGHTHOUSE_EQUIPMENT, LIGHTHOUSE_EQUIPMENT_BOXES, LIGHTHOUSE_SERVICE_ROOM, LIGHTHOUSE_SOLAR_RACK, LIGHTHOUSE_BACKUP_MOUNT, LIGHTHOUSE_SENSOR } from "./LighthouseEquipmentLayout";
import type { LighthouseEquipmentId } from "./LighthouseEquipmentLayout";
import { lighthouseEquipmentPixels } from "./LighthouseRecords";
import type { InteractiveDevice } from "./RoomInteractions";
import type { LighthouseMaintenanceSnapshot } from "./LighthouseMaintenance";

/** Fixed equipment, local surface feedback and a separate interlocked backup source. */
export class LighthouseEquipment {
  readonly devices: readonly InteractiveDevice[];
  readonly meshes: readonly Mesh[];
  readonly backupMaterial: ShaderMaterial;
  private visualKey = "";
  private disposed = false;
  constructor(scene: Scene, surfaces: CoastalMaterials, retain: (mesh: Mesh, layer: "landmark") => Mesh) {
    const tower = COASTAL_SITE.tower, room = LIGHTHOUSE_SERVICE_ROOM, solar = LIGHTHOUSE_SOLAR_RACK, backup = LIGHTHOUSE_BACKUP_MOUNT;
    const existing = (name: string) => scene.getMaterialByName(name) as PBRMaterial;
    const materials = { paint: existing("coastal-lighthouse-door"), metal: existing("coastal-painted-metal"),
      plaster: existing("coastal-lighthouse-plaster"), brass: existing("coastal-lantern-brass"),
      solar: surfaces.solid("coastal-lighthouse-solar-cells", "#253e53", .48),
      labels: surfaces.solid("coastal-lighthouse-equipment-print", "#ffffff", .9) };
    const atlas = lighthouseEquipmentPixels(), texture = RawTexture.CreateRGBATexture(atlas.pixels, atlas.width, atlas.height,
      scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    texture.name = "lighthouse-original-equipment-signs"; texture.gammaSpace = true; texture.anisotropicFilteringLevel = 8;
    surfaces.textures.push(texture); materials.labels.albedoTexture = texture;
    const batch = new CoastalBatch(scene, (mesh, layer) => {
      retain(mesh, layer as "landmark"); mesh.metadata.lighthouseEquipment = true; return mesh;
    });
    const group = (id: string, finish: keyof typeof materials) => `coastal-lighthouse-equipment-${id.replace("lighthouse-", "")}-${finish}`;
    const box = (id: string, finish: keyof typeof materials, width: number, height: number, depth: number, x: number, y: number, bottom: number) =>
      batch.box(group(id, finish), materials[finish], width, height, depth, tower.x + x, tower.y + y, bottom + height / 2);
    for (const part of LIGHTHOUSE_EQUIPMENT_BOXES) box(part.id, part.finish, part.width, part.height, part.depth, part.x, part.y, part.bottom);
    // Cabinet joins and closed handles stay inside the cabinet's protected footprint.
    box("lighthouse-battery-main", "metal", .56, .022, .015, 1.72, -.207, LIGHTHOUSE.floor + 1.29);
    for (const height of [.63, 1.04]) box("lighthouse-battery-main", "metal", .035, .13, .02, 1.95, -.217, LIGHTHOUSE.floor + height);
    box("lighthouse-solar-charger", "paint", .09, .035, .014, 1.91, -.237, LIGHTHOUSE.floor + 1.43);
    box("lighthouse-drive-hatch", "brass", .016, .1, .014, .235, -.322, LIGHTHOUSE.gallery + .56);
    // The backup has its own 360-degree source; it does not reuse the main directional optic.
    batch.cylinder(group("lighthouse-beacon-backup", "solar"), materials.solar, tower.x + backup.x, tower.y + backup.y,
      backup.lensBottom, backup.lensHeight, .25, .25, 24);
    batch.cylinder(group("lighthouse-beacon-backup", "metal"), materials.metal, tower.x + backup.x, tower.y + backup.y,
      backup.lensBottom + backup.lensHeight, .08, .35, .26, 24);
    // A south-facing tilted panel is one solid plate, with physical cell dividers on the same slope.
    const slope = (y: number) => solar.floor + solar.low + solar.rise * (1 - ((y - solar.y) / solar.depth + .5));
    const slopedQuad = (name: string, finish: "solar" | "metal", x0: number, x1: number, y0: number, y1: number, offset: number) => {
      const positions: number[] = [];
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
        const p = planToWorld({ x: tower.x + x, y: tower.y + y }, slope(y) + offset); positions.push(p.x, p.y, p.z);
      }
      batch.geometry(group(name, finish), materials[finish], { positions, indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1, 0, 1, 1, 0, 1] });
    };
    const x0 = solar.x - solar.width / 2, x1 = solar.x + solar.width / 2, y0 = solar.y - solar.depth / 2, y1 = solar.y + solar.depth / 2;
    slopedQuad("lighthouse-solar-array", "solar", x0, x1, y0, y1, 0);
    // Underside closes the plate, rather than disappearing when viewed from the service side.
    slopedQuad("lighthouse-solar-array", "metal", x1, x0, y0, y1, -.035);
    for (let i = 0; i <= 8; i++) slopedQuad("lighthouse-solar-array", "metal", x0 + (x1 - x0) * i / 8 - .009,
      x0 + (x1 - x0) * i / 8 + .009, y0, y1, .004);
    for (let i = 1; i < 4; i++) slopedQuad("lighthouse-solar-array", "metal", x0, x1,
      y0 + (y1 - y0) * i / 4 - .006, y0 + (y1 - y0) * i / 4 + .006, .004);
    box("lighthouse-solar-array", "metal", .74, .23, .025, solar.x, y1 + .034, solar.floor + .335);
    box("lighthouse-solar-array", "metal", .04, .34, .04, solar.x, y1 + .015, solar.floor + .02);
    // Open ventilation slots and exhaust outlet make the separate engine room legible.
    for (const side of [-1, 1]) {
      for (let row = 0; row < 5; row++) box("lighthouse-generator-room", "paint", .16, .045, .72,
        room.x + side * (room.width / 2 - room.wall / 2), room.y, room.floor + 1.31 + row * .11);
    }
    for (let i = 0; i < 6; i++) box("lighthouse-generator", "metal", .34, .027, .014,
      room.x + .3, room.y + .251, room.floor + .18 + i * .055);
    box("lighthouse-generator", "metal", .22, .04, .17, room.x + .32, room.y + 1.36, room.floor + 2.75);
    // One small fixed detector shares the last atlas row, including its closed body.
    const sensor = LIGHTHOUSE_SENSOR;
    const detector = batch.box(group("lighthouse-light-sensor", "labels"), materials.labels, sensor.width, sensor.height, sensor.depth,
      tower.x + sensor.x, tower.y + sensor.y, sensor.bottom + sensor.height / 2);
    const detectorUV = detector.getVerticesData("uv")!;
    for (let i = 1; i < detectorUV.length; i += 2) detectorUV[i] = (7 + detectorUV[i]) / 8;
    detector.setVerticesData("uv", detectorUV);
    // Plaques share device identities with the meshes, local UI and collision definitions.
    LIGHTHOUSE_EQUIPMENT.forEach((device, index) => {
      const sign = device.sign, tx = -sign.ny, ty = sign.nx, positions: number[] = [];
      for (const [along, height] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
        const p = planToWorld({ x: tower.x + sign.x + tx * along * sign.width / 2,
          y: tower.y + sign.y + ty * along * sign.width / 2 }, sign.bottom + height * sign.height); positions.push(p.x, p.y, p.z);
      }
      batch.geometry(group(device.id, "labels"), materials.labels, { positions, indices: [0, 1, 2, 0, 2, 3],
        uvs: [0, (index + 1) * 64 / 512, 1, (index + 1) * 64 / 512, 1, index * 64 / 512, 0, index * 64 / 512] });
    });
    this.meshes = batch.finish();
    this.devices = LIGHTHOUSE_EQUIPMENT.map(device => {
      const meshes = this.meshes.filter(mesh => Object.keys(materials).some(finish => mesh.name === group(device.id, finish as keyof typeof materials)));
      meshes.forEach(mesh => {mesh.metadata.equipmentId = device.id; mesh.metadata.equipmentParent = device.parent;});
      return Object.freeze({ id: device.id, label: device.label, meshes });
    });
    this.backupMaterial = new ShaderMaterial("lighthouse-backup-white-flash", scene, {
      vertexSource: `attribute vec3 position; uniform mat4 world, viewProjection;
        #include<clipPlaneVertexDeclaration>
        void main(){vec4 worldPos=world*vec4(position,1.);gl_Position=viewProjection*worldPos;
          #include<clipPlaneVertex>
        }`,
      fragmentSource: `precision highp float; uniform float flash;
        #include<clipPlaneFragmentDeclaration>
        void main(){
          #include<clipPlaneFragment>
          gl_FragColor=vec4(mix(vec3(.014,.024,.033),vec3(24.),flash),1.);
        }`
    }, {attributes: ["position"], uniforms: ["world", "viewProjection", "flash"], useClipPlane: true});
    this.backupMaterial.setFloat("flash", 0);
    this.device("lighthouse-beacon-backup")!.meshes.find(m => m.name.endsWith("-solar"))!.material = this.backupMaterial;
  }
  device(id: LighthouseEquipmentId) { return this.devices.find(device => device.id === id); }
  apply(state: LighthouseMaintenanceSnapshot) {
    if (this.disposed) return;
    this.backupMaterial.setFloat("flash", state.backupFlash ? 1 : 0);
    const key = `${state.sensorDirty}:${state.solarDirty}:${state.mainIsolated}:${state.chargeIsolated}`;
    if (key === this.visualKey) return; this.visualKey = key;
    for (const [id, dirty] of [["lighthouse-light-sensor", state.sensorDirty], ["lighthouse-solar-array", state.solarDirty],
      ["lighthouse-drive-hatch", state.mainIsolated], ["lighthouse-solar-charger", state.chargeIsolated]] as const) {
      for (const mesh of this.device(id)!.meshes) {
        const color = dirty ? id === "lighthouse-solar-array" ? [1.6, 1.1, .46, 1] : [.65, .42, .16, 1] : [1, 1, 1, 1];
        const values: number[] = []; for (let i = 0; i < mesh.getTotalVertices(); i++) values.push(...color);
        mesh.setVerticesData("color", values);
      }
    }
  }
  dispose() { if (!this.disposed) {this.disposed = true; this.backupMaterial.dispose(false, false);} }
}
