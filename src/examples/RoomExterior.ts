import { Color3, DirectionalLight, Mesh, Plane, RenderTargetTexture, ShadowGenerator, PBRMaterial, StandardMaterial, Vector3, VertexBuffer, VertexData, CreateSphere } from "@babylonjs/core/pure";
import type { AbstractMesh, Material, Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_ROOMS, planToWorld } from "./HouseLayout";
import { setRoomOwners } from "./RoomOwnership";
import { COASTAL_CLIFF, coastalBoundary, coastalFoundation, coastalLandPatch, coastalSea, coastalSeaY,
  coastalUnderside, coastalWallPatch } from "./CoastalCliff";
import type { CoastalGeometry } from "./CoastalCliff";
import { CoastalMaterials } from "./CoastalMaterials";
import { coastalScatter } from "./CoastalScatter";
import { COASTAL_SKY, coastalSkyColor, coastalSunDirection } from "./CoastalSky";
import { CoastalOcean } from "./CoastalOcean";

type ExteriorLayer = "terrain" | "cliff" | "foundation" | "vegetation" | "rocks" | "distant" | "sea" | "sky";

/** Shared coast: photographic land, scoped daylight and a world-anchored animated ocean. */
export class RoomExterior {
  readonly meshes: Mesh[] = [];
  readonly surfaces: CoastalMaterials;
  readonly sun: DirectionalLight;
  readonly shadow: ShadowGenerator;
  readonly ocean: CoastalOcean;
  private readonly cutaway = new Plane(0, 0, 1, 0);
  private readonly clippedMaterials: (PBRMaterial | StandardMaterial)[] = [];
  private readonly corners: { x: number; z: number }[] = [];
  private readonly unlit: StandardMaterial[] = [];
  private disposed = false;
  private clipKey = "";
  private readonly sceneCleanup;

