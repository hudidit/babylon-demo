/** Scene time is independent of the user's wall clock. No engine or DOM dependencies. */
export const TIME_OF_DAY_VERSION = "coastal-day-night-v1";
export const DEFAULT_TIME_OF_DAY = 12;
export const NOON_LIGHT_INTENSITY = 3.8;
export type TimeOfDayHour = 0 | 3 | 6 | 9 | 12 | 15 | 18 | 21;
export type TimeVector = readonly [number, number, number];
export type LinearTimeColor = readonly [number, number, number];

interface CelestialKeyframe {
  readonly azimuth: number;
  readonly elevation: number;
  readonly strength: number;
  readonly color: LinearTimeColor;
}
export interface TimeOfDayPreset {
  readonly hour: TimeOfDayHour;
  readonly name: string;
  readonly sun: CelestialKeyframe;
  readonly moon: CelestialKeyframe;
  readonly sky: { readonly zenith: LinearTimeColor; readonly horizon: LinearTimeColor;
    readonly cloudLight: LinearTimeColor; readonly cloudShade: LinearTimeColor; readonly starVisibility: number };
  readonly environment: { readonly exterior: number; readonly interior: number };
}
export interface CelestialState extends CelestialKeyframe {
  readonly kind: "sun" | "moon";
  /** World +X east, +Y up, +Z south. This points toward the body. */
  readonly sourceDirection: TimeVector;
  /** Babylon directional lights propagate in the opposite direction. */
  readonly lightDirection: TimeVector;
  readonly intensity: number;
  readonly enabled: boolean;
}
export interface TimeOfDaySnapshot {
  readonly hour: number;
  readonly periodHour: TimeOfDayHour;
  readonly periodName: string;
  readonly sun: CelestialState;
  readonly moon: CelestialState;
  /** Null during the short twilight interval when both bodies are below the horizon. */
  readonly primary: CelestialState | null;
  readonly sky: TimeOfDayPreset["sky"] & { readonly sunDirection?: TimeVector; readonly warmth?: number };
  readonly environment: TimeOfDayPreset["environment"];
}

type BodyInput = readonly [number, number, number, string];
interface PresetInput {
  hour: TimeOfDayHour;
  name: string;
  sun: BodyInput;
  moon: BodyInput;
  sky: readonly [string, string];
  clouds: readonly [string, string];
  stars: number;
  environment: readonly [number, number];
}
const vector = (x: number, y: number, z: number): TimeVector => Object.freeze([x, y, z] as [number, number, number]);
function linearColor(hex: string): LinearTimeColor {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return vector(channels[0], channels[1], channels[2]);
}
function preset(input: PresetInput): TimeOfDayPreset {
  const body = ([azimuth, elevation, strength, color]: BodyInput): CelestialKeyframe =>
    Object.freeze({ azimuth, elevation, strength, color: linearColor(color) });
  return Object.freeze({ hour: input.hour, name: input.name, sun: body(input.sun), moon: body(input.moon),
    sky: Object.freeze({ zenith: linearColor(input.sky[0]), horizon: linearColor(input.sky[1]),
      cloudLight: linearColor(input.clouds[0]), cloudShade: linearColor(input.clouds[1]), starVisibility: input.stars }),
    environment: Object.freeze({ exterior: input.environment[0], interior: input.environment[1] }) });
}

