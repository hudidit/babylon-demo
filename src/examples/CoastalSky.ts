import { Color3, ShaderMaterial, Vector3 } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";

// Read by tools/generate-coastal-environment.py. Neutral, azimuth-independent, sun-free IBL.
export const COASTAL_ENVIRONMENT = {"horizon":[0.75,0.75,0.75],"zenith":[0.55,0.55,0.55],"ground":[0.20,0.20,0.20],"width":256,"height":128} as const;

/** A modest tint, separate from brightness, avoids applying the night reduction twice. */
export function timeEnvironmentColor(state: TimeOfDaySnapshot): Color3 {
  const h = state.sky.horizon, z = state.sky.zenith;
  const c = new Color3(h[0] * .65 + z[0] * .35, h[1] * .65 + z[1] * .35, h[2] * .65 + z[2] * .35);
  const maximum = Math.max(c.r, c.g, c.b, .0001);
  return Color3.Lerp(Color3.White(), c.scale(1 / maximum), .35);
}

/** Shared by the dome and ocean reflection. All inputs/outputs are linear. */
export const coastalSkyGLSL = `
  uniform vec3 skyHorizon, skyZenith, skySunDirection, sunDirection, sunColor;
  uniform float sunStrength, sunWarmth;
  vec3 coastalSkyGradient(vec3 d) {
    float t=pow(clamp(abs(d.y)*2.,0.,1.),.65);
    vec3 neutral=mix(skyHorizon,skyZenith,.55);
    vec2 horizontal=d.xz/max(length(d.xz),.0001);
    vec2 towardSun=skySunDirection.xz/max(length(skySunDirection.xz),.0001);
    float warm=pow(max(0.,dot(horizontal,towardSun)),6.)*exp(-abs(d.y)*7.);
    vec3 horizon=mix(skyHorizon,mix(neutral,skyHorizon,warm),sunWarmth);
    return mix(horizon,skyZenith,t);
  }
  vec3 coastalSkyRadiance(vec3 d) {
    float alignment=clamp(dot(d,sunDirection),0.,1.);
    float disk=smoothstep(.99994,.99999,alignment);
    float glow=pow(alignment,350.)*.12;
    return coastalSkyGradient(d)+sunColor*(disk*10.+glow)*sunStrength;
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
}

export const skyTimeUniforms = ["skyHorizon", "skyZenith", "skySunDirection", "sunDirection", "sunColor", "sunStrength", "sunWarmth"];
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
    fragmentSource: `precision highp float; varying vec3 vSkyPositionW; uniform vec3 cameraPosition;
      #include<clipPlaneFragmentDeclaration>
      ${coastalSkyGLSL}
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
