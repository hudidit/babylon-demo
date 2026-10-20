import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE } from "./LighthouseLayout";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { LighthouseMaintenanceSnapshot } from "./LighthouseMaintenance";
import type { LighthousePowerSnapshot } from "./LighthousePower";

const floor = LIGHTHOUSE.floor, gallery = LIGHTHOUSE.gallery, plaza = COASTAL_SITE.tower.ground + .04;
export const LIGHTHOUSE_SERVICE_ROOM = Object.freeze({ x: -5.1, y: 5.9, width: 2.6, depth: 2.6,
  floor: plaza, clearHeight: 2.25, wall: .12, doorway: .96 });
export const LIGHTHOUSE_SOLAR_RACK = Object.freeze({ x: 4.8, y: 5.8, width: 2.8, depth: 1.6,
  floor: plaza, low: .7, rise: .9 });
export const LIGHTHOUSE_BACKUP_MOUNT = Object.freeze({ x: 3.85, y: 0, rootX: 1.82,
  bracketBottom: gallery + 2.04, mastBottom: gallery + 2.14, housingBottom: gallery + 3.51, lensBottom: gallery + 3.63, lensHeight: .32 });
export const LIGHTHOUSE_SENSOR = Object.freeze({x: 1.82, y: -.5, bottom: gallery + 1.43, width: .1, depth: .14, height: .18});

/** Stable identities and service positions shared by geometry, picking and maintenance. */
export const LIGHTHOUSE_EQUIPMENT = Object.freeze(([
  { id: "lighthouse-drive-hatch", parent: "lighthouse-beacon-main", label: "主灯驱动检修口", place: "顶层灯室 · 主灯底座", floor: gallery,
    lines: ["MAIN DRIVE", "SERVICE HATCH"], purpose: "检查主灯转台驱动与模块的检修入口。",
    guide: "检修口保持关闭。在灯座开启试灯，观察转动与出光。",
    sign: { x: .15, y: -.322, bottom: gallery + .67, width: .18, height: .09, nx: 0, ny: -1 } },
  { id: "lighthouse-beacon-backup", parent: "lighthouse-beacon-backup", label: "独立备用导航灯", place: "灯室外 · 高位独立支架", floor: gallery,
    lines: ["BACKUP", "WHITE FL 10S"], purpose: "高于塔顶的独立备用灯头，白闪10秒一周期、亮0.8秒，360度临时降级覆盖。",
    guide: "主灯不可用时自动接替，日常无需手动切换。备用电池独立供电。",
    sign: { x: 1.76, y: .73, bottom: gallery + 1.25, width: .56, height: .16, nx: Math.cos(Math.PI / 8), ny: Math.sin(Math.PI / 8) } },
  { id: "lighthouse-battery-main", parent: "lighthouse-power-system", label: "主电池配电柜", place: "首层维护室 · 右侧封闭柜体", floor,
    lines: ["BATTERY", "MAIN / BACKUP"], purpose: "封闭主电池与配电支路；与左侧工具柜、原工作灯和导航面板分别标识。",
    guide: "柜门保持关闭。白天储能，夜间供电；低电保护后等待太阳能补能，回升后在此确认恢复供电。",
    sign: { x: 2.35, y: -.218, bottom: floor + .92, width: .52, height: .15, nx: 0, ny: -1 } },
  { id: "lighthouse-solar-charger", parent: "lighthouse-power-system", label: "太阳能充电控制器", place: "首层维护室 · 电池柜上部", floor,
    lines: ["CHARGER", "SERVICE / TEST"], purpose: "显示太阳能输入和主电池电量的控制器。",
    guide: "查看太阳能输入与主电池电量，到塔外巡视面板是否洁净。",
    sign: { x: 2.35, y: -.242, bottom: floor + 1.57, width: .46, height: .13, nx: 0, ny: -1 } },
  { id: "lighthouse-solar-array", parent: "lighthouse-power-system", label: "太阳能支架与面板", place: "塔外平台 · 东南侧", floor: plaza,
    lines: ["SOLAR ARRAY", "CHECK SURFACE"], purpose: "朝南倾斜的独立面板与支架，现场排查遮挡污损。",
    guide: "从南侧巡视表面，发现污损时擦拭，再巡视确认。",
    sign: { x: 4.8, y: 6.652, bottom: plaza + .36, width: .68, height: .18, nx: 0, ny: 1 } },
  { id: "lighthouse-generator", parent: "lighthouse-power-system", label: "柴油备用充电机组", place: "独立机房 · 后侧机座", floor: plaza,
    lines: ["GENSET", "STOP TO REFUEL"], purpose: "设置在塔外独立机房内的备用充电机组，具有机座、外壳及通向屋外的排气管。",
    guide: "机组保持停放，日常由太阳能供电；保持通风口畅通。",
    sign: { x: LIGHTHOUSE_SERVICE_ROOM.x, y: LIGHTHOUSE_SERVICE_ROOM.y + .243, bottom: plaza + .58, width: .62, height: .16, nx: 0, ny: -1 } },
  { id: "lighthouse-generator-room", parent: "lighthouse-power-system", label: "塔外独立机房", place: "塔外平台 · 西南侧", floor: plaza,
    lines: ["GEN ROOM", "KEEP VENTS CLEAR"], purpose: "常开检修入口、两侧百叶通风口和屋外排气，机组不占用塔底维护室。",
    guide: "从朝向灯塔的门洞步行进入，在机组前方站位查看；小电驴请停原停车位，保持门洞及通风口畅通。",
    sign: { x: LIGHTHOUSE_SERVICE_ROOM.x - .86, y: LIGHTHOUSE_SERVICE_ROOM.y - LIGHTHOUSE_SERVICE_ROOM.depth / 2 - .008, bottom: plaza + 1.35, width: .62, height: .17, nx: 0, ny: -1 } },
  { id: "lighthouse-light-sensor", parent: "lighthouse-beacon-main", label: "光敏检测保护面", place: "灯室外廊 · 东侧固定检测器", floor: gallery,
    lines: ["LIGHT SENSOR", "DAY / AUTO"], purpose: "光敏检测器的固定保护面，用于交叉核对晴天日程和实际检测需求。",
    guide: "天黑亮灯，天亮待机，日常无需手动调整。",
    sign: { x: 1.876, y: -.5, bottom: gallery + 1.44, width: .12, height: .16, nx: 1, ny: 0 } },
] as const).map(device => Object.freeze({ ...device, lines: Object.freeze(device.lines), sign: Object.freeze(device.sign) })));
export type LighthouseEquipmentId = typeof LIGHTHOUSE_EQUIPMENT[number]["id"];
export const lighthouseEquipmentDefinition = (id: string) => LIGHTHOUSE_EQUIPMENT.find(device => device.id === id);