/** Artistic northern-hemisphere tracks; not a dated astronomical ephemeris. */
export const TIME_OF_DAY_PRESETS: readonly TimeOfDayPreset[] = Object.freeze([
  preset({ hour: 0, name: "午夜", sun: [0, -60, 0, "#FFD0A0"], moon: [180, 50, .040, "#C7D8EE"],
    sky: ["#101B30", "#29394B"], clouds: ["#26364E", "#17253A"], stars: 1, environment: [.180, .10] }),
  preset({ hour: 3, name: "后夜", sun: [45, -35, 0, "#FFD0A0"], moon: [225, 25, .025, "#C4D2E8"],
    sky: ["#10182A", "#303C4B"], clouds: ["#24334A", "#162236"], stars: .9, environment: [.140, .08] }),
  preset({ hour: 6, name: "清晨", sun: [90, 5, .280, "#FFD0A0"], moon: [270, -5, 0, "#C4D2E8"],
    sky: ["#7798BD", "#E9B99A"], clouds: ["#E3DEDA", "#8B9AAE"], stars: 0, environment: [.350, .40] }),
  preset({ hour: 9, name: "上午", sun: [135, 35, .800, "#FFF0D9"], moon: [315, -35, 0, "#C7D8EE"],
    sky: ["#6396C3", "#C5D5DB"], clouds: ["#F3F1EC", "#A0B4C8"], stars: 0, environment: [.850, .90] }),
  preset({ hour: 12, name: "正午", sun: [180, 65, 1, "#FFF7E8"], moon: [0, -60, 0, "#C7D8EE"],
    sky: ["#528FC1", "#C9DEE8"], clouds: ["#F6F4EF", "#A5B6C8"], stars: 0, environment: [1, 1] }),
  preset({ hour: 15, name: "午后", sun: [225, 35, .800, "#FFE0B3"], moon: [45, -35, 0, "#CDDDF2"],
    sky: ["#6D97BD", "#E3CFB3"], clouds: ["#F5EEE3", "#A3AEC0"], stars: 0, environment: [.800, .85] }),
  preset({ hour: 18, name: "黄昏", sun: [270, 5, .250, "#FFAD70"], moon: [90, -5, 0, "#CDDDF2"],
    sky: ["#646D98", "#DCA083"], clouds: ["#D6CED0", "#79849F"], stars: 0, environment: [.250, .30] }),
  preset({ hour: 21, name: "入夜", sun: [315, -35, 0, "#FFAD70"], moon: [135, 25, .035, "#CDDDF2"],
    sky: ["#15243D", "#35475D"], clouds: ["#2E4059", "#1D2E46"], stars: .7, environment: [.200, .12] }),
]);

export function wrapTimeOfDay(hour: number): number {
  if (!Number.isFinite(hour)) throw new RangeError("Scene hour must be finite");
  const remainder = hour % 24, wrapped = remainder < 0 ? remainder + 24 : remainder;
  return wrapped === 0 || wrapped === 24 ? 0 : wrapped;
}

