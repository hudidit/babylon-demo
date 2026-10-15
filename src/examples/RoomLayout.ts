/** Match the existing furniture scale with a normal single-door opening. */
export const CONNECTING_PASSAGE = { x: 20, centerZ: -5, width: 4.4, minZ: -7.2, maxZ: -2.8 };
export const LIVING_ROOM = { minX: 20, maxX: 54, minZ: -20, maxZ: 20,
  passageMinZ: CONNECTING_PASSAGE.minZ, passageMaxZ: CONNECTING_PASSAGE.maxZ, floorY: -5 };
export const SHARED_WALL_SPANS = [
  { length: CONNECTING_PASSAGE.minZ + 20, z: (-20 + CONNECTING_PASSAGE.minZ) / 2 },
  { length: 20 - CONNECTING_PASSAGE.maxZ, z: (20 + CONNECTING_PASSAGE.maxZ) / 2 },
];
