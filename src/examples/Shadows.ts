import * as BABYLON from "@babylonjs/core";
import { Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, Vector3, PointLight, DirectionalLight, SpotLight, Color3, ArcRotateCamera, ShadowGenerator, StandardMaterial } from "@babylonjs/core";

export class ShadowsScene {

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
    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(this.engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(this.canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    // var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // // Default intensity is 1. Let's dim the light a small amount
    // light.intensity = 0.7;

    // Our built-in 'sphere' shape.
    var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);

    // Move the sphere upward 1/2 its height
    sphere.position.y = 1;

    // Our built-in 'ground' shape.
    var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);

    ground.receiveShadows = true;

    const directionalLight1 = new BABYLON.DirectionalLight('directionalLight1', new BABYLON.Vector3(-1, -2, -1).normalize(), scene);
    directionalLight1.position = new BABYLON.Vector3(20, 40, 20);
    directionalLight1.intensity = 0.6;

    const shadowGenerator1 = new BABYLON.ShadowGenerator(4096, directionalLight1);

    shadowGenerator1.getShadowMap().renderList.push(sphere);

    return scene;
  }

  createBall = ({ position }: {
    position: Vector3
  }, scene: Scene) => {
    console.log('== scene', scene)
    const ball = MeshBuilder.CreateSphere(
      'ball',
      { diameter: 1 },
      scene
    );
    ball.position = position;
    return ball;
  }
}
