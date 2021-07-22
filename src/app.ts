import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  CSG,
} from "@babylonjs/core";

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

    // 镜头
    var camera: ArcRotateCamera = new ArcRotateCamera(
      "Camera",
      Math.PI / 2,
      Math.PI / 2,
      30,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    // 光源
    var light1: HemisphericLight = new HemisphericLight(
      "light1",
      new Vector3(10, 5, 0),
      scene
    );

    // 主火箭
    const rocketMain = this._createRocket('main', 10, 2, 0, 0, 0, scene)
    // 辅助推进器——体积较小的火箭
    const rocket1 = this._createRocket('r1', 4, 1, 1.5, -3, 0, scene)
    // 一边一个
    const rocket2 = this._createRocket('r2', 4, 1, -1.5, -3, 0, scene)

    // 组装成一个整体，可以直接改变整体的位置
    const rocketWhole = Mesh.MergeMeshes([rocketMain, rocket1, rocket2])
    rocketWhole.position.y = 5

    // hide/show the Inspector
    // 快捷键唤起 Babylon.js 的调试工具，非常有用，可以让你看到每个实体占据的立体空间，便于计算和调整坐标。
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

  /**
   * 封装了一个绘制火箭的方法。
   * 火箭由三个部分组成：箭头、箭体、箭尾（就是底部喷火的地方，不知道术语叫什么，暂时先叫它箭尾吧）
   */
  private _createRocket(
    // 实体名称
    name: string,
    // 箭体高度
    height: number,
    // 箭体直径
    diameter: number,
    // 箭体的坐标
    x: number,
    y: number,
    z: number,
    scene: Scene,
  ) {
    // 箭体是一个圆柱体
    const cylinder = MeshBuilder.CreateCylinder(name + "Cylinder", {
      height,
      diameter,
    });
    cylinder.position.x = x
    cylinder.position.y = y
    cylinder.position.z = z

    // 箭头是一个圆锥体，直径与箭体相同，高度是箭体的 1/5
    const headHeight = height / 5
    const coneHead = MeshBuilder.CreateCylinder(name + 'ConeHead', {
      height: headHeight,
      diameterTop: 0,
      diameterBottom: diameter,
    })
    coneHead.position.x = x
    // 箭头与箭体刚好衔接在一起
    coneHead.position.y = y + (headHeight + height) / 2
    coneHead.position.z = z

    // 箭尾是一个顶面较小，底面较大的圆柱体（还算是圆柱体吗？），有点像烟囱
    const tailHeight = height / 10
    const coneTail = MeshBuilder.CreateCylinder(name + 'ConeTail', {
      height: tailHeight,
      diameterTop: diameter * 0.5,
      diameterBottom: diameter * 0.8,
    })
    coneTail.position.x = x
    // 箭尾一半嵌在箭体里，一半在箭体外面
    coneTail.position.y = y - height / 2
    coneTail.position.z = z

    // 把三个部分组装成一个整体
    const rocketMesh = Mesh.MergeMeshes([coneHead, cylinder, coneTail])
    return rocketMesh

    /**
     * 也可以用 CSG 来组装
     * https://doc.babylonjs.com/typedoc/classes/babylon.csg
     */
    // const headCSG = CSG.FromMesh(coneHead)
    // const bodyCSG = CSG.FromMesh(cylinder)
    // const tailCSG = CSG.FromMesh(coneTail)
    // const rocketCSG = headCSG.union(bodyCSG).union(tailCSG)
    // const rocket = rocketCSG.toMesh('rocket', null, scene)
    // coneHead.dispose()
    // cylinder.dispose()
    // coneTail.dispose()
    // scene.removeMesh(coneHead)
    // scene.removeMesh(cylinder)
    // scene.removeMesh(coneTail)

    // return rocket
  }
}
new App();
