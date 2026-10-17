import { Color3, CreateBox, CreateGround, StandardMaterial, VertexBuffer } from "@babylonjs/core/pure";
import type { Mesh, Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_DOORS, HOUSE_ROOMS, worldToPlan } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";
import { houseWallSpans, HOUSE_CUT_HEIGHT, HOUSE_DOOR_HEIGHT, HOUSE_WINDOWS } from "./HouseStructure";
import { houseVector } from "./HouseWalking";
import { mappedMaterial, paintedWallMaterial, tileMaterial } from "./RoomMaterials";
import { setRoomOwners } from "./RoomOwnership";
import type { RoomFurnishings } from "./RoomFurnishings";

/** One physical wall per span. Cutaway changes visibility, never collision enablement. */
export function createHouseArchitecture(scene: Scene, furniture: RoomFurnishings) {
  const c = HOUSE_COORDINATES, u = c.unitsPerMeter;
  const oak = mappedMaterial("oak-floor", scene, "wood_floor", "#e7ddd0", 1, 0.28);
  const paint = paintedWallMaterial(scene);
  const plaster = new StandardMaterial("house-ceiling", scene);
  plaster.diffuseColor = Color3.FromHexString("#e2d2af"); plaster.specularColor = Color3.Black();
  plaster.emissiveColor = new Color3(0.38, 0.36, 0.32);
  const hidden: Mesh[] = [], ceilings: Mesh[] = [];
  const box = (name: string, axis: "x" | "y", at: number, start: number, end: number,
    bottom: number, top: number, owners: HouseRoomId[], thickness: number = c.wallThickness) => {
    const mesh = CreateBox(name, { width: (axis === "x" ? end - start : thickness) * u,
      depth: (axis === "y" ? end - start : thickness) * u, height: (top - bottom) * u }, scene);
    mesh.position.copyFrom(houseVector(axis === "x" ? (start + end) / 2 : at,
      axis === "y" ? (start + end) / 2 : at, (bottom + top) / 2));
    mesh.material = paint; mesh.receiveShadows = mesh.checkCollisions = true; mesh.isPickable = false;
    setRoomOwners(mesh, owners);
    // Physical UV scale independent of subdivision; no per-span texture or material clones.
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!, normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    for (let i = 0; i < positions.length / 3; i++) {
      uv[i * 2] = (Math.abs(normals[i * 3]) > 0.5 ? positions[i * 3 + 2] + mesh.position.z : positions[i * 3] + mesh.position.x) / 6;
      uv[i * 2 + 1] = (positions[i * 3 + 1] + mesh.position.y) / 6;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv); mesh.freezeWorldMatrix();
    return mesh;
  };
  HOUSE_ROOMS.forEach(r => {
    const floor = CreateGround(r.id + "-oak-floor", { width: r.width * u, height: r.depth * u }, scene);
    floor.position.copyFrom(houseVector(r.x + r.width / 2, r.y + r.depth / 2));
    floor.material = tileMaterial(oak, r.id + "-floor", r.width / 1.6, r.depth / 1.6);
    floor.receiveShadows = floor.checkCollisions = true; floor.isPickable = false;
    floor.metadata = { castsShadows: false, structure: "floor" }; setRoomOwners(floor, [r.id]); floor.freezeWorldMatrix();
    furniture.section(r.id, r.id + "-foundation", () => {
      furniture.box("foundation", [r.width * u, 0.4, r.depth * u],
        [floor.position.x, c.floorY - 0.22, floor.position.z], "darkWood");
    });
    if (r.id === "balcony") return;
    const ceiling = CreateBox(r.id + "-ceiling", { width: r.width * u, height: 0.25, depth: r.depth * u }, scene);
    ceiling.position.copyFrom(houseVector(r.x + r.width / 2, r.y + r.depth / 2, c.clearHeight + 0.025));
    // Direct window cones and lamps light the room below; the ceiling receives indirect bounce only.
    ceiling.material = plaster; ceiling.isPickable = false; ceiling.metadata = { castsShadows: false, lightRooms: [] };
    setRoomOwners(ceiling, [r.id]); ceiling.freezeWorldMatrix(); ceilings.push(ceiling);
  });
  houseWallSpans().forEach((span, i) => {
    const { axis, at, start, end, bottom, top, owners, rail } = span;
    if (rail) {
      const collider = box("balcony-safety-" + i, axis, at, start, end, 0, 1.1, owners);
      collider.isVisible = false; collider.metadata.collisionOnly = true;
      furniture.section("balcony", "balcony-rail-" + i, () => {
        const make = (name: string, offset: number, width: number, height: number, h: number) => {
          const p = houseVector(axis === "x" ? offset : at, axis === "y" ? offset : at, h);
          furniture.box(name, [axis === "x" ? width * u : 0.12, height * u, axis === "y" ? width * u : 0.12],
            [p.x, p.y, p.z], "darkWood");
        };
        make("balcony-handrail", (start + end) / 2, end - start, 0.05, 1.1);
        make("balcony-bottom-rail", (start + end) / 2, end - start, 0.04, 0.12);
        const count = Math.ceil((end - start) / 0.1);
        for (let n = 0; n <= count; n++) make("balcony-baluster", start + (end - start) * n / count, 0.025, 1.1, 0.55);
      });
      return;
    }
    const cut = Math.min(top, Math.max(bottom, HOUSE_CUT_HEIGHT));
    for (const [low, high] of [[bottom, cut], [cut, top]]) {
      if (high - low < 1e-6) continue;
      const wall = box(`house-wall-${i}-${low < HOUSE_CUT_HEIGHT ? "low" : "upper"}`, axis, at, start, end, low, high, owners);
      wall.metadata.structure = "wall"; wall.metadata.span = span;
      if (low >= HOUSE_CUT_HEIGHT) hidden.push(wall);
    }
    // Skirting stops at every door opening; it never bridges the threshold.
    if (bottom === 0) furniture.section(owners[0], "house-skirting-" + i, () => {
      const p = houseVector(axis === "x" ? (start + end) / 2 : at, axis === "y" ? (start + end) / 2 : at, 0.055);
      const trim = furniture.box("house-skirting", [axis === "x" ? (end - start) * u : 0.62, 0.45,
        axis === "y" ? (end - start) * u : 0.62], [p.x, p.y, p.z], "darkWood");
      setRoomOwners(trim, owners);
    }).forEach(m => setRoomOwners(m, owners));
    for (const id of owners.filter(id => id === "study" || id === "living")) {
      const r = HOUSE_ROOMS.find(r => r.id === id)!;
      const inside = Math.sign((axis === "x" ? r.y + r.depth / 2 : r.x + r.width / 2) - at);
      const face = at + inside * 0.067;
      const detail = (name: string, h: number, height: number, depth: number, material: string, offset = (start + end) / 2, length = end - start) => {
        const p = houseVector(axis === "x" ? offset : face, axis === "y" ? offset : face, h);
        furniture.box(name, [axis === "x" ? length * u : depth, height * u, axis === "y" ? length * u : depth],
          [p.x, p.y, p.z], material);
      };
      if (bottom === 0) furniture.section(id, id + "-wainscot-" + i, () => {
        detail("house-wainscot", 0.26, 0.5, 0.08, "darkWood");
        detail("house-chair-rail", 0.52, 0.035, 0.14, "wood");
        detail("house-brass-inlay", 0.545, 0.009, 0.15, "brass");
        for (let offset = start + 0.18; offset < end - 0.08; offset += 0.64)
          detail("house-panel-stile", 0.26, 0.42, 0.13, "wood", offset, 0.025);
      });
      if (top === c.clearHeight) furniture.section(id, id + "-cornice-" + i, () => {
        detail("house-cornice", 2.72, 0.065, 0.3, "darkWood");
        detail("house-cornice-inlay", 2.67, 0.012, 0.31, "brass");
      }).forEach(m => { m.metadata.cut = { axis, at }; hidden.push(m); });
    }
  });
  HOUSE_DOORS.forEach(d => {
    const owners = d.to === "outside" ? [d.from] : [d.from, d.to];
    const start = d.axis === "x" ? d.x : d.y, at = d.axis === "x" ? d.y : d.x;
    for (const edge of [start, start + d.width]) {
      const jamb = box(d.id + "-jamb", d.axis, at, edge - 0.04, edge + 0.04, 0, HOUSE_DOOR_HEIGHT, owners, 0.18);
      jamb.material = scene.getMaterialByName("wood"); jamb.metadata.cut = { axis: d.axis, at }; hidden.push(jamb);
    }
    const header = box(d.id + "-header", d.axis, at, start - 0.04, start + d.width + 0.04,
      HOUSE_DOOR_HEIGHT, HOUSE_DOOR_HEIGHT + 0.08, owners, 0.18);
    header.material = scene.getMaterialByName("wood"); header.metadata.cut = { axis: d.axis, at }; hidden.push(header);
    furniture.houseDoor(d);
  });
  HOUSE_WINDOWS.forEach(w => {
    const p = houseVector(w.x + (w.axis === "x" ? w.width / 2 : 0), w.y + (w.axis === "y" ? w.width / 2 : 0), w.sill + w.height / 2);
    furniture.section(w.room, w.id, () => {
      const root = furniture.window([p.x, p.y, p.z], w.axis === "x" ? Math.PI : w.x === 0 ? -Math.PI / 2 : Math.PI / 2, w.id);
      // Resize this architectural component to the actual opening, before merging/freezing.
      root.scaling.set(w.width * u / 10.3, w.height * u / 7.5, 1);
    }).forEach(m => { m.metadata.cut = { axis: w.axis, at: w.axis === "x" ? w.y : w.x }; hidden.push(m); });
  });
  // Exterior is intentionally not playable, including when the entrance leaf is open.
  const entry = HOUSE_DOORS.find(d => d.id === "entry-door")!;
  const boundary = box("entry-outside-boundary", "y", entry.x + 0.08, entry.y, entry.y + entry.width,
    0, HOUSE_DOOR_HEIGHT, ["living"], 0.02);
  boundary.isVisible = false; boundary.metadata.collisionOnly = true;
  for (const [id, x, y, h, width, height, yaw, axis, edge] of [
    ["study", 5.53, 1.4, 1.65, 4.5, 2.7, -Math.PI / 2, "y", 5.4],
    ["living", 10.67, 6.15, 1.7, 5.3, 2.6, Math.PI / 2, "y", 10.8],
  ] as const) {
    const p = houseVector(x, y, h);
    furniture.section(id, id + "-wall-art", () => furniture.framedArt(id + "-landscape",
      "./textures/pictures/pic1.jpg", [p.x, p.y, p.z], width, height, yaw))
      .forEach(m => { m.metadata.cut = { axis, at: edge }; hidden.push(m); });
  }
  let enclosed = false, view = "overview";
  return { setEnclosed(value: boolean, nextView = "overview") {
    enclosed = value; view = nextView;
    hidden.forEach(m => m.isVisible = enclosed);
    ceilings.forEach(m => m.isVisible = enclosed);
  }, updateCutaway(position: { x: number; z: number }, target: { x: number; z: number }) {
    if (enclosed || view === "overview") return false;
    const room = ["study", "desk", "details"].includes(view) ? "study"
      : ["master", "ensuite", "bedroom", "kitchen", "bathroom"].includes(view) ? view : "living";
    const camera = worldToPlan(position), focus = worldToPlan(target);
    let changed = false;
    hidden.forEach(m => {
      const edge = m.metadata?.span || m.metadata?.cut;
      const farSide = edge && (edge.axis === "x" ? (edge.at - focus.y) * (camera.y - focus.y) <= 0
        : (edge.at - focus.x) * (camera.x - focus.x) <= 0);
      const visible = !!(m.metadata?.ownerRooms.includes(room) && farSide);
      if (m.isVisible !== visible) { m.isVisible = visible; changed = true; }
    });
    return changed;
  }, upperWalls: hidden, ceilings };
}
