import type { Material, Scene } from "@babylonjs/core/pure";

const libraries = new WeakMap<Scene, Map<string, Material>>();
/** Scene-owned materials/textures: a room/builder never disposes the shared library. */
export function sharedRoomMaterials(scene: Scene, initialize: (materials: Map<string, Material>) => void) {
  if (scene.isDisposed) throw new Error("Cannot create materials for disposed scene");
  const existing = libraries.get(scene);
  if (existing) return existing;
  const materials = new Map<string, Material>();
  const previousMaterials = new Set(scene.materials), previousTextures = new Set(scene.textures);
  libraries.set(scene, materials);
  try { initialize(materials); }
  catch (error) {
    libraries.delete(scene);
    scene.materials.slice().filter(material => !previousMaterials.has(material)).forEach(material => material.dispose(false, false));
    scene.textures.slice().filter(texture => !previousTextures.has(texture)).forEach(texture => texture.dispose());
    throw error;
  }
  scene.onDisposeObservable.addOnce(() => { materials.clear(); libraries.delete(scene); });
  return materials;
}
