import { HOUSE_COORDINATES, houseRoom } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";
import { localPosition, metres } from "./HouseRoomComponents";
import type { RoomFurnishings } from "./RoomFurnishings";
import type { PBRMaterial } from "@babylonjs/core/pure";

/** Metre-based fixtures and emitters share one placement; IDs also identify their switches. */
export const HOUSE_CEILING_LIGHTS: readonly Readonly<{
  room: HouseRoomId; id: string; label: string; diameter: number; intensity: number;
}>[] = [
  { room: "living", id: "living-ceiling-lamp", label: "客厅吸顶灯", diameter: .9, intensity: 4 },
  { room: "master", id: "master-ceiling-lamp", label: "主卧吸顶灯", diameter: .7, intensity: 3.2 },
  { room: "bedroom", id: "bedroom-ceiling-lamp", label: "次卧吸顶灯", diameter: .65, intensity: 3 },
  { room: "study", id: "study-ceiling-lamp", label: "书房吸顶灯", diameter: .55, intensity: 2.7 },
];

export function ceilingLampPosition(room: HouseRoomId, height: number) {
  const bounds = houseRoom(room);
  return localPosition(room, { x: bounds.width / 2, y: bounds.depth / 2 }, height);
}

export function furnishHouseCeilingLights(furniture: RoomFurnishings) {
  const u = HOUSE_COORDINATES.unitsPerMeter;
  for (const lamp of HOUSE_CEILING_LIGHTS) furniture.section(lamp.room, lamp.id, () => {
    const root = furniture.fixtureLamp(lamp.id, lamp.label,
      ceilingLampPosition(lamp.room, HOUSE_COORDINATES.clearHeight - .02), (root, glow) => {
        furniture.cylinder("ceiling-lamp-mount", .04 * u, lamp.diameter * .88 * u, metres(0, 0, 0), "brass", root);
        furniture.ring("ceiling-lamp-rim", (lamp.diameter - .02) * u, .025 * u, metres(0, -.085, 0), "brass", root);
        const diffuser = furniture.cylinder("ceiling-lamp-diffuser", .066 * u,
          (lamp.diameter - .035) * u, metres(0, -.06, 0), glow, root);
        const material = diffuser.material as PBRMaterial;
        material.albedoColor.set(.83, .81, .74);
        material.emissiveColor.set(.65, .59, .45);
      });
    root.metadata = { ...root.metadata, ceilingFixture: true };
  });
}
