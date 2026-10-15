import "./RoomShaders";
import {
  GamepadManager, RegisterGamepadSceneComponent,
  RegisterStandardEngineExtensions, RegisterAbstractEngineCubeTexture,
  RegisterEnginesExtensionsEngineCubeTexture, RegisterEnginesExtensionsEngineRenderTargetCube,
  RegisterEnginesExtensionsEngineRawTexture, RegisterEnginesExtensionsEngineDynamicTexture,
  RegisterEnginesExtensionsEngineMultiRender, RegisterEngineDynamicBuffer,
  RegisterStandardMaterial, RegisterPBRMaterial, RegisterTexture, RegisterRenderTargetTexture,
  RegisterCollisionCoordinator, RegisterRay,
} from "@babylonjs/core/pure";

/** Explicit WebGL features used by the study. Call before constructing its Engine/Scene. */
export function registerRoomRuntime() {
  // Textures, render targets and uniforms are required by all of the room's materials.
  RegisterStandardEngineExtensions();
  // HDR prefiltering, generated wear/letter textures and SSAO's multiple render targets.
  RegisterAbstractEngineCubeTexture();
  RegisterEnginesExtensionsEngineCubeTexture();
  RegisterEnginesExtensionsEngineRenderTargetCube();
  RegisterEnginesExtensionsEngineRawTexture();
  RegisterEnginesExtensionsEngineDynamicTexture();
  RegisterEnginesExtensionsEngineMultiRender();
  RegisterEngineDynamicBuffer();
  // Default material factory plus texture/material cloning and glTF PBR parsing.
  RegisterStandardMaterial();
  RegisterPBRMaterial();
  RegisterTexture();
  RegisterRenderTargetTexture();
  // Keep picking, exact mesh collisions and UniversalCamera's existing gamepad input.
  RegisterCollisionCoordinator();
  RegisterRay();
  RegisterGamepadSceneComponent(GamepadManager);
  // ShadowGenerator and the two pipeline constructors register their scene components.
}
