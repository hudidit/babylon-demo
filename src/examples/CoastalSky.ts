import { Color3, ShaderMaterial, Vector3 } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";
import { coastalWeatherGLSL, weatherUniforms } from "./CoastalWeather";

// Read by tools/generate-coastal-environment.py. Neutral, azimuth-independent, sun-free IBL.
export const COASTAL_ENVIRONMENT = {"horizon":[0.75,0.75,0.75],"zenith":[0.55,0.55,0.55],"ground":[0.20,0.20,0.20],"width":256,"height":128} as const;

/** Fixed world directions; v2 adds filtered water reflection without changing seeds or positions. */
export const COASTAL_SKY_DETAILS = Object.freeze({ version: "coastal-clouds-stars-v2", seed: 17.17,
  cloudScale: 6.4, cloudThreshold: .60, starGrid: 24, starProbability: .18, starRadius: .00095,
  reflectionStarRetention: .1, reflectionStarFadeStart: .08, reflectionStarFadeEnd: .18 });

/** A modest tint, separate from brightness, avoids applying the night reduction twice. */
export function timeEnvironmentColor(state: TimeOfDaySnapshot): Color3 {
  const h = state.sky.horizon, z = state.sky.zenith;
  const c = new Color3(h[0] * .65 + z[0] * .35, h[1] * .65 + z[1] * .35, h[2] * .65 + z[2] * .35);
  const maximum = Math.max(c.r, c.g, c.b, .0001);
  return Color3.Lerp(Color3.White(), c.scale(1 / maximum), .35);
}

/** Shared by the dome and ocean reflection. All inputs/outputs are linear. */
export const coastalSkyGLSL = `
  ${coastalWeatherGLSL}
  uniform vec3 skyHorizon, skyZenith, skySunDirection, sunDirection, sunColor;
  uniform vec3 skyCloudLight, skyCloudShade, skyMoonDirection;
  uniform float sunStrength, sunWarmth, skyStarVisibility, skyMoonVisibility;
  vec3 coastalSkyGradient(vec3 d) {
    float t=pow(clamp(abs(d.y)*2.,0.,1.),.65);
    vec3 neutral=mix(skyHorizon,skyZenith,.55);
    vec2 horizontal=d.xz/max(length(d.xz),.0001);
    vec2 towardSun=skySunDirection.xz/max(length(skySunDirection.xz),.0001);
    float warm=pow(max(0.,dot(horizontal,towardSun)),6.)*exp(-abs(d.y)*7.);
    vec3 horizon=mix(skyHorizon,mix(neutral,skyHorizon,warm),sunWarmth);
    return mix(horizon,skyZenith,t);
  }
  float coastalStarVisibility(vec3 d) {
    float moon=1.-smoothstep(.97,.9995,dot(d,skyMoonDirection))*skyMoonVisibility;
    return skyStarVisibility*smoothstep(.035,.20,d.y)*moon;
  }`;

