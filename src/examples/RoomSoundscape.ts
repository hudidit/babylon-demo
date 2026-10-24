import { houseRoomAt, HOUSE_DOORS, planToWorld } from "./HouseLayout";
import { HOUSE_WINDOWS } from "./HouseStructure";
import { COASTAL_SITE } from "./CoastalSite";
import { LIGHTHOUSE } from "./LighthouseLayout";
import { LIGHTHOUSE_SERVICE_ROOM } from "./LighthouseEquipmentLayout";
import type { AudioCue, WorldAudioTarget } from "./RoomAudioCatalog";
import type { LighthouseWeatherKind } from "./LighthouseWeather";

export type SoundRegion = "outside" | "house" | "balcony" | "tower" | "lantern" | "gallery" | "service";
export type SoundscapeState = {
  firstPerson: boolean; x: number; y: number; feet: number; yaw: number; shoreDistance: number;
  hour?: number;
  weather: {rain: number; kind: LighthouseWeatherKind; from: LighthouseWeatherKind; transition: number};
  pauses: readonly string[]; doors: Readonly<Record<string, number>>;
  beacon?: {running: boolean; visible: boolean};
  scooter: {riding: boolean; speed: number; heading: number; forward: boolean; back: boolean; brake: boolean; exitRequested: boolean};
};
type Sink = { world(targets: readonly WorldAudioTarget[]): void; resetWorld(): void; stopEntity(entity: string): void; play(cue: AudioCue, entity?: string): void };
const clamp = (n: number, a = 0, b = 1) => Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
const winds = {clear: .20, overcast: .35, fog: .15, storm: .85};
const distance = (x: number, y: number, a: number, b: number) => Math.hypot(x-a,y-b);

/** Geometry-only acoustic zones, with 12cm hysteresis; no raycasts or weather RNG consumption. */
export function soundRegion(s: SoundscapeState, previous: SoundRegion = "outside"): SoundRegion {
  if (!s.firstPerson || ![s.x,s.y,s.feet].every(Number.isFinite)) return "outside";
  const room = houseRoomAt(s.x,s.y), margin = previous === "house" ? .12 : 0;
  if (s.feet < 2.9 && s.feet > -.2 && ((room && room.id !== "balcony")
    || margin && s.x >= -margin && s.x <= 10.8+margin && s.y >= -margin && s.y <= 10.8+margin)) return "house";
  if (room?.id === "balcony" && s.feet < 2.9) return "balcony";
  const t = COASTAL_SITE.tower, r = distance(s.x,s.y,t.x,t.y);
  if (s.feet >= LIGHTHOUSE.gallery-.3 && s.feet < LIGHTHOUSE.gallery+3.5) {
    if (r < LIGHTHOUSE.lanternRadius + (previous === "lantern" ? .12 : -.05)) return "lantern";
    if (r < LIGHTHOUSE.galleryRadius+.2) return "gallery";
  }
  if (s.feet >= LIGHTHOUSE.floor-.3 && s.feet < LIGHTHOUSE.gallery-.3
    && r < t.radius-.28 + (previous === "tower" ? .12 : 0)) return "tower";
  const service = LIGHTHOUSE_SERVICE_ROOM;
  if (Math.abs(s.x-t.x-service.x) < service.width/2+.05 && Math.abs(s.y-t.y-service.y) < service.depth/2+.05
    && s.feet >= service.floor-.3 && s.feet < service.floor+service.clearHeight) return "service";
  return "outside";
}

