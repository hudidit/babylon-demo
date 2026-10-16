import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.pure";
import type { Camera } from "@babylonjs/core/pure";
import type { AudioPoint } from "./RoomAudioCatalog";

/** Only the Audio V2 boundary is injected in policy tests; no second runtime audio library. */
export interface AudioBufferData { length: number; channelCount: number }
export interface AudioVoice {
  play(gain: number, rate: number, position?: AudioPoint): void;
  position(position: AudioPoint): void;
  stop(fade?: boolean): void;
  ended(callback: () => void): void;
  dispose(): void;
}
export interface AudioBackend {
  decode(data: ArrayBuffer): Promise<AudioBufferData>;
  voice(buffer: AudioBufferData, name: string, ui: boolean): Promise<AudioVoice>;
  volume(value: number): void;
  listener(camera: Camera): void;
  dispose(): void;
}

export async function createAudioBackend(context: AudioContext): Promise<AudioBackend> {
  const engine = await CreateAudioEngineAsync({ audioContext: context, disableDefaultUI: true,
    resumeOnInteraction: false, resumeOnPause: false, disableIOSRingerSwitchWorkaround: true,
    listenerEnabled: true, listenerAutoUpdate: false, volume: 0, parameterRampDuration: 0.01 });
  try {
    const effects = await engine.createBusAsync("room-effects", { volume: 0.8 });
    const ui = await engine.createBusAsync("room-ui", { volume: 0.5 });
    return {
      decode: data => engine.createSoundBufferAsync(data),
      async voice(buffer, name, isUI) {
        const sound = await engine.createSoundAsync(name, buffer as Awaited<ReturnType<typeof engine.createSoundBufferAsync>>, {
          autoplay: false, loop: false, maxInstances: 1, outBus: isUI ? ui : effects,
          spatialEnabled: true, spatialAutoUpdate: false, spatialPanningModel: "equalpower",
          spatialDistanceModel: "inverse", spatialMinDistance: 4, spatialRolloffFactor: 0,
          spatialPanningEnabled: false });
        const position = (point: AudioPoint) => {
          // The room is left-handed; mirror Z for both source and listener to preserve left/right.
          sound.spatial.position.set(point.x, point.y, -point.z);
          sound.spatial.update();
        };
        return {
          play(gain, rate, point) {
            sound.spatial.panningEnabled = !!point;
            sound.spatial.rolloffFactor = point ? 0.9 : 0;
            if (point) position(point);
            sound.playbackRate = rate;
            sound.setVolume(gain, { duration: 0 });
            sound.play();
          },
          position,
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
      dispose: () => engine.dispose(), // Audio V2 closes its explicitly supplied context too.
    };
  } catch (error) { engine.dispose(); throw error; }
}