/** The same cloud field in sky and water. Angular filtering never changes its seed or direction. */
export const coastalSkyCloudsGLSL = `
  float coastalHash(vec3 p) {
    p=fract(p*vec3(.1031,.1137,.1379)+${COASTAL_SKY_DETAILS.seed});
    p+=dot(p,p.yzx+19.19);
    return fract((p.x+p.y)*p.z);
  }
  vec4 coastalNoise(vec3 p) {
    vec3 i=floor(p), f=fract(p), u=f*f*(3.-2.*f), du=6.*f*(1.-f);
    float a=coastalHash(i), b=coastalHash(i+vec3(1.,0.,0.));
    float c=coastalHash(i+vec3(0.,1.,0.)), e=coastalHash(i+vec3(0.,0.,1.));
    float v=coastalHash(i+vec3(1.,1.,0.)), g=coastalHash(i+vec3(0.,1.,1.));
    float h=coastalHash(i+vec3(1.,0.,1.)), k=coastalHash(i+1.);
    vec4 rows=vec4(mix(a,b,u.x),mix(c,v,u.x),mix(e,h,u.x),mix(g,k,u.x));
    float low=mix(rows.x,rows.y,u.y), high=mix(rows.z,rows.w,u.y);
    vec3 gradient=vec3(mix(mix(b-a,v-c,u.y),mix(h-e,k-g,u.y),u.z),
      mix(rows.y-rows.x,rows.w-rows.z,u.z),high-low)*du;
    return vec4(mix(low,high,u.z),gradient);
  }
  float coastalCloudDensity(vec3 d, float filterAngle, out vec3 normal) {
    vec3 p=d*${COASTAL_SKY_DETAILS.cloudScale}+vec3(3.7,1.9,8.3);
    vec4 base=coastalNoise(p);
    vec3 attenuation=exp(-pow(filterAngle*${COASTAL_SKY_DETAILS.cloudScale}*vec3(1.,2.13,4.27),vec3(2.)));
    float n=.5+.64*(base.x-.5)*attenuation.x
      +.26*(coastalNoise(p*2.13+5.1).x-.5)*attenuation.y+.10*(coastalNoise(p*4.27+9.2).x-.5)*attenuation.z;
    // An analytic density gradient paints a soft lit top; this is not volume scattering.
    normal=normalize(vec3(0.,.8,0.)-base.yzw);
    float edge=sqrt(.0375*.0375+pow(filterAngle*${COASTAL_SKY_DETAILS.cloudScale}*.20,2.));
    float threshold=${COASTAL_SKY_DETAILS.cloudThreshold}-weatherCloudCover*.24;
    float density=smoothstep(threshold+.0175-edge,threshold+.0175+edge,n);
    // Very large footprints converge to a diffuse coverage rather than aliasing tiny islands.
    return mix(density,.18+weatherCloudCover*.7,smoothstep(.16,.65,filterAngle))
      *smoothstep(.025,.18,d.y);
  }
  vec3 coastalCloudColor(vec3 d, float density, vec3 normal) {
    float light=.72+.25*max(0.,normal.y);
    vec3 color=mix(skyCloudShade,skyCloudLight,light);
    float toward=pow(max(0.,dot(d,skySunDirection)),5.);
    float edge=4.*density*(1.-density);
    return mix(color,color*vec3(1.12,.77,.57),sunWarmth*toward*(.3+.7*edge)*.65);
  }`;

// Integrated Gaussian star flux per grid cell. Rough water keeps only this faint mean, not points.
const reflectedStarMean = 2 * Math.PI * (COASTAL_SKY_DETAILS.starRadius * COASTAL_SKY_DETAILS.starGrid) ** 2
  * COASTAL_SKY_DETAILS.starProbability * (.12 + (.65 - .12) / 4) * (.7 ** 2 + .7 * 1.25 + 1.25 ** 2) / 3
  * COASTAL_SKY_DETAILS.reflectionStarRetention; // Artistic residual after the rough-water low-pass.
export const coastalSkyReflectionGLSL = `
  vec3 coastalSkyReflection(vec3 d, float angularFootprint, float roughness) {
    float blur=clamp(max(angularFootprint,roughness*roughness),0.,1.);
    vec3 normal;
    float cloud=coastalCloudDensity(d,blur,normal);
    // Extinguish the star band on rough water before the existing 8-bit scene-colour quantisation.
    float starBand=1.-smoothstep(${COASTAL_SKY_DETAILS.reflectionStarFadeStart},${COASTAL_SKY_DETAILS.reflectionStarFadeEnd},roughness);
    vec3 meanStars=vec3(.89,.885,.885)*${reflectedStarMean.toFixed(9)}*coastalStarVisibility(d)*starBand;
    // The ocean's existing GGX lobe supplies the sun/moon highlight exactly once.
    return coastalWeatherAtmosphere(mix(coastalSkyGradient(d)+meanStars*(1.-cloud),coastalCloudColor(d,cloud,normal),cloud*.88),d);
  }`;

