export type HouseRoomId = "study" | "living" | "master" | "bedroom" | "kitchen" | "ensuite" | "bathroom" | "balcony";
export interface HouseRoom {
  id: HouseRoomId;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  hasContent: boolean;
}

/** Final planning dimensions in metres, before wall thickness. North is up.
 * Existing 3D rooms have not been resized; content presence is a separate property.
 */
export const HOUSE_ROOMS: readonly HouseRoom[] = [
  { id: "master", name: "主卧", x: 0, y: 0, width: 5.4, depth: 4.8, hasContent: false },
  { id: "study", name: "书房", x: 5.4, y: 0, width: 3, depth: 3.4, hasContent: true },
  { id: "kitchen", name: "厨房", x: 8.4, y: 0, width: 2.4, depth: 3.4, hasContent: false },
  { id: "ensuite", name: "主卫", x: 0, y: 4.8, width: 2.4, depth: 2.4, hasContent: false },
  { id: "bathroom", name: "公卫", x: 2.4, y: 4.8, width: 3, depth: 2.4, hasContent: false },
  { id: "bedroom", name: "次卧", x: 0, y: 7.2, width: 5.4, depth: 3.6, hasContent: false },
  { id: "living", name: "客厅", x: 5.4, y: 3.4, width: 5.4, depth: 7.4, hasContent: true },
  { id: "balcony", name: "阳台", x: 5.4, y: 10.8, width: 5.4, depth: 1.5, hasContent: false },
];

export interface HouseDoor {
  from: HouseRoomId;
  to: HouseRoomId | "outside";
  axis: "x" | "y";
  x: number;
  y: number;
  width: number;
  sliding?: boolean;
  swing?: 1 | -1;
}

/** All openings are planned; no corresponding 3D wall or door changes in this task. */
export const HOUSE_DOORS: readonly HouseDoor[] = [
  { from: "living", to: "outside", axis: "y", x: 10.8, y: 4.1, width: 1.1, swing: 1 },
  { from: "master", to: "living", axis: "y", x: 5.4, y: 3.6, width: 0.9, swing: 1 },
  { from: "master", to: "ensuite", axis: "x", x: 0.8, y: 4.8, width: 0.8, swing: 1 },
  { from: "bathroom", to: "living", axis: "y", x: 5.4, y: 5.6, width: 0.8, swing: 1 },
  { from: "bedroom", to: "living", axis: "y", x: 5.4, y: 8.7, width: 0.9, swing: 1 },
  { from: "study", to: "living", axis: "x", x: 6.2, y: 3.4, width: 0.9 },
  { from: "kitchen", to: "living", axis: "x", x: 9.1, y: 3.4, width: 0.9 },
  { from: "living", to: "balcony", axis: "x", x: 6.9, y: 10.8, width: 2.4, sliding: true },
];

export function houseRoomAt(x: number, y: number) {
  return HOUSE_ROOMS.find(room => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.depth);
}

export const PLAN_DRAWING = { left: 64, top: 50, scale: 36 };
export function houseDrawingPoint(x: number, y: number) {
  return { x: PLAN_DRAWING.left + x * PLAN_DRAWING.scale, y: PLAN_DRAWING.top + y * PLAN_DRAWING.scale };
}

