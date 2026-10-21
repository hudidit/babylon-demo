import { LighthouseRandom } from "./LighthouseRandom";
import { LighthouseVisibility, LighthouseWeatherSequence } from "./LighthouseWeather";
import type { LighthouseRandomStream } from "./LighthouseRandom";
import type { LighthouseWeatherKind, LighthouseWeatherSnapshot } from "./LighthouseWeather";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export const LIGHTHOUSE_WEATHER_RISK_VERSION = "lighthouse-weather-risk-v1";
export type LighthouseRiskComponent = "cover" | "solar" | "drive" | "charger" | "sensor" | "seal" | "backup";
export type LighthouseRemedy = "clean-cover" | "clean-solar" | "replace-drive" | "replace-charger" | "clean-sensor" | "repair-seal" | "repair-backup";
export interface LighthouseRiskRule {
  readonly component: LighthouseRiskComponent;
  readonly objectId: string;
  readonly remedy: LighthouseRemedy;
  readonly baseRatePerHour: number;
  readonly soilPerHour: number;
  readonly minimumSoil: number;
  /** Explicit latent stage before navigation can be affected; null never becomes serious. */
  readonly seriousAfterHours: number | null;
}
export const LIGHTHOUSE_RISK_RULES: readonly LighthouseRiskRule[] = Object.freeze([
  Object.freeze({component: "cover", objectId: "lighthouse-optics-cleaning", remedy: "clean-cover", baseRatePerHour: .006,
    soilPerHour: .03, minimumSoil: .15, seriousAfterHours: null}),
  Object.freeze({component: "solar", objectId: "lighthouse-solar-array", remedy: "clean-solar", baseRatePerHour: .004,
    soilPerHour: .02, minimumSoil: .15, seriousAfterHours: null}),
]);
export const LIGHTHOUSE_CURRENT_REMEDIES: readonly LighthouseRemedy[] = Object.freeze(["clean-cover", "clean-solar"]);
export interface LighthouseProblem {
  readonly id: string;
  readonly component: LighthouseRiskComponent;
  readonly objectId: string;
  readonly revision: number;
  readonly createdHour: number;
  readonly stage: "latent" | "degraded" | "serious";
  readonly cause: Readonly<{weather: LighthouseWeatherKind; ratePerHour: number; weatherMultiplier: number;
    conditionMultiplier: number; soil: number; probability: number}>;
}
interface RiskComponentState {
  readonly revision: number;
  readonly soil: number;
  readonly conditionMultiplier: number;
  readonly treatmentAvailable: boolean;
}
interface RiskEvent {
  readonly id: number;
  readonly hour: number;
  readonly component: LighthouseRiskComponent;
  readonly problemId: string | null;
  readonly type: "created" | "escalated" | "maintained";
}
export interface LighthouseWeatherRiskOptions {
  readonly seed: number;
  readonly fixedWeather?: LighthouseWeatherKind;
  /** Future/test pools still require an explicit matching remedy capability. */
  readonly rules?: readonly LighthouseRiskRule[];
  readonly remedies?: readonly LighthouseRemedy[];
}
const COMPONENTS: readonly LighthouseRiskComponent[] = ["cover", "solar", "drive", "charger", "sensor", "seal", "backup"];
const REMEDY: Readonly<Record<LighthouseRiskComponent, LighthouseRemedy>> = Object.freeze({cover: "clean-cover", solar: "clean-solar",
  drive: "replace-drive", charger: "replace-charger", sensor: "clean-sensor", seal: "repair-seal", backup: "repair-backup"});
const round = (n: number) => Math.round(n * 1e9) / 1e9;
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;

export function lighthouseRiskProbability(ratePerHour: number, hours: number) {
  if (!nonnegative(ratePerHour) || !nonnegative(hours)) throw new RangeError("Invalid risk interval or rate");
  return -Math.expm1(-ratePerHour * hours);
}

/**
 * Stage-one simulation only. Room, equipment, inspection and version-1 saves do not import this module.
 * Time is accepted automatic scene time; fixed boundaries own every random draw and problem change.
 */
