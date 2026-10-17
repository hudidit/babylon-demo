import { Color3, Mesh, Plane, StandardMaterial, Vector3, VertexBuffer, VertexData, CreateSphere } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_ROOMS, planToWorld } from "./HouseLayout";
import { setRoomOwners } from "./RoomOwnership";
import { COASTAL_CLIFF, coastalBoundary, coastalFoundation, coastalLandPatch, coastalSea, coastalSeaY,
  coastalUnderside, coastalWallPatch } from "./CoastalCliff";
import type { CoastalGeometry } from "./CoastalCliff";

type ExteriorLayer = "terrain" | "cliff" | "foundation" | "distant" | "sea" | "sky";

/** Stage A: one fixed, texture-free coastal graybox shared by every real window. */
export class RoomExterior {
  readonly meshes: Mesh[] = [];
  private readonly cutaway = new Plane(0, 0, 1, 0);
  private readonly clippedMaterials: StandardMaterial[] = [];
  private readonly corners: { x: number; z: number }[] = [];

  constructor(scene: Scene) {
    for (const r of HOUSE_ROOMS) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.depth])
      this.corners.push(planToWorld({ x, y }));
    const owners = HOUSE_ROOMS.map(r => r.id), sun = new Vector3(-.5, .8, .3).normalize();
    const material = (name: string, clipped: boolean) => {
      const m = new StandardMaterial(name, scene);
      // Shape validation only. PBR textures and scoped outdoor daylight belong to stage B.
      m.disableLighting = true; m.emissiveColor = Color3.White(); m.specularColor = Color3.Black();
      if (clipped) this.clippedMaterials.push(m);
      return m;
    };
    const near = material("coastal-near-graybox", true), far = material("coastal-distant-graybox", false);
    const water = material("coastal-sea-graybox", false), sky = material("coastal-sky-graybox", false);
    const retain = (mesh: Mesh, layer: ExteriorLayer) => {
      mesh.metadata = { exterior: true, exteriorLayer: layer, exteriorStage: "A", castsShadows: false, lightRooms: [] };
      setRoomOwners(mesh, owners);
      mesh.isPickable = false; mesh.checkCollisions = false; mesh.receiveShadows = false;
      mesh.freezeWorldMatrix(); this.meshes.push(mesh);
      return mesh;
    };
    const make = (name: string, data: CoastalGeometry, layer: ExteriorLayer, color: string, mat = near) => {
      const mesh = new Mesh(name, scene), vd = new VertexData(), normals: number[] = [], colors: number[] = [];
      VertexData.ComputeNormals(data.positions, data.indices, normals);
      // StandardMaterial converts its final colour to linear before the shared ACES pass.
      const base = Color3.FromHexString(color);
      for (let i = 0; i < data.positions.length; i += 3) {
        const shade = layer === "sea" ? 1 : .62 + .38 * Math.max(0,
          normals[i] * sun.x + normals[i + 1] * sun.y + normals[i + 2] * sun.z);
        colors.push(base.r * shade, base.g * shade, base.b * shade, 1);
      }
      vd.positions = data.positions; vd.indices = data.indices; vd.normals = normals; vd.uvs = data.uvs; vd.colors = colors;
      vd.applyToMesh(mesh); mesh.material = mat;
      return retain(mesh, layer);
    };
    const a = COASTAL_CLIFF;
    for (let side = 0; side < 2; side++) {
      const first = side * a.columns / 2, last = (side + 1) * a.columns / 2;
      make(`coastal-platform-${side}`, coastalLandPatch(first, last, 0, a.nearRows), "terrain", "#8d9279");
      make(`coastal-inland-${side}`, coastalLandPatch(first, last, a.nearRows, a.rows), "distant", "#8d9279", far);
    }
    const boundary = coastalBoundary();
    for (let side = 0; side < 3; side++)
      make(`coastal-cliff-front-${side}`, coastalWallPatch(boundary, side * 32, (side + 1) * 32), "cliff", "#aca79b");
    const splitEast = a.columns + a.nearRows, splitWest = boundary.length - a.nearRows;
    make("coastal-cliff-east", coastalWallPatch(boundary, a.columns, splitEast), "cliff", "#aca79b");
    make("coastal-cliff-west", coastalWallPatch(boundary, splitWest, boundary.length), "cliff", "#aca79b");
    make("coastal-cliff-distant", coastalWallPatch(boundary, splitEast, splitWest), "distant", "#aca79b", far);
    make("coastal-solid-underside", coastalUnderside(boundary), "distant", "#8a857b", far);
    make("coastal-house-plinth", coastalFoundation(), "foundation", "#837d72");
    make("coastal-sea", coastalSea(), "sea", "#648b9b", water);

    const dome = CreateSphere("coastal-sky", { diameter: a.skyRadius * 2, segments: 64, sideOrientation: Mesh.BACKSIDE }, scene);
    const positions = dome.getVerticesData(VertexBuffer.PositionKind)!, colors: number[] = [];
    const horizon = Color3.FromHexString("#c7d5d8"), zenith = Color3.FromHexString("#8fbbd4");
    const below = Color3.FromHexString("#648b9b");
    for (let i = 0; i < positions.length; i += 3) {
      const elevation = positions[i + 1] / a.skyRadius;
      const color = elevation < 0 ? below : Color3.Lerp(horizon, zenith, Math.min(1, elevation * 4));
      colors.push(color.r, color.g, color.b, 1);
    }
    dome.setVerticesData(VertexBuffer.ColorKind, colors);
    dome.position.y = coastalSeaY; dome.material = sky; retain(dome, "sky");
    scene.metadata = { ...scene.metadata, exteriorVersion: a.version };
  }

  setVisible(visible: boolean) { this.meshes.forEach(mesh => mesh.isVisible = visible); }

  /** Only close land may obstruct cutaways. Sea, sky and distant coast always remain complete. */
  updateCutaway(position?: { x: number; z: number }, target?: { x: number; z: number }) {
    let active = false;
    if (position && target && Math.hypot(position.x, position.z) <= COASTAL_CLIFF.cutawayDistance * HOUSE_COORDINATES.unitsPerMeter) {
      const dx = position.x - target.x, dz = position.z - target.z, length = Math.hypot(dx, dz);
      if (length >= .001) {
        const nx = dx / length, nz = dz / length;
        let boundary = -Infinity;
        for (const p of this.corners) boundary = Math.max(boundary, p.x * nx + p.z * nz);
        this.cutaway.normal.set(nx, 0, nz); this.cutaway.d = -boundary - .25; active = true;
      }
    }
    // Plane 1 is reserved for reflected views. A degenerate pose clears stale foreground clipping.
    for (const material of this.clippedMaterials) material.clipPlane2 = active ? this.cutaway : null;
  }
}
