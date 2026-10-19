import { CreateCylinder, CreateTorus, CreateTube, Mesh, Vector3, VertexBuffer } from "@babylonjs/core/pure";
import type { Material, Scene, TransformNode } from "@babylonjs/core/pure";
import { curtainPanel, curtainPanelGeometry } from "./RoomDetailGeometry";
import { roomOwners, setRoomOwners } from "./RoomOwnership";
import type { InteractiveCurtain } from "./RoomInteractions";

/** Window-local batches keep their topology, materials and parent scale throughout the animation. */
export function createWindowCurtains(scene: Scene, root: TransformNode, id: string, label: string,
  materials: { linen: Material; brass: Material; tie: Material }): InteractiveCurtain {
  const cloth: Mesh[] = [], rings: Mesh[] = [], ties: Mesh[] = [];
  const closedPositions: number[] = [], closedNormals: number[] = [], ringOffsets: number[] = [];
  for (const side of [-1, 1]) {
    const panel = curtainPanel("linen-curtain", side, scene); panel.material = materials.linen; cloth.push(panel);
    const closed = curtainPanelGeometry(side, true);
    closedPositions.push(...closed.positions); closedNormals.push(...closed.normals);
    for (let i = 0; i < 7; i++) {
      const ring = CreateTorus("curtain-hanging-ring", { diameter: .24, thickness: .035, tessellation: 32 }, scene);
      ring.position.set(side * 5.55 + (i - 3) * .245, 4.53, -.72);
      ring.rotation.z = Math.PI / 2; ring.material = materials.brass; rings.push(ring);
      const offset = side * 3.18 + (i - 3) - ring.position.x;
      for (let vertex = 0; vertex < ring.getTotalVertices(); vertex++) ringOffsets.push(offset);
    }
    const path: Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = i / 20 * Math.PI * 2;
      path.push(new Vector3(side * 5.81 + Math.cos(angle) * .4, -1.33, -.79 + Math.sin(angle) * .14));
    }
    ties.push(CreateTube("curtain-tie", {path, radius: .045, tessellation: 6}, scene));
    ties.push(CreateTube("curtain-tassel-cord", {path: [new Vector3(side * 5.5, -1.33, -.96),
      new Vector3(side * 5.43, -1.63, -1.02), new Vector3(side * 5.48, -1.82, -1.01)], radius: .022, tessellation: 6}, scene));
    const tassel = CreateCylinder("curtain-tassel", {height: .26, diameterBottom: .14, diameterTop: .06, tessellation: 24}, scene);
    tassel.position.set(side * 5.48, -1.94, -1.01); ties.push(tassel);
  }
  ties.forEach(mesh => mesh.material = materials.tie);
  const batch = (parts: Mesh[], suffix: string) => {
    const mesh = Mesh.MergeMeshes(parts, true, true)!;
    mesh.name = id + "-" + suffix; mesh.parent = root;
    mesh.metadata = { softCurtain: true, castsShadows: true };
    setRoomOwners(mesh, roomOwners(root)); mesh.isPickable = mesh.checkCollisions = false; mesh.receiveShadows = true;
    return mesh;
  };
  const fabric = batch(cloth, "fabric"), hooks = batch(rings, "rings"), tie = batch(ties, "ties");
  const open = Float32Array.from(fabric.getVerticesData(VertexBuffer.PositionKind)!);
  const normals = Float32Array.from(fabric.getVerticesData(VertexBuffer.NormalKind)!);
  const positions = open.slice(), currentNormals = normals.slice();
  const openRings = Float32Array.from(hooks.getVerticesData(VertexBuffer.PositionKind)!), ringPositions = openRings.slice();
  fabric.setVerticesData(VertexBuffer.PositionKind, positions, true);
  fabric.setVerticesData(VertexBuffer.NormalKind, currentNormals, true);
  hooks.setVerticesData(VertexBuffer.PositionKind, ringPositions, true);
  return { id, windowId: root.name, label, root, meshes: [fabric, hooks, tie], applyClosed(amount: number) {
    // Release the gathered cloth in front of the sill before spreading it across the opening.
    const release = Math.min(1, amount / .2), spread = Math.max(0, (amount - .2) / .8);
    for (let i = 0; i < positions.length; i++) {
      positions[i] = open[i] + (closedPositions[i] - open[i]) * (i % 3 === 2 ? release : spread);
      currentNormals[i] = normals[i] + (closedNormals[i] - normals[i]) * amount;
    }
    for (let i = 0; i < currentNormals.length; i += 3) {
      const length = Math.hypot(currentNormals[i], currentNormals[i + 1], currentNormals[i + 2]) || 1;
      currentNormals[i] /= length; currentNormals[i + 1] /= length; currentNormals[i + 2] /= length;
    }
    for (let i = 0; i < ringPositions.length; i += 3) ringPositions[i] = openRings[i] + ringOffsets[i / 3] * spread;
    fabric.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    fabric.updateVerticesData(VertexBuffer.NormalKind, currentNormals);
    hooks.updateVerticesData(VertexBuffer.PositionKind, ringPositions, true);
    fabric.computeWorldMatrix(true); hooks.computeWorldMatrix(true);
    tie.visibility = 1 - Math.min(1, amount * 5);
  }};
}
