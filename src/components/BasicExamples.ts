import { MOVEMENT_SPEED, RoomScene, RoomView } from "../examples/Room";
import { AUDIO_DEFAULTS, AUDIO_STORAGE_KEY, audioPreferences } from "../examples/RoomAudioCatalog";

export class ExampleBasicScene {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    canvas.setAttribute("aria-label", "复古书房与客厅三维场景，可拖动旋转、滚轮缩放");
    document.body.appendChild(canvas);
    const room = new RoomScene(canvas);
    const resetAudio = this.bindAudio(room);
    this.bindSettings(room, resetAudio);
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

  private bindAudio(room: RoomScene) {
    const audio = room.audio;
    const enabled = document.querySelector<HTMLInputElement>("#audio-enabled")!;
    const volume = document.querySelector<HTMLInputElement>("#audio-volume")!;
    const output = document.querySelector<HTMLOutputElement>("#audio-volume-value")!;
    const status = document.querySelector<HTMLElement>("#audio-status")!;
    const retry = document.querySelector<HTMLButtonElement>("#audio-retry")!;
    const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-audio-toggle]"));
    let saved = AUDIO_DEFAULTS;
    try { saved = audioPreferences(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) || "null")); } catch {}
    const save = () => {
      try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify({ enabled: audio.enabled, volume: audio.volume })); } catch {}
    };
    const render = () => {
      enabled.checked = audio.enabled;
      volume.value = String(Math.round(audio.volume * 100)); output.value = volume.value + "%";
      volume.setAttribute("aria-valuetext", output.value);
      for (const button of toggles) {
        button.textContent = audio.enabled ? "音效：开" : "音效：关";
        button.setAttribute("aria-pressed", String(audio.enabled));
        button.setAttribute("aria-label", audio.enabled ? "关闭交互音效" : "启用交互音效");
      }
      const info = audio.diagnostics;
      status.dataset.state = info.state;
      status.textContent = !audio.volume ? "音量为零" : ({ muted: "音效已关闭", loading: "音效准备中…",
        partial: "部分音效暂不可用，可重试", unavailable: "当前浏览器的音效暂不可用", idle: "等待场景就绪",
        ready: info.context === "running" ? "音效已就绪" : "点击场景或试听启用声音", closed: "音效已关闭" })[info.state];
      retry.hidden = !["partial", "unavailable"].includes(info.state);
      retry.disabled = info.preparing;
      document.querySelector<HTMLButtonElement>("#audio-preview")!.disabled = !audio.enabled;
    };
    audio.onChange = render;
    audio.setPreferences(saved.enabled, saved.volume);
    const apply = (isEnabled: boolean, level: number) => { audio.setPreferences(isEnabled, level); save(); };
    const toggle = () => { apply(!audio.enabled, audio.volume); audio.unlockFromGesture(); };
    toggles.forEach(button => button.addEventListener("click", toggle));
    const changeEnabled = () => { apply(enabled.checked, audio.volume); audio.unlockFromGesture(); };
    const changeVolume = () => apply(audio.enabled, volume.valueAsNumber / 100);
    const preview = () => { audio.unlockFromGesture(); audio.play("switch", "preview"); };
    const retryAudio = () => { const pending = audio.retryFailed(); audio.unlockFromGesture(); void pending; };
    const gesture = (event: PointerEvent | KeyboardEvent) => {
      if (!event.isTrusted || (event instanceof PointerEvent ? event.button !== 0
        : event.repeat || !["Enter", " "].includes(event.key))) return;
      if (!document.hidden) audio.foreground();
      audio.unlockFromGesture();
    };
    enabled.addEventListener("change", changeEnabled);
    volume.addEventListener("input", changeVolume);
    document.querySelector("#audio-preview")!.addEventListener("click", preview);
    retry.addEventListener("click", retryAudio);
    document.addEventListener("pointerdown", gesture, true);
    document.addEventListener("keydown", gesture, true);
    room.scene.onDisposeObservable.addOnce(() => {
      toggles.forEach(button => button.removeEventListener("click", toggle));
      enabled.removeEventListener("change", changeEnabled); volume.removeEventListener("input", changeVolume);
      document.querySelector("#audio-preview")?.removeEventListener("click", preview);
      retry.removeEventListener("click", retryAudio);
      document.removeEventListener("pointerdown", gesture, true); document.removeEventListener("keydown", gesture, true);
      audio.onChange = () => {};
    });
    return () => apply(AUDIO_DEFAULTS.enabled, AUDIO_DEFAULTS.volume);
  }

  private bindSettings(room: RoomScene, resetAudio: () => void) {
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
    document.querySelector("#settings-reset")!.addEventListener("click", () => { saveSpeed(MOVEMENT_SPEED.default); resetAudio(); });
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