export function lighthouseEquipmentReading(id: string, operation: LighthouseOperationSnapshot, maintenance?: LighthouseMaintenanceSnapshot, power?: LighthousePowerSnapshot) {
  if (power) {
    const p=power;
    if(id === "lighthouse-beacon-backup" && !p.backupAvailable)return {state:"备用电源不可用",detail:`备用电池${p.backupWh.toFixed(1)}Wh；等待机组独立支路补能，不从主电池倒灌。`};
    if(id === "lighthouse-battery-main")return {state:`主电池 ${(p.mainFraction*100).toFixed(1)}% · ${p.mainWh.toFixed(1)}Wh`,detail:`净${p.mainNetW.toFixed(1)}W；${p.protected ? p.recoveryReady ? "已回升20%，待检测解除保护" : "低电保护，先补能" : p.warning ? "25%低电预警" : "主供电可用"}。备用独立${p.backupWh.toFixed(1)}Wh。`};
    if(id === "lighthouse-solar-charger" || id === "lighthouse-solar-array")return {state:`太阳能实际 ${p.solarW.toFixed(1)}W`,detail:`主电池净${p.mainNetW.toFixed(1)}W；${maintenance?.chargeIsolated ? "太阳能支路隔离" : "太阳能支路接通"}。开启自动流转后以实际Wh变化采样，满电或负趋势不记回充通过。`};
    if(id === "lighthouse-generator" || id === "lighthouse-generator-room")return {state:p.generatorRunning?"机组运行 · 充电需独立复验":"机组停止",detail:`输出${p.generatorW}W（主${p.generatorMainW}W/备用${p.generatorBackupW}W）；燃料${p.fuel.toFixed(2)}单位，约${p.remainingHours.toFixed(2)}场景小时；储备${p.reserveFuel.toFixed(1)}单位。停机才能补给。`};
  }
  if (maintenance) {
    const m = maintenance;
    if (id === "lighthouse-drive-hatch") return {state: m.mainIsolated ? m.trial ? "隔离中 · 受控试机" : "主灯隔离" : operation.running ? "主灯运行" : "主灯停转",
      detail: `导航需求${m.navigationRequired ? "有" : "无"} / 主灯实际${operation.running ? "转动出光" : "停转熄灭"}；${m.mainVerified ? "当前驱动修订试机已复验" : "故障结论需隔离检测，维修后必须试机复验"}。`};
    if (id === "lighthouse-beacon-backup") return {state: m.selfTestSecondsRemaining > 0 && !m.navigationRequired ? "备用自检 · 不作实际接替" : m.backupOn ? "备用白闪 · 临时降级覆盖" : "备用熄灭 · 待命",
      detail: `${m.backupConfirmed ? "实际接替已现场复验" : "实际接替尚未现场复验"}；10秒周期 / 0.8秒亮 / 360度。自检记录独立，主备互锁。`};
    if (id === "lighthouse-solar-charger") return {state: m.chargeIsolated ? "充电支路隔离" : "充电支路接通",
      detail: `${m.chargerVerified ? "回充趋势已复验" : "需现场排查并按实际主电池Wh采样"}。`};
    if (id === "lighthouse-solar-array") return {state: "现场检查面板", detail: "遮挡污损、支架和控制模块分别排查；面板清洁不会修复控制模块。"};
    if (id === "lighthouse-light-sensor") return {state: m.override ? "受控抑制检测需求" : m.detectedDemand ? "检测请求亮灯" : "检测与日程一致",
      detail: `${m.override ? "人工覆盖尚未撤销" : "人工覆盖关闭"}；${m.sensorVerified ? "当前保护面已复测" : "结论需现场观察、清洁后撤销覆盖并复测"}。夜间日程优先。`};
  }
  if (id === "lighthouse-drive-hatch") return { state: operation.running ? "主灯运行 · 检修口关闭" : "主灯停转 · 检修口关闭",
    detail: "主灯实际转动/出光读取运行模型；供电和检修条件需核对设备遥测。" };
  if (id === "lighthouse-generator-room") return { state: "检修入口开放", detail: "实体通风口和屋外排气已布置；机组状态需核对供电遥测。" };
  if (id === "lighthouse-generator") return { state: "状态待同步", detail: "在机组旁核对燃料和输出遥测。" };
  return { state: "状态待同步", detail: "需核对当前设备和供电遥测。" };
}

