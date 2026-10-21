/** Versioned, reproducible gameplay randomness. No wall clock or Math.random. */
export const LIGHTHOUSE_RANDOM_VERSION = "lcg32-streams-v1";
export const LIGHTHOUSE_RANDOM_STREAMS = Object.freeze(["weather", "equipment", "inspection", "forecast"] as const);
export type LighthouseRandomStream = typeof LIGHTHOUSE_RANDOM_STREAMS[number];
export interface LighthouseRandomState {
  readonly algorithm: typeof LIGHTHOUSE_RANDOM_VERSION;
  readonly seed: number;
  readonly streams: Readonly<Record<LighthouseRandomStream, Readonly<{state: number; draws: number}>>>;
}
const uint32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const salts = [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef];
function derive(seed: number, salt: number) {
  let x = (seed ^ salt) >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x85ebca6b);
  x = Math.imul(x ^ x >>> 13, 0xc2b2ae35);
  return (x ^ x >>> 16) >>> 0;
}

export class LighthouseRandom {
  private streams: Record<LighthouseRandomStream, {state: number; draws: number}>;
  constructor(readonly seed: number) {
    if (!uint32(seed)) throw new RangeError("Random seed must be a uint32");
    this.streams = {} as typeof this.streams;
    LIGHTHOUSE_RANDOM_STREAMS.forEach((name, i) => {this.streams[name] = {state: derive(seed, salts[i]), draws: 0};});
  }
  next(name: LighthouseRandomStream): number {
    if (!LIGHTHOUSE_RANDOM_STREAMS.includes(name)) throw new RangeError("Unknown random stream");
    const stream = this.streams[name];
    stream.state = (Math.imul(1664525, stream.state) + 1013904223) >>> 0;
    stream.draws++;
    return stream.state / 0x100000000;
  }
  get snapshot(): LighthouseRandomState {
    const streams = {} as Record<LighthouseRandomStream, Readonly<{state: number; draws: number}>>;
    LIGHTHOUSE_RANDOM_STREAMS.forEach(name => {streams[name] = Object.freeze({...this.streams[name]});});
    return Object.freeze({algorithm: LIGHTHOUSE_RANDOM_VERSION, seed: this.seed, streams: Object.freeze(streams)});
  }
  /** Primitive checkpoint only; the version-1 player save is deliberately unchanged. */
  static fromState(value: LighthouseRandomState) {
    if (!value || value.algorithm !== LIGHTHOUSE_RANDOM_VERSION || !uint32(value.seed)
      || Object.keys(value).sort().join() !== "algorithm,seed,streams"
      || !value.streams || Object.keys(value.streams).length !== LIGHTHOUSE_RANDOM_STREAMS.length
      || LIGHTHOUSE_RANDOM_STREAMS.some(name => !value.streams[name] || !uint32(value.streams[name].state)
        || Object.keys(value.streams[name]).sort().join() !== "draws,state"
        || !Number.isSafeInteger(value.streams[name].draws) || value.streams[name].draws < 0))
      throw new RangeError("Invalid random checkpoint");
    const model = new LighthouseRandom(value.seed);
    LIGHTHOUSE_RANDOM_STREAMS.forEach(name => {
      let n=value.streams[name].draws,a=1664525,c=1013904223,state=model.streams[name].state;
      // Affine exponentiation validates even large draw counts without replaying every sample.
      while(n>0){if(n%2===1)state=(Math.imul(a,state)+c)>>>0;c=(Math.imul(a,c)+c)>>>0;a=Math.imul(a,a)>>>0;n=Math.floor(n/2);}
      if(state!==value.streams[name].state)throw new RangeError("Random state does not match draw count");
      model.streams[name] = {...value.streams[name]};
    });
    return model;
  }
}
