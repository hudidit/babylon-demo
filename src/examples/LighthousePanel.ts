import type { LighthouseOperationSnapshot, LighthouseEventType } from "./LighthouseOperation";
import { LighthouseInspection } from "./LighthouseInspection";
import type { LighthouseInspectionSnapshot, LighthouseCheckId } from "./LighthouseInspection";
import { lighthouseEquipmentDefinition, lighthouseEquipmentReading } from "./LighthouseEquipmentLayout";
import type { LighthouseEquipmentId } from "./LighthouseEquipmentLayout";

export type LighthousePanelLocation = "control" | "test" | "cover" | "log" | LighthouseEquipmentId;
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
  private lastInspection?: LighthouseInspectionSnapshot;
  private lastActivity = "";
  constructor(private readonly document: Document, close: (resume: boolean) => void, test: () => void,
    actions: {confirm: () => void; cover: () => void; clean: () => void}) {
    this.dialog = document.querySelector<HTMLDialogElement>("#lighthouse-panel")!;
    const signal = this.events.signal;
    document.querySelector("#lighthouse-panel-return")!.addEventListener("click", () => close(true), {signal});
    document.querySelector("#lighthouse-test-toggle")!.addEventListener("click", test, {signal});
    document.querySelector("#lighthouse-confirm-control")!.addEventListener("click", actions.confirm, {signal});
    document.querySelector("#lighthouse-cover-check")!.addEventListener("click", actions.cover, {signal});
    document.querySelector("#lighthouse-clean-start")!.addEventListener("click", actions.clean, {signal});
    this.dialog.addEventListener("cancel", event => {event.preventDefault(); close(false);}, {signal});
    this.dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("button")).filter(button => button.getClientRects().length > 0 && !button.disabled);
      const first = buttons[0], last = buttons[buttons.length - 1], focused = document.activeElement;
      if (event.shiftKey && focused === first || !event.shiftKey && focused === last) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }, {signal});
    this.dialog.addEventListener("wheel", event => event.stopPropagation(), {signal, passive: true});
  }
  get isOpen() { return this.dialog.open; }
  get activeLocation() { return this.location; }
  open(location: LighthousePanelLocation, state: LighthouseOperationSnapshot, inspection: LighthouseInspectionSnapshot) {
    if (this.isOpen) return false;
    this.location = location; this.lastState = undefined; this.render(state, inspection);
    this.document.body.classList.add("viewing-lighthouse"); this.dialog.showModal();
    this.document.querySelector<HTMLButtonElement>(location === "test" ? "#lighthouse-test-toggle" : "#lighthouse-panel-return")!.focus();
    return true;
  }
  render(state: LighthouseOperationSnapshot, inspection: LighthouseInspectionSnapshot) {
    if (!this.location || state === this.lastState && inspection === this.lastInspection) return;
    this.lastState = state; this.lastInspection = inspection;
    const set = (id: string, text: string) => {this.document.querySelector("#" + id)!.textContent = text;};
    const equipment = lighthouseEquipmentDefinition(this.location);
    this.document.querySelector<HTMLElement>("#lighthouse-operation-content")!.hidden = !!equipment;
    this.document.querySelector<HTMLElement>("#lighthouse-equipment-content")!.hidden = !equipment;
    this.dialog.dataset.equipment = equipment?.id || "";
    set("lighthouse-panel-clock", `第 ${state.dutyDay} 个值守日 · ${lighthouseClockLabel(state.hour)}`);
    if (equipment) {
      const reading = lighthouseEquipmentReading(equipment.id, state);
      set("lighthouse-panel-place", equipment.place); set("lighthouse-panel-title", equipment.label);
      set("lighthouse-panel-state", reading.state); set("lighthouse-equipment-id", equipment.id);
      set("lighthouse-equipment-purpose", equipment.purpose); set("lighthouse-equipment-status", reading.detail);
      set("lighthouse-panel-guide", equipment.guide);
      return;
    }
    const location = this.location as "control" | "test" | "cover" | "log";
    set("lighthouse-panel-place", ({test: "顶层灯室 · 灯座控制", control: "首层维护室 · 运行面板", cover: "顶层灯室 · 固定保护面", log: "首层维护室 · 维护记录夹"})[location]);
    set("lighthouse-panel-title", this.location === "log" ? "值守与巡检记录" : this.location === "cover" ? "保护面检查" : "导航灯运行");
    set("lighthouse-panel-state", stateLabels[state.state]);
    set("lighthouse-panel-clock", `第 ${state.dutyDay} 个值守日 · ${lighthouseClockLabel(state.hour)}`);
    set("lighthouse-panel-mode", state.mode === "test" ? "限时试灯 · 自动导航优先" : "自动值守");
    set("lighthouse-panel-output", state.running ? "转台运行 · 单束白光" : "转台停止 · 主灯熄灭");
    set("lighthouse-panel-test", state.testSecondsRemaining > 0 ? `${state.testSecondsRemaining.toFixed(1)} 秒（活跃时间）` : "未在试灯");
    const button = this.document.querySelector<HTMLButtonElement>("#lighthouse-test-toggle")!;
    button.hidden = this.location !== "test";
    button.textContent = state.testSecondsRemaining > 0 ? "结束试灯并返回观察" : "开始30秒试灯并返回观察";
    const confirm = this.document.querySelector<HTMLButtonElement>("#lighthouse-confirm-control")!;
    confirm.hidden = this.location !== "control"; confirm.textContent = inspection.control ? "重新确认本次读数" : "确认本次读数";
    const coverCheck = this.document.querySelector<HTMLButtonElement>("#lighthouse-cover-check")!;
    coverCheck.hidden = this.location !== "cover"; coverCheck.textContent = inspection.checks["check-cover"] === "awaiting-recheck" ? "复查已清洁的保护面" : "确认保护面观察结果";
    const clean = this.document.querySelector<HTMLButtonElement>("#lighthouse-clean-start")!;
    clean.hidden = this.location !== "cover";
    clean.disabled = !inspection.dirty || inspection.checks["check-cover"] !== "dirty" || !LighthouseInspection.canClean(state);
    clean.textContent = !inspection.dirty ? "保护面已洁净" : !LighthouseInspection.canClean(state) ? "设备运行中，不能擦拭" : inspection.checks["check-cover"] !== "dirty" ? "先确认表面观察结果" : "擦拭1.5秒并返回场景";
    set("lighthouse-panel-surface", this.location === "cover" || inspection.coverEvidence?.revision === inspection.coverRevision
      ? `${inspection.dirty ? "轻度盐膜" : "洁净"} · 出光修正 ${Math.round(inspection.transmission * 100)}%（游戏参数）`
      : inspection.coverEvidence ? "擦拭已完成，待现场复查" : "尚未现场检查，请到灯室固定保护面确认");
    const guides = {
      test: "开始试灯后，关闭界面，近距离看向灯头连续观察10个活跃秒。转头或离开会重新累计；本次周期正常不代表全面检修。保护面在灯头南侧。",
      control: "本轮三项：确认首层读数 → 登顶试灯并连续观察一圈 → 检查灯头南侧固定保护面，按需停机擦拭并复查。记录夹在首层工作台上方，可随时离开继续游览。",
      cover: inspection.checks["check-cover"] === "awaiting-recheck" ? "盐膜已擦除，请确认复查结果。擦拭完成与复查通过分别记录。" : "先确认表面读数，再按需擦拭。仅白天自动待机可清洁；保持看向保护面，走开、开界面、失焦或设备起动会中断。夜间主灯保持自动导航。",
      log: "记录只在本次会话保留，刷新重新开始。自动跨午夜建立下一日清单，已清除的盐膜保持洁净。记录保留最近7个值守日。"
    };
    set("lighthouse-panel-guide", guides[location]);
    const labels: Record<LighthouseCheckId, string> = {"check-control": "首层运行读数", "check-optic": "灯具与转台周期", "check-cover": "固定保护面"};
    const statuses = {pending: "未检查", dirty: "已发现盐膜 · 待擦拭", "awaiting-recheck": "已擦拭 · 待复查", complete: "已确认"};
    const tasks = this.document.querySelector("#lighthouse-checklist")!;
    tasks.replaceChildren(...(Object.keys(labels) as LighthouseCheckId[]).map(id => {
      const item = this.document.createElement("li"), evidence = id === "check-control" ? inspection.control : id === "check-optic" ? inspection.optic : inspection.coverEvidence;
      item.dataset.check = id; item.dataset.state = inspection.checks[id];
      item.textContent = `${labels[id]} · ${statuses[inspection.checks[id]]}${evidence ? ` · ${lighthouseClockLabel(evidence.hour)}观察` : ""}`;
      return item;
    }));
    set("lighthouse-round-summary", inspection.completed ? "本轮三项检查已完成：读数已确认、本次周期观察正常、保护面复查通过。" : "本轮检查尚未完成，可按清单继续；自动导航按日程独立运行。");
    const journal = this.document.querySelector("#lighthouse-inspection-events")!;
    journal.replaceChildren(...inspection.events.slice().reverse().map(event => {
      const item = this.document.createElement("li");
      item.dataset.object = event.objectId;
      const object = ({"lighthouse-control-panel": "首层面板", "lighthouse-beacon-main": "灯具与转台", "lighthouse-optics-cleaning": "固定保护面", "lighthouse-maintenance-log": "值守清单"})[event.objectId] || "灯塔设备";
      item.textContent = `#I${event.id} · 第${event.dutyDay}日 ${lighthouseClockLabel(event.hour)} · ${event.kind === "observation" ? "观察" : event.kind === "action" ? "操作" : "日历"} · ${object} · ${event.result} · 来源：${({"local-panel": "局部确认", "direct-view": "场景连续观察", "active-action": "活跃动作", "automatic-clock": "自动时钟"})[event.source]}${event.revision === undefined ? "" : ` · 表面版本${event.revision}`}`;
      return item;
    }));
    set("lighthouse-day-history", inspection.days.map(day => `第${day.dutyDay}日：${Object.keys(day.checks).filter(id => day.checks[id as LighthouseCheckId] === "complete").length}/3项${day.completed ? "，本轮完成" : ""}`).join("；"));
    const list = this.document.querySelector("#lighthouse-panel-events")!;
    list.replaceChildren(...state.events.slice(-5).reverse().map(event => {
      const item = this.document.createElement("li");
      item.textContent = `#R${event.id} · 第${event.dutyDay}日 ${lighthouseClockLabel(event.hour)} · ${eventLabels[event.type]} · ${stateLabels[event.result]} · 导航灯 · 来源：${({system: "控制器", "automatic-clock": "自动时钟", "manual-time": "时间选点", command: "局部操作", "active-time": "活跃计时"})[event.source]}`;
      return item;
    }));
  }
  renderActivity(inspection: LighthouseInspectionSnapshot, visible: boolean, running: boolean) {
    const activity = this.document.querySelector<HTMLElement>("#lighthouse-activity")!;
    activity.hidden = !visible || this.isOpen;
    if (activity.hidden) return;
    const text = inspection.cleaning ? `正在擦拭 ${inspection.cleaningSeconds.toFixed(1)} / 1.5秒 · 保持看向保护面`
      : !inspection.optic && running ? `灯具观察 ${inspection.observationSeconds.toFixed(1)} / 10秒 · 连续看清一整圈与出光`
      : inspection.notice || (inspection.completed ? "本轮三项检查已完成，记录夹已更新。" : "点击灯头南侧固定保护面进行检查；试灯控制在下方灯座。" );
    if (text !== this.lastActivity) {this.lastActivity = text; activity.textContent = text;}
  }
  notice(text: string) { this.document.querySelector("#lighthouse-panel-guide")!.textContent = text; }
  close() {
    this.dialog.close(); this.location = undefined; this.lastState = undefined; this.lastInspection = undefined;
    this.document.body.classList.remove("viewing-lighthouse");
  }
  dispose() { this.events.abort(); this.close(); this.document.querySelector<HTMLElement>("#lighthouse-activity")!.hidden = true; }
}
