import { Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, Mesh, Ray, Scene, TransformNode } from "@babylonjs/core/pure";

export type InteractiveDrawer = {
  id: string; label: string; root: TransformNode; meshes: AbstractMesh[]; travel: Vector3;
};
export type InteractiveLamp = { id: string; label: string; meshes: AbstractMesh[] };
export type InspectableItem = { id: string; label: string; mesh: Mesh; displayRotation: Vector3 };
type Action = { label: () => string; toggle: () => void };

/** Explicit picking also includes non-pickable static furniture, so it can occlude an action. */
export const interactionSurface = (mesh: AbstractMesh) =>
  mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.getTotalVertices() > 0 && !mesh.metadata?.inspectionPreview;

export class RoomInteractions {
  private readonly actions = new Map<AbstractMesh, Action>();
  private readonly drawers: {
    root: TransformNode; closed: Vector3; travel: Vector3; progress: number; open: boolean;
  }[] = [];

  constructor(private readonly scene: Scene, private readonly refreshShadows: () => void) {}

  addDrawer(drawer: InteractiveDrawer) {
    const state = { root: drawer.root, closed: drawer.root.position.clone(), travel: drawer.travel,
      progress: 0, open: false };
    this.drawers.push(state);
    this.add(drawer.id, drawer.meshes, {
      label: () => `${state.open ? "关上" : "打开"}${drawer.label}`,
      toggle: () => { state.open = !state.open; },
    });
  }

  addLamp(lamp: InteractiveLamp, isOn: () => boolean, toggle: () => void) {
    this.add(lamp.id, lamp.meshes, { label: () => `${isOn() ? "关闭" : "打开"}${lamp.label}`, toggle });
  }

  addInspectable(item: InspectableItem, inspect: (item: InspectableItem) => void) {
    this.add(item.id, [item.mesh], { label: () => `查看${item.label}`, toggle: () => inspect(item) });
  }

  private add(id: string, meshes: AbstractMesh[], action: Action) {
    meshes.forEach(mesh => {
      mesh.metadata = { ...mesh.metadata, interactionId: id };
      this.actions.set(mesh, action);
    });
  }

  pick(ray: Ray) {
    const hit = this.scene.pickWithRay(ray, interactionSurface);
    return hit?.pickedMesh && hit.distance <= ray.length ? this.actions.get(hit.pickedMesh) : undefined;
  }

  /** Fixed travel time; reversing an in-flight drawer preserves its current position. */
  update(deltaSeconds: number) {
    let changed = false;
    const step = Math.max(0, Math.min(deltaSeconds, 0.05)) / 0.45;
    for (const drawer of this.drawers) {
      const target = drawer.open ? 1 : 0;
      if (drawer.progress === target) continue;
      drawer.progress = target > drawer.progress ? Math.min(target, drawer.progress + step)
        : Math.max(target, drawer.progress - step);
      const eased = drawer.progress * drawer.progress * (3 - 2 * drawer.progress);
      drawer.root.position.copyFrom(drawer.closed).addInPlace(drawer.travel.scale(eased));
      drawer.root.computeWorldMatrix(true);
      drawer.root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      changed = true;
    }
    if (changed) this.refreshShadows();
  }
}

/** The shipped model's conversion root retains +Z as the visible drawer-front direction. */
export function cabinetDrawers(meshes: AbstractMesh[]): InteractiveDrawer[] {
  return ["03", "02", "01"].map((suffix, index) => {
    const root = meshes.find(mesh => mesh.name === `GothicCommode_01_door${suffix}`);
    if (!root) throw new Error(`Cabinet drawer missing: ${suffix}`);
    const parts = [root, ...root.getChildMeshes()];
    parts.forEach(mesh => mesh.unfreezeWorldMatrix());
    return { id: `cabinet-drawer-${index + 1}`, label: `古董柜${["下", "中", "上"][index]}层抽屉`,
      root, meshes: parts, travel: new Vector3(0, 0, 0.38) };
  });
}
