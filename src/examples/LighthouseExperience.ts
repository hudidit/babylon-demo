import { LIGHTHOUSE_INSPECTION } from "./LighthouseInspection";
import type { LighthouseInspectionSnapshot } from "./LighthouseInspection";
import type { LighthouseMaintenanceSnapshot, MaintenanceCommand } from "./LighthouseMaintenance";
import type { LighthousePowerSnapshot, PowerCommand } from "./LighthousePower";

/** The current player scope. Deferred simulations remain independently testable. */
export const lighthouseMaintenanceAllowed = (location: string, command: MaintenanceCommand) =>
  location === "lighthouse-solar-array" && (command === "inspect" || command === "surface-test" || command === "clean");
export const lighthousePowerAllowed = (location: string, command: PowerCommand) =>
  location === "lighthouse-battery-main" && command === "verify-main";

export function lighthouseProgress(i: LighthouseInspectionSnapshot, m: LighthouseMaintenanceSnapshot, p: LighthousePowerSnapshot) {
  if (i.cleaning) return {kind: "cleaning", label: "擦拭中", fraction: i.cleaningSeconds / 1.5};
  if (m.action) return {kind: m.action.command, label: m.action.command === "clean" ? "擦拭中" : m.action.command === "surface-test" ? "近距细查" : "巡视中", fraction: m.action.elapsed / m.action.duration};
  if (p.action) return {kind: p.action.command, label: "确认供电", fraction: p.action.elapsed / p.action.duration};
  if(m.backupOn&&!m.backupConfirmed&&m.backupObservationSeconds>0)return {kind:"backup-observation",label:"观察备用灯",fraction:Math.min(.97,m.backupObservationSeconds/10)};
  // Time alone must not draw a complete ring before an actual turn and output are confirmed.
  if (!i.optic && i.observationSeconds > 0) return {kind: "observation", label: "检查大灯", fraction: Math.min(.97, i.observationSeconds / LIGHTHOUSE_INSPECTION.observationSeconds)};
  return undefined;
}
export interface LighthouseRecord {day: number; hour: number; object: string; action: string; result: string;}
export function lighthouseRecords(location: string, i: LighthouseInspectionSnapshot, m: LighthouseMaintenanceSnapshot, p: LighthousePowerSnapshot): LighthouseRecord[] {
  const objects: Record<string, string> = {control: "lighthouse-control-panel", test: "lighthouse-beacon-main", cover: "lighthouse-optics-cleaning"};
  const filter = objects[location] || location, all = location === "log";
  const labels: Record<string, [string, string]> = {
    "control-read": ["读取仪表", "读数已确认"], "optic-observed": ["观察灯具", "转动与出光正常"],
    "cover-observed": ["检查保护面", ""], "cover-cleaned": ["擦拭保护面", "已清洁，待复查"],
    "cleaning-cancelled": ["擦拭中断", "表面保持原状"], "maintenance-due": ["例行清洁到期", "请检查保护面"]
  };
  const rows: LighthouseRecord[] = i.events.filter(e => !!labels[e.type] && (all || e.objectId === filter)).map(e => {
    // V1 retains its event schema; distinguish the explicit weather cause in its saved result.
    const weather = e.type === "maintenance-due" && e.result.startsWith("天气暴露");
    return {day: e.dutyDay, hour: e.hour, object: e.objectId, action: weather ? "天气暴露污损" : labels[e.type][0],
      result: weather ? e.result : labels[e.type][1] || (e.result.includes("盐膜") ? "发现盐膜，待清洁" : "表面洁净，已确认")};
  });
  if (all || location === "lighthouse-solar-array") m.evidence.filter(e => e.component === "solar" && !e.method.startsWith("开始")).forEach(e => rows.push({
    day: e.day, hour: e.hour, object: "lighthouse-solar-array", action: e.method === "维护到期" ? "例行清洁到期" : e.method === "中断" ? "巡视中断" : e.method === "擦拭完成" ? "清洁面板" : e.method,
    result: e.result
  }));
  if(all||location==="lighthouse-beacon-backup")m.evidence.filter(e=>e.component==="backup"&&e.method==="实际接替复验").forEach(e=>rows.push({day:e.day,hour:e.hour,object:"lighthouse-beacon-backup",action:"观察备用灯",result:e.result}));
  if (all || location === "lighthouse-battery-main") p.events.filter(e => ["main-protected", "verify-main"].includes(e.type)).forEach(e => rows.push({
    day: e.day, hour: e.hour, object: "lighthouse-battery-main", action: "供电检查", result: e.type === "main-protected" ? "电量偏低，自动保护" : "供电恢复，已确认"
  }));
  return rows.map((row, order) => ({...row, order})).sort((a, b) => b.day - a.day || b.hour - a.hour || b.order - a.order);
}
export function lighthouseRecordPage(rows: LighthouseRecord[], page: number, size = 5) {
  const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.max(0, Math.min(pages - 1, page));
  return {rows: rows.slice(current * size, (current + 1) * size), page: current, pages};
}
