import type { LighthouseRandom } from "./LighthouseRandom";

export type LighthouseWeatherKind = "clear" | "overcast" | "fog" | "storm";
export interface LighthouseWeatherConditions {
  readonly solarMultiplier: number;
  readonly visibilityKm: number;
  readonly daylightMultiplier: number;
  readonly cloudCover: number;
  readonly rain: number;
  readonly exposureMultiplier: number;
}
/** Artistic game conditions, not forecasts or engineering/historical weather data. */
export const LIGHTHOUSE_WEATHER: Readonly<Record<LighthouseWeatherKind, LighthouseWeatherConditions>> = Object.freeze({
  clear: Object.freeze({solarMultiplier: 1, visibilityKm: 12, daylightMultiplier: 1, cloudCover: .2, rain: 0, exposureMultiplier: 1}),
  overcast: Object.freeze({solarMultiplier: .35, visibilityKm: 8, daylightMultiplier: .65, cloudCover: .9, rain: 0, exposureMultiplier: 1.3}),
  fog: Object.freeze({solarMultiplier: .45, visibilityKm: .8, daylightMultiplier: .75, cloudCover: .7, rain: 0, exposureMultiplier: 1.5}),
  storm: Object.freeze({solarMultiplier: .15, visibilityKm: 2.5, daylightMultiplier: .45, cloudCover: 1, rain: 1, exposureMultiplier: 3}),
});
export const LIGHTHOUSE_WEATHER_TIMING = Object.freeze({ticksPerHour: 12, minTicks: 24, maxTicks: 72,
  transitionTicks: 4, visibilityOnKm: 2, visibilityOffKm: 3, visibilityRecoveryHours: 1 / 6});
const C = LIGHTHOUSE_WEATHER_TIMING;
export interface LighthouseWeatherSnapshot extends LighthouseWeatherConditions {
  readonly mode: "fixed" | "automatic";
  readonly kind: LighthouseWeatherKind;
  readonly from: LighthouseWeatherKind;
  readonly phase: "entering" | "holding";
  readonly transition: number;
  readonly remainingHours: number | null;
}
export const isLighthouseWeather = (value: unknown): value is LighthouseWeatherKind =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(LIGHTHOUSE_WEATHER, value);
const round = (n: number) => Math.round(n * 1e9) / 1e9;

/** Driven once per accepted five-minute boundary by LighthouseWeatherRisk. */
export class LighthouseWeatherSequence {
  private kind: LighthouseWeatherKind;
  private from: LighthouseWeatherKind;
  private ageTicks = 0;
  private remainingTicks: number;
  mode: "fixed" | "automatic";
  constructor(private readonly random: LighthouseRandom, fixed?: LighthouseWeatherKind) {
    if (fixed !== undefined && !isLighthouseWeather(fixed)) throw new RangeError("Unknown weather condition");
    this.mode = fixed === undefined ? "automatic" : "fixed";
    this.kind = this.from = fixed ?? "clear";
    this.remainingTicks = this.mode === "automatic" ? this.duration() : 0;
  }
  setFixed(kind: LighthouseWeatherKind | null) {
    if (kind !== null && !isLighthouseWeather(kind)) throw new RangeError("Unknown weather condition");
    this.mode = kind === null ? "automatic" : "fixed";
    this.kind = this.from = kind ?? this.kind;
    this.ageTicks = 0; this.remainingTicks = kind === null ? this.duration() : 0;
  }
  private duration() {return C.minTicks + Math.floor(this.random.next("weather") * (C.maxTicks - C.minTicks + 1));}
  advanceTick() {
    if (this.mode === "fixed") return;
    this.ageTicks++;
    if (--this.remainingTicks > 0) return;
    this.from = this.kind;
    if (this.kind === "overcast") {
      const n = this.random.next("weather");
      this.kind = n < .55 ? "clear" : n < .8 ? "fog" : "storm";
    } else this.kind = "overcast";
    this.ageTicks = 0;
    this.remainingTicks = this.duration();
  }
  /** Fraction of the next five-minute interval: midpoint for hazard, remainder for display. */
  sample(fraction = 0): LighthouseWeatherSnapshot {
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError("Invalid weather sample fraction");
    const t = this.mode === "fixed" || this.from === this.kind ? 1 : Math.min(1, (this.ageTicks + fraction) / C.transitionTicks);
    const a = LIGHTHOUSE_WEATHER[this.from], b = LIGHTHOUSE_WEATHER[this.kind];
    const blend = (key: keyof LighthouseWeatherConditions) => round(a[key] + (b[key] - a[key]) * t);
    return Object.freeze({mode: this.mode, kind: this.kind, from: this.from, phase: t < 1 ? "entering" : "holding",
      transition: round(t), remainingHours: this.mode === "fixed" ? null : round((this.remainingTicks - fraction) / C.ticksPerHour),
      solarMultiplier: blend("solarMultiplier"), visibilityKm: blend("visibilityKm"),
      daylightMultiplier: blend("daylightMultiplier"), cloudCover: blend("cloudCover"), rain: blend("rain"),
      exposureMultiplier: blend("exposureMultiplier")});
  }
}

