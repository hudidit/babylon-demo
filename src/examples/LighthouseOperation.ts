import { DEFAULT_TIME_OF_DAY, wrapTimeOfDay } from "./RoomTimeOfDay";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export const LIGHTHOUSE_OPERATION_VERSION = "lighthouse-operation-v1";
export const LIGHTHOUSE_OPERATION = Object.freeze({ deviceId: "lighthouse-beacon-main",
  startHour: 18, stopHour: 6, rotationSeconds: 10, testSeconds: 30, retainedDays: 7 });
export type LighthouseOperatingState = "day-standby" | "night-running" | "test-running";
export type LighthouseEventSource = "system" | "automatic-clock" | "manual-time" | "command" | "active-time";
export type LighthouseEventType = "initialized" | "state-changed" | "time-selected" | "duty-day-started"
  | "test-started" | "test-ended" | "test-expired" | "test-superseded";

export interface LighthouseOperationEvent {
  readonly id: number;
  readonly dutyDay: number;
  readonly hour: number;
  readonly objectId: string;
  readonly type: LighthouseEventType;
  readonly source: LighthouseEventSource;
  readonly result: LighthouseOperatingState;
  readonly previousState?: LighthouseOperatingState;
}

export interface LighthouseOperationSnapshot {
  readonly deviceId: string;
  readonly hour: number;
  readonly dutyDay: number;
  readonly mode: "automatic" | "test";
  readonly state: LighthouseOperatingState;
  readonly running: boolean;
  readonly available: boolean;
  readonly detectedDemand: boolean;
  readonly testSecondsRemaining: number;
  readonly rotationTurns: number;
  readonly rotationRadians: number;
  /** Scene hours accepted by the automatic clock while the main light is running. */
  readonly automaticOperatingHours: number;
  readonly events: readonly LighthouseOperationEvent[];
}

export function lighthouseNavigationRequired(hour: number): boolean {
  const h = wrapTimeOfDay(hour);
  return h >= LIGHTHOUSE_OPERATION.startHour || h < LIGHTHOUSE_OPERATION.stopHour;
}

const EPSILON = 1e-10;

/** Single source of equipment truth. No rendering, wall clock, timers or camera-distance gates. */
export class LighthouseOperation {
  private hour = DEFAULT_TIME_OF_DAY;
  private dutyDay = 1;
  private state: LighthouseOperatingState = "day-standby";
  private testRemaining = 0;
  private turns = 0;
  private operatingHours = 0;
  private available = true;
  private detectedDemand = false;
  private nextEventId = 1;
  private events: readonly LighthouseOperationEvent[] = Object.freeze([]);
  private current: LighthouseOperationSnapshot;

  constructor() { this.record("initialized", "system"); this.publish(); }

  get snapshot(): LighthouseOperationSnapshot { return this.current; }

  /** Equipment gate and detector share this controller; there is no second main-light clock. */
  configure(available: boolean, detectedDemand: boolean) {
    if (this.available === available && this.detectedDemand === detectedDemand) return;
    this.available = available; this.detectedDemand = detectedDemand;
    this.updateState("system"); this.publish();
  }

  /** Local UI/proximity checks belong to the scene interaction added in the next stage. */
  startTest(): boolean {
    if (!this.available || this.testRemaining > 0) return false;
    this.testRemaining = LIGHTHOUSE_OPERATION.testSeconds;
    this.updateState("command"); this.record("test-started", "command"); this.publish();
    return true;
  }

  endTest(): boolean {
    if (this.testRemaining === 0) return false;
    this.testRemaining = 0;
    this.updateState("command"); this.record("test-ended", "command"); this.publish();
    return true;
  }

  /** An immediate selection or completed fade changes only the schedule, never the calendar or phase. */
  selectTime(hour: number): void {
    const selected = wrapTimeOfDay(hour);
    if (selected === this.hour) return;
    this.applyHour(selected, "manual-time");
    this.record("time-selected", "manual-time"); this.publish();
  }