  constructor(private readonly scene: Scene) {
    for (const r of HOUSE_ROOMS) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.depth])
      this.corners.push(planToWorld({ x, y }));
    const owners = HOUSE_ROOMS.map(r => r.id);
    this.surfaces = new CoastalMaterials(scene);
    this.clippedMaterials.push(this.surfaces.rock, this.surfaces.ground, this.surfaces.foliage);
    const unlit = (name: string) => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true; m.emissiveColor = Color3.White(); m.specularColor = Color3.Black();
      this.unlit.push(m); return m;
    };
    const sky = unlit("coastal-sky");
    const retain = (mesh: Mesh, layer: ExteriorLayer) => {
      mesh.metadata = { exterior: true, exteriorLayer: layer, exteriorStage: "C", castsShadows: false, lightRooms: [] };
      setRoomOwners(mesh, owners);
      mesh.isPickable = false; mesh.checkCollisions = false;
      mesh.receiveShadows = ["terrain", "foundation", "vegetation", "rocks"].includes(layer);
      mesh.freezeWorldMatrix(); this.meshes.push(mesh);
      return mesh;
    };
    const make = (name: string, data: CoastalGeometry & { colors?: number[] }, layer: ExteriorLayer, mat: Material,
      color = "#ffffff") => {
      const mesh = new Mesh(name, scene), vd = new VertexData(), normals: number[] = [], colors: number[] = [];
      if (data.normals) normals.push(...data.normals);
      else VertexData.ComputeNormals(data.positions, data.indices, normals);
      const base = mat instanceof StandardMaterial ? Color3.FromHexString(color) : Color3.FromHexString(color).toLinearSpace();
      for (let i = 0; i < data.positions.length; i += 3) colors.push(base.r, base.g, base.b, 1);
      vd.positions = data.positions; vd.indices = data.indices; vd.normals = normals; vd.uvs = data.uvs; vd.colors = data.colors || colors;
      vd.applyToMesh(mesh); mesh.material = mat;
      return retain(mesh, layer);
    };
    const a = COASTAL_CLIFF, s = this.surfaces;
    for (let side = 0; side < 2; side++) {
      const first = side * a.columns / 2, last = (side + 1) * a.columns / 2;
      make(`coastal-platform-${side}`, coastalLandPatch(first, last, 0, a.nearRows), "terrain", s.ground);
      make(`coastal-inland-${side}`, coastalLandPatch(first, last, a.nearRows, a.rows), "distant", s.farGround);
    }
    const boundary = coastalBoundary();
    for (let side = 0; side < 3; side++)
      make(`coastal-cliff-front-${side}`, coastalWallPatch(boundary, side * 32, (side + 1) * 32), "cliff", s.rock);
    const splitEast = a.columns + a.nearRows, splitWest = boundary.length - a.nearRows;
    make("coastal-cliff-east", coastalWallPatch(boundary, a.columns, splitEast), "cliff", s.rock);
    make("coastal-cliff-west", coastalWallPatch(boundary, splitWest, boundary.length), "cliff", s.rock);
    make("coastal-cliff-distant", coastalWallPatch(boundary, splitEast, splitWest), "distant", s.farRock);
    make("coastal-solid-underside", coastalUnderside(boundary), "distant", s.farRock);
    make("coastal-house-plinth", coastalFoundation(), "foundation", s.rock, "#aaa395");
    const scatter = coastalScatter();
    make("coastal-anchored-rocks", scatter.rocks, "rocks", s.rock);
    make("coastal-grass-and-shrubs", scatter.plants, "vegetation", s.foliage);
    this.ocean = new CoastalOcean(scene, make("coastal-sea", coastalSea(), "sea", sky));

    const dome = CreateSphere("coastal-sky", { diameter: a.skyRadius * 2, segments: 96, sideOrientation: Mesh.BACKSIDE }, scene);
    const positions = dome.getVerticesData(VertexBuffer.PositionKind)!, colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      // StandardMaterial's default vertex colour conversion expects gamma input.
      const c = coastalSkyColor(new Vector3(positions[i], positions[i + 1], positions[i + 2]).normalize()).toGammaSpace();
      colors.push(c.r, c.g, c.b, 1);
    }
    dome.setVerticesData(VertexBuffer.ColorKind, colors);
    dome.position.y = coastalSeaY; dome.material = sky; retain(dome, "sky");

    this.sun = new DirectionalLight("coastal-afternoon-sun", coastalSunDirection.negate(), scene);
    this.sun.position.copyFrom(coastalSunDirection.scale(240)).addInPlace(new Vector3(0, -5, 30));
    this.sun.diffuse = Color3.FromArray(COASTAL_SKY.sunColor); this.sun.intensity = 3.8;
    this.sun.includedOnlyMeshes = this.meshes.filter(m => m.material instanceof PBRMaterial);
    this.sun.shadowMinZ = 20; this.sun.shadowMaxZ = 430;
    this.sun.shadowFrustumSize = 250; this.sun.autoUpdateExtends = false; this.sun.autoCalcShadowZBounds = false;
    setRoomOwners(this.sun, owners);
    this.shadow = new ShadowGenerator(1024, this.sun);
    this.shadow.usePercentageCloserFiltering = true; this.shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadow.bias = .00015; this.shadow.normalBias = .045;
    this.shadow.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.bindShadowCasters([]);
    this.sceneCleanup = scene.onDisposeObservable.addOnce(() => this.dispose());
    scene.metadata = { ...scene.metadata, exteriorVersion: a.version };
  }

  /** Explicit static shell/rail list. Furniture, moving door leaves, sea and distant cliffs never enter this map. */
  bindShadowCasters(house: AbstractMesh[]) {
    const shell = house.filter(m => !m.metadata?.exterior && !m.metadata?.collisionOnly &&
      (m.metadata?.structure === "wall" && m.metadata?.span?.owners.length === 1 || /^balcony-rail-/.test(m.name)));
    const local = this.meshes.filter(m => ["rocks", "vegetation", "foundation"].includes(m.metadata.exteriorLayer));
    this.shadow.getShadowMap()!.renderList = [...local, ...shell];
    this.refreshShadows();
  }
  refreshShadows() { if (!this.disposed) this.shadow.getShadowMap()?.resetRefreshCounter(); }
  setVisible(visible: boolean) {
    this.meshes.forEach(mesh => mesh.isVisible = visible); this.sun.setEnabled(visible);
    this.ocean.setVisible(visible);
    if (visible) this.refreshShadows();
  }

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
    for (const material of this.clippedMaterials) material.clipPlane2 = active ? this.cutaway : null;
    const key = active ? this.cutaway.asArray().join(",") : "off";
    if (key !== this.clipKey) { this.clipKey = key; this.refreshShadows(); }
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.scene.onDisposeObservable.remove(this.sceneCleanup);
    this.ocean.dispose(); this.shadow.dispose(); this.sun.dispose();
    this.meshes.forEach(m => m.dispose(false, false));
    this.unlit.forEach(m => m.dispose(false, false)); this.surfaces.dispose();
  }
}
