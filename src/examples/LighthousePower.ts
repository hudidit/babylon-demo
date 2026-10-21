import {saveFields, saveObject, saveNumber, saveDay, saveHour, saveBoolean, saveText, saveArray, savedEventOrder} from "./LighthouseSaveValidation";
import { lighthouseNavigationRequired } from "./LighthouseOperation";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { LighthouseMaintenanceSnapshot, LighthouseTool } from "./LighthouseMaintenance";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export const LIGHTHOUSE_POWER = Object.freeze({mainCapacityWh: 2880, backupCapacityWh: 120, initialFraction: .8,
  mainLampW: 50, controlW: 5, backupW: 5, solarPeakW: 250, generatorW: 200, backupChargeW: 10,
  warning: .25, protect: .1, recover: .2, fuelCapacity: 12, initialFuel: 4, fuelPerHour: 1, reserveFuel: 8, refill: 4});
export type PowerCommand = "start-generator" | "stop-generator" | "refuel" | "verify-main" | "probe-solar" | "probe-generator";
interface PowerEvent {readonly id: number; readonly day: number; readonly hour: number; readonly type: string; readonly result: string;}
interface PowerAction {readonly command: PowerCommand; readonly location: string; readonly elapsed: number; readonly duration: number;
  readonly revision: string; readonly startWh: number; readonly inputWh: number;}
export interface LighthousePowerSnapshot {
  readonly mainWh: number; readonly backupWh: number; readonly mainFraction: number; readonly backupFraction: number;
  readonly protected: boolean; readonly recoveryReady: boolean; readonly warning: boolean; readonly mainAllowed: boolean; readonly trialAllowed: boolean; readonly backupAvailable: boolean;
  readonly solarW: number; readonly generatorW: number; readonly generatorMainW: number; readonly generatorBackupW: number;
  readonly mainLoadW: number; readonly backupLoadW: number; readonly mainNetW: number; readonly backupNetW: number;
  readonly generatorRunning: boolean; readonly fuel: number; readonly reserveFuel: number; readonly remainingHours: number;
  readonly revision: number; readonly action?: PowerAction; readonly notice: string; readonly events: readonly PowerEvent[];
  readonly solarVerified: boolean; readonly generatorVerified: boolean;
  readonly exerciseComplete: boolean;
}
const C = LIGHTHOUSE_POWER, EPS = 1e-8;
export const lighthouseSolarW = (hour: number) => hour >= 6 && hour <= 18 ? C.solarPeakW * Math.sin((hour - 6) * Math.PI / 12) : 0;
/** A single monotonic daylight segment; the integrator splits at midnight, dawn, noon and dusk. */
export const lighthouseSolarWh = (hour: number, hours: number) => C.solarPeakW * 12 / Math.PI *
  (Math.cos((Math.max(6, hour) - 6) * Math.PI / 12) - Math.cos((Math.min(18, hour + hours) - 6) * Math.PI / 12)) * (hour < 18 && hour + hours > 6 ? 1 : 0);
/** Integrate daylight × a linear weather multiplier on a daylight-only segment. */
export function lighthouseWeatherSolarWh(hour: number, hours: number, multiplier: number, slope = 0) {
  const start = Math.max(0, 6-hour), end = Math.min(hours,18-hour), k = Math.PI/12;
  if (end <= start) return 0;
  const primitive = (t: number) => -(multiplier+slope*t)*Math.cos(k*(hour+t-6))/k + slope*Math.sin(k*(hour+t-6))/(k*k);
  return C.solarPeakW*(primitive(end)-primitive(start));
}

