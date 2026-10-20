import { RawTexture, Texture } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { LIGHTHOUSE_EQUIPMENT } from "./LighthouseEquipmentLayout";

// Original bitmap lettering: no browser canvas, font download or external image dependency.
const glyphs: Record<string, string> = {
  A:"01110/10001/10001/11111/10001/10001/10001",B:"11110/10001/10001/11110/10001/10001/11110",
  C:"01111/10000/10000/10000/10000/10000/01111",D:"11110/10001/10001/10001/10001/10001/11110",
  E:"11111/10000/10000/11110/10000/10000/11111",F:"11111/10000/10000/11110/10000/10000/10000",
  G:"01111/10000/10000/10111/10001/10001/01111",H:"10001/10001/10001/11111/10001/10001/10001",
  I:"11111/00100/00100/00100/00100/00100/11111",J:"00111/00010/00010/00010/10010/10010/01100",
  K:"10001/10010/10100/11000/10100/10010/10001",L:"10000/10000/10000/10000/10000/10000/11111",
  M:"10001/11011/10101/10101/10001/10001/10001",N:"10001/11001/10101/10011/10001/10001/10001",
  O:"01110/10001/10001/10001/10001/10001/01110",P:"11110/10001/10001/11110/10000/10000/10000",
  Q:"01110/10001/10001/10001/10101/10010/01101",R:"11110/10001/10001/11110/10100/10010/10001",
  S:"01111/10000/10000/01110/00001/00001/11110",T:"11111/00100/00100/00100/00100/00100/00100",
  U:"10001/10001/10001/10001/10001/10001/01110",V:"10001/10001/10001/10001/10001/01010/00100",
  W:"10001/10001/10001/10101/10101/10101/01010",X:"10001/10001/01010/00100/01010/10001/10001",
  Y:"10001/10001/01010/00100/00100/00100/00100",Z:"11111/00001/00010/00100/01000/10000/11111",
  0:"01110/10001/10011/10101/11001/10001/01110",1:"00100/01100/00100/00100/00100/00100/01110",
  2:"01110/10001/00001/00010/00100/01000/11111",3:"11110/00001/00001/01110/00001/00001/11110",
  4:"00010/00110/01010/10010/11111/00010/00010",5:"11111/10000/10000/11110/00001/00001/11110",
  ":":"00000/00100/00100/00000/00100/00100/00000","-":"00000/00000/00000/11111/00000/00000/00000",
};
export const LIGHTHOUSE_LOG = ["COASTAL LIGHT", "MAINTENANCE LOG", "STATUS - SEE PANEL", "CHECK LENS AND DRIVE", "CHECK COVER SURFACE",
  "CHECK BEFORE SIGNING", "KEEP GALLERY CLEAR", "WORK LIGHT - SWITCH", "1 SERVICE", "2 LANTERN - GALLERY", "FICTIONAL SCENE LOG"];
export function lighthouseRecordPixels() {
  const width = 1024, height = 512, pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([231, 222, 197, 255], i);
  const rect = (x: number, y: number, w: number, h: number, color: number[]) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels.set(color, (yy * width + xx) * 4);
  };
  const text = (line: string, x: number, y: number, scale: number, color = [61, 77, 69, 255]) => {
    [...line].forEach((letter, i) => glyphs[letter]?.split("/").forEach((row, r) => [...row].forEach((v, c) => {
      if (v === "1") rect(x + i * 6 * scale + c * scale, y + r * scale, scale, scale, color);
    })));
  };
  LIGHTHOUSE_LOG.forEach((line, i) => text(line, 30, 28 + i * 43, i === 0 ? 4 : 3));
  rect(30, 103, 450, 2, [153, 139, 108, 255]);
  ["1 SERVICE", "2 GALLERY"].forEach((line, i) => {
    rect(512, i * 96, 512, 92, [48, 68, 63, 255]);
    text(line, 538, i * 96 + 26, 5, [240, 227, 183, 255]);
  });
  text("TEST", 538, 488, 2);
  return { width, height, pixels };
}
export function lighthouseRecordTexture(scene: Scene) {
  const { width, height, pixels } = lighthouseRecordPixels();
  const texture = RawTexture.CreateRGBATexture(pixels, width, height, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = "lighthouse-original-records-and-signs"; texture.gammaSpace = true;
  texture.anisotropicFilteringLevel = 8; return texture;
}

/** Seven installation plaques share one deterministic, original bitmap atlas. */
export function lighthouseEquipmentPixels() {
  const width = 256, height = 512, pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([48, 68, 63, 255], i);
  LIGHTHOUSE_EQUIPMENT.forEach((device, index) => device.lines.forEach((line, row) => {
    const scale = row ? 2 : 3, left = Math.floor((width - line.length * 6 * scale) / 2), top = index * 64 + (row ? 39 : 8);
    [...line].forEach((letter, column) => glyphs[letter]?.split("/").forEach((bits, y) => [...bits].forEach((bit, x) => {
      if (bit !== "1") return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++)
        pixels.set([240, 227, 183, 255], ((top + y * scale + dy) * width + left + column * 6 * scale + x * scale + dx) * 4);
    })));
  }));
  return { width, height, pixels };
}