/** Both views use this same geometry; no raster asset or second rendering engine. */
export function housePlanSvg(compact = false) {
  const prefix = compact ? "mini" : "full";
  const p = houseDrawingPoint, scale = PLAN_DRAWING.scale;
  const width = Math.max(...HOUSE_ROOMS.map(room => room.x + room.width));
  const depth = Math.max(...HOUSE_ROOMS.map(room => room.y + room.depth));
  const left = PLAN_DRAWING.left, top = PLAN_DRAWING.top, right = p(width, 0).x, bottom = p(0, depth).y;
  const rooms = HOUSE_ROOMS.map(room => {
    const origin = p(room.x, room.y), w = room.width * scale, h = room.depth * scale;
    // Leave the public bath's label clear of its inward-swinging door.
    const cx = origin.x + w / 2 - (!compact && room.id === "bathroom" ? 12 : 0), cy = origin.y + h / 2;
    const dimensions = `${room.width.toFixed(1)} × ${room.depth.toFixed(1)} m`;
    const area = `${(room.width * room.depth).toFixed(1)} m²`;
    const small = room.id === "ensuite" || room.id === "bathroom";
    const nameY = cy - (compact ? 0 : room.id === "balcony" ? 5 : room.id === "ensuite" ? 2 : small ? 10 : 15);
    return `<g data-room="${room.id}" class="plan-room ${room.hasContent ? "has-content" : "is-planned"}">
      <title>${room.name}，规划尺寸${dimensions}，${area}，${room.hasContent ? "已有内容，布局待调整" : "规划区域"}</title>
      <rect x="${origin.x}" y="${origin.y}" width="${w}" height="${h}" fill="${room.hasContent ? "#e0e6d9" : `url(#${prefix}-hatch)`}"/>
      <text class="plan-room-name ${small ? "plan-small-name" : ""}" x="${cx}" y="${nameY}">${room.name}</text>
      ${compact ? "" : `<text class="plan-room-size" x="${cx}" y="${nameY + (small ? 16 : 20)}">${dimensions}</text>
      ${room.id === "balcony" ? "" : `<text class="plan-room-area" x="${cx}" y="${nameY + (small ? 29 : 39)}">${area}</text>`}`}
    </g>`;
  }).join("");
  const doors = HOUSE_DOORS.map(door => {
    const start = p(door.x, door.y), size = door.width * scale;
    const rotation = door.axis === "y" ? 90 : 0;
    const swing = door.swing ?? -1;
    return `<g class="plan-door is-planned" transform="translate(${start.x} ${start.y}) rotate(${rotation})">
      <title>${HOUSE_ROOMS.find(room => room.id === door.from)!.name}至${door.to === "outside" ? "入户" : HOUSE_ROOMS.find(room => room.id === door.to)!.name} · 规划开口</title>
      <path class="plan-door-gap" d="M 2 0 H ${size - 2}"/>
      ${door.sliding ? `<path d="M 0 -3 H ${size * 0.6} M ${size * 0.4} 3 H ${size}"/>`
        : `<path d="M 0 0 V ${swing * size} M 0 ${swing * size} A ${size} ${size} 0 0 ${swing === -1 ? 1 : 0} ${size} 0"/>`}
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${compact ? `${left - 12} ${top - 12} ${right - left + 24} ${bottom - top + 24}` : `0 0 ${Math.ceil(right + 68)} ${Math.ceil(bottom + 68)}`}" role="img" aria-label="余晖小居规划户型：入户直接进入右侧客厅，西北主卧带独享主卫，主卧外公卫由客厅进入；北侧为小书房与厨房，西南次卧，南侧阳台">
    <defs><pattern id="${prefix}-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f5f1e8"/><path d="M -2 2 L 2 -2 M 0 8 L 8 0 M 6 10 L 10 6" stroke="#e9e3d6" stroke-width="0.6"/></pattern></defs>
    ${rooms}${doors}
    ${compact ? "" : `<g class="plan-dimensions"><path d="M ${left} 34 V 19 M ${right} 34 V 19 M ${left} 25 H ${right} M ${left - 5} 20 L ${left + 5} 30 M ${right - 5} 20 L ${right + 5} 30 M 47 ${top} H 32 M 47 ${bottom} H 32 M 38 ${top} V ${bottom} M 33 ${top - 5} L 43 ${top + 5} M 33 ${bottom - 5} L 43 ${bottom + 5}"/>
      <text x="${(left + right) / 2}" y="18">${width.toFixed(1)} m</text><text x="28" y="${(top + bottom) / 2}" transform="rotate(-90 28 ${(top + bottom) / 2})">${depth.toFixed(1)} m</text></g>
    <g class="plan-north" transform="translate(${right + 36} 72)"><path d="M 0 13 V -12 M -5 -4 L 0 -14 L 5 -4"/><text x="0" y="-23">N</text><text x="0" y="32">北</text></g>
    <g class="plan-scale" transform="translate(${left} ${bottom + 35})"><path d="M 0 -5 V 0 H ${scale * 5} V -5 M ${scale} 0 V -5"/><text x="0" y="17">0</text><text x="${scale}" y="17">1</text><text x="${scale * 5}" y="17">5 m</text></g>
    <text class="plan-entry" x="${right + 18}" y="${p(0, 4.6).y}">入户</text>
    <text class="plan-open-area" x="${p(8.1, 0).x}" y="${p(0, 4.5).y}">入户 / 餐区</text>`}
  </svg>`;
}
