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
  Mesh
} from "@babylonjs/core";


export class RoomScene {

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

  createScene() {
    const scene = new Scene(this.engine);
    this.createMaterials(scene);

    /**
     * Cameras
     */
    // const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    // camera.attachControl();
    // camera.speed = 0.25;
    const camera = new ArcRotateCamera("Camera", 0, 1, 60, Vector3.Zero(), scene);
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = (Math.PI / 2) * 0.9;
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 150;
    camera.attachControl();

    // Create the walls of the room
    const wall1 = this.createWall('wall1', {
      width: 0.5,
      height: 10,
      depth: 40,
      position: { x: -20 }
    }, scene);
    const wall2 = this.createWall('wall2', {
      width: 0.5,
      height: 10,
      depth: 40,
      position: { x: 20 },
    }, scene);
    const wall3 = this.createWall('wall3', {
      width: 40,
      height: 10,
      depth: 0.5,
      position: { z: -20 },
    }, scene);
    const wall4 = this.createWall('wall4', {
      width: 40,
      height: 10,
      depth: 0.5,
      position: { z: 20 },
    }, scene);

    // Create the ground of the room
    const ground = MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, scene);

    // Set the position of the ground
    ground.position.y = -5;

    // Set the material of the ground
    ground.receiveShadows = true;
    ground.material = this.mat.get('groundMat');

    const brick = this.createBrick();


    // Create lights
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), scene);
    hemiLight.intensity = 0.3;
    const diretionalLight = new DirectionalLight('directionalLight', new Vector3(-10, -20, -15).normalize(), scene);
    diretionalLight.position = new Vector3(0, 20, 0);
    diretionalLight.intensity = 0.7;
    const lightToShadow = diretionalLight;
    // const pointLight = new PointLight("pointLight", new Vector3(0, 5, 0), scene);
    // pointLight.intensity = 0.7;
    // const lightToShadow = pointLight;
    const lightSphere = MeshBuilder.CreateSphere('lightSphere', {
      segments: 10,
      diameter: 2,
    }, scene);
    lightSphere.position = lightToShadow.position;
    lightSphere.material = new StandardMaterial("light", scene);
    (lightSphere.material as StandardMaterial).emissiveColor = new Color3(1, 1, 0);

    /**
     * ShadowGenerator 的第一个参数 mapSize 值越大，阴影边界越清晰；值越小，阴影颗粒感越强。
     * 可以尝试设置成 50, 100, 200, 1024, 4096，就能够看出区别。
     */
    const shadowGenerator = new ShadowGenerator(4096, lightToShadow);
    shadowGenerator.addShadowCaster(brick, true);

    return scene;
  }
  
  private createMaterials(scene: Scene) {
    const wallMat = new StandardMaterial('wallBricks', scene);
    const wallTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    // wallTexture.uScale = 10;
    // wallTexture.vScale = 10;
    wallMat.diffuseTexture = wallTexture;
    this.mat.set('wallMat', wallMat);

    const groundMat = new StandardMaterial('groundBricks', scene);
    const groundTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    groundTexture.uScale = 4;
    groundTexture.vScale = 12;
    groundMat.diffuseTexture = groundTexture;
    this.mat.set('groundMat', groundMat);
  }

  private createWall(name: string, { width, height, depth, position }: {
    width: number;
    height: number;
    depth: number;
    position: {
      x?: number;
      y?: number;
      z?: number;
    }
  }, scene: Scene) {
    const pat = Mesh.FLIP_TILE;
    // const pat = Mesh.ROTATE_TILE;
    // const pat = Mesh.FLIP_N_ROTATE_TILE;
    const av = Mesh.TOP;
    const ah = Mesh.LEFT;

    const commonWallConfig = {
      pattern: pat,
      sideOrientation: Mesh.DOUBLESIDE,
      alignVertical: av,
      alignHorizontal: ah,
      // tileSize: 3,
      tileWidth: 3,
      tileHeight: 1,
    };

    const wall = MeshBuilder.CreateTiledBox(name, {
      ...commonWallConfig,
      width,
      height,
      depth,
    }, scene);
    wall.material = this.mat.get('wallMat');
    Object.entries(position).map(([key, value]) => {
      if (key && typeof value === 'number' && !isNaN(value)) {
        wall.position[key] = value;
      }
    });
    return wall;
  }

  private createBrick() {
    const pat = Mesh.FLIP_TILE;
    // const pat = Mesh.ROTATE_TILE;
    // const pat = Mesh.FLIP_N_ROTATE_TILE;
    const av = Mesh.TOP;
    const ah = Mesh.LEFT;
    const brickBox = MeshBuilder.CreateTiledBox("brickBox", {
      sideOrientation: Mesh.DOUBLESIDE,
      pattern: pat,
      alignVertical: av,
      alignHorizontal: ah,
      width: 6,
      height: 3,
      depth: 1,
      tileSize: 1,
      tileWidth: 3
    });
    brickBox.material = this.mat.get('wallMat');
    brickBox.position.x = -5;
    brickBox.position.y = -3.5;
    brickBox.position.z = 3;
    brickBox.receiveShadows = true;
    return brickBox;
  }
}