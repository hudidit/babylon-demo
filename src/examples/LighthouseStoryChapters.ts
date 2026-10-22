import type {LighthouseStory, StoryMaterial} from "./LighthouseStory";
import type {StoryWaitPlan} from "./LighthouseStoryWait";
export {LighthouseStoryWait, storyWaitPlan} from "./LighthouseStoryWait";
type View=LighthouseStory["snapshot"];
export interface StoryWaitView {plan:StoryWaitPlan; allowed:boolean; place:string; running:boolean; progress:string;}
export function storyReportDetails(view:View,id:string) {
  const report=view.reports.find(r=>`${r.id}-report`===id);if(!report)return "";
  const control=report.facts.find(f=>f.kind==="control"),comparison=report.facts.find(f=>f.kind==="comparison"),c=report.context;
  const source=c.navigationSource==="main"?"主灯实际运行":c.navigationSource==="backup"?"备用实际接替":c.navigationRequired?"暂无可用导航":"日间待机";
  const readings=[control?.kind==="control"?`主电池 ${control.data.mainWh.toFixed(1)} Wh`:"",comparison?.kind==="comparison"?`太阳能 ${comparison.data.actualWatts.toFixed(1)} W / 按天气与日照估算 ${comparison.data.expectedWatts.toFixed(1)} W`:""].filter(Boolean).join("\n");
  const work=report.id==="arrival"?"已完成首轮读表、保护面复查与主灯观察。":report.id==="solar"?"已完成薄膜清洁、独立复查与新的输入对照。":"接班、输入处置及雨后复查已有记录，交接材料收好。";
  const pending=report.unresolved.map(issue=>issue===c.problems.cover?"保护面污损":issue===c.problems.solar?"太阳能表面污损":"已确认的设备异常");
  return `当时的工作依据\n${c.navigationRequired?"需要导航":"无强制导航需求"} · ${source}\n${readings}\n\n本次做过的工作\n${work}\n\n下一班待办\n${pending.length?pending.join("、")+"仍待处理。":"没有已确认的关键待办。"}${report.id==="handover"?"下一班尚未抵达，钥匙仍由你保管。":""}`;
}
const materials:readonly {id:StoryMaterial;title:string;body:string;after:number}[]=[
  {id:"CL02",title:"雾天的旧值守簿",after:3,body:"十一点四十分，雾。灯在转。面板输入偏低，先记读数，午后再查表面。\n——周"},
  {id:"CL05",title:"册子后面的旧呼号页",after:3,body:"旧呼号保留作历史。现行接送以岸站正式通知为准。\n终端显示的旧标签需要核对，不能据此确认发送者。"},
  {id:"CL06",title:"周师傅的离站清单",after:5,body:"报告写好。钥匙留给接班的人。临走前，台灯记得关。\n\n最后再去看一眼。"}
];
const checkCopy:Record<string,readonly [string,string]>={control:["本日首层读数","首层运行面板 · 重新确认当前读数"],main:["主灯转动与出光","顶层 · 连续30秒、完整一圈及实际出光"],cover:["保护面独立复查","顶层 · 清洁后另做一次确认"],
  fog:["雾中的导航与输入","白天海雾 · 观察实际导航，到首层做天气/输入对照"],cleaned:["薄膜处理已留证","太阳能面板 · 普通巡视2秒或细查5秒，确认后擦拭"],recheck:["太阳能独立复查","面板旁 · 清洁后另做一次现场检查"],comparison:["处理后的输入对照","首层运行面板 · 白天重新对照实际与预期输入"],
  storm:["风雨工作安排","阅读航务提醒、确认本日室内读数，再整理工作顺序"],surface:["雨后表面与输入","室外复查；洁净面板直接检查，无需重复清洁"],handover:["交接材料收好","提交运行情况、已有工作及真实待办，等下一班抵达"]};
