import type { LighthouseMaintenanceSnapshot, LighthouseDrill, LighthouseTool, MaintenanceCommand } from "./LighthouseMaintenance";
import type { LighthouseOperationSnapshot } from "./LighthouseOperation";
import type { LighthousePanelLocation } from "./LighthousePanel";
import { lighthouseClockLabel } from "./LighthousePanel";
import { lighthouseEquipmentDefinition, lighthouseEquipmentReading } from "./LighthouseEquipmentLayout";

const sessionLabels = {normal: "正常值守", drive: "主灯驱动异常演练", charger: "充电支路异常演练", sensor: "光敏污染演练"};
const commandLabels: Record<MaintenanceCommand, string> = {inspect: "现场观察 · 返回场景2秒", diagnose: "隔离检测 · 返回场景2秒",
  clean: "擦拭表面 · 返回场景2秒", replace: "替换对应模块 · 返回场景3秒", "self-test": "备用自检12秒 · 返回外廊观察",
  takeover: "受控切换到备用 · 返回外廊核对", "isolate-main": "隔离主灯", trial: "受控试机30秒 · 返回观察一圈", restore: "解除隔离 / 恢复自动",
  "isolate-charge": "隔离充电支路", reconnect: "重新接通充电支路", probe: "回充采样 · 返回场景5秒",
  "override-on": "白天受控抑制光敏需求", "override-off": "撤销光敏人工覆盖", "verify-sensor": "光敏复测 · 返回场景5秒"};
const localCommands: Record<string, readonly MaintenanceCommand[]> = {
  control: ["takeover", "isolate-main", "restore", "override-on", "override-off"],
  "lighthouse-drive-hatch": ["inspect", "isolate-main", "diagnose", "replace", "trial", "restore"],
  "lighthouse-beacon-backup": ["self-test", "takeover"],
  "lighthouse-solar-array": ["inspect", "clean"],
  "lighthouse-solar-charger": ["inspect", "isolate-charge", "diagnose", "replace", "reconnect", "probe"],
  "lighthouse-light-sensor": ["inspect", "clean", "verify-sensor"]
};
const tools: Record<LighthouseTool, string> = {meter: "检测工具", cloth: "清洁布", "drive-module": "驱动模块", "charger-module": "充电模块"};
const componentLabels = {drive: "主灯驱动", backup: "备用灯", charger: "充电控制器", solar: "太阳能面板", sensor: "光敏保护面"};

