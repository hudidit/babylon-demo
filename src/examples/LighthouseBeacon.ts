import { Mesh, ShaderMaterial, TransformNode, Vector3, VertexData } from "@babylonjs/core/pure";
import type { PBRMaterial, Scene } from "@babylonjs/core/pure";
import { CoastalBatch } from "./CoastalLandmark";
import type { CoastalMaterials } from "./CoastalMaterials";
import { COASTAL_SITE } from "./CoastalSite";
import { HOUSE_ROOMS, HOUSE_COORDINATES, planToWorld } from "./HouseLayout";
import { setRoomOwners } from "./RoomOwnership";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import { LighthouseBeam } from "./LighthouseBeam";

export const LIGHTHOUSE_BEAM = Object.freeze({ innerAngle: 6 * Math.PI / 180, outerAngle: 12 * Math.PI / 180,
  opticHeight: 17.85, sourceWidth: .36, sourceHeight: .58, sourceForward: .39, minimumSignalPixels: 3 });

const beamLobeGLSL = `float beamLobe(){
  vec2 delta=cameraPosition.xz-beamOrigin.xz;
  float facing=dot(delta/max(length(delta),.00001),beamDirection.xz);
  return smoothstep(${Math.cos(LIGHTHOUSE_BEAM.outerAngle)},${Math.cos(LIGHTHOUSE_BEAM.innerAngle)},facing);
}`;

/** One forward lobe: the opposite direction never receives a second flash. */
export function lighthouseBeamStrength(turns: number, x: number, z: number): number {
  if (![turns, x, z].every(Number.isFinite) || Math.hypot(x, z) < 1e-8) return 0;
  const angle = turns * Math.PI * 2, cosine = (x * Math.sin(angle) + z * Math.cos(angle)) / Math.hypot(x, z);
  const t = Math.max(0, Math.min(1, (cosine - Math.cos(LIGHTHOUSE_BEAM.outerAngle))
    / (Math.cos(LIGHTHOUSE_BEAM.innerAngle) - Math.cos(LIGHTHOUSE_BEAM.outerAngle))));
  return t * t * (3 - 2 * t);
}

/** Only the optical head moves. Emission is local to its real face and uses the current rendering eye. */
export class LighthouseBeacon {
  readonly root: TransformNode;
  readonly meshes: Mesh[];
  readonly source: Mesh;
  readonly material: ShaderMaterial;
  readonly volume: LighthouseBeam;
  private disposed = false;

