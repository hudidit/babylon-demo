import {saveFields, saveObject, saveNumber, saveDay, saveHour, saveBoolean, saveEnum, saveArray, saveOptional, saveText, saveRevision, savedEventOrder} from "./LighthouseSaveValidation";
import { lighthouseNavigationRequired, LIGHTHOUSE_OPERATION } from "./LighthouseOperation";
import type { LighthouseOperation, LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export type LighthouseDrill = "normal" | "drive" | "charger" | "sensor" | "power";
export type LighthouseTool = "meter" | "cloth" | "drive-module" | "charger-module";
export type MaintenanceCommand = "inspect" | "surface-test" | "diagnose" | "clean" | "replace" | "self-test" | "takeover"
  | "isolate-main" | "trial" | "restore" | "isolate-charge" | "reconnect" | "probe" | "override-on" | "override-off" | "verify-sensor";
type Component = "drive" | "backup" | "charger" | "solar" | "sensor";
export interface MaintenanceEvidence { readonly id: number; readonly component: Component; readonly revision: number;
  readonly day: number; readonly hour: number; readonly method: string; readonly result: string; }
export interface MaintenanceAction { readonly command: MaintenanceCommand; readonly location: string; readonly tool: LighthouseTool;
  readonly component: Component; readonly revision: number; readonly elapsed: number; readonly duration: number; readonly energyWh: number; }
export interface LighthouseMaintenanceSnapshot {
  readonly solarLatent: boolean; readonly solarRecheck: boolean; readonly nextSolarMaintenanceDay: number; readonly session: LighthouseDrill; readonly revision: Readonly<Record<Component, number>>;
  readonly driveFault: boolean; readonly chargerFault: boolean; readonly solarDirty: boolean; readonly sensorDirty: boolean;
  readonly mainIsolated: boolean; readonly chargeIsolated: boolean; readonly override: boolean; readonly trial: boolean;
  readonly forcedBackup: boolean;
  readonly mainAvailable: boolean; readonly detectedDemand: boolean; readonly navigationRequired: boolean;
  readonly source: "main" | "backup" | "none"; readonly backupOn: boolean; readonly backupFlash: boolean; readonly backupPhase: number;
  readonly selfTestSecondsRemaining: number;
  readonly backupConfirmed: boolean; readonly mainVerified: boolean; readonly chargerVerified: boolean; readonly sensorVerified: boolean;
  readonly backupObservationSeconds:number; readonly backupFlashesSeen:boolean;
  readonly inventory: Readonly<{drive: number; charger: number}>;
  readonly action?: MaintenanceAction; readonly trialObserved: number; readonly notice: string;
  readonly evidence: readonly MaintenanceEvidence[]; readonly resolved: boolean;
}
const componentAt = (location: string): Component | undefined => ({"lighthouse-drive-hatch": "drive", "lighthouse-beacon-backup": "backup",
  "lighthouse-solar-charger": "charger", "lighthouse-solar-array": "solar", "lighthouse-light-sensor": "sensor"} as Record<string, Component>)[location];
export const LIGHTHOUSE_MAINTENANCE = Object.freeze({backupPeriod: 10, backupBright: .8, selfTestSeconds: 12,
  observationSeconds: 10, probeSeconds: 5});
const EPS = 1e-7;
const actionLabels: Partial<Record<MaintenanceCommand, string>> = {inspect: "现场观察", "surface-test": "表面细查", diagnose: "隔离检测", clean: "擦拭表面", replace: "模块替换", probe: "回充采样", "verify-sensor": "光敏复测"};

/** Device facts, local transactions and revision-bound observations, independent of rendering/storage. */
export class LighthouseMaintenance {
  private solarLatent = false;
  private loggedSurfaceClues = new Set<number>();
  private surfaceObserver?: (method: "patrol" | "surface-test", op: LighthouseOperationSnapshot) => {result: string; identified: boolean; id: number} | undefined;
  setSurfaceObserver(observer: typeof this.surfaceObserver) { this.surfaceObserver = observer; }
  private nextSolarMaintenanceDay = 6;
  private weatherDemand = false;
  private outsideWorkAllowed = true;
  get transientWeatherDemand() { return this.weatherDemand; }
  setWeatherDemand(required: boolean) { this.weatherDemand = required; }
  setOutsideWorkAllowed(allowed: boolean) { this.outsideWorkAllowed = allowed; }
  soilFromWeather(op: LighthouseOperationSnapshot, latent = false) {
    if (this.solarDirty) {
      if (this.solarLatent && !latent) {
        this.solarLatent = false; this.revision.solar++; delete this.inspection.solar; this.chargerProof = -1;
        this.log(op, "solar", "天气暴露污损", "表面污损已明显，请重新巡视、清洁和复查。"); this.publish(op);
      }
      return;
    }
    this.solarLatent = latent;
    this.solarDirty = true; this.revision.solar++; delete this.inspection.solar; this.chargerProof = -1;
    this.log(op, "solar", latent ? "输入变化待查" : "天气暴露污损", latent ? "太阳能输入条件变化，请对照天气和日照，必要时现场细查表面。" : "太阳能表面出现污损，等待合适天气现场巡视、擦拭和独立复查。");
    this.publish(op);
  }
  private driveFault = false; private chargerFault = false; private solarDirty = false; private sensorDirty = false;
  private mainIsolated = false; private chargeIsolated = false; private override = false; private forcedBackup = false;
  private backupAvailable = true; private selfRemaining = 0; private backupPhase = 0; private backupWasOn = false;
  private powerMain = true; private powerTrial = true;
  private powerCompleted = false;
  private backupObserved = 0; private backupSeen = false; private backupProof = false;
  private backupContext = "off";
  private lastSource?: "main" | "backup" | "none"; private lastRequired = false;
  private trial = false; private trialObserved = 0; private trialSeen = false; private trialTurns = 0; private lastTrialPhase = 0;
  private mainProof = -1; private chargerProof = -1; private sensorProof = -1;
  private diagnosis: Partial<Record<Component, number>> = {}; private inspection: Partial<Record<Component, number>> = {};
  private revision: Record<Component, number> = {drive: 0, backup: 0, charger: 0, solar: 0, sensor: 0};
  private inventory = {drive: 1, charger: 1}; private action?: MaintenanceAction; private notice = "";
  private nextId = 1; private evidence: readonly MaintenanceEvidence[] = Object.freeze([]);
  private current!: LighthouseMaintenanceSnapshot;
  constructor(readonly session: LighthouseDrill = "normal") {
    this.driveFault = session === "drive"; this.chargerFault = this.solarDirty = session === "charger"; this.sensorDirty = session === "sensor";
    this.publish({hour: session === "drive" ? 21 : 12, running: false} as LighthouseOperationSnapshot);
  }
  get snapshot() { return this.current; }
  renewBackupObservation(op:LighthouseOperationSnapshot) {
    this.backupObserved=0;this.backupSeen=false;this.backupProof=false;this.publish(op);
  }
  exportWeatherState() {return {solarLatent:this.solarLatent,loggedSurfaceClues:Array.from(this.loggedSurfaceClues)};}
  restoreWeatherState(value:unknown,op:LighthouseOperationSnapshot) {
    const s=saveObject({solarLatent:saveBoolean,loggedSurfaceClues:saveArray(saveDay,128)})(value);
    if(s.solarLatent&&!this.solarDirty||new Set(s.loggedSurfaceClues).size!==s.loggedSurfaceClues.length)throw new Error("Invalid saved solar/knowledge state");
    this.solarLatent=s.solarLatent;this.loggedSurfaceClues=new Set(s.loggedSurfaceClues);this.publish(op);
  }
  exportState() {return {...saveFields(this, ["driveFault", "chargerFault", "solarDirty", "sensorDirty", "mainIsolated", "chargeIsolated", "override", "forcedBackup", "backupAvailable", "selfRemaining", "backupPhase", "backupWasOn", "powerMain", "powerTrial", "powerCompleted", "backupProof", "backupContext", "lastSource", "lastRequired", "trial", "mainProof", "chargerProof", "sensorProof", "diagnosis", "inspection", "revision", "inventory", "evidence", "nextId", "nextSolarMaintenanceDay"]), session: this.session};}
  static fromSave(value: unknown, op: LighthouseOperationSnapshot) {
    const components = ["drive", "backup", "charger", "solar", "sensor"];
    const revisions = saveObject({drive:saveRevision, backup:saveRevision, charger:saveRevision, solar:saveRevision, sensor:saveRevision});
    const partial = saveObject({drive:saveOptional(saveRevision), backup:saveOptional(saveRevision), charger:saveOptional(saveRevision), solar:saveOptional(saveRevision), sensor:saveOptional(saveRevision)});
    const s = saveObject({session:saveEnum("normal", "drive", "charger", "sensor", "power"), driveFault: saveBoolean, chargerFault: saveBoolean, solarDirty: saveBoolean, sensorDirty: saveBoolean, mainIsolated: saveBoolean, chargeIsolated: saveBoolean, override: saveBoolean, forcedBackup: saveBoolean, backupAvailable: saveBoolean, backupWasOn: saveBoolean, powerMain: saveBoolean, powerTrial: saveBoolean, powerCompleted: saveBoolean, backupProof: saveBoolean, lastRequired: saveBoolean, trial: saveBoolean, selfRemaining: saveNumber(0,12), backupPhase: saveNumber(0,10), backupContext: saveEnum("off", "actual", "self-test"), lastSource: saveOptional(saveEnum("main", "backup", "none")), mainProof: saveNumber(-1,1000000,true), chargerProof: saveNumber(-1,1000000,true), sensorProof: saveNumber(-1,1000000,true), revision: revisions, diagnosis: partial, inspection: partial, inventory: saveObject({drive: saveNumber(0,1000,true), charger: saveNumber(0,1000,true)}), nextId: saveDay, nextSolarMaintenanceDay: saveDay, evidence: saveArray(saveObject({id:saveDay, component:saveEnum(...components), revision:saveRevision, day:saveDay, hour:saveHour, method:saveText(64), result:saveText()}),128)})(value);
    if (s.nextId < savedEventOrder(s.evidence) || s.backupPhase === 10 || s.evidence.some(e => e.day > op.dutyDay || e.revision > s.revision[e.component])
      || ["mainProof", "chargerProof", "sensorProof"].some((key,index) => s[key] > s.revision[["drive","charger","sensor"][index]])
      || components.some(key => s.diagnosis[key] > s.revision[key] || s.inspection[key] > s.revision[key])
      || !s.solarDirty && s.nextSolarMaintenanceDay <= op.dutyDay) throw new Error("Invalid saved maintenance revisions");
    const model = new LighthouseMaintenance(s.session);
    model.driveFault = s.driveFault;
    model.chargerFault = s.chargerFault;
    model.solarDirty = s.solarDirty;
    model.sensorDirty = s.sensorDirty;
    model.mainIsolated = s.mainIsolated;
    model.chargeIsolated = s.chargeIsolated;
    model.override = s.override;
    model.forcedBackup = s.forcedBackup;
    model.backupAvailable = s.backupAvailable;
    model.selfRemaining = s.selfRemaining;
    model.backupPhase = s.backupPhase;
    model.backupWasOn = s.backupWasOn;
    model.powerMain = s.powerMain;
    model.powerTrial = s.powerTrial;
    model.powerCompleted = s.powerCompleted;
    model.backupProof = s.backupProof;
    model.backupContext = s.backupContext;
    model.lastSource = s.lastSource;
    model.lastRequired = s.lastRequired;
    model.trial = s.trial;
    model.mainProof = s.mainProof;
    model.chargerProof = s.chargerProof;
    model.sensorProof = s.sensorProof;
    model.diagnosis = {...s.diagnosis};
    model.inspection = {...s.inspection};
    model.revision = {...s.revision};
    model.inventory = {...s.inventory};
    model.evidence = s.evidence;
    model.nextId = s.nextId;
    model.nextSolarMaintenanceDay = s.nextSolarMaintenanceDay;
    model.publish(op); return model;
  }
  configurePower(main: boolean, trial: boolean, backup: boolean, op: LighthouseOperationSnapshot, completed=false) {
    this.powerMain = main; this.powerTrial = trial; this.powerCompleted=completed; this.setBackupAvailable(backup,op);
  }
  compareSolar(op: LighthouseOperationSnapshot, actualW: number, expectedW: number, recordReading = false) {
    const result = expectedW < 5 ? "现在日照太弱，输入低不一定是面板脏。可以先细查表面，等阳光足了再对照读数。"
      : `输入是${actualW.toFixed(1)} W，按现在的日照和天气，估计有${expectedW.toFixed(1)} W。` + (actualW < expectedW * .95
        ? "比估算值低，先去细查面板。光看读数，还判断不了内部原因。" : "与当前天气大致相符，设备内部还不能凭这个下结论。");
    const last = this.evidence[this.evidence.length - 1];
    if (recordReading || last?.method !== "读数对照" || last.result !== result) this.log(op, "solar", "读数对照", result);
    this.notice = result; this.publish(op);
  }
  confirmCharging(op: LighthouseOperationSnapshot, wh: number, revision: string) {
    if (wh <= 0 || !Number.isFinite(wh) || this.chargerFault || this.solarDirty || this.chargeIsolated
      || revision !== `${this.revision.charger}:${this.revision.solar}:${this.chargeIsolated}`) return false;
    this.chargerProof = this.revision.charger; this.log(op,"charger","实际回充复验",`当前修订太阳能支路主电池净增加${wh.toFixed(4)}Wh，复验通过。`);
    this.publish(op);return true;
  }
  synchronize(op: LighthouseOperation) {
    const state = op.snapshot;
    if (this.evidence[0]?.day <= state.dutyDay - 7) this.evidence = Object.freeze(this.evidence.filter(e => e.day > state.dutyDay - 7));
    if (state.dutyDay >= this.nextSolarMaintenanceDay && !this.solarDirty) {
      this.solarDirty = true; this.solarLatent = false; this.revision.solar++; delete this.inspection.solar; this.chargerProof = -1;
      this.log(state, "solar", "维护到期", "太阳能面板例行清洁到期，请现场巡视、擦拭和复查。");
      this.notice = "太阳能面板例行清洁到期。";
    }
    op.configure(this.mainAvailable(), this.weatherDemand || this.sensorDirty && !this.override);
    this.publish(op.snapshot);
    const s = this.snapshot;
    if (s.navigationRequired && (s.source !== this.lastSource || !this.lastRequired)) {
      this.log(op.snapshot, s.source === "backup" ? "backup" : "drive", s.source === "backup" ? "导航降级" : s.source === "none" ? "导航不可用" : "主灯导航",
        s.source === "backup" ? "主灯未反馈运行，备用按可用条件接替；等待现场复验，覆盖为临时降级。" : s.source === "none" ? "导航需求仍在，主备均不可用；保留待修并联系支援。" : "主灯实际运行，备用退出；现场检查仍需独立完成。");
      this.publish(op.snapshot);
    }
    this.lastSource = s.source; this.lastRequired = s.navigationRequired;
  }
  /** Used by later power/failure integration as well as the dual-failure safety test. */
  setBackupAvailable(available: boolean, op: LighthouseOperationSnapshot) {
    if (available === this.backupAvailable) return;
    this.backupAvailable = available; this.revision.backup++; this.backupProof = false;
    this.backupObserved = 0; this.backupSeen = false; this.backupContext = "off"; this.publish(op);
  }
  cancel(op: LighthouseOperationSnapshot, reason = "操作中断；未扣备件，设备保持原状。") {
    if (!this.action) return false;
    this.log(op, this.action.component, "中断", reason); this.action = undefined; this.notice = reason; this.publish(op); return true;
  }
  command(command: MaintenanceCommand, location: string, tool: LighthouseTool, op: LighthouseOperation, accessible: boolean) {
    this.synchronize(op); if (!accessible) return this.reject("请回到设备旁，站稳后操作。", op.snapshot);
    if (this.action) return this.reject("已有操作执行中，请完成或中断后再操作。", op.snapshot);
    const c = componentAt(location), state = op.snapshot, evidenceBefore = this.nextId;
    if (command === "takeover" && (c === "backup" || location === "control")) {
      if (!this.backupAvailable || this.trial) return this.reject("备用不可用或正在受控试机，无法接替。", state);
      if (!this.forcedBackup) {this.forcedBackup = true; this.backupProof = false; this.log(state, "backup", "受控接替", "备用支路接替；需在外廊现场观察实际灯质。");}
    } else if (command === "self-test" && c === "backup") {
      if (state.running || this.snapshot.navigationRequired || !this.backupAvailable || this.forcedBackup) return this.reject("有导航需求或主灯运行时请核对实际接替；自检只在日间空闲时开放。", state);
      if (!this.selfRemaining) {this.selfRemaining = LIGHTHOUSE_MAINTENANCE.selfTestSeconds; this.log(state, "backup", "开始自检", "12活跃秒自检；不作为实际接替证据。");}
    } else if (command === "isolate-main" && (c === "drive" || location === "control")) {
      if (this.snapshot.navigationRequired && (!this.snapshot.backupOn || !this.backupProof)) return this.reject("导航仍需要：先在外廊确认备用实际接替，不能用自检记录替代。", state);
      if (!this.mainIsolated) {this.mainIsolated = true; this.mainProof = -1; op.endTest(); this.log(state, "drive", "隔离", "主灯隔离，主备按实际可用条件求值。");}
    } else if (command === "trial" && c === "drive") {
      if (!this.powerTrial) return this.reject("供电不足：低电保护下试机需先回充至20%。",state);
      if (this.trial) return this.reject("受控试机已在执行，请完成观察后恢复，或等待超时回隔离。", state);
      if (!this.mainIsolated || this.driveFault || this.diagnosis.drive !== this.revision.drive) return this.reject("需在主灯隔离、检测通过且对应模块完好后受控试机。", state);
      if (this.snapshot.navigationRequired && (!this.backupAvailable || !this.backupProof)) return this.reject("试机前需确认备用可接回导航。", state);
      this.trial = true; this.trialObserved = this.trialTurns = 0; this.lastTrialPhase = state.rotationTurns; this.trialSeen = false; this.mainProof = -1;
      this.synchronize(op); op.startTest(); this.log(state, "drive", "受控试机", `测试支路临时接管；备用退出。看向主灯连续观察一圈，${LIGHTHOUSE_OPERATION.testSeconds}秒超时回隔离。`);
    } else if (command === "restore" && (c === "drive" || location === "control")) {
      if (this.mainIsolated && (this.driveFault || this.mainProof !== this.revision.drive)) return this.reject("主灯仍未通过本次修订的转动/出光复验，不能恢复。", state);
      if (this.driveFault) return this.reject("主灯请求/反馈仍不一致，继续保留备用与待修记录。", state);
      if (this.mainIsolated || this.forcedBackup || this.trial) {this.mainIsolated = this.forcedBackup = this.trial = false; op.endTest(); this.log(state, "drive", "恢复自动", "隔离清除、主灯按需求自动，备用退出。");}
    } else if (command === "isolate-charge" && c === "charger") {
      if (!this.chargeIsolated) {this.chargeIsolated = true; this.chargerProof = -1; this.log(state, "charger", "隔离", "充电支路隔离；导航支路保持独立。");}
    } else if (command === "reconnect" && c === "charger") {
      if (this.chargerFault || this.diagnosis.charger !== this.revision.charger) return this.reject("充电模块未检测通过，请保持隔离。", state);
      if (this.chargeIsolated) {this.chargeIsolated = false; this.chargerProof = -1; this.log(state, "charger", "重新接通", "支路重新接通；需独立进行回充采样复验。");}
    } else if (command === "override-on" && location === "control") {
      if (lighthouseNavigationRequired(state.hour)) return this.reject("夜间日程优先，不能用光敏覆盖关闭夜间导航。", state);
      if (!this.override) {this.override = true; this.sensorProof = -1; this.log(state, "sensor", "人工覆盖", "仅白天抑制光敏需求；清洁后必须撤销覆盖。");}
    } else if (command === "override-off" && location === "control") {
      if (this.override) {this.override = false; this.sensorProof = -1; this.log(state, "sensor", "撤销覆盖", "已撤销光敏覆盖；需现场复测。");}
    } else {
      if (!c) return this.reject("此处没有对应设备操作。", state);
      const reason = this.guard(command, c, tool, state);
      if (reason) return this.reject(reason, state);
      const duration = command === "replace" ? 3 : command === "probe" || command === "verify-sensor" || command === "surface-test" ? LIGHTHOUSE_MAINTENANCE.probeSeconds : 2;
      this.action = Object.freeze({command, location, component: c, tool, revision: this.revision[c], elapsed: 0, duration, energyWh: 0});
      this.notice = "回场景后，让准星对着设备。走开、打开界面或切走窗口都会停下。";
      this.log(state, c, "开始" + actionLabels[command], "开始现场操作，尚未提交或扣件。");
    }
    if (!this.action) this.notice = this.nextId > evidenceBefore ? this.evidence[this.evidence.length - 1].result : "状态保持，未重复执行或扣件。";
    this.synchronize(op); return true;
  }
  advance(frame: TimeOfDayAdvance, op: LighthouseOperation, sight: {action: boolean; backup: boolean; main: boolean; mainOutput: number}) {
    this.synchronize(op); const dt = frame.activeSeconds;
    if (!Number.isFinite(dt) || dt <= 0 || dt > .10000001) return;
    const state = op.snapshot, s = this.snapshot;
    const context = !s.backupOn ? "off" : this.selfRemaining > 0 && !s.navigationRequired && !this.forcedBackup ? "self-test" : "actual";
    if (context !== this.backupContext) {this.backupObserved = 0; this.backupSeen = false; this.backupProof = false; this.backupContext = context;}
    if (s.backupOn) {
      if (!this.backupWasOn) this.backupPhase = 0;
      this.backupPhase = (this.backupPhase + dt) % LIGHTHOUSE_MAINTENANCE.backupPeriod;
      if (sight.backup) {this.backupObserved += dt; this.backupSeen ||= s.backupFlash;}
      else this.backupObserved = 0, this.backupSeen = false;
      if (this.backupObserved >= LIGHTHOUSE_MAINTENANCE.observationSeconds - EPS && this.backupSeen) {
        if (!this.backupProof && context === "actual") {this.backupProof = true; this.log(state, "backup", "实际接替复验", "现场连续观察10活跃秒及白闪，确认实际备用导航；覆盖为临时降级。");}
        if (context === "self-test" && this.inspection.backup !== this.revision.backup) {this.inspection.backup = this.revision.backup; this.log(state, "backup", "自检复验", "现场自检一周期；不代表实际接替。");}
      }
    } else {this.backupObserved = 0; this.backupSeen = false; this.backupPhase = 0; this.backupProof = false;}
    this.backupWasOn = s.backupOn;
    const selfBefore = this.selfRemaining;
    this.selfRemaining = Math.max(0, this.selfRemaining - dt);
    if (selfBefore > 0 && this.selfRemaining === 0) this.log(state, "backup", "自检结束", "12活跃秒自检已结束；其观察不能代替实际接替。按实际导航需求重新求值。");
    if (this.trial) {
      if (state.testSecondsRemaining <= EPS) {this.trial = false; this.notice = "试机到期，主灯保持隔离；按需回备用。"; this.log(state, "drive", "试机到期", this.notice);}
      else if (sight.main && state.running && Math.abs((state.rotationTurns - this.lastTrialPhase + 1) % 1 - dt / LIGHTHOUSE_OPERATION.rotationSeconds) < 1e-6) {
        this.trialObserved += dt; this.trialTurns += dt / LIGHTHOUSE_OPERATION.rotationSeconds; this.trialSeen ||= sight.mainOutput > .25;
        if (this.trialObserved >= LIGHTHOUSE_OPERATION.rotationSeconds - EPS && this.trialTurns >= 1 - EPS && this.trialSeen && this.mainProof !== this.revision.drive) {
          this.mainProof = this.revision.drive; this.log(state, "drive", "试机复验", `连续观察${LIGHTHOUSE_OPERATION.rotationSeconds}秒、转动一圈及实际方向出光；可解除隔离恢复自动。`);
        }
      } else {this.trialObserved = this.trialTurns = 0; this.trialSeen = false;}
      this.lastTrialPhase = state.rotationTurns;
    }
    if (this.action) {
      const a = this.action, reason = this.guard(a.command, a.component, a.tool, state);
      if (!sight.action || reason || a.revision !== this.revision[a.component]) this.cancel(state, reason || "走远、被挡住或设备状态改变了，操作已停下，备件未扣。");
      else {
        const elapsed = Math.min(a.duration, a.elapsed + dt), accepted = elapsed - a.elapsed;
        this.action = Object.freeze({...a, elapsed});
        if (elapsed >= a.duration - EPS) this.commit(op);
      }
    }
    this.synchronize(op);
  }
  private guard(command: MaintenanceCommand, c: Component, tool: LighthouseTool, op: LighthouseOperationSnapshot): string {
    if (command === "clean" && c === "solar" && !this.outsideWorkAllowed) return "风雨中暂缓室外擦拭；先在室内读表，天气缓和后再操作。";
    if (command === "inspect") return "";
    if (command === "surface-test") return c === "solar" && tool === "meter" ? "" : "请在太阳能面板旁近距细查表面。";
    if (command === "diagnose") {
      if (tool !== "meter") return "请使用检测工具。";
      if (c === "drive" && (!this.mainIsolated || this.trial || op.running) || c === "charger" && !this.chargeIsolated) return "先隔离对应支路且停止试机，再进行模块检测。";
      if (c === "drive" && this.snapshot.navigationRequired && !this.snapshot.backupOn) return "导航支路当前不可用，停止检修并联系支援。";
      if (c === "charger" && (this.inspection.solar !== this.revision.solar || this.solarDirty)) return "先现场排除太阳能表面遮挡/污损。";
      return c === "drive" || c === "charger" ? "" : "此设备请采用现场观察或专用复测。";
    }
    if (command === "clean") {
      if (tool !== "cloth") return "请使用清洁布；清洁不会修复损坏模块。";
      if (this.inspection[c] !== this.revision[c]) return "先近距离看看现在的表面，再决定怎么清洁。";
      if (c === "sensor") return !this.sensorDirty ? "保护面已洁净，请撤销覆盖并复测。" : !this.override || lighthouseNavigationRequired(op.hour) ? "光敏清洁需在白天受控抑制检测需求，夜间日程优先。" : "";
      return c === "solar" ? this.solarDirty ? "" : "面板已洁净。" : "清洁只用于光敏保护面或太阳能表面，不能更换模块。";
    }
    if (command === "replace") {
      if (c !== "drive" && c !== "charger") return "此处没有可替换的对应模块。";
      if (tool !== (c === "drive" ? "drive-module" : "charger-module")) return "工具/备件与检测到的模块不匹配。";
      if (this.diagnosis[c] !== this.revision[c]) return "先用检测工具定位当前修订的异常。";
      if (c === "drive" && (!this.mainIsolated || this.trial) || c === "charger" && !this.chargeIsolated) return "需保持对应支路隔离且未在试机。";
      if (c === "drive" && this.snapshot.navigationRequired && !this.snapshot.backupOn) return "导航支路当前不可用，停止检修并联系支援。";
      if (!(c === "drive" ? this.driveFault : this.chargerFault)) return "模块没有需要替换的已诊断故障。";
      return this.inventory[c] > 0 ? "" : "对应备件不足；保留备用和待修记录，请联系支援补给。";
    }
    if (command === "probe") return "请使用实际能量采样入口，按自动场景时间核对主电池Wh。";
    if (command === "verify-sensor") return c !== "sensor" || tool !== "meter" ? "请在光敏保护面使用检测工具复测。" : this.override ? "先回首层撤销人工覆盖，再复测检测状态。" : "";
    return "当前设备不支持此操作。";
  }
  private commit(op: LighthouseOperation) {
    const a = this.action!; this.action = undefined; const c = a.component, state = op.snapshot;
    if (a.command === "inspect" || a.command === "surface-test") {
      const clue = c === "solar" ? this.surfaceObserver?.(a.command === "inspect" ? "patrol" : "surface-test", state) : undefined;
      if (c === "solar" && this.surfaceObserver && !clue) {this.notice = "离开设备区域，本次检查未记录。"; return;}
      if (!clue || clue.identified) this.inspection[c] = this.revision[c];
      else delete this.inspection[c];
      if (clue) {
        if (!this.loggedSurfaceClues.has(clue.id)) {
          this.log(state, c, a.command === "surface-test" ? "表面细查" : "现场观察", clue.result); this.loggedSurfaceClues.add(clue.id);
          if (this.loggedSurfaceClues.size > 128) this.loggedSurfaceClues.delete(this.loggedSurfaceClues.values().next().value);
        }
        this.notice = clue.result; return;
      }
      this.log(state, c, "现场观察", c === "solar" ? this.solarDirty ? "面板有遮挡污损。" : "面板表面清洁，支架固定。" : c === "sensor" ? this.sensorDirty ? "光敏保护面有污染，晴天检测需求异常。" : "光敏保护面洁净。" : "现场设备观察已记录，模块结论需使用检测工具。");
    } else if (a.command === "diagnose") {
      this.diagnosis[c] = this.revision[c];
      this.log(state, c, "隔离检测", (c === "drive" ? this.driveFault : this.chargerFault) ? "检测到对应模块反馈异常，需要匹配备件。" : "对应模块检测通过。");
    } else if (a.command === "replace") {
      this.inventory[c as "drive" | "charger"]--;
      if (c === "drive") this.driveFault = false; else this.chargerFault = false;
      this.revision[c]++; this.diagnosis[c] = undefined;
      this.log(state, c, "模块替换", "已扣1件对应备件并替换；保持隔离，重新检测和复验。");
    } else if (a.command === "clean") {
      if (c === "sensor") this.sensorDirty = false; else {this.solarDirty = false; this.solarLatent = false;}
      this.revision[c]++; this.inspection[c] = undefined;
      if (c === "solar") this.nextSolarMaintenanceDay = state.dutyDay + 5;
      this.log(state, c, "擦拭完成", "污膜擦掉了，再查一遍是否擦净。上次检查的是擦拭前的表面。");
    } else if (a.command === "verify-sensor") {
      const pass = !this.sensorDirty && !this.override;
      if (pass) this.sensorProof = this.revision.sensor;
      this.log(state, c, "检测工具复测", pass ? "光敏状态与日程一致，人工覆盖已撤销；正常夜间仍按日程亮灯。" : "检测需求仍与晴天日程不符，请检查保护面。");
    }
    this.notice = this.evidence[this.evidence.length - 1]?.result || "操作完成。";
  }
  private reject(reason: string, op: LighthouseOperationSnapshot) {this.notice = reason; this.publish(op); return false;}
  private log(op: LighthouseOperationSnapshot, component: Component, method: string, result: string) {
    this.evidence = Object.freeze([...this.evidence.slice(-127), Object.freeze({id: this.nextId++, component, revision: this.revision[component], day: op.dutyDay || 1, hour: op.hour, method, result})]);
  }
  private publish(op: LighthouseOperationSnapshot) {
    const required = lighthouseNavigationRequired(op.hour) || this.weatherDemand || this.sensorDirty && !this.override;
    const mainAvailable = this.mainAvailable();
    const main = mainAvailable && op.running;
    const backupOn = !main && this.backupAvailable && (required || this.forcedBackup || this.selfRemaining > 0);
    this.current = Object.freeze({solarLatent: this.solarLatent, solarRecheck: !this.solarDirty && this.revision.solar > 0 && this.inspection.solar !== this.revision.solar, nextSolarMaintenanceDay: this.nextSolarMaintenanceDay, session: this.session, revision: Object.freeze({...this.revision}), driveFault: this.driveFault, chargerFault: this.chargerFault,
      solarDirty: this.solarDirty, sensorDirty: this.sensorDirty, mainIsolated: this.mainIsolated, chargeIsolated: this.chargeIsolated, override: this.override,
      trial: this.trial, mainAvailable, detectedDemand: this.weatherDemand || this.sensorDirty && !this.override, navigationRequired: required,
      forcedBackup: this.forcedBackup,
      source: main ? "main" : backupOn ? "backup" : "none", backupOn, backupFlash: backupOn && this.backupPhase < LIGHTHOUSE_MAINTENANCE.backupBright,
      backupPhase: this.backupPhase, backupConfirmed: this.backupProof, mainVerified: this.mainProof === this.revision.drive,
      backupObservationSeconds:Math.min(LIGHTHOUSE_MAINTENANCE.observationSeconds,this.backupObserved),backupFlashesSeen:this.backupSeen,
      selfTestSecondsRemaining: this.selfRemaining,
      chargerVerified: this.chargerProof === this.revision.charger, sensorVerified: this.sensorProof === this.revision.sensor,
      inventory: Object.freeze({...this.inventory}), action: this.action, trialObserved: this.trialObserved, notice: this.notice, evidence: this.evidence,
      resolved: this.session === "drive" ? !this.driveFault && !this.mainIsolated && !this.forcedBackup && this.mainProof === this.revision.drive
        : this.session === "charger" ? !this.chargerFault && !this.chargeIsolated && !this.solarDirty && this.chargerProof === this.revision.charger
        : this.session === "sensor" ? !this.sensorDirty && !this.override && this.sensorProof === this.revision.sensor : this.session === "power" ? this.powerCompleted : false});
  }
  private mainAvailable() { return !this.driveFault && (!this.mainIsolated || this.trial) && (this.powerMain || this.trial && this.powerTrial) && (!this.forcedBackup || !this.backupAvailable || this.trial); }
}
