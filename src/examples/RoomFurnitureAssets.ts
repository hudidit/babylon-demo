import { AbstractMesh, Scene, TransformNode, Vector3 } from "@babylonjs/core";

/** Fit the actual imported bounds while preserving the glTF handedness conversion. */
export function placeFurniture(meshes: AbstractMesh[], scene: Scene, name: string,
  position: Vector3, width: number, rotation = 0) {
  const geometry = meshes.filter(mesh => mesh.getTotalVertices() > 0);
  if (!geometry.length) throw new Error(`Furniture has no geometry: ${name}`);
  let minimum = new Vector3(Infinity, Infinity, Infinity);
  let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  geometry.forEach(mesh => {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
    maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
  });
  const placement = new TransformNode(name, scene);
  const origin = new TransformNode(name + "-origin", scene);
  // Centre X/Z and put the lowest vertex on the floor before scaling/rotating.
  origin.position.set(-(minimum.x + maximum.x) / 2, -minimum.y, -(minimum.z + maximum.z) / 2);
  origin.parent = placement;
  meshes.filter(mesh => {
    for (let parent = mesh.parent; parent; parent = parent.parent) {
      if (meshes.includes(parent as AbstractMesh)) return false;
    }
    return true;
  }).forEach(root => root.parent = origin);
  placement.position.copyFrom(position);
  placement.scaling.setAll(width / (maximum.x - minimum.x));
  placement.rotation.y = rotation;
  meshes.forEach(mesh => {
    mesh.receiveShadows = true;
    mesh.checkCollisions = mesh.getTotalVertices() > 0;
    mesh.metadata = { ...mesh.metadata, castsShadows: true };
    mesh.isPickable = false;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
  });
  origin.freezeWorldMatrix();
  placement.freezeWorldMatrix();
  return placement;
}