  constructor(private readonly scene: Scene, surfaces: CoastalMaterials, retain: (mesh: Mesh, layer: "landmark") => Mesh) {
    const t = COASTAL_SITE.tower, u = HOUSE_COORDINATES.unitsPerMeter;
    const origin = planToWorld(t, t.ground + LIGHTHOUSE_BEAM.opticHeight);
    this.root = new TransformNode("coastal-lighthouse-optical-head", scene);
    this.root.position.set(origin.x, origin.y, origin.z);
    setRoomOwners(this.root, HOUSE_ROOMS.map(r => r.id));
    this.root.metadata = {...this.root.metadata, deviceId: "lighthouse-beacon-main"};
    const keep = (mesh: Mesh, layer: "landmark") => {
      retain(mesh, layer); mesh.metadata.movingLighthouseOptic = true;
      mesh.metadata.deviceId = "lighthouse-beacon-main";
      mesh.receiveShadows = false;
      mesh.unfreezeWorldMatrix(); mesh.setParent(this.root);
      return mesh;
    };
    const b = new CoastalBatch(scene, keep);
    const brass = scene.getMaterialByName("coastal-lantern-brass") as PBRMaterial;
    const metal = scene.getMaterialByName("coastal-painted-metal") as PBRMaterial;
    const lens = surfaces.solid("coastal-lighthouse-optical-glass", "#c6ded7");
    lens.metallic = .25; lens.roughness = .12; lens.alpha = .62;
    b.cylinder("coastal-lighthouse-optic-core", brass, t.x, t.y, t.ground + 17.45, .85, .5, .45, 24);
    for (let i = 0; i < 9; i++) b.cylinder("coastal-lighthouse-optic-rings", lens, t.x, t.y,
      t.ground + 17.46 + i * .085, .055, .82 - Math.abs(i - 4) * .025, undefined, 32);
    for (const height of [17.48, 17.7, 17.92, 18.14])
      b.cylinder("coastal-lighthouse-optic-core", brass, t.x, t.y, t.ground + height, .025, .76, .76, 24);
    // The dark back and single forward aperture make rotation legible even between flashes.
    b.box("coastal-lighthouse-optic-housing", metal, .36, .63, .10, t.x, t.y - .19, t.ground + 17.85);
    for (const side of [-1, 1]) b.box("coastal-lighthouse-optic-housing", metal, .025, .64, .20,
      t.x + side * .17, t.y + .24, t.ground + 17.85);
    this.meshes = b.finish();
    this.material = new ShaderMaterial("lighthouse-directional-emission", scene, {
      vertexSource: `attribute vec3 position; attribute vec2 uv; uniform mat4 world, viewProjection;
        uniform vec3 cameraPosition, beamOrigin, beamDirection; uniform vec2 viewportSize; uniform float beaconOn;
        varying vec2 vUV;
        #include<clipPlaneVertexDeclaration>
        ${beamLobeGLSL}
        void main(){vec4 worldPos=world*vec4(position,1.);vUV=uv;gl_Position=viewProjection*worldPos;
          vec4 centre=viewProjection*world*vec4(0.,0.,${LIGHTHOUSE_BEAM.sourceForward * u},1.);
          vec4 edge=viewProjection*world*vec4(${LIGHTHOUSE_BEAM.sourceWidth * u / 2},0.,${LIGHTHOUSE_BEAM.sourceForward * u},1.);
          if(centre.w>0.&&edge.w>0.&&gl_Position.w>0.){
            float halfPixels=length((edge.xy/edge.w-centre.xy/centre.w)*viewportSize*.5);
            float scale=mix(1.,max(1.,${LIGHTHOUSE_BEAM.minimumSignalPixels / 2}/max(halfPixels,.0001)),beaconOn*beamLobe());
            gl_Position.xy=(centre.xy/centre.w+(gl_Position.xy/gl_Position.w-centre.xy/centre.w)*scale)*gl_Position.w;
          }
          #include<clipPlaneVertex>
        }`,
      fragmentSource: `precision highp float; varying vec2 vUV;
        uniform vec3 cameraPosition, beamOrigin, beamDirection; uniform float beaconOn, surfaceTransmission;
        #include<clipPlaneFragmentDeclaration>
        ${beamLobeGLSL}
        void main(){
          #include<clipPlaneFragment>
          vec2 p=vUV*2.-1.;if(dot(p,p)>1.)discard;
          float beam=beamLobe();
          float brightness=.025+beaconOn*beam*24.*surfaceTransmission;
          gl_FragColor=vec4(vec3(.96,.98,1.)*brightness,1.);
        }`,
    }, {attributes: ["position", "uv"], uniforms: ["world", "viewProjection", "cameraPosition", "beamOrigin", "beamDirection", "beaconOn", "surfaceTransmission", "viewportSize"], useClipPlane: true});
    this.material.backFaceCulling = false;
    this.material.setVector3("beamOrigin", this.root.position);
    this.material.setVector3("beamDirection", new Vector3(0, 0, 1)); this.material.setFloat("beaconOn", 0);
    this.material.onBindObservable.add(() => {
      const eye = scene._mirroredCameraPosition || scene.activeCamera?.globalPosition;
      if (eye) this.material.getEffect()?.setVector3("cameraPosition", eye);
      const engine = scene.getEngine();
      this.material.getEffect()?.setFloat2("viewportSize", engine.getRenderWidth(), engine.getRenderHeight());
    });
    this.source = new Mesh("coastal-lighthouse-beacon-face", scene);
    const data = new VertexData(), w = LIGHTHOUSE_BEAM.sourceWidth * u / 2, h = LIGHTHOUSE_BEAM.sourceHeight * u / 2;
    const z = LIGHTHOUSE_BEAM.sourceForward * u;
    data.positions = [-w, -h, z, w, -h, z, w, h, z, -w, h, z];
    data.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    data.indices = [0, 2, 1, 0, 3, 2]; data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    data.applyToMesh(this.source); this.source.material = this.material;
    retain(this.source, "landmark"); this.source.unfreezeWorldMatrix(); this.source.parent = this.root;
    this.source.metadata = {...this.source.metadata, movingLighthouseOptic: true, deviceId: "lighthouse-beacon-main"};
    this.source.receiveShadows = false; this.meshes.push(this.source);
    this.volume = new LighthouseBeam(scene, this.root, LIGHTHOUSE_BEAM.sourceForward, retain);
  }

  apply(state: LighthouseOperationSnapshot, transmission = 1) {
    if (this.disposed) return;
    this.root.rotation.y = state.rotationRadians;
    this.material.setVector3("beamDirection", new Vector3(Math.sin(state.rotationRadians), 0, Math.cos(state.rotationRadians)));
    this.material.setFloat("beaconOn", state.running ? 1 : 0);
    this.material.setFloat("surfaceTransmission", transmission);
    this.volume.apply(state.rotationRadians, state.running, transmission);
  }

  setVisible(visible: boolean) { if (!this.disposed) {this.root.setEnabled(visible); this.volume.setVisible(visible);} }
  dispose() { if (this.disposed) return; this.disposed = true; this.volume.dispose(); this.root.dispose(); this.material.dispose(false, false); }
}
