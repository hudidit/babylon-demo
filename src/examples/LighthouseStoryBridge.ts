import type {LighthouseCompleteSession} from "./LighthouseSave";
import type {LighthouseStory, StoryFact} from "./LighthouseStory";
import {lighthouseStoryContext} from "./LighthouseStorySave";
import {lighthouseSolarW} from "./LighthousePower";
import {synchronizeWeatherDuty} from "./LighthouseWeatherSession";

/** Forward newly committed observations only. Restoring a checkpoint never re-labels old equipment events. */
export class LighthouseStoryBridge {
  private cursor: number;
  private maintenanceCursor: number;
  private discoveryCursor: number;
  private nightWatchKey="";
  constructor(readonly story: LighthouseStory, equipment: LighthouseCompleteSession) {
    const events = equipment.inspection.snapshot.events;
    this.cursor = events[events.length - 1]?.id || 0;
    const evidence=equipment.maintenance.snapshot.evidence;
    this.maintenanceCursor=evidence[evidence.length-1]?.id||0;
    this.discoveryCursor=Math.max(0,...equipment.discovery.view("solar").history.map(e=>e.id));
    equipment.weather.useStorySchedule(story.solarProblemId);
    synchronizeWeatherDuty(equipment);
  }
  synchronize(equipment: LighthouseCompleteSession) {
    const c = lighthouseStoryContext(equipment);
    this.story.synchronize(c);
    const watch=this.story.nightWatchKey;
    if(watch&&watch!==this.nightWatchKey) {
      equipment.inspection.renewObservation();equipment.maintenance.renewBackupObservation(equipment.operation.snapshot);
      const events=equipment.inspection.snapshot.events,evidence=equipment.maintenance.snapshot.evidence;
      this.cursor=events[events.length-1]?.id||0;this.maintenanceCursor=evidence[evidence.length-1]?.id||0;
    }
    this.nightWatchKey=watch;
    const i=equipment.inspection.snapshot;
    if (c.problems.solar) this.story.bindSolarProblem(c.problems.solar);
    for (const event of i.events) {
      if (event.id <= this.cursor) continue;
      this.cursor = event.id;
      const at = (event.dutyDay - 1) * 24 + event.hour - 12;
      // All forwarded payloads are captured at the command/frame that committed this event.
      if (at < 0 || Math.abs(at - c.elapsedHours) > 1e-7) continue;
      const common = {source: "inspection" as const, eventId: event.id, at: c.elapsedHours, objectId: event.objectId, method: event.source};
      let fact: StoryFact;
      if (event.type === "control-read") fact = {...common, kind: "control", revision: c.revisions.control, problemId: null,
        data: {mainWh: equipment.power.snapshot.mainWh, solarWatts: equipment.power.snapshot.solarW}};
      else if (event.type === "optic-observed") fact = {...common, kind: "main", revision: c.revisions.main, problemId: null,
        data: {seconds: i.observationSeconds, turns: i.observedTurns, outputSeen: i.outputSeen, weather: c.weather}};
      else if (event.type === "cover-observed" && event.revision === i.coverRevision) fact = {...common, kind: "cover",
        revision: c.revisions.cover, problemId: c.problems.cover, data: {status: i.dirty ? "confirmed" : "clear"}};
      if (fact) this.story.observe(fact);
    }
    for (const event of equipment.maintenance.snapshot.evidence) {
      if(event.id<=this.maintenanceCursor)continue;this.maintenanceCursor=event.id;
      const at=(event.day-1)*24+event.hour-12;
      if(Math.abs(at-c.elapsedHours)>1e-7)continue;
      const common={eventId:event.id,at:c.elapsedHours,revision:c.revisions.solar,problemId:c.problems.solar};
      if(event.component==="solar"&&event.revision===c.revisions.solar) {
        if(event.method==="读数对照")this.story.observe({...common,source:"comparison",kind:"comparison",objectId:"lighthouse-solar-charger",method:"meter-comparison",
          data:{weather:c.weather,daylight:event.hour>=6&&event.hour<18,actualWatts:equipment.power.snapshot.solarW,
            expectedWatts:lighthouseSolarW(event.hour)*equipment.weather.snapshot.weather.solarMultiplier}});
        if(event.method==="擦拭完成"&&c.problems.solar===null) {
          const treatment=[...equipment.weather.snapshot.events].reverse().find(e=>e.component==="solar"&&e.type==="maintained"&&Math.abs(e.hour-c.elapsedHours)<1e-7);
          if(treatment&&treatment.problemId===this.story.solarProblemId)this.story.observe({...common,source:"maintenance",kind:"solar-cleaned",
            objectId:"lighthouse-solar-array",method:"active-action",data:{resolvedProblemId:treatment.problemId}});
        }
      }
      if(event.component==="backup"&&event.method==="实际接替复验") {
        const m=equipment.maintenance.snapshot;
        this.story.observe({source:"maintenance",eventId:event.id,at:c.elapsedHours,revision:c.revisions.backup,problemId:null,
          kind:"backup",objectId:"lighthouse-beacon-backup",method:"direct-view",data:{seconds:m.backupObservationSeconds,flashes:m.backupFlashesSeen?1:0,weather:c.weather}});
      }
    }
    for (const clue of equipment.discovery.view("solar").history) {
      if(clue.id<=this.discoveryCursor)continue;this.discoveryCursor=clue.id;
      if(!clue.valid||Math.abs((clue.day-1)*24+clue.hour-12-c.elapsedHours)>1e-7)continue;
      this.story.observe({source:"discovery",eventId:clue.id,at:c.elapsedHours,kind:"solar-check",objectId:"lighthouse-solar-array",method:clue.method,
        revision:clue.revision,problemId:c.problems.solar,data:{status:clue.status}});
    }
  }
}
