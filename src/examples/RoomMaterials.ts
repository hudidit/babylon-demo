import { Color3, PBRMaterial, Texture } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";

/** Local, 1K PBR maps. ARM is linear: occlusion in R, roughness in G, metalness in B. */
export function surfaceMaterial(name: string, scene: Scene, color: string, roughness = 0.75) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = Color3.FromHexString(color).toLinearSpace();
  material.metallic = 0;
  material.roughness = roughness;
  material.maxSimultaneousLights = 4;
  material.usePhysicalLightFalloff = false;
  return material;
}

export function mappedMaterial(name: string, scene: Scene, asset: string,
  color = "#ffffff", repeat = 1, normalStrength = 0.35, useColor = true) {
  const material = surfaceMaterial(name, scene, color, 1);
  const load = (file: string, gamma: boolean) => {
    const texture = new Texture(`./textures/study/${asset}/${file}.jpg`, scene);
    texture.gammaSpace = gamma;
    texture.uScale = texture.vScale = repeat;
    texture.anisotropicFilteringLevel = 8;
    return texture;
  };
  if (useColor) material.albedoTexture = load("color", true);
  material.bumpTexture = load("normal", false);
  material.bumpTexture.level = normalStrength;
  // Match the glTF loader's OpenGL tangent-space convention in our left-handed scene.
  material.invertNormalMapX = !scene.useRightHandedSystem;
  material.invertNormalMapY = scene.useRightHandedSystem;
  material.metallicTexture = load("arm", false);
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.ambientTextureStrength = 0.35;
  return material;
}

export function linenMaterial(name: string, scene: Scene, color: string, repeat = 7) {
  const material = mappedMaterial(name, scene, "rough_linen", color, repeat, 0.22, false);
  material.sheen.isEnabled = true;
  material.sheen.intensity = 0.22;
  material.sheen.roughness = 0.9;
  return material;
}

/** Clone every map together so the wall's colour, normal and ARM UVs stay aligned. */
export function tileMaterial(material: PBRMaterial, name: string, u: number, v: number) {
  const clone = material.clone(name)!;
  for (const key of ["albedoTexture", "bumpTexture", "metallicTexture"] as const) {
    const texture = material[key] as Texture | null;
    if (!texture) continue;
    const tiled = texture.clone()!;
    tiled.uScale = u;
    tiled.vScale = v;
    clone[key] = tiled;
  }
  return clone;
}