export function renderStoryChapter(document:Document,view:View,work:LighthouseStory["fieldWork"],canUseRecords:boolean,wait:StoryWaitView) {
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const text=(id:string,value:string)=>{if(el(id).textContent!==value)el(id).textContent=value;};
  const phase=work.phase,done=phase==="complete",arrival=phase==="arrival",solar=phase==="solar",count=view.tasks.filter(t=>t.status==="complete").length;
  text("story-chapter",`${arrival?"第一章 接班的午后":solar?"第二章 雾中的记录":"第三章 离站前的清单"} / 第${view.calendar.day}日`);
  text("story-goal",done?"交接准备已完成":view.objective.title);
  text("story-next",done?"这几天的工作和待办已经收好，钥匙仍由你保管，实际交接要等下一班抵达。可以再走一遍步道，或在生活记录中留一句话。接下来的故事，待续。"
    :arrival?view.objective.id==="ST01"?"先读完周师傅留下的信，接下这三天值守。":view.objective.id==="ST03"?"到住宅书桌或灯塔首层记录夹旁提交接班报告，再在岸站联络中接收并阅读回复。":"沿步道到首层读表，再上顶层停灯清洁、独立复查，最后试灯并观察30秒。按 M 可查看地图。"
    :solar?view.objective.id==="ST04"?view.elapsedHours<18?"接班记录已经收好。可以继续探索，或回住宅书桌休息到明天的海雾。白天雾起时，观察实际导航，再到首层对照天气、日照和太阳能输入。":"在白天海雾中观察实际导航，再到首层做天气、日照与输入对照。如果错过这个窗口，可回住宅书桌等下一次白天海雾。"
      :view.reports.some(r=>r.id==="solar")?"输入报告已经发给岸站。请到联络页接收并读完回复。":"先确认面板表面，可直接做5秒近距细查。确认污损后擦拭，另做独立复查，再到首层重新对照天气、日照和输入。普通巡视未见异常，仍不能排除细薄污膜。"
    :view.objective.reason+"\n风雨中先做室内工作；太阳能室外擦拭受雨量限制。");
  const steps=arrival?["接下值守","首轮巡视","岸站确认"]:solar?["雾天核对","处置复查","岸站确认"]:["安排工作","雨后复查","收好交接"];
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
  text("story-report",arrival?"提交接班报告":solar?"提交输入变化报告":"收好交接报告");
  el("story-review").hidden=phase!=="handover"||count>=6;el<HTMLButtonElement>("story-review").disabled=!work.canReview||!canUseRecords;
  el("story-solar-note").hidden=!solar||!work.canNote;
  text("story-report-hint",done?"已有工作得到保留，交接尚未正式完成。":submitted?"报告已发出，请在岸站联络中接收并读完回复。"
    :!canUseRecords?"报告与工作安排需在住宅书桌或灯塔首层记录夹旁填写。":solar?view.solarNote?"待查记录已留档；尚未排除的输入变化仍需处理，不能写成已修复。":"报告只引用真实清洁、独立复查和新对照；仍有疑点可先记下，任务继续保留。"
    :phase==="handover"?"交接报告会记录当前运行、本次工作及全部已知关键待办。需要导航时，必须先有实际可用来源。":"三项现场证据需属于当前日序与有效修订。");
  text("story-report-summary",phase==="handover"?`当前运行、已完成${view.reports.length}份工作报告；已知待办：${work.issueLabels.length?work.issueLabels.join("、"):"没有已确认的关键异常"}。`:
    solar&&view.solarNote?`第${Math.floor((view.solarNote.at+12)/24)+1}日：已记录输入与天气依据，结论仍待查。`:"");
  text("story-save-title",`第${view.calendar.day}日的值守`);text("story-save-detail",done?"交接材料已准备，尚待下一班抵达。":view.objective.title);
  el("story-wait").hidden=done&&!wait.plan.recovery;text("story-wait-title",wait.plan.title);
  const target=wait.plan.target,absolute=target===undefined?0:target+12,hour=Math.floor(absolute%24),minute=Math.round((absolute%1)*60);
  text("story-wait-detail",target===undefined?wait.plan.reason:`至第${Math.floor(absolute/24)+1}日 ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} · 预计${(target-view.elapsedHours).toFixed(1)}场景小时\n${wait.plan.reason}`);
  text("story-wait-place",wait.allowed?"已在可等待的记录处":wait.place);
  el<HTMLButtonElement>("story-wait-start").disabled=target===undefined||!wait.allowed;
  text("story-wait-start",wait.plan.recovery?"开始守候回充":"开始等待");
  el("story-wait-start").hidden=wait.running;el("story-wait-cancel").hidden=!wait.running;text("story-wait-progress",wait.progress);
  const list=el("story-life-materials"),key=`${view.id}:${view.materials.map(m=>m.id).join()}:${count>=5?5:count>=3?3:0}`;
  if(list.dataset.key!==key){list.dataset.key=key;list.replaceChildren(...materials.filter(m=>count>=m.after).map(m=>{
    const article=document.createElement("article"),heading=document.createElement("h4"),body=document.createElement("p"),button=document.createElement("button");
    article.className="journal-life-note";heading.textContent=m.title;body.textContent=m.body;button.dataset.storyMaterial=m.id;button.disabled=view.materials.some(v=>v.id===m.id);button.textContent=button.disabled?"已读并收好":"读完这页";article.append(heading,body,button);return article;
  }));}
  text("story-life-empty",count<3?"完成接班后，可以翻阅周师傅留下的其他页。":"可选的生活材料，读不读都不会改变工作资格。");
  el("story-diary").hidden=!done;
  el("story-diary").querySelectorAll<HTMLButtonElement>("[data-story-diary]").forEach(b=>{b.disabled=!!view.diary;b.setAttribute("aria-pressed",String(view.diary?.choice===b.dataset.storyDiary));});
  text("story-diary-result",view.diary?view.diary.choice==="blank"?"这一页留白。工作报告照常保留。":view.diary.choice==="three-days"?"我以为三天会很快。":"现在不用看地图了。":"只写个人感受，不改变设备结论。台灯保持你亲手留下的状态。");
}
