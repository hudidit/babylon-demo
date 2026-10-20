import { LIGHTHOUSE_OPERATION } from "./LighthouseOperation";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export const LIGHTHOUSE_INSPECTION = Object.freeze({ observationSeconds: 10, cleaningSeconds: 1.5,
  dirtyTransmission: .82, coverId: "lighthouse-optics-cleaning", retainedDays: 7 });
export type LighthouseCheckId = "check-control" | "check-optic" | "check-cover";
export type LighthouseCheckStatus = "pending" | "dirty" | "awaiting-recheck" | "complete";
export interface LighthouseEvidence {
  readonly dutyDay: number; readonly hour: number; readonly result: string; readonly revision?: number;
}
export interface LighthouseInspectionEvent extends LighthouseEvidence {
  readonly id: number; readonly objectId: string; readonly kind: "observation" | "action" | "system";
  readonly type: "control-read" | "optic-observed" | "cover-observed" | "cleaning-started" | "cleaning-cancelled" | "cover-cleaned" | "duty-day-started" | "equipment-changed";
  readonly source: "local-panel" | "direct-view" | "active-action" | "automatic-clock";
}
export interface LighthouseDaySummary {
  readonly dutyDay: number; readonly checks: Readonly<Record<LighthouseCheckId, LighthouseCheckStatus>>;
  readonly completed: boolean;
}
export interface LighthouseInspectionSnapshot {
  readonly dutyDay: number;
  readonly checks: Readonly<Record<LighthouseCheckId, LighthouseCheckStatus>>;
  readonly control?: LighthouseEvidence; readonly optic?: LighthouseEvidence; readonly coverEvidence?: LighthouseEvidence;
  readonly dirty: boolean; readonly coverRevision: number; readonly transmission: number;
  readonly observationSeconds: number; readonly observedTurns: number; readonly outputSeen: boolean;
  readonly cleaning: boolean; readonly cleaningSeconds: number; readonly notice: string;
  readonly completed: boolean; readonly days: readonly LighthouseDaySummary[];
  readonly events: readonly LighthouseInspectionEvent[];
}
const EPS = 1e-8;

/** Session-only evidence and transactions. Equipment and the shared clock remain the sources of truth. */
export class LighthouseInspection {
  private dutyDay = 1;
  private dirty = true;
  private revision = 0;
  private control?: LighthouseEvidence;
  private optic?: LighthouseEvidence;
  private cover?: LighthouseEvidence;
  private coverStatus: LighthouseCheckStatus = "pending";
  private seconds = 0;
  private turns = 0;
  private outputSeen = false;
  private cleaning = false;
  private cleanSeconds = 0;
  private notice = "";
  private nextId = 1;
  private events: readonly LighthouseInspectionEvent[] = Object.freeze([]);
  private history: readonly LighthouseDaySummary[] = Object.freeze([]);
  private current: LighthouseInspectionSnapshot;

