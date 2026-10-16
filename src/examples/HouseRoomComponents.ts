import { HOUSE_COORDINATES, roomLocalToWorld } from "./HouseLayout";
import type { HouseRoomId, PlanPoint } from "./HouseLayout";
import type { RoomFurnishings } from "./RoomFurnishings";
import { Plane, Vector3 } from "@babylonjs/core/pure";

type Triple = [number, number, number];
const u = HOUSE_COORDINATES.unitsPerMeter;
/** Component dimensions and anchors are metres; only this boundary converts to engine units. */
export const metres = (x: number, y: number, z: number): Triple =>
  [x, y, z].map(n => n * HOUSE_COORDINATES.unitsPerMeter) as Triple;
export function localPosition(id: HouseRoomId, point: PlanPoint, height = 0): Triple {
  const p = roomLocalToWorld(id, point, height); return [p.x, p.y, p.z];
}

export function bedroomBed(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, width: number, yaw = 0, cover = "moss") {
  return room.section(id, id + "-bed", () => {
    const root = room.group(id + "-bed-root", localPosition(id, at), yaw);
    const box = (name: string, size: Triple, p: Triple, material: string) => room.box(name, metres(...size), metres(...p), material, root);
    for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) for (const z of [-0.83, 0.83])
      box("bed-frame-foot", [0.1, 0.2, 0.1], [x, 0.1, z], "darkWood");
    box("bed-frame-base", [width + 0.1, 0.22, 2.13], [0, 0.26, 0], "wood");
    room.paddedBox("bed-mattress", metres(width, 0.23, 2.03), metres(0, 0.47, 0), "cream", root);
    room.paddedBox("bed-headboard", metres(width + 0.2, 1.13, 0.13), metres(0, 0.665, -1.075), "cushion", root);
    for (let x = -width / 2 + 0.15; x < width / 2; x += 0.3)
      box("bed-headboard-seam", [0.008, 0.8, 0.016], [x, 0.73, -1.002], "cream");
    room.paddedBox("bed-duvet", metres(width + 0.04, 0.13, 1.53), metres(0, 0.61, 0.24), "cream", root);
    room.paddedBox("bed-folded-throw", metres(width + 0.07, 0.055, 0.58), metres(0, 0.7, 0.66), cover, root);
    for (const side of [-1, 1]) {
      const pillow = room.paddedBox("bed-pillow", metres(width * 0.41, 0.15, 0.42), metres(side * width * 0.24, 0.65, -0.66), "cream", root);
      pillow.rotation.y = side * 0.045;
      room.paddedBox("bed-accent-pillow", metres(0.4, 0.17, 0.29), metres(side * width * 0.24, 0.72, -0.42), cover, root).rotation.x = -0.22;
    }
  });
}

export function bedroomNightstand(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, yaw = 0) {
  return room.section(id, id + "-nightstand", () => {
    const root = room.group(id + "-nightstand-root", localPosition(id, at), yaw);
    room.box("nightstand-body", metres(0.52, 0.38, 0.46), metres(0, 0.32, 0), "wood", root);
    room.box("nightstand-top", metres(0.56, 0.045, 0.5), metres(0, 0.53, 0), "darkWood", root);
    for (const x of [-0.2, 0.2]) for (const z of [-0.16, 0.16])
      room.cylinder("nightstand-foot", 0.16 * u, 0.035 * u, metres(x, 0.08, z), "brass", root);
    for (const h of [0.23, 0.41]) {
      room.box("nightstand-front", metres(0.47, 0.16, 0.018), metres(0, h, 0.24), "darkWood", root);
      room.box("nightstand-handle", metres(0.12, 0.012, 0.025), metres(0, h, 0.26), "brass", root);
    }
  });
}

export function bedroomWardrobe(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, width: number, yaw = 0,
  finish: { door: string; inset: string } = { door: "paintGreen", inset: "moss" }) {
  return room.section(id, id + "-wardrobe", () => {
    const root = room.group(id + "-wardrobe-root", localPosition(id, at), yaw);
    room.box("wardrobe-plinth", metres(width - 0.08, 0.1, 0.52), metres(0, 0.05, 0), "darkWood", root);
    room.box("wardrobe-carcass", metres(width, 2.25, 0.6), metres(0, 1.225, 0), "wood", root);
    const count = Math.max(2, Math.round(width / 0.6)), leaf = width / count;
    for (let n = 0; n < count; n++) {
      const x = -width / 2 + leaf * (n + 0.5);
      room.box("wardrobe-door", metres(leaf - 0.014, 2.12, 0.045), metres(x, 1.2, 0.32), finish.door, root);
      room.box("wardrobe-inset", metres(leaf - 0.1, 1.94, 0.012), metres(x, 1.2, 0.35), finish.inset, root);
      room.cylinder("wardrobe-pull", 0.24 * u, 0.014 * u, metres(x + leaf * 0.3, 1.15, 0.39), "brass", root);
    }
    room.box("wardrobe-crown", metres(width + 0.04, 0.065, 0.65), metres(0, 2.38, 0), "darkWood", root);
  });
}