/** Independent visibility hysteresis; a low solar input never implies a navigation request. */
export class LighthouseVisibility {
  private required = false;
  private recovery = 0;
  constructor(initialVisibilityKm = 12) {
    if (!Number.isFinite(initialVisibilityKm) || initialVisibilityKm < 0) throw new RangeError("Invalid initial visibility");
    this.required = initialVisibilityKm < C.visibilityOnKm;
  }
  advance(visibilityKm: number, automaticHours: number) {
    if (!Number.isFinite(visibilityKm) || visibilityKm < 0 || !Number.isFinite(automaticHours) || automaticHours < 0)
      throw new RangeError("Invalid visibility observation");
    if (automaticHours === 0) return;
    if (visibilityKm < C.visibilityOnKm) {this.required = true; this.recovery = 0;}
    else if (this.required && visibilityKm >= C.visibilityOffKm) {
      this.recovery = Math.min(C.visibilityRecoveryHours, this.recovery + automaticHours);
      if (this.recovery >= C.visibilityRecoveryHours - 1e-10) {this.required = false; this.recovery = 0;}
    } else this.recovery = 0;
  }
  /** Integrate linear visibility through threshold crossings, rather than quantizing fog to hazard ticks. */
  advanceLinear(fromKm: number, toKm: number, automaticHours: number) {
    if (![fromKm, toKm, automaticHours].every(n => Number.isFinite(n) && n >= 0)) throw new RangeError("Invalid visibility segment");
    const boundaries = [0, 1];
    if (fromKm !== toKm) for (const threshold of [C.visibilityOnKm, C.visibilityOffKm]) {
      const t = (threshold - fromKm) / (toKm - fromKm);
      if (t > 0 && t < 1) boundaries.push(t);
    }
    boundaries.sort((a,b) => a-b);
    for (let i = 1; i < boundaries.length; i++) {
      const a = boundaries[i-1], b = boundaries[i];
      this.advance(fromKm + (toKm - fromKm) * (a + b) / 2, automaticHours * (b - a));
    }
  }
  /** Non-mutating projection for the uncompleted risk interval; reading a display never changes history. */
  sampleLinear(fromKm: number, toKm: number, automaticHours: number) {
    const sample = new LighthouseVisibility();
    sample.required = this.required; sample.recovery = this.recovery;
    sample.advanceLinear(fromKm, toKm, automaticHours);
    return sample.snapshot;
  }
  get snapshot() {return Object.freeze({required: this.required, recoveryHours: round(this.recovery)});}
}

export function lighthouseWeatherNavigationRequired(hour: number, lowVisibility: boolean) {
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) throw new RangeError("Invalid scene hour");
  return hour >= 18 || hour < 6 || lowVisibility;
}
