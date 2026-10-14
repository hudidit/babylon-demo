import { AbstractMesh, Mesh, Scene, SubMesh } from "@babylonjs/core";

type PartRange = { vertices: number; indices: number };
const partitions = new WeakMap<AbstractMesh, { data: SubMesh[]; length: number }>();
const installedScenes = new WeakSet<Scene>();

/** Keep local collision bounds for static parts without splitting their merged draw call. */
export function partitionMergedCollisions(mesh: Mesh, parts: readonly PartRange[]) {
  if (parts.length < 2) return;
  const world = mesh.getWorldMatrix();
  let vertexStart = 0;
  let indexStart = 0;
  const data = parts.map(part => {
    // Collision-only submeshes share the original geometry; addToMesh=false keeps them out of rendering.
    const subMesh = new SubMesh(0, vertexStart, part.vertices, indexStart, part.indices,
      mesh, mesh, true, false);
    subMesh.updateBoundingInfo(world);
    vertexStart += part.vertices;
    indexStart += part.indices;
    return subMesh;
  });
  partitions.set(mesh, { data, length: data.length });
  const scene = mesh.getScene();
  if (installedScenes.has(scene)) return;
  const fallback = scene.getCollidingSubMeshCandidates;
  scene.getCollidingSubMeshCandidates = (candidate, collider) =>
    partitions.get(candidate) ?? fallback(candidate, collider);
  installedScenes.add(scene);
}
