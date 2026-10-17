import { Color3 } from "@babylonjs/core/pure";
import { COASTAL_CLIFF, coastalCrestY, coastalGroundHeight } from "./CoastalCliff";
import { planToWorld } from "./HouseLayout";
import type { CoastalGeometry } from "./CoastalCliff";
export type CoastalScatterGeometry = CoastalGeometry & { colors: number[] };

/** Fixed clusters, buried rocks, folded opaque blades and low woody cushions; never photo cards. */
export function coastalScatter() {
  const empty = (): CoastalScatterGeometry => ({ positions: [], indices: [], uvs: [], colors: [] });
  const rocks = empty(), plants = empty(); let seed: number = COASTAL_CLIFF.seed;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const vertex = (g: CoastalScatterGeometry, x: number, y: number, height: number, color: Color3) => {
    const p = planToWorld({ x, y }, height), i = g.positions.length / 3;
    g.positions.push(p.x, p.y, p.z); g.uvs.push(x / 2, (y + height) / 2);
    g.colors.push(color.r, color.g, color.b, 1); return i;
  };
  const stone = (x: number, y: number, size: number) => {
    const base = coastalGroundHeight(x, y) - size * .28, first = rocks.positions.length / 3;
    const angle = random() * Math.PI * 2, stretch = .65 + random() * .6;
    for (let row = 0; row <= 4; row++) for (let col = 0; col <= 8; col++) {
      const theta = row / 4 * Math.PI, phi = col / 8 * Math.PI * 2, rough = 1 + .16 * Math.sin(col * 5.3 + row * 9.7 + angle);
      const dx = Math.cos(phi) * Math.sin(theta) * size * rough, dy = Math.sin(phi) * Math.sin(theta) * size * stretch * rough;
      vertex(rocks, x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle),
        base + Math.cos(theta) * size * .5, Color3.FromHexString("#c4bbaa").toLinearSpace());
      const i = rocks.positions.length / 3 - 1;
      // Side projection includes height for standing faces; no flattened vertical normal map.
      rocks.uvs[i * 2] = (x + Math.cos(phi) * size) / 2;
      rocks.uvs[i * 2 + 1] = (base + Math.cos(theta) * size * .5 + Math.sin(phi) * size) / 2;
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      const a = first + row * 9 + col; rocks.indices.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
    }
  };
  const blade = (x: number, y: number, h: number, width: number, angle: number, color: Color3) => {
    const ground = coastalGroundHeight(x, y) - .025, dx = Math.cos(angle) * width, dy = Math.sin(angle) * width;
    const lean = .18 * h, i = plants.positions.length / 3;
    vertex(plants, x - dx, y - dy, ground, color.scale(.48));
    vertex(plants, x + dx, y + dy, ground, color.scale(.48));
    vertex(plants, x - dx * .5 + lean, y - dy * .5, ground + h * .55, color);
    vertex(plants, x + dx * .5 + lean, y + dy * .5, ground + h * .55, color.scale(.85));
    vertex(plants, x + lean * 2, y + h * .12, ground + h, color.scale(1.18));
    plants.indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3, i + 2, i + 4, i + 3);
  };
  const leaf = (x: number, y: number, phi: number, reach: number, height: number, color: Color3) => {
    const ground = coastalGroundHeight(x, y), i = plants.positions.length / 3;
    const dx = Math.cos(phi), dy = Math.sin(phi), width = reach * .18;
    vertex(plants, x, y, ground + height * .65, color.scale(.55));
    vertex(plants, x + dx * reach * .5 - dy * width, y + dy * reach * .5 + dx * width, ground + height, color);
    vertex(plants, x + dx * reach * .5, y + dy * reach * .5, ground + height + .055, color.scale(1.12));
    vertex(plants, x + dx * reach * .5 + dy * width, y + dy * reach * .5 - dx * width, ground + height, color.scale(.85));
    vertex(plants, x + dx * reach, y + dy * reach, ground + height * .88, color.scale(.95));
    plants.indices.push(i,i+1,i+2,i,i+2,i+3,i+1,i+4,i+2,i+2,i+4,i+3);
  };
  for (let n = 0; n < 1500; n++) {
    const x = -27 + random() * 61, y = -28 + random() * 84;
    if (x > -1 && x < 11.8 && y > -1 && y < 13.1 || y > coastalCrestY(x) - .45) continue;
    // Wind-worn bare streaks between clumps, with denser grasses beside the house.
    if (Math.sin(x * .46 + Math.sin(y * .27)) + Math.cos(y * .65) < -.5) continue;
    if (n % 11 === 0) stone(x, y, .25 + random() * .75);
    const bush = n % 19 === 0, radius = bush ? .36 : .14, h = bush ? .35 : .12;
    const color = Color3.FromHexString(bush ? "#747b4a" : n % 3 === 0 ? "#aaa376" : "#8e985b").toLinearSpace();
    for (let b = 0; b < (bush ? 20 : 9); b++) {
      const phi = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
      if (bush) { leaf(x + Math.cos(phi) * distance * .4, y + Math.sin(phi) * distance * .4,
        phi, .22 + random() * .28, .15 + random() * .32, color); continue; }
      blade(x + Math.cos(phi) * distance, y + Math.sin(phi) * distance, h + random() * (bush ? .27 : .32),
        bush ? .035 : .006 + random() * .008, phi, color);
    }
  }
  // A few anchored rock groups define the crest beside the main sea-facing composition.
  [[-8, 38, 1.1], [-7, 39, .65], [-3, 22, .8], [2, 16.4, .55], [14, 16.6, .75], [16, 15.9, .4]]
    .forEach(([x, y, s]) => { if (y < coastalCrestY(x)) stone(x, y, s); });
  return { rocks, plants };
}
