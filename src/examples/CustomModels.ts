import { CubeTexture, Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, SceneLoader, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import '@babylonjs/loaders';

export class CustomModels {

  scene: Scene;
  engine: Engine;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true);
    this.scene = this.createScene();
    this.createBarrel();

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
    hemiLight.intensity = 0.5;

    const envTex = CubeTexture.CreateFromPrefilteredData('./environment/sky.env', scene);
    scene.environmentTexture = envTex;
    scene.createDefaultSkybox(envTex, true);

    const ground = MeshBuilder.CreateGround(
      'ground', 
      {
        width: 10,
        height: 10,
      }, 
      this.scene
    );

    const ball = MeshBuilder.CreateSphere(
      'ball', 
      { diameter: 1 }, 
      this.scene
    );
    ball.position = new Vector3(0, 1, 0);

    return scene;
  }

  createGroundMaterial(): StandardMaterial {
    const groundMat = new StandardMaterial('groundMat', this.scene);
    const uvScale = 4;
    const texArray: Texture[] = [];
    
    const diffuseTex = new Texture('./textures/stone/stone_diffuse.jpg', this.scene);
    groundMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/stone/stone_normal.jpg', this.scene);
    groundMat.bumpTexture = normalTex;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/stone/stone_ao.jpg', this.scene);
    groundMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    const specTex = new Texture('./textures/stone/stone_spec.jpg', this.scene);
    groundMat.specularTexture = specTex;
    texArray.push(specTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    return groundMat;
  }

  createBallMaterial() {
    const ballMat = new StandardMaterial('ballMat', this.scene);
    const uvScale = 1;
    const texArray: Texture[] = [];

    const diffuseTex = new Texture('./textures/metal/metal_diffuse.jpg', this.scene);
    ballMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/metal/metal_normal.jpg', this.scene);
    ballMat.bumpTexture = normalTex;
    // invert 作用是让纹理上的凹陷部分变成凸起
    ballMat.invertNormalMapX = true;
    ballMat.invertNormalMapY = true;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/metal/metal_ao.jpg', this.scene);
    ballMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    const specTex = new Texture('./textures/metal/metal_spec.jpg', this.scene);
    ballMat.specularTexture = specTex;
    ballMat.specularPower = 5;
    texArray.push(specTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    return ballMat;
  }

  createBarrel() {
    SceneLoader.ImportMesh('', './models/', 'barrel.glb', this.scene, (meshes) => {
      console.log('meshes:', meshes);
    });
  }
}