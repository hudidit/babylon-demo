import { houseRoomAt, planToWorld } from "./HouseLayout";
import { LIGHTHOUSE } from "./LighthouseLayout";
import { COASTAL_SITE } from "./CoastalSite";
import type { WalkingSurface } from "./WalkingSurface";
import type { JumpPlatform } from "./HouseJump";
import type { AudioCue, AudioPoint, FootMaterial } from "./RoomAudioCatalog";

/** The support returned by physics, plus authored visible overlays; never a picking ray. */
export function footMaterial(surface: WalkingSurface, x: number, y: number, feet: number, platform?: JumpPlatform): FootMaterial {
  if (platform && Math.abs(feet-platform.top)<.06) return platform.id === "coffee-table" ? "wood" : "soft";
  const room=houseRoomAt(x,y);
  // Visible woven overlays in HouseContent / HouseSuite, below the physics floor tolerance.
  if ((room?.id==="master" && Math.abs(x-1.85)<1.4 && Math.abs(y-2.3)<1.4)
    || (room?.id==="study" && Math.abs(x-6.85)<.9 && Math.abs(y-1.65)<1.27)
    || (room?.id==="living" && Math.abs(x-8.65)<1.45 && Math.abs(y-8.4)<1.7)) return "soft";
  if (room) return ["ensuite","bathroom"].includes(room.id) && x>room.x+.05 && x<room.x+room.width-.05
    && y>room.y+.05 && y<room.y+room.depth-.05 ? "hard" : "wood";
  if (surface.lighthouse && feet>=LIGHTHOUSE.gallery-.06) return "metal";
  return surface.kind === "terrain" ? "earth" : "hard";
}
type Sink = {play(cue: AudioCue, entity?: string, position?: () => AudioPoint): void; stopEntity(entity: string): void};
type Walk = {x: number; y: number; feet: number; grounded: boolean; material: FootMaterial; landed: boolean; impact: number};

/** Called only after accepted movement/vertical physics. No keyboard, wall clock or game RNG. */
export class RoomDailyAudio {
  private previous?: Walk;
  private distance=0;
  private sinceStep=1;
  private idle=0;
  private climbDirection=0;
  constructor(private readonly audio: Sink) {}
  reset() {
    this.previous=undefined; this.distance=0; this.sinceStep=1; this.idle=0; this.climbDirection=0;
    this.audio.stopEntity("walker-feet"); this.audio.stopEntity("lighthouse-ladder-feet");
  }
  walk(seconds: number, state: Walk) {
    const previous=this.previous; this.previous={...state};
    if (!Number.isFinite(seconds) || seconds<=0 || seconds>.2 || ![state.x,state.y,state.feet].every(Number.isFinite)) {
      this.previous=undefined; this.distance=0; return;
    }
    this.sinceStep+=seconds;
    const travel=previous ? Math.hypot(state.x-previous.x,state.y-previous.y) : 0;
    if (!previous || travel>Math.max(.5,seconds*12)) {this.distance=0;return;}
    const point=planToWorld({x:state.x,y:state.y},state.feet+.12);
    if (state.landed && state.grounded && state.impact>.6) {
      this.audio.stopEntity("walker-feet"); this.audio.play(`landing-${state.material}`,"walker-feet",()=>point);
      this.distance=0; this.sinceStep=0; return;
    }
    if (!state.grounded || !previous.grounded) {this.distance=0;return;}
    if (travel<.001) {this.idle+=seconds;if(this.idle>.2)this.distance=0;return;}
    this.idle=0; this.distance+=travel;
    const stride=Math.min(.9,.62+Math.max(0,travel/seconds-2)*.06);
    if (this.distance>=stride && this.sinceStep>=.1) {
      // At most one new contact per frame; a hitch never queues a catch-up burst.
      this.distance%=stride; this.sinceStep=0;
      this.audio.play(`footstep-${state.material}`,"walker-feet",()=>point);
    }
  }
  climb(from: number, to: number) {
    const direction=Math.sign(to-from);
    if (direction!==this.climbDirection) this.audio.stopEntity("lighthouse-ladder-feet");
    this.climbDirection=direction;
    if (!direction || !Number.isFinite(from+to) || Math.abs(to-from)>.4) return;
    const rung=(height: number)=>Math.floor((height-LIGHTHOUSE.floor-.2+1e-7)/.28);
    if (rung(from)!==rung(to)) {
      const tower=COASTAL_SITE.tower, ladder=LIGHTHOUSE.ladder;
      const point=planToWorld({x:tower.x+ladder.x,y:tower.y+ladder.y},to+.12);
      this.audio.play("ladder-rung","lighthouse-ladder-feet",()=>point);
    }
  }
}
