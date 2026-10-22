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
  if(m.action||p.action||e.inspection.snapshot.cleaning)return blocked("先做完或停下手头的操作，再等。");
  if(recovery) {
    if(p.recoveryReady)return blocked("电量已回升，到电池柜确认恢复供电。");
    if(!p.protected&&!p.warning)return blocked("电量足够，现在不用等充电。");
    if(m.solarDirty&&w.rain<.15)return blocked("先检查并擦净太阳能面板，再回来等充电。");
    return {title:"守候回充",target:at+24,reason:"灯站照常运行。电量回升、雨小到能擦面板，或设备有新情况时会停下。期间如果灯灭了，也会记在簿上。",recovery};
  }
  if(m.navigationRequired&&m.source==="none")return blocked("现在没有灯能提供导航，先查供电。低电时可到电池柜旁等充电。");
  if(p.protected||p.warning)return blocked("电量偏低，先查电池和太阳能。也可到电池柜旁等充电。");
  let target:number,title:string;
  if(v.objective.id==="ST04"&&(at<18||w.kind!=="fog"||h<6||h>=18||!e.weather.snapshot.visibility.required)) {
    target=w.kind==="fog"&&h>=6&&h<17?Math.max(at+.5,18.5):nextFog(at+EPS);title=at<18?"休息到明早":"等下一场白天的雾";}
  else if(v.objective.id==="ST06"&&at<42) {target=42.5;title="等第3日的岸站消息";}
  else if(["ST04","ST05","ST07"].includes(v.objective.id)&&(w.rain>=.15||w.kind==="storm"||h<6||h>=18)) {target=nextDry(at);title="等白天风雨小一些";}
  else return blocked(v.tasks[6].status==="complete"?"交接单收好了，可以保存记录，再去岛上走走。":"手头还有能做的事，先看看值守任务和设备记录。");
  return {target,title,reason:"等待时，岛上时间照常过去，天气和电量也会变化。电量低或出现新问题会停下；看灯、检查面板仍要亲自去。",recovery};
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
  reason="灯站照常运行，正在等待…";
  constructor(readonly session:LighthouseStorySession,private readonly bridge:LighthouseStoryBridge,readonly plan:StoryWaitPlan) {
    if(plan.target===undefined||plan.target<=session.story.snapshot.elapsedHours)throw new Error("No future story wait target");
    const e=session.equipment;this.from=session.story.snapshot.elapsedHours;this.automatic=e.clock.playback.automatic;
    this.source=e.maintenance.snapshot.source;this.revisions=this.surfaceRevision();this.protected=e.power.snapshot.protected;this.warning=e.power.snapshot.warning;
    this.lastSource=this.source;this.lastRequired=e.maintenance.snapshot.navigationRequired;
    e.clock.setAutomatic(true);e.clock.advance(0);
  }
  private surfaceRevision() {const e=this.session.equipment;return `${e.inspection.snapshot.coverRevision}:${e.maintenance.snapshot.revision.solar}`;}
  cancel(reason="等待已停止。时间已经过去，设备按现在的状态继续运行。") {
    if(!this.running)return;this.running=false;this.reason=reason;this.session.equipment.clock.setAutomatic(this.automatic);
  }
  batch(steps=120) {
    const e=this.session.equipment;
    for(let n=0;n<steps&&this.running;n++) {
      advanceStoryUnobserved(this.session,this.bridge,Math.min(.1,Math.max(0,(this.plan.target-e.weather.acceptedAutomaticHours)*60)));
      const at=e.weather.acceptedAutomaticHours,m=e.maintenance.snapshot,p=e.power.snapshot;
      if(this.plan.recovery&&(p.recoveryReady||!p.protected&&p.mainFraction>=.3))this.cancel("电量回升了，到电池柜看看，确认是否可以恢复供电。");
      else if(this.plan.recovery&&(p.protected&&!this.protected||m.navigationRequired&&m.source==="none"&&(!this.lastRequired||this.lastSource!=="none")))this.cancel("灯况或电量有变化，先看看记录。确认情况后可以接着等充电。");
      else if(this.plan.recovery&&m.solarDirty&&e.weather.snapshot.weather.rain<.15)this.cancel("雨小了，可以去查查、擦擦面板，办完再回来等充电。");
      else if(this.surfaceRevision()!==this.revisions)this.cancel("表面有新变化，先去看一眼。刚才等待的时间已经过去。");
      else if(!this.plan.recovery&&(p.protected!==this.protected||p.warning&&!this.warning||m.navigationRequired&&m.source==="none"||this.source==="main"&&m.source==="backup"))this.cancel("电量或灯况有变化，先停在这里。请去看看电池和灯。");
      else if(at>=this.plan.target-EPS)this.cancel(this.plan.recovery?"等了一天了，看看日照、输入和电池，再决定下一步。":"时间到了，回现场看看吧。");
      this.lastSource=m.source;this.lastRequired=m.navigationRequired;
    }
    return this.running;
  }
}