export class LighthouseWeatherRisk {
  private readonly random: LighthouseRandom;
  private readonly weather: LighthouseWeatherSequence;
  private readonly visibility: LighthouseVisibility;
  private readonly rules: readonly LighthouseRiskRule[];
  private readonly remedies: readonly LighthouseRemedy[];
  private components: Partial<Record<LighthouseRiskComponent, RiskComponentState>> = {};
  private problems: LighthouseProblem[] = [];
  private events: RiskEvent[] = [];
  private nextProblem = 1;
  private nextEvent = 1;
  private ticks = 0;
  private acceptedHours = 0;
  private compensation = 0;
  private seriousCooldownUntil = 0;
  constructor(options: LighthouseWeatherRiskOptions) {
    this.random = new LighthouseRandom(options.seed);
    this.rules = Object.freeze((options.rules ?? LIGHTHOUSE_RISK_RULES).map(rule => {
      if (!COMPONENTS.includes(rule.component) || rule.remedy !== REMEDY[rule.component] || !rule.objectId
        || !nonnegative(rule.baseRatePerHour) || !nonnegative(rule.soilPerHour)
        || !nonnegative(rule.minimumSoil) || rule.minimumSoil > 1
        || rule.seriousAfterHours !== null && (!Number.isFinite(rule.seriousAfterHours) || rule.seriousAfterHours < 1 / 12))
        throw new RangeError("Invalid risk rule");
      return Object.freeze({...rule});
    }).sort((a, b) => COMPONENTS.indexOf(a.component) - COMPONENTS.indexOf(b.component)));
    if (new Set(this.rules.map(rule => rule.component)).size !== this.rules.length) throw new RangeError("Duplicate risk component");
    this.remedies = Object.freeze([...(options.remedies ?? LIGHTHOUSE_CURRENT_REMEDIES)]);
    if (this.remedies.some(remedy => !COMPONENTS.some(component => REMEDY[component] === remedy))) throw new RangeError("Unknown remedy");
    for (const rule of this.rules) this.components[rule.component] = Object.freeze({revision: 0, soil: 0, conditionMultiplier: 1, treatmentAvailable: true});
    this.weather = new LighthouseWeatherSequence(this.random, options.fixedWeather);
    this.visibility = new LighthouseVisibility(this.weather.sample().visibilityKm);
  }
  get snapshot() {
    const elapsedHours = round(this.acceptedHours), remainderHours = round(Math.max(0, this.acceptedHours - this.ticks / 12));
    const weather = this.weather.sample(Math.min(1, remainderHours * 12));
    return Object.freeze({elapsedHours, ticks: this.ticks, remainderHours,
      version: LIGHTHOUSE_WEATHER_RISK_VERSION, rules: this.rules, remedies: this.remedies,
      weather, visibility: this.visibility.sampleLinear(this.weather.sample().visibilityKm, weather.visibilityKm, remainderHours),
      components: Object.freeze({...this.components}), problems: Object.freeze([...this.problems]),
      events: Object.freeze([...this.events]), seriousCooldownUntil: this.seriousCooldownUntil,
      random: this.random.snapshot});
  }
  /** Inspection/forecast consumers cannot perturb weather or equipment randomness. No discovery policy yet. */
  drawInformation(stream: Extract<LighthouseRandomStream, "inspection" | "forecast">) {
    if (stream !== "inspection" && stream !== "forecast") throw new RangeError("Not an information stream");
    return this.random.next(stream);
  }
  advance(advance: Pick<TimeOfDayAdvance, "automaticHours">) {
    const hours = advance.automaticHours;
    if (!nonnegative(hours) || hours > 24) throw new RangeError("Invalid accepted automatic interval (maximum one day)");
    // Compensated accumulation avoids frame-size drift. All decisions use integer tick indices.
    const increment = hours - this.compensation, sum = this.acceptedHours + increment;
    this.compensation = sum - this.acceptedHours - increment; this.acceptedHours = sum;
    const target = Math.floor((this.acceptedHours + 1e-9) * 12);
    while (this.ticks < target) {
      const weather = this.weather.sample(.5), hour = (this.ticks + 1) / 12;
      this.riskTick(weather, hour);
      this.visibility.advanceLinear(this.weather.sample().visibilityKm, this.weather.sample(1).visibilityKm, 1 / 12);
      this.weather.advanceTick();
      this.ticks++;
    }
  }
  /** Called only after a future scene bridge commits the existing local cleaning/repair transaction. */
  maintain(component: LighthouseRiskComponent, problemId?: string): boolean {
    const state = this.components[component], rule = this.rules.find(rule => rule.component === component);
    const problem = this.problems.find(problem => problem.component === component);
    if (!state || !rule || !this.remedies.includes(rule.remedy) || !state.treatmentAvailable
      || problemId !== undefined && problem?.id !== problemId || !problem && state.soil === 0) return false;
    if (problem?.stage === "serious") this.seriousCooldownUntil = round(this.acceptedHours + 6);
    this.components[component] = Object.freeze({revision: state.revision + 1, soil: 0, conditionMultiplier: .35, treatmentAvailable: true});
    this.problems = this.problems.filter(problem => problem.component !== component);
    this.log("maintained", component, problem?.id ?? null, round(this.acceptedHours));
    return true;
  }
  /** A bridge may close an unavailable treatment path; blocked candidates never draw or queue events. */
  setTreatmentAvailable(component: LighthouseRiskComponent, available: boolean) {
    if (!this.components[component] || typeof available !== "boolean") throw new RangeError("Unknown treatment component");
    this.components[component] = Object.freeze({...this.components[component], treatmentAvailable: available});
  }
  private riskTick(weather: LighthouseWeatherSnapshot, hour: number) {
    // Advance existing facts first, so an escalation cannot race a new draw on an earlier component.
    for (const rule of this.rules) {
      const previous = this.components[rule.component];
      const state = Object.freeze({...previous, soil: round(Math.min(1, previous.soil + rule.soilPerHour * weather.exposureMultiplier / 12))});
      this.components[rule.component] = state;
      const problem = this.problems.find(problem => problem.component === rule.component);
      if (problem && this.remedies.includes(rule.remedy) && state.treatmentAvailable) {
        if (problem.stage === "latent" && rule.seriousAfterHours !== null && hour - problem.createdHour >= rule.seriousAfterHours - 1e-9
          && hour >= 24 && hour >= this.seriousCooldownUntil
          && !this.problems.some(problem => problem.stage === "serious")) {
          const revised = Object.freeze({...problem, stage: "serious" as const, revision: state.revision + 1});
          this.components[rule.component] = Object.freeze({...state, revision: revised.revision});
          this.problems = this.problems.map(p => p.id === problem.id ? revised : p);
          this.log("escalated", rule.component, problem.id, hour);
        }
      }
    }
    for (const rule of this.rules) {
      const state = this.components[rule.component];
      if (!this.remedies.includes(rule.remedy) || !state.treatmentAvailable
        || this.problems.some(problem => problem.component === rule.component)) continue;
      if (state.soil < rule.minimumSoil) continue;
      // First full 24 automatic hours protected; severe candidates are discarded during cooldown, not deferred.
      if (rule.seriousAfterHours !== null && (hour < 24 || hour < this.seriousCooldownUntil
        || this.problems.some(problem => problem.stage === "serious"))) continue;
      const rate = rule.baseRatePerHour * weather.exposureMultiplier * state.conditionMultiplier * (1 + state.soil);
      const probability = lighthouseRiskProbability(rate, 1 / 12);
      if (probability === 0 || this.random.next("equipment") >= probability) continue;
      const id = `weather-problem-${this.nextProblem++}`, revision = state.revision + 1;
      const created: LighthouseProblem = Object.freeze({id, component: rule.component, objectId: rule.objectId, revision,
        createdHour: hour, stage: rule.seriousAfterHours === null ? "degraded" : "latent",
        cause: Object.freeze({weather: weather.kind, ratePerHour: rate, weatherMultiplier: weather.exposureMultiplier,
          conditionMultiplier: state.conditionMultiplier, soil: state.soil, probability})});
      this.components[rule.component] = Object.freeze({...state, revision});
      this.problems.push(created); this.log("created", rule.component, id, hour);
    }
  }
  private log(type: RiskEvent["type"], component: LighthouseRiskComponent, problemId: string | null, hour: number) {
    // Diagnostic history is bounded; current problems and the ID sequence are retained independently.
    this.events = [...this.events.slice(-255), Object.freeze({id: this.nextEvent++, hour, component, problemId, type})];
  }
}
