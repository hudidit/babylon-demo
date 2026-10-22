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
    const result = status === "clear" ? `${surface}表面没看到污损。设备内部是否正常，还要另查。`
      : status === "confirmed" ? `${surface}上${fact.stage === "latent" ? "有一层薄薄的污膜" : "看得见污损"}，擦净后再检查一遍。`
      : status === "suspected" ? "这块反光有点不一样，像是有层薄膜，还没看准。"
      : "这次巡视没看到明显污损，薄薄的污膜仍可能漏看。";
    const next = status === "unseen" && misses >= 2 ? "已经看过两次，还是拿不准。靠近面板细看5秒，确认有没有污膜。"
      : status === "unseen" || status === "suspected" ? "靠近面板细看5秒。再匆匆看一遍，还是很难判断。"
      : status === "confirmed" ? "用布擦净，再回来检查一遍。" : "表面查过了。输入还低的话，到首层对照天气、日照和读数。";
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
