import type {LighthouseCompleteSession} from "./LighthouseSave";
import type {LighthouseStory, StoryFact} from "./LighthouseStory";
import {lighthouseStoryContext} from "./LighthouseStorySave";

/** Forward newly committed observations only. Restoring a checkpoint never re-labels old equipment events. */
export class LighthouseStoryBridge {
  private cursor: number;
  constructor(readonly story: LighthouseStory, equipment: LighthouseCompleteSession) {
    const events = equipment.inspection.snapshot.events;
    this.cursor = events[events.length - 1]?.id || 0;
  }
  synchronize(equipment: LighthouseCompleteSession) {
    const c = lighthouseStoryContext(equipment), i = equipment.inspection.snapshot;
    this.story.synchronize(c);
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
  }
}
