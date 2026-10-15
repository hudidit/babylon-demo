import { Camera, Color3, StandardMaterial, UniversalCamera, Vector3 } from "@babylonjs/core/pure";
import type { Mesh, PBRMaterial, Scene } from "@babylonjs/core/pure";
import type { InspectableItem } from "./RoomInteractions";

const INSPECTION_LAYER = 0x10000000;

/** A fixed display of the actual object's geometry and texture, within the existing scene/engine. */
export class RoomItemInspection {
  readonly camera: UniversalCamera;
  private previousCamera?: Camera;
  private preview?: Mesh;
  private material?: StandardMaterial;
  private size = Vector3.Zero();

  constructor(private readonly scene: Scene) {
    this.camera = new UniversalCamera("study-item-inspection", new Vector3(0, 0, -8), scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.layerMask = INSPECTION_LAYER;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 20;
    this.camera.inputs.clear();
  }

  get isOpen() { return !!this.preview; }

  open(item: InspectableItem) {
    if (this.isOpen) return false;
    const preview = item.mesh.clone("inspection-" + item.id, null, true, false);
    preview.unfreezeWorldMatrix();
    preview.parent = null;
    preview.rotationQuaternion = null;
    preview.position.setAll(0);
    preview.rotation.copyFrom(item.displayRotation);
    preview.scaling.setAll(1);
    preview.layerMask = INSPECTION_LAYER;
    preview.isPickable = preview.checkCollisions = preview.receiveShadows = false;
    preview.metadata = { castsShadows: false, inspectionPreview: true };
    preview.setEnabled(true);
    const material = new StandardMaterial("inspection-material", this.scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    // StandardMaterial adds emissiveColor to the texture; white would wash the lettering out.
    material.emissiveColor = Color3.Black();
    material.emissiveTexture = (item.mesh.material as PBRMaterial).albedoTexture;
    preview.material = material;
    preview.computeWorldMatrix(true);
    const bounds = preview.getBoundingInfo().boundingBox;
    this.size.copyFrom(bounds.maximumWorld).subtractInPlace(bounds.minimumWorld);
    preview.position.subtractInPlace(bounds.centerWorld);
    preview.computeWorldMatrix(true);
    this.previousCamera = this.scene.activeCamera!;
    this.previousCamera.detachControl();
    this.preview = preview;
    this.material = material;
    this.scene.activeCamera = this.camera;
    this.resize();
    return true;
  }

  /** Reserve space above and below the centred object for its title and Return button. */
  resize() {
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const aspect = Math.max(0.1, width / Math.max(height, 1));
    const halfHeight = Math.max(this.size.y / 0.62, this.size.x / (aspect * 0.82), 0.1) / 2;
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.camera.orthoLeft = -halfHeight * aspect;
    this.camera.orthoRight = halfHeight * aspect;
    return this.size.y / (2 * halfHeight) * height / 2;
  }

  close() {
    if (!this.preview) return false;
    this.scene.activeCamera = this.previousCamera!;
    this.previousCamera = undefined;
    this.preview.dispose(false, false);
    this.material!.dispose(false, false); // The original item's shared texture remains alive.
    this.preview = undefined;
    this.material = undefined;
    return true;
  }

  dispose() {
    this.close();
    this.camera.dispose();
  }
}
