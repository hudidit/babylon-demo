import type {LighthouseStory,StoryMaterial} from "./LighthouseStory";
import type {LighthouseSaveStatus} from "./LighthouseSave";
import type {StoryWaitView} from "./LighthouseStoryChapters";
import type {EpilogueCommand} from "./LighthouseStoryEpilogue";

type View = LighthouseStory["snapshot"];
type Page = "duty" | "letter" | "radio" | "life" | "save" | "ending";
type Actions = {close: (resume: boolean) => void; start: () => void; resume: () => void; load: () => void;
  save: () => void; leave: () => void; letter: () => void; accept: () => void; report: () => void;
  reply: () => void; read: (id: string) => void; clear: () => void; review:()=>void; note:()=>void;
  material:(id:StoryMaterial)=>void; diary:(choice:"three-days"|"familiar-path"|"blank")=>void; wait:()=>void; cancelWait:()=>void; epilogue:(command:EpilogueCommand)=>boolean};
const letter = "这三天，辛苦你照看灯站。到塔里先在首层读表，再上灯室看转动和出光。保护面容易起盐膜，要擦就等白天停灯以后。擦完别急着走，再看一遍。\n\n起雾的时候，中午也得亮灯。屋里台灯的开关就在手边，自己用着方便就好。满三天后的中午，接送艇过来，下一班也跟着来。\n\n册子后面还留着旧呼号。接送安排听岸站值班的，有变动他们会通知。\n\n周";

