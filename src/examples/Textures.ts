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

export class TexturesScene {

  scene: Scene;
  engine: Engine;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true);
    this.scene = this.createScene();

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  createScene() {
    const scene = new Scene(this.engine);
    /**
     * Cameras
     */
    // const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    // camera.attachControl();
    // camera.speed = 0.25;
    const camera = new ArcRotateCamera("Camera", 0, 1, 15, Vector3.Zero(), scene);
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = (Math.PI / 2) * 0.9;
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 150;
    camera.attachControl();

    /**
     * Materials & Textures
     */

    const wallMat = new StandardMaterial('wallBricks', scene);
    const wallTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    // wallTexture.uScale = 10;
    // wallTexture.vScale = 10;
    wallMat.diffuseTexture = wallTexture;
    
    const groundMat = new StandardMaterial('groundBricks', scene);
    const groundTexture = new Texture('https://assets.babylonjs.com/environments/bricktile.jpg', scene);
    groundTexture.uScale = 4;
    groundTexture.vScale = 12;
    groundMat.diffuseTexture = groundTexture;

    /**
     * Objects
     */
    const ball1 = this.createBall({
      position: new Vector3(0, 1, 0)
    }, scene);

    const ball2 = this.createBall({
      position: new Vector3(0, 3, 2)
    }, scene);

    /**
     * Ground
     */
    const ground = MeshBuilder.CreateGround(
      'ground',
      {
        width: 50,
        height: 50,
      },
      scene
    );
    ground.receiveShadows = true;
    ground.material = groundMat;

    /**
     * Wall
     */
    // 创建墙的方式 - 1
    // const wall = MeshBuilder.CreateBox('wall', { size: 1 }, scene);
    // 降盒子在 x, y 方向拉伸，形成薄片（墙）的效果
    // wall.scaling.y = 20;
    // wall.scaling.x = 20;
    // wall.scaling.z = 0.1;
    // 创建墙的方式 - 2, 比第一种简洁
    // const wall = MeshBuilder.CreateBox('wall', { width: 20, height: 20, depth: 0.1 }, scene);
    const pat = Mesh.FLIP_TILE;
    // const pat = Mesh.ROTATE_TILE;
    // const pat = Mesh.FLIP_N_ROTATE_TILE;
    const av = Mesh.TOP;
    const ah = Mesh.LEFT;
    const wall = MeshBuilder.CreateTiledBox('wall', { 
      width: 20, 
      height: 20, 
      depth: 0.1,
      pattern: pat,
      sideOrientation: Mesh.DOUBLESIDE,
      alignVertical: av,
      alignHorizontal: ah,
      // tileSize: 3,
      tileWidth: 3,
      tileHeight: 1,
    }, scene);
    wall.material = wallMat;
    wall.position.y = 5;
    wall.position.x = 0;
    wall.position.z = -5;
    // 倾斜一定角度，形成斜坡
    wall.rotation.x = Math.PI / -3;
    wall.receiveShadows = true;


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
    brickBox.material = wallMat;
    brickBox.position.x = -5;
    brickBox.position.y = 5;
    brickBox.position.z = 3;
    brickBox.receiveShadows = true;

    /**
     * https://doc.babylonjs.com/features/featuresDeepDive/lights/lights_introduction
     */
    // const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 0, 0), scene);
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), scene);
    hemiLight.intensity = 0.1;
    // const pointLight = new PointLight("pointLight", new Vector3(3, 5, 0), scene);
    // pointLight.intensity = 0.7;
    const diretionalLight = new DirectionalLight('directionalLight', new Vector3(-10, -20, -15).normalize(), scene);
    diretionalLight.position = new Vector3(10, 20, 10);
    diretionalLight.intensity = 0.7;
    const spotLight = new SpotLight('spotLight', new Vector3(0, 15, 0), new Vector3(-0.5, -1, 0), Math.PI / 2, 50, scene);
    spotLight.intensity = 0.9;
    spotLight.diffuse = new Color3(1, 0, 0);
    spotLight.specular = new Color3(0, 1, 0);

    // // spotLight.excludedMeshes.push(ball1);
    // const spotLight2 = new SpotLight('spotLight', new Vector3(-5, 15, -5), new Vector3(1, -2, 1), Math.PI / 4, 50, scene);
    // spotLight2.intensity = 0.9;
    // spotLight2.diffuse = new Color3(0, 0, 1);
    // spotLight2.specular = new Color3(0, 1, 0);

    // const lightToShadow = diretionalLight;
    // const lightToShadow = pointLight; // 使用 PointLight 生成阴影时，转动镜头卡顿比较明显
    const lightToShadow = spotLight;

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
    shadowGenerator.addShadowCaster(ball1, true);
    shadowGenerator.addShadowCaster(ball2, true);
    shadowGenerator.addShadowCaster(wall, true);
    shadowGenerator.addShadowCaster(brickBox, true);
    // shadowGenerator.usePoissonSampling = true;
    // shadowGenerator.useExponentialShadowMap = true;
    // 注意，有两个光源同时生成阴影时，渲染会明显变卡顿
    const shadowGenerator2 = new ShadowGenerator(4096, diretionalLight);
    shadowGenerator2.addShadowCaster(ball1, true);
    shadowGenerator2.addShadowCaster(ball2, true);
    shadowGenerator2.addShadowCaster(wall, true);
    shadowGenerator2.addShadowCaster(brickBox, true);

    // Animations
    var alpha = 0;
    scene.registerBeforeRender(function () {
      ball1.position = new Vector3(Math.cos(alpha) * 5, 10, Math.sin(alpha) * 5);
      const lightSpherePosition = new Vector3(Math.cos(alpha) * 5 + 5, 20, Math.sin(alpha) * 5);
      lightToShadow.position = lightSpherePosition;
      lightSphere.position = lightSpherePosition;
      alpha += 0.05;
    });

    return scene;
  }

  createBall = ({ position }: {
    position: Vector3
  }, scene: Scene) => {
    console.log('== scene', scene)
    const ball = MeshBuilder.CreateSphere(
      'ball',
      { diameter: 1, segments: 10 },
      scene
    );
    ball.position = position;
    return ball;
  }
}
