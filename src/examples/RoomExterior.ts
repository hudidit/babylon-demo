import { Color3, DirectionalLight, Mesh, Plane, RenderTargetTexture, ShadowGenerator, PBRMaterial, StandardMaterial, Vector3, VertexBuffer, VertexData, CreateSphere } from "@babylonjs/core/pure";
import type { AbstractMesh, Material, Scene } from "@babylonjs/core/pure";
import { HOUSE_COORDINATES, HOUSE_ROOMS, planToWorld, worldToPlan } from "./HouseLayout";
import { setRoomOwners } from "./RoomOwnership";
import { COASTAL_CLIFF, coastalBoundary, coastalFoundation, coastalLandPatch, coastalSea, coastalSeaY,
  coastalUnderside, coastalWallPatch } from "./CoastalCliff";
import type { CoastalGeometry } from "./CoastalCliff";
import { CoastalMaterials } from "./CoastalMaterials";
import { coastalScatter } from "./CoastalScatter";
import { COASTAL_SKY, coastalSkyColor, coastalSunDirection } from "./CoastalSky";
import { CoastalOcean } from "./CoastalOcean";
import { createCoastalLandmark } from "./CoastalLandmark";
import { COASTAL_SITE, coastalRouteLength, coastalRoute } from "./CoastalSite";
import { coastalSurfaceHeight } from "./CoastalCliff";
import { createLighthouseInterior } from "./LighthouseInterior";
import { LighthouseDetails } from "./LighthouseDetails";
import type { InteractiveDoor } from "./RoomInteractions";

type ExteriorLayer = "terrain" | "cliff" | "foundation" | "vegetation" | "rocks" | "distant" | "sea" | "sky" | "landmark" | "path" | "house-roof";