export interface LighthouseEquipmentBox {
  id: LighthouseEquipmentId; name: string; finish: "paint" | "metal" | "plaster";
  x: number; y: number; bottom: number; width: number; depth: number; height: number; blocking: boolean;
}
const room = LIGHTHOUSE_SERVICE_ROOM, solar = LIGHTHOUSE_SOLAR_RACK;
const backup = LIGHTHOUSE_BACKUP_MOUNT;
const forSides = (make: (side: number) => LighthouseEquipmentBox[]) => [-1, 1].reduce<LighthouseEquipmentBox[]>((all, side) => all.concat(make(side)), []);
/** These exact solids feed both the renderer and the shared walker/vehicle collision path. */
export const LIGHTHOUSE_EQUIPMENT_BOXES: readonly LighthouseEquipmentBox[] = Object.freeze([
  { id: "lighthouse-battery-main", name: "cabinet", finish: "paint", x: 2.35, y: .2, bottom: floor, width: .66, depth: .8, height: 1.9, blocking: true },
  { id: "lighthouse-solar-charger", name: "controller", finish: "metal", x: 2.35, y: -.17, bottom: floor + 1.4, width: .54, depth: .12, height: .42, blocking: false },
  { id: "lighthouse-drive-hatch", name: "closed-hatch", finish: "paint", x: .15, y: -.3, bottom: gallery + .53, width: .2, depth: .04, height: .28, blocking: false },
  { id: "lighthouse-beacon-backup", name: "overhead-bracket", finish: "metal", x: (backup.rootX + backup.x + .06) / 2, y: backup.y,
    bottom: backup.bracketBottom, width: backup.x - backup.rootX + .06, depth: .14, height: .1, blocking: true },
  { id: "lighthouse-beacon-backup", name: "mast", finish: "metal", x: backup.x, y: backup.y, bottom: backup.mastBottom, width: .08, depth: .08, height: 1.37, blocking: true },
  { id: "lighthouse-beacon-backup", name: "housing", finish: "paint", x: backup.x, y: backup.y, bottom: backup.housingBottom, width: .3, depth: .3, height: .12, blocking: true },
  ...forSides(side => [
    { id: "lighthouse-generator-room", name: `vent-${side}-lower`, finish: "plaster", x: room.x + side * (room.width / 2 - room.wall / 2), y: room.y,
      bottom: plaza, width: room.wall, depth: room.depth, height: 1.25, blocking: true },
    { id: "lighthouse-generator-room", name: `vent-${side}-upper`, finish: "plaster", x: room.x + side * (room.width / 2 - room.wall / 2), y: room.y,
      bottom: plaza + 1.85, width: room.wall, depth: room.depth, height: room.clearHeight - 1.85, blocking: true },
    ...[-1, 1].map<LighthouseEquipmentBox>(end => ({ id: "lighthouse-generator-room", name: `vent-${side}-jamb-${end}`, finish: "plaster",
      x: room.x + side * (room.width / 2 - room.wall / 2), y: room.y + end * (room.depth + .8) / 4,
      bottom: plaza + 1.25, width: room.wall, depth: (room.depth - .8) / 2, height: .6, blocking: true }))]),
  { id: "lighthouse-generator-room", name: "rear-wall", finish: "plaster", x: room.x, y: room.y + room.depth / 2 - room.wall / 2, bottom: plaza, width: room.width - 2 * room.wall, depth: room.wall, height: room.clearHeight, blocking: true },
  ...[-1, 1].map(side => ({ id: "lighthouse-generator-room", name: side < 0 ? "front-west" : "front-east", finish: "plaster",
    x: room.x + side * (room.width + room.doorway) / 4, y: room.y - room.depth / 2 + room.wall / 2,
    bottom: plaza, width: (room.width - room.doorway) / 2, depth: room.wall, height: room.clearHeight, blocking: true })),
  { id: "lighthouse-generator-room", name: "lintel", finish: "plaster", x: room.x, y: room.y - room.depth / 2 + room.wall / 2, bottom: plaza + 2.02, width: room.doorway, depth: room.wall, height: room.clearHeight - 2.02, blocking: true },
  { id: "lighthouse-generator-room", name: "roof", finish: "metal", x: room.x, y: room.y, bottom: plaza + room.clearHeight, width: room.width + .16, depth: room.depth + .16, height: .14, blocking: true },
  { id: "lighthouse-generator", name: "skid", finish: "metal", x: room.x, y: room.y + .65, bottom: plaza, width: 1.22, depth: .84, height: .12, blocking: true },
  { id: "lighthouse-generator", name: "engine", finish: "paint", x: room.x, y: room.y + .65, bottom: plaza + .12, width: 1.08, depth: .78, height: .94, blocking: true },
  { id: "lighthouse-generator", name: "exhaust-inner", finish: "metal", x: room.x + .32, y: room.y + 1.07, bottom: plaza + .9, width: .07, depth: .65, height: .07, blocking: true },
  { id: "lighthouse-generator", name: "exhaust-outer", finish: "metal", x: room.x + .32, y: room.y + 1.36, bottom: plaza + .9, width: .07, depth: .07, height: 1.85, blocking: true },
  ...forSides(x => [-1, 1].map(y => ({ id: "lighthouse-solar-array", name: `leg-${x}-${y}`, finish: "metal",
    x: solar.x + x * 1.13, y: solar.y + y * .66, bottom: plaza, width: .07, depth: .07, height: solar.low + solar.rise * (1 - (y * .66 / solar.depth + .5)) - .05, blocking: true }))),
  { id: "lighthouse-solar-array", name: "front-frame", finish: "metal", x: solar.x, y: solar.y + solar.depth / 2 + .025, bottom: plaza + solar.low - .09, width: solar.width + .1, depth: .05, height: .13, blocking: true },
  { id: "lighthouse-solar-array", name: "rear-frame", finish: "metal", x: solar.x, y: solar.y - solar.depth / 2 - .025, bottom: plaza + solar.low + solar.rise - .09, width: solar.width + .1, depth: .05, height: .13, blocking: true },
].map(box => Object.freeze(box)) as LighthouseEquipmentBox[]);

