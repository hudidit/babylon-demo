import { HOUSE_ROOMS } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";

type RoomOwned = { metadata: any };
/** Explicit ownership survives mesh merging; legacy room metadata stays readable by tooling. */
export function setRoomOwners(target: RoomOwned, owners: readonly HouseRoomId[]) {
  const ids = Array.from(new Set(owners)).sort();
  if (!ids.length || ids.some(id => !HOUSE_ROOMS.some(room => room.id === id))) throw new Error("Invalid room ownership");
  target.metadata = { ...target.metadata, ownerRooms: ids, room: ids.length === 1 ? ids[0] : "shared" };
}
export function roomOwners(target: RoomOwned): readonly HouseRoomId[] {
  return target.metadata?.ownerRooms || [];
}
