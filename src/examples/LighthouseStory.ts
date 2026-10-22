import {saveArray, saveBoolean, saveDay, saveEnum, saveHour, saveNumber, saveObject, saveOptional, saveRevision, saveText} from "./LighthouseSaveValidation";

export const LIGHTHOUSE_STORY_VERSION = 1;
export const LIGHTHOUSE_STORY_TASKS = ["ST01", "ST02", "ST03", "ST04", "ST05", "ST06", "ST07", "ST08", "ST09", "ST10", "ST11"] as const;
export type StoryTask = typeof LIGHTHOUSE_STORY_TASKS[number];
export type StoryWeather = "clear" | "overcast" | "fog" | "storm";
export type StorySource = "inspection" | "maintenance" | "discovery" | "comparison";
export type StoryFactKind = "control" | "main" | "backup" | "cover" | "comparison" | "solar-check" | "solar-cleaned";
export type StoryReportKind = "arrival" | "solar" | "handover";
export type StoryMaterial = "CL01" | "CL02" | "CL03" | "CL04" | "CL05" | "CL06";
export interface StoryStart {day: number; hour: number; automaticHours: number;}
export interface StoryContext {
  elapsedHours: number;
  revisions: {control: number; main: number; backup: number; cover: number; solar: number;};
  problems: {cover: string | null; solar: string | null;};
  weather: StoryWeather;
  navigationRequired: boolean;
  navigationSource: "main" | "backup" | "none";
  outsideWorkAllowed: boolean;
  actionInProgress: boolean;
  knownCriticalIssues: readonly string[];
}
interface FactData {
  control: {mainWh: number; solarWatts: number;};
  main: {seconds: number; turns: number; outputSeen: boolean; weather: StoryWeather;};
  backup: {seconds: number; flashes: number; weather: StoryWeather;};
  cover: {status: "clear" | "confirmed" | "suspected" | "unseen";};
  comparison: {weather: StoryWeather; daylight: boolean; actualWatts: number; expectedWatts: number;};
  "solar-check": FactData["cover"];
  "solar-cleaned": {resolvedProblemId: string;};
}
export type StoryFact = {[K in StoryFactKind]: {
  kind: K; source: StorySource; eventId: number; at: number; objectId: string;
  revision: number; problemId: string | null; method: string; data: FactData[K];
}}[StoryFactKind];
type StoredFact = StoryFact & {order: number};
interface Mark {at: number; order: number;}
interface Material extends Mark {id: StoryMaterial;}
interface Proof {context: StoryContext; facts: readonly StoredFact[];}
interface Completion extends Mark, Proof {id: StoryTask;}
interface Report extends Mark, Proof {id: StoryReportKind; unresolved: readonly string[];}
export interface StoryMessage {
  id: string; direction: "incoming" | "outgoing"; sentAt: number; order: number;
  displaySource: string; provenance: "official-channel" | "unverified-label" | "player";
  body: string; readAt?: number; readOrder?: number; replyTo?: string;
}
interface StoryState {
  version: number; mode: "story"; id: string; start: StoryStart; context: StoryContext; sequence: number;
  cursors: Record<StorySource, number>; facts: readonly StoredFact[];
  materials: readonly Material[]; diary?: Mark & {choice: "three-days" | "familiar-path" | "blank"};
  solarProblem?: Mark & {id: string}; completions: readonly Completion[]; reports: readonly Report[];
  solarNote?: Mark & Proof;
  messages: readonly StoryMessage[]; endingSeen?: Mark;
}
const taskTitles = ["接下三天值守", "完成第一轮巡视", "把接班情况记下来", "雾里看灯，再读一次表", "查清太阳能输入偏低的原因",
  "雨天先做室内工作", "理好交接单", "确认这次接送安排", "确认延班后的导航", "核对旧呼号消息", "收好这一章的记录"];
const materialIds = ["CL01", "CL02", "CL03", "CL04", "CL05", "CL06"] as const;
const sources: readonly StorySource[] = ["inspection", "maintenance", "discovery", "comparison"];
const kinds: readonly StoryFactKind[] = ["control", "main", "backup", "cover", "comparison", "solar-check", "solar-cleaned"];
const EPS = 1e-8;
const elapsed = saveNumber(0, 24000000);
const textId = (value: unknown): string => {const s = saveText(128)(value); if (!s.trim()) throw new Error("Empty story identifier"); return s;};
const nullableId = (value: unknown) => value === null ? null : textId(value);
const weather = saveEnum("clear", "overcast", "fog", "storm");
const readMark = {at: elapsed, order: saveDay};
const readContext = saveObject({elapsedHours: elapsed,
  revisions: saveObject({control: saveRevision, main: saveRevision, backup: saveRevision, cover: saveRevision, solar: saveRevision}),
  problems: saveObject({cover: nullableId, solar: nullableId}), weather,
  navigationRequired: saveBoolean, navigationSource: saveEnum("main", "backup", "none"), outsideWorkAllowed: saveBoolean,
  actionInProgress: saveBoolean, knownCriticalIssues: saveArray(textId, 32)});
