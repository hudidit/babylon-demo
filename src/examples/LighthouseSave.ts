import { RoomTimeOfDay } from "./RoomTimeOfDay";
import { LighthouseOperation } from "./LighthouseOperation";
import { LighthouseInspection } from "./LighthouseInspection";
import { LighthouseMaintenance } from "./LighthouseMaintenance";
import { LighthousePower } from "./LighthousePower";
import { saveObject, saveEnum, saveHour } from "./LighthouseSaveValidation";

export const LIGHTHOUSE_SAVE_KEY = "babylon-lighthouse-duty-v1";
export interface LighthouseSession {clock: RoomTimeOfDay; operation: LighthouseOperation; inspection: LighthouseInspection; maintenance: LighthouseMaintenance; power: LighthousePower;}
export interface LighthouseSaveStatus {available: boolean; invalid: boolean; message: string;}
type SlotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const unchecked = (value: unknown) => value;
const MAX_SLOT_LENGTH = 524288;
/** Validate into new pure models first; the caller replaces the live session atomically. */
export function decodeLighthouseSave(raw: string): LighthouseSession {
  if (typeof raw !== "string" || raw.length > MAX_SLOT_LENGTH) throw new Error("Invalid duty slot size");
  const s = saveObject({version: saveEnum(1), hour: saveHour, operation: unchecked, inspection: unchecked, maintenance: unchecked, power: unchecked})(JSON.parse(raw));
  const operation = LighthouseOperation.fromSave(s.operation), inspection = LighthouseInspection.fromSave(s.inspection);
  if (s.hour !== operation.snapshot.hour || inspection.snapshot.dutyDay !== operation.snapshot.dutyDay) throw new Error("Inconsistent saved calendar");
  const maintenance = LighthouseMaintenance.fromSave(s.maintenance, operation.snapshot), power = LighthousePower.fromSave(s.power, operation.snapshot, maintenance.snapshot);
  const before = operation.snapshot, backupRevision = maintenance.snapshot.revision.backup, source = maintenance.snapshot.source;
  maintenance.configurePower(power.snapshot.mainAllowed, power.snapshot.trialAllowed, power.snapshot.backupAvailable, before, power.snapshot.exerciseComplete);
  maintenance.synchronize(operation); power.synchronize(operation.snapshot, maintenance.snapshot);
  if (before.available !== operation.snapshot.available || before.detectedDemand !== operation.snapshot.detectedDemand
    || maintenance.snapshot.revision.backup !== backupRevision || source !== maintenance.snapshot.source) throw new Error("Inconsistent saved equipment");
  const clock = new RoomTimeOfDay(); clock.restore(s.hour);
  return {clock, operation, inspection, maintenance, power};
}
export function encodeLighthouseSave(s: LighthouseSession) {
  if (s.clock.playback.transitioning) throw new Error("Wait for the time transition before saving");
  const raw = JSON.stringify({version: 1, hour: s.clock.snapshot.hour, operation: s.operation.exportState(), inspection: s.inspection.exportState(),
    maintenance: s.maintenance.exportState(), power: s.power.exportState()});
  decodeLighthouseSave(raw); return raw;
}
const timeLabel = (hour: number) => `${String(Math.floor(hour)).padStart(2,"0")}:${String(Math.floor(hour*60+1e-7)%60).padStart(2,"0")}`;
/** One explicit local slot. Invalid/future data and write failures never replace a live session. */
export class LighthouseSave {
  constructor(private readonly storage: () => SlotStorage = () => window.localStorage) {}
  inspect(): LighthouseSaveStatus {
    try {
      const raw = this.storage().getItem(LIGHTHOUSE_SAVE_KEY);
      if (raw === null) return {available:false,invalid:false,message:"尚未保存 · 保存后可从这里继续值守"};
      try {const s = decodeLighthouseSave(raw); return {available:true,invalid:false,message:`存档 · 第${s.operation.snapshot.dutyDay}日 ${timeLabel(s.clock.snapshot.hour)}`};}
      catch {return {available:false,invalid:true,message:"旧存档损坏或版本不支持，已保留；可继续当前游戏或清除旧存档。"};}
    } catch {return {available:false,invalid:false,message:"无法读取本地存档，本次游戏仍可继续。"};}
  }
  save(session: LighthouseSession): LighthouseSaveStatus {
    try {
      const previous = this.storage().getItem(LIGHTHOUSE_SAVE_KEY);
      if (previous !== null) {try {decodeLighthouseSave(previous);} catch {return this.inspect();}}
      const raw = encodeLighthouseSave(session); this.storage().setItem(LIGHTHOUSE_SAVE_KEY,raw);
      return {...this.inspect(), message:"值守已保存 · 继续时先暂停时间，核对后从T菜单恢复自动"};
    } catch {return {...this.inspect(),message:"保存失败（存储受限、空间不足或时间正在切换），当前值守保持，请稍后重试。"};}
  }
  load(): {session?: LighthouseSession; status: LighthouseSaveStatus} {
    try {
      const raw = this.storage().getItem(LIGHTHOUSE_SAVE_KEY);
      if (raw === null) return {status:this.inspect()};
      const session = decodeLighthouseSave(raw);
      return {session,status:{available:true,invalid:false,message:"已继续值守 · 时间暂停，请从T菜单开启自动流转"}};
    } catch {return {status:this.inspect()};}
  }
  clearInvalid(): LighthouseSaveStatus {
    const status = this.inspect(); if (!status.invalid) return status;
    try {this.storage().removeItem(LIGHTHOUSE_SAVE_KEY); return this.inspect();}
    catch {return {...status,message:"未能清除旧存档；数据已保留，当前游戏仍可继续。"};}
  }
}