export class RoomSoundscape {
  private region: SoundRegion = "outside";
  private readonly gains = new Map<string, number>();
  private rate = .65;
  private elapsed = 0;
  private lastSpeed = 0;
  private braking = false;
  private birdWait?: number;
  private latest?: {region: SoundRegion; wind: number; rain: number; exposure: number; birdInSeconds?: number; targets: readonly WorldAudioTarget[]};
  constructor(private readonly audio: Sink, private readonly random: () => number = Math.random) {}
  get diagnostics() { return this.latest; }
  private stopContacts() { this.audio.stopEntity("scooter-brake"); this.audio.stopEntity("scooter-contact"); }
  reset() { this.audio.resetWorld(); this.stopContacts(); this.audio.stopEntity("ambient-birds"); this.birdWait=undefined; this.gains.clear(); this.lastSpeed = 0; this.braking = false; this.rate = .65; this.region = "outside"; this.latest = undefined; }
  update(seconds: number, s: SoundscapeState) {
    const dt = clamp(seconds, 0, .2);
    const hardPause = s.pauses.some(r => ["settings","inspector","external","blur","hidden"].includes(r));
    if (hardPause) { this.reset(); return; }
    this.elapsed += dt;
    this.region = soundRegion(s,this.region);
    let exposure = 1, rainExposure = 1;
    if (this.region === "house") {
      let window = 0, opening = 0;
      for (const w of HOUSE_WINDOWS) window = Math.max(window,clamp(1-distance(s.x,s.y,w.x+(w.axis==="x"?w.width/2:0),w.y+(w.axis==="y"?w.width/2:0))/1.5));
      for (const door of HOUSE_DOORS.filter(d => d.to === "outside" || d.sliding)) {
        const near = clamp(1-distance(s.x,s.y,door.x+(door.axis==="x"?door.width/2:0),door.y+(door.axis==="y"?door.width/2:0))/1.5);
        opening = Math.max(opening,near*clamp(s.doors[door.id]));
      }
      exposure = .08 + .17*window + .45*opening; rainExposure = .015+.055*window+.10*opening;
    } else if (this.region === "tower") {
      const t = COASTAL_SITE.tower, near = clamp(1-distance(s.x,s.y,t.x,t.y+LIGHTHOUSE.doorY)/1.5);
      exposure = .07+.5*near*clamp(s.doors["lighthouse-entry-door"]); rainExposure = .025+.08*near*clamp(s.doors["lighthouse-entry-door"]);
    } else if (this.region === "lantern") { exposure = .28; rainExposure = .05; }
    else if (this.region === "service") { exposure = .13; rainExposure = .04; }
    // The current roof/rain shelter includes the balcony and gallery eaves: exposed wind, roof rain.
    else if (this.region === "balcony" || this.region === "gallery") { exposure = .9; rainExposure = .23; }
    const rain = clamp(s.weather.rain), t = clamp(s.weather.transition);
    const wind = (winds[s.weather.from] ?? .2)*(1-t)+(winds[s.weather.kind] ?? .2)*t;
    const reading = s.pauses.length > 0;
    if (reading) this.stopContacts();
    const background = (s.firstPerson ? 1 : .22)*(reading ? .35 : 1);
    const sea = .055*clamp(1/(1+Math.abs(s.shoreDistance)*.07),.28,1)*background;
    const windGain = (.018+.035*wind)*(1+.05*Math.sin(this.elapsed*.27))*background;
    const rainGain = .09*rain*background;
    const hour=s.hour ?? 12;
    const birds=s.firstPerson && !reading && exposure>.65 && rain<.2 && hour>=7 && hour<19
      && [s.x,s.y,s.feet].every(Number.isFinite);
    if (!birds) {
      if(this.birdWait!==undefined)this.audio.stopEntity("ambient-birds");
      this.birdWait=undefined;
    } else if(this.birdWait===undefined) this.birdWait=18+12*clamp(this.random());
    else {
      this.birdWait-=dt;
      if(this.birdWait<=0) {this.audio.play("bird-call","ambient-birds");this.birdWait=32+30*clamp(this.random());}
    }
    const driving = s.firstPerson && !reading && s.scooter.riding;
    const speed = driving ? Math.abs(s.scooter.speed) : 0, n = clamp(speed/(40/3.6));
    const braking = driving && (s.scooter.brake || s.scooter.exitRequested || s.scooter.forward && s.scooter.back
      || s.scooter.speed*(s.scooter.back ? -1 : s.scooter.forward ? 1 : 0)<0);
    if (braking && !this.braking && this.lastSpeed > .4 && speed < this.lastSpeed-.005) this.audio.play("scooter-brake","scooter-brake");
    this.braking = braking; this.lastSpeed = speed;
    const powered = (s.scooter.forward || s.scooter.back) && !braking;
    const motor = speed > .04 ? (.035+.15*Math.sqrt(n))*(powered ? 1 : .62) : 0;
    const roll = speed > .04 ? .13*Math.pow(n,.65) : 0;
    this.rate += (.65+1.05*Math.sqrt(n)-this.rate)*(1-Math.exp(-dt/.1));
    const pan = clamp(.18*Math.sin(s.scooter.heading-s.yaw),-.18,.18);
    const tower=COASTAL_SITE.tower, beaconDistance=distance(s.x,s.y,tower.x,tower.y);
    const beacon=s.firstPerson && !reading && !s.scooter.riding && s.beacon?.running && s.beacon.visible
      && Math.abs(s.feet-LIGHTHOUSE.gallery)<2 ? .18*clamp(1-beaconDistance/7) : 0;
    const desired: WorldAudioTarget[] = [
      {id:"sea-open",gain:sea*exposure}, {id:"sea-sheltered",gain:sea*(1-exposure)*.5},
      {id:"wind-open",gain:windGain*exposure}, {id:"wind-sheltered",gain:windGain*(1-exposure)*.35},
      {id:"rain-open",gain:rainGain*rainExposure}, {id:"rain-sheltered",gain:rainGain*(1-rainExposure)*.52},
      {id:"motor-loop",gain:motor,rate:this.rate,pan}, {id:"roll-loop",gain:roll,rate:.7+.6*n,pan:pan*.6},
      {id:"beacon-drive",gain:beacon,position:planToWorld(tower,LIGHTHOUSE.gallery+.65)},
    ];
    const targets = desired.map(value => {
      const previous = this.gains.get(value.id) ?? 0;
      const vehicle = value.id === "motor-loop" || value.id === "roll-loop";
      const device = value.id === "beacon-drive";
      const smoothing = vehicle ? .1 : value.id.startsWith("rain-") ? .25 : .35;
      const gain = (vehicle || device) && !value.gain ? 0 : previous+(value.gain-previous)*(1-Math.exp(-dt/smoothing));
      this.gains.set(value.id,gain);
      return {...value,gain};
    });
    this.latest = {region:this.region,wind,rain,exposure,birdInSeconds:this.birdWait,targets};
    this.audio.world(targets);
  }
}
