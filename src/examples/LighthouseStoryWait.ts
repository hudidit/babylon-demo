import type {LighthouseStorySession} from "./LighthouseStorySave";
import type {LighthouseStoryBridge} from "./LighthouseStoryBridge";
import {advanceWeatherDuty, lighthouseDiscoveryFacts, synchronizeWeatherDuty} from "./LighthouseWeatherSession";

export interface StoryWaitPlan {target?:number; title:string; reason:string; recovery:boolean;}
const EPS=1e-7;
function nextFog(at:number) {return at<18.5?18.5:66.5+Math.max(0,Math.ceil((at-66.5)/24))*24;}
function nextDry(at:number) {
  if(at<26.5)return 26.5;if(at<48.5)return 48.5;
  const day=60+Math.max(0,Math.floor((at-60)/24))*24;
  return at<day+6?day+6.5:at<day+18?Math.min(at+.5,day+17.5):day+30.5;
}
/** Location permission is owned by Room; this pure plan explains equipment and task constraints. */
export function storyWaitPlan(s:LighthouseStorySession,recovery=false):StoryWaitPlan {
  const e=s.equipment,v=s.story.snapshot,at=v.elapsedHours,h=v.calendar.hour,m=e.maintenance.snapshot,p=e.power.snapshot,w=e.weather.snapshot.weather;
  const blocked=(reason:string):StoryWaitPlan=>({title:recovery?"守候回充":"等待下一时段",reason,recovery});
  if(m.action||p.action||e.inspection.snapshot.cleaning)return blocked("先结束或中断当前设备动作，再开始等待。");
  if(recovery) {
    if(p.recoveryReady)return blocked("回充已达到复验条件，请在电池柜完成主电池恢复复验。");
    if(!p.protected&&!p.warning)return blocked("电池当前无需守候回充。");
    if(m.solarDirty&&w.rain<.15)return blocked("先到太阳能面板细查并清除污损，再守候实际回充。");
    return {title:"守候回充",target:at+24,reason:"设备继续运行；到达恢复条件、可清洁窗口或新的关键状态时停下。导航中断仍如实入账。",recovery};
  }
  if(m.navigationRequired&&m.source==="none")return blocked("当前没有可用导航，先处理供电；电池柜可选择守候回充。");
  if(p.protected||p.warning)return blocked("当前电量需要处理，请先核对电池和太阳能；电池柜可守候回充。");
  let target:number,title:string;
  if(v.objective.id==="ST04"&&(at<18||w.kind!=="fog"||h<6||h>=18||!e.weather.snapshot.visibility.required)) {
    target=w.kind==="fog"&&h>=6&&h<17?Math.max(at+.5,18.5):nextFog(at+EPS);title="休息到白天海雾";}
  else if(v.objective.id==="ST06"&&at<42) {target=42.5;title="休息到第3日联络";}
  else if(["ST04","ST05","ST07"].includes(v.objective.id)&&(w.rain>=.15||w.kind==="storm"||h<6||h>=18)) {target=nextDry(at);title="等到白天作业窗口";}
  else return blocked(v.tasks[6].status==="complete"?"交接准备已留档，可以保存记录或继续在岛上停留。":"当前目标已有可执行的现场工作，请先查看任务与设备记录。");
  return {target,title,reason:"等待会结算真实日序、天气和能量；遇到低电或新异常会提前停下，现场观察不会自动完成。",recovery};
}

