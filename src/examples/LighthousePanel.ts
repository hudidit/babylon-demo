import type { LighthouseOperationSnapshot, LighthouseEventType } from "./LighthouseOperation";

export type LighthousePanelLocation = "control" | "test";
export const lighthouseClockLabel = (hour: number) => {
  const minutes = Math.floor(hour * 60 + 1e-7) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
};
const stateLabels = {"day-standby": "日间待机", "night-running": "夜间导航运行", "test-running": "局部试灯运行"};
const eventLabels: Record<LighthouseEventType, string> = {initialized: "控制器就绪", "state-changed": "灯态更新",
  "time-selected": "场景时间改选", "duty-day-started": "新值守日", "test-started": "开始局部试灯", "test-ended": "主动结束试灯",
  "test-expired": "试灯到期", "test-superseded": "夜间自动导航接管"};

/** Readable equipment UI. Pausing, reachability and command authority stay with RoomScene. */
export class LighthousePanel {
  private readonly dialog: HTMLDialogElement;
  private readonly events = new AbortController();
  private location?: LighthousePanelLocation;
  private lastState?: LighthouseOperationSnapshot;
  constructor(private readonly document: Document, close: (resume: boolean) => void, test: () => void) {
    this.dialog = document.querySelector<HTMLDialogElement>("#lighthouse-panel")!;
    const signal = this.events.signal;
    document.querySelector("#lighthouse-panel-return")!.addEventListener("click", () => close(true), {signal});
    document.querySelector("#lighthouse-test-toggle")!.addEventListener("click", test, {signal});
    this.dialog.addEventListener("cancel", event => {event.preventDefault(); close(false);}, {signal});
    this.dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("button")).filter(button => !button.hidden && !button.disabled);
      const first = buttons[0], last = buttons[buttons.length - 1], focused = document.activeElement;
      if (event.shiftKey && focused === first || !event.shiftKey && focused === last) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }, {signal});
    this.dialog.addEventListener("wheel", event => event.stopPropagation(), {signal, passive: true});
  }
  get isOpen() { return this.dialog.open; }
  get activeLocation() { return this.location; }
  open(location: LighthousePanelLocation, state: LighthouseOperationSnapshot) {
    if (this.isOpen) return false;
    this.location = location; this.lastState = undefined; this.render(state);
    this.document.body.classList.add("viewing-lighthouse"); this.dialog.showModal();
    this.document.querySelector<HTMLButtonElement>(location === "test" ? "#lighthouse-test-toggle" : "#lighthouse-panel-return")!.focus();
    return true;
  }
  render(state: LighthouseOperationSnapshot) {
    if (!this.location || state === this.lastState) return;
    this.lastState = state;
    const set = (id: string, text: string) => {this.document.querySelector("#" + id)!.textContent = text;};
    set("lighthouse-panel-place", this.location === "test" ? "顶层灯室 · 灯座控制" : "首层维护室 · 运行面板");
    set("lighthouse-panel-state", stateLabels[state.state]);
    set("lighthouse-panel-clock", `第 ${state.dutyDay} 个值守日 · ${lighthouseClockLabel(state.hour)}`);
    set("lighthouse-panel-mode", state.mode === "test" ? "限时试灯 · 自动导航优先" : "自动值守");
    set("lighthouse-panel-output", state.running ? "转台运行 · 单束白光" : "转台停止 · 主灯熄灭");
    set("lighthouse-panel-test", state.testSecondsRemaining > 0 ? `${state.testSecondsRemaining.toFixed(1)} 秒（活跃时间）` : "未在试灯");
    const button = this.document.querySelector<HTMLButtonElement>("#lighthouse-test-toggle")!;
    button.hidden = this.location !== "test";
    button.textContent = state.testSecondsRemaining > 0 ? "结束试灯并返回观察" : "开始30秒试灯并返回观察";
    set("lighthouse-panel-guide", this.location === "test"
      ? "返回场景后观察灯头旋转与白闪；夜间结束试灯后，导航灯继续自动运行。"
      : "试灯入口在顶层灯座南侧。沿垂直梯到灯室，离梯后靠近灯座操作。工作照明由原墙面开关独立控制。");
    const list = this.document.querySelector("#lighthouse-panel-events")!;
    list.replaceChildren(...state.events.slice(-5).reverse().map(event => {
      const item = this.document.createElement("li");
      item.textContent = `第${event.dutyDay}日 ${lighthouseClockLabel(event.hour)} · ${eventLabels[event.type]} · ${stateLabels[event.result]}`;
      return item;
    }));
  }
  notice(text: string) { this.document.querySelector("#lighthouse-panel-guide")!.textContent = text; }
  close() {
    this.dialog.close(); this.location = undefined; this.lastState = undefined;
    this.document.body.classList.remove("viewing-lighthouse");
  }
  dispose() { this.events.abort(); this.close(); }
}
