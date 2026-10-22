import type {LighthouseStory,StoryMaterial} from "./LighthouseStory";
import type {LighthouseSaveStatus} from "./LighthouseSave";
import type {StoryWaitView} from "./LighthouseStoryChapters";

type View = LighthouseStory["snapshot"];
type Page = "duty" | "letter" | "radio" | "life" | "save";
type Actions = {close: (resume: boolean) => void; start: () => void; resume: () => void; load: () => void;
  save: () => void; leave: () => void; letter: () => void; accept: () => void; report: () => void;
  reply: () => void; read: (id: string) => void; clear: () => void; review:()=>void; note:()=>void;
  material:(id:StoryMaterial)=>void; diary:(choice:"three-days"|"familiar-path"|"blank")=>void; wait:()=>void; cancelWait:()=>void};
const letter = "三天，工作不多。到塔里先看首层读数，再上去看转动和出光。保护面如果有盐膜，等白天停灯再擦，擦完记得再看一次。\n\n有些时候，中午也要确认灯亮着，遇到雾就明白了。屋里桌灯的开关在手边。三天后的中午，下一班跟接送艇一起过来。\n\n旧联络呼号还留在册子后面，现在接送都按岸站值班的正式通知走。\n\n周";

const messageTitles: Record<string,string> = {"pickup-plan":"三天后的接送安排", "arrival-report":"你提交的接班报告", "arrival-ack":"岸站确认接班", "night-notice":"夜间导航提醒",
  "transport-warning":"外海接送提醒", "pickup-cancelled":"接送航次取消", "solar-report":"输入变化报告", "solar-ack":"岸站收到复查记录", "old-call":"旧呼号来信", "source-check-reply":"正式来源核对"};

