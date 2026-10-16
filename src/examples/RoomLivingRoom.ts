import { CreateBox, CreateGround, CreatePlane, Vector3 } from "@babylonjs/core/pure";
import type { PBRMaterial, Scene, TransformNode } from "@babylonjs/core/pure";
import { setRoomOwners } from "./RoomOwnership";
import { tileMaterial } from "./RoomMaterials";
import type { RoomFurnishings } from "./RoomFurnishings";
import { CONNECTING_PASSAGE, LIVING_ROOM, SHARED_WALL_SPANS } from "./RoomLayout";

export { LIVING_ROOM } from "./RoomLayout";

/** Two rooms share a level floor and a single-door passage in their partition. */
export function constrainWalkingPosition(position: Vector3) {
  position.set(Math.max(-18.8, Math.min(LIVING_ROOM.maxX - 1.2, position.x)), 1,
    Math.max(-18.8, Math.min(18.8, position.z)));
}

/** Existing study wall, split all the way to the floor; shown only in enclosed mode. */
export function createSharedWall(scene: Scene, shell: TransformNode, paint: PBRMaterial) {
  const spans = [...SHARED_WALL_SPANS.map(span => ({ ...span, lintel: false })),
    { length: CONNECTING_PASSAGE.width, z: CONNECTING_PASSAGE.centerZ, lintel: true }];
  spans.forEach(({ length, z, lintel }, index) => {
    const height = lintel ? 3 : 14, y = lintel ? 7.5 : 2;
    const wall = CreateBox("shared-wall-" + index, { width: 0.5, height, depth: length }, scene);
    wall.position.set(20, y, z); wall.parent = shell;
    wall.material = tileMaterial(paint, wall.name + "-paint", length / 6, height / 6);
    wall.receiveShadows = wall.checkCollisions = true; wall.isPickable = false;
    setRoomOwners(wall, ["study", "living"]);
    // Legacy core boxes used study lights; the two facing planes have their own room lights.
    wall.metadata.lightRooms = ["study"];
    wall.freezeWorldMatrix();
    for (const side of [-1, 1]) {
      const face = CreatePlane(`shared-painted-facing-${index}-${side}`, { width: length, height }, scene);
      face.position.set(20 + side * 0.26, y, z); face.rotation.y = side * -Math.PI / 2;
      face.parent = shell; face.material = wall.material; face.receiveShadows = true; face.isPickable = false;
      face.metadata = { room: side > 0 ? "living" : "study", castsShadows: false };
      setRoomOwners(face, [side > 0 ? "living" : "study"]);
      face.freezeWorldMatrix();
    }
  });
}

