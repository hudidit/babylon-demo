import { HOUSE_COORDINATES } from "./HouseLayout";
import type { RoomFurnishings } from "./RoomFurnishings";
import { bedroomBed, bedroomNightstand, bedroomWardrobe, localPosition, metres } from "./HouseRoomComponents";

/** Guest room: north-facing bed, compact storage and a seat below the west window. */
export const HOUSE_BEDROOM = {
  bed: { x: 2.1, y: 1.25, width: 1.5 },
  nightstand: { x: 0.9, y: 0.45 },
  wardrobe: { x: 4.15, y: 0.42, width: 1.8 },
  seat: { x: 0.35, y: 1.8 },
  lamp: { x: 0.9, y: 0.45, height: 0.555, emitterHeight: 0.91 },
};

export function furnishHouseBedroom(room: RoomFurnishings) {
  const a = HOUSE_BEDROOM, u = HOUSE_COORDINATES.unitsPerMeter;
  bedroomBed(room, "bedroom", a.bed, a.bed.width, 0, "navy");
  bedroomNightstand(room, "bedroom", a.nightstand);
  bedroomWardrobe(room, "bedroom", a.wardrobe, a.wardrobe.width, 0, { door: "navy", inset: "cushion" });
  room.section("bedroom", "bedroom-reading-seat", () => {
    const root = room.group("bedroom-seat-root", localPosition("bedroom", a.seat));
    for (const x of [-0.15, 0.15]) for (const z of [-0.53, 0.53])
      room.box("seat-leg", metres(0.055, 0.37, 0.055), metres(x, 0.185, z), "wood", root);
    room.box("seat-frame", metres(0.45, 0.08, 1.3), metres(0, 0.37, 0), "darkWood", root);
    room.paddedBox("seat-cushion", metres(0.45, 0.09, 1.3), metres(0, 0.455, 0), "cushion", root);
    // A supported tray and books leave most of the window seat available for reading/luggage.
    room.box("reading-tray", metres(0.3, 0.025, 0.3), metres(0, 0.5125, 0.43), "wood", root);
    room.box("guest-book-pages", metres(0.18, 0.03, 0.24), metres(0, 0.54, 0.43), "paper", root);
    room.box("guest-book-cover", metres(0.19, 0.006, 0.25), metres(0, 0.558, 0.43), "rust", root);
  });
  room.section("bedroom", "bedroom-bedside-light", () => {
    const l = a.lamp;
    room.fixtureLamp("bedroom-lamp", "次卧床头灯", localPosition("bedroom", l, l.height), (g, glow) => {
      room.cylinder("bedroom-lamp-foot", 0.025 * u, 0.18 * u, metres(0, 0.0125, 0), "brass", g);
      room.sphere("bedroom-lamp-body", metres(0.15, 0.25, 0.15), metres(0, 0.14, 0), "navy", g);
      room.cylinder("bedroom-lamp-neck", 0.13 * u, 0.022 * u, metres(0, 0.3, 0), "brass", g);
      room.cylinder("bedroom-lamp-shade", 0.24 * u, 0.36 * u, metres(0, 0.48, 0), glow, g, 0.24 * u);
      room.ring("bedroom-lamp-trim", 0.36 * u, 0.008 * u, metres(0, 0.36, 0), "brass", g);
    });
  });
}