/** Fine stars and the celestial disk belong to the background, never the sea-haze gradient. */
export const coastalSkyDetailsGLSL = `
  vec3 coastalStars(vec3 d, vec2 q, vec2 dx, vec2 dy) {
    if(d.y<=0. || skyStarVisibility<=0.) return vec3(0.);
    vec2 cell=floor(q);
    // Gaussian convolution retains energy when the angular core becomes smaller than a pixel.
    float pixelVariance=(dot(dx,dx)+dot(dy,dy))/12.;
    vec3 stars=vec3(0.);
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
      vec2 c=cell+vec2(float(x),float(y));
      float choice=coastalHash(vec3(c,2.7));
      vec2 offset=.12+.76*vec2(coastalHash(vec3(c,5.3)),coastalHash(vec3(c,9.1)));
      vec2 delta=q-c-offset;
      float radius=${COASTAL_SKY_DETAILS.starRadius}*${COASTAL_SKY_DETAILS.starGrid.toFixed(1)}
        *mix(.7,1.25,coastalHash(vec3(c,13.6)));
      float variance=radius*radius+pixelVariance;
      float kernel=exp(-dot(delta,delta)/(2.*variance))*radius*radius/variance;
      float brightness=mix(.12,.65,pow(coastalHash(vec3(c,17.8)),3.));
      vec3 tint=mix(vec3(1.,.89,.77),vec3(.78,.88,1.),coastalHash(vec3(c,23.4)));
      stars+=tint*brightness*kernel*(1.-step(${COASTAL_SKY_DETAILS.starProbability},choice));
    }
    return stars*coastalStarVisibility(d);
  }
  vec3 coastalSkyRadiance(vec3 d) {
    // Differentiate the continuous equal-area map before any branch, floor or cell randomisation.
    vec2 q=d.xz/sqrt(max(1.+d.y,.001))*${COASTAL_SKY_DETAILS.starGrid.toFixed(1)};
    vec2 dx=dFdx(q), dy=dFdy(q);
    vec3 cloudNormal;
    float cloud=coastalCloudDensity(d,0.,cloudNormal);
    float alignment=clamp(dot(d,sunDirection),0.,1.);
    float disk=smoothstep(.99994,.99999,alignment);
    float glow=pow(alignment,350.)*.12;
    vec3 clear=coastalSkyGradient(d)+coastalStars(d,q,dx,dy)*(1.-cloud)
      +sunColor*(disk*10.+glow)*sunStrength*(1.-cloud*.65);
    return coastalWeatherAtmosphere(mix(clear,coastalCloudColor(d,cloud,cloudNormal),cloud*.88),d);
  }`;

export function applySkyTime(material: ShaderMaterial, state: TimeOfDaySnapshot) {
  const body = state.primary;
  material.setVector3("skyHorizon", Vector3.FromArray(state.sky.horizon));
  material.setVector3("skyZenith", Vector3.FromArray(state.sky.zenith));
  material.setVector3("skySunDirection", Vector3.FromArray(state.sky.sunDirection || state.sun.sourceDirection));
  material.setVector3("sunDirection", body ? Vector3.FromArray(body.sourceDirection) : new Vector3(0, 1, 0));
  material.setVector3("sunColor", body ? Vector3.FromArray(body.color) : Vector3.Zero());
  material.setFloat("sunStrength", body?.strength || 0);
  material.setFloat("sunWarmth", state.sky.warmth ?? Math.max(0, 1 - Math.abs(state.sun.elevation - 5) / 30));
  material.setVector3("skyCloudLight", Vector3.FromArray(state.sky.cloudLight));
  material.setVector3("skyCloudShade", Vector3.FromArray(state.sky.cloudShade));
  material.setFloat("skyStarVisibility", state.sky.starVisibility);
  material.setVector3("skyMoonDirection", Vector3.FromArray(state.moon.sourceDirection));
  material.setFloat("skyMoonVisibility", Math.min(1, state.moon.strength / .04));
}

export const skyTimeUniforms = ["skyHorizon", "skyZenith", "skySunDirection", "sunDirection", "sunColor", "sunStrength", "sunWarmth",
  "skyCloudLight", "skyCloudShade", "skyStarVisibility", "skyMoonDirection", "skyMoonVisibility", ...weatherUniforms];
export function createCoastalSky(scene: Scene): ShaderMaterial {
  const material = new ShaderMaterial("coastal-sky", scene, {
    vertexSource: `precision highp float;
      attribute vec3 position; uniform mat4 world, viewProjection;
      varying vec3 vSkyPositionW;
      #include<clipPlaneVertexDeclaration>
      void main() {vec4 worldPos=world*vec4(position,1.);vSkyPositionW=worldPos.xyz;
        gl_Position=viewProjection*worldPos;
        #include<clipPlaneVertex>
      }`,
    fragmentSource: `#extension GL_OES_standard_derivatives : enable
      precision highp float; varying vec3 vSkyPositionW; uniform vec3 cameraPosition;
      #include<clipPlaneFragmentDeclaration>
      ${coastalSkyGLSL}
      ${coastalSkyCloudsGLSL}
      ${coastalSkyDetailsGLSL}
      void main() {
        #include<clipPlaneFragment>
        gl_FragColor=vec4(coastalSkyRadiance(normalize(vSkyPositionW-cameraPosition)),1.);
      }`,
  }, { attributes: ["position"], uniforms: ["world", "viewProjection", "cameraPosition", ...skyTimeUniforms], useClipPlane: true });
  material.onBindObservable.add(() => {
    const eye = scene._mirroredCameraPosition || scene.activeCamera?.globalPosition;
    if (eye) material.getEffect()?.setVector3("cameraPosition", eye);
  });
  return material;
}
