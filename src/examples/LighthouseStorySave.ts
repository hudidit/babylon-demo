import {LighthouseStory} from "./LighthouseStory";
import type {StoryContext} from "./LighthouseStory";
import {completeLighthouseSession, decodeLighthouseSave, encodeLighthouseSave} from "./LighthouseSave";
import type {LighthouseCompleteSession, LighthouseSaveStatus} from "./LighthouseSave";
import {RoomTimeOfDay} from "./RoomTimeOfDay";
import {LighthouseOperation} from "./LighthouseOperation";
import {LighthouseInspection} from "./LighthouseInspection";
import {LighthouseMaintenance} from "./LighthouseMaintenance";
import {LighthousePower} from "./LighthousePower";
import {synchronizeWeatherDuty, lighthouseDiscoveryFacts} from "./LighthouseWeatherSession";
import {saveEnum, saveObject} from "./LighthouseSaveValidation";

export const LIGHTHOUSE_STORY_SAVE_KEY = "babylon-lighthouse-story-v1";
export interface LighthouseStorySession {mode: "story"; story: LighthouseStory; equipment: LighthouseCompleteSession;}
type StoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const MAX_STORY_SLOT_LENGTH = 1048576;
const EPS = 1e-7;

/** Read-only bindings shared by checkpoint validation and the live scene bridge. */
export function lighthouseStoryContext(equipment: LighthouseCompleteSession): StoryContext {
  const {inspection, maintenance, power, weather, discovery} = equipment;
  const i = inspection.snapshot, m = maintenance.snapshot, p = power.snapshot, w = weather.snapshot, r = m.revision;
  const surfaces = lighthouseDiscoveryFacts(equipment);
  const problem = (target: "cover" | "solar") => surfaces.find(f => f.target === target).stage === "clear" ? null : surfaces.find(f => f.target === target).problemId;
  const cover = problem("cover"), solar = problem("solar"), knownCriticalIssues: string[] = [];
  if (cover && i.checks["check-cover"] === "dirty") knownCriticalIssues.push(cover);
  if (solar && discovery.view("solar").latest?.status === "confirmed") knownCriticalIssues.push(solar);
  if (m.driveFault) knownCriticalIssues.push("drive-fault");
  if (m.chargerFault) knownCriticalIssues.push("charger-fault");
  if (m.sensorDirty) knownCriticalIssues.push("sensor-dirty");
  return {elapsedHours: weather.acceptedAutomaticHours,
    revisions: {control: r.drive + r.charger + r.solar + r.sensor + p.revision,
      main: r.drive + r.sensor + i.coverRevision + p.revision, backup: r.backup + p.revision, cover: i.coverRevision, solar: r.solar},
    problems: {cover, solar}, weather: w.weather.kind, navigationRequired: m.navigationRequired, navigationSource: m.source,
    outsideWorkAllowed: w.weather.rain < .15, actionInProgress: !!m.action || !!p.action || i.cleaning, knownCriticalIssues};
}
/** A new story never copies or upgrades either existing exploration slot. Seed creation is the caller's decision. */
export function createLighthouseStorySession(id: string, seed: number): LighthouseStorySession {
  const equipment = completeLighthouseSession({clock: new RoomTimeOfDay(), operation: new LighthouseOperation(),
    inspection: new LighthouseInspection(), maintenance: new LighthouseMaintenance(), power: new LighthousePower()}, "duty", seed);
  equipment.clock.restore(12); equipment.weather.useStorySchedule(); synchronizeWeatherDuty(equipment);
  const story = new LighthouseStory(id, lighthouseStoryContext(equipment));
  return {mode: "story", story, equipment};
}
function checkSession(session: LighthouseStorySession) {
  const {story, equipment} = session, saved = story.exportState(), c = lighthouseStoryContext(equipment), time = story.calendar();
  if (session.mode !== "story" || equipment.mode !== "duty" || saved.mode !== "story" || equipment.clock.playback.transitioning
    || equipment.weather.storyScheduled && saved.solarProblem && saved.solarProblem.id !== equipment.weather.storySolarProblemId
    || Math.abs(c.elapsedHours - saved.context.elapsedHours) > EPS || time.day !== equipment.operation.snapshot.dutyDay
    || Math.abs(time.hour - equipment.clock.snapshot.hour) > EPS
    || JSON.stringify(c) !== JSON.stringify(saved.context)) throw new Error("Story and full equipment checkpoint disagree");
}
/** Freeze the whole session at once; in-flight work is discarded without submitting observations or messages. */
export function encodeLighthouseStorySave(session: LighthouseStorySession) {
  if (session.mode !== "story" || session.equipment.mode !== "duty") throw new Error("Wrong story session mode");
  checkSession(session);
  const equipment = JSON.parse(encodeLighthouseSave(session.equipment)), state = session.story.exportState();
  state.context.actionInProgress = false;
  const raw = JSON.stringify({version: 1, mode: "story", story: LighthouseStory.fromState(state).exportState(), equipment});
  decodeLighthouseStorySave(raw); return raw;
}
export function decodeLighthouseStorySave(raw: string): LighthouseStorySession {
  if (typeof raw !== "string" || raw.length > MAX_STORY_SLOT_LENGTH) throw new Error("Invalid story slot size");
  const parsed = saveObject({version: saveEnum(1), mode: saveEnum("story"), story: v => v, equipment: v => v})(JSON.parse(raw));
  if (parsed.equipment?.version !== 2 || parsed.equipment.mode !== "duty") throw new Error("Story requires a complete independent V2 equipment checkpoint");
  const equipment = decodeLighthouseSave(JSON.stringify(parsed.equipment)) as LighthouseCompleteSession;
  const story = LighthouseStory.fromState(parsed.story), session: LighthouseStorySession = {mode: "story", story, equipment};
  checkSession(session); return session;
}
/** Only this key is ever accessed, including on corrupt data and storage failures. */
export class LighthouseStorySave {
  constructor(private readonly storage: () => StoryStorage = () => window.localStorage) {}
  inspect(): LighthouseSaveStatus {
    try {
      const raw = this.storage().getItem(LIGHTHOUSE_STORY_SAVE_KEY);
      if (raw === null) return {available: false, invalid: false, message: "故事尚未保存 · 与探索及演练独立"};
      try {
        const session = decodeLighthouseStorySave(raw), view = session.story.snapshot;
        return {available: true, invalid: false, message: `故事存档 · 第${view.calendar.day}日 · ${view.finished ? "本章已结束，可回看" : view.objective.title}`};
      } catch {return {available: false, invalid: true, message: "故事存档损坏或版本不支持，原数据已保留。"};}
    } catch {return {available: false, invalid: false, message: "无法读取故事存档，当前会话保持。"};}
  }
  save(session: LighthouseStorySession): LighthouseSaveStatus & {saved: boolean} {
    try {
      const store = this.storage(), old = store.getItem(LIGHTHOUSE_STORY_SAVE_KEY);
      if (old !== null) {try {decodeLighthouseStorySave(old);} catch {return {...this.inspect(), saved: false};}}
      const raw = encodeLighthouseStorySave(session); store.setItem(LIGHTHOUSE_STORY_SAVE_KEY, raw);
      return {available: true, invalid: false, saved: true, message: "故事已保存 · 任务、消息和完整天气设备一起保留，继续后先暂停"};
    } catch {return {...this.inspect(), saved: false, message: "故事保存失败，原数据和当前会话保持。"};}
  }
  load(): {session?: LighthouseStorySession; status: LighthouseSaveStatus} {
    try {
      const raw = this.storage().getItem(LIGHTHOUSE_STORY_SAVE_KEY); if (raw === null) return {status: this.inspect()};
      const session = decodeLighthouseStorySave(raw);
      return {session, status: {available: true, invalid: false, message: "已继续故事 · 时间暂停，不结算离线时间"}};
    } catch {return {status: this.inspect()};}
  }
  clearInvalid(): LighthouseSaveStatus {
    const status = this.inspect(); if (!status.invalid) return status;
    try {this.storage().removeItem(LIGHTHOUSE_STORY_SAVE_KEY); return this.inspect();}
    catch {return {...status, message: "无法清除故事旧档，原数据已保留。"};}
  }
}