/** A walnut-and-moss sitting room; all maps are shared with the original study. */
export function createLivingRoom(scene: Scene, room: RoomFurnishings, shell: TransformNode) {
  const paint = scene.getMaterialByName("warm-painted-wall") as PBRMaterial;
  const ground = CreateGround("living-oak-floor", { width: 34, height: 40 }, scene);
  ground.position.set(37, -5, 0);
  ground.material = tileMaterial(scene.getMaterialByName("oak-floor") as PBRMaterial, "living-oak-floor", 4.25, 5);
  ground.checkCollisions = ground.receiveShadows = true;
  ground.metadata = { room: "living", castsShadows: false };
  setRoomOwners(ground, ["living"]);
  ground.freezeWorldMatrix();
  const wall = (name: string, size: [number, number, number], position: [number, number, number], enclosed = false) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(...position); mesh.parent = enclosed ? shell : null;
    mesh.material = tileMaterial(paint, name + "-paint", Math.max(size[0], size[2]) / 6, size[1] / 6);
    mesh.metadata = { room: "living" };
    setRoomOwners(mesh, ["living"]);
    mesh.checkCollisions = mesh.receiveShadows = true; mesh.isPickable = false; mesh.freezeWorldMatrix();
    return mesh;
  };
  wall("living-back-wall", [34, 14, 0.5], [37, 2, -20]);
  const right = wall("living-right-wall", [0.5, 14, 40.5], [54, 2, 0], true);
  wall("living-front-wall", [34, 14, 0.5], [37, 2, 20], true);
  const facing = CreatePlane("living-right-painted-facing", { width: 40, height: 14 }, scene);
  facing.position.set(53.74, 2, 0); facing.rotation.y = Math.PI / 2; facing.parent = shell;
  facing.material = right.material; facing.receiveShadows = true; facing.isPickable = false;
  facing.metadata = { room: "living", castsShadows: false }; setRoomOwners(facing, ["living"]); facing.freezeWorldMatrix();

  room.section("living", "living", () => {
    room.box("foundation", [34.3, 0.6, 40.6], [37.15, -5.4, 0], "darkWood");
    panelWall(room, 34, [37, 0, -19.5]);
    // Cased opening with flush floor; there is no raised threshold to trip the walker.
    [CONNECTING_PASSAGE.minZ - 0.19, CONNECTING_PASSAGE.maxZ + 0.19].forEach(z => {
      room.box("passage-jamb", [1.1, 11.25, 0.38], [20, 0.625, z], "wood");
      room.box("passage-jamb-inlay", [1.14, 10.8, 0.055], [20, 0.4, z + (z < -5 ? 0.22 : -0.22)], "brass");
    });
    room.box("passage-header", [1.1, 0.45, CONNECTING_PASSAGE.width + 0.8], [20, 6.25, -5], "wood");
    room.box("passage-header-inlay", [1.14, 0.06, CONNECTING_PASSAGE.width + 0.7], [20, 6, -5], "brass");
    room.connectingDoor();

    // A three-seat sofa faces the fireplace, with armchairs flanking a clear circulation aisle.
    seat(room, "living-sofa", [37, -5, 8.5], 12, 0, "moss");
    seat(room, "living-chair-west", [28.5, -5, 1], 4.4, -Math.PI / 2, "cushion");
    seat(room, "living-chair-east", [45.5, -5, 1], 4.4, Math.PI / 2, "cream");
    const rug = room.box("persian-rug", [23, 0.055, 19], [37, -4.95, 1.8], "rug");
    rug.metadata = { ...rug.metadata, castsShadows: false };
    for (const z of [-7.9, 11.5]) for (let x = 25.7; x < 48.5; x += 0.38)
      room.box("rug-fringe", [0.07, 0.025, 0.35], [x, -4.95, z], "cream");
    const table = room.group("living-coffee-table", [37, -5, 1]);
    room.box("table-living-top", [7.5, 0.28, 4.4], [0, 2.2, 0], "coffee-wood", table);
    room.box("table-living-edge", [7.35, 0.12, 4.25], [0, 2, 0], "darkWood", table);
    room.box("table-living-lower-shelf", [6.5, 0.16, 3.4], [0, 0.65, 0], "wood", table);
    for (const x of [-3, 3]) for (const z of [-1.5, 1.5]) {
      room.cylinder("living-table-leg", 2.05, 0.16, [x, 1.025, z], "brass", table);
    }
    room.bookStack([-2, 2.34, -0.2], table);
    room.cylinder("living-tea-tray", 0.08, 2.1, [1.45, 2.38, 0], "brass", table);
    room.ring("living-tray-rim", 2.05, 0.06, [1.45, 2.43, 0], "brass", table);
    room.mug([1.1, 2.42, -0.25], "ceramic", table);
    room.mug([1.85, 2.42, 0.3], "navy", table);
    room.bookStack([-0.5, 0.73, 0.1], table);
    fireplace(room);
    displayCabinet(room);
    room.framedArt("living-landscape", "./textures/pictures/pic1.jpg", [37, 4, -18.85], 8, 3.8, Math.PI);
    room.window([48, 2.5, -19.35], Math.PI, "living-garden-window").scaling.set(0.8, 1, 1);
    room.plant([51, -5, -10], 1.05);
    room.plant([23.7, -5, 15.7], 1.05);
    room.cylinder("living-side-table-top", 0.22, 3.3, [45.2, -2.1, 9.2], "wood");
    room.cylinder("living-side-table-stem", 2.72, 0.2, [45.2, -3.58, 9.2], "brass");
    room.cylinder("living-side-table-foot", 0.12, 2, [45.2, -4.94, 9.2], "brass");
    room.tableLamp([45.2, -1.99, 9.2]);
    room.cylinder("living-vase-table", 0.2, 2.7, [29, -2.2, 10.5], "wood");
    room.cylinder("living-vase-table-base", 2.7, 0.65, [29, -3.65, 10.5], "darkWood");
    room.vase([29, -2.1, 10.5], 0.75);
  });

  room.section("living", "living-interior", () => {
    panelWall(room, 34, [37, 0, 19.5], Math.PI);
    panelWall(room, 40, [53.5, 0, 0], Math.PI / 2);
    SHARED_WALL_SPANS.forEach(({ length, z }) => panelWall(room, length, [20.5, 0, z], -Math.PI / 2));
    // Both sources are below the ceiling: receive their light without self-shadow bands.
    const ceiling = room.box("living-ceiling", [34, 0.5, 40], [37, 9.25, 0], "plaster");
    ceiling.metadata = { ...ceiling.metadata, castsShadows: false };
    for (const x of [28, 46]) room.box("living-ceiling-beam", [0.3, 0.22, 40], [x, 8.9, 0], "darkWood");
    for (const z of [-7, 7]) room.box("living-ceiling-beam", [34, 0.22, 0.3], [37, 8.9, z], "darkWood");
  }, shell);
}

function panelWall(room: RoomFurnishings, width: number, position: [number, number, number], rotation = 0) {
  const root = room.group("living-panel-wall", position, rotation);
  room.box("living-wainscot", [width, 2.5, 0.18], [0, -3.7, 0], "darkWood", root);
  for (const [name, y, height, depth, material] of [
    ["skirting", -4.75, 0.32, 0.32, "wood"], ["rail", -2.4, 0.16, 0.32, "wood"],
    ["inlay", -2.2, 0.045, 0.34, "brass"], ["cornice", 8.8, 0.4, 0.65, "darkWood"],
    ["cornice-gold", 8.52, 0.07, 0.7, "brass"],
  ] as const) room.box("living-" + name, [width, height, depth], [0, y, 0.1], material, root);
  for (let x = -width / 2 + 1; x < width / 2; x += 3.2)
    room.box("living-panel-stile", [0.1, 2.2, 0.24], [x, -3.6, 0.1], "wood", root);
}