/** Shared coast: photographic land, scoped daylight and a world-anchored animated ocean. */
export class RoomExterior {
  readonly meshes: Mesh[] = [];
  readonly surfaces: CoastalMaterials;
  readonly sun: DirectionalLight;
  readonly shadow: ShadowGenerator;
  readonly ocean: CoastalOcean;
  readonly lighthouseDoor: InteractiveDoor;
  readonly lighthouseDetails: LighthouseDetails;
  private readonly houseRoof: Mesh[];
  private readonly detailMeshes: Mesh[];
  private readonly shadowAnchors: Vector3[] = [];
  private shadowAnchor = 0;
  private visible = true;
  private enclosed = true;
  private readonly visualUpdate;
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
      mesh.metadata = { exterior: true, exteriorLayer: layer, exteriorStage: "lighthouse-C", castsShadows: false, lightRooms: [] };
      mesh.metadata.lighthouse = nameIsLighthouse(mesh.name);
      mesh.metadata.lighthouseInteriorStructure = /^coastal-lighthouse-(level|ladder)-/.test(mesh.name);
      mesh.metadata.lighthouseLadder = mesh.name.startsWith("coastal-lighthouse-ladder-");
      setRoomOwners(mesh, owners);
      mesh.isPickable = false; mesh.checkCollisions = false;
      mesh.receiveShadows = ["terrain", "foundation", "vegetation", "rocks", "landmark", "path", "house-roof"].includes(layer);
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
    for (let side = 0; side < 5; side++)
      make(`coastal-cliff-front-${side}`, coastalWallPatch(boundary, side * a.columns / 5, (side + 1) * a.columns / 5), "cliff", s.rock);
    const splitEast = a.columns + a.nearRows, splitWest = boundary.length - a.nearRows;
    make("coastal-cliff-east", coastalWallPatch(boundary, a.columns, splitEast), "cliff", s.rock);
    make("coastal-cliff-west", coastalWallPatch(boundary, splitWest, boundary.length), "cliff", s.rock);
    make("coastal-cliff-distant", coastalWallPatch(boundary, splitEast, splitWest), "distant", s.farRock);
    make("coastal-solid-underside", coastalUnderside(boundary), "distant", s.farRock);
    make("coastal-house-plinth", coastalFoundation(), "foundation", s.rock, "#aaa395");
    const scatter = coastalScatter();
    make("coastal-anchored-rocks", scatter.rocks, "rocks", s.rock);
    make("coastal-grass-and-shrubs", scatter.plants, "vegetation", s.foliage);
    scatter.zones.forEach((g, i) => {
      make(`coastal-path-rocks-${i}`, g.rocks, "rocks", s.rock);
      make(`coastal-path-plants-${i}`, g.plants, "vegetation", s.foliage);
    });
    this.houseRoof = createCoastalLandmark(scene, s, retain);
    this.lighthouseDoor = createLighthouseInterior(scene, retain);
    this.lighthouseDetails = new LighthouseDetails(scene, s, retain);
    setRoomOwners(this.lighthouseDoor.root, owners);
    setRoomOwners(this.lighthouseDoor.root.parent!, owners);
    this.detailMeshes = this.meshes.filter(m => m.metadata.detailDistance);
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
    this.shadowAnchors.push(new Vector3(0, -5, 30));
    const route = coastalRoute();
    for (let i = 120; i < route.length - 65; i += 72) {
      const p = planToWorld(route[i], coastalSurfaceHeight(route[i].x, route[i].y)! + 3);
      this.shadowAnchors.push(new Vector3(p.x, p.y, p.z));
    }
    const tower = planToWorld(COASTAL_SITE.tower, COASTAL_SITE.tower.ground + 7);
    this.shadowAnchors.push(new Vector3(tower.x, tower.y, tower.z));
    this.bindShadowCasters([]);
    this.visualUpdate = scene.onBeforeRenderObservable.add(() => this.updateVisuals());
    this.sceneCleanup = scene.onDisposeObservable.addOnce(() => this.dispose());
    scene.metadata = { ...scene.metadata, exteriorVersion: a.version,
      coastalSite: { version: COASTAL_SITE.version, stage: "C", outdoorWalking: true,
        tower: COASTAL_SITE.tower, interiorStage: 3, routeLength: coastalRouteLength((x, y) => coastalSurfaceHeight(x, y)!) } };
  }

  /** Explicit static shell/rail list. Furniture, moving door leaves, sea and distant cliffs never enter this map. */
  bindShadowCasters(house: AbstractMesh[]) {
    const shell = house.filter(m => !m.metadata?.exterior && !m.metadata?.collisionOnly &&
      (m.metadata?.structure === "wall" && m.metadata?.span?.owners.length === 1 || /^balcony-rail-/.test(m.name)));
    const local = this.meshes.filter(m => ["rocks", "vegetation", "foundation", "landmark", "house-roof"].includes(m.metadata.exteriorLayer)
      && m.material instanceof PBRMaterial && m.material.alpha === 1
      && !m.metadata.movingLighthouseDoor && !/plaza|lookout$/.test(m.name));
    this.shadow.getShadowMap()!.renderList = [...local, ...shell];
    this.refreshShadows();
  }
  refreshShadows() { if (!this.disposed) this.shadow.getShadowMap()?.resetRefreshCounter(); }
  setHouseEnclosed(enclosed: boolean) { this.enclosed = enclosed; this.houseRoof.forEach(m => m.isVisible = enclosed && this.visible); }
  setVisible(visible: boolean) {
    this.visible = visible;
    this.meshes.forEach(mesh => mesh.isVisible = visible); this.sun.setEnabled(visible);
    this.setHouseEnclosed(this.enclosed);
    this.ocean.setVisible(visible);
    this.lighthouseDetails.setVisible(visible);
    if (visible) this.refreshShadows();
  }

  /** One cached local map with overlapping zones and 6m selection hysteresis. No background refresh. */
  updateVisuals() {
    this.lighthouseDetails.update();
    const camera = this.scene.activeCamera;
    if (this.disposed || !this.visible || !camera || this.scene.getEngine().getRenderingCanvas()?.ownerDocument.hidden) return;
    const eye = camera.globalPosition, p = worldToPlan(eye);
    let best = 0, distance = Infinity;
    this.shadowAnchors.forEach((a, i) => {
      const d = Math.hypot(a.x - eye.x, a.z - eye.z);
      if (d < distance) { best = i; distance = d; }
    });
    const current = this.shadowAnchors[this.shadowAnchor];
    if (best !== this.shadowAnchor && Math.hypot(current.x - eye.x, current.z - eye.z) > distance + 30) {
      this.shadowAnchor = best;
      this.sun.position.copyFrom(this.shadowAnchors[best]).addInPlace(coastalSunDirection.scale(240));
      this.sun.shadowFrustumSize = best === 0 ? 250 : 280;
      // Wider outdoor coverage and the curved tower need more depth/normal separation.
      // Keep the previously validated near-house bias when returning to zone zero.
      this.shadow.bias = best === 0 ? .00015 : .001;
      this.shadow.normalBias = best === 0 ? .045 : .25;
      this.refreshShadows();
    }
    let detailChanged = false;
    for (const mesh of this.detailMeshes) {
      const range = mesh.metadata.detailDistance + (mesh.isVisible ? 10 : -10);
      const visible = Math.hypot(p.x - COASTAL_SITE.tower.x, p.y - COASTAL_SITE.tower.y) < range;
      detailChanged ||= mesh.isVisible !== visible; mesh.isVisible = visible;
    }
    if (detailChanged) this.refreshShadows();
    this.scene.metadata.coastalSite.shadowZone = this.shadowAnchor;
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
    this.scene.onBeforeRenderObservable.remove(this.visualUpdate);
    this.ocean.dispose(); this.shadow.dispose(); this.sun.dispose();
    this.lighthouseDetails.dispose();
    this.meshes.forEach(m => m.dispose(false, false));
    const mount = this.lighthouseDoor.root.parent;
    this.lighthouseDoor.root.dispose(); mount?.dispose();
    this.unlit.forEach(m => m.dispose(false, false)); this.surfaces.dispose();
  }
}

const nameIsLighthouse = (name: string) => name.startsWith("coastal-lighthouse-") && name !== "coastal-lighthouse-path";