const status = saveObject({status: saveEnum("clear", "confirmed", "suspected", "unseen")});
const factReaders = {
  control: saveObject({mainWh: saveNumber(0, 1e7), solarWatts: saveNumber(0, 1e7)}),
  main: saveObject({seconds: saveNumber(0, 1e6), turns: saveNumber(0, 1e6), outputSeen: saveBoolean, weather}),
  backup: saveObject({seconds: saveNumber(0, 1e6), flashes: saveNumber(0, 1e6, true), weather}),
  cover: status, comparison: saveObject({weather, daylight: saveBoolean, actualWatts: saveNumber(0, 1e7), expectedWatts: saveNumber(0, 1e7)}),
  "solar-check": status, "solar-cleaned": saveObject({resolvedProblemId: textId})
};
const factRules: Record<StoryFactKind, {objectId: string; sources: readonly StorySource[]; methods: readonly string[]}> = {
  control: {objectId: "lighthouse-control-panel", sources: ["inspection"], methods: ["local-panel"]},
  main: {objectId: "lighthouse-beacon-main", sources: ["inspection"], methods: ["direct-view"]},
  backup: {objectId: "lighthouse-beacon-backup", sources: ["maintenance"], methods: ["direct-view"]},
  cover: {objectId: "lighthouse-optics-cleaning", sources: ["inspection", "discovery"], methods: ["local-panel", "patrol", "surface-test"]},
  comparison: {objectId: "lighthouse-solar-charger", sources: ["comparison"], methods: ["meter-comparison"]},
  "solar-check": {objectId: "lighthouse-solar-array", sources: ["discovery"], methods: ["patrol", "surface-test"]},
  "solar-cleaned": {objectId: "lighthouse-solar-array", sources: ["maintenance"], methods: ["active-action"]}
};
function readFact(value: unknown, stored = true): StoredFact {
  const kind = saveEnum(...kinds)((value as StoryFact)?.kind) as StoryFactKind;
  const f = saveObject({kind: saveEnum(kind), source: saveEnum(...sources), eventId: saveDay, at: elapsed, objectId: textId,
    revision: saveRevision, problemId: nullableId, method: textId, data: factReaders[kind], ...(stored ? {order: saveDay} : {})})(value);
  const rule = factRules[kind];
  if (f.objectId !== rule.objectId || !rule.sources.includes(f.source) || !rule.methods.includes(f.method)) throw new Error("Wrong story evidence source/method");
  return f;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {Object.values(value).forEach(freeze); Object.freeze(value);} return value;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const unique = (items: readonly string[]) => new Set(items).size === items.length;
const factKey = (f: StoryFact) => `${f.source}:${f.eventId}`;
const revisionKey = (f: StoryFact) => f.kind.startsWith("solar-") || f.kind === "comparison" ? "solar" : f.kind as "control" | "main" | "backup" | "cover";
const currentFact = (f: StoryFact, c: StoryContext) => f.revision === c.revisions[revisionKey(f)]
  && (f.kind === "cover" ? f.problemId === c.problems.cover : ["solar-check", "comparison", "solar-cleaned"].includes(f.kind) ? f.problemId === c.problems.solar : f.problemId === null);
const observationPassed = (f: StoryFact) => f.kind === "main" ? f.data.seconds >= 10 - EPS && f.data.turns >= 1 - EPS && f.data.outputSeen
  : f.kind === "backup" && f.data.seconds >= 10 - EPS && f.data.flashes > 0;
const messageIds = ["pickup-plan", "night-notice", "transport-warning", "pickup-cancelled", "arrival-report", "arrival-ack", "solar-report", "solar-ack",
  "handover-report", "stay-registration", "old-call", "source-check", "source-check-reply"];

/** Committed equipment facts in, story state out. This model cannot operate equipment or advance scene time. */
export class LighthouseStory {
  private s: StoryState;
  constructor(id: string, context: StoryContext, start: StoryStart = {day: 1, hour: 12, automaticHours: 0}) {
    const c = readContext(context) as StoryContext;
    if (c.elapsedHours !== 0 || !unique(c.knownCriticalIssues)) throw new Error("A story starts at its own time origin");
    this.s = {version: LIGHTHOUSE_STORY_VERSION, mode: "story", id: textId(id),
      start: saveObject({day: saveDay, hour: saveHour, automaticHours: elapsed})(start), context: c, sequence: 0,
      cursors: {inspection: 0, maintenance: 0, discovery: 0, comparison: 0}, facts: [], materials: [], completions: [], reports: [], messages: []};
    if (start.day !== 1 || start.hour !== 12 || start.automaticHours !== 0) throw new Error("Story begins on day one at noon in an independent session");
    this.send("pickup-plan", 0);
  }
  calendar(at = this.s.context.elapsedHours) {
    const total = this.s.start.hour + at;
    return {day: this.s.start.day + Math.floor((total + 1e-10) / 24), hour: ((total % 24) + 24) % 24};
  }
  private mark(): Mark {return {at: this.s.context.elapsedHours, order: ++this.s.sequence};}
  private done(id: StoryTask) {return this.s.completions.find(t => t.id === id);}
  private message(id: string) {return this.s.messages.find(m => m.id === id);}
  private report(id: StoryReportKind) {return this.s.reports.find(r => r.id === id);}
  private read(id: string) {return this.message(id)?.readOrder !== undefined;}
  private capture(facts: readonly StoredFact[] = []): Proof {return clone({context: this.s.context, facts});}
  private complete(id: StoryTask, facts: readonly StoredFact[] = []) {
    if (this.done(id) || LIGHTHOUSE_STORY_TASKS[this.s.completions.length] !== id) throw new Error("Invalid story dependency");
    this.s.completions = [...this.s.completions, {id, ...this.mark(), ...this.capture(facts)}];
  }
  private fresh(f: StoredFact, c: StoryContext) {return currentFact(f, c) && this.calendar(f.at).day === this.calendar(c.elapsedHours).day;}
  private pick(facts: readonly StoredFact[], predicate: (f: StoredFact) => boolean) {return [...facts].reverse().find(predicate);}
  private arrivalProof(c = this.s.context, facts = this.s.facts): StoredFact[] | undefined {
    const control = this.pick(facts, f => f.kind === "control" && this.fresh(f, c));
    const main = this.pick(facts, f => f.kind === "main" && this.fresh(f, c) && observationPassed(f));
    const cover = this.pick(facts, f => f.kind === "cover" && this.fresh(f, c) && f.data.status === "clear" && f.problemId === null);
    return control && main && cover ? [control, main, cover] : undefined;
  }
  private fogProof(c = this.s.context, facts = this.s.facts): StoredFact[] | undefined {
    const comparison = this.pick(facts, f => f.kind === "comparison" && currentFact(f, c) && f.at >= 18 - EPS && f.data.daylight && f.data.weather === "fog");
    const light = comparison && this.pick(facts, f => ["main", "backup"].includes(f.kind) && currentFact(f, c) && observationPassed(f)
      && f.at >= 18 - EPS && this.daylight(f.at) && (f.data as FactData["main"]).weather === "fog" && this.calendar(f.at).day === this.calendar(comparison.at).day);
    return comparison && light ? [comparison, light] : undefined;
  }
  private solarProof(c = this.s.context, facts = this.s.facts): StoredFact[] | undefined {
    const cleaned = this.pick(facts, f => f.kind === "solar-cleaned" && f.data.resolvedProblemId === this.s.solarProblem?.id && f.problemId === null && f.revision <= c.revisions.solar);
    const recheck = cleaned && this.pick(facts, f => f.kind === "solar-check" && f.order > cleaned.order && f.data.status === "clear" && f.problemId === null && this.fresh(f, c));
    const comparison = recheck && this.pick(facts, f => f.kind === "comparison" && f.order > cleaned.order && this.fresh(f, c) && f.data.daylight
      && f.data.expectedWatts > 0 && Math.abs(f.data.actualWatts - f.data.expectedWatts) <= Math.max(1, f.data.expectedWatts * .05));
    return cleaned && recheck && comparison ? [cleaned, recheck, comparison] : undefined;
  }
  private handoverProof(c = this.s.context, facts = this.s.facts, unresolved: readonly string[] = []): StoredFact[] | undefined {
    if (c.actionInProgress || c.weather === "storm" || !c.outsideWorkAllowed || !equal([...unresolved].sort(), [...c.knownCriticalIssues].sort())
      || c.navigationRequired && c.navigationSource === "none") return undefined;
    const control = this.pick(facts, f => f.kind === "control" && this.fresh(f, c));
    const surface = this.pick(facts, f => f.kind === "solar-check" && this.fresh(f, c) && ["clear", "confirmed"].includes(f.data.status));
    const comparison = this.pick(facts, f => f.kind === "comparison" && this.fresh(f, c));
    const light = this.pick(facts, f => f.kind === c.navigationSource && this.fresh(f, c) && observationPassed(f));
    const knownSurfaceIssues = facts.filter(f => (f.kind === "cover" || f.kind === "solar-check") && currentFact(f, c) && f.data.status === "confirmed").map(f => f.problemId);
    if (knownSurfaceIssues.some(id => !unresolved.includes(id))) return undefined;
    return control && surface && comparison && (!c.navigationRequired || light) ? [control, surface, comparison, ...(light ? [light] : [])] : undefined;
  }
  private nightProof(c = this.s.context, facts = this.s.facts): StoredFact[] | undefined {
    const stay = this.done("ST08");
    if (!stay || !c.navigationRequired || c.navigationSource === "none") return undefined;
    const light = this.pick(facts, f => f.kind === c.navigationSource && f.order > stay.order && f.at >= stay.at - EPS
      && this.fresh(f, c) && !this.daylight(f.at) && observationPassed(f));
    return light ? [light] : undefined;
  }
  private daylight(at: number) {const h = this.calendar(at).hour; return h >= 6 && h < 18;}
  synchronize(value: StoryContext) {
    const c = readContext(value) as StoryContext, before = this.s.context;
    if (c.elapsedHours < before.elapsedHours || !unique(c.knownCriticalIssues)
      || Object.keys(c.revisions).some(k => c.revisions[k] < before.revisions[k])
      || (["cover", "solar"] as const).some(k => c.problems[k] !== before.problems[k] && c.revisions[k] <= before.revisions[k])) throw new Error("Story context moved backwards or changed without revision");
    this.s.context = c;
    for (const [id, due] of [["night-notice", 6], ["transport-warning", 42], ["pickup-cancelled", 72]] as const) if (c.elapsedHours >= due) this.send(id, due);
    this.progress();
  }
  /** Each source forwards its native event numbers in order. Cursors also survive cache trimming and reloads. */
  observe(value: StoryFact): boolean {
    const fact = readFact(value, false) as StoryFact, c = this.s.context;
    if (fact.eventId <= this.s.cursors[fact.source] || fact.at > c.elapsedHours + EPS || !currentFact(fact, c)) return false;
    if ((fact.kind === "cover" || fact.kind === "solar-check") && (fact.data.status === "clear") !== (fact.problemId === null)) return false;
    if (fact.kind === "solar-cleaned" && (fact.problemId !== null || fact.data.resolvedProblemId !== this.s.solarProblem?.id)) return false;
    if (fact.kind === "comparison" && fact.data.daylight !== this.daylight(fact.at)) return false;
    if (Math.abs(fact.at - c.elapsedHours) < EPS && (
      (fact.kind === "main" || fact.kind === "backup") && (fact.kind !== c.navigationSource || fact.data.weather !== c.weather)
      || fact.kind === "comparison" && fact.data.weather !== c.weather)) return false;
    this.s.cursors = {...this.s.cursors, [fact.source]: fact.eventId};
    this.s.facts = [...this.s.facts, {...fact, order: this.mark().order} as StoredFact];
    this.progress(); this.pruneFacts(); return true;
  }
  private pruneFacts() {
    const keep = new Set<StoredFact>(this.s.facts.slice(-48));
    for (const source of sources) {const latest = this.pick(this.s.facts, f => f.source === source); if (latest) keep.add(latest);}
    const treatment = this.pick(this.s.facts, f => f.kind === "solar-cleaned" && f.data.resolvedProblemId === this.s.solarProblem?.id);
    if (treatment) keep.add(treatment);
    for (const kind of kinds) {
      const latest = this.pick(this.s.facts, f => f.kind === kind && currentFact(f, this.s.context)); if (latest) keep.add(latest);
      const fog = this.pick(this.s.facts, f => f.kind === kind && (f.data as FactData["main"]).weather === "fog" && currentFact(f, this.s.context)); if (fog) keep.add(fog);
    }
    this.s.facts = this.s.facts.filter(f => keep.has(f));
  }
  readMaterial(id: StoryMaterial) {
    saveEnum(...materialIds)(id); if (this.s.materials.some(m => m.id === id)) return false;
    this.s.materials = [...this.s.materials, {id, ...this.mark()}]; return true;
  }
  acceptDuty() {
    if (this.done("ST01") || !this.s.materials.some(m => m.id === "CL01")) return false;
    this.complete("ST01"); this.progress(); return true;
  }
  bindSolarProblem(id: string) {
    textId(id); if (this.s.solarProblem) return false;
    if (this.s.context.problems.solar !== id) return false;
    this.s.solarProblem = {id, ...this.mark()}; return true;
  }
  get solarProblemId() {return this.s.solarProblem?.id;}
  recordSolarUncertainty() {
    if(!this.done("ST04")||this.report("solar")||this.s.solarNote||this.s.context.actionInProgress||this.solarProof())return false;
    const comparison=this.pick(this.s.facts,f=>f.kind==="comparison"&&this.fresh(f,this.s.context));
    if(!comparison)return false;
    const surface=this.pick(this.s.facts,f=>f.kind==="solar-check"&&this.fresh(f,this.s.context));
    this.s.solarNote={...this.mark(),...this.capture([comparison,...(surface?[surface]:[])])};return true;
  }
  chooseDiary(choice: "three-days" | "familiar-path" | "blank") {
    saveEnum("three-days", "familiar-path", "blank")(choice); if (this.s.diary) return false;
    this.s.diary = {choice, ...this.mark()}; return true;
  }
  submitReport(id: StoryReportKind, unresolved: readonly string[] = []) {
    saveEnum("arrival", "solar", "handover")(id); saveArray(textId, 32)(unresolved);
    if (this.report(id) || this.s.context.actionInProgress || !unique(unresolved)) return false;
    const prerequisite = {arrival: "ST02", solar: "ST04", handover: "ST06"} as const;
    if (!this.done(prerequisite[id])) return false;
    const facts = id === "arrival" ? this.arrivalProof() : id === "solar" ? this.solarProof() : this.handoverProof(this.s.context, this.s.facts, unresolved);
    if (!facts || id !== "handover" && unresolved.length) return false;
    this.s.reports = [...this.s.reports, {id, ...this.mark(), ...this.capture(facts), unresolved: [...unresolved]}];
    this.send(`${id}-report`);
    if (id === "handover") this.complete("ST07", facts);
    this.progress(); return true;
  }
  reviewStormPlan() {
    const c = this.s.context;
    if (!this.done("ST05") || this.done("ST06") || c.elapsedHours < 42 || !this.read("transport-warning") || c.actionInProgress) return false;
    const control = this.pick(this.s.facts, f => f.kind === "control" && f.at >= 42 && this.fresh(f, c));
    if (!control) return false;
    this.complete("ST06", [control]); this.progress(); return true;
  }
  registerStay() {
    if (!this.done("ST07") || this.done("ST08") || !this.read("pickup-cancelled") || this.s.context.actionInProgress) return false;
    this.send("stay-registration"); this.complete("ST08"); this.progress(); return true;
  }
  readMessage(id: string) {
    const m = this.message(id); if (!m || m.direction !== "incoming" || m.readOrder !== undefined) return false;
    const mark = this.mark(); this.s.messages = this.s.messages.map(v => v === m ? {...v, readAt: mark.at, readOrder: mark.order} : v);
    this.progress(); return true;
  }
  requestSourceCheck() {
    if (!this.done("ST09") || !this.read("old-call") || this.message("source-check") || this.s.context.actionInProgress) return false;
    this.send("source-check"); return true;
  }
  /** Delivery is a distinct committed event, so saving while awaiting any reply is well-defined. */
  deliverReply(requestId: "arrival-report" | "solar-report" | "source-check") {
    const reply = {"arrival-report": "arrival-ack", "solar-report": "solar-ack", "source-check": "source-check-reply"}[requestId];
    if (!reply || !this.message(requestId) || this.message(reply)) return false;
    this.send(reply, this.s.context.elapsedHours, requestId); this.progress(); return true;
  }
  finishChapter() {
    if (!this.done("ST10") || this.done("ST11") || this.s.context.actionInProgress) return false;
    this.complete("ST11"); return true;
  }
  acknowledgeEnding() {
    if (!this.done("ST11") || this.s.endingSeen) return false;
    this.s.endingSeen = this.mark(); return true;
  }
  private progress() {
    for (let count = 0; count < 11; count++) {
      const id = LIGHTHOUSE_STORY_TASKS[this.s.completions.length];
      let facts: StoredFact[] | undefined;
      if (id === "ST02") facts = this.arrivalProof();
      if (id === "ST03" && this.read("arrival-ack")) facts = [];
      if (id === "ST04" && this.s.context.elapsedHours >= 18) facts = this.fogProof();
      if (id === "ST05" && this.read("solar-ack")) facts = [];
      if (id === "ST09") facts = this.nightProof();
      if (id === "ST10" && this.read("source-check-reply")) facts = [];
      if (facts === undefined) break;
      this.complete(id, facts);
    }
    if (this.done("ST09") && !this.s.context.actionInProgress) this.send("old-call");
  }
  private messageContent(id: string, at: number, order = Infinity) {
    const departure = this.calendar(72), day = this.calendar(at).day;
    const contents: Record<string, string> = {
      "pickup-plan": `原定代班满72小时，第${departure.day}日${String(Math.floor(departure.hour)).padStart(2, "0")}:00由工作码头接送，下一班随艇到场。住宅至灯塔为岛内道路。接送以岸站正式通知为准。`,
      "night-notice": "夜间自动值守已经开始。你可以自愿到塔里确认实际导航，记录会一直保留。",
      "transport-warning": "接送还在看外海情况。岛边转晴以后，外海的涌浪也可能还在。先把交接准备好，确认航次后再联系。",
      "pickup-cancelled": `海角灯站，原定接送航次取消。外海涌浪没有退，艇上不了工作码头，下一班也暂时到不了。${this.report("handover") && this.report("handover").order < order && this.report("handover").at <= at ? "离站准备和值守报告已经收到。" : "尚未完成的值守报告请继续整理，已经完成的工作保留。"}请先留站，接送恢复时间另行通知。生活补给够用。`,
      "arrival-report": `第${day}日接班报告：已核对首层读数、真实灯具观察及保护面独立复查。`,
      "arrival-ack": at < 18 ? "接班记录收到了。第三天晚上先把交接单整理好，满三天后的中午接你。明天可能有雾，白天的灯也请留意。"
        : `第${day}日接班记录收到了。原接送计划仍留在联络簿，实际航次以正式通知为准。海雾中的白天导航也请留意。`,
      "solar-report": `第${day}日输入报告：${this.solarWasEarly() ? "此前已经处理的薄膜" : "本次薄膜"}已有清洁记录、独立复查和新的天气/输入对照。`,
      "solar-ack": "看到了前后的读数。这样下一班就知道，你查过什么，也知道变化是从哪里来的。把复查结果留在簿上就好。",
      "handover-report": `第${day}日离站准备：当前运行、本次工作和下一班待办已记录；尚待接班人抵达。`,
      "stay-registration": `第${day}日登记继续留站，钥匙仍由当前值守员保管，接送窗口未知。`,
      "old-call": "海角站，继续值守。收到请回答。\n显示来源：岸站旧呼号；来源待核验。此标签来自旧记录体系，不代表已经确认发送者。",
      "source-check": "请核对留存的旧呼号消息原文及原发送时间，确认岸站是否发出。",
      "source-check-reply": "接送取消的通知是我发的。你刚转来的这条，我们这里没有发送记录。\n原文和时间先留着，别删。我继续查。"
    };
    return contents[id];
  }
  private solarWasEarly() {
    const cleaned = this.report("solar")?.facts.find(f => f.kind === "solar-cleaned");
    return !!cleaned && cleaned.order < (this.done("ST04")?.order || 0);
  }
  private send(id: string, at = this.s.context.elapsedHours, replyTo?: string) {
    if (this.message(id)) return;
    const outgoing = ["arrival-report", "solar-report", "handover-report", "stay-registration", "source-check"].includes(id);
    const legacy = id === "old-call";
    this.s.messages = [...this.s.messages, {id, direction: outgoing ? "outgoing" : "incoming", sentAt: at, order: this.mark().order,
      displaySource: outgoing ? "当前值守员" : legacy ? "岸站旧呼号" : "岸站值班",
      provenance: outgoing ? "player" : legacy ? "unverified-label" : "official-channel", body: this.messageContent(id, at, this.s.sequence), ...(replyTo ? {replyTo} : {})}];
  }
  private nextReason(id: StoryTask | undefined) {
    const c = this.s.context;
    switch (id) {
      case "ST01": return "读完周师傅的信，接下这三天值守。";
      case "ST02": return "记下今天的读数，看完主灯一圈，查查保护面；擦完要再看一遍。";
      case "ST03": return this.report("arrival") ? "去联络页看看岸站的接班回复。" : "到书桌或首层记录夹旁，发出今天的接班报告。";
      case "ST04": return c.elapsedHours < 18 ? "等明早雾起。可以回书桌旁休息。" : "白天起雾时看看灯，再到首层对照天气、日照和太阳能输入。";
      case "ST05": return this.report("solar") ? "去联络页看看岸站对面板检查的回复。" : "细查面板，擦去污膜后再检查一遍，白天重新对照输入。看一眼没发现，仍可能有薄膜。";
      case "ST06": return c.elapsedHours < 42 ? "第3日会有岸站的消息。可以回书桌旁等一等，灯站照常运行。" : "先读岸站的接送提醒，再去首层读表，把雨天能做的事理一理。";
      case "ST07": return c.actionInProgress ? "先做完或停下手头的操作。" : !c.outsideWorkAllowed || c.weather === "storm" ? "先等风雨缓一缓，雨后再去检查面板。"
        : c.navigationRequired && c.navigationSource === "none" ? "现在需要亮灯。先检查供电和保护面，让主灯或备用灯恢复导航。" : "现在可以去看面板，再读表、核对灯况，把还没处理完的问题写进交接单。";
      case "ST08": return c.elapsedHours < 72 ? "交接单收好了，等满三天时岸站确认接送安排。" : "读完岸站取消接送的通知，登记继续留站。什么时候能接，还没有消息。";
      case "ST09": return c.navigationSource === "none" ? "两盏灯都没能提供导航，先查供电，让灯恢复工作。" : "登记留站后，晚上再看看灯：看主灯转完一圈并出光，或看备用灯白闪，连续观察10秒。";
      case "ST10": return this.message("source-check") ? "等岸站核对。旧消息的原文和发送时间都先留着。" : "读读那条旧呼号消息，再问问岸站是不是他们发的。";
      case "ST11": return "这一班的事记好了。可以再留一会儿，翻翻记录，或在这里结束本章。";
      default: return "未完待续。可以停留或重读记录。";
    }
  }
  get snapshot() {
    const count = this.s.completions.length, next = LIGHTHOUSE_STORY_TASKS[count], cancel = this.message("pickup-cancelled"), verification = this.message("source-check-reply");
    return freeze(clone({version: this.s.version, mode: this.s.mode, id: this.s.id, start: this.s.start, elapsedHours: this.s.context.elapsedHours,
      calendar: this.calendar(), chapter: count < 3 ? "arrival" : count < 5 ? "fog" : count < 7 || count === 7 && !cancel ? "departure" : count < 11 ? "epilogue" : "ended",
      tasks: LIGHTHOUSE_STORY_TASKS.map((id, index) => ({id, title: taskTitles[index], status: index < count ? "complete" : index === count ? "active" : "locked", completion: this.done(id)})),
      objective: {id: next, title: next ? taskTitles[count] : "未完待续", reason: this.nextReason(next)},
      messages: this.s.messages.map(m => ({...m, state: m.direction === "incoming" ? m.readOrder === undefined ? "unread" : "read"
        : this.s.messages.some(v => v.replyTo === m.id) ? "replied" : ["arrival-report", "solar-report", "source-check"].includes(m.id) ? "awaiting-reply" : "sent"})),
      materials: this.s.materials, diary: this.s.diary, reports: this.s.reports, solarNote:this.s.solarNote,
      transport: {plannedAt: 72, departure: this.calendar(72), status: cancel ? "cancelled" : this.message("transport-warning") ? "at-risk" : "planned",
        cancelledAt: cancel?.sentAt, stayRegistered: !!this.done("ST08"), nextWindow: null},
      sourceCheck: {status: verification ? "no-official-record" : this.message("source-check") ? "pending" : "not-requested", originalMessageId: this.message("old-call")?.id,
        replyId: verification?.id, sender: null}, goalsComplete: !!this.done("ST10"), finished: !!this.done("ST11"), endingSeen: !!this.s.endingSeen,
      retainedFacts: this.s.facts.length}));
  }
  exportState() {return clone(this.s);}
  get revision() {return this.s.sequence;}
  /** A new watch requires a fresh local observation, including after a checkpoint restore. */
  get nightWatchKey() {return this.done("ST08")&&!this.done("ST09")?`${this.calendar().day}:${this.daylight(this.s.context.elapsedHours)}`:"";}
  get arrivalChecks() {
    const c = this.s.context, facts = this.s.facts;
    return {control: facts.some(f => f.kind === "control" && this.fresh(f, c)),
      main: facts.some(f => f.kind === "main" && this.fresh(f, c) && observationPassed(f)),
      cover: facts.some(f => f.kind === "cover" && this.fresh(f, c) && f.data.status === "clear" && f.problemId === null)};
  }
  get canSubmitArrival() {return !!this.done("ST02") && !this.report("arrival") && !this.s.context.actionInProgress && !!this.arrivalProof();}
  get fieldWork() {
    const c=this.s.context,facts=this.s.facts,solar=this.solarProof(),fog=!!this.done("ST04"),day=this.calendar().day;
    const phase=!this.done("ST03")?"arrival":!this.done("ST05")?"solar":!this.done("ST07")?"handover":"complete";
    const kind=phase==="complete"?undefined:phase as StoryReportKind;
    const cleanedFact=this.pick(facts,f=>f.kind==="solar-cleaned"&&f.data.resolvedProblemId===this.s.solarProblem?.id),cleaned=!!cleanedFact;
    const recheck=!!cleanedFact&&facts.some(f=>f.kind==="solar-check"&&f.order>cleanedFact.order&&f.data.status==="clear"&&this.fresh(f,c));
    const checks=phase==="arrival"?Object.entries(this.arrivalChecks).map(([id,complete])=>({id,complete}))
      :phase==="solar"?[{id:"fog",complete:fog},{id:"cleaned",complete:cleaned},{id:"recheck",complete:recheck},{id:"comparison",complete:!!solar}]
      :[{id:"storm",complete:!!this.done("ST06")},{id:"control",complete:facts.some(f=>f.kind==="control"&&this.fresh(f,c))},
        {id:"surface",complete:facts.some(f=>f.kind==="solar-check"&&this.fresh(f,c)&&["clear","confirmed"].includes(f.data.status))},
        {id:"handover",complete:!!this.done("ST07")}];
    return {phase,day,kind,checks,knownIssues:[...c.knownCriticalIssues],
      issueLabels:c.knownCriticalIssues.map(id=>id===c.problems.cover?"保护面污损待清洁":id===c.problems.solar?"太阳能表面污损待处理":({"drive-fault":"驱动异常待处理","charger-fault":"充电异常待处理","sensor-dirty":"光敏表面待处理"})[id]||"已知设备异常待处理"),
      canReport:!!kind&&!this.report(kind)&&!c.actionInProgress&&(kind==="arrival"?this.canSubmitArrival:kind==="solar"?fog&&!!solar:!!this.done("ST06")&&!!this.handoverProof(c,facts,c.knownCriticalIssues)),
      canReview:!!this.done("ST05")&&!this.done("ST06")&&c.elapsedHours>=42&&this.read("transport-warning")&&!c.actionInProgress
        &&facts.some(f=>f.kind==="control"&&f.at>=42&&this.fresh(f,c)),
      canNote:fog&&!this.report("solar")&&!this.s.solarNote&&!solar&&facts.some(f=>f.kind==="comparison"&&this.fresh(f,c))};
  }

  static fromState(value: unknown): LighthouseStory {
    const proof = {context: readContext, facts: saveArray(v => readFact(v), 64)};
    const s = saveObject({version: saveEnum(LIGHTHOUSE_STORY_VERSION), mode: saveEnum("story"), id: textId,
      start: saveObject({day: saveDay, hour: saveHour, automaticHours: elapsed}), context: readContext, sequence: saveNumber(1, 1e9, true),
      cursors: saveObject({inspection: saveNumber(0, 1e6, true), maintenance: saveNumber(0, 1e6, true), discovery: saveNumber(0, 1e6, true), comparison: saveNumber(0, 1e6, true)}),
      facts: proof.facts, materials: saveArray(saveObject({id: saveEnum(...materialIds), ...readMark}), 6),
      diary: saveOptional(saveObject({choice: saveEnum("three-days", "familiar-path", "blank"), ...readMark})),
      solarProblem: saveOptional(saveObject({id: textId, ...readMark})),
      solarNote:saveOptional(saveObject({...readMark,...proof})),
      completions: saveArray(saveObject({id: saveEnum(...LIGHTHOUSE_STORY_TASKS), ...readMark, ...proof}), 11),
      reports: saveArray(saveObject({id: saveEnum("arrival", "solar", "handover"), ...readMark, ...proof, unresolved: saveArray(textId, 32)}), 3),
      messages: saveArray(saveObject({id: saveEnum(...messageIds), direction: saveEnum("incoming", "outgoing"), sentAt: elapsed, order: saveDay,
        displaySource: textId, provenance: saveEnum("official-channel", "unverified-label", "player"), body: saveText(2048),
        readAt: saveOptional(elapsed), readOrder: saveOptional(saveDay), replyTo: saveOptional(saveEnum("arrival-report", "solar-report", "source-check"))}), 13),
      endingSeen: saveOptional(saveObject(readMark))})(value) as StoryState;
    const model = new LighthouseStory(s.id, {...s.context, elapsedHours: 0}, s.start);
    model.s = clone(s); model.validateCheckpoint(); return model;
  }
  private validateCheckpoint() {
    const s = this.s, fail = () => {throw new Error("Inconsistent story checkpoint");};
    const within = (m: Mark) => Number.isSafeInteger(m.order) && m.order >= 1 && m.order <= s.sequence && m.at <= s.context.elapsedHours + EPS;
    const before = (a: Mark | undefined, b: Mark) => !!a && a.order < b.order && a.at <= b.at + EPS;
    if (!unique(s.materials.map(m => m.id)) || !unique(s.reports.map(r => r.id)) || !unique(s.messages.map(m => m.id)) || !unique(s.context.knownCriticalIssues)) fail();
    const marks: Mark[] = [...s.materials, ...s.completions, ...s.reports, ...s.messages.map(m => ({at: m.sentAt, order: m.order})),
      ...s.messages.filter(m => m.readOrder !== undefined).map(m => ({at: m.readAt, order: m.readOrder})),
      ...(s.solarProblem ? [s.solarProblem] : []), ...(s.solarNote?[s.solarNote]:[]), ...(s.diary ? [s.diary] : []), ...(s.endingSeen ? [s.endingSeen] : [])];
    const allFacts = [...s.facts];
    [...s.completions, ...s.reports,...(s.solarNote?[s.solarNote]:[])].forEach(p => allFacts.push(...p.facts));
    const factsByKey = new Map<string, StoredFact>();
    if (!unique(s.facts.map(factKey))) fail();
    for (const f of allFacts) {
      if (!within(f) || f.eventId > s.cursors[f.source] || f.revision > s.context.revisions[revisionKey(f)]) fail();
      const previous = factsByKey.get(factKey(f)); if (previous && !equal(previous, f)) fail(); factsByKey.set(factKey(f), f);
      if ((f.kind === "cover" || f.kind === "solar-check") && (f.data.status === "clear") !== (f.problemId === null)) fail();
      if (f.kind === "comparison" && f.data.daylight !== this.daylight(f.at)) fail();
      if (f.kind === "solar-cleaned" && (!s.solarProblem || f.data.resolvedProblemId !== s.solarProblem.id || !before(s.solarProblem, f))) fail();
    }
    marks.push(...factsByKey.values());
    for (const source of sources) if (s.cursors[source] !== Math.max(0, ...[...factsByKey.values()].filter(f => f.source === source).map(f => f.eventId))) fail();
    if (marks.some(m => !within(m)) || !unique(marks.map(m => String(m.order))) || s.sequence !== Math.max(...marks.map(m => m.order))) fail();
    for (const p of [...s.completions, ...s.reports,...(s.solarNote?[s.solarNote]:[])]) {
      if (p.at !== p.context.elapsedHours || !unique(p.context.knownCriticalIssues) || p.facts.some(f => !before(f, p))
        || Object.keys(p.context.revisions).some(k => p.context.revisions[k] > s.context.revisions[k])) fail();
    }
    if(s.solarNote&&(!before(this.done("ST04"),s.solarNote)||!s.solarNote.facts.some(f=>f.kind==="comparison"&&this.fresh(f,s.solarNote.context))
      ||s.solarNote.context.actionInProgress||s.solarNote.facts.some(f=>f.kind!=="comparison"&&f.kind!=="solar-check")))fail();
    for (let i = 0; i < s.completions.length; i++) {
      const c = s.completions[i], proof = c.facts;
      if (c.id !== LIGHTHOUSE_STORY_TASKS[i] || i > 0 && !before(s.completions[i - 1], c)) fail();
      const readBefore = (id: string) => {const m = this.message(id); return m?.readOrder !== undefined && before({at: m.readAt, order: m.readOrder}, c);};
      switch (c.id) {
        case "ST01": if (!before(s.materials.find(m => m.id === "CL01"), c)) fail(); break;
        case "ST02": if (!this.arrivalProof(c.context, proof)) fail(); break;
        case "ST03": if (!readBefore("arrival-ack")) fail(); break;
        case "ST04": if (c.at < 18 || !this.fogProof(c.context, proof)) fail(); break;
        case "ST05": if (!readBefore("solar-ack")) fail(); break;
        case "ST06": if (c.at < 42 || !readBefore("transport-warning") || !proof.some(f => f.kind === "control" && f.at >= 42 && this.fresh(f, c.context)) || c.context.actionInProgress) fail(); break;
        case "ST07": if (!before(this.report("handover"), c)) fail(); break;
        case "ST08": if (!readBefore("pickup-cancelled") || !this.message("stay-registration") || !before({at: this.message("stay-registration").sentAt, order: this.message("stay-registration").order}, c) || c.context.actionInProgress) fail(); break;
        case "ST09": if (!this.nightProof(c.context, proof)) fail(); break;
        case "ST10": if (!readBefore("source-check-reply")) fail(); break;
        case "ST11": if (c.context.actionInProgress) fail(); break;
      }
    }
    for (const r of s.reports) {
      const prerequisite = {arrival: "ST02", solar: "ST04", handover: "ST06"} as const;
      if (!before(this.done(prerequisite[r.id]), r) || r.context.actionInProgress || !unique(r.unresolved) || r.id !== "handover" && r.unresolved.length
        || !(r.id === "arrival" ? this.arrivalProof(r.context, r.facts) : r.id === "solar" ? this.solarProof(r.context, r.facts) : this.handoverProof(r.context, r.facts, r.unresolved))) fail();
      const sent = this.message(`${r.id}-report`); if (!sent || !before(r, {at: sent.sentAt, order: sent.order}) || sent.sentAt !== r.at) fail();
    }
    for (const m of s.messages) {
      const out = ["arrival-report", "solar-report", "handover-report", "stay-registration", "source-check"].includes(m.id), legacy = m.id === "old-call";
      if (m.direction !== (out ? "outgoing" : "incoming") || m.displaySource !== (out ? "当前值守员" : legacy ? "岸站旧呼号" : "岸站值班")
        || m.provenance !== (out ? "player" : legacy ? "unverified-label" : "official-channel") || m.body !== this.messageContent(m.id, m.sentAt, m.order)
        || (m.readOrder === undefined) !== (m.readAt === undefined) || m.readOrder !== undefined && (out || !before({at: m.sentAt, order: m.order}, {at: m.readAt, order: m.readOrder}))) fail();
      if (m.id.endsWith("-report") && !this.report(m.id.slice(0, -7) as StoryReportKind)) fail();
      const replyTo = {"arrival-ack": "arrival-report", "solar-ack": "solar-report", "source-check-reply": "source-check"}[m.id];
      if (m.replyTo !== replyTo) fail();
      if (replyTo) {const request = this.message(replyTo); if (!request || !before({at: request.sentAt, order: request.order}, {at: m.sentAt, order: m.order})) fail();}
      if (m.id === "old-call" && !before(this.done("ST09"), {at: m.sentAt, order: m.order})) fail();
      if (m.id === "source-check") {const original = this.message("old-call"); if (!original?.readOrder || !before({at: original.readAt, order: original.readOrder}, {at: m.sentAt, order: m.order})) fail();}
      if (m.id === "stay-registration" && (!this.done("ST08") || !before(this.done("ST07"), {at: m.sentAt, order: m.order}))) fail();
    }
    for (const [id, due] of [["pickup-plan", 0], ["night-notice", 6], ["transport-warning", 42], ["pickup-cancelled", 72]] as const) {
      const m = this.message(id); if ((s.context.elapsedHours >= due) !== !!m || m && m.sentAt !== due) fail();
    }
    if (this.read("arrival-ack") && !this.done("ST03") || this.read("solar-ack") && !this.done("ST05")
      || this.report("handover") && !this.done("ST07") || this.read("source-check-reply") && !this.done("ST10")) fail();
    if (s.endingSeen && !before(this.done("ST11"), s.endingSeen)) fail();
  }
}
