// Historical two-room geometry fixture; not imported by the running house.
import { CreateBox, CreateGround, CreatePlane } from "@babylonjs/core/pure";
import type { Scene, TransformNode } from "@babylonjs/core/pure";
import { mappedMaterial, paintedWallMaterial, tileMaterial } from "./RoomMaterials";
import { createSharedWall } from "./RoomLivingRoom";
import { setRoomOwners } from "./RoomOwnership";
import type { RoomFurnishings } from "./RoomFurnishings";
export function createLegacyArchitecture(this: { scene: Scene; interiorShell: TransformNode }, room: RoomFurnishings) {
    const scene = this.scene;
    const floor = mappedMaterial("oak-floor", scene, "wood_floor", "#e7ddd0", 5, 0.28);
    const ground = CreateGround("oak-floor", { width: 40, height: 40 }, scene);
    ground.position.y = -5;
    ground.material = floor;
    ground.receiveShadows = true;
    ground.metadata = { castsShadows: false };
    setRoomOwners(ground, ["study"]);
    ground.checkCollisions = true;
    room.box("foundation", [40.6, 0.6, 40.6], [0, -5.4, 0], "darkWood");

    const paint = paintedWallMaterial(scene);
    const leftBack = CreateBox("back-wall-left", { width: 14, height: 14, depth: 0.5 }, scene);
    leftBack.position.set(-13, 2, -20);
    const rightBack = CreateBox("back-wall-right", { width: 18, height: 14, depth: 0.5 }, scene);
    rightBack.position.set(11, 2, -20);
    const lintel = CreateBox("door-lintel-wall", { width: 8, height: 3.2, depth: 0.5 }, scene);
    lintel.position.set(-2, 7.4, -20);
    const left = CreateBox("left-painted-wall", { width: 0.5, height: 14, depth: 40 }, scene);
    left.position.set(-20, 2, 0);
    createSharedWall(scene, this.interiorShell, paint);
    const front = CreateBox("front-painted-wall", { width: 40.5, height: 14, depth: 0.5 }, scene);
    front.position.set(0, 2, 20);
    front.parent = this.interiorShell;
    const spans = [14, 18, 8, 40, 40.5];
    [leftBack, rightBack, lintel, left, front].forEach((mesh, index) => {
      const wallMaterial = tileMaterial(paint, mesh.name + "-paint", spans[index] / 6,
        (index === 2 ? 3.2 : 14) / 6);
      mesh.material = wallMaterial;
      setRoomOwners(mesh, ["study"]);
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      if (mesh === left) {
        // The box's narrow side UVs rotate the surface map; use a wall-sized face.
        const facing = CreatePlane("left-wall-painted-facing",
          { width: 40, height: 14 }, scene);
        facing.position.set(-19.74, 2, 0);
        facing.rotation.y = -Math.PI / 2;
        facing.parent = mesh.parent;
        facing.material = wallMaterial;
        setRoomOwners(facing, ["study"]);
        facing.receiveShadows = true;
        facing.isPickable = false;
        facing.freezeWorldMatrix();
      }
    });
    room.architecturalDetails();
    room.enclosingDetails(this.interiorShell);
  }

