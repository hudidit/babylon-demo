import { MaterialPluginBase } from "@babylonjs/core/pure";
import type { PBRMaterial } from "@babylonjs/core/pure";

/** Exterior-only, world-scale finishes. No generated image, download or extra render target. */
export class CoastalFinish extends MaterialPluginBase {
  constructor(material: PBRMaterial, private readonly kind: "plaster" | "wood" | "path" | "paving" | "roof") {
    super(material, "CoastalFinish", 210, {}, true, true); this.doNotSerialize = true;
  }
  getCustomCode(type: string) {
    if (type !== "fragment") return null;
    // Literal whitespace is intentionally compact; token parity is regression-tested.
    const pattern = this.kind === "plaster" ? `
float salt=1.-smoothstep(3.6,6.5,q.y+.18*sin(q.x*4.));float streak=.5+.5*sin(q.x*27.+q.z*19.+sin(q.y*2.)*.2);surfaceAlbedo*=mix(vec3(.98,.98,.96),vec3(.66,.69,.64),salt*(.18+.34*streak));surfaceAlbedo*=.96+.04*coastNoise(q*90.);`
      : this.kind === "wood" ? `
float phase=q.x*84.+q.z*91.+sin(q.y*3.)*3.;float grain=sin(phase)*(1.-smoothstep(.6,3.,fwidth(phase)));surfaceAlbedo*=.79+.16*grain+.05*coastNoise(q*47.);`
      : this.kind === "roof" ? `
float seam=1.-smoothstep(.012,.027+fwidth(q.x),abs(fract(q.x/.55)-.5)*.55);surfaceAlbedo*=.92+.05*sin(q.z*.3)-.23*seam;`
      : `
surfaceAlbedo*=vec3(2.2,2.12,2.02);float paving=${this.kind=== "paving" ? "1." : "smoothstep(70.,78.,q.z)* (1.-smoothstep(-114.,-110.,q.x))"};vec2 tile=vec2(q.x/.65+floor(q.z/.42)*.5,q.z/.42);vec2 edge=min(fract(tile),1.-fract(tile));float joint=(1.-smoothstep(.012,.035+max(fwidth(tile.x),fwidth(tile.y)),min(edge.x,edge.y)))
*(1.-smoothstep(.2,.6,max(fwidth(tile.x),fwidth(tile.y))));float stones=coastNoise(vec3(floor(tile),0.));surfaceAlbedo*=mix(.78+.18*coastNoise(q*35.),(.82+.16*stones)*(1.-.42*joint),paving);`;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `float coastNoise(vec3 p) {
float phase=dot(p,vec3(.71,.37,.53));return .5+.25*sin(phase+sin(p.x*.39))*(1.-smoothstep(.6,3.,fwidth(phase)));}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `vec3 q=vec3(vPositionW.x/5.+5.4,(vPositionW.y+5.)/5.,vPositionW.z/5.+5.4);${pattern}`,
    };
  }
}
