import { HOUSE_COORDINATES, HOUSE_DOORS, HOUSE_ROOMS } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";

export type HouseWindow = { id: string; room: HouseRoomId; axis: "x" | "y";
  x: number; y: number; width: number; sill: number; height: number };
/** Exterior openings, in metres. The public bathroom deliberately has no window. */
export const HOUSE_WINDOWS: readonly HouseWindow[] = [
  { id: "master-window", room: "master", axis: "x", x: 1, y: 0, width: 2.8, sill: 0.9, height: 1.5 },
  { id: "study-window", room: "study", axis: "x", x: 6.1, y: 0, width: 1.6, sill: 0.95, height: 1.5 },
  { id: "kitchen-window", room: "kitchen", axis: "x", x: 8.9, y: 0, width: 1.4, sill: 1.2, height: 1.1 },
  { id: "ensuite-window", room: "ensuite", axis: "y", x: 0, y: 5.5, width: 1, sill: 1.5, height: 0.75 },
  { id: "bedroom-window", room: "bedroom", axis: "y", x: 0, y: 8, width: 2, sill: 0.9, height: 1.5 },
  { id: "living-window", room: "living", axis: "y", x: 10.8, y: 7.2, width: 2.4, sill: 0.9, height: 1.5 },
];
export const HOUSE_DOOR_HEIGHT = 2.2;
export const HOUSE_DOOR_JAMB = 0.04;
export const HOUSE_CUT_HEIGHT = 0.72;
export type WallSpan = { axis: "x" | "y"; at: number; start: number; end: number;
  owners: HouseRoomId[]; opening?: string; bottom: number; top: number; rail: boolean };

/** Subdivide every collinear edge at T-junctions and opening endpoints, then emit each span once. */
export function houseWallSpans(): WallSpan[] {
  const lines = new Map<string, { axis: "x" | "y"; at: number;
    edges: { start: number; end: number; room: HouseRoomId }[] }>();
  const add = (axis: "x" | "y", at: number, start: number, end: number, room: HouseRoomId) => {
    const key = `${axis}:${at.toFixed(6)}`;
    if (!lines.has(key)) lines.set(key, { axis, at, edges: [] });
    lines.get(key)!.edges.push({ start, end, room });
  };
  HOUSE_ROOMS.forEach(r => {
    add("x", r.y, r.x, r.x + r.width, r.id);
    add("x", r.y + r.depth, r.x, r.x + r.width, r.id);
    add("y", r.x, r.y, r.y + r.depth, r.id);
    add("y", r.x + r.width, r.y, r.y + r.depth, r.id);
  });
  const spans: WallSpan[] = [];
  for (const { axis, at, edges } of lines.values()) {
    const openings = [...HOUSE_DOORS.map(d => ({ ...d, bottom: 0, top: HOUSE_DOOR_HEIGHT })),
      ...HOUSE_WINDOWS.map(w => ({ ...w, bottom: w.sill, top: w.sill + w.height }))]
      .filter(o => o.axis === axis && Math.abs((axis === "x" ? o.y : o.x) - at) < 1e-6);
    const cuts = [...new Set([...edges.reduce<number[]>((a, e) => [...a, e.start, e.end], []),
      ...openings.reduce<number[]>((a, o) => { const s = axis === "x" ? o.x : o.y; return [...a, s, s + o.width]; }, [])]
      .map(n => Number(n.toFixed(6))))].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i], end = cuts[i + 1], mid = (start + end) / 2;
      const owners = [...new Set(edges.filter(e => e.start < mid && e.end > mid).map(e => e.room))].sort();
      if (!owners.length) continue;
      const rail = owners.length === 1 && owners[0] === "balcony";
      const opening = openings.find(o => { const s = axis === "x" ? o.x : o.y; return mid > s && mid < s + o.width; });
      const base = { axis, at, start, end, owners, rail, opening: opening?.id };
      if (!opening) spans.push({ ...base, bottom: 0, top: rail ? 1.1 : HOUSE_COORDINATES.clearHeight });
      else {
        if (opening.bottom > 0) spans.push({ ...base, bottom: 0, top: opening.bottom });
        spans.push({ ...base, bottom: opening.top, top: HOUSE_COORDINATES.clearHeight });
      }
    }
  }
  return spans;
}
