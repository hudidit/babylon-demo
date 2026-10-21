import { Constants, Mesh, ShaderMaterial, Vector3, VertexData } from "@babylonjs/core/pure";
import type { Scene, TransformNode } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES } from "./HouseLayout";
import { coastalSeaY } from "./CoastalCliff";

/** Metres. A slight downward pitch reaches the water roughly 460m from the optic. */
export const LIGHTHOUSE_SHAFT = Object.freeze({ length: 620, pitch: 6 * Math.PI / 180,
  horizontalSlope: Math.tan(3 * Math.PI / 180), verticalSlope: Math.tan(1.6 * Math.PI / 180), aperture: .24 });
export const lighthouseShaftUniforms = ["shaftOrigin", "shaftDirection", "shaftRight", "shaftPower"];
export const lighthouseShaftGLSL = `
  uniform vec3 shaftOrigin, shaftDirection, shaftRight;
  uniform float shaftPower;
  const float shaftLength=${LIGHTHOUSE_SHAFT.length.toFixed(1)};
  vec3 shaftCoordinates(vec3 p) {
    vec3 d=(p-shaftOrigin)/${HOUSE_COORDINATES.unitsPerMeter.toFixed(1)};
    return vec3(dot(d,shaftRight),dot(d,cross(shaftDirection,shaftRight)),dot(d,shaftDirection));
  }
  vec2 shaftRadius(float z) { return vec2(${LIGHTHOUSE_SHAFT.aperture},${LIGHTHOUSE_SHAFT.aperture})
    +max(0.,z)*vec2(${LIGHTHOUSE_SHAFT.horizontalSlope},${LIGHTHOUSE_SHAFT.verticalSlope}); }
  float shaftEnvelope(vec3 p) {
    vec2 q=p.xy/shaftRadius(p.z);
    return exp(-dot(q,q)*3.)*(1.-smoothstep(.55,1.,dot(q,q)))
      *smoothstep(.3,2.,p.z)*(1.-smoothstep(shaftLength*.72,shaftLength,p.z));
  }`;

/** Shared CPU reference for the finite, single forward cone used by the ocean and air. */
export function lighthouseShaftEnvelope(x: number, y: number, z: number): number {
  const a = LIGHTHOUSE_SHAFT;
  if (![x, y, z].every(Number.isFinite) || z <= 0 || z >= a.length) return 0;
  const r2 = (x / (a.aperture + z * a.horizontalSlope)) ** 2 + (y / (a.aperture + z * a.verticalSlope)) ** 2;
  const smooth = (lo: number, hi: number, value: number) => {const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo))); return t * t * (3 - 2 * t);};
  return Math.exp(-r2 * 3) * (1 - smooth(.55, 1, r2)) * smooth(.3, 2, z) * (1 - smooth(a.length * .72, a.length, z));
}

