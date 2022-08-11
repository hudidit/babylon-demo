import { BasicScene } from "../examples/BasicScene";
import { StandardMaterials } from "../examples/StandardMaterials";

export class ExampleBasicScene {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
    

    // new BasicScene(canvas);
    new StandardMaterials(canvas);
  }
}