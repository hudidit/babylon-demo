import type { LighthouseWeatherRisk } from "./LighthouseRisk";
import type { LighthouseOperation } from "./LighthouseOperation";
import type { LighthouseInspection } from "./LighthouseInspection";
import type { LighthouseMaintenance } from "./LighthouseMaintenance";
import type { LighthousePower } from "./LighthousePower";
import type { TimeOfDayAdvance } from "./RoomTimeOfDay";

export interface LighthouseWeatherDuty {
  weather: LighthouseWeatherRisk; operation: LighthouseOperation; inspection: LighthouseInspection;
  maintenance: LighthouseMaintenance; power: LighthousePower;
}
export function synchronizeWeatherDuty(s: LighthouseWeatherDuty) {
  const w=s.weather.snapshot;
  s.maintenance.setWeatherDemand(w.visibility.required);
  s.maintenance.setOutsideWorkAllowed(w.weather.rain<.15);
  s.power.setWeatherSolar(w.weather.solarMultiplier);
  s.power.synchronize(s.operation.snapshot,s.maintenance.snapshot);
  const p=s.power.snapshot;
  s.maintenance.configurePower(p.mainAllowed,p.trialAllowed,p.backupAvailable,s.operation.snapshot,p.exerciseComplete);
  s.maintenance.synchronize(s.operation);s.inspection.synchronize(s.operation.snapshot);
  s.power.synchronize(s.operation.snapshot,s.maintenance.snapshot);
}
/** The production bridge is also exercised directly by model tests. No separate simulation clock. */
export function advanceWeatherDuty(s: LighthouseWeatherDuty, frame: TimeOfDayAdvance, visible=true) {
  s.weather.synchronizeSurface("cover",s.inspection.snapshot.dirty);
  s.weather.synchronizeSurface("solar",s.maintenance.snapshot.solarDirty);
  const start=s.weather.acceptedAutomaticHours;
  if (frame.automaticHours>0) {
    s.weather.advance(frame,interval=>{
      const offset=interval.fromElapsedHours-start, from=frame.fromHour+offset, to=from+interval.hours;
      const last=Math.abs(interval.fromElapsedHours+interval.hours-s.weather.acceptedAutomaticHours)<1e-11;
      const receipt:TimeOfDayAdvance={fromHour:(from%24+24)%24,toHour:last?frame.toHour:(to%24+24)%24,
        activeSeconds:frame.activeSeconds*interval.hours/frame.automaticHours,automaticHours:interval.hours,
        midnightCrossings:Math.floor(to/24)-Math.floor(from/24),manualCompleted:false};
      s.maintenance.setWeatherDemand(interval.lowVisibility);s.maintenance.synchronize(s.operation);
      s.power.setWeatherSolar(interval.solarFrom);
      s.power.advance(receipt,s.operation.snapshot,s.maintenance.snapshot,interval.solarTo);
      const p=s.power.snapshot;s.maintenance.configurePower(p.mainAllowed,p.trialAllowed,p.backupAvailable,s.operation.snapshot,p.exerciseComplete);
      s.maintenance.synchronize(s.operation);s.operation.advance(receipt,visible);
    });
  } else s.operation.advance(frame,visible);
  for (const problem of s.weather.snapshot.problems) if(!problem.origin) {
    if(problem.component==="cover")s.inspection.soilFromWeather(s.operation.snapshot);
    if(problem.component==="solar")s.maintenance.soilFromWeather(s.operation.snapshot,problem.stage==="latent");
  }
  synchronizeWeatherDuty(s);
}
