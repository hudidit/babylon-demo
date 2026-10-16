import { Color3, HemisphericLight, RenderTargetTexture, ShadowGenerator, SpotLight, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, PBRMaterial, Scene } from "@babylonjs/core/pure";
import { roomOwners, setRoomOwners } from "./RoomOwnership";
import type { HouseRoomId } from "./HouseLayout";
import { houseVector } from "./HouseWalking";

/** Room-specific window/lamp sources plus the original restrained indirect bounce. */
export class RoomLighting {
  private readonly shadows: ShadowGenerator[];
  private readonly lamps = new Map<string, { light: SpotLight; intensity: number; on: boolean;
    material?: PBRMaterial; glow?: Color3 }>();

  constructor(scene: Scene, house = false) {
    const fill = new HemisphericLight("room-bounce-light", new Vector3(-0.35, 1, 0.15), scene);
    fill.intensity = house ? 0.38 : 0.18;
    fill.diffuse = new Color3(0.95, 0.97, 1);
    fill.groundColor = new Color3(0.68, 0.62, 0.53);
    fill.specular = Color3.Black();

    // Place daylight just in front of the garden window, rather than shining through opaque walls.
    const daylight = new SpotLight("window-daylight", new Vector3(-18.85, 5.6, 9),
      new Vector3(1, -0.35, -0.25).normalize(), Math.PI / 1.5, 1, scene);
    daylight.innerAngle = Math.PI / 2;
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 3.5;
    daylight.range = 55;

    // Emit below the shades so the closed shade meshes cannot occlude their own bulbs.
    const reading = new SpotLight("reading-lamp-light", new Vector3(16, 1.48, 5),
      new Vector3(-0.55, -1, 0.5).normalize(), Math.PI / 1.8, 1.5, scene);
    reading.innerAngle = Math.PI / 2.4;
    reading.diffuse = new Color3(1, 0.85, 0.64);
    reading.intensity = 3.3;
    reading.range = 14;

    const desk = new SpotLight("banker-lamp-light", new Vector3(-0.55, 0.8, -2.65),
      new Vector3(-0.65, -1, 0.4).normalize(), Math.PI / 1.7, 1.5, scene);
    desk.innerAngle = Math.PI / 2.5;
    desk.diffuse = new Color3(1, 0.88, 0.68);
    desk.intensity = 1.25;
    desk.range = 10;
    this.lamps.set("floor-lamp", { light: reading, intensity: reading.intensity, on: true });
    this.lamps.set("desk-lamp", { light: desk, intensity: desk.intensity, on: true });

    if (house) {
      daylight.position.copyFrom(houseVector(6.9, 0.16, 2.1)); daylight.direction.set(0.15, -0.55, 1).normalize(); daylight.range = 24;
      reading.position.copyFrom(houseVector(9.9, 9.85, 1.296)); reading.direction.set(-0.6, -1, 0).normalize();
      desk.position.copyFrom(houseVector(7.39, 0.39, 0.99));
    }

    this.shadows = [daylight, reading, desk].map((light, index) => {
      setRoomOwners(light, [house && index === 1 ? "living" : "study"]);
      light.metadata.affectsShared = index === 0;
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      light.specular = light.diffuse.scale(0.65);
      // Explicit light depth bounds keep cached maps independent of the active camera.
      light.shadowMinZ = index === 0 ? 0.5 : 0.1;
      light.shadowMaxZ = index === 0 ? 48 : light.range;
      const size = index === 0 ? Math.min(house ? 2048 : 4096, scene.getEngine().getCaps().maxTextureSize) : 1024;
      const shadow = new ShadowGenerator(size, light);
      if (index === 0) {
        shadow.useContactHardeningShadow = true;
        shadow.contactHardeningLightSizeUVRatio = 0.022;
      } else {
        shadow.usePercentageCloserFiltering = true;
      }
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      // Perspective depth bias grows in world space across the room: keep small feet attached.
      shadow.bias = index === 0 ? 0.0001 : 0.00015;
      shadow.normalBias = 0.012;
      shadow.setDarkness(0);
      return shadow;
    });
  }

