import { RoomTimeOfDay } from "./RoomTimeOfDay";
import { LighthouseOperation } from "./LighthouseOperation";
import { LighthouseInspection } from "./LighthouseInspection";
import { LighthouseMaintenance } from "./LighthouseMaintenance";
import { LighthousePower } from "./LighthousePower";
import { LighthouseWeatherRisk, LIGHTHOUSE_RISK_RULES, LIGHTHOUSE_CURRENT_REMEDIES } from "./LighthouseRisk";
import { LighthouseDiscovery } from "./LighthouseDiscovery";
import { lighthouseDiscoveryFacts } from "./LighthouseWeatherSession";
import { saveObject, saveEnum, saveHour } from "./LighthouseSaveValidation";

// Keep the existing normal key: its value is atomically upgraded, never silently discarded.
export const LIGHTHOUSE_SAVE_KEY = "babylon-lighthouse-duty-v1";
export const LIGHTHOUSE_EXERCISE_SAVE_KEY = "babylon-lighthouse-exercise-v2";
export type LighthouseSessionMode = "duty" | "exercise";
export interface LighthouseSession {
  clock: RoomTimeOfDay; operation: LighthouseOperation; inspection: LighthouseInspection; maintenance: LighthouseMaintenance; power: LighthousePower;
  weather?: LighthouseWeatherRisk; discovery?: LighthouseDiscovery; mode?: LighthouseSessionMode;
}
export interface LighthouseCompleteSession extends LighthouseSession {weather:LighthouseWeatherRisk;discovery:LighthouseDiscovery;mode:LighthouseSessionMode;}
export interface LighthouseSaveStatus {available: boolean; invalid: boolean; message: string;}
type SlotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const unchecked = (value: unknown) => value;
const MAX_SLOT_LENGTH = 524288;
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export function completeLighthouseSession(s:LighthouseSession,mode:LighthouseSessionMode="duty",seed?:number):LighthouseCompleteSession {
  if(s.weather||s.discovery){if(!s.weather||!s.discovery)throw new Error("Incomplete weather session");return {...s,weather:s.weather,discovery:s.discovery,mode};}
  const weather=new LighthouseWeatherRisk({seed:seed??freshSeed()}),discovery=new LighthouseDiscovery(()=>weather.drawInformation("inspection"));
  weather.synchronizeSurface("cover",s.inspection.snapshot.dirty);weather.synchronizeSurface("solar",s.maintenance.snapshot.solarDirty);
  discovery.synchronize(lighthouseDiscoveryFacts({...s,weather}),0,null);
  return {...s,weather,discovery,mode};
}
/** Validate into new pure models before any live reference or storage is replaced. Reads never draw randomness. */
export function decodeLighthouseSave(raw: string): LighthouseSession {
  if (typeof raw !== "string" || raw.length > MAX_SLOT_LENGTH) throw new Error("Invalid duty slot size");
  const parsed=JSON.parse(raw),version=parsed?.version;
  const base={version:saveEnum(1,2),hour:saveHour,operation:unchecked,inspection:unchecked,maintenance:unchecked,power:unchecked};
  const s = saveObject(version===2?{...base,mode:saveEnum("duty","exercise"),weather:unchecked,discovery:unchecked,maintenanceWeather:unchecked}:base)(parsed);
  const operation=LighthouseOperation.fromSave(s.operation),inspection=LighthouseInspection.fromSave(s.inspection);
  if(s.hour!==operation.snapshot.hour||inspection.snapshot.dutyDay!==operation.snapshot.dutyDay)throw new Error("Inconsistent saved calendar");
  const maintenance=LighthouseMaintenance.fromSave(s.maintenance,operation.snapshot);
  const weather=version===2?LighthouseWeatherRisk.fromState(s.weather):undefined;
  if(weather){
    if(JSON.stringify(weather.snapshot.rules)!==JSON.stringify(LIGHTHOUSE_RISK_RULES)
      ||JSON.stringify(weather.snapshot.remedies)!==JSON.stringify(LIGHTHOUSE_CURRENT_REMEDIES))throw new Error("Unsupported player risk pool");
    maintenance.restoreWeatherState(s.maintenanceWeather,operation.snapshot);
    maintenance.setWeatherDemand(weather.snapshot.visibility.required);maintenance.setOutsideWorkAllowed(weather.snapshot.weather.rain<.15);
  }
  const power=LighthousePower.fromSave(s.power,operation.snapshot,maintenance.snapshot);
  if(weather)power.setWeatherSolar(weather.snapshot.weather.solarMultiplier);
  const before=operation.snapshot,backupRevision=maintenance.snapshot.revision.backup,source=maintenance.snapshot.source;
  power.synchronize(before,maintenance.snapshot);
  maintenance.configurePower(power.snapshot.mainAllowed,power.snapshot.trialAllowed,power.snapshot.backupAvailable,before,power.snapshot.exerciseComplete);
  maintenance.synchronize(operation);power.synchronize(operation.snapshot,maintenance.snapshot);
  if(before.available!==operation.snapshot.available||before.detectedDemand!==operation.snapshot.detectedDemand
    ||maintenance.snapshot.revision.backup!==backupRevision||source!==maintenance.snapshot.source)throw new Error("Inconsistent saved equipment");
  if(weather&&[ [operation.exportState().events,s.operation.events], [maintenance.snapshot.evidence,s.maintenance.evidence],
    [power.exportState().events,s.power.events] ].some(([actual,saved])=>JSON.stringify(actual)!==JSON.stringify(saved)))throw new Error("Restore would append equipment events");
  if(weather&&maintenance.snapshot.navigationRequired!==s.maintenance.lastRequired)throw new Error("Inconsistent saved navigation request");
  const clock=new RoomTimeOfDay();clock.restore(s.hour);
  if(!weather)return {clock,operation,inspection,maintenance,power};
  const discovery=LighthouseDiscovery.fromState(s.discovery,()=>weather.drawInformation("inspection"));
  const duty={weather,operation,inspection,maintenance,power},facts=lighthouseDiscoveryFacts(duty),w=weather.snapshot;
  if(s.discovery.elapsedHours!==weather.acceptedAutomaticHours
    ||["cover","solar"].some(c=>!!w.problems.find(p=>p.component===c)!==(c==="cover"?inspection.snapshot.dirty:maintenance.snapshot.solarDirty))
    ||maintenance.snapshot.solarLatent!==(w.problems.find(p=>p.component==="solar")?.stage==="latent")
    ||s.maintenanceWeather.loggedSurfaceClues.some(id=>id>=s.discovery.nextId)
    ||s.discovery.entries.some(e=>{
      const f=facts.find(f=>f.target===e.target);
      return e.day>operation.snapshot.dutyDay||e.revision>f.revision
        ||w.problems.some(p=>p.id===e.problemId&&p.component!==e.target)
        ||e.problemId!==`clean-${e.target}`&&(!/^weather-problem-[1-9]\d*$/.test(e.problemId)||Number(e.problemId.slice(16))>=s.weather.nextProblem)
        ||e.problemId===f.problemId&&e.revision===f.revision&&((f.stage==="clear")!==(e.status==="clear"));
    }))throw new Error("Inconsistent saved weather/knowledge");
  discovery.synchronize(facts,weather.acceptedAutomaticHours,null);
  return {clock,operation,inspection,maintenance,power,weather,discovery,mode:s.mode};
}
/** Base-only callers retain the historical V1 fixture codec; all player writes complete to V2 below. */
export function encodeLighthouseSave(s: LighthouseSession) {
  if(s.clock.playback.transitioning)throw new Error("Wait for the time transition before saving");
  const operation=s.operation.exportState(),full=!!s.weather&&!!s.discovery;
  if(!!s.weather!==!!s.discovery)throw new Error("Incomplete weather session");
  if(!full&&s.maintenance.transientWeatherDemand)operation.detectedDemand=s.maintenance.snapshot.sensorDirty&&!s.maintenance.snapshot.override;
  const raw=JSON.stringify({version:full?2:1,hour:s.clock.snapshot.hour,operation,inspection:s.inspection.exportState(),
    maintenance:s.maintenance.exportState(),power:s.power.exportState(),...(full?{mode:s.mode??"duty",weather:s.weather.exportState(),
      discovery:s.discovery.exportState(),maintenanceWeather:s.maintenance.exportWeatherState()}: {})});
  decodeLighthouseSave(raw);return raw;
}
const timeLabel=(hour:number)=>`${String(Math.floor(hour)).padStart(2,"0")}:${String(Math.floor(hour*60+1e-7)%60).padStart(2,"0")}`;
/** Two independent, explicit slots. Migration must commit before its new session is applied. */
export class LighthouseSave {
  constructor(private readonly storage:()=>SlotStorage=()=>window.localStorage,readonly mode:LighthouseSessionMode="duty",private readonly seed:()=>number=freshSeed) {}
  private get key(){return this.mode==="duty"?LIGHTHOUSE_SAVE_KEY:LIGHTHOUSE_EXERCISE_SAVE_KEY;}
  private decode(raw:string){const s=decodeLighthouseSave(raw);if(s.mode&&s.mode!==this.mode||s.weather?.storyScheduled)throw new Error("Wrong slot mode");return s;}
  inspect():LighthouseSaveStatus {
    try{
      const raw=this.storage().getItem(this.key);if(raw===null)return {available:false,invalid:false,message:this.mode==="duty"?"尚未保存 · 保存后可从这里继续值守":"演练尚未保存 · 与正常值守独立"};
      try{const s=this.decode(raw);return {available:true,invalid:false,message:`${this.mode==="duty"?"值守":"演练"}存档 · 第${s.operation.snapshot.dutyDay}日 ${timeLabel(s.clock.snapshot.hour)}${s.weather?"":" · 继续时升级旧存档"}`};}
      catch{return {available:false,invalid:true,message:"旧存档损坏或版本不支持，已保留；可继续当前游戏或清除旧存档。"};}
    }catch{return {available:false,invalid:false,message:"无法读取本地存档，本次游戏仍可继续。"};}
  }
  save(session:LighthouseSession):LighthouseSaveStatus {
    try{
      const store=this.storage(),previous=store.getItem(this.key);if(previous!==null){try{this.decode(previous);}catch{return this.inspect();}}
      if(session.mode&&session.mode!==this.mode||session.weather?.storyScheduled)throw new Error("Wrong session mode");
      const full=session.weather?completeLighthouseSession(session,this.mode,0):completeLighthouseSession(decodeLighthouseSave(encodeLighthouseSave(session)),this.mode,this.seed());
      const raw=encodeLighthouseSave(full);store.setItem(this.key,raw);
      return {...this.inspect(),message:`${this.mode==="duty"?"值守":"独立演练"}已保存 · 天气和线索完整保留，继续后先暂停`};
    }catch{return {...this.inspect(),message:"保存失败（存储受限、空间不足或时间正在切换），当前值守保持，请稍后重试。"};}
  }
  load():{session?:LighthouseCompleteSession;status:LighthouseSaveStatus} {
    try{
      const store=this.storage(),raw=store.getItem(this.key);if(raw===null)return {status:this.inspect()};
      const s=this.decode(raw);let session:LighthouseCompleteSession;
      if(!s.weather){
        session=completeLighthouseSession(s,this.mode,this.seed());const upgraded=encodeLighthouseSave(session);
        try{store.setItem(this.key,upgraded);}catch{return {status:{...this.inspect(),message:"旧存档升级未能保存，本次尚未继续；原数据和当前会话保持。"}};}
      }else session=s as LighthouseCompleteSession;
      return {session,status:{available:true,invalid:false,message:`${this.mode==="duty"?"已继续值守":"已继续独立演练"} · 天气、随机和线索已恢复，时间暂停，请从T菜单开启自动流转`}};
    }catch{return {status:this.inspect()};}
  }
  clearInvalid():LighthouseSaveStatus {
    const status=this.inspect();if(!status.invalid)return status;
    try{this.storage().removeItem(this.key);return this.inspect();}catch{return {...status,message:"未能清除旧存档；数据已保留，当前游戏仍可继续。"};}
  }
}
