import type {LighthouseStory, StoryMaterial} from "./LighthouseStory";
import type {StoryWaitPlan} from "./LighthouseStoryWait";
import {renderStoryEpilogue,sourceCheckDetails} from "./LighthouseStoryEpilogue";
export {epilogueCommand} from "./LighthouseStoryEpilogue";
export {LighthouseStoryWait, storyWaitPlan} from "./LighthouseStoryWait";
type View=LighthouseStory["snapshot"];
export interface StoryWaitView {plan:StoryWaitPlan; allowed:boolean; place:string; running:boolean; progress:string;}
/** Present stable message IDs in the current voice; never rewrite saved originals or their validation. */
export function storyMessageText(view:View,id:string) {
  const message=view.messages.find(m=>m.id===id);if(!message)return "";
  const day=Math.floor((message.sentAt+12)/24)+1;
  switch(id) {
    case "pickup-plan":return "海角灯站，接送先定在第4日中午12点，正好满三天。艇到工作码头接你，下一班随艇上岛。有变动会再通知。\n\n工作码头在生活区以外。你现在可以沿屋外步道往返灯塔。";
    case "arrival-report":return `第${day}日，接班。首层读数记下了，主灯转动和出光都看过，保护面也检查过了。`;
    case "arrival-ack":return message.sentAt<18?"接班记录收到了。明天可能起雾，白天也留意一下灯。第三天晚上把交接单理好，满三天后的中午，艇来接你。"
      :`第${day}日的接班记录收到了。雾里白天也得亮灯，记得去看一眼。接送还是按簿上原来的安排，有变动我再通知。`;
    case "night-notice":return "天黑了。有空可以上塔看看灯，检查结果照常记在簿上。";
    case "transport-warning":return "接送还要再看看外海的浪。岛边雨停了，外海的涌浪也未必退。你先把交接单准备好，航次定了我再联系你。";
    case "solar-report":return `第${day}日，太阳能面板的污膜已清理，擦完又检查了一遍。天气和日照也重新对照了，复查后的读数附在下面。`;
    case "solar-ack":return "读数看到了。你查过哪儿、怎么处理的，下一班翻开簿子就明白。复查结果也一起留着。";
    case "handover-report":return "交接单已收好。下一班还没到，钥匙先由我保管。";
    case "pickup-cancelled": {
      const r=view.reports.find(r=>r.id==="handover"),prepared=r&&r.order<message.order&&r.at<=message.sentAt;
      return `海角灯站，原定接你的航次取消了。外海的涌浪还没退，艇靠不了工作码头，下一班也过不去。${prepared?"交接单收到了，先放在你那里。":"交接单还没整理完的话，接着记，前面做过的工作照常保留。"}\n\n请先留站，接送有消息我再通知。岛上的生活补给够用。`;
    }
    case "stay-registration":return `第${day}日，收到接送取消的通知。我继续留站值守，钥匙仍在我这里，等新的接送安排。`;
    case "old-call":return "海角站，继续值守。收到请回答。\n\n终端标着“岸站旧呼号”。还没有核实是谁发来的。";
    case "source-check":return "收到一条标着旧呼号的消息，原文和发送时间一并转来。麻烦查一下，是你们发的吗？\n\n"+sourceCheckDetails(view);
    case "source-check-reply":return "接送取消的通知是我发的。你刚转来的这条，我们这里没有发送记录。\n原文和时间先留着，别删。我继续查。";
    default:return message.body;
  }
}
export function storyReportDetails(view:View,id:string) {
  const report=view.reports.find(r=>`${r.id}-report`===id);if(!report)return "";
  const control=report.facts.find(f=>f.kind==="control"),comparison=report.facts.find(f=>f.kind==="comparison"),c=report.context;
  const source=c.navigationSource==="main"?c.navigationRequired?"当时需要亮灯，主灯正在转动出光。":"日间试灯，主灯正在转动出光。":c.navigationSource==="backup"?"当时由备用灯接替导航。":c.navigationRequired?"当时需要亮灯，主灯和备用灯都未能提供导航。":"白天，灯处于待机状态。";
  const readings=[control?.kind==="control"?`主电池余电：${control.data.mainWh.toFixed(1)} Wh`:"",comparison?.kind==="comparison"?`太阳能输入：${comparison.data.actualWatts.toFixed(1)} W\n按当时天气和日照估算：${comparison.data.expectedWatts.toFixed(1)} W`:control?.kind==="control"?`太阳能输入：${control.data.solarWatts.toFixed(1)} W`:""].filter(Boolean).join("\n");
  const work=report.id==="arrival"?"首层读过表；保护面已检查，表面洁净；主灯看完一圈，转动和出光都正常。":report.id==="solar"?"面板上的污膜已擦净，随后又检查了一遍，回首层重新对照了天气、日照和输入读数。":"接班检查、面板清洁和雨后复查都记在簿上。";
  const pending=report.unresolved.map(issue=>issue===c.problems.cover?"保护面污损":issue===c.problems.solar?"太阳能表面污损":"已确认的设备异常");
  return `当时的灯和电\n${source}\n${readings}\n\n已办的事\n${work}\n\n留给下一班\n${pending.length?pending.join("、")+"还没处理好，请接着检查。":"这次没查出还要接着处理的问题。"}${report.id==="handover"?"\n下一班到站后，再当面交钥匙。":""}`;
}
const materials:readonly {id:StoryMaterial;title:string;body:string;after:number}[]=[
  {id:"CL02",title:"雾天的旧值守簿",after:3,body:"十一点四十分，雾还没散，灯在转。太阳能输入有点低，读数先记下，午后再去看看面板。\n\n周"},
  {id:"CL05",title:"册子后面的旧呼号页",after:3,body:"旧呼号，留底。\n\n接送安排听岸站值班的通知。终端上还留着旧名字，真收到消息，要问清楚是谁发的。"},
  {id:"CL06",title:"周师傅的离站清单",after:5,body:"报告写好。钥匙留给接班的人。临走前，台灯记得关。\n\n最后再去看一眼。"}
];
const checkCopy:Record<string,readonly [string,string]>={control:["今天的读数","首层运行面板 · 读表并记下"],main:["灯转得怎样","顶层灯室 · 白天先在灯座开启60秒试灯，再原地看灯具整体30秒，确认转完一圈、见过出光"],cover:["擦完再看一遍","顶层保护面 · 清洁后重新检查"],
  fog:["雾里的灯和读数","白天起雾时看灯，再到首层对照天气与太阳能输入"],cleaned:["擦去面板上的污膜","先巡视2秒或近距细查5秒，确认污损后再擦拭"],recheck:["面板擦净了吗","面板旁 · 擦完后，再检查一遍"],comparison:["再读一次输入","首层运行面板 · 白天对照天气、日照与输入读数"],
  storm:["先把室内工作做好","读岸站的接送提醒，记下今天的读数，再安排工作"],surface:["雨停后去看面板","查完表面再对照输入；已经干净就不用再擦"],handover:["理好交接单","写下灯和电的情况、已办的事，以及下一班要接着做的事"]};