  addLivingRoom(scene: Scene, house = false) {
    const daylight = new SpotLight("living-window-daylight", new Vector3(48, 5.6, -18.85),
      new Vector3(-0.35, -0.38, 1).normalize(), Math.PI / 1.5, 1, scene);
    daylight.innerAngle = Math.PI / 2;
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 3.5; daylight.range = 48;
    // The emitter sits just below the shade, above the side table.
    const lamp = new SpotLight("living-table-lamp-light", new Vector3(45.2, -0.24, 9.2),
      new Vector3(-0.55, -0.85, -0.45).normalize(), Math.PI / 1.7, 1.4, scene);
    lamp.innerAngle = Math.PI / 2.4;
    lamp.diffuse = new Color3(1, 0.85, 0.64);
    lamp.intensity = 2.4; lamp.range = 15;
    this.lamps.set("living-lamp", { light: lamp, intensity: lamp.intensity, on: true });
    if (house) {
      daylight.position.copyFrom(houseVector(10.6, 8.4, 2.1)); daylight.direction.set(-1, -0.4, -0.1).normalize();
      lamp.position.copyFrom(houseVector(10.4, 6.15, 1.2)); lamp.direction.set(-0.5, -1, 0).normalize();
    }
    [daylight, lamp].forEach((light, index) => {
      setRoomOwners(light, ["living"]);
      light.metadata.affectsShared = true;
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      light.specular = light.diffuse.scale(0.65);
      light.shadowMinZ = index ? 0.1 : 0.5; light.shadowMaxZ = light.range;
      const shadow = new ShadowGenerator(index ? 1024 : 2048, light);
      shadow.usePercentageCloserFiltering = true;
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = index ? 0.00015 : 0.0001; shadow.normalBias = 0.012;
      this.shadows.push(shadow);
    });
  }

  bindLamp(id: string, material: PBRMaterial) {
    const lamp = this.lamps.get(id)!;
    lamp.material = material;
    lamp.glow = material.emissiveColor.clone();
  }

  isLampOn(id: string) { return this.lamps.get(id)!.on; }

  toggleLamp(id: string) {
    const lamp = this.lamps.get(id)!;
    lamp.on = !lamp.on;
    lamp.light.intensity = lamp.on ? lamp.intensity : 0;
    if (lamp.material && lamp.glow) lamp.material.emissiveColor.copyFrom(lamp.on ? lamp.glow : Color3.Black());
    this.refreshShadows(roomOwners(lamp.light));
  }

  addMeshes(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => {
      if (mesh.getTotalVertices() === 0) return;
      mesh.receiveShadows = true;
      this.shadows.forEach(shadow => {
        const light = shadow.getLight() as SpotLight;
        const owners: readonly HouseRoomId[] = mesh.metadata?.lightRooms || roomOwners(mesh);
        const matchesRoom = owners.some(id => roomOwners(light).includes(id))
          && (owners.length === 1 || light.metadata.affectsShared);
        if (!matchesRoom) {
          if (!light.excludedMeshes.includes(mesh)) light.excludedMeshes.push(mesh);
          return;
        }
        if (mesh.metadata?.castsShadows !== false) shadow.addShadowCaster(mesh, false);
      });
    });
    this.refreshShadows();
  }

  freezeShadows() {
    this.shadows.forEach(shadow => {
      shadow.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    });
    this.refreshShadows();
  }

  removeMeshes(meshes: AbstractMesh[]) {
    this.shadows.forEach(shadow => {
      const light = shadow.getLight() as SpotLight;
      meshes.forEach(mesh => {
        shadow.removeShadowCaster(mesh, false);
        const index = light.excludedMeshes.indexOf(mesh);
        if (index >= 0) light.excludedMeshes.splice(index, 1);
      });
    });
  }

  removeRoom(id: HouseRoomId) {
    for (const [lampId, lamp] of this.lamps) if (roomOwners(lamp.light).includes(id)) this.lamps.delete(lampId);
    for (let i = this.shadows.length - 1; i >= 0; i--) {
      const shadow = this.shadows[i], light = shadow.getLight();
      if (!roomOwners(light).includes(id)) continue;
      this.shadows.splice(i, 1); shadow.dispose(); light.dispose();
    }
  }

  refreshShadows(owners?: readonly HouseRoomId[]) {
    this.shadows.filter(shadow => !owners || roomOwners(shadow.getLight()).some(id => owners.includes(id)))
      .forEach(shadow => shadow.getShadowMap()!.resetRefreshCounter());
  }
}
