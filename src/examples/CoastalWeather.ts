import { Color3, Vector3 } from "@babylonjs/core/pure";
import type { Scene, ShaderMaterial } from "@babylonjs/core/pure";
import type { TimeOfDaySnapshot, LinearTimeColor } from "./RoomTimeOfDay";
import type { LighthouseWeatherSnapshot } from "./LighthouseWeather";

export const WEATHER_LABELS = Object.freeze({clear: "晴朗", overcast: "阴天", fog: "海雾", storm: "风雨"});
export function coastalWeatherTime(time: TimeOfDaySnapshot, weather: LighthouseWeatherSnapshot): TimeOfDaySnapshot {
  const amount = Math.max(0, Math.min(1, (weather.cloudCover-.2)/.8)), brightness = weather.daylightMultiplier;
  if (amount === 0 && brightness === 1) return time;
  const color = (c: LinearTimeColor): LinearTimeColor => {
    const gray=(c[0]+c[1]+c[2])/3;
    return Object.freeze(c.map(v => (v*(1-amount*.65)+gray*amount*.65)*brightness) as [number,number,number]);
  };
  const sun=Object.freeze({...time.sun,strength:time.sun.strength*brightness,intensity:time.sun.intensity*brightness});
  const moon=Object.freeze({...time.moon,strength:time.moon.strength*brightness,intensity:time.moon.intensity*brightness});
  return Object.freeze({...time,sun,moon,primary:time.primary?.kind==="sun"?sun:time.primary?moon:null,
    sky:Object.freeze({...time.sky,horizon:color(time.sky.horizon),zenith:color(time.sky.zenith),
      cloudLight:color(time.sky.cloudLight),cloudShade:color(time.sky.cloudShade),starVisibility:time.sky.starVisibility*(1-amount*.98)}),
    environment:Object.freeze({exterior:time.environment.exterior*brightness,interior:time.environment.interior*brightness})});
}
/** Incremental world fog above the original clear-weather atmosphere; scene scale is 5 units/metre. */
export function coastalWeatherFog(weather: LighthouseWeatherSnapshot, time: TimeOfDaySnapshot) {
  const visibility=Math.max(.1,weather.visibilityKm);
  const density=Math.sqrt(-Math.log(.02)*Math.max(0,1/(visibility*visibility)-1/144))/5000;
  const h=time.sky.horizon, gray=(h[0]+h[1]+h[2])/3;
  return {density,color:new Color3(gray*.95,gray*.985,gray*1.04)};
}
export const weatherUniforms=["weatherCloudCover","weatherFogDensity","weatherFogColor"];
export const coastalWeatherGLSL=`
 uniform float weatherCloudCover, weatherFogDensity;
 uniform vec3 weatherFogColor;
 vec3 coastalWeatherFog(vec3 color, float distanceW) {
   float transmittance=exp(-pow(distanceW*weatherFogDensity,2.));
   return mix(weatherFogColor,color,transmittance);
 }
 vec3 coastalWeatherAtmosphere(vec3 color, vec3 direction) {
   return coastalWeatherFog(color,mix(30000.,3500.,smoothstep(0.,.65,abs(direction.y))));
 }`;
export function applyCoastalWeather(material: ShaderMaterial, weather: LighthouseWeatherSnapshot | undefined, time: TimeOfDaySnapshot) {
  if (!weather) {material.setFloat("weatherCloudCover",0);material.setFloat("weatherFogDensity",0);material.setVector3("weatherFogColor",Vector3.Zero());return;}
  const fog=coastalWeatherFog(weather,time);
  material.setFloat("weatherCloudCover",Math.max(0,(weather.cloudCover-.2)/.8));
  material.setFloat("weatherFogDensity",fog.density);
  material.setVector3("weatherFogColor",new Vector3(fog.color.r,fog.color.g,fog.color.b));
}
export function applyCoastalSceneFog(scene: Scene, weather: LighthouseWeatherSnapshot, time: TimeOfDaySnapshot) {
  const fog=coastalWeatherFog(weather,time);
  scene.fogMode=fog.density>0?2:0; scene.fogDensity=fog.density;
  scene.fogColor.copyFrom(fog.color.toGammaSpace());
}
export const lighthouseOutsideWorkAllowed=(weather: LighthouseWeatherSnapshot)=>weather.rain<.15;
