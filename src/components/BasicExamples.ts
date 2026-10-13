import { RoomScene, RoomView } from "../examples/Room";

export class ExampleBasicScene {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    canvas.setAttribute("aria-label", "复古书房三维场景，可拖动旋转、滚轮缩放");
    document.body.appendChild(canvas);
    const room = new RoomScene(canvas);
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => {
      button.addEventListener("click", () => room.setView(button.dataset.view as RoomView));
    });
    const inspect = document.querySelector<HTMLButtonElement>("#inspect-btn")!;
    inspect.addEventListener("click", async () => {
      inspect.disabled = true;
      try {
        if (room.scene.debugLayer.isVisible()) {
          room.scene.debugLayer.hide();
          room.engine.resize();
          room.scene.render();
        }
        else {
          await import("@babylonjs/inspector");
          await room.scene.debugLayer.show({ overlay: true, embedMode: true, enablePopup: false });
        }
      } finally {
        inspect.disabled = false;
      }
    });
  }
}
