import { CreateBox, Mesh, ShaderMaterial, VertexData } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import type { CoastalMaterials } from "./CoastalMaterials";
import { COASTAL_SITE } from "./CoastalSite";
import { HOUSE_COORDINATES, planToWorld } from "./HouseLayout";
import { LIGHTHOUSE } from "./LighthouseLayout";
import type { InteractiveDevice } from "./RoomInteractions";
import type { LighthouseInspectionSnapshot } from "./LighthouseInspection";
import { LIGHTHOUSE_INSPECTION } from "./LighthouseInspection";

export const LIGHTHOUSE_COVER = Object.freeze({ radius: .438, halfAngle: Math.PI * .28, height: .78, centreHeight: 1.21 });

/** A fixed, reachable protective pane. The wipe tool and salt are generated locally, without image assets. */
export class LighthouseCover {
  readonly device: InteractiveDevice;
  readonly pane: Mesh;
  readonly cloth: Mesh;
  readonly material: ShaderMaterial;
  private disposed = false;
  private visible = true;
  private last?: LighthouseInspectionSnapshot;
  constructor(scene: Scene, surfaces: CoastalMaterials, retain: (mesh: Mesh, layer: "landmark") => Mesh) {
    const t = COASTAL_SITE.tower, u = HOUSE_COORDINATES.unitsPerMeter, config = LIGHTHOUSE_COVER;
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = -config.halfAngle + 2 * config.halfAngle * i / 16;
      for (const h of [-config.height / 2, config.height / 2]) {
        const p = planToWorld({x: t.x + config.radius * Math.sin(angle), y: t.y - config.radius * Math.cos(angle)}, LIGHTHOUSE.gallery + config.centreHeight + h);
        positions.push(p.x, p.y, p.z); normals.push(Math.sin(angle), 0, -Math.cos(angle)); uvs.push(i / 16, h < 0 ? 0 : 1);
      }
      if (i < 16) {const n = i * 2; indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);}
    }
    this.pane = new Mesh("coastal-lighthouse-protective-surface", scene);
    const data = new VertexData(); Object.assign(data, {positions, normals, uvs, indices}); data.applyToMesh(this.pane);
    this.material = new ShaderMaterial("lighthouse-fixed-salt-film", scene, {
      vertexSource: `attribute vec3 position;attribute vec2 uv;uniform mat4 world,viewProjection;varying vec2 vUV;
        #include<clipPlaneVertexDeclaration>
        void main(){vec4 worldPos=world*vec4(position,1.);vUV=uv;gl_Position=viewProjection*worldPos;
          #include<clipPlaneVertex>
        }`,
      fragmentSource: `precision highp float;varying vec2 vUV;uniform float saltAmount;
        #include<clipPlaneFragmentDeclaration>
        float grainAt(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          #include<clipPlaneFragment>
          vec2 sampleUV=vUV*vec2(140.,190.),cell=floor(sampleUV),f=fract(sampleUV);f=f*f*(3.-2.*f);
          float grain=mix(mix(grainAt(cell),grainAt(cell+vec2(1.,0.)),f.x),mix(grainAt(cell+vec2(0.,1.)),grainAt(cell+vec2(1.,1.)),f.x),f.y);
          float edge=smoothstep(.34,.5,abs(vUV.x-.5))+smoothstep(.31,.5,abs(vUV.y-.5));
          float streak=.5+.5*sin(vUV.y*46.+sin(vUV.x*12.)*3.);
          float salt=(.055+.075*streak+.105*smoothstep(.60,.88,grain)+.035*edge)*saltAmount;
          gl_FragColor=vec4(mix(vec3(.48,.67,.64),vec3(.90,.89,.78),saltAmount),.035+salt);
        }`,
    }, {attributes: ["position", "uv"], uniforms: ["world", "viewProjection", "saltAmount"], needAlphaBlending: true, useClipPlane: true});
    this.material.backFaceCulling = false; this.material.setFloat("saltAmount", 1); this.pane.material = this.material;
    retain(this.pane, "landmark"); this.pane.receiveShadows = false;
    this.pane.metadata = {...this.pane.metadata, deviceId: LIGHTHOUSE_INSPECTION.coverId, lighthouseProtectivePane: true};
    this.device = {id: LIGHTHOUSE_INSPECTION.coverId, label: "固定保护面 · 盐膜检查与清洁", meshes: [this.pane]};
    this.cloth = CreateBox("coastal-lighthouse-cleaning-cloth", {width: .12 * u, height: .09 * u, depth: .012 * u}, scene);
    this.cloth.material = surfaces.solid("coastal-lighthouse-cloth-fibre", "#d2d8c4");
    retain(this.cloth, "landmark"); this.cloth.unfreezeWorldMatrix(); this.cloth.receiveShadows = false;
    this.cloth.metadata = {...this.cloth.metadata, lighthouseMaintenanceTool: true}; this.cloth.setEnabled(false);
  }
  apply(state: LighthouseInspectionSnapshot) {
    if (this.disposed) return;
    this.last = state; this.material.setFloat("saltAmount", state.dirty ? 1 : 0);
    this.pane.metadata.coverRevision = state.coverRevision;
    this.cloth.setEnabled(this.visible && state.cleaning);
    if (state.cleaning) {
      const progress = state.cleaningSeconds / LIGHTHOUSE_INSPECTION.cleaningSeconds, angle = Math.sin(progress * Math.PI * 4) * .52;
      const t = COASTAL_SITE.tower, p = planToWorld({x: t.x + .449 * Math.sin(angle), y: t.y - .449 * Math.cos(angle)},
        LIGHTHOUSE.gallery + LIGHTHOUSE_COVER.centreHeight + .23 * Math.cos(progress * Math.PI * 2));
      this.cloth.position.set(p.x, p.y, p.z); this.cloth.rotation.y = -angle;
    }
  }
  setVisible(visible: boolean) { this.visible = visible; if (this.last) this.apply(this.last); }
  dispose() { if (this.disposed) return; this.disposed = true; this.pane.dispose(); this.cloth.dispose(); this.material.dispose(false, false); }
}