/** Presentation only. Room checks location, reach, pause and session authority for every command. */
export class LighthouseMaintenancePanel {
  private events = new AbortController(); private key = "";
  private buttons: HTMLButtonElement[] = [];
  constructor(private readonly document: Document, command: (command: MaintenanceCommand, tool: LighthouseTool) => void,
    drill: (session: LighthouseDrill) => void) {
    const signal = this.events.signal, actions = document.querySelector("#lighthouse-maintenance-actions")!;
    for (const id of Object.keys(commandLabels) as MaintenanceCommand[]) {
      const button = document.createElement("button"); button.className = "lighthouse-action"; button.dataset.command = id;
      button.textContent = commandLabels[id]; button.hidden = true;
      button.addEventListener("click", () => command(id, this.tool), {signal}); actions.append(button); this.buttons.push(button);
    }
    document.querySelectorAll<HTMLButtonElement>("[data-lighthouse-drill]").forEach(button => button.addEventListener("click", () => {
      drill(button.dataset.lighthouseDrill as LighthouseDrill);
    }, {signal}));
  }
  private get tool() { return this.document.querySelector<HTMLSelectElement>("#lighthouse-tool")!.value as LighthouseTool; }
  render(location: LighthousePanelLocation | undefined, op: LighthouseOperationSnapshot, s: LighthouseMaintenanceSnapshot, force = false) {
    if (!location) {this.key = ""; return;}
    const key = [location, op.hour, op.running, op.testSecondsRemaining, s.source, s.mainIsolated, s.chargeIsolated, s.override,
      s.notice, s.evidence[s.evidence.length - 1]?.id, s.session, s.resolved, s.backupConfirmed, s.outputW, s.selfTestSecondsRemaining].join(":");
    if (!force && key === this.key) return; this.key = key;
    const set = (id: string, text: string) => {this.document.querySelector("#" + id)!.textContent = text;};
    const equipment = lighthouseEquipmentDefinition(location);
    if (equipment) {
      const reading = lighthouseEquipmentReading(equipment.id, op, s);
      set("lighthouse-panel-state", reading.state); set("lighthouse-equipment-status", reading.detail);
    } else {
      set("lighthouse-panel-state", op.running ? op.detectedDemand ? "光敏请求 · 主灯运行" : op.state === "night-running" ? "夜间导航运行" : "局部试灯运行"
        : s.navigationRequired ? s.backupOn ? s.backupConfirmed ? "备用实际接替 · 已现场复验" : "备用实际接替 · 待现场复验" : "导航不可用 · 保留待修并联系支援" : "日间待机");
      set("lighthouse-panel-output", op.running ? "主灯转动 / 单束白光；备用熄灭" : s.backupOn ? "主灯停转熄灭 / 备用白闪，360度临时降级" : "主灯与备用均熄灭");
      set("lighthouse-panel-mode", s.mainIsolated ? s.trial ? "主灯隔离 · 受控试机" : "主灯隔离" : s.override ? "白天光敏人工覆盖 · 待撤销" : "自动值守");
    }
    set("lighthouse-maintenance-session", `${sessionLabels[s.session]}${s.session === "normal" ? " · 本次会话" : s.resolved ? " · 已复验完成，可返回正常值守" : " · 独立会话，进行中"}`);
    set("lighthouse-maintenance-status", `需求：${s.navigationRequired ? "需要导航" : "日间无导航需求"}；实际：${s.source === "main" ? "主灯" : s.source === "backup" ? "备用" : "均未运行"}。${s.backupConfirmed ? "备用实际接替已复验。" : "备用实际接替未复验。"}${s.override ? "光敏人工覆盖尚未撤销。" : ""}`);
    set("lighthouse-parts", `驱动模块 ${s.inventory.drive} 件 / 充电模块 ${s.inventory.charger} 件；现场操作完成才扣件。`);
    set("lighthouse-maintenance-notice", s.notice || "检测结论来自现场操作；旧修订记录保留为历史，不能替代当前复验。");
    set("lighthouse-drill-guide", s.session === "drive" ? "夜间主灯请求与反馈不一致。先到外廊仰望备用灯10活跃秒，核对实际白闪。检修口隔离、检测、匹配模块替换后重新检测；试机观察主灯一圈，再恢复自动。"
      : s.session === "charger" ? "白天支路输出异常。先到塔外观察面板，擦拭后复查；回首层隔离检测，匹配模块替换后重新检测、接通并采样。擦主灯保护面不会修复充电模块。"
      : s.session === "sensor" ? "晴天日程与检测需求不一致。首层受控抑制检测需求，登顶外廊观察保护面、擦拭和复查；回首层撤销覆盖后再登顶用检测工具复测。夜间日程优先。"
      : "可从首层运行面板或记录夹进入固定演练。演练独立计时、用料和记录，退出恢复原值守状态；刷新仍会重新开始本次会话。");
    this.document.querySelector<HTMLElement>("#lighthouse-tool-label")!.hidden = !localCommands[location] || location === "control" || location === "lighthouse-beacon-backup";
    this.document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach(button => {button.hidden = !localCommands[location]?.includes(button.dataset.command as MaintenanceCommand);});
    this.document.querySelector<HTMLElement>("#lighthouse-drills")!.hidden = location !== "control" && location !== "log";
    this.document.querySelectorAll<HTMLButtonElement>("[data-lighthouse-drill]").forEach(button => {
      button.hidden = s.session === "normal" ? button.dataset.lighthouseDrill === "normal" : button.dataset.lighthouseDrill !== "normal";
    });
    const journal = this.document.querySelector("#lighthouse-maintenance-events")!;
    journal.replaceChildren(...s.evidence.slice(-24).reverse().map(event => {
      const item = this.document.createElement("li"); item.dataset.component = event.component; item.dataset.revision = String(event.revision);
      item.textContent = `第${event.day}日 ${lighthouseClockLabel(event.hour)} · ${componentLabels[event.component]} 修订${event.revision}${event.revision !== s.revision[event.component] ? "（变化前）" : ""} · ${event.method}：${event.result}`;
      return item;
    }));
  }
  renderActivity(s: LighthouseMaintenanceSnapshot, near: boolean, viewing: boolean) {
    if (viewing) return;
    const text = s.action ? `${tools[s.action.tool]} · ${commandLabels[s.action.command]} · ${s.action.elapsed.toFixed(1)} / ${s.action.duration}秒。保持站稳并看向设备。`
      : near && s.trial ? `主灯受控试机 · 连续观察 ${s.trialObserved.toFixed(1)} / 10秒${s.mainVerified ? " · 本次修订复验通过，请恢复自动" : "，需实际转动与出光"}`
      : near && s.selfTestSecondsRemaining > 0 && !s.navigationRequired ? `备用自检 · 余 ${s.selfTestSecondsRemaining.toFixed(1)}秒；仰望灯头观察一周期，此记录不作实际接替。`
      : near && s.backupConfirmed ? "备用实际接替已现场复验；可到主灯检修口隔离、检测。临时覆盖仍为降级。"
      : near && s.backupOn && !s.backupConfirmed ? "备用运行中：请在外廊仰望高位灯头，连续看10活跃秒并观察白闪；牌面和自检记录不能替代。" : "";
    if (!text) return;
    const activity = this.document.querySelector<HTMLElement>("#lighthouse-activity")!; activity.hidden = false; activity.textContent = text;
  }
  dispose() { this.events.abort(); this.buttons.forEach(button => button.remove()); this.buttons = []; }
}