const messageTitles: Record<string,string> = {"pickup-plan":"三天后的接送安排", "arrival-report":"发给岸站的接班报告", "arrival-ack":"岸站确认接班", "night-notice":"夜间导航提醒",
  "transport-warning":"外海接送提醒", "pickup-cancelled":"接送航次取消", "solar-report":"面板检查报告", "solar-ack":"岸站收到复查记录", "handover-report":"给下一班的交接单", "stay-registration":"继续留站的登记", "source-check":"发给岸站的核对请求", "old-call":"旧呼号来信", "source-check-reply":"岸站的核对回复"};

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
  constructor(private readonly document: Document, private readonly actions: Actions,
    private readonly feedback: () => void = () => {}) {
    this.dialog = this.el<HTMLDialogElement>("story-panel");
    const signal = this.events.signal;
    const listen = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn, {signal});
    listen("story-return", () => this.page==="ending"?this.back():actions.close(true));
    listen("story-new", () => {this.confirmation(true); this.el("story-new-confirm").focus();});
    listen("story-new-cancel", () => this.dismissConfirmation());
    listen("story-new-confirm", () => {actions.start(); this.confirmation(false); if(this.view)this.selectPage(this.page,true);else this.el("story-new").focus();});
    const continueAtObjective = (load: () => void, fromStorage = false) => {load(); if (this.view && (!fromStorage || this.storageUsable)) this.selectPage(this.view.finished&&!this.view.endingSeen?"ending":this.view.objective.id === "ST01" ? "letter" : this.view.objective.id === "ST03" && this.view.reports.length ? "radio" : "duty", true);};
    listen("story-resume", () => continueAtObjective(actions.resume));
    listen("story-load", () => continueAtObjective(actions.load, true));
    listen("story-cover-continue", () => continueAtObjective(actions.load, true));
    listen("story-save", actions.save); listen("story-leave", actions.leave);
    listen("story-letter-read", actions.letter);
    listen("story-accept", () => {actions.accept(); if (this.view?.tasks[0].status === "complete") this.selectPage("duty", true);});
    listen("story-report", () => {const before=this.view?.reports.length;actions.report();if(this.view?.reports.length>before)this.selectPage("radio",true);});
    listen("story-review",actions.review);listen("story-solar-note",actions.note);listen("story-wait-start",actions.wait);listen("story-wait-cancel",actions.cancelWait);
    listen("story-stay-register",()=>actions.epilogue("stay"));listen("story-source-check",()=>actions.epilogue("check"));
    listen("story-finish",()=>actions.epilogue("finish"));listen("story-replay",()=>this.selectPage("ending",true));
    listen("story-keep",()=>actions.close(true));
    listen("story-ending-stay",()=>{if(this.acknowledgeEnding()){this.selectPage("duty");actions.close(true);}else this.selectPage("save",true);});
    listen("story-ending-records",()=>this.selectPage(this.acknowledgeEnding()?"radio":"save",true));
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
      if (button) this.selectMessage(button.dataset.storySelect!,true);
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
    if(this.view)this.selectPage(this.page,true);else ["story-resume","story-cover-continue","story-new"].map(id=>this.el(id)).find(n=>!n.hidden)!.focus();}
  close() {this.waitDisabled.forEach((disabled,button)=>button.disabled=disabled);this.waitDisabled.clear();this.dialog.close();this.confirmation(false);this.document.body.classList.remove("viewing-story");}
  private confirmation(show:boolean) {this.el("story-new-prompt").hidden=!show;this.dialog.querySelector<HTMLElement>(".journal-cover-copy")!.inert=show;}
  private dismissConfirmation() {this.confirmation(false);this.el("story-new").focus();}
  private acknowledgeEnding() {return !!this.view?.finished&&this.actions.epilogue("seen");}
  private back() {if(!this.el("story-new-prompt").hidden)this.dismissConfirmation();else if(this.page==="ending")this.selectPage(this.acknowledgeEnding()?"duty":"save",true);else this.actions.close(false);}
  notice(text:string) {this.text("story-notice",text);}
  private selectPage(page:Page,focus=false) {
    if(page==="ending"&&!this.view?.finished)return;
    const pages=this.el("story-pages");
    const changed=page!==this.page;
    if(changed){this.scroll[this.page]=pages.scrollTop;this.page=page;}
    this.dialog.querySelectorAll<HTMLButtonElement>("[data-story-page]").forEach(tab=>{
      const selected=tab.dataset.storyPage===(page==="ending"?"duty":page);tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
      this.el("story-page-"+tab.dataset.storyPage).hidden=tab.dataset.storyPage!==page;
    });
    this.el("story-page-ending").hidden=page!=="ending";
    this.el("story-tab-duty").setAttribute("aria-controls",page==="ending"?"story-page-ending":"story-page-duty");
    this.el("story-return").firstChild.textContent=page==="ending"?"返回值守任务":"返回场景";
    if(changed){pages.scrollTop=this.scroll[page]||0;if(this.isOpen)this.feedback();}
    if(focus&&this.isOpen)this.el(page==="ending"?"story-ending-title":"story-tab-"+page).focus({preventScroll:true});
  }
  private selectMessage(id:string,feedback=false) {
    const message=this.view?.messages.find(m=>m.id===id);if(!message)return;
    if(feedback && id!==this.selectedMessage && this.isOpen)this.feedback();
    this.selectedMessage=id;
    this.el("story-messages").querySelectorAll<HTMLButtonElement>("[data-story-select]").forEach(n=>n.setAttribute("aria-current",String(n.dataset.storySelect===id)));
    this.text("story-message-title",messageTitles[id]||(message.direction==="incoming"?"收到的联络":"发出的记录"));
    const time=message.sentAt+12,hour=Math.floor(time%24),minute=Math.floor((time%1)*60+1e-7);
    this.text("story-message-meta",`${message.displaySource}${message.provenance==="unverified-label"?"（来源待核验）":""} / 第${Math.floor(time/24)+1}日 ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} / ${message.state==="unread"?"未读":message.direction==="incoming"?"已读":"已发送"}`);
    const details=this.chapters?.storyReportDetails(this.view,id);
    this.text("story-message-body",(this.chapters?.storyMessageText(this.view,id)||"正在展开这条联络…")+(details?"\n\n"+details:""));
    const button=this.el<HTMLButtonElement>("story-message-read");button.hidden=message.direction!=="incoming";button.disabled=message.state!=="unread"||!this.chapters;
    button.dataset.storyRead=id;button.textContent=message.state==="unread"?"读完这条联络":"已读";
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
    const focused=this.document.activeElement as HTMLElement,hadFocus=this.dialog.contains(focused),previous=this.view,active=!!view;
    this.view=view;
    ["story-ending-stay","story-ending-records"].forEach(id=>this.el<HTMLButtonElement>(id).disabled=!chapters);
    this.storageUsable=status.available&&!status.invalid;
    this.el("story-open").hidden=active;this.el("story-active").hidden=!active;this.el("story-cover").hidden=active;
    this.el("story-resume").hidden=active||!resumable;
    this.el("story-cover-continue").hidden=active||!status.available;
    this.el("story-cover-continue").classList.toggle("journal-primary",!resumable);
    this.el("story-new").classList.toggle("journal-primary",!resumable&&!status.available);
    this.el("story-cover-clear").hidden=!status.invalid;
    this.text("story-cover-status",status.invalid||!status.available?status.message:"");
    this.el<HTMLButtonElement>("story-load").disabled=!status.available;this.el("story-clear").hidden=!status.invalid;
    this.text("story-storage",status.message);
    const objective=this.el<HTMLButtonElement>("story-objective");objective.hidden=!active;
    const title=view?.finished?"本章已完成 · 继续留站":view?.goalsComplete?"这一班的事已记好":view?.objective.title;
    this.text("story-objective-title",active?title:"");
    this.text("story-objective-detail",active?"J 打开值守簿":"");
    objective.setAttribute("aria-label",active?`${title}，打开值守簿`:"值守簿");
    this.el("lighthouse-story-record").hidden=!active;
    if(!view)return;
    if(previous?.id!==view.id){this.selectedMessage=undefined;this.messageKey="";this.selectPage(view.tasks[0].status==="complete"?"duty":"letter");this.el("story-pages").scrollTop=0;}
    if(chapters&&wait)chapters.renderStoryChapter(this.document,view,work,canUseRecords,wait);
    else {
      this.text("story-goal",view.objective.title);this.text("story-next","正在翻开值守簿…");
      ["story-report","story-review","story-solar-note","story-checks","story-wait","story-stay-register","story-source-check","story-finish","story-replay","story-keep"].forEach(id=>this.el(id).hidden=true);
    }
    this.el("story-view-radio").hidden=!view.reports.length;
    const read=view.materials.some(m=>m.id==="CL01");
    this.el<HTMLButtonElement>("story-letter-read").disabled=read;this.text("story-letter-read",read?"交接信已读":"读完交接信");
    this.text("story-letter-stamp",read?"已读":"待读");this.el("story-accept").hidden=view.tasks[0].status==="complete";this.el<HTMLButtonElement>("story-accept").disabled=!read;
    this.el("story-reply").hidden=!view.messages.some(m=>["arrival-report","solar-report","source-check"].includes(m.id)&&m.state==="awaiting-reply");
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
    this.text("story-reading-state",wait?.running?"等待时，灯站照常运行":"阅读时，时间暂停");
    if(this.isOpen&&wait?.running&&this.document.activeElement!==this.el("story-wait-cancel"))this.el("story-wait-cancel").focus({preventScroll:true});
    else if(this.isOpen&&focused&&hadFocus&&(!focused.isConnected||!focused.getClientRects().length||(focused as HTMLButtonElement).disabled)) {
      const next=this.el("story-page-"+this.page).querySelector<HTMLElement>('button:not(:disabled):not([hidden])');
      (next&&next.getClientRects().length?next:this.el(this.page==="ending"?"story-ending-title":"story-tab-"+this.page)).focus({preventScroll:true});
    }
    if(view.finished&&!previous?.finished)this.selectPage("ending",true);
  }
  dispose() {this.events.abort();this.close();this.el("story-objective").hidden=true;}
}