function seat(room: RoomFurnishings, name: string, position: [number, number, number], width: number,
  rotation: number, material: string) {
  const root = room.group(name, position, rotation);
  room.box(name + "-frame", [width, 0.45, 4.2], [0, 1.15, 0], "darkWood", root);
  for (const x of [-width / 2 + 0.5, width / 2 - 0.5]) for (const z of [-1.6, 1.6]) {
    room.cylinder(name + "-foot", 0.95, 0.22, [x, 0.475, z], "wood", root, 0.32);
    room.cylinder(name + "-brass-sock", 0.2, 0.23, [x, 0.1, z], "brass", root);
  }
  const count = width > 5 ? 3 : 1, cushionWidth = (width - 1.5) / count;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * cushionWidth;
    room.paddedBox(name + "-seat", [cushionWidth - 0.07, 0.85, 3.45], [x, 1.78, -0.1], material, root);
    room.paddedBox(name + "-back", [cushionWidth - 0.06, 2.9, 0.85], [x, 3.05, 1.6], material, root)
      .rotation.x = -0.09;
    room.box(name + "-seat-piping", [cushionWidth - 0.2, 0.035, 0.035], [x, 1.78, -1.83], "cushion", root);
  }
  for (const side of [-1, 1]) {
    room.paddedBox(name + "-arm", [0.85, 1.9, 4.2], [side * (width / 2 - 0.36), 2.3, 0], material, root);
    if (count > 1) {
      const pillow = room.paddedBox(name + "-pillow", [1.9, 1.8, 0.65], [side * (width / 2 - 1.6), 2.85, 0.8],
        side < 0 ? "rust" : "cream", root);
      pillow.rotation.set(-0.2, side * 0.12, side * 0.18);
    }
  }
}

function fireplace(room: RoomFurnishings) {
  const root = room.group("living-fireplace", [37, -5, -17.6]);
  room.box("fireplace-hearth", [10.5, 0.22, 3.7], [0, 0.11, 0], "darkWood", root);
  room.box("fireplace-dark-recess", [6.5, 4.5, 0.3], [0, 2.47, -1.35], "black", root);
  for (const x of [-3.85, 3.85]) {
    room.box("fireplace-pier", [1.3, 4.9, 1.7], [x, 2.67, -0.4], "wood", root);
    room.box("fireplace-fluting", [0.85, 4.2, 0.12], [x, 2.7, 0.52], "darkWood", root);
    room.box("fireplace-brass-flute", [0.065, 3.7, 0.13], [x, 2.7, 0.6], "brass", root);
  }
  room.box("table-mantel", [10.4, 0.42, 2.5], [0, 5.32, -0.4], "wood", root);
  room.box("fireplace-frieze", [8.5, 0.9, 1.5], [0, 4.67, -0.4], "darkWood", root);
  room.box("fireplace-frieze-inlay", [7.8, 0.07, 0.04], [0, 4.67, 0.37], "brass", root);
  for (const x of [-2, 0, 2]) {
    const log = room.cylinder("fireplace-log", 3.1, 0.6, [x * 0.65, 0.56, -0.1], "wood", root);
    log.rotation.z = Math.PI / 2; log.rotation.y = x * 0.1;
  }
  for (const x of [-2.6, 2.6]) room.box("fireplace-andiron", [0.13, 0.8, 1.8], [x, 0.62, 0], "black", root);
  room.vase([-3.6, 5.53, -0.4], 0.55, root);
  room.bookStack([1.2, 5.53, -0.4], root);
}

function displayCabinet(room: RoomFurnishings) {
  const root = room.group("living-display-cabinet", [25.5, -5, -17.7]);
  room.box("living-cabinet-body", [6.5, 7.3, 0.22], [0, 4.1, -1.1], "darkWood", root);
  for (const x of [-3.2, 3.2]) room.box("living-cabinet-side", [0.25, 7.3, 2.5], [x, 4.1, 0], "wood", root);
  for (const y of [0.45, 2.9, 5.3, 7.75]) room.box("floating-shelf", [6.6, 0.23, 2.55], [0, y, 0], "wood", root);
  for (const x of [-2.7, 2.7]) room.box("living-cabinet-foot", [0.4, 0.45, 2.1], [x, 0.225, 0], "darkWood", root);
  for (const [x, y, scale] of [[-1.8, 0.565, 0.6], [1.9, 2.9 + 0.115, 0.55], [-1.8, 5.3 + 0.115, 0.55]]) {
    const shelf = room.group("living-shelf-accessories", [x, y, 0]); shelf.parent = root;
    room.vase([0, 0, 0], scale, shelf);
  }
  room.bookStack([0.8, 0.565, 0], root);
  room.bookStack([-1.7, 3.015, 0], root);
  room.bookStack([0.9, 5.415, 0], root);
}
