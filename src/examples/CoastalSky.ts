import { Color3, Vector3 } from "@babylonjs/core/pure";

// Also read by tools/prepare-coastal-materials.py. Linear radiance, one sun for sky/IBL/daylight.
export const COASTAL_SKY = {"sun":[0.55,0.78,0.30],"horizon":[0.66,0.77,0.83],"zenith":[0.23,0.46,0.68],"ground":[0.18,0.22,0.15],"sunColor":[1,0.93,0.80],"sunPower":10,"sunSharpness":1800} as const;
export const coastalSunDirection = new Vector3(...COASTAL_SKY.sun).normalize();
export function coastalSkyColor(direction: Vector3) {
  const a = COASTAL_SKY, t = Math.pow(Math.min(1, Math.abs(direction.y) * 2), .65);
  const color = Color3.Lerp(Color3.FromArray(a.horizon), Color3.FromArray(direction.y < 0 ? a.ground : a.zenith), t);
  const sun = a.sunPower * Math.pow(Math.max(0, Vector3.Dot(direction, coastalSunDirection)), a.sunSharpness);
  return color.add(Color3.FromArray(a.sunColor).scale(sun));
}
