import { HOUSE_COORDINATES } from "./HouseLayout";
import type { RoomFurnishings } from "./RoomFurnishings";
import { bathroomShower, bathroomToilet, bathroomVanity, bedroomBed, bedroomNightstand, bedroomWardrobe, localPosition, metres } from "./HouseRoomComponents";

const u = HOUSE_COORDINATES.unitsPerMeter;

/** Room-local anchors also used by lights, camera presets and collision acceptance. */
export const HOUSE_SUITE = {
  bed: { x: 1.48, y: 2.25, width: 1.8, yaw: Math.PI / 2 },
  nightstands: [{ x: 0.58, y: 1.0 }, { x: 0.58, y: 3.5 }],
  wardrobe: { x: 4.96, y: 1.65, width: 2.6, yaw: -Math.PI / 2 },
  masterLamp: { x: 0.58, y: 1.0, height: 0.555, emitterHeight: 0.91 },
  vanity: { x: 2.08, y: 0.55, width: 0.82, yaw: -Math.PI / 2 },
  toilet: { x: 0.43, y: 1.1, yaw: Math.PI / 2 },
  shower: { x: 1.2, y: 1.89, width: 2.18, depth: 0.9 },
  ensuiteLamp: { x: 1.85, y: 0.55, height: 2.18 },
};

export function furnishHouseMaster(room: RoomFurnishings) {
  const a = HOUSE_SUITE;
  bedroomBed(room, "master", a.bed, a.bed.width, a.bed.yaw);
  a.nightstands.forEach(p => bedroomNightstand(room, "master", p, Math.PI / 2));
  bedroomWardrobe(room, "master", a.wardrobe, a.wardrobe.width, a.wardrobe.yaw);
  room.section("master", "master-accessories", () => {
    // Reuse the scene's woven rug and linen instead of allocating more generated maps.
    room.ensureRugMaterial();
    room.box("persian-rug", metres(2.8, 0.008, 2.8), localPosition("master", { x: 1.85, y: 2.3 }, 0.009), "rug");
    const root = room.group("master-bedside-details", localPosition("master", a.nightstands[1], 0.555));
    room.box("bedside-book", metres(0.2, 0.025, 0.14), metres(0.02, 0.0125, 0.03), "navy", root);
    room.cylinder("bedside-water-glass", 0.1 * u, 0.06 * u, metres(-0.12, 0.05, -0.1), "ceramic", root);
    const l = a.masterLamp;
    room.fixtureLamp("master-lamp", "主卧床头灯", localPosition("master", l, l.height), (g, glow) => {
      room.cylinder("master-lamp-foot", 0.025 * u, 0.18 * u, metres(0, 0.0125, 0), "brass", g);
      room.sphere("master-lamp-body", metres(0.15, 0.25, 0.15), metres(0, 0.14, 0), "ceramic", g);
      room.cylinder("master-lamp-neck", 0.13 * u, 0.022 * u, metres(0, 0.3, 0), "brass", g);
      room.cylinder("master-lamp-shade", 0.24 * u, 0.36 * u, metres(0, 0.48, 0), glow, g, 0.24 * u);
      room.ring("master-lamp-trim", 0.36 * u, 0.008 * u, metres(0, 0.36, 0), "brass", g);
    });
  });
}

export function furnishHouseEnsuite(room: RoomFurnishings) {
  const a = HOUSE_SUITE;
  room.ensureBathroomMaterials();
  room.section("ensuite", "ensuite-tiles", () => {
    // Thin tiles remain below the walker's sole; no invisible step at the door or shower entry.
    room.box("bath-grout-bed", metres(2.3, 0.008, 2.3), localPosition("ensuite", { x: 1.2, y: 1.2 }, 0.004), "bath-grout");
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) {
      room.box("bath-floor-tile", metres(2.3 / 6 - 0.006, 0.006, 2.3 / 6 - 0.006),
        localPosition("ensuite", { x: 0.05 + (x + 0.5) * 2.3 / 6, y: 0.05 + (y + 0.5) * 2.3 / 6 }, 0.011), "bath-tile");
    }
  });
  bathroomVanity(room, "ensuite", a.vanity, a.vanity.width, a.vanity.yaw);
  bathroomToilet(room, "ensuite", a.toilet, a.toilet.yaw);
  bathroomShower(room, "ensuite", a.shower, a.shower.width, a.shower.depth);
  room.section("ensuite", "ensuite-light", () => {
    const l = a.ensuiteLamp;
    room.fixtureLamp("ensuite-lamp", "主卫镜前灯", localPosition("ensuite", l, l.height), (g, glow) => {
      room.box("ensuite-light-back", metres(0.09, 0.08, 0.65), metres(0.035, 0, 0), "brass", g);
      room.box("ensuite-light-diffuser", metres(0.05, 0.055, 0.6), metres(-0.035, 0, 0), glow, g);
    });
  });
}
