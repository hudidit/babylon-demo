import { Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, Vector3, PointLight, DirectionalLight, SpotLight, Color3 } from "@babylonjs/core";

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
    const camera = new FreeCamera('camera', new Vector3(0, 3, -10), this.scene);
    camera.attachControl();
    camera.speed = 0.25;
    // const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 0, 0), this.scene);
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(1, 1, 1), this.scene);
    hemiLight.intensity = 0.5;
    // const pointLight = new PointLight("pointLight", new Vector3(3, 1, 0), scene);
    // pointLight.intensity = 0.7;
    // const diretionalLight = new DirectionalLight('directionalLight', new Vector3(1, -1, 1), scene);
    // const diretionalLight = new DirectionalLight('directionalLight', new Vector3(0, -1, 0), scene);
    // diretionalLight.intensity = 0.7;
    const spotLight = new SpotLight('spotLight', new Vector3(0, 10, 0), new Vector3(0, -1, 0), Math.PI / 4, 50, scene);
    spotLight.intensity = 0.9;
    spotLight.diffuse = new Color3(1, 0, 0);
    // spotLight.specular = new Color3(0, 1, 0);

    const ground = MeshBuilder.CreateGround(
      'ground', 
      {
        width: 10,
        height: 10,
      }, 
      this.scene
    );

    this.createBall({
      position: new Vector3(0, 1, 0)
    });

    this.createBall({
      position: new Vector3(0, 3, 0)
    });

    return scene;
  }

  createBall({ position }: {
    position: Vector3
  }) {
    console.log('== scene', this.scene)
    const ball = MeshBuilder.CreateSphere(
      'ball', 
      { diameter: 1 }, 
      this.scene
    );
    ball.position = position;
    return ball;
  }
}
