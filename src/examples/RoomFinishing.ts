import { Camera, DefaultRenderingPipeline, Scene } from "@babylonjs/core";

/** One final tone-mapping/AA chain after contact AO, shared by the two room cameras. */
export function createRoomFinishing(scene: Scene, cameras: Camera[]) {
  const caps = scene.getEngine().getCaps();
  const hdr = caps.textureHalfFloatRender || caps.textureFloatRender;
  const pipeline = new DefaultRenderingPipeline("room-finishing", hdr, scene, cameras, false);
  pipeline.samples = 1;
  pipeline.fxaaEnabled = true;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.12;
  pipeline.sharpen.colorAmount = 1;
  pipeline.bloomEnabled = hdr;
  pipeline.bloomScale = 0.5;
  pipeline.bloomKernel = 32;
  pipeline.bloomThreshold = 1.4;
  pipeline.bloomWeight = 0.06;
  pipeline.depthOfFieldEnabled = false;
  pipeline.chromaticAberrationEnabled = false;
  pipeline.grainEnabled = false;
  pipeline.prepare();
  return pipeline;
}
