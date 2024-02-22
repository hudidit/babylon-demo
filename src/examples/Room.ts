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

const CONFIG = {
  wall: {
    height: 10,
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
    const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    camera.attachControl();
    camera.speed = 0.5;
    // const camera = new ArcRotateCamera("Camera", 0, 1, 60, Vector3.Zero(), scene);
    // camera.lowerBetaLimit = 0.1;
    // camera.upperBetaLimit = (Math.PI / 2) * 0.9;
    // camera.lowerRadiusLimit = 15;
    // camera.upperRadiusLimit = 150;
    camera.attachControl();

    const wallHeight = CONFIG.wall.height;

    // Create the walls of the room
    const wall1 = this.createWall('wall1', {
      width: 0.5,
      height: wallHeight,
      depth: 40,
      position: { x: -20 }
    }, scene);
    // const wall2 = this.createWall('wall2', {
    //   width: 0.5,
    //   height: wallHeight,
    //   depth: 40,
    //   position: { x: 20 },
    // }, scene);
    const wall3 = this.createWall('wall3', {
      width: 40,
      height: wallHeight,
      depth: 0.5,
      position: { z: -20 },
    }, scene);
    // const wall4 = this.createWall('wall4', {
    //   width: 40,
    //   height: wallHeight,
    //   depth: 0.5,
    //   position: { z: 20 },
    // }, scene);

    /**
     * 使用 CSG subtract 在墙上挖一个门
     * TODO: 现在是写死的尺寸、位置，只能在特定的位置挖洞。把画墙、挖洞的逻辑封装到一起，可以在画墙的时候指定是否挖洞。
     */
    const door = MeshBuilder.CreateBox("door", { width: 6, height: 9, depth: 0.8 }, scene);
    door.position = new Vector3(0, -2, -20);

    const wallCSG = CSG.FromMesh(wall3);
    const doorCSG = CSG.FromMesh(door);
    const wallWithDoorCSG = wallCSG.subtract(doorCSG);
    const wallWithDoor = wallWithDoorCSG.toMesh('wallWithDoor', null, scene);
    // TODO: 通过 CSG 合并后再转回 Mesh 需要重新设置 material，可以尝试封装
    wallWithDoor.material = this.mat.get('brickMat');
    wallWithDoor.receiveShadows = true;

    // 销毁用来挖门的形状
    door.dispose();
    // 销毁原来的墙
    wall3.dispose();
    // 添加新的墙
    scene.addMesh(wallWithDoor);

    const ground = this.createGround(scene);
    const tableMesh = this.createTable(scene);
    const chairs = this.createChairs(scene);
    this.createPicture(scene);
    // this.createTree(scene);
    // const bookshelf = this.createBookshelf(scene);
    const cabinet = this.createCabinet(scene);
    const plant1 = this.createPlant1(scene);


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

    // const spotLight1 = this.createSpotLight('spotLight1', {
    //   position: new Vector3(20, 4, 0),
    //   direction: new Vector3(-0.5, -1, 0),
    // }, scene);
    // const shadowGenerator = new ShadowGenerator(4096, spotLight1);
    // // 照射物体的形状也会影响 FPS。根据目前的观察，物体的“高宽”比越大，FPS 越低。
    // shadowGenerator.addShadowCaster(brick, true);

    // const spotLight2 = this.createSpotLight('spotLight2', {
    //   position: new Vector3(0, 4, -20),
    //   direction: new Vector3(0, -1, 1),
    // }, scene);
    // const shadowGenerator2 = new ShadowGenerator(4096, spotLight2);
    // // 照射物体的形状也会影响 FPS。根据目前的观察，物体的“高宽”比越大，FPS 越低。
    // shadowGenerator2.addShadowCaster(brick, true);

    // const spotLight3 = this.createSpotLight('spotLight3', {
    //   position: new Vector3(10, 20, 15),
    //   direction: new Vector3(0, -1, 0),
    //   intensity: 6,
    //   angle: Math.PI * 0.8,
    // }, scene);
    // const shadowGenerator3 = new ShadowGenerator(4096, spotLight3);
    // // shadowGenerator3.addShadowCaster(tableMesh, true);
    // shadowGenerator3.getShadowMap().renderList.push(tableMesh, ...chairs);
    // // shadowGenerator3.addShadowCaster(brick, true);

    // const diretionalLight2 = new DirectionalLight('directionalLight2', new Vector3(10, -20, 15).normalize(), scene);
    // diretionalLight2.position = new Vector3(0, 20, 0);
    // diretionalLight2.intensity = 0.5;

    const flashlight = new SpotLight("flashlight", new Vector3(0, 10, 0), new Vector3(0, -1, 0), Math.PI / 6, 5, scene);
    flashlight.diffuse = new Color3(1, 1, 1);
    flashlight.specular = new Color3(1, 1, 1);
    flashlight.intensity = 8;
    flashlight.range = 60;
    flashlight.angle = Math.PI / 3 * 2; // Adjust the angle for a wider spread
    flashlight.exponent = 50;
    flashlight.intensityMode = SpotLight.INTENSITYMODE_LUMINOUSINTENSITY

    scene.registerBeforeRender(() => {
      // flashlight.position = camera.position;
      flashlight.position = new Vector3(
        camera.position.x,
        camera.position.y - 1,
        camera.position.z,
      );
      flashlight.direction = camera.getForwardRay().direction;
    });

    const shadowGenerator4 = new ShadowGenerator(4096, flashlight);
    // shadowGenerator3.addShadowCaster(tableMesh, true);
    shadowGenerator4.getShadowMap().renderList.push(tableMesh, ...chairs);

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

    // 展示坐标轴
    // new AxesViewer(scene, 20);

    // this.initPickInteraction({
    //   scene,
    //   ground,
    //   camera
    // });

    return scene;
  }

  /**
   * 拖拽移动物体
   */
  private initPickInteraction({
    scene,
    ground,
    camera,
  }: {
    scene: Scene;
    ground: Mesh;
    camera: Camera;
  }) {
    let startPoint;
    let currentMesh: Mesh;

    const getGroundPosition = () => {
      const pickInfo = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === ground);
      if (pickInfo.hit) {
        return pickInfo.pickedPoint;
      }
      return null;
    };

    const pointerDown = (mesh) => {
      currentMesh = mesh;
      startPoint = getGroundPosition();
      if (startPoint) {
        setTimeout(() => {
          camera.detachControl();
        }, 0);
      }
    };

    const pointerUp = () => {
      if (startPoint) {
        camera.attachControl();
        startPoint = null;
      }
    };

    const pointerMove = () => {
      if (!startPoint) {
        return;
      }
      const current = getGroundPosition();
      if (!current) {
        return;
      }
      const diff = current.subtract(startPoint);
      currentMesh.position.addInPlace(diff);
      startPoint = current;
    };

    scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERMOVE: {
          pointerMove();
          break;
        }
        case PointerEventTypes.POINTERDOWN: {
          if (pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh !== ground) {
            pointerDown(pointerInfo.pickInfo.pickedMesh);
          }
          break;
        }
        case PointerEventTypes.POINTERUP: {
          pointerUp();
          break;
        }
      }
    });
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

    const woodMat = this.createWoodMaterial(scene);
    this.mat.set('woodMat', woodMat);

    const metalMat = this.createMetalMaterial(scene);
    this.mat.set('metalMat', metalMat);

    const brickMat = this.createBrickMaterial(scene);
    this.mat.set('brickMat', brickMat);
  }

  createStoneMaterial(scene: Scene): StandardMaterial {
    const stoneMat = new StandardMaterial('stoneMat', scene);
    const uvScale = .5;
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

    // 颜色调暗
    stoneMat.diffuseColor = new Color3(.5, .5, .5);
    // 降低反光
    stoneMat.specularColor = new Color3(.1, .1, .1);

    return stoneMat;
  }

  createWoodMaterial(scene: Scene): StandardMaterial {
    const woodMat = new StandardMaterial('woodMat', scene);
    const uvScale = 1;
    const texArray: Texture[] = [];

    const diffuseTex = new Texture('./textures/woodFloor/wood_floor_diff.jpg', scene);
    woodMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/woodFloor/wood_floor_normal.jpg', scene);
    woodMat.bumpTexture = normalTex;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/woodFloor/wood_floor_ao.jpg', scene);
    woodMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    // 颜色调暗
    woodMat.diffuseColor = new Color3(.5, .5, .5);
    // 降低反光
    woodMat.specularColor = new Color3(.1, .1, .1);

    return woodMat;
  }

  private createMetalMaterial(scene: Scene): StandardMaterial {
    const metalMat = new StandardMaterial('metalMat', scene);
    const uvScale = 1;
    const texArray: Texture[] = [];

    const diffuseTex = new Texture('./textures/metal/metal_diffuse.jpg', scene);
    metalMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/metal/metal_normal.jpg', scene);
    metalMat.bumpTexture = normalTex;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/metal/metal_ao.jpg', scene);
    metalMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    const specTex = new Texture('./texture/metal/metal_spec.jpg', scene);
    metalMat.specularTexture = specTex;
    texArray.push(specTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    metalMat.specularColor = new Color3(.1, .1, .1);

    return metalMat;
  }

  private createBrickMaterial(scene: Scene): StandardMaterial {
    const brickMat = new StandardMaterial('brickMat', scene);
    const uvScale = .3;
    const texArray: Texture[] = [];

    const diffuseTex = new Texture('./textures/brick1/brick_diff.jpg', scene);
    brickMat.diffuseTexture = diffuseTex;
    texArray.push(diffuseTex);

    const normalTex = new Texture('./textures/brick1/brick_normal.jpg', scene);
    brickMat.bumpTexture = normalTex;
    texArray.push(normalTex);

    const aoTex = new Texture('./textures/brick1/brick_ao.jpg', scene);
    brickMat.ambientTexture = aoTex;
    texArray.push(aoTex);

    texArray.forEach((tex) => {
      tex.uScale = uvScale;
      tex.vScale = uvScale;
    });

    brickMat.specularColor = new Color3(.1, .1, .1);

    // 颜色调暗
    brickMat.diffuseColor = new Color3(.8, .8, .8);
    // 降低反光
    brickMat.specularColor = new Color3(.1, .1, .1);

    return brickMat;
  }

  private createSpotLight(name: string, {
    position,
    direction,
    angle = Math.PI * 1.6,
    exponent = 3,
    intensity = 3,
  }: {
    position: Vector3;
    direction: Vector3;
    angle?: number;
    exponent?: number;
    intensity?: number;
  }, scene: Scene) {
    const spotLight = new SpotLight(name, position, direction, angle, exponent, scene);
    spotLight.intensity = intensity;
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
      // tileWidth: 6,
      // tileHeight: 2,
      // texture 为正方形时，直接使用 tileSize
      tileSize: 6,
      pattern: Mesh.FLIP_TILE,
      sideOrientation: Mesh.DOUBLESIDE,
    }, scene);
    ground.rotation.x = Math.PI / 2;

    // Set the position of the ground
    ground.position.y = -5;

    // Set the material of the ground
    ground.receiveShadows = true;
    // ground.material = this.mat.get('groundMat');
    // ground.material = this.mat.get('woodMat');
    ground.material = this.mat.get('stoneMat');

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
    // wall.material = this.mat.get('wallMat');
    wall.material = this.mat.get('brickMat');
    Object.entries(position).map(([key, value]) => {
      if (key && typeof value === 'number' && !isNaN(value)) {
        wall.position[key] = value;
      }
    });
    // 接收阴影
    wall.receiveShadows = true;
    return wall;
  }

  private createTable(scene: Scene) {
    const a = 3;
    const b = 2;
    const legWidth = 0.5;
    const legHeight = 4;

    const tableTop = MeshBuilder.CreateBox("table", { width: 7, height: legWidth, depth: 7 }, scene);

    // To create legs for the table, you can use the MeshBuilder class and specify their dimensions, position, and other properties. For example:
    const leg1 = MeshBuilder.CreateBox("leg1", { width: legWidth, height: legHeight, depth: legWidth }, scene);
    leg1.position = new Vector3(-a, -b, -a);

    const leg2 = MeshBuilder.CreateBox("leg2", { width: legWidth, height: legHeight, depth: legWidth }, scene);
    leg2.position = new Vector3(a, -b, -a);

    const leg3 = MeshBuilder.CreateBox("leg3", { width: legWidth, height: legHeight, depth: legWidth }, scene);
    leg3.position = new Vector3(-a, -b, a);

    const leg4 = MeshBuilder.CreateBox("leg4", { width: legWidth, height: legHeight, depth: legWidth }, scene);
    leg4.position = new Vector3(a, -b, a);

    // To combine the table top and legs into a single mesh, you can use the Mesh.MergeMeshes method again. For example:
    const tableMesh = Mesh.MergeMeshes([tableTop, leg1, leg2, leg3, leg4], true, false, null, false, true);
    tableMesh.position = new Vector3(0, -1, 0);

    // tableMesh.material = this.mat.get('stoneMat');
    tableMesh.material = this.mat.get('woodMat');

    return tableMesh;
  }

  private createChairs(scene: Scene) {
    const chair = MeshBuilder.CreateCylinder("chair", { diameter: 2, height: 3 });
    // chair.material = this.mat.get('metalMat');
    chair.material = this.mat.get('woodMat').clone('chairMat');
    chair.position = new Vector3(0, -4, 6);
    chair.receiveShadows = true;
    const chair2 = chair.clone('chair2');
    chair2.position = new Vector3(0, -4, -6);
    const chair3 = chair.clone('chair3');
    chair3.position = new Vector3(6, -4, 0);
    const chair4 = chair.clone('chair4');
    chair4.position = new Vector3(-6, -4, 0);

    scene.addMesh(chair);
    scene.addMesh(chair2);
    scene.addMesh(chair3);
    scene.addMesh(chair4);

    return [chair, chair2, chair3, chair4];
  }

  private createPicture(scene: Scene) {
    // Create a texture with the image you want to display
    // const pictureTexture = new Texture("./textures/pictures/picture_800.jpg", scene);
    // const pictureTexture = new Texture("./textures/pictures/pic2_1200.jpg", scene);
    const pictureTexture = new Texture("./textures/pictures/pic1.jpg", scene);

    // Create a material and assign the texture to it
    const pictureMaterial = new StandardMaterial("pictureMaterial", scene);
    pictureMaterial.diffuseTexture = pictureTexture;

    // Create a mesh for the picture and set its position and dimensions to fit inside the frame
    const picture = MeshBuilder.CreatePlane("picture", { width: 8, height: 4.5, sideOrientation: Mesh.DOUBLESIDE }, scene);

    // Apply the material to the picture mesh
    picture.material = pictureMaterial;
    picture.rotation.y = Math.PI / 2;
    // put it on wall1
    picture.position = new Vector3(-19.7, 0.3, 0);

    // Add the picture mesh to the scene
    scene.addMesh(picture);
  }

  private async createTree(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'tree.glb', scene);
    const tree = meshes[0];
    tree.position = new Vector3(15, -5, 12);
    tree.scaling = new Vector3(0.8, 0.8, 0.8);
    return tree;
  }

  // private async createBookshelf(scene: Scene) {
  //   const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'wooden_bookshelf.glb', scene);
  //   const bookshelf = meshes[0];
  //   bookshelf.position = new Vector3(-16, -5, -19);
  //   bookshelf.scaling = new Vector3(3, 3, 3);
  //   const material = meshes[1].material;
  //   (material as PBRMaterial).directIntensity = 0.5;

  //   return bookshelf;
  // }

  private async createCabinet(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'gothic_commode.glb', scene);
    const cabinet = meshes[0];
    cabinet.position = new Vector3(-16, -5, -18);
    cabinet.scaling = new Vector3(3, 3, 3);
    cabinet.receiveShadows = true;
    const material = meshes[1].material;
    (material as PBRMaterial).directIntensity = 1;
    meshes[2].receiveShadows = true;
    meshes.forEach(mesh => {
      // FIXME: 没有用，import 进来的 mesh 上始终不展示阴影
      mesh.receiveShadows = true;
    })
    return cabinet;
  }

  private async createPlant1(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync('', './models/', 'plant_celandines.glb', scene);
    const plant = meshes[0];
    plant.scaling = new Vector3(10, 10, 10);
    plant.position = new Vector3(10, -5, 10);
    return plant;
  }

}