import { Color3, CreateBox, CreateGround, StandardMaterial, VertexBuffer } from "@babylonjs/core/pure";
import type { Mesh, Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_DOORS, HOUSE_ROOMS } from "./HouseLayout";
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
  plaster.emissiveColor = new Color3(0.1, 0.09, 0.07);
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
    ceiling.material = plaster; ceiling.isPickable = false; ceiling.metadata = { castsShadows: false };
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
  });
  HOUSE_DOORS.forEach(d => {
    const owners = d.to === "outside" ? [d.from] : [d.from, d.to];
    const start = d.axis === "x" ? d.x : d.y, at = d.axis === "x" ? d.y : d.x;
    for (const edge of [start, start + d.width]) {
      const jamb = box(d.id + "-jamb", d.axis, at, edge - 0.04, edge + 0.04, 0, HOUSE_DOOR_HEIGHT, owners, 0.18);
      jamb.material = scene.getMaterialByName("wood"); hidden.push(jamb);
    }
    const header = box(d.id + "-header", d.axis, at, start - 0.04, start + d.width + 0.04,
      HOUSE_DOOR_HEIGHT, HOUSE_DOOR_HEIGHT + 0.08, owners, 0.18);
    header.material = scene.getMaterialByName("wood"); hidden.push(header);
    furniture.houseDoor(d);
  });
  HOUSE_WINDOWS.forEach(w => {
    const p = houseVector(w.x + (w.axis === "x" ? w.width / 2 : 0), w.y + (w.axis === "y" ? w.width / 2 : 0), w.sill + w.height / 2);
    furniture.section(w.room, w.id, () => {
      const root = furniture.window([p.x, p.y, p.z], w.axis === "x" ? Math.PI : w.x === 0 ? -Math.PI / 2 : Math.PI / 2, w.id);
      // Resize this architectural component to the actual opening, before merging/freezing.
      root.scaling.set(w.width * u / 10.3, w.height * u / 7.5, 1);
    }).forEach(m => hidden.push(m));
  });
  // Exterior is intentionally not playable, including when the entrance leaf is open.
  const entry = HOUSE_DOORS.find(d => d.id === "entry-door")!;
  const boundary = box("entry-outside-boundary", "y", entry.x + 0.08, entry.y, entry.y + entry.width,
    0, HOUSE_DOOR_HEIGHT, ["living"], 0.02);
  boundary.isVisible = false; boundary.metadata.collisionOnly = true;
  return { setEnclosed(enclosed: boolean) {
    hidden.forEach(m => m.isVisible = enclosed);
    ceilings.forEach(m => m.isVisible = enclosed);
  }, upperWalls: hidden, ceilings };
}