  constructor() { this.publish(); }
  get snapshot() { return this.current; }
  invalidateMain(op: LighthouseOperationSnapshot) {
    this.control = this.optic = undefined; this.resetObservation();
    this.record(op, "lighthouse-beacon-main", "system", "equipment-changed", "active-action", "驱动或供电隔离状态变化，旧读数/周期仅作历史；重新现场确认。");
    this.publish();
  }
  static canClean(op: LighthouseOperationSnapshot) {
    return op.state === "day-standby" && op.mode === "automatic" && !op.running && op.testSecondsRemaining === 0;
  }
  /** Called on commands as well as frames, so a running device cancels a pending transaction immediately. */
  synchronize(op: LighthouseOperationSnapshot) {
    if (op.dutyDay > this.dutyDay) {
      while (this.dutyDay < op.dutyDay) {
        this.history = Object.freeze([...this.history, this.summary()]); this.dutyDay++;
        this.control = this.optic = this.cover = undefined; this.coverStatus = "pending";
      }
      this.history = Object.freeze(this.history.filter(day => day.dutyDay > this.dutyDay - LIGHTHOUSE_INSPECTION.retainedDays));
      this.events = Object.freeze(this.events.filter(event => event.dutyDay > this.dutyDay - LIGHTHOUSE_INSPECTION.retainedDays));
      this.resetObservation();
      this.record({...op, hour: 0}, "lighthouse-maintenance-log", "system", "duty-day-started", "automatic-clock", "新值守日：三项检查待确认，表面状态保留");
      this.notice = "新值守日已建立三项检查，表面状态保留。"; this.publish();
    }
    if (this.cleaning && !LighthouseInspection.canClean(op)) this.cancelCleaning(op, "设备已运行，清洁中断；盐膜保持原状。");
    if (!op.running && !this.optic && this.seconds > 0) {this.resetObservation(); this.publish();}
  }
  confirmControl(op: LighthouseOperationSnapshot, accessible: boolean) {
    this.synchronize(op); if (!accessible) return false;
    const result = `${op.mode === "test" ? "限时试灯" : "自动值守"} / ${op.running ? op.detectedDemand ? "检测请求下主灯运行" : op.state === "night-running" ? "夜间导航运行" : "局部试灯运行" : op.state === "day-standby" ? "日间待机" : "主灯未运行，需核对备用与实际反馈"}`;
    if (this.control?.result !== result) this.record(op, "lighthouse-control-panel", "observation", "control-read", "local-panel", result);
    this.control = this.evidence(op, result); this.publish(); return true;
  }
  inspectCover(op: LighthouseOperationSnapshot, accessible: boolean) {
    this.synchronize(op); if (!accessible) return false;
    const result = this.dirty ? "保护面有轻度盐膜，需停机擦拭后复查" : "保护面洁净，复查通过";
    if (!this.cover || this.cover.revision !== this.revision) this.record(op, LIGHTHOUSE_INSPECTION.coverId,
      "observation", "cover-observed", "local-panel", result, this.revision);
    this.cover = this.evidence(op, result, this.revision); this.coverStatus = this.dirty ? "dirty" : "complete";
    this.notice = result; this.publish(); return true;
  }
  startCleaning(op: LighthouseOperationSnapshot, accessible: boolean) {
    this.synchronize(op);
    if (!accessible || this.cleaning || !this.dirty || this.coverStatus !== "dirty" || this.cover?.revision !== this.revision
      || !LighthouseInspection.canClean(op)) return false;
    this.cleaning = true; this.cleanSeconds = 0; this.notice = "保持看向保护面，正在擦拭…";
    this.record(op, LIGHTHOUSE_INSPECTION.coverId, "action", "cleaning-started", "local-panel", "开始擦拭", this.revision);
    this.publish(); return true;
  }
  cancelCleaning(op: LighthouseOperationSnapshot, reason: string) {
    if (!this.cleaning) return false;
    this.cleaning = false; this.cleanSeconds = 0; this.notice = reason;
    this.record(op, LIGHTHOUSE_INSPECTION.coverId, "action", "cleaning-cancelled", "active-action", reason, this.revision);
    this.publish(); return true;
  }
  advance(frame: TimeOfDayAdvance, before: LighthouseOperationSnapshot, op: LighthouseOperationSnapshot,
    sight: { optic: boolean; output: number; cover: boolean }) {
    this.synchronize(op);
    const dt = frame.activeSeconds;
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1 + EPS) return; // Accept only the shared clock's bounded active receipt.
    if (this.cleaning) {
      if (!sight.cover || !LighthouseInspection.canClean(before) || !LighthouseInspection.canClean(op)) {
        this.cancelCleaning(op, "离开、视线受阻或设备起动，清洁中断；盐膜保持原状。");
      } else {
        this.cleanSeconds = Math.min(LIGHTHOUSE_INSPECTION.cleaningSeconds, this.cleanSeconds + dt);
        if (this.cleanSeconds >= LIGHTHOUSE_INSPECTION.cleaningSeconds - EPS) {
          // Revalidate at commit, rather than treating elapsed time as permission to touch a running optic.
          if (LighthouseInspection.canClean(op) && sight.cover) {
            this.dirty = false; this.revision++; this.cleaning = false; this.cleanSeconds = 0;
            this.coverStatus = "awaiting-recheck"; this.notice = "擦拭完成。请再次查看保护面并复查。";
            this.record(op, LIGHTHOUSE_INSPECTION.coverId, "action", "cover-cleaned", "active-action", "盐膜已清除，待复查", this.revision);
          }
        }
        this.publish();
      }
    }
    if (this.optic) return;
    const phase = (op.rotationTurns - before.rotationTurns + 1) % 1;
    if (!sight.optic || !before.running || !op.running || before.dutyDay !== op.dutyDay
      || Math.abs(phase - dt / LIGHTHOUSE_OPERATION.rotationSeconds) > 1e-6) {
      if (this.seconds > 0) { this.resetObservation(); this.publish(); } return;
    }
    this.seconds = Math.min(LIGHTHOUSE_INSPECTION.observationSeconds, this.seconds + dt);
    this.turns += phase; this.outputSeen ||= sight.output > .25;
    if (this.seconds >= LIGHTHOUSE_INSPECTION.observationSeconds - EPS && this.turns >= 1 - EPS && this.outputSeen) {
      this.optic = this.evidence(op, "本次周期观察正常：连续10活跃秒、转台一圈及方向出光");
      this.record(op, "lighthouse-beacon-main", "observation", "optic-observed", "direct-view", this.optic.result);
      this.notice = "本次周期观察正常，已记录；此结果不代表全面检修。";
    }
    this.publish();
  }
  private resetObservation() { this.seconds = this.turns = 0; this.outputSeen = false; }
  private evidence(op: LighthouseOperationSnapshot, result: string, revision?: number): LighthouseEvidence {
    return Object.freeze({dutyDay: this.dutyDay, hour: op.hour, result, ...(revision === undefined ? {} : {revision})});
  }
  private record(op: LighthouseOperationSnapshot, objectId: string, kind: LighthouseInspectionEvent["kind"],
    type: LighthouseInspectionEvent["type"], source: LighthouseInspectionEvent["source"], result: string, revision?: number) {
    this.events = Object.freeze([...this.events, Object.freeze({...this.evidence(op, result, revision), id: this.nextId++, objectId, kind, type, source})]);
  }
  private summary(): LighthouseDaySummary {
    const checks = Object.freeze({"check-control": this.control ? "complete" : "pending", "check-optic": this.optic ? "complete" : "pending",
      "check-cover": this.coverStatus}) as LighthouseDaySummary["checks"];
    return Object.freeze({dutyDay: this.dutyDay, checks, completed: !!this.control && !!this.optic && this.coverStatus === "complete"});
  }
  private publish() {
    const summary = this.summary();
    this.current = Object.freeze({...summary, control: this.control, optic: this.optic, coverEvidence: this.cover,
      dirty: this.dirty, coverRevision: this.revision, transmission: this.dirty ? LIGHTHOUSE_INSPECTION.dirtyTransmission : 1,
      observationSeconds: this.seconds, observedTurns: this.turns, outputSeen: this.outputSeen,
      cleaning: this.cleaning, cleaningSeconds: this.cleanSeconds, notice: this.notice,
      days: Object.freeze([...this.history, summary]), events: this.events});
  }
}
