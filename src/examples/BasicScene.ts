import { Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, Vector3, PointLight, DirectionalLight, SpotLight, Color3, ArcRotateCamera, ShadowGenerator, StandardMaterial } from "@babylonjs/core";

export class BasicScene {

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
    // const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    // camera.attachControl();
    // camera.speed = 0.25;
    const camera = new ArcRotateCamera("Camera", 0, 1, 15, Vector3.Zero(), scene);
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = (Math.PI / 2) * 0.9;
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 150;
    camera.attachControl();


    const ball1 = this.createBall({
      position: new Vector3(0, 1, 0)
    }, scene);

    const ball2 = this.createBall({
      position: new Vector3(0, 3, 2)
    }, scene);

    const ground = MeshBuilder.CreateGround(
      'ground', 
      {
        width: 50,
        height: 50,
      }, 
      scene
    );
    ground.receiveShadows = true;
    
    /**
     * https://doc.babylonjs.com/features/featuresDeepDive/lights/lights_introduction
     */
    // const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 0, 0), scene);
    // const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), scene);
    // hemiLight.intensity = 0.2;
    // const pointLight = new PointLight("pointLight", new Vector3(3, 5, 0), scene);
    // pointLight.intensity = 0.7;
    // const diretionalLight = new DirectionalLight('directionalLight', new Vector3(0, -1, 0).normalize(), scene);
    // diretionalLight.position = new Vector3(20, 40, 20);
    // diretionalLight.intensity = 0.7;
    const spotLight = new SpotLight('spotLight', new Vector3(0, 15, 0), new Vector3(0, -1, 0), Math.PI / 4, 50, scene);
    spotLight.intensity = 0.9;
    spotLight.diffuse = new Color3(1, 0, 0);
    spotLight.specular = new Color3(0, 1, 0);
    // spotLight.excludedMeshes.push(ball1);
    const spotLight2 = new SpotLight('spotLight', new Vector3(-5, 15, -5), new Vector3(1, -2, 1), Math.PI / 4, 50, scene);
    spotLight2.intensity = 0.9;
    spotLight2.diffuse = new Color3(0, 0, 1);
    spotLight2.specular = new Color3(0, 1, 0);
    
    // const lightToShadow = diretionalLight;
    // const lightToShadow = pointLight; // 使用 PointLight 生成阴影时，转动镜头卡顿比较明显
    const lightToShadow = spotLight;

    /**
     * ShadowGenerator 的第一个参数 mapSize 值越大，阴影边界越清晰；值越小，阴影颗粒感越强。
     * 可以尝试设置成 50, 100, 200, 1024, 4096，就能够看出区别。
     */
    const shadowGenerator = new ShadowGenerator(4096, lightToShadow);
    shadowGenerator.addShadowCaster(ball1, true);
    shadowGenerator.addShadowCaster(ball2, true);
    // shadowGenerator.usePoissonSampling = true;
    // shadowGenerator.useExponentialShadowMap = true;


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