  /** Consume the shared clock exactly once per scene frame. Hiding the coast freezes device motion only. */
  advance(frame: TimeOfDayAdvance, deviceVisible = true): void {
    const hours = frame.automaticHours, seconds = deviceVisible ? frame.activeSeconds : 0;
    if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(frame.activeSeconds) || frame.activeSeconds < 0) return;
    if (hours === 0 && seconds === 0 && !frame.manualCompleted) return;
    let remaining = 1;
    while (remaining > EPSILON) {
      // Split at real schedule/day boundaries and test expiry, preserving sub-frame event times.
      const boundary = this.hour < 6 ? 6 : this.hour < 18 ? 18 : 24;
      const untilBoundary = hours > 0 ? (boundary - this.hour) / hours : Infinity;
      const untilExpiry = seconds > 0 && this.testRemaining > 0 ? this.testRemaining / seconds : Infinity;
      const fraction = Math.min(remaining, untilBoundary, untilExpiry);
      if (this.available && this.state !== "day-standby") {
        this.turns = (this.turns + seconds * fraction / LIGHTHOUSE_OPERATION.rotationSeconds) % 1;
        if (this.turns < EPSILON || 1 - this.turns < EPSILON) this.turns = 0;
        this.operatingHours += hours * fraction;
      }
      if (this.testRemaining > 0) this.testRemaining = Math.max(0, this.testRemaining - seconds * fraction);
      this.hour += hours * fraction;
      remaining -= fraction;
      if (untilBoundary <= fraction + EPSILON) {
        if (boundary === 24) {
          this.hour = 0; this.dutyDay++;
          this.events = Object.freeze(this.events.filter(event => event.dutyDay > this.dutyDay - LIGHTHOUSE_OPERATION.retainedDays));
          this.record("duty-day-started", "automatic-clock");
        } else this.applyHour(boundary, "automatic-clock");
      }
      if (untilExpiry <= fraction + EPSILON) {
        this.testRemaining = 0;
        this.updateState("active-time"); this.record("test-expired", "active-time");
      }
    }
    if (hours > 0) this.hour = frame.toHour;
    if (frame.manualCompleted) this.selectTime(frame.toHour);
    this.publish();
  }

  private applyHour(hour: number, source: LighthouseEventSource) {
    const enteringNight = this.state !== "night-running" && (lighthouseNavigationRequired(hour) || this.detectedDemand);
    this.hour = hour;
    const superseded = enteringNight && this.testRemaining > 0;
    if (superseded) this.testRemaining = 0;
    this.updateState(source);
    if (superseded) this.record("test-superseded", source);
  }

  private updateState(source: LighthouseEventSource) {
    const previous = this.state;
    this.state = lighthouseNavigationRequired(this.hour) || this.detectedDemand ? "night-running" : this.testRemaining > 0 ? "test-running" : "day-standby";
    if (this.state !== previous) this.record("state-changed", source, previous);
  }

  private record(type: LighthouseEventType, source: LighthouseEventSource, previousState?: LighthouseOperatingState) {
    this.events = Object.freeze([...this.events, Object.freeze({ id: this.nextEventId++, dutyDay: this.dutyDay,
      hour: this.hour, objectId: LIGHTHOUSE_OPERATION.deviceId, type, source, result: this.state,
      ...(previousState ? { previousState } : {}) })]);
  }

  private publish() {
    this.current = Object.freeze({ deviceId: LIGHTHOUSE_OPERATION.deviceId, hour: this.hour, dutyDay: this.dutyDay,
      mode: this.testRemaining > 0 ? "test" : "automatic", state: this.state, running: this.available && this.state !== "day-standby",
      available: this.available, detectedDemand: this.detectedDemand,
      testSecondsRemaining: this.testRemaining, rotationTurns: this.turns, rotationRadians: this.turns * Math.PI * 2,
      automaticOperatingHours: this.operatingHours, events: this.events });
  }
}
