import {
  Engine,
  FreeCamera,
  UniversalCamera,
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
import "@babylonjs/loaders";

export class BigRoomScene {
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
    const canvas = this.canvas;
    const scene = new Scene(this.engine);

    const camera = new UniversalCamera('camera', new Vector3(0, 3, -10), this.scene);
    camera.attachControl(this.canvas, true);
    camera.speed = 0.8;

    const ground = this.createGround(scene)

    const light = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    return scene;
  }

  private createGround(scene: Scene): Mesh {
    const ground = MeshBuilder.CreateTiledPlane('ground', {
      size: 50,
      tileSize: 6,
      pattern: Mesh.FLIP_TILE,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -5;
  
    // Creating a standard material for the ground
    const groundMaterial = new StandardMaterial("groundMaterial", scene);
  
    // Textures array
    const textureFiles = [
      "./textures/stone/stone_diffuse.jpg",
      "./textures/stone/stone_normal.jpg",
      "./textures/stone/stone_ao.jpg",
      "./textures/stone/stone_spec.jpg"
    ];
  
    // Applying textures
    const [diffuse, bump, ambient, specular] = textureFiles.map((file) => {
      const texture = new Texture(file, scene);
      texture.uScale = 0.5;
      texture.vScale = 0.5;
      return texture;
    });
  
    groundMaterial.diffuseTexture = diffuse;
    groundMaterial.bumpTexture = bump;
    groundMaterial.ambientTexture = ambient;
    groundMaterial.specularTexture = specular;
  
    // Applying the material to the ground
    ground.material = groundMaterial;
  
    return ground;
  }



}


