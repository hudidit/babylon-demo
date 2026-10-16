import { houseVector } from "./HouseWalking";
import { seat, fireplace, displayCabinet } from "./RoomLivingRoom";
import type { RoomFurnishings } from "./RoomFurnishings";

type Triple = [number, number, number];
const at = (x: number, y: number, h = 0): Triple => houseVector(x, y, h).asArray() as Triple;

/** Furniture anchors in metres; scene, view presets and local lights consume the same positions. */
export const HOUSE_CONTENT = {
  desk: { x: 6.9, y: 0.72, heightScale: 0.85 },
  chair: { x: 6.9, y: 1.8 },
  bookshelf: { x: 8.04, y: 2.2, width: 6, rotation: -Math.PI / 2 },
  readingSofa: { x: 8.1, y: 3.95, width: 9.3, rotation: 0 },
  readingChair: { x: 8.4, y: 6.4, width: 3.8, rotation: Math.PI },
  floorLamp: { x: 6.15, y: 6.65 },
  console: { x: 5.82, y: 7.6, rotation: Math.PI / 2 },
  cabinet: { x: 5.77, y: 10.2, width: 5.5, rotation: Math.PI / 2 },
  sofa: { x: 10.24, y: 8.4 },
  coffeeTable: { x: 8.7, y: 8.4 },
  fireplace: { x: 10.33, y: 6.15 },
  display: { x: 5.76, y: 5.05 },
};

export function furnishHouseStudy(room: RoomFurnishings) {
  const a = HOUSE_CONTENT;
  room.section("study", "study-content", () => {
    room.ensureRugMaterial();
    room.box("persian-rug", [9, 0.04, 12.7], at(6.85, 1.65, 0.014), "rug");
    room.writingTable(at(a.desk.x, a.desk.y), 0, a.desk.heightScale);
    room.chair(at(a.chair.x, a.chair.y), 0);
  });
}

export function furnishHouseLiving(room: RoomFurnishings) {
  const a = HOUSE_CONTENT;
  room.section("living", "living-content", () => {
    room.ensureRugMaterial();
    seat(room, "living-sofa", at(a.sofa.x, a.sofa.y), 12, Math.PI / 2, "moss");
    room.box("persian-rug", [14.5, 0.055, 17], at(8.65, 8.4, 0.012), "rug");
    for (const y of [6.67, 10.13]) for (let x = 7.24; x <= 10.08; x += 0.075)
      room.box("rug-fringe", [0.07, 0.025, 0.3], at(x, y, 0.012), "cream");
    const table = room.group("living-coffee-table", at(a.coffeeTable.x, a.coffeeTable.y), Math.PI / 2);
    room.box("table-living-top", [7.5, 0.28, 4.4], [0, 2.2, 0], "coffee-wood", table);
    room.box("table-living-edge", [7.35, 0.12, 4.25], [0, 2, 0], "darkWood", table);
    room.box("table-living-lower-shelf", [6.5, 0.16, 3.4], [0, 0.65, 0], "wood", table);
    for (const x of [-3, 3]) for (const z of [-1.5, 1.5]) room.cylinder("living-table-leg", 2.05, 0.16, [x, 1.025, z], "brass", table);
    room.bookStack([-2, 2.34, 0], table);
    room.cylinder("living-tea-tray", 0.08, 2.1, [1.45, 2.38, 0], "brass", table);
    room.ring("living-tray-rim", 2.05, 0.06, [1.45, 2.43, 0], "brass", table);
    room.mug([1.1, 2.42, -0.25], "ceramic", table);
    room.mug([1.85, 2.42, 0.3], "navy", table);
    room.bookStack([-0.5, 0.73, 0.1], table);
    fireplace(room, at(a.fireplace.x, a.fireplace.y), -Math.PI / 2, 0.8);
    displayCabinet(room, at(a.display.x, a.display.y), Math.PI / 2, 0.72);
    room.windowDesk(at(a.console.x, a.console.y), a.console.rotation, false);
    room.tableLamp(at(a.console.x, a.console.y, 0.85));
    room.floorLamp(at(a.floorLamp.x, a.floorLamp.y));
    const readingTable = room.group("reading-side-table", at(8.1, 4.95));
    room.cylinder("reading-table-top", 0.18, 2.7, [0, 2.3, 0], "coffee-wood", readingTable);
    room.cylinder("reading-table-stem", 2.2, 0.2, [0, 1.1, 0], "brass", readingTable);
    room.cylinder("reading-table-foot", 0.12, 1.8, [0, 0.06, 0], "darkWood", readingTable);
    room.mug([0.3, 2.39, 0], "ceramic", readingTable);
    room.bookStack([-0.6, 2.39, 0], readingTable);
    room.plant(at(10.1, 10.2), 0.65);
    room.plant(at(10.35, 3.75), 0.45);
  });
}
