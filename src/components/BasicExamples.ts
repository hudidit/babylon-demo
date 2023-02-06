import { BasicScene } from "../examples/BasicScene";
import { CustomModels } from "../examples/CustomModels";
import { PBR } from "../examples/PBR";
import { ShadowsScene } from "../examples/Shadows";
import { StandardMaterials } from "../examples/StandardMaterials";

export class ExampleBasicScene {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
    

    new BasicScene(canvas);
    // new StandardMaterials(canvas);
    // new PBR(canvas);
    // new CustomModels(canvas);
    // new ShadowsScene(canvas);
  }
}