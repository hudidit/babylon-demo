import { Color3, Light, PBRMaterial, SpotLight, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, Scene, TransformNode } from "@babylonjs/core/pure";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";
import { HOUSE_COORDINATES } from "./HouseLayout";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The displayed sky's night weight already gates by solar elevation and blends across manual changes. */
export function scooterNightStrength(time: TimeOfDaySnapshot) {
  const t = Math.min(clamp(time.sky.starVisibility / .35), clamp((.34 - time.environment.exterior) / .14));
  return t * t * (3 - 2 * t);
}

export class CoastalScooterHeadlight {
  readonly light: SpotLight;
  private readonly materialSlots = new Map<PBRMaterial, number>();
  private readonly glow = Color3.FromHexString("#fff0d2").toLinearSpace();
  private night = 0;
  private active = false;
  private disposed = false;

  constructor(scene: Scene, front: TransformNode, private readonly lens: PBRMaterial, receivers: readonly AbstractMesh[]) {
    this.light = new SpotLight("scooter-headlight", new Vector3(0, 1.13, .1),
      new Vector3(0, -.18, 1).normalize(), 1.1, 32, scene);
    this.light.setEnabled(false);
    this.light.parent = front;
    this.light.diffuse = this.glow.clone();
    this.light.specular = this.glow.clone();
    this.light.range = 20 * HOUSE_COORDINATES.unitsPerMeter;
    this.light.falloffType = Light.FALLOFF_STANDARD;
    this.light.intensity = 0;
    // An empty Babylon inclusion list affects everything; keep the light disabled in that case.
    const interior = new Set(scene.getLightByName("lighthouse-local-work-light")?.includedOnlyMeshes);
    this.light.includedOnlyMeshes = receivers.filter(mesh => mesh.metadata?.exterior
      && ["terrain", "cliff", "foundation", "rocks", "vegetation", "path", "landmark", "house-roof"].includes(mesh.metadata?.exteriorLayer)
      && !mesh.metadata?.lighthouseInteriorStructure && !mesh.metadata?.lighthouseDetail && !interior.has(mesh)
      && mesh.material instanceof PBRMaterial);
    for (const mesh of this.light.includedOnlyMeshes) {
      const material = mesh.material as PBRMaterial;
      if (!this.materialSlots.has(material)) this.materialSlots.set(material, material.maxSimultaneousLights);
      material.maxSimultaneousLights = Math.max(2, material.maxSimultaneousLights);
    }
  }

  applyTimeOfDay(time: TimeOfDaySnapshot) { this.night = scooterNightStrength(time); this.refresh(); }
  setActive(active: boolean) { this.active = active; this.refresh(); }

  private refresh() {
    if (this.disposed) return;
    const strength = this.active && this.light.includedOnlyMeshes.length ? this.night : 0;
    if (this.light.isEnabled() !== (strength > 0)) this.light.setEnabled(strength > 0);
    this.light.intensity = 8 * strength;
    this.glow.scaleToRef(1.5 * strength, this.lens.emissiveColor);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.light.dispose();
    this.lens.emissiveColor.set(0, 0, 0);
    for (const [material, slots] of this.materialSlots) material.maxSimultaneousLights = slots;
    this.materialSlots.clear();
  }
}
