import { LighthouseRandom } from "./LighthouseRandom";
import { LighthouseVisibility, LighthouseWeatherSequence } from "./LighthouseWeather";
import type { LighthouseRandomStream } from "./LighthouseRandom";
import type { LighthouseWeatherKind, LighthouseWeatherSnapshot } from "./LighthouseWeather";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";
import {saveObject, saveEnum, saveNumber, saveArray, saveText, saveOptional, saveBoolean, saveRevision, saveDay, savedEventOrder} from "./LighthouseSaveValidation";

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
  /** Surface-only warning stage; has an existing cleaning remedy and never disables navigation. */
  readonly visibleAfterHours?: number;
}
export const LIGHTHOUSE_RISK_RULES: readonly LighthouseRiskRule[] = Object.freeze([
  Object.freeze({component: "cover", objectId: "lighthouse-optics-cleaning", remedy: "clean-cover", baseRatePerHour: .006,
    soilPerHour: .03, minimumSoil: .15, seriousAfterHours: null}),
  Object.freeze({component: "solar", objectId: "lighthouse-solar-array", remedy: "clean-solar", baseRatePerHour: .004,
    soilPerHour: .02, minimumSoil: .15, seriousAfterHours: null, visibleAfterHours: 2}),
]);
export const LIGHTHOUSE_CURRENT_REMEDIES: readonly LighthouseRemedy[] = Object.freeze(["clean-cover", "clean-solar"]);
export interface LighthouseProblem {
  readonly id: string;
  readonly component: LighthouseRiskComponent;
  readonly objectId: string;
  readonly revision: number;
  readonly createdHour: number;
  readonly stage: "latent" | "degraded" | "serious";
  readonly origin?: "existing";
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
export interface LighthouseWeatherInterval {
  readonly fromElapsedHours: number;
  readonly hours: number;
  readonly solarFrom: number;
  readonly solarTo: number;
  readonly lowVisibility: boolean;
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
 * Pure weather/risk simulation. The scene bridge consumes intervals; V2 checkpoints retain exact history.
 * Time is accepted automatic scene time; fixed boundaries own every random draw and problem change.
 */
export class LighthouseWeatherRisk {
  private random: LighthouseRandom;
  private weather: LighthouseWeatherSequence;
  private visibility: LighthouseVisibility;
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
        || rule.visibleAfterHours !== undefined && (!nonnegative(rule.visibleAfterHours) || rule.visibleAfterHours < 1 / 12 || rule.seriousAfterHours !== null)
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
  get acceptedAutomaticHours() {return this.acceptedHours;}
  exportState() {
    return {version:LIGHTHOUSE_WEATHER_RISK_VERSION,random:this.random.snapshot,weather:this.weather.exportState(),visibility:this.visibility.exportState(),
      rules:this.rules,remedies:this.remedies,components:{...this.components},problems:[...this.problems],events:[...this.events],
      nextProblem:this.nextProblem,nextEvent:this.nextEvent,ticks:this.ticks,acceptedHours:this.acceptedHours,
      compensation:this.compensation,seriousCooldownUntil:this.seriousCooldownUntil};
  }
  static fromState(value: unknown) {
    const component=saveEnum(...COMPONENTS),remedy=saveEnum(...COMPONENTS.map(c=>REMEDY[c])),weather=saveEnum("clear","overcast","fog","storm");
    const number=saveNumber(0,1e9), nullable=(v:unknown)=>v===null?null:number(v), raw=(v:unknown)=>v;
    const rule=saveObject({component,objectId:saveText(128),remedy,baseRatePerHour:number,soilPerHour:number,minimumSoil:saveNumber(0,1),
      seriousAfterHours:nullable,visibleAfterHours:saveOptional(number)});
    const s=saveObject({version:saveEnum(LIGHTHOUSE_WEATHER_RISK_VERSION),random:raw,weather:raw,visibility:raw,
      rules:saveArray(rule,7),remedies:saveArray(remedy,7),components:raw,
      problems:saveArray(saveObject({id:saveText(64),component,objectId:saveText(128),revision:saveRevision,createdHour:number,
        stage:saveEnum("latent","degraded","serious"),origin:saveOptional(saveEnum("existing")),
        cause:saveObject({weather,ratePerHour:number,weatherMultiplier:saveNumber(1,3),conditionMultiplier:number,soil:saveNumber(0,1),probability:saveNumber(0,1)})}),7),
      events:saveArray(saveObject({id:saveDay,hour:number,component,problemId:(v:unknown)=>v===null?null:saveText(64)(v),type:saveEnum("created","escalated","maintained")}),256),
      nextProblem:saveDay,nextEvent:saveDay,ticks:saveNumber(0,12e9,true),acceptedHours:number,compensation:saveNumber(-1e-6,1e-6),seriousCooldownUntil:number})(value);
    const random=LighthouseRandom.fromState(s.random), model=new LighthouseWeatherRisk({seed:random.seed,fixedWeather:"clear",rules:s.rules,remedies:s.remedies});
    const schema={};for(const r of model.rules)schema[r.component]=saveObject({revision:saveRevision,soil:saveNumber(0,1),conditionMultiplier:number,treatmentAvailable:saveBoolean});
    const components=saveObject(schema)(s.components), remainder=s.acceptedHours-s.ticks/12;
    const validId=(id:string)=>/^weather-problem-[1-9]\d*$/.test(id)&&Number(id.slice(16))<s.nextProblem;
    if(remainder < -1e-9 || remainder>=1/12+1e-9 || s.ticks!==Math.floor((s.acceptedHours+1e-9)*12)
      || new Set(s.remedies).size!==s.remedies.length || new Set(s.problems.map(p=>p.component)).size!==s.problems.length
      || new Set(s.problems.map(p=>p.id)).size!==s.problems.length || s.problems.filter(p=>p.stage==="serious").length>1
      || s.seriousCooldownUntil>s.acceptedHours+6+1e-9 || s.nextEvent<savedEventOrder(s.events)
      || s.problems.some(p=>{const r=model.rules.find(r=>r.component===p.component);return !r||!validId(p.id)||p.objectId!==r.objectId
        ||p.revision!==components[p.component].revision||p.createdHour>s.acceptedHours+1e-9
        ||p.stage==="serious"&&(r.seriousAfterHours===null||p.createdHour<24-1e-9||s.acceptedHours-p.createdHour<r.seriousAfterHours-1e-9)
        ||p.stage==="latent"&&r.seriousAfterHours===null&&r.visibleAfterHours===undefined
        ||p.origin&&p.stage!=="degraded";})
      ||s.events.some(e=>!components[e.component]||e.hour>s.acceptedHours+1e-9||e.problemId!==null&&!validId(e.problemId))) throw new Error("Inconsistent weather/risk checkpoint");
    model.random=random;model.weather=LighthouseWeatherSequence.fromState(s.weather,random);model.visibility=LighthouseVisibility.fromState(s.visibility);
    const km=model.weather.sample().visibilityKm,v=model.visibility.exportState();
    if(km<2&&!v.required || km<3&&v.recovery>0)throw new Error("Inconsistent visibility history");
    model.components={...components};model.problems=[...s.problems];model.events=[...s.events];model.nextProblem=s.nextProblem;model.nextEvent=s.nextEvent;
    model.ticks=s.ticks;model.acceptedHours=s.acceptedHours;model.compensation=s.compensation;model.seriousCooldownUntil=s.seriousCooldownUntil;return model;
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
  /** Inspection/forecast consumers cannot perturb weather or equipment randomness. Discovery owns caching and only requests a draw for a new effective latent patrol. */
  drawInformation(stream: Extract<LighthouseRandomStream, "inspection" | "forecast">) {
    if (stream !== "inspection" && stream !== "forecast") throw new RangeError("Not an information stream");
    return this.random.next(stream);
  }
  setFixedWeather(kind: LighthouseWeatherKind | null) {
    this.weather.setFixed(kind);
    this.visibility = new LighthouseVisibility(this.weather.sample().visibilityKm);
  }
  /** Reconcile existing teaching/due dirt with the risk pool; never roll a second copy of the same dirt. */
  synchronizeSurface(component: "cover" | "solar", dirty: boolean) {
    const problem = this.problems.find(p => p.component === component), state = this.components[component];
    if (!state) return;
    if (!dirty) {if (problem) this.maintain(component, problem.id); return;}
    if (problem) return;
    const rule = this.rules.find(r => r.component === component)!, weather = this.snapshot.weather;
    this.problems.push(Object.freeze({id: `weather-problem-${this.nextProblem++}`, component, objectId: rule.objectId,
      revision: state.revision + 1, createdHour: round(this.acceptedHours), stage: "degraded", origin: "existing",
      cause: Object.freeze({weather: weather.kind, ratePerHour: 0, weatherMultiplier: weather.exposureMultiplier,
        conditionMultiplier: state.conditionMultiplier, soil: state.soil, probability: 0})}));
    this.components[component] = Object.freeze({...state, revision: state.revision + 1});
  }
  advance(advance: Pick<TimeOfDayAdvance, "automaticHours">, consume?: (interval: LighthouseWeatherInterval) => void) {
    const hours = advance.automaticHours;
    if (!nonnegative(hours) || hours > 24) throw new RangeError("Invalid accepted automatic interval (maximum one day)");
    // Compensated accumulation avoids frame-size drift. All decisions use integer tick indices.
    if (hours === 0) return;
    const from = this.acceptedHours, increment = hours - this.compensation, sum = this.acceptedHours + increment;
    this.compensation = sum - this.acceptedHours - increment; this.acceptedHours = sum;
    const target = Math.floor((this.acceptedHours + 1e-9) * 12);
    let cursor = from;
    while (this.ticks < target) {
      if (consume) this.consumeInterval(cursor, (this.ticks + 1) / 12, consume);
      const weather = this.weather.sample(.5), hour = (this.ticks + 1) / 12;
      this.riskTick(weather, hour);
      this.visibility.advanceLinear(this.weather.sample().visibilityKm, this.weather.sample(1).visibilityKm, 1 / 12);
      this.weather.advanceTick();
      this.ticks++;
      cursor = this.ticks / 12;
    }
    if (consume && this.acceptedHours > cursor + 1e-12) this.consumeInterval(cursor, this.acceptedHours, consume);
  }
  private consumeInterval(from: number, to: number, consume: (interval: LighthouseWeatherInterval) => void) {
    const start = this.ticks / 12, a = this.weather.sample(Math.max(0, Math.min(1, (from - start) * 12))),
      b = this.weather.sample(Math.max(0, Math.min(1, (to - start) * 12))), hours = to - from;
    if (hours <= 1e-12) return;
    const initial = this.visibility.sampleLinear(this.weather.sample().visibilityKm, a.visibilityKm, Math.max(0, from - start));
    let required = initial.required, recovery = initial.recoveryHours;
    const boundaries = [0, 1];
    if (a.visibilityKm !== b.visibilityKm) for (const threshold of [2, 3]) {
      const t = (threshold - a.visibilityKm) / (b.visibilityKm - a.visibilityKm);
      if (t > 0 && t < 1) boundaries.push(t);
    }
    boundaries.sort((x,y) => x-y);
    const emit = (lo: number, hi: number, lowVisibility: boolean) => {
      if (hi - lo <= 1e-12) return;
      consume({fromElapsedHours: from + lo * hours, hours: (hi-lo)*hours,
        solarFrom: a.solarMultiplier + (b.solarMultiplier-a.solarMultiplier)*lo,
        solarTo: a.solarMultiplier + (b.solarMultiplier-a.solarMultiplier)*hi, lowVisibility});
    };
    for (let i=1;i<boundaries.length;i++) {
      const lo=boundaries[i-1], hi=boundaries[i], visibility=a.visibilityKm+(b.visibilityKm-a.visibilityKm)*(lo+hi)/2;
      if (visibility < 2) {required=true; recovery=0;}
      else if (visibility < 3) recovery=0;
      if (required && visibility >= 3) {
        const duration=(hi-lo)*hours, needed=Math.max(0,1/6-recovery);
        if (duration >= needed-1e-10) {const at=Math.min(hi,lo+needed/hours);emit(lo,at,true);emit(at,hi,false);required=false;recovery=0;continue;}
        recovery+=duration;
      }
      emit(lo,hi,required);
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
        if (problem.stage === "latent" && rule.visibleAfterHours !== undefined && hour - problem.createdHour >= rule.visibleAfterHours - 1e-9) {
          const revised = Object.freeze({...problem, stage: "degraded" as const, revision: state.revision + 1});
          this.components[rule.component] = Object.freeze({...state, revision: revised.revision});
          this.problems = this.problems.map(p => p.id === problem.id ? revised : p);
          this.log("escalated", rule.component, problem.id, hour);
        }
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
        createdHour: hour, stage: rule.seriousAfterHours === null && rule.visibleAfterHours === undefined ? "degraded" : "latent",
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
