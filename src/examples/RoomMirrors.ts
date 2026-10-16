import { Color3, Color4, Frustum, Plane, PBRMaterial } from "@babylonjs/core/pure";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture.pure";
import type { AbstractMesh, Scene } from "@babylonjs/core/pure";
import { roomOwners } from "./RoomOwnership";
import { HOUSE_DOORS } from "./HouseLayout";

/** Local planar mirrors, including the directly connected room seen through an open door. */
export class RoomMirrors {
  constructor(private readonly scene: Scene) {
    scene.meshes.filter(mesh => mesh.metadata?.mirrorPlane).forEach(mesh => this.install(mesh));
  }

  private install(mesh: AbstractMesh) {
    const owner = mesh.metadata.reflectionRoom;
    const rooms = new Set([owner]);
    HOUSE_DOORS.forEach(door => {
      if (door.from === owner && door.to !== "outside") rooms.add(door.to);
      if (door.to === owner) rooms.add(door.from);
    });
    const plane = Plane.FromArray(mesh.metadata.mirrorPlane);
    const target = new MirrorTexture(`${owner}-mirror-target-${mesh.uniqueId}`, 512, this.scene, false);
    target.mirrorPlane = plane;
    target.clearColor = new Color4(0.04, 0.045, 0.04, 1);
    target.refreshRate = 0; // Initialize once; reset only while a front-facing mirror is in view.
    target.renderParticles = false;
    target.noPrePassRenderer = true; // Reflection uses colour/depth only; keep SSAO's MRT on the main scene.
    const material = new PBRMaterial(`${owner}-planar-mirror-${mesh.uniqueId}`, this.scene);
    material.albedoColor = Color3.FromHexString("#f5f5f5").toLinearSpace();
    material.metallic = 1; material.roughness = 0;
    material.reflectionTexture = target; material.environmentIntensity = 1;
    material.maxSimultaneousLights = 4;
    mesh.material = material;
    const eligible = (candidate: AbstractMesh) => candidate.getTotalVertices() > 0 && candidate.isEnabled()
      && roomOwners(candidate).some(id => rooms.has(id)) && !candidate.metadata?.mirrorPlane
      && !candidate.metadata?.inspectionPreview && !candidate.metadata?.collisionOnly;
    const updateList = () => { target.renderList = this.scene.meshes.filter(eligible); };
    updateList();
    const before = this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      if (!camera || !mesh.isEnabled() || !mesh.isVisible || mesh.visibility <= 0
        || !(camera.layerMask & mesh.layerMask)) return;
      const front = plane.signedDistanceTo(camera.globalPosition) < -0.01;
      if (front && mesh.isInFrustum(Frustum.GetPlanes(camera.getTransformationMatrix()))) {
        updateList(); target.resetRefreshCounter();
      }
    });
    let hidden: AbstractMesh[] = [];
    target.onBeforeBindObservable.add(() => {
      // A cutaway is a viewing aid; the mirror still reflects a physically enclosed bathroom.
      hidden = target.renderList!.filter(m => !m.isVisible
        && (m.metadata?.span || m.metadata?.cut || m.name.endsWith("-ceiling")));
      hidden.forEach(m => m.isVisible = true);
    });
    target.onAfterUnbindObservable.add(() => { hidden.forEach(m => m.isVisible = false); hidden = []; });
    mesh.onDisposeObservable.addOnce(() => {
      this.scene.onBeforeRenderObservable.remove(before);
      target.dispose(); material.dispose(false, false);
    });
  }
}
