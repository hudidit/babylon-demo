import { BaseTexture, DynamicTexture, PBRMaterial, RawTexture, Scene, Texture } from "@babylonjs/core";

/** Fixed seeds keep subtle wear and colour choices stable across reloads. */
export function stableRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** R = albedo, B = roughness. G/A stay exactly neutral to preserve the scanned normals. */
export function buildWearMask(kind: "wood" | "brass" | "cover") {
  const size = kind === "wood" ? 512 : 256;
  const pixels = new Uint8Array(size * size * 4);
  const random = stableRandom(kind === "wood" ? 47 : kind === "brass" ? 83 : 109);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const edge = Math.exp(-Math.min(x, y, size - x - 1, size - y - 1) / (kind === "cover" ? 7 : 14));
    const mottling = Math.sin(x * 0.037) * Math.sin(y * 0.029) + Math.sin((x + y) * 0.016) * 0.4;
    const handled = kind === "wood" ? Math.exp(-(((x / size - 0.8) / 0.17) ** 2
      + ((y / size - 0.55) / 0.24) ** 2)) : 0;
    pixels[index] = Math.round(128 + edge * (kind === "cover" ? 18 : 5) + mottling * 1.5 + handled * 2);
    pixels[index + 1] = 128;
    pixels[index + 2] = Math.round(128 + edge * (kind === "cover" ? 24 : 8) + mottling * 5 - handled * 10);
    pixels[index + 3] = 128;
  }
  for (let scratch = 0; scratch < (kind === "wood" ? 85 : 40); scratch++) {
    const x = Math.floor(random() * size), y = Math.floor(random() * size);
    const length = Math.floor(2 + random() * (kind === "wood" ? 22 : 8));
    const blend = 0.12 + random() * 0.16;
    for (let step = 0; step < length && y + step < size; step++) {
      const index = ((y + step) * size + x) * 4;
      pixels[index] = Math.round(pixels[index] * (1 - blend) + 151 * blend);
      pixels[index + 2] = Math.round(pixels[index + 2] * (1 - blend) + 174 * blend);
    }
  }
  return { size, pixels };
}

export function wearTexture(name: string, scene: Scene, kind: "wood" | "brass" | "cover") {
  const { size, pixels } = buildWearMask(kind);
  const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene,
    true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = name;
  texture.gammaSpace = false;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

export function applyWear(material: PBRMaterial, texture: BaseTexture, diffuse = 0.18, roughness = 0.35) {
  material.detailMap.texture = texture;
  material.detailMap.isEnabled = true;
  material.detailMap.diffuseBlendLevel = diffuse;
  material.detailMap.roughnessBlendLevel = roughness;
  material.detailMap.bumpLevel = 0;
  return material;
}

export function letterTexture(scene: Scene) {
  const texture = new DynamicTexture("handwritten-letter", { width: 512, height: 768 }, scene, true);
  const c = texture.getContext();
  c.fillStyle = "#dbd1b7"; c.fillRect(0, 0, 512, 768);
  const tint = c.createLinearGradient(0, 0, 512, 768);
  tint.addColorStop(0, "rgba(248,241,220,0.45)"); tint.addColorStop(1, "rgba(120,96,59,0.08)");
  c.fillStyle = tint; c.fillRect(0, 0, 512, 768);
  const random = stableRandom(241);
  for (let i = 0; i < 1800; i++) {
    c.fillStyle = i % 2 ? "rgba(105,85,57,0.045)" : "rgba(255,250,227,0.07)";
    c.fillRect(random() * 512, random() * 768, 1, 1);
  }
  c.fillStyle = "#65594a"; c.font = "italic 27px Georgia, serif";
  c.fillText("A quiet afternoon", 52, 100);
  c.font = "italic 21px Georgia, serif";
  const lines = ["The light settles on the old desk,", "softly following the grain of the wood.",
    "A book left open, a cup still warm,", "and time enough to read another page.",
    "Beyond the window the trees stir.", "Here, for a while, everything is still."];
  lines.forEach((line, i) => c.fillText(line, 51 + (i % 3) * 2, 176 + i * 48));
  c.font = "italic 25px Georgia, serif"; c.fillText("October", 320, 590);
  const crease = c.createLinearGradient(0, 378, 0, 390);
  crease.addColorStop(0, "rgba(110,92,61,0)"); crease.addColorStop(0.5, "rgba(110,92,61,0.1)");
  crease.addColorStop(0.65, "rgba(255,251,232,0.15)"); crease.addColorStop(1, "rgba(110,92,61,0)");
  c.fillStyle = crease; c.fillRect(36, 378, 440, 12);
  texture.wAng = Math.PI;
  texture.anisotropicFilteringLevel = 8;
  texture.update(false);
  return texture;
}
