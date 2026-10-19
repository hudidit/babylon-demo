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
  readonly sky: { readonly zenith: LinearTimeColor; readonly horizon: LinearTimeColor };
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
  readonly sky: TimeOfDayPreset["sky"];
  readonly environment: TimeOfDayPreset["environment"];
}

type BodyInput = readonly [number, number, number, string];
interface PresetInput {
  hour: TimeOfDayHour;
  name: string;
  sun: BodyInput;
  moon: BodyInput;
  sky: readonly [string, string];
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
    sky: Object.freeze({ zenith: linearColor(input.sky[0]), horizon: linearColor(input.sky[1]) }),
    environment: Object.freeze({ exterior: input.environment[0], interior: input.environment[1] }) });
}

/** Artistic northern-hemisphere tracks; not a dated astronomical ephemeris. */
export const TIME_OF_DAY_PRESETS: readonly TimeOfDayPreset[] = Object.freeze([
  preset({ hour: 0, name: "午夜", sun: [0, -60, 0, "#FFD0A0"], moon: [180, 50, .040, "#C7D8EE"],
    sky: ["#101B30", "#29394B"], environment: [.180, .10] }),
  preset({ hour: 3, name: "后夜", sun: [45, -35, 0, "#FFD0A0"], moon: [225, 25, .025, "#C4D2E8"],
    sky: ["#10182A", "#303C4B"], environment: [.140, .08] }),
  preset({ hour: 6, name: "清晨", sun: [90, 5, .280, "#FFD0A0"], moon: [270, -5, 0, "#C4D2E8"],
    sky: ["#7798BD", "#E9B99A"], environment: [.350, .40] }),
  preset({ hour: 9, name: "上午", sun: [135, 35, .800, "#FFF0D9"], moon: [315, -35, 0, "#C7D8EE"],
    sky: ["#6396C3", "#C5D5DB"], environment: [.850, .90] }),
  preset({ hour: 12, name: "正午", sun: [180, 65, 1, "#FFF7E8"], moon: [0, -60, 0, "#C7D8EE"],
    sky: ["#528FC1", "#C9DEE8"], environment: [1, 1] }),
  preset({ hour: 15, name: "午后", sun: [225, 35, .800, "#FFE0B3"], moon: [45, -35, 0, "#CDDDF2"],
    sky: ["#6D97BD", "#E3CFB3"], environment: [.800, .85] }),
  preset({ hour: 18, name: "黄昏", sun: [270, 5, .250, "#FFAD70"], moon: [90, -5, 0, "#CDDDF2"],
    sky: ["#646D98", "#DCA083"], environment: [.250, .30] }),
  preset({ hour: 21, name: "入夜", sun: [315, -35, 0, "#FFAD70"], moon: [135, 25, .035, "#CDDDF2"],
    sky: ["#15243D", "#35475D"], environment: [.200, .12] }),
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
    sky: Object.freeze({ zenith: colorLerp(a.sky.zenith, b.sky.zenith, t), horizon: colorLerp(a.sky.horizon, b.sky.horizon, t) }),
    environment: Object.freeze({ exterior: lerp(a.environment.exterior, b.environment.exterior, t),
      interior: lerp(a.environment.interior, b.environment.interior, t) }) });
}

/** Manual keyframe state. Smooth visual transitions and automatic clock belong to later stages. */
export class RoomTimeOfDay {
  private current = evaluateTimeOfDay(DEFAULT_TIME_OF_DAY);
  get snapshot(): TimeOfDaySnapshot { return this.current; }
  select(hour: number): TimeOfDaySnapshot {
    const wrapped = wrapTimeOfDay(hour);
    if (!TIME_OF_DAY_PRESETS.some(p => p.hour === wrapped)) throw new RangeError("Select a three-hour scene time node");
    if (wrapped !== this.current.hour) this.current = evaluateTimeOfDay(wrapped);
    return this.current;
  }
}
