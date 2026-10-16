import { Matrix, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, Mesh, Ray, Scene, TransformNode } from "@babylonjs/core/pure";
import type { AudioCue, RoomAudioEvent } from "./RoomAudioCatalog";
import { roomOwners } from "./RoomOwnership";
import type { HouseRoomId } from "./HouseLayout";

export type InteractiveDrawer = {
  id: string; label: string; root: TransformNode; meshes: AbstractMesh[]; travel: Vector3;
};
export type InteractiveLamp = { id: string; label: string; meshes: AbstractMesh[] };
export type InteractiveDoor = { id: string; label: string; root: TransformNode;
  meshes: AbstractMesh[]; width: number; openAngle: number; walkerRadius?: number };
export type InspectableItem = { id: string; label: string; mesh: Mesh; displayRotation: Vector3 };
type Action = { label: () => string; toggle: () => void };

/** Explicit picking also includes non-pickable static furniture, so it can occlude an action. */
export const interactionSurface = (mesh: AbstractMesh) =>
  mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.getTotalVertices() > 0 && !mesh.metadata?.inspectionPreview;

export class RoomInteractions {
  private readonly actions = new Map<AbstractMesh, Action>();
  private readonly entities = new Map<string, { meshes: AbstractMesh[]; owners: Set<HouseRoomId> }>();
  private readonly drawers: {
    drawer: InteractiveDrawer; root: TransformNode; closed: Vector3; travel: Vector3; progress: number; open: boolean; moving: boolean;
  }[] = [];
  private readonly doors: { door: InteractiveDoor; progress: number; open: boolean; blocked: boolean; moving: boolean }[] = [];

  constructor(private readonly scene: Scene, private readonly refreshShadows: (owners?: readonly HouseRoomId[]) => void,
    private readonly walkerPosition: () => Vector3 | undefined = () => undefined,
    private readonly audio: (event: RoomAudioEvent) => void = () => {}) {}

  private sound(cue: AudioCue | "stop", entity: { id: string; meshes: AbstractMesh[] }) {
    this.audio({ cue, entity: entity.id, position: () => {
      const mesh = entity.meshes[0];
      mesh.computeWorldMatrix(true);
      return mesh.getBoundingInfo().boundingBox.centerWorld;
    } });
  }

  /** Interrupt motion on view/modal/lifecycle changes; it can resume from its real position. */
  silenceMotion() {
    for (const state of this.drawers) { state.moving = false; this.sound("stop", state.drawer); }
    for (const state of this.doors) { state.moving = false; this.sound("stop", state.door); }
  }

  addDoor(door: InteractiveDoor) {
    if (this.entities.has(door.id)) throw new Error("Duplicate interaction: " + door.id);
    const state = { door, progress: 0, open: false, blocked: false, moving: false };
    this.doors.push(state);
    this.add(door.id, door.meshes, {
      label: () => state.blocked ? "让开门口 · 点击反向开合" : `${state.open ? "关闭" : "打开"}${door.label}`,
      toggle: () => { this.sound("stop", door); state.moving = false; state.open = !state.open; state.blocked = false; },
    });
  }

  addDrawer(drawer: InteractiveDrawer) {
    if (this.entities.has(drawer.id)) throw new Error("Duplicate interaction: " + drawer.id);
    const state = { drawer, root: drawer.root, closed: drawer.root.position.clone(), travel: drawer.travel,
      progress: 0, open: false, moving: false };
    this.drawers.push(state);
    this.add(drawer.id, drawer.meshes, {
      label: () => `${state.open ? "关上" : "打开"}${drawer.label}`,
      toggle: () => { this.sound("stop", drawer); state.moving = false; state.open = !state.open; },
    });
  }

  addLamp(lamp: InteractiveLamp, isOn: () => boolean, toggle: () => void) {
    this.add(lamp.id, lamp.meshes, { label: () => `${isOn() ? "关闭" : "打开"}${lamp.label}`,
      toggle: () => { const before = isOn(); toggle(); if (before !== isOn()) this.sound("switch", lamp); } });
  }

  addInspectable(item: InspectableItem, inspect: (item: InspectableItem) => void) {
    this.add(item.id, [item.mesh], { label: () => `查看${item.label}`, toggle: () => inspect(item) });
  }

  private add(id: string, meshes: AbstractMesh[], action: Action) {
    if (this.entities.has(id)) throw new Error("Duplicate interaction: " + id);
    this.entities.set(id, { meshes, owners: new Set(meshes.reduce<HouseRoomId[]>((ids, mesh) => [...ids, ...roomOwners(mesh)], [])) });
    meshes.forEach(mesh => {
      mesh.metadata = { ...mesh.metadata, interactionId: id };
      this.actions.set(mesh, action);
    });
  }

