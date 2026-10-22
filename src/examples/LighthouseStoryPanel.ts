import type {LighthouseStory} from "./LighthouseStory";
import type {LighthouseSaveStatus} from "./LighthouseSave";

type View = LighthouseStory["snapshot"];
type Actions = {close: (resume: boolean) => void; start: () => void; resume: () => void; load: () => void;
  save: () => void; leave: () => void; letter: () => void; accept: () => void; report: () => void;
  reply: () => void; read: (id: string) => void; clear: () => void};
const letter = "三天，工作不多。到塔里先看首层读数，再上去看转动和出光。保护面如果有盐膜，等白天停灯再擦，擦完记得再看一次。\n\n有些时候，中午也要确认灯亮着，遇到雾就明白了。屋里桌灯的开关在手边。三天后的中午，下一班跟接送艇一起过来。\n\n旧联络呼号还留在册子后面，现在接送都按岸站值班的正式通知走。\n\n周";

/** Paper and radio UI. Every command is checked by the scene and the story model. */
export class LighthouseStoryPanel {
  private readonly dialog: HTMLDialogElement;
  private readonly events = new AbortController();
  constructor(private readonly document: Document, actions: Actions) {
    this.dialog = this.el<HTMLDialogElement>("story-panel");
    const signal = this.events.signal;
    const listen = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn, {signal});
    listen("story-return", () => actions.close(true));
    listen("story-new", () => {this.el("story-new-confirm").hidden = false; this.el("story-new-warning").hidden = false; this.el("story-new-confirm").focus();});
    listen("story-new-confirm", () => {actions.start(); this.el("story-new-confirm").hidden = this.el("story-new-warning").hidden = true;});
    listen("story-resume", actions.resume); listen("story-load", actions.load); listen("story-save", actions.save);
    listen("story-leave", actions.leave); listen("story-letter-read", actions.letter); listen("story-accept", actions.accept);
    listen("story-report", actions.report); listen("story-reply", actions.reply); listen("story-clear", actions.clear);
    this.el("story-letter-text").textContent = letter;
    this.el("story-messages").addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-story-read]");
      if (button) actions.read(button.dataset.storyRead!);
    }, {signal});
    this.dialog.addEventListener("cancel", event => {event.preventDefault(); actions.close(false);}, {signal});
    // Escape must not also leave first person after the dialog has released its pause.
    this.dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); actions.close(false);}
    }, {signal});
    this.dialog.addEventListener("wheel", event => event.stopPropagation(), {signal, passive: true});
  }
  private el<T extends HTMLElement = HTMLElement>(id: string) {return this.document.getElementById(id) as T;}
  get isOpen() {return this.dialog.open;}
  open() {this.dialog.showModal(); this.dialog.scrollTop = 0; this.el("story-return").focus();}
  close() {this.dialog.close();}
  notice(text: string) {this.el("story-notice").textContent = text;}
  render(view: View | undefined, checks: LighthouseStory["arrivalChecks"] | undefined, status: LighthouseSaveStatus,
    resumable: boolean, canReport: boolean) {
    const active = !!view, done = active && view.tasks[2].status === "complete";
    this.el("story-open").hidden = active;
    if (active) this.el("story-new-confirm").hidden = this.el("story-new-warning").hidden = true;
    this.el("story-active").hidden = !active;
    this.el("story-new").hidden = active;
    this.el("story-resume").hidden = active || !resumable;
    this.el("story-save").hidden = this.el("story-leave").hidden = !active;
    this.el<HTMLButtonElement>("story-load").disabled = !status.available;
    this.el("story-clear").hidden = !status.invalid;
    this.el("story-storage").textContent = status.message;
    const objective = this.el<HTMLButtonElement>("story-objective");
    objective.hidden = !active;
    objective.textContent = active ? done ? "✓ 第一章已完成 · 查看接班记录" : `第一章 · ${view.objective.title} · 查看` : "";
    this.el("lighthouse-story-record").hidden = !active;
    if (!view || !this.isOpen) return;
    this.el("story-chapter").textContent = `第一章 · 接班的午后 · 第${view.calendar.day}日`;
    this.el("story-goal").textContent = done ? "已接班 · 岸站已确认你的第一轮巡视" : view.objective.title;
    this.el("story-next").textContent = done ? "第一章已完成并保留工作成果。后续章节正在制作，可继续探索或保存故事后返回探索。"
      : "按 M 查看地图：从住宅入户门沿步道到灯塔。首层读表，垂直梯到顶层；先停灯清洁和复查，再试灯观察30秒。完成后在书桌或首层记录夹提交报告。";
    const read = view.materials.some(m => m.id === "CL01");
    this.el<HTMLButtonElement>("story-letter-read").disabled = read;
    this.el("story-letter-read").textContent = read ? "交接信已读，可随时重读" : "读完交接信";
    this.el("story-accept").hidden = view.tasks[0].status === "complete";
    this.el<HTMLButtonElement>("story-accept").disabled = !read;
    this.el("story-checks").replaceChildren(...([ ["control", "首层读数"], ["cover", "顶层保护面 · 必要清洁后独立复查"], ["main", "顶层主灯 · 连续30秒、一圈和出光"] ] as const).map(([id, label]) => {
      const row = this.document.createElement("li"); row.textContent = `${checks[id] ? "✓ 已确认" : "○ 待现场确认"} · ${label}`; return row;
    }));
    const submitted = view.reports.some(r => r.id === "arrival");
    this.el("story-report").hidden = submitted || view.tasks[0].status !== "complete";
    this.el<HTMLButtonElement>("story-report").disabled = !canReport;
    this.el("story-report-hint").textContent = submitted ? "接班报告已留档，岸站回复可在下方接收、阅读和回看。"
      : "三项证据需属于当前日序和设备状态；到住宅书桌或灯塔首层记录夹旁提交。";
    this.el("story-reply").hidden = !view.messages.some(m => m.id === "arrival-report" && m.state === "awaiting-reply");
    const focus = (this.document.activeElement as HTMLElement)?.dataset.storyRead;
    this.el("story-messages").replaceChildren(...view.messages.map(message => {
      const article = this.document.createElement("article"), title = this.document.createElement("h4"), body = this.document.createElement("p");
      const time = message.sentAt + 12, hour = Math.floor(time % 24), minute = Math.floor((time % 1) * 60 + 1e-7);
      title.textContent = `${message.displaySource} · 第${Math.floor(time / 24) + 1}日 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} · ${message.state === "unread" ? "未读" : message.direction === "incoming" ? "已读" : "已发送"}`;
      body.textContent = message.body; article.append(title, body);
      if (message.direction === "incoming") {const button = this.document.createElement("button"); button.dataset.storyRead = message.id;
        button.textContent = message.state === "unread" ? "阅读这条联络" : "已读 · 原文已保留"; button.disabled = message.state !== "unread"; article.append(button);}
      return article;
    }));
    if (focus) this.el("story-messages").querySelector<HTMLButtonElement>(`[data-story-read="${focus}"]`)?.focus({preventScroll: true});
  }
  dispose() {this.events.abort(); this.close(); this.el("story-objective").hidden = true;}
}