/** Azimuth is clockwise from north; elevation is measured up from the horizon, in degrees. */
export function timeSourceDirection(azimuth: number, elevation: number): TimeVector {
  if (!Number.isFinite(azimuth) || !Number.isFinite(elevation) || elevation < -90 || elevation > 90)
    throw new RangeError("Invalid celestial angles");
  const a = azimuth % 360 * Math.PI / 180, h = elevation * Math.PI / 180;
  return vector(Math.cos(h) * Math.sin(a), Math.sin(h), -Math.cos(h) * Math.cos(a));
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const colorLerp = (a: LinearTimeColor, b: LinearTimeColor, t: number): LinearTimeColor =>
  vector(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
function starGate(sunElevation: number) {
  const t = Math.max(0, Math.min(1, (-4 - sunElevation) / 8));
  return t * t * (3 - 2 * t);
}
function celestial(kind: CelestialState["kind"], a: CelestialKeyframe, b: CelestialKeyframe, t: number): CelestialState {
  // Both tracks advance clockwise, including 315 -> 0 across midnight/the daytime moon.
  const azimuth = (a.azimuth + (b.azimuth - a.azimuth + 360) % 360 * t) % 360;
  const elevation = lerp(a.elevation, b.elevation, t), visible = Math.max(0, Math.min(1, elevation / 5));
  const strength = lerp(a.strength, b.strength, t) * visible * visible * (3 - 2 * visible);
  const sourceDirection = timeSourceDirection(azimuth, elevation);
  return Object.freeze({ kind, azimuth, elevation, strength, color: colorLerp(a.color, b.color, t),
    sourceDirection, lightDirection: vector(-sourceDirection[0], -sourceDirection[1], -sourceDirection[2]),
    intensity: NOON_LIGHT_INTENSITY * strength, enabled: strength > 0 });
}

/** Continuous track evaluation, without advancing a clock or applying any rendering state. */
export function evaluateTimeOfDay(hour: number): TimeOfDaySnapshot {
  const wrapped = wrapTimeOfDay(hour), index = Math.floor(wrapped / 3);
  const a = TIME_OF_DAY_PRESETS[index], b = TIME_OF_DAY_PRESETS[(index + 1) % TIME_OF_DAY_PRESETS.length];
  const t = (wrapped - a.hour) / 3;
  const sun = celestial("sun", a.sun, b.sun, t), moon = celestial("moon", a.moon, b.moon, t);
  return Object.freeze({ hour: wrapped, periodHour: a.hour, periodName: a.name, sun, moon,
    primary: sun.enabled ? sun : moon.enabled ? moon : null,
    sky: Object.freeze({ zenith: colorLerp(a.sky.zenith, b.sky.zenith, t), horizon: colorLerp(a.sky.horizon, b.sky.horizon, t),
      cloudLight: colorLerp(a.sky.cloudLight, b.sky.cloudLight, t), cloudShade: colorLerp(a.sky.cloudShade, b.sky.cloudShade, t),
      starVisibility: lerp(a.sky.starVisibility, b.sky.starVisibility, t) * starGate(sun.elevation) }),
    environment: Object.freeze({ exterior: lerp(a.environment.exterior, b.environment.exterior, t),
      interior: lerp(a.environment.interior, b.environment.interior, t) }) });
}

const shortestAngle = (a: number, b: number) => {
  const delta = ((b - a + 540) % 360) - 180;
  return delta === -180 && b > a ? 180 : delta;
};
const warmth = (state: TimeOfDaySnapshot) => state.sky.warmth ?? Math.max(0, 1 - Math.abs(state.sun.elevation - 5) / 30);

/** Blend displayed lighting directly, without playing the intervening hours. */
export function blendTimeOfDay(from: TimeOfDaySnapshot, to: TimeOfDaySnapshot, t: number, reducedMotion = false): TimeOfDaySnapshot {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const fade = reducedMotion || from.primary?.kind !== to.primary?.kind;
  const factor = t < .5 ? 1 - 2 * t : 2 * t - 1;
  const body = (a: CelestialState, b: CelestialState): CelestialState => {
    const endpoint = t < .5 ? a : b;
    const azimuth = fade ? endpoint.azimuth : wrapTimeOfDay((a.azimuth + shortestAngle(a.azimuth, b.azimuth) * t) / 15) * 15;
    const elevation = fade ? endpoint.elevation : lerp(a.elevation, b.elevation, t);
    const strength = elevation <= 0 ? 0 : fade ? endpoint.strength * factor : lerp(a.strength, b.strength, t);
    const sourceDirection = timeSourceDirection(azimuth, elevation);
    return Object.freeze({ kind: a.kind, azimuth, elevation, strength, color: colorLerp(a.color, b.color, t),
      sourceDirection, lightDirection: vector(-sourceDirection[0], -sourceDirection[1], -sourceDirection[2]),
      intensity: NOON_LIGHT_INTENSITY * strength, enabled: strength > 0 });
  };
  const sun = body(from.sun, to.sun), moon = body(from.moon, to.moon);
  const hour = wrapTimeOfDay(from.hour + shortestAngle(from.hour * 15, to.hour * 15) / 15 * t);
  const period = TIME_OF_DAY_PRESETS[Math.floor(hour / 3)];
  const skyDirection = (state: TimeOfDaySnapshot) => state.sky.sunDirection || state.sun.sourceDirection;
  const a = skyDirection(from), b = skyDirection(to);
  const azimuth = (v: TimeVector) => Math.atan2(v[0], -v[2]) * 180 / Math.PI;
  const skySunDirection = reducedMotion ? (t < .5 ? a : b) : timeSourceDirection(
    azimuth(a) + shortestAngle(azimuth(a), azimuth(b)) * t,
    lerp(Math.asin(a[1]) * 180 / Math.PI, Math.asin(b[1]) * 180 / Math.PI, t));
  return Object.freeze({ hour, periodHour: period.hour, periodName: period.name, sun, moon,
    primary: sun.enabled ? sun : moon.enabled ? moon : null,
    sky: Object.freeze({ zenith: colorLerp(from.sky.zenith, to.sky.zenith, t), horizon: colorLerp(from.sky.horizon, to.sky.horizon, t),
      cloudLight: colorLerp(from.sky.cloudLight, to.sky.cloudLight, t), cloudShade: colorLerp(from.sky.cloudShade, to.sky.cloudShade, t),
      // This is a displayed value: re-evaluating at the blended hour would flash through unrelated night/day gates.
      starVisibility: lerp(from.sky.starVisibility, to.sky.starVisibility, t),
      sunDirection: skySunDirection, warmth: reducedMotion ? warmth(t < .5 ? from : to) * factor : lerp(warmth(from), warmth(to), t) }),
    environment: Object.freeze({ exterior: lerp(from.environment.exterior, to.environment.exterior, t),
      interior: lerp(from.environment.interior, to.environment.interior, t) }) });
}

export const TIME_TRANSITION_SECONDS = 1.2;
export const TIME_REDUCED_TRANSITION_SECONDS = .2;
export const TIME_CYCLE_SECONDS = 24 * 60;

/** Accepted time, shared by equipment and future calendar consumers. Visual fades are not elapsed days. */
export interface TimeOfDayAdvance {
  readonly fromHour: number;
  readonly toHour: number;
  readonly activeSeconds: number;
  readonly automaticHours: number;
  readonly midnightCrossings: number;
  readonly manualCompleted: boolean;
}

/** Scene-local deterministic clock. Rendering and DOM events remain with their owners. */
export class RoomTimeOfDay {
  private current = evaluateTimeOfDay(DEFAULT_TIME_OF_DAY);
  private transition?: { from: TimeOfDaySnapshot; to: TimeOfDaySnapshot; elapsed: number; duration: number; reduced: boolean };
  private automatic = true;
  private skipDelta = true;
  private accepted: TimeOfDayAdvance = Object.freeze({ fromHour: DEFAULT_TIME_OF_DAY, toHour: DEFAULT_TIME_OF_DAY,
    activeSeconds: 0, automaticHours: 0, midnightCrossings: 0, manualCompleted: false });
  get snapshot(): TimeOfDaySnapshot { return this.current; }
  get lastAdvance(): TimeOfDayAdvance { return this.accepted; }
  get playback() { return Object.freeze({ automatic: this.automatic, transitioning: !!this.transition, targetHour: this.transition?.to.hour ?? null }); }
  private node(hour: number) {
    const wrapped = wrapTimeOfDay(hour);
    if (!TIME_OF_DAY_PRESETS.some(p => p.hour === wrapped)) throw new RangeError("Select a three-hour scene time node");
    return wrapped;
  }
  /** Restore a validated continuous time without a manual fade or offline catch-up. */
  restore(hour: number) {
    if (typeof hour !== "number" || !Number.isFinite(hour) || hour < 0 || hour >= 24) throw new RangeError("Invalid saved scene time");
    this.current = evaluateTimeOfDay(hour); this.transition = undefined; this.automatic = false; this.resetDelta();
    this.accepted = Object.freeze({fromHour: hour, toHour: hour, activeSeconds: 0, automaticHours: 0, midnightCrossings: 0, manualCompleted: false});
  }
  select(hour: number): TimeOfDaySnapshot {
    const wrapped = this.node(hour);
    const wasTransitioning = !!this.transition;
    this.automatic = false; this.transition = undefined; this.resetDelta();
    if (wasTransitioning || wrapped !== this.current.hour) this.current = evaluateTimeOfDay(wrapped);
    return this.current;
  }
  transitionTo(hour: number, reducedMotion = false) {
    const wrapped = this.node(hour);
    this.automatic = false;
    if (this.transition?.to.hour === wrapped) return;
    if (!this.transition && wrapped === this.current.hour) return;
    // A retarget starts at the actual displayed snapshot, even halfway through a day/moon fade.
    this.transition = { from: this.current, to: evaluateTimeOfDay(wrapped), elapsed: 0,
      duration: reducedMotion ? TIME_REDUCED_TRANSITION_SECONDS : TIME_TRANSITION_SECONDS, reduced: reducedMotion };
    this.skipDelta = false;
  }
  setAutomatic(enabled: boolean) { this.automatic = enabled; this.resetDelta(); }
  resetDelta() { this.skipDelta = true; }
  advance(delta: number, automaticPaused = false, transitionPaused = false): TimeOfDaySnapshot {
    const fromHour = this.current.hour;
    this.accepted = Object.freeze({ fromHour, toHour: fromHour, activeSeconds: 0,
      automaticHours: 0, midnightCrossings: 0, manualCompleted: false });
    if (!Number.isFinite(delta) || delta < 0) return this.current;
    if (this.skipDelta) { this.skipDelta = false; return this.current; }
    const dt = Math.min(.1, delta);
    let automaticHours = 0, midnightCrossings = 0, manualCompleted = false;
    if (this.transition) {
      if (transitionPaused) return this.current;
      const transition = this.transition;
      transition.elapsed = Math.min(transition.duration, transition.elapsed + dt);
      const t = transition.elapsed / transition.duration;
      this.current = blendTimeOfDay(transition.from, transition.to, t * t * (3 - 2 * t), transition.reduced);
      if (t >= 1 - 1e-10) { this.current = transition.to; this.transition = undefined; manualCompleted = true; }
    } else if (this.automatic && !automaticPaused && dt > 0) {
      let nextHour = fromHour + dt * 24 / TIME_CYCLE_SECONDS;
      // Eliminate accumulated floating-point error at exact hour/day boundaries.
      if (Math.abs(nextHour - Math.round(nextHour)) < 1e-10) nextHour = Math.round(nextHour);
      automaticHours = nextHour - fromHour;
      midnightCrossings = Math.floor(nextHour / 24);
      this.current = evaluateTimeOfDay(nextHour);
    }
    this.accepted = Object.freeze({ fromHour, toHour: this.current.hour,
      activeSeconds: automaticPaused || transitionPaused ? 0 : dt, automaticHours, midnightCrossings, manualCompleted });
    return this.current;
  }
}