export function renderStoryChapter(document:Document,view:View,work:LighthouseStory["fieldWork"],canUseRecords:boolean,wait:StoryWaitView) {
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const text=(id:string,value:string)=>{if(el(id).textContent!==value)el(id).textContent=value;};
  const phase=work.phase,done=phase==="complete",arrival=phase==="arrival",solar=phase==="solar",count=view.tasks.filter(t=>t.status==="complete").length;
  text("story-chapter",`${arrival?"第一章 接班的午后":solar?"第二章 雾中的记录":"第三章 离站前的清单"} / 第${view.calendar.day}日`);
  text("story-goal",done?"交接单已收好":view.objective.title);
  text("story-next",done?"交接单收好了。下一班还没到，钥匙先由你保管。可以去岛上走走，也可以在这里留一句话。\n故事暂时到这里，记得保存记录。"
    :arrival?view.objective.id==="ST01"?"读读周师傅留下的信，看看这三天要照看的事。":view.objective.id==="ST03"?"回住宅书桌或到灯塔首层记录夹旁，发出接班报告，再看看岸站的回复。":"沿步道到灯塔，先在首层读表。白天停灯时擦净顶层保护面，再检查一遍。然后点击灯座旁的试灯控制，选择“试灯，回场景看灯”，开启60秒试灯；原地看灯具整体30秒，确认转完一圈、见过出光即可，不用追着光束移动。找路可按 M 看地图。"
    :solar?view.objective.id==="ST04"?view.elapsedHours<18?"接班的事办好了。可以在岛上走走，或回书桌旁休息，等明早雾起。到时去看看灯，再到首层对照天气、日照和太阳能输入。":"白天起雾时，先看看是主灯还是备用灯在亮，再到首层对照天气、日照和输入。雾已经散了，就回书桌旁等下一次。"
      :view.reports.some(r=>r.id==="solar")?"报告发出去了，到岸站联络页看看回复。":"去面板旁近距细查5秒。看见污膜就擦掉，擦完再查一次，然后回首层重新对照输入。匆匆看一眼，薄薄的污膜可能看不出来。"
    :view.objective.reason+"\n雨大时先做室内工作，面板等雨小了再擦。");
  const steps=arrival?["接下值守","首轮巡视","岸站确认"]:solar?["雾里看灯","清洁再查","岸站确认"]:["安排工作","雨后复查","收好交接单"];
  const states=arrival?view.tasks.slice(0,3).map(t=>t.status):solar?[count>=4?"complete":"active",work.canReport||view.reports.some(r=>r.id==="solar")?"complete":count>=4?"active":"locked",count>=5?"complete":view.reports.some(r=>r.id==="solar")?"active":"locked"]
    :[count>=6?"complete":"active",done||work.canReport?"complete":count>=6?"active":"locked",done?"complete":"locked"];
  el("story-steps").setAttribute("aria-label","当前章节进度");
  el("story-steps").replaceChildren(...steps.map((label,n)=>{const li=document.createElement("li");li.dataset.state=states[n];li.textContent=(states[n]==="complete"?"✓ ":"")+label;return li;}));
  el("story-checks").hidden=count===0||done;
  el("story-checks").replaceChildren(...work.checks.map(check=>{
    const row=document.createElement("li"),icon=document.createElement("span"),copy=document.createElement("span"),title=document.createElement("strong"),detail=document.createElement("small"),state=document.createElement("span");
    row.dataset.state=check.complete?"complete":"pending";icon.className="journal-check-icon";icon.textContent=check.complete?"✓":"○";icon.setAttribute("aria-hidden","true");copy.className="journal-check-copy";
    const wording=checkCopy[check.id];title.textContent=wording[0];detail.textContent=wording[1];copy.append(title,detail);state.className="journal-check-state";state.textContent=check.complete?"已确认":"待确认";row.append(icon,copy,state);return row;
  }));
  el("story-view-letter").hidden=count>0;
  const submitted=view.reports.some(r=>r.id===work.kind);
  el("story-report").hidden=done||submitted||count===0;el<HTMLButtonElement>("story-report").disabled=!work.canReport||!canUseRecords;
  text("story-report",arrival?"发出接班报告":solar?"发出面板检查报告":"收好交接单");
  el("story-review").hidden=phase!=="handover"||count>=6;el<HTMLButtonElement>("story-review").disabled=!work.canReview||!canUseRecords;
  el("story-solar-note").hidden=!solar||!work.canNote;
  text("story-report-hint",done?"等下一班到了，再把灯站交给他们。":submitted?"报告发出去了，去岸站联络页看看回复。"
    :!canUseRecords?"回住宅书桌或到灯塔首层记录夹旁，就能填写报告和工作安排。":solar?view.solarNote?"疑点已经记下。输入为什么偏低还没查清，接着检查面板吧。":"擦完面板，再查一次表面、对照一次读数，才能发报告。还没查清的也可以先记下来。"
    :phase==="handover"?"把当前灯况、已办的事和没处理完的问题都写上。夜间或雾中，要先确认有灯在亮。":"今天的读数、灯和保护面都查过，才能发报告。设备有变化时要重查。");
  text("story-report-summary",phase==="handover"?`已留${view.reports.length}份工作报告。还要接着办的事：${work.issueLabels.length?work.issueLabels.join("、"):"暂未查出问题"}。`:
    solar&&view.solarNote?`第${Math.floor((view.solarNote.at+12)/24)+1}日：天气和输入读数记下了，原因还没查清。`:"");
  text("story-save-title",`第${view.calendar.day}日的值守`);text("story-save-detail",done?"交接单已收好，等下一班上岛。":view.objective.title);
  el("story-wait").hidden=done&&wait.plan.target===undefined&&!wait.plan.recovery;text("story-wait-title",wait.plan.title);
  const target=wait.plan.target,absolute=target===undefined?0:target+12,hour=Math.floor(absolute%24),minute=Math.round((absolute%1)*60);
  text("story-wait-detail",target===undefined?wait.plan.reason:`至第${Math.floor(absolute/24)+1}日 ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} · 还需${(target-view.elapsedHours).toFixed(1)}小时（岛上时间）\n${wait.plan.reason}`);
  text("story-wait-place",wait.allowed?"可以在这里等一会儿":wait.place);
  el<HTMLButtonElement>("story-wait-start").disabled=target===undefined||!wait.allowed;
  text("story-wait-start",wait.plan.recovery?"守候充电":"开始等待");
  el("story-wait-start").hidden=wait.running;el("story-wait-cancel").hidden=!wait.running;text("story-wait-progress",wait.progress);
  const list=el("story-life-materials"),key=`${view.id}:${view.materials.map(m=>m.id).join()}:${count>=5?5:count>=3?3:0}`;
  if(list.dataset.key!==key){list.dataset.key=key;list.replaceChildren(...materials.filter(m=>count>=m.after).map(m=>{
    const article=document.createElement("article"),heading=document.createElement("h4"),body=document.createElement("p"),button=document.createElement("button");
    article.className="journal-life-note";heading.textContent=m.title;body.textContent=m.body;button.dataset.storyMaterial=m.id;button.disabled=view.materials.some(v=>v.id===m.id);button.textContent=button.disabled?"已读并收好":"读完这页";article.append(heading,body,button);return article;
  }));}
  text("story-life-empty",count<3?"先忙接班的事，办好后再翻翻这些旧页。":"几页旧记录。有空就翻翻，不影响手头的工作。");
  el("story-diary").hidden=!done;
  el("story-diary").querySelectorAll<HTMLButtonElement>("[data-story-diary]").forEach(b=>{b.disabled=!!view.diary;b.setAttribute("aria-pressed",String(view.diary?.choice===b.dataset.storyDiary));});
  text("story-diary-result",view.diary?view.diary.choice==="blank"?"这一页留白。":view.diary.choice==="three-days"?"我以为三天会很快。":"现在不用看地图了。":"想留句话就写在这里，也可以让这一页空着。台灯开不开，由你。");
  renderStoryEpilogue(document,view,canUseRecords);
}
