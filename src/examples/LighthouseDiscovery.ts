import {saveObject, saveEnum, saveArray, saveText, saveNumber, saveDay, saveRevision, saveOptional, saveBoolean} from "./LighthouseSaveValidation";

export type LighthouseDiscoveryTarget = "cover" | "solar";
export type LighthouseDiscoveryMethod = "patrol" | "surface-test";
export interface LighthouseDiscoveryFact {
  readonly target: LighthouseDiscoveryTarget; readonly revision: number; readonly problemId: string;
  readonly stage: "clear" | "latent" | "obvious"; readonly severity: number;
}
export interface LighthouseClue {
  readonly id: number; readonly target: LighthouseDiscoveryTarget; readonly revision: number; readonly problemId: string;
  readonly method: LighthouseDiscoveryMethod; readonly visit: number; readonly day: number; readonly hour: number;
  readonly status: "unseen" | "suspected" | "confirmed" | "clear"; readonly result: string; readonly next: string;
}
interface Visit {number: number; near: boolean; leftAt?: number;}
const targets: readonly LighthouseDiscoveryTarget[] = ["cover", "solar"];
const same = (a: LighthouseClue, b: LighthouseDiscoveryFact) => a.target === b.target && a.revision === b.revision && a.problemId === b.problemId;

/** Knowledge only: observing never creates, repairs or rerolls an equipment problem. */
export class LighthouseDiscovery {
  private facts: readonly LighthouseDiscoveryFact[] = [];
  private visits: Record<LighthouseDiscoveryTarget, Visit> = {cover: {number: 1, near: false}, solar: {number: 1, near: false}};
  private entries: readonly LighthouseClue[] = [];
  private nextId = 1;
  private elapsedHours = 0;
  constructor(private readonly draw: () => number) {}
  synchronize(facts: readonly LighthouseDiscoveryFact[], elapsedHours: number, near: readonly LighthouseDiscoveryTarget[] | null) {
    if (!Number.isFinite(elapsedHours) || elapsedHours < this.elapsedHours - 1e-9
      || facts.length !== 2 || targets.some(t => facts.filter(f => f.target === t).length !== 1)
      || facts.some(f => !Number.isSafeInteger(f.revision) || f.revision < 0 || !f.problemId
        || !["clear", "latent", "obvious"].includes(f.stage) || !Number.isFinite(f.severity) || f.severity < 0 || f.severity > 1)) throw new RangeError("Invalid discovery facts/time");
    this.facts = facts.map(f => Object.freeze({...f})); this.elapsedHours = elapsedHours;
    if (near === null) return; // Restoring a paused session binds facts without inventing an area departure.
    for (const target of targets) {
      const v = this.visits[target], here = near.includes(target);
      if (v.near && !here) v.leftAt = elapsedHours;
      if (!v.near && here) {
        if (v.leftAt !== undefined && elapsedHours - v.leftAt >= 1 / 6 - 1e-9) v.number++;
        delete v.leftAt;
      }
      v.near = here;
    }
  }
  observe(target: LighthouseDiscoveryTarget, method: LighthouseDiscoveryMethod, day: number, hour: number): LighthouseClue | undefined {
    const fact = this.facts.find(f => f.target === target), visit = this.visits[target];
    if (!fact || !visit?.near || !["patrol", "surface-test"].includes(method)) return undefined;
    const current = this.entries.filter(e => same(e, fact)), cached = current.find(e => e.method === method && e.visit === visit.number);
    if (cached) return cached;
    // A later quick glance cannot erase a definite current-revision diagnosis or an existing suspicion.
    const known = [...current].reverse().find(e => e.status === "confirmed" || e.status === "suspected");
    let status: LighthouseClue["status"];
    if (fact.stage === "clear") status = "clear";
    else if (fact.stage === "obvious" || method === "surface-test" || known?.status === "confirmed") status = "confirmed";
    else if (known) status = "suspected";
    else status = this.draw() < .35 + .45 * fact.severity ? "suspected" : "unseen";
    const misses = current.filter(e => e.method === "patrol" && e.status === "unseen").length + (status === "unseen" ? 1 : 0);
    const surface = target === "cover" ? "保护面" : "太阳能面板";
    const result = status === "clear" ? `${surface}本次表面检查未见污损；不代表设备内部无故障。`
      : status === "confirmed" ? `${surface}${fact.stage === "latent" ? "近距细查确认早期薄膜" : "确认可见污损"}，可清洁后独立复查。`
      : status === "suspected" ? "表面反光有轻微差异，疑似薄膜；尚未确定原因。"
      : "本次普通巡视未见明显异常，尚未排除细薄污膜。";
    const next = status === "unseen" && misses >= 2 ? "两次有效巡视仍未排除疑点；请在面板旁保持看向表面，完成5秒近距细查。"
      : status === "unseen" || status === "suspected" ? "可做5秒近距细查；重复普通巡视不会增加本次信息。"
      : status === "confirmed" ? "使用清洁布，完成后另做一次表面复查。" : "表面已查；若输入仍偏低，请到首层对照天气、日照和读数。";
    const entry: LighthouseClue = Object.freeze({id: this.nextId++, target, revision: fact.revision, problemId: fact.problemId,
      method, visit: visit.number, day, hour, status, result, next});
    const all = [...this.entries, entry], protectedEntries = new Set<LighthouseClue>();
    for (const f of this.facts) {
      const matches = all.filter(e => same(e, f));
      for (const m of ["patrol", "surface-test"] as const) {
        const cached = matches.find(e => e.method === m && e.visit === this.visits[f.target].number);
        if (cached) protectedEntries.add(cached);
      }
      const known = [...matches].reverse().find(e => e.status === "confirmed" || e.status === "suspected");
      if (known) protectedEntries.add(known);
      matches.filter(e => e.status === "unseen").slice(-2).forEach(e => protectedEntries.add(e));
    }
    this.entries = Object.freeze(all.filter((e, index) => index >= all.length - 118 || protectedEntries.has(e))); return entry;
  }
  view(target: LighthouseDiscoveryTarget) {
    const fact = this.facts.find(f => f.target === target), current = fact ? this.entries.filter(e => same(e, fact)) : [];
    const latest = [...current].reverse().find(e => e.status === "confirmed") || current[current.length - 1];
    return Object.freeze({latest, visit: this.visits[target].number, history: Object.freeze(this.entries.filter(e => e.target === target)
      .map(e => Object.freeze({...e, valid: !!fact && same(e, fact)})))});
  }
  exportState() {
    return JSON.parse(JSON.stringify({version: 1, visits: this.visits, entries: this.entries, nextId: this.nextId, elapsedHours: this.elapsedHours}));
  }
  /** Step four can persist this checkpoint alongside the owning weather/random and equipment state. */
  static fromState(value: unknown, draw: () => number) {
    const visit = saveObject({number: saveDay, near: saveBoolean, leftAt: saveOptional(saveNumber(0, 1e9))});
    const state = saveObject({version: saveEnum(1), visits: saveObject({cover: visit, solar: visit}), nextId: saveDay, elapsedHours: saveNumber(0, 1e9),
      entries: saveArray(saveObject({id: saveDay, target: saveEnum("cover", "solar"), revision: saveRevision, problemId: saveText(128),
        method: saveEnum("patrol", "surface-test"), visit: saveDay, day: saveDay, hour: saveNumber(0, 24),
        status: saveEnum("unseen", "suspected", "confirmed", "clear"), result: saveText(), next: saveText()}), 128)})(value);
    if (new Set(state.entries.map(e=>[e.target,e.revision,e.problemId,e.method,e.visit].join(":"))).size!==state.entries.length
      || state.entries.some((e, i) => !e.problemId || e.id >= state.nextId || e.hour >= 24 || e.visit > state.visits[e.target].number || i > 0 && e.id <= state.entries[i - 1].id)
      || targets.some(t => state.visits[t].leftAt > state.elapsedHours || state.visits[t].near && state.visits[t].leftAt !== undefined)) throw new RangeError("Invalid discovery checkpoint");
    const model = new LighthouseDiscovery(draw); model.visits = {cover: {...state.visits.cover}, solar: {...state.visits.solar}}; model.entries = state.entries; model.nextId = state.nextId; model.elapsedHours = state.elapsedHours;
    return model;
  }
}