/** A field journal presents committed game state; changing pages never performs work or reads a message. */
export class LighthouseStoryPanel {
  private readonly dialog: HTMLDialogElement;
  private readonly events = new AbortController();
  private view?: View;
  private page: Page = "duty";
  private selectedMessage?: string;
  private storageUsable = false;
  private messageKey = "";
  private chapters?:typeof import("./LighthouseStoryChapters");
  private readonly scroll: Partial<Record<Page,number>> = {};
  private readonly waitDisabled = new Map<HTMLButtonElement,boolean>();
  constructor(private readonly document: Document, private readonly actions: Actions) {
    this.dialog = this.el<HTMLDialogElement>("story-panel");
    const signal = this.events.signal;
    const listen = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn, {signal});
    listen("story-return", () => actions.close(true));
    listen("story-new", () => {this.confirmation(true); this.el("story-new-confirm").focus();});
    listen("story-new-cancel", () => this.dismissConfirmation());
    listen("story-new-confirm", () => {actions.start(); this.confirmation(false); if(this.view)this.selectPage(this.page,true);else this.el("story-new").focus();});
    const continueAtObjective = (load: () => void, fromStorage = false) => {load(); if (this.view && (!fromStorage || this.storageUsable)) this.selectPage(this.view.objective.id === "ST01" ? "letter" : this.view.objective.id === "ST03" && this.view.reports.length ? "radio" : "duty", true);};
    listen("story-resume", () => continueAtObjective(actions.resume));
    listen("story-load", () => continueAtObjective(actions.load, true));
    listen("story-cover-continue", () => continueAtObjective(actions.load, true));
    listen("story-save", actions.save); listen("story-leave", actions.leave);
    listen("story-letter-read", actions.letter);
    listen("story-accept", () => {actions.accept(); if (this.view?.tasks[0].status === "complete") this.selectPage("duty", true);});
    listen("story-report", () => {const before=this.view?.reports.length;actions.report();if(this.view?.reports.length>before)this.selectPage("radio",true);});
    listen("story-review",actions.review);listen("story-solar-note",actions.note);listen("story-wait-start",actions.wait);listen("story-wait-cancel",actions.cancelWait);
    this.el("story-page-life").addEventListener("click",event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if(button?.dataset.storyMaterial)actions.material(button.dataset.storyMaterial as StoryMaterial);
      if(button?.dataset.storyDiary)actions.diary(button.dataset.storyDiary as "three-days"|"familiar-path"|"blank");
      if(button&&!button.isConnected)this.el("story-tab-life").focus();
    },{signal});
    listen("story-reply", actions.reply); listen("story-clear", actions.clear); listen("story-cover-clear", actions.clear);
    listen("story-view-letter", () => this.selectPage("letter", true));
    listen("story-view-radio", () => this.selectPage("radio", true));
    this.el("story-letter-text").textContent = letter;
    const tabs = Array.from(this.dialog.querySelectorAll<HTMLButtonElement>("[data-story-page]"));
    tabs.forEach(tab => tab.addEventListener("click", () => this.selectPage(tab.dataset.storyPage as Page), {signal}));
    this.el("story-messages").addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-story-select]");
      if (button) this.selectMessage(button.dataset.storySelect!);
    }, {signal});
    listen("story-message-read", () => {if (!this.selectedMessage) return; actions.read(this.selectedMessage);
      this.el("story-messages").querySelector<HTMLButtonElement>(`[data-story-select="${this.selectedMessage}"]`)?.focus({preventScroll:true});});
    this.dialog.addEventListener("cancel", event => {event.preventDefault(); this.back();}, {signal});
    this.dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); this.back(); return;}
      const tab = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-story-page]");
      if (tab && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const offset = ["ArrowLeft","ArrowUp"].includes(event.key) ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : (tabs.indexOf(tab)+offset+tabs.length)%tabs.length;
        this.selectPage(tabs[next].dataset.storyPage as Page, true); return;
      }
      if (event.key === "Tab") {
        const root=this.el("story-new-prompt").hidden?this.dialog:this.el("story-new-prompt");
        const controls=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')).filter(n=>n.getClientRects().length>0);
        const first=controls[0],last=controls[controls.length-1];
        if (event.shiftKey && this.document.activeElement === first || !event.shiftKey && this.document.activeElement === last) {event.preventDefault(); (event.shiftKey ? last : first)?.focus();}
      }
    }, {signal});
    this.dialog.addEventListener("wheel", event => event.stopPropagation(), {signal, passive: true});
    const narrow = document.defaultView.matchMedia("(max-width: 700px)");
    const orientation = () => {this.dialog.querySelector('[role="tablist"]')!.setAttribute("aria-orientation",narrow.matches?"horizontal":"vertical");this.revealMessage();};
    narrow.addEventListener("change",orientation,{signal}); orientation();
  }
  private el<T extends HTMLElement = HTMLElement>(id: string) {return this.document.getElementById(id) as T;}
  private text(id:string,value:string) {const n=this.el(id);if(n.textContent!==value)n.textContent=value;}
  get isOpen() {return this.dialog.open;}
  open() {this.dialog.showModal(); this.document.body.classList.add("viewing-story");
    if(this.view)this.el("story-tab-"+this.page).focus();else ["story-resume","story-cover-continue","story-new"].map(id=>this.el(id)).find(n=>!n.hidden)!.focus();}
  close() {this.waitDisabled.forEach((disabled,button)=>button.disabled=disabled);this.waitDisabled.clear();this.dialog.close();this.confirmation(false);this.document.body.classList.remove("viewing-story");}
  private confirmation(show:boolean) {this.el("story-new-prompt").hidden=!show;this.dialog.querySelector<HTMLElement>(".journal-cover-copy")!.inert=show;}
  private dismissConfirmation() {this.confirmation(false);this.el("story-new").focus();}
  private back() {if(!this.el("story-new-prompt").hidden)this.dismissConfirmation();else this.actions.close(false);}
  notice(text:string) {this.text("story-notice",text);}
  private selectPage(page:Page,focus=false) {
    const pages=this.el("story-pages");
    const changed=page!==this.page;
    if(changed){this.scroll[this.page]=pages.scrollTop;this.page=page;}
    this.dialog.querySelectorAll<HTMLButtonElement>("[data-story-page]").forEach(tab=>{
      const selected=tab.dataset.storyPage===page;tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
      this.el("story-page-"+tab.dataset.storyPage).hidden=!selected;
    });
    if(changed)pages.scrollTop=this.scroll[page]||0;
    if(focus&&this.isOpen)this.el("story-tab-"+page).focus({preventScroll:true});
  }
  private selectMessage(id:string) {
    const message=this.view?.messages.find(m=>m.id===id);if(!message)return;
    this.selectedMessage=id;
    this.el("story-messages").querySelectorAll<HTMLButtonElement>("[data-story-select]").forEach(n=>n.setAttribute("aria-current",String(n.dataset.storySelect===id)));
    this.text("story-message-title",messageTitles[id]||(message.direction==="incoming"?"收到的联络":"发出的记录"));
    const time=message.sentAt+12,hour=Math.floor(time%24),minute=Math.floor((time%1)*60+1e-7);
    this.text("story-message-meta",`${message.displaySource} / 第${Math.floor(time/24)+1}日 ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} / ${message.state==="unread"?"未读":message.direction==="incoming"?"已读":"已发送"}`);
    const details=this.chapters?.storyReportDetails(this.view,id);
    this.text("story-message-body",message.body+(details?"\n\n"+details:""));
    const button=this.el<HTMLButtonElement>("story-message-read");button.hidden=message.direction!=="incoming";button.disabled=message.state!=="unread";
    button.dataset.storyRead=id;button.textContent=message.state==="unread"?"读完并留档":"已读并留档";
    this.el("story-message-empty").hidden=true;
    this.revealMessage();
  }
  private revealMessage() {
    const list=this.el("story-messages"),selected=list.querySelector('[aria-current="true"]');
    if(!selected||list.scrollWidth<=list.clientWidth)return;
    const bounds=list.getBoundingClientRect(),item=selected.getBoundingClientRect();
    if(item.left<bounds.left)list.scrollLeft+=item.left-bounds.left;
    else if(item.right>bounds.right)list.scrollLeft+=item.right-bounds.right;
  }
  render(view:View|undefined,work:LighthouseStory["fieldWork"]|undefined,status:LighthouseSaveStatus,resumable:boolean,canUseRecords:boolean,
    chapters?:typeof import("./LighthouseStoryChapters"),wait?:StoryWaitView) {
    this.waitDisabled.forEach((disabled,button)=>button.disabled=disabled);this.waitDisabled.clear();
    this.chapters=chapters;
    const focused=this.document.activeElement as HTMLElement,hadFocus=this.dialog.contains(focused),previous=this.view,active=!!view,done=active&&view.tasks[6].status==="complete";
    this.view=view;
    this.storageUsable=status.available&&!status.invalid;
    this.el("story-open").hidden=active;this.el("story-active").hidden=!active;this.el("story-cover").hidden=active;
    this.el("story-resume").hidden=active||!resumable;
    this.el("story-cover-continue").hidden=active||!status.available;
    this.el("story-cover-continue").classList.toggle("journal-primary",!resumable);
    this.el("story-new").classList.toggle("journal-primary",!resumable&&!status.available);
    this.el("story-cover-clear").hidden=!status.invalid;
    this.text("story-cover-status",status.invalid||!status.available?status.message:"");
    this.el<HTMLButtonElement>("story-load").disabled=!status.available;this.el("story-clear").hidden=!status.invalid;
    this.text("story-storage",status.message.startsWith("故事已保存")?"故事已保存。下次继续时，时间会先暂停。":status.message);
    const objective=this.el<HTMLButtonElement>("story-objective");objective.hidden=!active;
    this.text("story-objective-title",active?done?"交接准备已完成":view.objective.title:"");
    this.text("story-objective-detail",active?done?"交接记录已留档":"值守任务 · J 打开值守簿":"");
    objective.setAttribute("aria-label",active?`${done?"交接准备已完成":view.objective.title}，打开值守簿`:"值守簿");
    this.el("lighthouse-story-record").hidden=!active;
    if(!view)return;
    if(previous?.id!==view.id){this.selectedMessage=undefined;this.messageKey="";this.selectPage(view.tasks[0].status==="complete"?"duty":"letter");this.el("story-pages").scrollTop=0;}
    if(chapters&&wait)chapters.renderStoryChapter(this.document,view,work,canUseRecords,wait);
    else {
      this.text("story-goal",view.objective.title);this.text("story-next","正在展开值守记录…");
      ["story-report","story-review","story-solar-note","story-checks","story-wait"].forEach(id=>this.el(id).hidden=true);
    }
    this.el("story-view-radio").hidden=!view.reports.length;
    const read=view.materials.some(m=>m.id==="CL01");
    this.el<HTMLButtonElement>("story-letter-read").disabled=read;this.text("story-letter-read",read?"交接信已读":"读完交接信");
    this.text("story-letter-stamp",read?"已读":"待读");this.el("story-accept").hidden=view.tasks[0].status==="complete";this.el<HTMLButtonElement>("story-accept").disabled=!read;
    this.el("story-reply").hidden=!view.messages.some(m=>["arrival-report","solar-report"].includes(m.id)&&m.state==="awaiting-reply");
    const unread=view.messages.filter(m=>m.state==="unread").length;
    this.el("story-unread").hidden=!unread;this.text("story-unread",String(unread));this.el("story-unread").setAttribute("aria-label",`${unread}条未读联络`);
    const messageKey=view.messages.map(m=>m.id+":"+m.state).join("|");
    if(messageKey!==this.messageKey){
      if(this.page==="radio"&&previous&&view.messages.length>previous.messages.length)this.selectedMessage=[...view.messages].reverse().find(m=>m.direction==="incoming")?.id;
      this.messageKey=messageKey;
      this.el("story-messages").replaceChildren(...view.messages.map(message=>{const button=this.document.createElement("button"),title=this.document.createElement("strong"),meta=this.document.createElement("small");button.className="journal-message"+(message.state==="unread"?" is-unread":"");button.dataset.storySelect=message.id;title.textContent=messageTitles[message.id]||(message.direction==="incoming"?"收到的联络":"发出的记录");meta.textContent=message.state==="unread"?"未读":message.direction==="incoming"?"已读":"已发送";button.append(title,meta);return button;}));
    }
    const selected=view.messages.find(m=>m.id===this.selectedMessage)||view.messages.find(m=>m.state==="unread")||view.messages[0];
    if(selected)this.selectMessage(selected.id);else this.el("story-message-empty").hidden=false;
    this.selectPage(this.page);
    if(wait?.running)this.dialog.querySelectorAll<HTMLButtonElement>("button").forEach(button=>{
      if(button.id==="story-wait-cancel")return;this.waitDisabled.set(button,button.disabled);button.disabled=true;
    });
    this.text("story-reading-state",wait?.running?"等待中，设备继续值守":"阅读时，值守暂停");
    if(this.isOpen&&wait?.running&&this.document.activeElement!==this.el("story-wait-cancel"))this.el("story-wait-cancel").focus({preventScroll:true});
    else if(this.isOpen&&focused&&hadFocus&&(!focused.isConnected||!focused.getClientRects().length||(focused as HTMLButtonElement).disabled)) {
      const next=this.el("story-page-"+this.page).querySelector<HTMLElement>('button:not(:disabled):not([hidden])');
      (next&&next.getClientRects().length?next:this.el("story-tab-"+this.page)).focus({preventScroll:true});
    }
  }
  dispose() {this.events.abort();this.close();this.el("story-objective").hidden=true;}
}
