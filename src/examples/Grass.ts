import {
  Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  Vector3,
  PointLight,
  DirectionalLight,
  SpotLight,
  Color3,
  ArcRotateCamera,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Mesh,
  AxesViewer,
  CSG,
  SceneLoader,
  PBRMaterial,
  PointerEventTypes,
  Camera,
} from "@babylonjs/core";
import '@babylonjs/loaders';

export class GrassScene {

  scene: Scene;
  engine: Engine;
  mat: Map<string, StandardMaterial> = new Map();

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true);
    this.scene = this.createScene();

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  private createScene() {
    const scene = new Scene(this.engine);

    /**
     * Cameras
     */
    // const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    // camera.attachControl();
    // camera.speed = 0.25;
    const camera = new ArcRotateCamera("Camera", 0, 1, 60, Vector3.Zero(), scene);
    camera.lowerBetaLimit = 0.1;
    // camera.upperBetaLimit = (Math.PI / 2) * 0.9;
    // camera.lowerRadiusLimit = 15;
    // camera.upperRadiusLimit = 150;
    camera.attachControl();

    /**
     * Lights
     */
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), scene);
    hemiLight.intensity = 0.3;

    const diretionalLight = new DirectionalLight('directionalLight', new Vector3(-10, -20, -15).normalize(), scene);
    diretionalLight.position = new Vector3(0, 20, 0);
    diretionalLight.intensity = 0.7;
    const lightToShadow = diretionalLight;
    const shadowGenerator = new ShadowGenerator(4096, lightToShadow);

    /**
     * Meshes
     */
    const ground = this.createGround(scene);
    shadowGenerator.getShadowMap().renderList.push(ground);

    (async () => {
      const plantClones = await this.createPlant(scene);
      plantClones.forEach(plant => {
        // shadowGenerator.getShadowMap().renderList.push(plant);
        shadowGenerator.addShadowCaster(plant);
        plant.receiveShadows = true;
        console.log('== clones', plant, plant.getChildMeshes())
      });

      const tree = await this.createTree(scene);
      shadowGenerator.addShadowCaster(tree);
    })();
    

    /**
     * 展示坐标轴
     */
    new AxesViewer(scene, 20);

    return scene;
  }

  private createGround(scene: Scene) {
    // Create the ground of the room
    // const ground = MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, scene);
    // CreateTiledPlane 可以翻转 tile, CreateTiledGround 不行
    const ground = MeshBuilder.CreateTiledPlane('ground', {
      size: 40,
      // tileWidth: 6,
      // tileHeight: 2,
      // texture 为正方形时，直接使用 tileSize
      tileSize: 10,
      pattern: Mesh.FLIP_TILE,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    ground.rotation.x = Math.PI / 2;

    // Set the position of the ground
    // ground.position.y = -5;

    // Set the material of the ground
    ground.receiveShadows = true;

    const groundMat = new StandardMaterial('groundMaterial', scene);
    const uvScale = 1;
    const texArray: Texture[] = [];
    const diffuseTex = new Texture('./textures/leafy_grass/leafy_grass_diff.jpg', scene);
    groundMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);
    const normalTex = new Texture('./textures/leafy_grass/leafy_grass_nor.jpg', scene);
    groundMat.bumpTexture = normalTex;
    texArray.push(normalTex);
    const aoTex = new Texture('./textures/leafy_grass/leafy_grass_ao.jpg', scene);
    groundMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    ground.material = groundMat;

    groundMat.specularColor = new Color3(0.1, 0.1, 0.1);

    return ground;
  }

  private async createPlant(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'plant_celandines.glb', scene);
    console.log('== plant meshes:', meshes);
    console.log('== child meshes:', meshes[0].getChildMeshes());
    const plant = meshes[0].getChildMeshes()[0] as Mesh;
    // const plant = meshes[0] as Mesh;
    plant.scaling = new Vector3(5, 5, 5);
    // plant.scaling = new Vector3(50, 50, 50);
    // plant.position = new Vector3(10, 0, 10);
    const plantClones: Mesh[] = [];
    for (let i = -15; i < 20; i+=5) {
      for (let j = -15; j < 20; j+=5) {
        const plantClone = plant.clone(`plant_${i}_${j}`);
        plantClone.position = new Vector3(i, 0, j);
        plantClones.push(plantClone);
      }
    }
    // plant.dispose();
    plantClones.push(plant);
    return plantClones;
  }

  private async createTree(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'tree.glb', scene);
    console.log('== tree meshes:', meshes);
    console.log('== child meshes:', meshes[0].getChildMeshes());
    const tree = meshes[0] as Mesh;
    tree.receiveShadows = true;
    return tree;
  }

}