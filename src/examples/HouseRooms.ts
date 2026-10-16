import { HOUSE_LAYOUT_VERSION, HOUSE_ROOMS, houseRoomAt, worldToPlan } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";

export type HouseRoomState = "planned" | "shell" | "furnishing" | "ready" | "error";
export type RoomBuild = Readonly<{ id: HouseRoomId; generation: number }>;
type RoomRecord = { generation: number; state: HouseRoomState; error?: string };
type OwnedResource = { owners: Set<HouseRoomId>; dispose: () => void };

/** Per-scene content ownership; layout/version and content readiness are separate. */
export class HouseRooms {
  private readonly entries = new Map<HouseRoomId, RoomRecord>();
  private readonly resources = new Map<object, OwnedResource>();
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  readonly cleanupErrors: unknown[] = [];

  constructor(readonly layoutVersion = HOUSE_LAYOUT_VERSION,
    private readonly locate: (position: { x: number; z: number }) => HouseRoomId | undefined = position => {
      const point = worldToPlan(position); return houseRoomAt(point.x, point.y)?.id;
    }) {
    HOUSE_ROOMS.forEach(room => this.entries.set(room.id, { generation: 0, state: "planned" }));
  }

  snapshot(id: HouseRoomId) { return { ...this.entry(id), layoutVersion: this.layoutVersion }; }
  isReadyForLayout(id: HouseRoomId, version = HOUSE_LAYOUT_VERSION) {
    return this.layoutVersion === version && this.entry(id).state === "ready";
  }
  contentRoomIds() {
    return HOUSE_ROOMS.filter(room => this.entry(room.id).state === "ready"
      || this.layoutVersion !== HOUSE_LAYOUT_VERSION && this.entry(room.id).state !== "planned"
        && Array.from(this.resources.values()).some(resource => resource.owners.has(room.id))).map(room => room.id);
  }
  roomAt(position: { x: number; z: number }) { return this.locate(position); }
  subscribe(listener: () => void) {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }

  begin(id: HouseRoomId): RoomBuild {
    if (this.disposed) throw new Error("House room registry disposed");
    this.release(id);
    this.entry(id).state = "furnishing";
    this.changed();
    return Object.freeze({ id, generation: this.entry(id).generation });
  }
  isCurrent(build: RoomBuild) { return !this.disposed && this.entry(build.id).generation === build.generation; }
  setState(build: RoomBuild, state: "shell" | "ready") {
    if (!this.isCurrent(build) || this.entry(build.id).state === "error") return false;
    this.entry(build.id).state = state; this.changed(); return true;
  }
  fail(build: RoomBuild, error: unknown) {
    if (!this.isCurrent(build)) return false;
    Object.assign(this.entry(build.id), { state: "error", error: String(error) });
    this.changed(); return true;
  }

  /** A stale asynchronous result is disposed immediately. Shared resources have explicit owners. */
  own(builds: RoomBuild | readonly RoomBuild[], resource: object, dispose: () => void) {
    const active = (Array.isArray(builds) ? builds : [builds]).filter(build => this.isCurrent(build));
    if (!active.length) { if (!this.resources.has(resource)) this.clean(dispose); return false; }
    let record = this.resources.get(resource);
    if (!record) { record = { owners: new Set(), dispose }; this.resources.set(resource, record); }
    active.forEach(build => record!.owners.add(build.id));
    return true;
  }
  release(id: HouseRoomId) {
    const entry = this.entry(id);
    entry.generation++; entry.state = "planned"; entry.error = undefined;
    // Reverse acquisition order: children/actions before their room root.
    for (const [resource, record] of Array.from(this.resources).reverse()) {
      if (!record.owners.delete(id) || record.owners.size) continue;
      this.resources.delete(resource); this.clean(record.dispose);
    }
    this.changed();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    HOUSE_ROOMS.forEach(room => this.release(room.id));
    this.listeners.clear();
  }
  private entry(id: HouseRoomId) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown house room: " + id);
    return entry;
  }
  private changed() { this.listeners.forEach(listener => listener()); }
  private clean(dispose: () => void) {
    try { dispose(); } catch (error) { this.cleanupErrors.push(error); }
  }
}