  removeRoom(id: HouseRoomId) {
    for (const [entityId, entity] of this.entities) {
      if (entity.owners.delete(id) && !entity.owners.size) this.remove(entityId);
    }
  }

  remove(id: string) {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.audio({ cue: "stop", entity: id });
    entity.meshes.forEach(mesh => this.actions.delete(mesh));
    for (let i = this.drawers.length - 1; i >= 0; i--) if (this.drawers[i].drawer.id === id) this.drawers.splice(i, 1);
    for (let i = this.doors.length - 1; i >= 0; i--) if (this.doors[i].door.id === id) this.doors.splice(i, 1);
    this.entities.delete(id);
  }

  pick(ray: Ray) {
    const hit = this.scene.pickWithRay(ray, interactionSurface);
    return hit?.pickedMesh && hit.distance <= ray.length ? this.actions.get(hit.pickedMesh) : undefined;
  }

  /** Fixed travel time; reversing an in-flight drawer preserves its current position. */
  update(deltaSeconds: number) {
    const changed = new Set<HouseRoomId>();
    const step = Math.max(0, Math.min(deltaSeconds, 0.05)) / 0.45;
    for (const drawer of this.drawers) {
      const target = drawer.open ? 1 : 0;
      if (drawer.progress === target) continue;
      if (step <= 0) continue;
      if (!drawer.moving) { drawer.moving = true; this.sound("drawer-slide", drawer.drawer); }
      drawer.progress = target > drawer.progress ? Math.min(target, drawer.progress + step)
        : Math.max(target, drawer.progress - step);
      const eased = drawer.progress * drawer.progress * (3 - 2 * drawer.progress);
      drawer.root.position.copyFrom(drawer.closed).addInPlace(drawer.travel.scale(eased));
      drawer.root.computeWorldMatrix(true);
      drawer.root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      if (drawer.progress === target) {
        drawer.moving = false; this.sound("stop", drawer.drawer); this.sound("drawer-stop", drawer.drawer);
      }
      roomOwners(drawer.root).forEach(id => changed.add(id));
    }
    for (const state of this.doors) {
      const target = state.open ? 1 : 0;
      if (state.progress === target) continue;
      const step = Math.max(0, Math.min(deltaSeconds, 0.05)) / 0.7;
      if (step <= 0) continue;
      const next = state.open ? Math.min(1, state.progress + step) : Math.max(0, state.progress - step);
      const walker = this.walkerPosition();
      state.blocked = !!walker && !doorSweepIsClear(state.door, state.progress, next, walker);
      if (state.blocked) {
        if (state.moving) { state.moving = false; this.sound("stop", state.door); }
        continue;
      }
      if (!state.moving) { state.moving = true; this.sound("door-move", state.door); }
      state.progress = next;
      const eased = next * next * (3 - 2 * next);
      const { root, openAngle } = state.door;
      root.rotation.y = openAngle * eased;
      root.computeWorldMatrix(true);
      root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      if (next === target) {
        state.moving = false; this.sound("stop", state.door);
        if (!state.open) this.sound("door-latch", state.door);
      }
      roomOwners(state.door.root).forEach(id => changed.add(id));
    }
    if (changed.size) this.refreshShadows([...changed]);
  }
}

/** Sample the entire angular step so a fast frame cannot skip across the walker. */
export function doorSweepIsClear(door: InteractiveDoor, from: number, to: number, walker: Vector3) {
  const ease = (value: number) => value * value * (3 - 2 * value);
  const hinge = door.root.position;
  // The mounting parent owns the fixed world yaw; the leaf only owns its changing local yaw.
  const localWalker = door.root.parent ? Vector3.TransformCoordinates(walker,
    Matrix.Invert(door.root.parent.computeWorldMatrix(true))) : walker;
  const start = door.openAngle * ease(from), end = door.openAngle * ease(to);
  const steps = Math.max(1, Math.ceil(Math.abs(end - start) / 0.04));
  const squaredGap = (angle: number) => {
    const dx = localWalker.x - hinge.x, dz = localWalker.z - hinge.z;
    const x = dx * Math.cos(angle) - dz * Math.sin(angle);
    const z = dx * Math.sin(angle) + dz * Math.cos(angle);
    // Include handles and a small margin around the camera's 0.65 horizontal ellipsoid.
    const gapX = Math.max(0, Math.abs(x) - 0.5);
    const gapZ = Math.max(0, -z, z - door.width);
    return gapX * gapX + gapZ * gapZ;
  };
  // A walker touching the closed door can open it away from themselves.
  const clearance = Math.min((door.walkerRadius ?? 0.75) ** 2, squaredGap(start)) - 1e-8;
  for (let i = 1; i <= steps; i++) {
    if (squaredGap(start + (end - start) * i / steps) < clearance) return false;
  }
  return true;
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