/** Cabinet, open basin, tap and supported mirror. Front faces local +Z. */
export function bathroomVanity(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, width: number, yaw = 0) {
  room.ensureBathroomMaterials();
  let mirrorPlane: Plane;
  const meshes = room.section(id, id + "-vanity", () => {
    const root = room.group(id + "-vanity-root", localPosition(id, at), yaw);
    room.box("vanity-base", metres(width - 0.06, 0.12, 0.4), metres(0, 0.06, 0), "darkWood", root);
    room.box("vanity-cabinet", metres(width, 0.64, 0.48), metres(0, 0.44, 0), "wood", root);
    for (const side of [-1, 1]) {
      room.box("vanity-front", metres(width / 2 - 0.02, 0.57, 0.025), metres(side * width / 4, 0.45, 0.25), "paintGreen", root);
      room.box("vanity-pull", metres(0.09, 0.012, 0.025), metres(side * 0.065, 0.68, 0.27), "brass", root);
    }
    room.box("vanity-counter", metres(width + 0.04, 0.055, 0.52), metres(0, 0.79, 0), "bath-porcelain", root);
    room.box("basin-bottom", metres(0.52, 0.035, 0.32), metres(0, 0.835, 0.035), "bath-porcelain", root);
    for (const x of [-0.275, 0.275]) room.box("basin-side", metres(0.045, 0.11, 0.37), metres(x, 0.875, 0.035), "bath-porcelain", root);
    for (const z of [-0.14, 0.21]) room.box("basin-rim", metres(0.52, 0.11, 0.025), metres(0, 0.875, z), "bath-porcelain", root);
    room.cylinder("basin-drain", 0.008 * u, 0.045 * u, metres(0, 0.857, 0.035), "brass", root);
    room.cylinder("basin-tap", 0.22 * u, 0.035 * u, metres(0, 0.92, -0.2), "brass", root);
    room.box("basin-spout", metres(0.045, 0.025, 0.18), metres(0, 1.025, -0.12), "brass", root);
    for (const x of [-width / 2 + 0.06, width / 2 - 0.06])
      room.box("mirror-upright", metres(0.025, 1.35, 0.025), metres(x, 1.47, -0.24), "brass", root);
    room.box("mirror-frame", metres(width - 0.02, 1.02, 0.035), metres(0, 1.61, -0.24), "brass", root);
    room.box("mirror-surface", metres(width - 0.07, 0.97, 0.012), metres(0, 1.61, -0.214), "bath-mirror", root);
    root.computeWorldMatrix(true);
    const face = Vector3.TransformCoordinates(Vector3.FromArray(metres(0, 1.61, -0.208)), root.getWorldMatrix());
    const inward = Vector3.TransformNormal(new Vector3(0, 0, -1), root.getWorldMatrix()).normalize();
    mirrorPlane = Plane.FromPositionAndNormal(face, inward);
    room.cylinder("soap-dispenser", 0.12 * u, 0.055 * u, metres(width / 2 - 0.07, 0.877, 0.1), "ceramic", root);
  });
  const mirror = meshes.find(mesh => mesh.material?.name === "bath-mirror")!;
  mirror.metadata.mirrorPlane = mirrorPlane!.asArray(); mirror.metadata.reflectionRoom = id;
  return meshes;
}

export function bathroomToilet(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, yaw = 0) {
  room.ensureBathroomMaterials();
  return room.section(id, id + "-toilet", () => {
    const root = room.group(id + "-toilet-root", localPosition(id, at), yaw);
    room.paddedBox("toilet-pedestal", metres(0.29, 0.32, 0.48), metres(0, 0.16, 0.035), "bath-porcelain", root);
    room.sphere("toilet-bowl", metres(0.39, 0.32, 0.61), metres(0, 0.3, 0.035), "bath-porcelain", root);
    room.paddedBox("toilet-seat-lid", metres(0.4, 0.045, 0.55), metres(0, 0.463, 0.06), "bath-porcelain", root);
    room.paddedBox("toilet-cistern", metres(0.37, 0.64, 0.16), metres(0, 0.36, -0.26), "bath-porcelain", root);
    room.cylinder("toilet-flush", 0.009 * u, 0.045 * u, metres(0.07, 0.687, -0.26), "brass", root);
    room.cylinder("toilet-paper-roll", 0.09 * u, 0.09 * u, metres(-0.25, 0.58, -0.18), "paper", root).rotation.z = Math.PI / 2;
  });
}

/** Open shower: fixed glass on the left, an unobstructed right-side entry, and a flush floor. */
export function bathroomShower(room: RoomFurnishings, id: HouseRoomId, at: PlanPoint, width: number, depth: number, yaw = 0) {
  room.ensureBathroomMaterials();
  return room.section(id, id + "-shower", () => {
    const root = room.group(id + "-shower-root", localPosition(id, at), yaw);
    room.box("shower-floor", metres(width, 0.012, depth), metres(0, 0.016, 0), "bath-tile", root);
    room.box("shower-drain", metres(width * 0.65, 0.004, 0.025), metres(0, 0.024, depth / 2 - 0.07), "black", root);
    const glassWidth = width - 1.08, front = -depth / 2;
    const glass = room.box("shower-fixed-glass", metres(glassWidth, 2.08, 0.012), metres(-width / 2 + glassWidth / 2, 1.06, front), "bath-glass", root);
    glass.metadata.castsShadows = false;
    for (const x of [-width / 2 + 0.012, -width / 2 + glassWidth - 0.012])
      room.box("shower-glass-edge", metres(0.018, 2.12, 0.022), metres(x, 1.06, front), "brass", root);
    room.box("shower-glass-top", metres(glassWidth, 0.018, 0.022), metres(-width / 2 + glassWidth / 2, 2.12, front), "brass", root);
    const x = width / 2 - 0.35;
    room.cylinder("shower-riser", 1.2 * u, 0.024 * u, metres(x, 1.6, depth / 2 - 0.06), "brass", root);
    room.box("shower-arm", metres(0.025, 0.025, 0.37), metres(x, 2.2, depth / 2 - 0.23), "brass", root);
    room.cylinder("shower-rain-head", 0.025 * u, 0.24 * u, metres(x, 2.18, depth / 2 - 0.4), "brass", root);
    room.box("shower-mixer", metres(0.18, 0.04, 0.07), metres(x, 1.04, depth / 2 - 0.06), "brass", root);
  });
}
