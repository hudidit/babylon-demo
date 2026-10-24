import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.pure";
import type { Camera } from "@babylonjs/core/pure";
import type { AudioBus } from "@babylonjs/core/AudioV2/abstractAudio/audioBus";
import type { AudioPoint, AudioGroup, AudioMix } from "./RoomAudioCatalog";

/** Only the Audio V2 boundary is injected in policy tests; no second runtime audio library. */
export interface AudioBufferData { length: number; channelCount: number }
export interface AudioVoice {
  play(gain: number, rate: number, position?: AudioPoint, uiOverride?: boolean): void;
  position(position: AudioPoint): void;
  update(gain: number, rate: number, pan: number): void;
  stop(fade?: boolean): void;
  ended(callback: () => void): void;
  dispose(): void;
}
export interface AudioBackend {
  decode(data: ArrayBuffer): Promise<AudioBufferData>;
  voice(buffer: AudioBufferData, name: string, ui: boolean, loop?: boolean, group?: AudioGroup): Promise<AudioVoice>;
  mix(value: AudioMix): void;
  volume(value: number): void;
  listener(camera: Camera): void;
  dispose(): void;
}

export async function createAudioBackend(context: AudioContext): Promise<AudioBackend> {
  const engine = await CreateAudioEngineAsync({ audioContext: context, disableDefaultUI: true,
    resumeOnInteraction: false, resumeOnPause: false, disableIOSRingerSwitchWorkaround: true,
    listenerEnabled: true, listenerAutoUpdate: false, volume: 0, parameterRampDuration: 0.01 });
  const buses: AudioBus[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    // 9.30 disposes registered buses in insertion order; nested children must detach first.
    for (const bus of buses.reverse()) bus.dispose();
    engine.dispose();
  };
  try {
    const effects = await engine.createBusAsync("room-effects", { volume: 0.8 });
    buses.push(effects);
    const ui = await engine.createBusAsync("room-ui", { volume: 0.5 });
    buses.push(ui);
    const ambience = await engine.createBusAsync("room-ambience", {volume: .65});
    buses.push(ambience);
    const vehicle = await engine.createBusAsync("room-vehicle", {outBus: effects, volume: 1});
    buses.push(vehicle);
    return {
      decode: data => engine.createSoundBufferAsync(data),
      async voice(buffer, name, isUI, loop = false, group = "actions") {
        const world = group === "ambience" || name.startsWith("motor-loop-") || name.startsWith("roll-loop-");
        const sound = await engine.createSoundAsync(name, buffer as Awaited<ReturnType<typeof engine.createSoundBufferAsync>>, {
          autoplay: false, loop, maxInstances: 1, outBus: isUI ? ui : group === "ambience" ? ambience : group === "vehicle" ? vehicle : effects,
          stereoEnabled: world, spatialEnabled: !world, spatialAutoUpdate: false, spatialPanningModel: "equalpower",
          spatialDistanceModel: "inverse", spatialMinDistance: 4, spatialRolloffFactor: 0,
          spatialPanningEnabled: false });
        const position = (point: AudioPoint) => {
          // The room is left-handed; mirror Z for both source and listener to preserve left/right.
          sound.spatial.position.set(point.x, point.y, -point.z);
          sound.spatial.update();
        };
        return {
          play(gain, rate, point, uiOverride = isUI) {
            sound.outBus = uiOverride ? ui : group === "ambience" ? ambience : group === "vehicle" ? vehicle : effects;
            if (!world) { sound.spatial.panningEnabled = !!point;
              sound.spatial.rolloffFactor = point ? 0.9 : 0;
              if (point) position(point); }
            sound.playbackRate = rate;
            sound.setVolume(gain, { duration: 0 });
            sound.play();
          },
          position,
          update(gain, rate, pan) {
            sound.setVolume(gain, {duration: .06}); sound.playbackRate = rate;
            if (world) sound.stereo.pan = pan;
          },
          stop(fade = true) {
            if (fade && context.state === "running") {
              sound.setVolume(0, { duration: 0.015 });
              sound.stop({ waitTime: 0.02 });
            } else sound.stop();
          },
          ended: callback => { sound.onEndedObservable.add(callback); },
          dispose: () => sound.dispose(),
        };
      },
      mix(value) { effects.setVolume(.8*value.actions); ui.setVolume(.5*value.ui); ambience.setVolume(.65*value.ambience); },
      volume: value => engine.setVolume(value, { duration: 0.015 }),
      listener(camera) {
        const point = camera.globalPosition, forward = camera.getForwardRay().direction;
        const up = camera.getDirection(Vector3.UpReadOnly), listener = context.listener;
        engine.listener.position.set(point.x, point.y, -point.z);
        engine.listener.update();
        if (listener.forwardX) {
          for (const [parameter, value] of [[listener.forwardX, forward.x], [listener.forwardY, forward.y],
            [listener.forwardZ, -forward.z], [listener.upX, up.x], [listener.upY, up.y], [listener.upZ, -up.z]] as [AudioParam, number][]) {
            parameter.setTargetAtTime(value, context.currentTime, 0.01);
          }
        } else listener.setOrientation(forward.x, forward.y, -forward.z, up.x, up.y, -up.z);
      },
      dispose, // Audio V2 closes its explicitly supplied context too.
    };
  } catch (error) { dispose(); throw error; }
}