export function lighthouseEquipmentPointAllowed(x: number, y: number, radius: number, feet: number) {
  const dx = x - COASTAL_SITE.tower.x, dy = y - COASTAL_SITE.tower.y, head = feet + 1.68;
  const sensor = LIGHTHOUSE_SENSOR;
  if (feet < sensor.bottom + sensor.height && head > sensor.bottom && Math.abs(dx - sensor.x) < sensor.width / 2 + radius + .025
    && Math.abs(dy - sensor.y) < sensor.depth / 2 + radius + .025) return false;
  for (const box of LIGHTHOUSE_EQUIPMENT_BOXES) if (box.blocking && feet < box.bottom + box.height - 1e-6 && head > box.bottom + 1e-6
    && Math.abs(dx - box.x) < box.width / 2 + radius + .025 && Math.abs(dy - box.y) < box.depth / 2 + radius + .025) return false;
  // The sloping panel itself obstructs a standing body between the shared support legs.
  if (Math.abs(dx - solar.x) < solar.width / 2 + radius + .025 && Math.abs(dy - solar.y) < solar.depth / 2 + radius + .025) {
    const top = plaza + solar.low + solar.rise * (1 - Math.max(0, Math.min(1, (dy - solar.y) / solar.depth + .5)));
    if (feet < top + .05 && head > top - .05) return false;
  }
  return true;
}
export function lighthouseServiceRoomAt(x: number, y: number) {
  return Math.abs(x - COASTAL_SITE.tower.x - room.x) < room.width / 2 && Math.abs(y - COASTAL_SITE.tower.y - room.y) < room.depth / 2;
}