/** The same bounded shared-clock receipt as ordinary automatic play; no direct time selection or large fake frame. */
export function advanceStoryUnobserved(s:LighthouseStorySession,bridge:LighthouseStoryBridge,delta=.1) {
  const e=s.equipment,before=e.operation.snapshot;
  e.clock.advance(delta);
  advanceWeatherDuty(e,e.clock.lastAdvance);
  e.maintenance.advance(e.clock.lastAdvance,e.operation,{action:false,backup:false,main:false,mainOutput:0});
  e.inspection.advance(e.clock.lastAdvance,before,e.operation.snapshot,{optic:false,cover:false,output:0});
  e.weather.synchronizeSurface("cover",e.inspection.snapshot.dirty);e.weather.synchronizeSurface("solar",e.maintenance.snapshot.solarDirty);
  synchronizeWeatherDuty(e);e.discovery.synchronize(lighthouseDiscoveryFacts(e),e.weather.acceptedAutomaticHours,[]);
  bridge.synchronize(e);
}

/** Batches are resumable in memory. Cancelling keeps all accepted hours and restores the player's clock switch. */
export class LighthouseStoryWait {
  readonly from:number;
  private readonly automatic:boolean;
  private readonly source:string;
  private readonly revisions:string;
  private readonly protected:boolean;
  private readonly warning:boolean;
  private lastSource:string;
  private lastRequired:boolean;
  running=true;
  reason="正在结算值守时间…";
  constructor(readonly session:LighthouseStorySession,private readonly bridge:LighthouseStoryBridge,readonly plan:StoryWaitPlan) {
    if(plan.target===undefined||plan.target<=session.story.snapshot.elapsedHours)throw new Error("No future story wait target");
    const e=session.equipment;this.from=session.story.snapshot.elapsedHours;this.automatic=e.clock.playback.automatic;
    this.source=e.maintenance.snapshot.source;this.revisions=this.surfaceRevision();this.protected=e.power.snapshot.protected;this.warning=e.power.snapshot.warning;
    this.lastSource=this.source;this.lastRequired=e.maintenance.snapshot.navigationRequired;
    e.clock.setAutomatic(true);e.clock.advance(0);
  }
  private surfaceRevision() {const e=this.session.equipment;return `${e.inspection.snapshot.coverRevision}:${e.maintenance.snapshot.revision.solar}`;}
  cancel(reason="已停止等待，已经过的值守时间和设备状态保留。") {
    if(!this.running)return;this.running=false;this.reason=reason;this.session.equipment.clock.setAutomatic(this.automatic);
  }
  batch(steps=120) {
    const e=this.session.equipment;
    for(let n=0;n<steps&&this.running;n++) {
      advanceStoryUnobserved(this.session,this.bridge,Math.min(.1,Math.max(0,(this.plan.target-e.weather.acceptedAutomaticHours)*60)));
      const at=e.weather.acceptedAutomaticHours,m=e.maintenance.snapshot,p=e.power.snapshot;
      if(this.plan.recovery&&(p.recoveryReady||!p.protected&&p.mainFraction>=.3))this.cancel("回充已达到处理条件，请核对电池读数并完成必要复验。");
      else if(this.plan.recovery&&(p.protected&&!this.protected||m.navigationRequired&&m.source==="none"&&(!this.lastRequired||this.lastSource!=="none")))this.cancel("导航或低电状态出现新变化，请先核对记录；回充守候可以在确认后继续。");
      else if(this.plan.recovery&&m.solarDirty&&e.weather.snapshot.weather.rain<.15)this.cancel("天气已允许检查和清洁太阳能面板，先处理表面再继续回充。");
      else if(this.surfaceRevision()!==this.revisions)this.cancel("出现新的表面变化，请查看记录并安排检查；已接受时间保留。");
      else if(!this.plan.recovery&&(p.protected!==this.protected||p.warning&&!this.warning||m.navigationRequired&&m.source==="none"||this.source==="main"&&m.source==="backup"))this.cancel("供电或导航状态需要确认，等待已停；请核对电池和实际导航。");
      else if(at>=this.plan.target-EPS)this.cancel(this.plan.recovery?"已守候一天，请核对日照、输入与电池状态后安排下一步。":"已到目标时段，请返回现场完成本轮工作。");
      this.lastSource=m.source;this.lastRequired=m.navigationRequired;
    }
    return this.running;
  }
}
