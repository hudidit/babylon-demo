import type { RoomScene } from "../examples/Room";
import { TIME_OF_DAY_PRESETS } from "../examples/RoomTimeOfDay";

const formatTime = (hour: number) => {
  const minutes = Math.floor(hour * 60 + 1e-7) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
};

/** DOM controls subscribe to the scene clock; no independent timer or saved scene time. */
export class RoomTimeMenu {
  constructor(room: RoomScene, closeSettings: () => void) {
    const root = document.querySelector<HTMLElement>("#time-controls")!;
    const toggle = document.querySelector<HTMLButtonElement>("#time-toggle")!;
    const menu = document.querySelector<HTMLElement>("#time-menu")!;
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-time-hour]"));
    const automatic = document.querySelector<HTMLInputElement>("#time-automatic")!;
    const status = document.querySelector<HTMLElement>("#time-current")!;
    const live = document.querySelector<HTMLElement>("#time-announcement")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const weatherSelect=document.querySelector<HTMLSelectElement>("#weather-mode")!;
    const weatherMotion=document.querySelector<HTMLInputElement>("#weather-reduced-motion")!;
    const sessionMode=document.querySelector<HTMLSelectElement>("#lighthouse-session-mode")!;
    const seed=document.querySelector<HTMLInputElement>("#lighthouse-exercise-seed")!;
    weatherMotion.checked=reduced.matches;room.setReducedWeatherMotion(reduced.matches);
    const events = new AbortController(), signal = events.signal;
    let opening = false;
    const setOpen = (open: boolean, focus = true) => {
      if (open && root.hidden || menu.hidden === !open) return;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("time-menu-open", open);
      opening = open;
      // Register before releasing pointer lock or removing another panel's pause.
      room.setPaused("time-menu", open);
      if (open) {
        closeSettings();
        opening = false;
        options.find(button => button.getAttribute("aria-checked") === "true")?.focus({ preventScroll: true });
      } else if (focus && !root.hidden) toggle.focus({ preventScroll: true });
    };
    const render = () => {
      const state = room.timeOfDay, playback = room.timePlayback;
      const hour = playback.targetHour ?? state.hour;
      const preset = TIME_OF_DAY_PRESETS.find(p => p.hour === (playback.targetHour ?? state.periodHour))!;
      const label = formatTime(hour) + " " + preset.name;
      document.querySelector("#time-label")!.textContent = label;
      document.querySelector("#time-symbol")!.textContent = (playback.targetHour == null ? state.primary?.kind : preset.sun.strength > 0 ? "sun" : "moon") === "sun" ? "☼" : "☾";
      toggle.setAttribute("aria-label", "场景时间 " + label + (playback.transitioning ? "，切换中" : ""));
      options.forEach(button => {
        const checked = Number(button.dataset.timeHour) === preset.hour;
        button.setAttribute("aria-checked", String(checked)); button.tabIndex = checked ? 0 : -1;
      });
      automatic.checked = playback.automatic;
      const weather=room.weather.weather,weatherLabel=({clear:"晴朗",overcast:"阴天",fog:"海雾",storm:"风雨"})[weather.kind];
      weatherSelect.value=weather.mode==="automatic"?"automatic":weather.kind;
      sessionMode.value=room.lighthouseSessionMode;
      document.querySelector("#lighthouse-session-current")!.textContent=room.lighthouseSessionMode==="exercise"
        ?`独立演练 · 种子 ${room.weather.random.seed} · 返回值守可恢复原进度`:"正常值守 · 选择固定天气会进入独立演练";
      document.querySelector("#weather-label")!.textContent=(room.lighthouseSessionMode==="exercise"?"演练 · ":"")+weatherLabel;
      document.querySelector("#weather-current")!.textContent=`${weatherLabel}${weather.phase==="entering"?" · 转变中":""} · 能见约${weather.visibilityKm.toFixed(1)} km · 太阳能${Math.round(weather.solarMultiplier*100)}%${weather.rain>=.15?" · 暂缓外廊作业":""}`;
      status.textContent = playback.transitioning ? "切换中…" : "当前 " + formatTime(state.hour)
        + (playback.automatic ? room.pauseReasons.length ? " · 收起后继续流转" : " · 自动流转中" : " · 手动时间");
    };
    const syncPanels = () => {
      const reasons = room.pauseReasons;
      const blocked = reasons.some(reason => ["map", "inspection", "lighthouse-panel", "inspector"].includes(reason));
      if (blocked || !opening && reasons.includes("settings")) setOpen(false, false);
      root.hidden = blocked;
      if (blocked) closeSettings();
    };
    const select = (button: HTMLButtonElement) => {
      room.transitionTimeOfDay(Number(button.dataset.timeHour), reduced.matches);
      live.textContent = "已选择 " + button.textContent!.trim() + "，自动流转已关闭";
    };
    toggle.addEventListener("click", () => setOpen(menu.hidden), { signal });
    document.querySelector("#time-close")!.addEventListener("click", () => setOpen(false), { signal });
    options.forEach(button => button.addEventListener("click", () => select(button), { signal }));
    automatic.addEventListener("change", () => {
      room.setTimeAutomatic(automatic.checked);
      live.textContent = automatic.checked ? "自动流转已开启，收起菜单后继续" : "自动流转已关闭";
    }, { signal });
    weatherSelect.addEventListener("change",()=>{room.setWeather(weatherSelect.value==="automatic"?null:weatherSelect.value as "clear"|"overcast"|"fog"|"storm");live.textContent="已在独立演练中切换天气，正常值守进度保留";},{signal});
    sessionMode.addEventListener("change",()=>{const ok=room.setLighthouseSessionMode(sessionMode.value as "duty"|"exercise");render();live.textContent=ok?"已切换会话，时间暂停；收起菜单前可开启自动流转":"时间切换完成后再切换会话";},{signal});
    document.querySelector("#lighthouse-exercise-restart")!.addEventListener("click",()=>{
      const value=seed.value.trim(),n=Number(value);
      const ok=/^\d+$/.test(value)&&room.restartLighthouseExercise(n);
      seed.setCustomValidity(ok?"":"请输入0至4294967295的整数，且等待时间切换完成");
      if(!ok)seed.reportValidity();else live.textContent="已按种子重开独立演练；设备回到初始状态，正常值守进度保留";
    },{signal});
    seed.addEventListener("input",()=>seed.setCustomValidity(""),{signal});
    weatherMotion.addEventListener("change",()=>room.setReducedWeatherMotion(weatherMotion.checked),{signal});
    reduced.addEventListener("change",event=>{weatherMotion.checked=event.matches;room.setReducedWeatherMotion(event.matches);},{signal});
    document.addEventListener("pointerdown", event => {
      if (!menu.hidden && !root.contains(event.target as Node)) setOpen(false, false);
    }, { capture: true, signal });
    document.addEventListener("keydown", event => {
      if (event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!root.hidden && event.code === "KeyT" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
        && !target?.matches("input, textarea, select, [contenteditable]")) {
        event.preventDefault(); event.stopImmediatePropagation(); setOpen(menu.hidden); return;
      }
      if (menu.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); return;
      }
      if (!root.contains(target)) return;
      event.stopPropagation();
      const button = target?.closest<HTMLButtonElement>("[data-time-hour]");
      const index = button ? options.indexOf(button) : -1;
      const offset = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 } as Record<string, number>)[event.key];
      if (index >= 0 && (offset || event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + offset + options.length) % options.length;
        options[next].focus(); select(options[next]);
      }
    }, { capture: true, signal });
    root.addEventListener("wheel", event => event.stopPropagation(), { signal, passive: true });
    room.onTimeOfDayChange = render;
    room.onPauseChange = syncPanels;
    render(); syncPanels();
    room.scene.onDisposeObservable.addOnce(() => {
      events.abort(); menu.hidden = true; toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("time-menu-open");
      room.onTimeOfDayChange = room.onPauseChange = () => {};
    });
  }
}
