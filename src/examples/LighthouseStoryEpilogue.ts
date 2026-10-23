import type {LighthouseStory} from "./LighthouseStory";
import type {LighthouseStorySession} from "./LighthouseStorySave";

type View=LighthouseStory["snapshot"];
export type EpilogueCommand="stay"|"check"|"finish"|"seen";
export function epilogueCommand(session:LighthouseStorySession,command:EpilogueCommand,canUseRecords:boolean) {
  const story=session.story;
  switch(command) {
    case "stay":return canUseRecords&&story.registerStay();
    case "check":return story.requestSourceCheck();
    case "finish":return story.finishChapter();
    case "seen":return story.snapshot.endingSeen||story.acknowledgeEnding();
    default:return false;
  }
}
function when(at:number) {
  const time=at+12,hour=Math.floor(time%24),minute=Math.floor(time%1*60+1e-7);
  return `第${Math.floor(time/24)+1}日 ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}
/** Quote the retained original, so a later display edit cannot silently change what was forwarded. */
export function sourceCheckDetails(view:View) {
  const original=view.messages.find(m=>m.id==="old-call");
  return original?`转发的原消息\n${when(original.sentAt)} · 显示来源：${original.displaySource}（来源待核验）\n${original.body}`:"";
}
export function endingRecord(view:View) {
  const complete=(index:number)=>view.tasks[index].completion;
  const solar=view.reports.find(r=>r.id==="solar"),handover=view.reports.find(r=>r.id==="handover"),night=complete(8),end=complete(10);
  const comparison=solar?.facts.find(f=>f.kind==="comparison");
  const pending=end?.context.knownCriticalIssues||[];
  const issue=(id:string)=>id===end?.context.problems.cover?"保护面污损待清洁":id===end?.context.problems.solar?"太阳能表面污损待处理":"设备异常待继续检查";
  return {
    at:end?when(end.at):"",
    work:[
      `接班巡视 · ${complete(2)?when(complete(2).at):""}\n首层读数、主灯转动和出光、保护面检查均已记下，岸站已回复。`,
      `面板清洁与复查 · ${solar?when(solar.at):""}\n污膜已擦净，表面重新检查，天气、日照和输入重新对照。${comparison?.kind==="comparison"?`当时输入${comparison.data.actualWatts.toFixed(1)} W，估算${comparison.data.expectedWatts.toFixed(1)} W。`:""}`,
      `交接单 · ${handover?when(handover.at):""}\n灯况、已办的事和下一班待办已收好。接班人还没到，钥匙仍由你保管。`,
      `延班后的夜间导航 · ${night?when(night.at):""}\n${night?.facts[0]?.kind==="backup"?"实际由备用灯接替，已连续观察10秒并看见白闪。主灯仍需继续检查。":`主灯已检查${night?.facts[0]?.kind === "main" ? night.facts[0].data.seconds : 0}秒，转动和出光正常。`}`
    ],
    pending:[pending.length?pending.map(issue).join("、")+"。":"",
      night?.facts[0]?.kind==="backup"&&end?.context.navigationSource!=="main"?"备用灯已确认，主灯仍需检查和恢复。":"",
      end?.context.navigationRequired&&end.context.navigationSource==="none"?"当前没有可用导航，先查供电，让灯恢复工作。":""].filter(Boolean).join("\n")||"收好这一章时，没有已确认但未处理的关键异常。",
    diary:view.diary?.choice==="three-days"?"我以为三天会很快。":view.diary?.choice==="familiar-path"?"现在不用看地图了。":view.diary?.choice==="blank"?"这一页留白。":"你没有留下个人记录。",
    source:`接送延期，新的航次还没定。\n旧呼号消息${view.messages.find(m=>m.id==="old-call")?`（${when(view.messages.find(m=>m.id==="old-call").sentAt)}）`:""}和岸站的核对回复都已留存。岸站没有这条消息的发送记录，发送者仍未查明。`
  };
}
export function renderStoryEpilogue(document:Document,view:View,canUseRecords:boolean) {
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const text=(id:string,value:string)=>{if(el(id).textContent!==value)el(id).textContent=value;};
  const count=view.tasks.filter(t=>t.status==="complete").length,active=count>=7,read=(id:string)=>view.messages.some(m=>m.id===id&&m.state==="read");
  el("story-stay-register").hidden=!active||view.objective.id!=="ST08"||view.transport.status!=="cancelled";
  el<HTMLButtonElement>("story-stay-register").disabled=!canUseRecords||!read("pickup-cancelled");
  el("story-source-check").hidden=view.objective.id!=="ST10"||view.sourceCheck.status!=="not-requested";
  el<HTMLButtonElement>("story-source-check").disabled=!read("old-call");
  el("story-finish").hidden=!view.goalsComplete||view.finished;
  el("story-replay").hidden=!view.finished;el("story-keep").hidden=!view.goalsComplete;
  if(!active)return;
  text("story-chapter",`尾声 留下来的这一班 / 第${view.calendar.day}日`);
  text("story-goal",view.finished?"这一章已收好":view.goalsComplete?"本章的事已记好":view.objective.title);
  const h=view.calendar.hour;
  text("story-next",view.finished?"前三天值守已完成。接送仍然延期，钥匙还在你这里。可以继续停留，也可以翻开结尾和来往记录。"
    :view.goalsComplete?"岸站的核对回复已经留存。旧呼号是谁发来的，还没有查明。可以再留一会儿，回看记录，或在这里结束本章。"
    :view.objective.id==="ST08"?view.transport.status!=="cancelled"?"前三天的交接单收好了。满三天后的中午，岸站会确认接送安排。可以在书桌旁等待，灯站照常运行。"
      :"去岸站联络页读完取消接送的通知，再回书桌或首层记录夹旁登记留站。之前做完的工作都保留，钥匙仍由你保管。"
    :view.objective.id==="ST09"?h>=6&&h<18?"登记好了。等到晚上，再去看这一班的灯。可以回书桌旁等到18点；白天雾里的观察不能代替夜间确认。"
      :"到顶层灯旁按 E 检查大灯，3秒完成，可自由环顾。实际由备用灯接替时，到顶层外廊看备用灯白闪，连续10秒；主灯待办仍要留下。两盏灯都没亮时，先查供电。"
    :view.sourceCheck.status==="pending"?"核对请求发出去了。到岸站联络页接收回复，原消息和发送时间都先留着。"
    :view.sourceCheck.replyId?"岸站的核对回复到了。去联络页读完，原消息和发送时间都留着。":"读完旧呼号来信，再把原文和发送时间转给岸站核对。终端显示的名字还不能证明是谁发来的。");
  const tasks=view.tasks.slice(7),labels=["留站","看灯","核对","收好"];
  el("story-steps").replaceChildren(...tasks.map((task,index)=>{const li=document.createElement("li");li.dataset.state=task.status;li.textContent=(task.status==="complete"?"✓ ":"")+labels[index];return li;}));
  el("story-checks").hidden=true;
  text("story-report-hint",view.objective.id==="ST08"&&view.transport.status==="cancelled"?!read("pickup-cancelled")?"先读完岸站的正式通知。":!canUseRecords?"回住宅书桌或到灯塔首层记录夹旁登记。":"登记留站不会交出钥匙，也不会重置已完成的工作。":"");
  const night=view.tasks[8].completion;
  text("story-report-summary",night?`夜间确认 · ${when(night.at)} · ${night.facts[0].kind==="backup"?"备用白闪正常，主灯待办保留":"主灯转动与出光正常"}`:"前三天值守完成，交接单已保留。接班人尚未到站。");
  text("story-view-radio",view.goalsComplete?"回看值守记录":"打开岸站联络");
  text("story-save-detail",view.finished?"本章已完成，继续留站；旧呼号来源待查。":view.objective.title);
  if(view.finished) {
    const record=endingRecord(view);text("story-ending-meta",`${record.at} · 前三天值守完成`);
    text("story-ending-source",record.source);text("story-ending-pending",record.pending);text("story-ending-diary",record.diary);
    const list=el("story-ending-work"),key=`${view.id}:${view.tasks[10].completion.order}`;
    if(list.dataset.key!==key){list.dataset.key=key;list.replaceChildren(...record.work.map(value=>{const li=document.createElement("li");li.textContent=value;return li;}));}
  }
}
