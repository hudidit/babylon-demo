import { Color3, CubeTexture, Engine, FreeCamera, GlowLayer, HemisphericLight, MeshBuilder, PBRMaterial, Scene, Texture, Vector3 } from "@babylonjs/core";

export class PBR {

  scene: Scene;
  engine: Engine;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true);
    this.scene = this.createScene();

    this.createEnvironment();

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  createScene() {
    const scene = new Scene(this.engine);
    const camera = new FreeCamera('camera', new Vector3(0, 1, -5), this.scene);
    camera.attachControl();
    camera.speed = 0.25;
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0;

    const envTex = CubeTexture.CreateFromPrefilteredData('./environment/sky.env', scene);
    scene.environmentTexture = envTex;
    scene.createDefaultSkybox(envTex, true);
    // scene.createDefaultEnvironment();
    // scene.environmentIntensity = 0.25;

    return scene;
  }

  createEnvironment() {
    const ground = MeshBuilder.CreateGround(
      'ground', 
      {
        width: 10,
        height: 10,
      }, 
      this.scene
    );
    ground.material = this.createAsphalt();

    const ball = MeshBuilder.CreateSphere(
      'ball', 
      { diameter: 1 }, 
      this.scene
    );
    ball.position = new Vector3(0, 1, 0);
    ball.material = this.createMagic();
  }

  createAsphalt(): PBRMaterial {
    const pbr = new PBRMaterial('pbr', this.scene);
    pbr.roughness = 1;
    
    pbr.albedoTexture = new Texture('./textures/asphalt/asphalt_diffuse.jpg', this.scene);

    pbr.bumpTexture = new Texture('./textures/asphalt/asphalt_normal.jpg', this.scene);

    pbr.useAmbientOcclusionFromMetallicTextureRed = true;
    pbr.useRoughnessFromMetallicTextureGreen = true;
    pbr.useMetallnessFromMetallicTextureBlue = true;
    pbr.metallicTexture = new Texture('./textures/asphalt/asphalt_ao_rough_metal.jpg', this.scene);

    pbr.invertNormalMapX = true;
    pbr.invertNormalMapY = true;
    return pbr;
  }

  createMagic(): PBRMaterial {
    const pbr = new PBRMaterial('pbr', this.scene);
    pbr.roughness = 0.3;
    pbr.environmentIntensity = 1;
    const uvScale = 3;
    const texArray: Texture[] = [];
    
    const albedoTexture = new Texture('./textures/MetalPipeWallRusty/MetalPipeWallRusty_basecolor.png', this.scene); 
    pbr.albedoTexture = albedoTexture;
    texArray.push(albedoTexture);

    const bumpTexture = new Texture('./textures/MetalPipeWallRusty/MetalPipeWallRusty_normal.png', this.scene);
    pbr.bumpTexture = bumpTexture;
    texArray.push(bumpTexture);

    // pbr.useAmbientOcclusionFromMetallicTextureRed = true;
    // pbr.useRoughnessFromMetallicTextureGreen = true;
    // pbr.useMetallnessFromMetallicTextureBlue = true;
    // pbr.metallicTexture = new Texture('./textures/MetalPipeWallRusty/MetalPipeWallRusty_ambientocclusion.png', this.scene);

    // pbr.emissiveColor = new Color3(1, 1, 1);
    // 这个 emissive.png 是一张纯黑图片，没有发光效果。素材有问题，需要使用能发光的素材。
    // pbr.emissiveTexture = new Texture('./textures/MetalPipeWallRusty/MetalPipeWallRusty_emissive.png', this.scene);
    // pbr.emissiveIntensity = 3;

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    // 没有 emissiveTexture 时，glowLayer 没有效果
    // const glowLayer = new GlowLayer('glow', this.scene);
    // glowLayer.intensity = 1;
    
    pbr.invertNormalMapX = true;
    pbr.invertNormalMapY = true;
    return pbr;
  }
}