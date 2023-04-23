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
} from "@babylonjs/core";

const CONFIG = {
  wall: {
    height: 15,
  }
};

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

    const wallHeight = CONFIG.wall.height;

    // Create the walls of the room
    const wall1 = this.createWall('wall1', {
      width: 0.5,
      height: wallHeight,
      depth: 40,
      position: { x: -20 }
    }, scene);
    const wall2 = this.createWall('wall2', {
      width: 0.5,
      height: wallHeight,
      depth: 40,
      position: { x: 20 },
    }, scene);
    const wall3 = this.createWall('wall3', {
      width: 40,
      height: wallHeight,
      depth: 0.5,
      position: { z: -20 },
    }, scene);
    const wall4 = this.createWall('wall4', {
      width: 40,
      height: wallHeight,
      depth: 0.5,
      position: { z: 20 },
    }, scene);

    const ground = this.createGround(scene);
    const brick = this.createBrick();

    /**
     * 经验：
     * 1. 阴影会显著影响 FPS。同样只有一个光源（比如一个 SpotLight），在不开阴影时，可以达到很高的 FPS（100 以上）；
     *    在开启阴影时，FPS 只能达到 40~50。
     * 2. 光源数量越少，FPS 越高。例如在只有 HemisphericLight，没有其他光源时，可以达到最高 FPS（在我的设备上是 165）。
     * 3. 在不开阴影的情况下，有多个光源，也可以保持较高的 FPS（100 以上）。
     */

    // Create lights
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), scene);
    hemiLight.intensity = 0.3;
    // const diretionalLight = new DirectionalLight('directionalLight', new Vector3(-10, -20, -15).normalize(), scene);
    // diretionalLight.position = new Vector3(0, 20, 0);
    // diretionalLight.intensity = 0.7;
    // const lightToShadow = diretionalLight;
    // const pointLight = new PointLight("pointLight", new Vector3(0, 5, 0), scene);
    // pointLight.intensity = 0.7;
    // const lightToShadow = pointLight;

    const spotLight1 = this.createSpotLight('spotLight1', {
      position: new Vector3(20, 4, 0),
      direction: new Vector3(-0.5, -1, 0),
    }, scene);
    const shadowGenerator = new ShadowGenerator(4096, spotLight1);
    // // 照射物体的形状也会影响 FPS。根据目前的观察，物体的“高宽”比越大，FPS 越低。
    shadowGenerator.addShadowCaster(brick, true);

    const spotLight2 = this.createSpotLight('spotLight2', {
      position: new Vector3(0, 4, -20),
      direction: new Vector3(0, -1, 1),
    }, scene);
    const shadowGenerator2 = new ShadowGenerator(4096, spotLight2);
    // // 照射物体的形状也会影响 FPS。根据目前的观察，物体的“高宽”比越大，FPS 越低。
    shadowGenerator2.addShadowCaster(brick, true);
    

    // const diretionalLight2 = new DirectionalLight('directionalLight2', new Vector3(10, -20, 15).normalize(), scene);
    // diretionalLight2.position = new Vector3(0, 20, 0);
    // diretionalLight2.intensity = 0.5;

    /**
     * ShadowGenerator 的第一个参数 mapSize 值越大，阴影边界越清晰；值越小，阴影颗粒感越强。
     * 可以尝试设置成 50, 100, 200, 1024, 4096，就能够看出区别。
     */
    // const shadowGenerator = new ShadowGenerator(4096, lightToShadow);
    // // // 照射物体的形状也会影响 FPS。根据目前的观察，物体的“高宽”比越大，FPS 越低。
    // shadowGenerator.addShadowCaster(brick, true);
    // 设置了这个之后，降到了 20FPS；不开是 40FPS。
    // shadowGenerator.useContactHardeningShadow = true;
    // shadowGenerator.setDarkness(0.2);
    return scene;
  }

  private createMaterials(scene: Scene) {
    const wallMat = new StandardMaterial('wallBricks', scene);
    const wallTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    wallMat.diffuseTexture = wallTexture;
    wallMat.specularColor = new Color3(.3, .3, .3);
    this.mat.set('wallMat', wallMat);

    const groundMat = new StandardMaterial('groundBricks', scene);
    const groundTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    
    groundMat.diffuseTexture = groundTexture;

    // 降低反光度
    // groundMat.specularColor = new Color3(.3, .3, .3);
    groundMat.specularColor = new Color3(.05, .05, .05);
    this.mat.set('groundMat', groundMat);

    const stoneMat = this.createStoneMaterial(scene);
    this.mat.set('stoneMat', stoneMat);
  }

  createStoneMaterial(scene: Scene): StandardMaterial {
    const stoneMat = new StandardMaterial('stoneMat', scene);
    const uvScale = 2;
    const texArray: Texture[] = [];
    
    const diffuseTex = new Texture('./textures/stone/stone_diffuse.jpg', scene);
    stoneMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/stone/stone_normal.jpg', scene);
    stoneMat.bumpTexture = normalTex;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/stone/stone_ao.jpg', scene);
    stoneMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    const specTex = new Texture('./textures/stone/stone_spec.jpg', scene);
    stoneMat.specularTexture = specTex;
    texArray.push(specTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    return stoneMat;
  }

  private createSpotLight(name: string, {
    position,
    direction,
    angle = Math.PI * 1.6,
    exponent = 3,
  }: {
    position: Vector3;
    direction: Vector3;
    angle?: number;
    exponent?: number;
  }, scene: Scene) {
    const spotLight = new SpotLight(name, position, direction, angle, exponent, scene);
    spotLight.intensity = 3;
    spotLight.diffuse = new Color3(1, 1, 1);
    spotLight.specular = new Color3(1, 1, 1);
    // spotLight.shadowMaxZ = 10;
    // spotLight.shadowMinZ = 0;
    const lightSphere = MeshBuilder.CreateSphere('lightSphere', {
      segments: 10,
      diameter: 2,
    }, scene);
    lightSphere.position = spotLight.position;
    lightSphere.material = new StandardMaterial("light", scene);
    (lightSphere.material as StandardMaterial).emissiveColor = new Color3(1, 1, 0.1);

    return spotLight;
  }

  private createGround(scene: Scene) {
    // Create the ground of the room
    // const ground = MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, scene);
    // CreateTiledPlane 可以翻转 tile, CreateTiledGround 不行
    const ground = MeshBuilder.CreateTiledPlane('ground', {
      size: 40,
      tileWidth: 6,
      tileHeight: 2,
      pattern: Mesh.FLIP_TILE,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    ground.rotation.x = Math.PI/ 2;

    // Set the position of the ground
    ground.position.y = -5;

    // Set the material of the ground
    ground.receiveShadows = true;
    ground.material = this.mat.get('groundMat');

    return ground;
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
      tileWidth: 6,
      tileHeight: 2,
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
    // 接收阴影
    wall.receiveShadows = true;
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
      width: 10,
      height: 1,
      depth: 10,
      tileSize: 1,
      tileWidth: 3,
    });
    // brickBox.material = this.mat.get('wallMat');
    brickBox.material = this.mat.get('stoneMat');
    brickBox.position.x = 0;
    brickBox.position.y = -2;
    brickBox.position.z = 3;
    brickBox.receiveShadows = true;
    return brickBox;
  }
}