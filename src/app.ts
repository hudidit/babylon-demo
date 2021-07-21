import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder } from "@babylonjs/core";

class App {
  constructor() {
    // create the canvas html element and attach it to the webpage
    var canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);

    // initialize babylon scene and engine
    var engine = new Engine(canvas, true);
    var scene = new Scene(engine);

    var camera: ArcRotateCamera = new ArcRotateCamera(
      "Camera",
      Math.PI / 2,
      Math.PI / 2,
      20,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    var light1: HemisphericLight = new HemisphericLight(
      "light1",
      new Vector3(10, 5, 5),
      scene
    );
    // var sphere: Mesh = MeshBuilder.CreateSphere(
    //   "sphere",
    //   { diameter: 2 },
    //   scene
    // );

    this._createRocket('main', 10, 2, 0, 0, 0)
    this._createRocket('r1', 4, 1, 1.5, -3, 0)
    this._createRocket('r2', 4, 1, -1.5, -3, 0)


    // hide/show the Inspector
    window.addEventListener("keydown", (ev) => {
      // Shift+Ctrl+Alt+I
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
        if (scene.debugLayer.isVisible()) {
          scene.debugLayer.hide();
        } else {
          scene.debugLayer.show();
        }
      }
    });

    // run the main render loop
    engine.runRenderLoop(() => {
      scene.render();
    });
  }

  private _createRocket(
    name: string,
    height: number,
    diameter: number,
    x: number,
    y: number,
    z: number,
  ) {
    const cylinder = MeshBuilder.CreateCylinder(name + "Cylinder", {
      height,
      diameter,
    });
    cylinder.position.x = x
    cylinder.position.y = y
    cylinder.position.z = z

    const headHeight = height / 5
    const coneHead = MeshBuilder.CreateCylinder(name + 'ConeHead', {
      height: headHeight,
      diameterTop: 0,
      diameterBottom: diameter,
    })
    coneHead.position.x = x
    coneHead.position.y = y + (headHeight + height) / 2
    coneHead.position.z = z

    const tailHeight = height / 10
    const coneTail = MeshBuilder.CreateCylinder(name + 'ConeTail', {
      height: tailHeight,
      diameterTop: diameter * 0.5,
      diameterBottom: diameter * 0.8,
    })
    coneTail.position.x = x
    coneTail.position.y = y - height / 2
    coneTail.position.z = z
  }
}
new App();
