import { Mesh, Ray, Vector3, VertexBuffer } from "@babylonjs/core/pure";
import type { AbstractMesh } from "@babylonjs/core/pure";

export interface ShelfCompartment {
  min: Vector3;
  max: Vector3;
}

/** Measure the loaded model in world space, including its scale and glTF conversion. */
export function measureBookshelf(meshes: AbstractMesh[]) {
  const geometry = meshes.filter(mesh => mesh.getTotalVertices() > 0);
  geometry.forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = Mesh.MinMax(geometry);
  const center = bounds.min.add(bounds.max).scale(0.5);
  const scene = geometry[0].getScene();
  const belongsToShelf = (mesh: AbstractMesh) => geometry.includes(mesh);
  const surfaces: { y: number; upward: boolean }[] = [];
  const origin = new Vector3(center.x, bounds.max.y + 0.05, center.z);
  for (let step = 0; step < 64 && origin.y > bounds.min.y; step++) {
    const hit = scene.pickWithRay(new Ray(origin.clone(), Vector3.Down(), origin.y - bounds.min.y + 0.05), belongsToShelf);
    if (!hit?.pickedPoint || !hit.pickedMesh) break;
    const mesh = hit.pickedMesh;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const indices = mesh.getIndices()!;
    // PickingInfo.getNormal faces the ray, so use the model's original normals to distinguish undersides.
    const normal = Vector3.Zero();
    for (let vertex = 0; vertex < 3; vertex++) {
      normal.addInPlace(Vector3.FromArray(normals, indices[hit.faceId * 3 + vertex] * 3));
    }
    const worldNormal = Vector3.TransformNormal(normal, mesh.getWorldMatrix()).normalize();
    if (Math.abs(worldNormal.y) > 0.9) surfaces.push({ y: hit.pickedPoint.y, upward: worldNormal.y > 0 });
    origin.y = hit.pickedPoint.y - 0.01;
  }
  surfaces.sort((a, b) => a.y - b.y);
  const compartments: ShelfCompartment[] = [];
  surfaces.filter(surface => surface.upward).forEach(floor => {
    const ceiling = surfaces.find(surface => !surface.upward && surface.y > floor.y + 0.1);
    if (!ceiling || ceiling.y - floor.y < 0.5) return;
    const inside = new Vector3(center.x, (floor.y + ceiling.y) / 2, center.z);
    const left = scene.pickWithRay(new Ray(inside, Vector3.Left()), belongsToShelf);
    const right = scene.pickWithRay(new Ray(inside, Vector3.Right()), belongsToShelf);
    if (!left?.pickedPoint || !right?.pickedPoint) return;
    compartments.push({
      min: new Vector3(left.pickedPoint.x + 0.08, floor.y, bounds.min.z + 0.22),
      max: new Vector3(right.pickedPoint.x - 0.08, ceiling.y, bounds.max.z - 0.22),
    });
  });
  return { bounds, compartments };
}