/** Wh and fuel only consume accepted automatic scene hours. Actions consume bounded active seconds. */
export class LighthousePower {
  private weatherSolar = 1;
  setWeatherSolar(multiplier: number) {
    if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 1) throw new RangeError("Invalid solar weather multiplier");
    this.weatherSolar = multiplier;
  }
  private mainWh: number; private backupWh: number; private fuel: number; private reserveFuel: number;
  private generatorRunning = false; private protected = false; private warning = false; private ready = false; private revision = 0;
  private action?: PowerAction; private notice = ""; private nextId = 1; private events: readonly PowerEvent[] = Object.freeze([]);
  private solarProof = ""; private generatorProof = false; private current!: LighthousePowerSnapshot;
  private recoveryProof = -1; private generatorObserved = false;
  constructor(initial: Partial<{mainWh: number; backupWh: number; fuel: number; reserveFuel: number}> = {}) {
    const check = (v: number, max: number) => {if (!Number.isFinite(v) || v < 0 || v > max) throw new RangeError("Invalid lighthouse energy/fuel"); return v;};
    this.mainWh = check(initial.mainWh ?? C.mainCapacityWh * C.initialFraction, C.mainCapacityWh);
    this.backupWh = check(initial.backupWh ?? C.backupCapacityWh * C.initialFraction, C.backupCapacityWh);
    this.fuel = check(initial.fuel ?? C.initialFuel, C.fuelCapacity); this.reserveFuel = check(initial.reserveFuel ?? C.reserveFuel, C.reserveFuel);
    this.protected = this.mainWh <= C.mainCapacityWh * C.protect; this.warning = this.mainWh <= C.mainCapacityWh * C.warning;
    this.synchronize({hour:12,testSecondsRemaining:0} as LighthouseOperationSnapshot,
      {revision:{charger:0,solar:0}} as LighthouseMaintenanceSnapshot);
  }
  get snapshot() { return this.current; }
  exportState() {return saveFields(this, ["mainWh", "backupWh", "fuel", "reserveFuel", "generatorRunning", "protected", "warning", "ready", "revision", "solarProof", "generatorProof", "recoveryProof", "generatorObserved", "events", "nextId"]);}
  static fromSave(value: unknown, op: LighthouseOperationSnapshot, maintenance: LighthouseMaintenanceSnapshot) {
    const s=saveObject({mainWh:saveNumber(0,2880),backupWh:saveNumber(0,120),fuel:saveNumber(0,12),reserveFuel:saveNumber(0,8),revision:saveNumber(0,1000000,true),solarProof:saveText(64),recoveryProof:saveNumber(-1,1000000,true),events:saveArray(saveObject({id:saveDay, day:saveDay, hour:saveHour, type:saveText(64), result:saveText()}),128),nextId:saveDay,generatorRunning:saveBoolean,protected:saveBoolean,warning:saveBoolean,ready:saveBoolean,generatorProof:saveBoolean,generatorObserved:saveBoolean})(value);
    if (s.nextId < savedEventOrder(s.events) || s.events.some(e => e.day > op.dutyDay) || s.recoveryProof > s.revision
      || Math.abs(s.mainWh - 720) > EPS && s.warning !== (s.mainWh < 720)
      || s.ready !== (s.protected && s.mainWh >= 576 - EPS)
      || s.generatorRunning && s.fuel <= 0 || !s.protected && s.mainWh <= 288 - EPS
      || s.solarProof !== "" && !/^\d+:\d+:(true|false)$/.test(s.solarProof)) throw new Error("Invalid saved power state");
    const model = new LighthousePower({mainWh:s.mainWh,backupWh:s.backupWh,fuel:s.fuel,reserveFuel:s.reserveFuel});
    model.mainWh = s.mainWh;
    model.backupWh = s.backupWh;
    model.fuel = s.fuel;
    model.reserveFuel = s.reserveFuel;
    model.generatorRunning = s.generatorRunning;
    model.protected = s.protected;
    model.warning = s.warning;
    model.ready = s.ready;
    model.revision = s.revision;
    model.solarProof = s.solarProof;
    model.generatorProof = s.generatorProof;
    model.recoveryProof = s.recoveryProof;
    model.generatorObserved = s.generatorObserved;
    model.events = s.events;
    model.nextId = s.nextId;
    model.synchronize(op,maintenance); return model;
  }
  private pathRevision(m: LighthouseMaintenanceSnapshot) { return `${m.revision.charger}:${m.revision.solar}:${m.chargeIsolated}`; }
  private rates(hour: number, m: LighthouseMaintenanceSnapshot, test: boolean, selfTest: boolean) {
    const trial = m.trial && test, demand = lighthouseNavigationRequired(hour) || m.detectedDemand;
    const trialAllowed = this.mainWh >= C.mainCapacityWh * C.recover - EPS;
    const mainAllowed = !this.protected && this.mainWh > EPS;
    const backupAvailable = this.backupWh > EPS || this.generatorRunning;
    const main = (demand || test) && !m.driveFault && (!m.mainIsolated || trial) && (mainAllowed || trial && trialAllowed)
      && (!m.forcedBackup || !backupAvailable || trial);
    const backup = !main && backupAvailable && (demand || m.forcedBackup || selfTest);
    const generator = this.generatorRunning ? C.generatorW : 0;
    const generatorBackup = generator ? this.backupWh < C.backupCapacityWh - EPS ? C.backupChargeW : backup ? C.backupW : 0 : 0;
    const generatorMain = generator - generatorBackup;
    const solarSurfaceFactor = m.chargerFault || m.chargeIsolated ? 0 : m.solarDirty ? m.solarLatent ? .85 : .2 : 1;
    const solarFactor = solarSurfaceFactor * this.weatherSolar;
    const solar = lighthouseSolarW(hour) * solarFactor;
    const mainLoad = C.controlW + (main ? C.mainLampW : 0);
    return {mainAllowed, trialAllowed, backupAvailable, solarSurfaceFactor, solarFactor, solar, generator, generatorMain, generatorBackup,
      mainLoad, backupLoad: backup ? C.backupW : 0};
  }
  synchronize(op: LighthouseOperationSnapshot, m: LighthouseMaintenanceSnapshot) {
    if (this.events[0]?.day <= op.dutyDay - 7) this.events = Object.freeze(this.events.filter(e=>e.day>op.dutyDay-7));
    const r = this.rates(op.hour, m, op.testSecondsRemaining > 0, m.selfTestSecondsRemaining > 0);
    const boundedNet = (e: number, cap: number, n: number) => e >= cap - EPS ? Math.min(0, n) : e <= EPS ? Math.max(0, n) : n;
    this.current = Object.freeze({mainWh: this.mainWh, backupWh: this.backupWh, mainFraction: this.mainWh / C.mainCapacityWh, backupFraction: this.backupWh / C.backupCapacityWh,
      protected: this.protected, recoveryReady: this.protected && this.mainWh >= C.mainCapacityWh * C.recover - EPS, warning: this.warning,
      mainAllowed: r.mainAllowed, trialAllowed: r.trialAllowed, backupAvailable: r.backupAvailable, solarW: r.solar,
      generatorW: r.generator, generatorMainW: r.generatorMain, generatorBackupW: r.generatorBackup,
      mainLoadW: r.mainLoad, backupLoadW: r.backupLoad, mainNetW: boundedNet(this.mainWh, C.mainCapacityWh, r.solar + r.generatorMain - r.mainLoad),
      backupNetW: boundedNet(this.backupWh, C.backupCapacityWh, r.generatorBackup - r.backupLoad), generatorRunning: this.generatorRunning,
      fuel: this.fuel, reserveFuel: this.reserveFuel, remainingHours: this.fuel / C.fuelPerHour, revision: this.revision,
      action: this.action, notice: this.notice, events: this.events, solarVerified: this.solarProof === this.pathRevision(m), generatorVerified: this.generatorProof,
      exerciseComplete:this.recoveryProof===this.revision&&this.generatorObserved&&this.reserveFuel<C.reserveFuel});
  }
  advance(frame: TimeOfDayAdvance, op: LighthouseOperationSnapshot, m: LighthouseMaintenanceSnapshot, weatherTo = this.weatherSolar) {
    const hours = frame.automaticHours;
    if (!Number.isFinite(hours) || hours < 0 || hours > 1 / 600 + EPS || !Number.isFinite(frame.fromHour)
      || !Number.isFinite(frame.activeSeconds) || frame.activeSeconds < 0 || frame.activeSeconds > .10000001) return;
    if (!Number.isFinite(weatherTo) || weatherTo < 0 || weatherTo > 1) throw new RangeError("Invalid solar weather endpoint");
    const weatherFrom = this.weatherSolar, slope = hours > 0 ? (weatherTo-weatherFrom)/hours : 0;
    let remaining = hours, elapsed = 0, hour = frame.fromHour, day = op.dutyDay;
    for (let count = 0; remaining > 1e-12 && count < 32; count++) {
      if (hour >= 24 - 1e-10) {hour = 0; day++;}
      const activeAt = elapsed / hours * frame.activeSeconds;
      const test = op.testSecondsRemaining > activeAt + 1e-10, selfTest = m.selfTestSecondsRemaining > activeAt + 1e-10;
      const r = this.rates(hour, m, test, selfTest);
      const boundary = [6, 12, 18, 24].find(h => h > hour + 1e-10)!;
      let step = Math.min(remaining, boundary - hour, this.generatorRunning ? this.fuel / C.fuelPerHour : Infinity);
      for (const seconds of [op.testSecondsRemaining, m.selfTestSecondsRemaining]) if (seconds > activeAt + 1e-10)
        step = Math.min(step, seconds / frame.activeSeconds * hours - elapsed);
      const factorAt = (h: number) => (weatherFrom+slope*(elapsed+h-hour))*r.solarSurfaceFactor;
      const netAt = (h: number) => lighthouseSolarW(h) * factorAt(h) + r.generatorMain - r.mainLoad;
      const root = (end: number, fn: (t: number) => number, target: number) => {
        let lo = 0, hi = end; const increasing = fn(end) > fn(0);
        for (let i = 0; i < 48; i++) {const mid = (lo + hi) / 2; if ((fn(mid) < target) === increasing) lo = mid; else hi = mid;}
        return (lo + hi) / 2;
      };
      const derivative = (t: number) => C.solarPeakW*r.solarSurfaceFactor*(Math.PI/12*Math.cos((hour+t-6)*Math.PI/12)
        *(weatherFrom+slope*(elapsed+t))+slope*Math.sin((hour+t-6)*Math.PI/12));
      if (slope !== 0 && hour >= 6 && hour+step <= 18 && derivative(0)*derivative(step) < 0) {
        const turning=root(step,derivative,0);
        if (turning>1e-10&&step-turning>1e-10) step=turning;
      }
      if (netAt(hour) * netAt(hour + step) < -EPS) step = root(step, t => netAt(hour + t), 0);
      const mainDelta = (t: number) => (slope === 0 ? lighthouseSolarWh(hour,t)*weatherFrom
        : lighthouseWeatherSolarWh(hour,t,weatherFrom+slope*elapsed,slope))*r.solarSurfaceFactor + (r.generatorMain-r.mainLoad)*t;
      const backupDelta = (t: number) => (r.generatorBackup - r.backupLoad) * t;
      for (const [energy, targets, delta] of [[this.mainWh, [0, C.mainCapacityWh * C.protect, C.mainCapacityWh * C.recover, C.mainCapacityWh * C.warning, C.mainCapacityWh], mainDelta],
        [this.backupWh, [0, C.backupCapacityWh], backupDelta]] as [number, number[], (t: number) => number][]) {
        for (const target of targets) {
          const difference = target - energy, end = delta(step);
          if (Math.abs(difference) > EPS && difference * end > 0 && Math.abs(difference) <= Math.abs(end) + 1e-10)
            step = Math.min(step, root(step, delta, difference));
        }
      }
      const change = mainDelta(step);
      this.mainWh = Math.max(0, Math.min(C.mainCapacityWh, this.mainWh + change));
      this.backupWh = Math.max(0, Math.min(C.backupCapacityWh, this.backupWh + backupDelta(step)));
      if (this.generatorRunning) this.fuel = Math.max(0, this.fuel - step * C.fuelPerHour);
      hour += step; elapsed += step; remaining -= step;
      const at = {hour: hour >= 24 - 1e-10 ? 0 : hour, dutyDay: day + (hour >= 24 - 1e-10 ? 1 : 0)};
      const warning = this.mainWh < C.mainCapacityWh * C.warning - EPS || Math.abs(this.mainWh - C.mainCapacityWh * C.warning) <= EPS && change <= 0;
      if (warning !== this.warning) {this.warning = warning; this.log(at, warning ? "low-warning" : "warning-cleared", warning ? "主电池达到25%低电预警。" : "主电池回升越过25%，低电预警解除。");}
      if (!this.protected && this.mainWh <= C.mainCapacityWh * C.protect + EPS) {this.protected = true; this.generatorObserved=false; this.revision++; this.log(at, "main-protected", "主电池达到10%，主灯低电保护；按实际备用供电接替。");}
      const ready = this.protected && this.mainWh >= C.mainCapacityWh * C.recover - EPS;
      if (ready && !this.ready) this.log(at, "recovery-ready", "回充达到20%；保持低电保护，需在电池柜用检测工具复验。");
      this.ready = ready;
      if (this.generatorRunning && this.fuel <= EPS) {this.fuel = 0; this.generatorRunning = false; this.generatorProof = false; this.notice="燃料耗尽，机组停止；不能据启动记录判断仍在充电。"; this.log(at, "fuel-empty", this.notice);}
      if (step < 1e-12) break;
    }
    this.weatherSolar = weatherTo;
    this.synchronize({...op, hour: frame.toHour}, m);
  }
  cancel(op: LighthouseOperationSnapshot) {
    if (!this.action) return;
    this.action = undefined; this.notice = "操作中断；未补给、未扣储备、未完成复验。"; this.log(op, "cancelled", this.notice);
  }
  command(command: PowerCommand, location: string, tool: LighthouseTool, accessible: boolean, automatic: boolean, op: LighthouseOperationSnapshot, m: LighthouseMaintenanceSnapshot) {
    this.synchronize(op, m);
    const expected = command === "verify-main" ? "lighthouse-battery-main" : command === "probe-solar" ? "lighthouse-solar-charger" : "lighthouse-generator";
    if (!accessible || location !== expected) return this.reject("请在对应设备旁站稳后操作。", op, m);
    if (command === "stop-generator") {this.cancel(op); if(this.generatorRunning){this.generatorRunning = false; this.generatorProof = false; this.log(op, "generator-stopped", "机组已停止，输出归零；可停机补给。");} this.notice = "机组已停止。"; this.synchronize(op,m); return true;}
    if (this.action) return this.reject("已有现场操作正在执行。",op,m);
    const reason = this.guard(command, tool, automatic, m);
    if (reason) return this.reject(reason,op,m);
    this.action = Object.freeze({command, location, elapsed: 0, duration: command.startsWith("probe-") ? 5 : command === "verify-main" ? 2 : 3,
      revision: command === "probe-solar" ? this.pathRevision(m) : String(this.revision), startWh: this.mainWh, inputWh: 0});
    this.notice = "返回场景保持看向设备；走开、开界面或失焦会中断。"; this.log(op, "action-started", this.notice); this.synchronize(op,m); return true;
  }
  advanceAction(frame: TimeOfDayAdvance, op: LighthouseOperationSnapshot, m: LighthouseMaintenanceSnapshot, sight: boolean, automatic: boolean,
    confirmSolar: (wh: number, revision: string) => void) {
    const a = this.action, dt = frame.activeSeconds;
    if (!a || dt <= 0 || dt > .10000001 || !Number.isFinite(dt)) return;
    const reason = this.guard(a.command, "meter", automatic, m);
    if (!sight || reason || (a.command === "probe-solar" ? this.pathRevision(m) : String(this.revision)) !== a.revision) {this.cancel(op); this.synchronize(op,m); return;}
    const elapsed = Math.min(a.duration, a.elapsed + dt);
    this.action = Object.freeze({...a, elapsed, inputWh: a.inputWh + (a.command === "probe-solar" ? this.snapshot.solarW : this.snapshot.generatorW) * frame.automaticHours});
    if (elapsed >= a.duration - EPS) {
      const finished = this.action; this.action = undefined;
      if (a.command === "start-generator") {this.generatorRunning = true; this.generatorProof = false; this.notice = "机组启动成功；有效充电需另行5秒采样。";}
      else if (a.command === "refuel") {const amount = Math.min(C.refill,C.fuelCapacity-this.fuel,this.reserveFuel);this.fuel += amount;this.reserveFuel -= amount;this.notice = `已补给${amount.toFixed(1)}燃料单位，储备同步扣除；未自动启动。`;}
      else if (a.command === "verify-main") {this.protected = false;this.ready = false;this.revision++;this.recoveryProof=this.revision;this.notice = "电池供电复验通过，低电保护解除；驱动故障和检修隔离仍独立求值。";}
      else {
        const delta = this.mainWh - a.startWh, pass = delta > EPS && finished.inputWh > EPS;
        if(pass) {if(a.command === "probe-solar"){this.solarProof=this.pathRevision(m);confirmSolar(delta,this.solarProof);}else this.generatorProof=this.generatorObserved=true;}
        this.notice = `5活跃秒主电池净变化 ${delta.toFixed(4)}Wh；${pass ? "实际正回充复验通过" : "未形成净回充，检查输入/负载或满电限充"}。`;
      }
      this.log(op,a.command,this.notice);
    }
    this.synchronize(op,m);
  }
  private guard(command: PowerCommand, tool: LighthouseTool, automatic: boolean, m: LighthouseMaintenanceSnapshot) {
    if(command === "start-generator") return this.generatorRunning ? "机组已运行，不重复启动。" : this.fuel <= EPS ? "燃料不足，请停机补给。" : "";
    if(command === "refuel") return this.generatorRunning ? "先停止机组再补给。" : this.reserveFuel <= EPS ? "储备不足，请联系支援补给。" : this.fuel >= C.fuelCapacity-EPS ? "油箱已满。" : "";
    if(tool !== "meter") return "此项复验请使用检测工具。";
    if(command === "verify-main") return !this.protected ? "主灯未处于低电保护，无需重复复验。" : this.mainWh < C.mainCapacityWh*C.recover-EPS ? "主电池需先回升到20%。" : m.driveFault ? "驱动故障仍在，需先完成驱动检修。" : "";
    if(!automatic) return "先开启自动流转，实际能量采样才会推进。";
    if(command === "probe-solar") return this.generatorRunning ? "太阳能复验需先停机组，排除混合来源。" : m.chargeIsolated ? "先重新接通太阳能支路。" : "";
    return this.generatorRunning ? "" : "机组未运行，请先启动。";
  }
  private reject(text: string, op: LighthouseOperationSnapshot,m:LighthouseMaintenanceSnapshot) {this.notice=text;this.synchronize(op,m);return false;}
  private log(at: {hour:number;dutyDay:number},type:string,result:string) {this.events=Object.freeze([...this.events.filter(e=>e.day>at.dutyDay-7).slice(-127),Object.freeze({id:this.nextId++,day:at.dutyDay,hour:at.hour,type,result})]);}
}
