import { MOVEMENT_SPEED, RoomScene, RoomView } from "../examples/Room";

export class ExampleBasicScene {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    canvas.setAttribute("aria-label", "复古书房与客厅三维场景，可拖动旋转、滚轮缩放");
    document.body.appendChild(canvas);
    const room = new RoomScene(canvas);
    this.bindSettings(room);
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
          room.setControlsEnabled(false);
          await import("@babylonjs/inspector");
          await room.scene.debugLayer.show({ overlay: true, embedMode: true, enablePopup: false });
        }
      } finally {
        room.setControlsEnabled(document.querySelector<HTMLElement>("#settings-menu")!.hidden);
        inspect.disabled = false;
      }
    });
  }

  private bindSettings(room: RoomScene) {
    const toggle = document.querySelector<HTMLButtonElement>("#settings-btn")!;
    const menu = document.querySelector<HTMLElement>("#settings-menu")!;
    const speed = document.querySelector<HTMLInputElement>("#movement-speed")!;
    const output = document.querySelector<HTMLOutputElement>("#movement-speed-value")!;
    const storageKey = "study-movement-speed";
    speed.min = String(MOVEMENT_SPEED.min);
    speed.max = String(MOVEMENT_SPEED.max);
    const applySpeed = (value: number) => {
      const multiplier = room.setMovementSpeed(value);
      speed.value = String(multiplier);
      output.value = multiplier.toFixed(2) + "×";
      speed.setAttribute("aria-valuetext", multiplier.toFixed(2) + " 倍");
      return multiplier;
    };
    let savedSpeed = MOVEMENT_SPEED.default;
    try { savedSpeed = Number(localStorage.getItem(storageKey) ?? MOVEMENT_SPEED.default); } catch {}
    applySpeed(savedSpeed);
    const saveSpeed = (value: number) => {
      const multiplier = applySpeed(value);
      try { localStorage.setItem(storageKey, String(multiplier)); } catch {}
    };
    const setOpen = (open: boolean) => {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      room.setControlsEnabled(!open);
      if (open) speed.focus();
    };
    toggle.addEventListener("click", () => setOpen(menu.hidden));
    document.querySelector("#settings-close")!.addEventListener("click", () => {
      setOpen(false);
      toggle.focus();
    });
    speed.addEventListener("input", () => saveSpeed(speed.valueAsNumber));
    document.querySelector("#settings-reset")!.addEventListener("click", () => saveSpeed(MOVEMENT_SPEED.default));
    document.addEventListener("pointerdown", event => {
      if (!menu.hidden && !menu.contains(event.target as Node) && !toggle.contains(event.target as Node)) setOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
  }
}
