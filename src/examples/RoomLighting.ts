import {
  AbstractMesh, Color3, HemisphericLight, RenderTargetTexture, Scene, ShadowGenerator, SpotLight, Vector3,
} from "@babylonjs/core";

/** Window daylight and local lamp pools, all positioned inside the room's visible light sources. */
export class RoomLighting {
  private readonly shadows: ShadowGenerator[];

  constructor(scene: Scene) {
    const fill = new HemisphericLight("room-bounce-light", new Vector3(-0.35, 1, 0.15), scene);
    fill.intensity = 0.45;
    fill.diffuse = new Color3(0.95, 0.97, 1);
    fill.groundColor = new Color3(0.68, 0.62, 0.53);
    fill.specular = Color3.Black();

    // Place daylight just in front of the garden window, rather than shining through opaque walls.
    const daylight = new SpotLight("window-daylight", new Vector3(-18.85, 5.6, 9),
      new Vector3(1, -0.35, -0.25).normalize(), Math.PI / 1.25, 1, scene);
    daylight.innerAngle = Math.PI / 2;
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 1.65;
    daylight.range = 65;

    // Emit below the shades so the closed shade meshes cannot occlude their own bulbs.
    const reading = new SpotLight("reading-lamp-light", new Vector3(16, 1.48, 5),
      new Vector3(-0.55, -1, 0.5).normalize(), Math.PI / 1.65, 1.5, scene);
    reading.innerAngle = Math.PI / 2.4;
    reading.diffuse = new Color3(1, 0.85, 0.64);
    reading.intensity = 1.05;
    reading.range = 18;

    const desk = new SpotLight("banker-lamp-light", new Vector3(-0.55, 0.85, -2.65),
      new Vector3(-0.65, -1, 0.4).normalize(), Math.PI / 1.7, 1.5, scene);
    desk.innerAngle = Math.PI / 2.5;
    desk.diffuse = new Color3(1, 0.88, 0.68);
    desk.intensity = 1.25;
    desk.range = 10;

    this.shadows = [daylight, reading, desk].map((light, index) => {
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      light.specular = light.diffuse.scale(0.65);
      // Explicit light depth bounds keep cached maps independent of the active camera.
      light.shadowMinZ = 0.2;
      light.shadowMaxZ = light.range;
      const size = index === 0 ? Math.min(4096, scene.getEngine().getCaps().maxTextureSize) : 1024;
      const shadow = new ShadowGenerator(size, light);
      if (index === 0) {
        shadow.useContactHardeningShadow = true;
        shadow.contactHardeningLightSizeUVRatio = 0.06;
      } else {
        shadow.usePercentageCloserFiltering = true;
      }
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = 0.00015;
      shadow.normalBias = 0.008;
      shadow.setDarkness(0);
      return shadow;
    });
  }

  addMeshes(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => {
      if (mesh.getTotalVertices() === 0) return;
      mesh.receiveShadows = true;
      if (mesh.metadata?.castsShadows === false) return;
      this.shadows.forEach(shadow => shadow.addShadowCaster(mesh, false));
    });
    this.refreshShadows();
  }

  freezeShadows() {
    this.shadows.forEach(shadow => {
      shadow.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    });
    this.refreshShadows();
  }

  refreshShadows() {
    this.shadows.forEach(shadow => shadow.getShadowMap()!.resetRefreshCounter());
  }
}