/** A depth-tested exit shell bounds a short analytic ray integral. No RTT, lights or textures. */
export class LighthouseBeam {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private readonly origin = new Vector3();
  private readonly direction = new Vector3();
  private readonly right = new Vector3();
  private receiver?: ShaderMaterial;
  private power = 0;
  private visible = true;
  private disposed = false;
  constructor(scene: Scene, private readonly root: TransformNode, sourceForward: number,
    retain: (mesh: Mesh, layer: "landmark") => Mesh) {
    const a = LIGHTHOUSE_SHAFT, u = HOUSE_COORDINATES.unitsPerMeter, data = new VertexData();
    const height = (root.position.y - coastalSeaY) / u;
    // Terminate the shell just above the maximum wave crest. An underwater exit shell would
    // fail the ocean's depth test and cut a hard hole through the visible end of the shaft.
    const waterEnd = (sine: number) => (height - .4 + Math.cos(a.pitch) * a.aperture * sine)
      / (Math.sin(a.pitch) - Math.cos(a.pitch) * a.verticalSlope * sine);
    const positions: number[] = [], normals: number[] = [], indices: number[] = [], sides = 32;
    // Two capped rings, with outward normals for fragment-side exit-shell selection.
    for (const end of [false, true]) for (let i = 0; i <= sides; i++) {
      const angle = i / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      const z = end ? waterEnd(s) : 0;
      positions.push(c * (a.aperture + z * a.horizontalSlope) * u, s * (a.aperture + z * a.verticalSlope) * u, z * u);
      normals.push(c / a.horizontalSlope, s / a.verticalSlope, -1);
    }
    for (let i = 0; i < sides; i++) {
      const j = i + sides + 1; indices.push(i, j, i + 1, i + 1, j, j + 1);
    }
    for (const end of [false, true]) {
      const centre = positions.length / 3; positions.push(0, 0, end ? waterEnd(0) * u : 0);
      const normal = end ? [0, -Math.cos(a.pitch), Math.sin(a.pitch)] : [0, 0, -1];
      normals.push(...normal);
      for (let i = 0; i <= sides; i++) {
        const angle = i / sides * Math.PI * 2, z = end ? waterEnd(Math.sin(angle)) : 0;
        positions.push(Math.cos(angle) * (a.aperture + z * a.horizontalSlope) * u,
          Math.sin(angle) * (a.aperture + z * a.verticalSlope) * u, z * u);
        normals.push(...normal);
        if (i) indices.push(centre, centre + i, centre + i + 1);
      }
    }
    data.positions = positions; data.normals = normals; data.indices = indices;
    this.mesh = new Mesh("coastal-lighthouse-visible-beam", scene); data.applyToMesh(this.mesh);
    retain(this.mesh, "landmark"); this.mesh.unfreezeWorldMatrix(); this.mesh.parent = root;
    this.mesh.position.z = sourceForward * u; this.mesh.rotation.x = a.pitch;
    this.mesh.isPickable = false; this.mesh.checkCollisions = false; this.mesh.receiveShadows = false;
    this.mesh.metadata = {...this.mesh.metadata, movingLighthouseOptic: true, deviceId: "lighthouse-beacon-main"};
    this.material = new ShaderMaterial("lighthouse-air-scattering", scene, {
      vertexSource: `precision highp float; attribute vec3 position, normal; uniform mat4 world, viewProjection;
        varying vec3 vPositionW, vNormalW;
        #include<clipPlaneVertexDeclaration>
        void main(){vec4 worldPos=world*vec4(position,1.);vPositionW=worldPos.xyz;
          vNormalW=mat3(world)*normal;gl_Position=viewProjection*worldPos;
          #include<clipPlaneVertex>
        }`,
      fragmentSource: `precision highp float; varying vec3 vPositionW, vNormalW; uniform vec3 cameraPosition;
        uniform float weatherFogDensity;
        #include<clipPlaneFragmentDeclaration>
        ${lighthouseShaftGLSL}
        void main(){
          #include<clipPlaneFragment>
          if(shaftPower<=0.||dot(vNormalW,cameraPosition-vPositionW)>0.)discard;
          vec3 eye=shaftCoordinates(cameraPosition), end=shaftCoordinates(vPositionW);
          vec3 ray=normalize(end-eye);float farT=length(end-eye),lo=0.,hi=farT;
          if(abs(ray.z)<.00001){if(eye.z<0.||eye.z>shaftLength)discard;}
          else {float a=-eye.z/ray.z,b=(shaftLength-eye.z)/ray.z;lo=max(lo,min(a,b));hi=min(hi,max(a,b));}
          // Analytic intersection with the outer circular cone in slope-normalized space.
          // The slightly larger envelope contains the elliptical aperture at every distance.
          vec2 slopes=vec2(${a.horizontalSlope},${a.verticalSlope});
          vec3 q=vec3(eye.xy/slopes,eye.z+${a.aperture / a.verticalSlope});
          vec3 d=vec3(ray.xy/slopes,ray.z);
          float A=dot(d.xy,d.xy)-d.z*d.z,B=dot(q.xy,d.xy)-q.z*d.z,C=dot(q.xy,q.xy)-q.z*q.z;
          float disc=B*B-A*C;
          if(abs(A)<.00001){if(abs(B)>.00001){float hit=-C/(2.*B);if(B>0.)hi=min(hi,hit);else lo=max(lo,hit);}}
          else if(disc>=0.){float r0=(-B-sqrt(disc))/A,r1=(-B+sqrt(disc))/A;
            float enter=min(r0,r1),leave=max(r0,r1);
            if(A>0.){lo=max(lo,enter);hi=min(hi,leave);}
            else if(A*lo*lo+2.*B*lo+C>0.)lo=max(lo,leave);
            else if(enter>lo)hi=min(hi,enter);
          }else if(A>0.)discard;
          if(hi<=lo)discard;
          float opticalDepth=0.;
          for(int i=0;i<16;i++){
            float t=mix(lo,hi,(float(i)+.5)/16.);vec3 p=eye+ray*t;
            float distanceW=t*${u.toFixed(1)};
            float fog=exp(-pow(distanceW*weatherFogDensity,2.));
            float aboveSea=${height}+p.y*${Math.cos(a.pitch)}-p.z*${Math.sin(a.pitch)};
            opticalDepth+=shaftEnvelope(p)*fog*smoothstep(.4,2.5,aboveSea)/(1.+p.z*.024);
          }
          opticalDepth*=(hi-lo)/16.;
          float glow=(1.-exp(-opticalDepth*.10))*shaftPower;
          gl_FragColor=vec4(vec3(.72,.84,1.)*1.35,glow);
        }`,
    }, {attributes: ["position", "normal"], uniforms: ["world", "viewProjection", "cameraPosition", "weatherFogDensity", ...lighthouseShaftUniforms],
      needAlphaBlending: true, useClipPlane: true});
    this.material.backFaceCulling = false; this.material.disableDepthWrite = true; this.material.alphaMode = Constants.ALPHA_ADD;
    this.material.setFloat("weatherFogDensity", 0);
    this.material.onBindObservable.add(() => {
      const eye = scene._mirroredCameraPosition || scene.activeCamera?.globalPosition;
      if (eye) this.material.getEffect()?.setVector3("cameraPosition", eye);
    });
    this.mesh.material = this.material;
    this.apply(0, false, 1);
  }
  connectOcean(material: ShaderMaterial) { this.receiver = material; this.synchronize(); }
  apply(radians: number, running: boolean, transmission: number) {
    if (this.disposed) return;
    const s = Math.sin(radians), c = Math.cos(radians), a = LIGHTHOUSE_SHAFT;
    this.origin.copyFrom(this.root.position).addInPlaceFromFloats(s * this.mesh.position.z, 0, c * this.mesh.position.z);
    this.direction.set(s * Math.cos(a.pitch), -Math.sin(a.pitch), c * Math.cos(a.pitch));
    this.right.set(c, 0, -s);
    this.power = running ? Math.max(0, Math.min(1, transmission)) : 0; this.synchronize();
  }
  private synchronize() {
    const power = this.visible ? this.power : 0;
    this.mesh.setEnabled(power > 0);
    for (const m of [this.material, this.receiver]) if (m) {
      m.setVector3("shaftOrigin", this.origin); m.setVector3("shaftDirection", this.direction);
      m.setVector3("shaftRight", this.right); m.setFloat("shaftPower", power);
    }
  }
  setVisible(visible: boolean) { if (!this.disposed) {this.visible = visible; this.synchronize();} }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.receiver?.setFloat("shaftPower", 0); this.receiver = undefined;
    this.mesh.dispose(); this.material.dispose(false, false);
  }
}
