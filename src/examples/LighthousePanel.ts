import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import { LighthouseInspection } from "./LighthouseInspection";
import type { LighthouseInspectionSnapshot } from "./LighthouseInspection";
import type { LighthouseMaintenanceSnapshot } from "./LighthouseMaintenance";
import type { LighthousePowerSnapshot } from "./LighthousePower";
import { lighthouseEquipmentDefinition } from "./LighthouseEquipmentLayout";
import type { LighthouseEquipmentId } from "./LighthouseEquipmentLayout";
import { lighthouseProgress, lighthouseRecords, lighthouseRecordPage } from "./LighthouseExperience";

export type LighthousePanelLocation = "control" | "test" | "cover" | "log" | LighthouseEquipmentId;
export const lighthouseClockLabel = (hour: number) => {
  const minutes = Math.floor(hour * 60 + 1e-7) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
};
type Snapshot = [LighthouseOperationSnapshot, LighthouseInspectionSnapshot, LighthouseMaintenanceSnapshot, LighthousePowerSnapshot, boolean];

/** A local instrument face and a separate, paginated paper log. Authority stays with RoomScene. */
export class LighthousePanel {
  private readonly dialog: HTMLDialogElement;
  private readonly events = new AbortController();
  private location?: LighthousePanelLocation;
  private state?: Snapshot;
  private displayKey = "";
  private paper = false;
  private page = 0;
  private completion?: {inspection: number; maintenance: number; power: number};
  private completedUntil = 0;
  private completionLabel = "";
  private interrupted = false;
  constructor(private readonly document: Document, close: (resume: boolean) => void, test: () => void,
    actions: {confirm: () => void; cover: () => void; clean: () => void; solarInspect: () => void; solarClean: () => void; restorePower: () => void}) {
    this.dialog = this.el<HTMLDialogElement>("lighthouse-panel");
    const signal = this.events.signal;
    const listen = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn, {signal});
    listen("lighthouse-panel-return", () => close(true));
    listen("lighthouse-test-toggle", test); listen("lighthouse-confirm-control", actions.confirm);
    listen("lighthouse-cover-check", actions.cover); listen("lighthouse-clean-start", actions.clean);
    listen("lighthouse-solar-inspect", actions.solarInspect); listen("lighthouse-solar-clean", actions.solarClean);
    listen("lighthouse-power-restore", actions.restorePower);
    listen("lighthouse-record-toggle", () => {this.paper = !this.paper; this.page = 0; this.refresh();});
    listen("lighthouse-record-prev", () => {this.page--; this.refresh();});
    listen("lighthouse-record-next", () => {this.page++; this.refresh();});
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
  private el<T extends HTMLElement = HTMLElement>(id: string) { return this.document.getElementById(id) as T; }
  private set(id: string, text: string) { const el = this.el(id); if (el.textContent !== text) el.textContent = text; }
  private refresh() { if (this.state) this.render(...this.state); }
  get isOpen() { return this.dialog.open; }
  get activeLocation() { return this.location; }
  open(location: LighthousePanelLocation, ...state: Snapshot) {
    if (this.isOpen) return false;
    this.location = location; this.paper = location === "log"; this.page = 0; this.render(...state);
    this.document.body.classList.add("viewing-lighthouse"); this.dialog.showModal(); this.dialog.scrollTop = 0;
    this.el<HTMLButtonElement>(location === "test" ? "lighthouse-test-toggle" : "lighthouse-panel-return").focus();
    return true;
  }
  render(op: LighthouseOperationSnapshot, i: LighthouseInspectionSnapshot, m: LighthouseMaintenanceSnapshot, p: LighthousePowerSnapshot, automatic: boolean) {
    if (!this.location || !m || !p) return;
    this.state = [op, i, m, p, automatic];
    const location = this.location, equipment = lighthouseEquipmentDefinition(location);
    const key = [location, this.paper, this.page, op.dutyDay, lighthouseClockLabel(op.hour), op.running, Math.ceil(op.testSecondsRemaining),
      i.dirty, i.completed, i.checks["check-cover"], !!i.control, !!i.optic, i.events[i.events.length - 1]?.id,
      m.solarDirty, m.backupOn, m.detectedDemand, m.evidence[m.evidence.length - 1]?.id,
      Math.round(p.mainFraction * 1000), Math.round(p.backupFraction * 1000), Math.round(p.solarW), Math.sign(p.mainNetW),
      p.protected, p.recoveryReady, p.warning, p.events[p.events.length - 1]?.id, automatic].join(":");
    if (key === this.displayKey) return; this.displayKey = key;
    this.dialog.dataset.equipment = equipment?.id || ""; this.dialog.dataset.paper = String(this.paper);
    this.set("lighthouse-panel-place", equipment?.place || ({control: "首层维护室 · 运行面板", test: "顶层灯室 · 灯座控制", cover: "顶层灯室 · 固定保护面", log: "首层维护室 · 记录夹"})[location]);
    this.set("lighthouse-panel-title", equipment?.label || ({control: "灯塔值守", test: "导航灯试灯", cover: "灯具保护面", log: "值守记录"})[location]);
    this.set("lighthouse-panel-clock", `第 ${op.dutyDay} 日 / ${lighthouseClockLabel(op.hour)}`);
    this.el("lighthouse-instrument").hidden = this.paper; this.el("lighthouse-paper").hidden = !this.paper;
    const toggle = this.el<HTMLButtonElement>("lighthouse-record-toggle"); toggle.hidden = location === "log";
    toggle.textContent = this.paper ? "合上记录 · 查看设备" : "翻看记录";
    toggle.setAttribute("aria-expanded", String(this.paper));
    let status = op.running ? "导航灯运行" : "日间待机", guide = i.completed ? "本轮巡视完成，记录已经收好。" : i.control ? "读数已记下，到顶层灯座试灯并观察。" : "先确认读数，再登塔查看灯具。";
    let tone = op.running ? "good" : "idle";
    const gauges: {label: string; value: number; max: number; unit: string; note: string}[] = [];
    const battery = () => gauges.push({label: "主电池", value: p.mainFraction * 100, max: 100, unit: "%", note: p.protected ? "低电保护" : p.warning ? "电量偏低" : "电量充足"});
    if (["control", "lighthouse-battery-main", "lighthouse-solar-charger", "lighthouse-solar-array"].includes(location)) {
      if (location !== "lighthouse-battery-main") gauges.push({label: "太阳能输入", value: p.solarW, max: 250, unit: "W", note: p.solarW > 1 ? "日照发电" : "等待日照"});
      battery();
      if (location === "lighthouse-battery-main") {status = p.protected ? "供电保护中" : p.warning ? "电量偏低" : "供电正常";
        guide = p.protected ? p.recoveryReady ? "电量已回升，可以确认恢复供电。" : "等待白天太阳能补能，电量回升后在这里恢复供电。" : "白天储能，夜间为导航灯供电。"; tone = p.warning ? "warn" : "good";}
      if (location === "lighthouse-solar-charger") {status = p.solarW > 1 ? "太阳能接入" : "等待日照"; guide = "到塔外巡视面板，检查表面是否洁净。"; tone = p.solarW > 1 ? "good" : "idle";}
      if (location === "lighthouse-solar-array") {status = m.solarDirty ? "面板有污损" : "面板洁净"; guide = m.solarDirty ? "擦去表面污损，再巡视确认。" : "沿支架查看表面，保持面板洁净。"; tone = m.solarDirty ? "warn" : "good";}
      if (location === "control" && p.protected) {status = "主灯低电保护"; guide = "到右侧电池柜查看供电状态。"; tone = "warn";}
    } else if (location === "cover") {
      status = i.dirty ? "表面有盐膜" : i.checks["check-cover"] === "awaiting-recheck" ? "已清洁 · 待复查" : "保护面洁净"; tone = i.dirty ? "warn" : "good";
      guide = i.checks["check-cover"] === "pending" ? "先查看表面，再决定是否擦拭。" : i.dirty ? LighthouseInspection.canClean(op) ? "擦拭时保持准星对准保护面，圆环闭合后复查。" : "等待白天停灯后，再擦拭保护面。" : "确认洁净后，记入本轮巡检。";
    } else if (location === "test" || location === "lighthouse-drive-hatch") {
      gauges.push({label: "转台转速", value: op.running ? 6 : 0, max: 8, unit: "rpm", note: op.running ? "每十秒一圈" : "转台停止"});
      guide = location === "test" ? i.optic ? "本次转动与出光已确认。" : "开启试灯后看向灯头，准星圆环闭合即完成观察。" : "检修口保持关闭。可在灯座试灯，观察转动与出光。";
    } else if (location === "lighthouse-beacon-backup") {
      status = m.backupOn ? "备用灯接替中" : "备用灯待命"; tone = m.backupOn ? "warn" : "idle";
      gauges.push({label: "备用电池", value: p.backupFraction * 100, max: 100, unit: "%", note: "独立供电"}); guide = "主灯不可用时自动接替，日常无需切换。";
    } else if (location === "lighthouse-light-sensor") {
      status = m.detectedDemand ? "感应请求亮灯" : "自动感应值守"; guide = "天黑亮灯，天亮待机。日常无需调整。";
    } else if (location === "lighthouse-generator" || location === "lighthouse-generator-room") {
      status = "机组停放"; tone = "idle"; guide = "保持通风口与入口畅通，日常由太阳能供电。";
    }
    this.set("lighthouse-panel-state", status); this.el("lighthouse-status-lamp").dataset.tone = tone;
    this.set("lighthouse-panel-guide", guide);
    this.el("lighthouse-gauges").replaceChildren(...gauges.map(g => this.gauge(g)));
    this.el("lighthouse-status-face").hidden = gauges.length > 0;
    this.set("lighthouse-status-face-label", status);
    this.set("lighthouse-status-face-detail", location === "cover" ? i.dirty ? "需要清洁" : "表面清晰" : "自动值守");
    this.el("lighthouse-status-face").dataset.tone = tone;
    const show = (id: string, visible: boolean, text: string) => {const b = this.el<HTMLButtonElement>(id); b.hidden = !visible; b.textContent = text;};
    show("lighthouse-test-toggle", location === "test", op.testSecondsRemaining > 0 ? "结束试灯" : "开启试灯 · 返回观察");
    show("lighthouse-confirm-control", location === "control", i.control ? "重新确认读数" : "确认读数");
    const mayClean = i.dirty && i.checks["check-cover"] === "dirty" && LighthouseInspection.canClean(op);
    show("lighthouse-cover-check", location === "cover" && !mayClean, i.checks["check-cover"] === "awaiting-recheck" ? "确认复查 · 记入记录" : i.checks["check-cover"] === "complete" ? "再次查看表面" : "查看保护面");
    show("lighthouse-clean-start", location === "cover" && mayClean, "拿起清洁布 · 擦拭");
    show("lighthouse-solar-inspect", location === "lighthouse-solar-array", "巡视面板 · 返回观察");
    show("lighthouse-solar-clean", location === "lighthouse-solar-array" && m.solarDirty, "拿起清洁布 · 擦拭");
    show("lighthouse-power-restore", location === "lighthouse-battery-main" && p.recoveryReady, "确认恢复供电");
    this.set("lighthouse-power-flow", ["control", "lighthouse-battery-main", "lighthouse-solar-charger", "lighthouse-solar-array"].includes(location)
      ? `${automatic ? p.mainNetW > .5 ? "↑ 正在储能" : p.mainNetW < -.5 ? "↓ 正在供电" : "电量平稳" : "时钟暂停 · 电量保持"}` : location === "test" && op.testSecondsRemaining > 0 ? `试灯余时 ${Math.ceil(op.testSecondsRemaining)} 秒` : "");
    this.renderPaper(i, m, p);
  }
  private gauge(g: {label: string; value: number; max: number; unit: string; note: string}) {
    const face = this.document.createElement("figure"); face.className = "lighthouse-gauge";
    face.setAttribute("role", "img"); face.setAttribute("aria-label", `${g.label} ${Math.round(g.value)}${g.unit}，${g.note}`);
    // Static, original SVG art. Values are assigned through attributes and text, never injected HTML.
    face.innerHTML = `<svg viewBox="0 0 200 140" aria-hidden="true"><path class="dial-track" d="M 28 108 A 80 80 0 1 1 172 108"/><g class="dial-ticks"></g><text x="25" y="128">0</text><text class="dial-max" x="173" y="128"></text><g class="dial-needle"><path d="M 97 90 L 100 4 L 103 90 Z"/><circle cx="100" cy="74" r="7"/></g><text class="dial-label" x="100" y="112"></text></svg><figcaption><strong></strong><span></span></figcaption>`;
    const ns = "http://www.w3.org/2000/svg", ticks = face.querySelector(".dial-ticks")!;
    for (let n = 0; n <= 10; n++) {const tick = this.document.createElementNS(ns, "line");
      tick.setAttribute("x1", "100"); tick.setAttribute("y1", "-6"); tick.setAttribute("x2", "100"); tick.setAttribute("y2", n % 5 ? "1" : "6"); tick.setAttribute("transform", `rotate(${-115 + n * 23} 100 74)`); ticks.append(tick);}
    face.querySelector(".dial-needle")!.setAttribute("transform", `rotate(${-115 + Math.max(0, Math.min(1, g.value / g.max)) * 230} 100 74)`);
    face.querySelector(".dial-max")!.textContent = String(g.max); face.querySelector(".dial-label")!.textContent = g.label;
    face.querySelector("strong")!.textContent = `${Math.round(g.value)} ${g.unit}`; face.querySelector("figcaption span")!.textContent = g.note;
    return face;
  }
  private renderPaper(i: LighthouseInspectionSnapshot, m: LighthouseMaintenanceSnapshot, p: LighthousePowerSnapshot) {
    this.el("lighthouse-checks").hidden = this.location !== "log";
    const labels = {"check-control": "首层读数", "check-optic": "灯具转动与出光", "check-cover": "灯具保护面"};
    const states = {pending: "待巡视", dirty: "待清洁", "awaiting-recheck": "待复查", complete: "已确认"};
    this.el("lighthouse-checklist").replaceChildren(...Object.keys(labels).map(id => {
      const li = this.document.createElement("li"), state = i.checks[id]; li.dataset.state = state;
      const name = this.document.createElement("span"), result = this.document.createElement("span");
      name.textContent = labels[id]; result.textContent = `${state === "complete" ? "✓ " : "○ "}${states[state]}`; li.append(name, result); return li;
    }));
    this.set("lighthouse-round-summary", i.completed ? "本轮巡视完成" : "今日巡视 · 三项");
    const page = lighthouseRecordPage(lighthouseRecords(this.location!, i, m, p), this.page); this.page = page.page;
    const body = this.el("lighthouse-record-rows"); body.replaceChildren(...page.rows.map(row => {
      const tr = this.document.createElement("tr"); tr.dataset.object = row.object;
      [`第${row.day}日 ${lighthouseClockLabel(row.hour)}`, row.action, row.result].forEach(text => {const td = this.document.createElement("td"); td.textContent = text; tr.append(td);}); return tr;
    }));
    if (!page.rows.length) {const tr = this.document.createElement("tr"), td = this.document.createElement("td"); td.colSpan = 3; td.className = "lighthouse-empty"; td.textContent = "尚未落笔，巡视后会自动记在这里。"; tr.append(td); body.append(tr);}
    this.set("lighthouse-record-page", `${page.page + 1} / ${page.pages}`);
    this.el<HTMLButtonElement>("lighthouse-record-prev").disabled = page.page === 0;
    this.el<HTMLButtonElement>("lighthouse-record-next").disabled = page.page + 1 === page.pages;
  }
  renderActivity(i: LighthouseInspectionSnapshot, visible: boolean, _running: boolean, m?: LighthouseMaintenanceSnapshot, p?: LighthousePowerSnapshot) {
    if (!m || !p) return;
    const last = i.events[i.events.length - 1], solar = m.evidence[m.evidence.length - 1], power = p.events[p.events.length - 1];
    const previous = this.completion;
    this.completion = {inspection: last?.id || 0, maintenance: solar?.id || 0, power: power?.id || 0};
    const progress = lighthouseProgress(i, m, p), now = performance.now();
    const inspected = previous && last?.id !== previous.inspection && last?.type === "optic-observed";
    const cleaned = previous && last?.id !== previous.inspection && last?.type === "cover-cleaned";
    const solarDone = previous && solar?.id !== previous.maintenance && solar?.component === "solar" && ["现场观察", "擦拭完成"].includes(solar?.method);
    const powerDone = previous && power?.id !== previous.power && power?.type === "verify-main";
    if (!progress && (inspected || cleaned || solarDone || powerDone)) {
      this.interrupted = false; this.completedUntil = now + 1100; this.completionLabel = cleaned ? "擦拭完成 · 待复查" : "已记录";
    }
    const cancelled = previous && (last?.id !== previous.inspection && last?.type === "cleaning-cancelled"
      || solar?.id !== previous.maintenance && solar?.method === "中断" || power?.id !== previous.power && power?.type === "cancelled");
    if (!progress && cancelled) {this.interrupted = true; this.completedUntil = now + 1100; this.completionLabel = "已中断";}
    const el = this.el("lighthouse-activity"), complete = !progress && now < this.completedUntil;
    const active = !!progress || complete;
    el.hidden = this.isOpen || !visible || !active;
    this.document.body.classList.toggle("lighthouse-action-active", !el.hidden);
    if (el.hidden) {if (!visible || this.isOpen) this.completedUntil = 0; return;}
    el.dataset.state = complete ? this.interrupted ? "interrupted" : "complete" : "active";
    const fraction = complete ? this.interrupted ? 0 : 1 : Math.max(0, Math.min(.99, progress!.fraction));
    this.el("lighthouse-progress-value").style.strokeDashoffset = String(100 * (1 - fraction));
    const meter = this.el("lighthouse-progress"); meter.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    meter.setAttribute("aria-valuetext", complete ? this.completionLabel : `${progress!.label} ${Math.round(fraction * 100)}%`);
    this.set("lighthouse-activity-label", complete ? `${this.interrupted ? "○" : "✓"} ${this.completionLabel}` : progress!.label);
    this.set("lighthouse-activity-hint", complete ? "" : "保持准星对准 · 移开中断");
  }
  notice(text: string) { this.set("lighthouse-panel-guide", text); }
  close() {this.dialog.close(); this.location = undefined; this.state = undefined; this.displayKey = ""; this.document.body.classList.remove("viewing-lighthouse");}
  dispose() {this.events.abort(); this.close(); this.el("lighthouse-activity").hidden = true; this.document.body.classList.remove("lighthouse-action-active");}
}
