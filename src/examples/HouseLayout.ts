export const HOUSE_LAYOUT_VERSION = "house-plan-v1";
export type HouseRoomId = "study" | "living" | "master" | "bedroom" | "kitchen" | "ensuite" | "bathroom" | "balcony";
export interface HouseRoom {
  id: HouseRoomId;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** Final wall-centreline dimensions in metres. North is up; content state is separate. */
export const HOUSE_ROOMS: readonly HouseRoom[] = [
  { id: "master", name: "主卧", x: 0, y: 0, width: 5.4, depth: 4.8 },
  { id: "study", name: "书房", x: 5.4, y: 0, width: 3, depth: 3.4 },
  { id: "kitchen", name: "厨房", x: 8.4, y: 0, width: 2.4, depth: 3.4 },
  { id: "ensuite", name: "主卫", x: 0, y: 4.8, width: 2.4, depth: 2.4 },
  { id: "bathroom", name: "公卫", x: 2.4, y: 4.8, width: 3, depth: 2.4 },
  { id: "bedroom", name: "次卧", x: 0, y: 7.2, width: 5.4, depth: 3.6 },
  { id: "living", name: "客厅", x: 5.4, y: 3.4, width: 5.4, depth: 7.4 },
  { id: "balcony", name: "阳台", x: 5.4, y: 10.8, width: 5.4, depth: 1.5 },
];

export interface HouseDoor {
  id: string;
  from: HouseRoomId;
  to: HouseRoomId | "outside";
  axis: "x" | "y";
  x: number;
  y: number;
  width: number;
  sliding?: boolean;
  swing?: 1 | -1;
}

/** Stable openings shared by the map and physical house. Balcony uses a two-track sliding door. */
export const HOUSE_DOORS: readonly HouseDoor[] = [
  { id: "entry-door", from: "living", to: "outside", axis: "y", x: 10.8, y: 4.1, width: 1.1, swing: -1 },
  { id: "master-door", from: "master", to: "living", axis: "y", x: 5.4, y: 3.6, width: 0.9, swing: 1 },
  { id: "ensuite-door", from: "master", to: "ensuite", axis: "x", x: 0.8, y: 4.8, width: 0.8, swing: 1 },
  { id: "bathroom-door", from: "bathroom", to: "living", axis: "y", x: 5.4, y: 5.6, width: 0.8, swing: 1 },
  { id: "bedroom-door", from: "bedroom", to: "living", axis: "y", x: 5.4, y: 8.7, width: 0.9, swing: 1 },
  { id: "connecting-door", from: "study", to: "living", axis: "x", x: 6.2, y: 3.4, width: 0.9 },
  { id: "kitchen-door", from: "kitchen", to: "living", axis: "x", x: 9.1, y: 3.4, width: 0.9 },
  { id: "balcony-door", from: "living", to: "balcony", axis: "x", x: 6.9, y: 10.8, width: 2.4, sliding: true },
];

export function houseRoomAt(x: number, y: number) {
  return HOUSE_ROOMS.find(room => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.depth);
}

/** Shared planning convention; legacy geometry deliberately uses its own adapter. */
export const HOUSE_COORDINATES = Object.freeze({ unitsPerMeter: 5, centerX: 5.4, centerY: 5.4,
  floorY: -5, wallThickness: 0.1, clearHeight: 2.8, eyeHeight: 1.6 });
export type PlanPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number; z: number };

export function houseRoom(id: HouseRoomId) {
  const room = HOUSE_ROOMS.find(room => room.id === id);
  if (!room) throw new Error("Unknown house room: " + id);
  return room;
}
export function planToWorld(point: PlanPoint, height = 0): WorldPoint {
  const c = HOUSE_COORDINATES;
  return { x: (point.x - c.centerX) * c.unitsPerMeter, y: c.floorY + height * c.unitsPerMeter,
    z: (point.y - c.centerY) * c.unitsPerMeter };
}
export function worldToPlan(point: { x: number; z: number }): PlanPoint {
  const c = HOUSE_COORDINATES;
  return { x: point.x / c.unitsPerMeter + c.centerX, y: point.z / c.unitsPerMeter + c.centerY };
}
export function roomLocalToWorld(id: HouseRoomId, point: PlanPoint, height = 0) {
  const room = houseRoom(id);
  return planToWorld({ x: room.x + point.x, y: room.y + point.y }, height);
}
export function roomInnerBounds(id: HouseRoomId, wallThickness = HOUSE_COORDINATES.wallThickness) {
  const room = houseRoom(id);
  if (!Number.isFinite(wallThickness) || wallThickness < 0 || wallThickness >= Math.min(room.width, room.depth))
    throw new Error("Invalid wall thickness");
  const inset = wallThickness / 2;
  return { minX: room.x + inset, maxX: room.x + room.width - inset,
    minY: room.y + inset, maxY: room.y + room.depth - inset };
}
// Runtime status is held by HouseRooms, not by immutable geometry data.
HOUSE_ROOMS.forEach(Object.freeze); Object.freeze(HOUSE_ROOMS);
HOUSE_DOORS.forEach(Object.freeze); Object.freeze(HOUSE_DOORS);
