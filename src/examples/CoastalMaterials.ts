import { Mesh, Color3, Constants, HDRCubeTexture, MaterialPluginBase, PBRMaterial, Texture } from "@babylonjs/core/pure";
import type { BaseTexture, Scene, UniformBuffer } from "@babylonjs/core/pure";
import { coastalCrestShader } from "./CoastalCliff";
import { CoastalFinish } from "./CoastalFinish";
import { timeEnvironmentColor } from "./CoastalSky";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";

/** Small PBR extension: shared world-scale variation, a shore transition and a damp lower cliff.
 * Uses the normal/ARM workflow already registered by RoomRuntime; no triplanar shader system.
 */
export class CoastalSurface extends MaterialPluginBase {
  private rockFailed = false;
  constructor(material: PBRMaterial, private readonly kind: "rock" | "ground", private readonly rockColor: Texture) {
    super(material, "CoastalSurface", 200, {}, true, true);
    this.doNotSerialize = true;
  }
  disableRockBlend() { this.rockFailed = true; }
  getUniforms() { return { ubo: [{ name: "coastalRockReady", size: 1, type: "float" }], fragment: "#ifndef UNIFORMBUFFERS\nuniform float coastalRockReady;\n#endif" }; }
  getSamplers(samplers: string[]) { if (this.kind === "ground") samplers.push("coastalRockSampler"); }
  getActiveTextures(textures: BaseTexture[]) { if (this.kind === "ground") textures.push(this.rockColor); }
  hasTexture(texture: BaseTexture) { return this.kind === "ground" && texture === this.rockColor; }
  isReadyForSubMesh() { return this.kind !== "ground" || this.rockFailed || this.rockColor.isReadyOrNotBlocking(); }
  bindForSubMesh(buffer: UniformBuffer) {
    buffer.updateFloat("coastalRockReady", this.rockFailed ? 0 : 1);
    if (this.kind === "ground") buffer.setTexture("coastalRockSampler", this.rockColor);
  }
  getCustomCode(type: string) {
    if (type !== "fragment") return null;
    const rock = this.kind === "rock";
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
        ${rock ? "" : "uniform sampler2D coastalRockSampler;"}
        ${coastalCrestShader}
        float coastalMacro(vec3 p) {
          return .88 + .08*sin(p.x*.061 + sin(p.z*.043)*2.) + .04*sin(p.z*.147+p.y*.11);
        }
        float coastalWet(vec3 p) {
          return 1.-smoothstep(-144., -127., p.y + 1.8*sin(p.x*.08+p.z*.06));
        }
        float coastalBare(vec3 p) {
          vec2 q=p.xz/5.+vec2(5.4);
          float crest=coastalCrest(q.x);
          return 1.-smoothstep(.15,2.5,crest-q.y+.35*sin(q.x*3.7)+.2*sin(q.y*5.1));
        }`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: rock ? `
        float strata=.82+.18*sin(vPositionW.y*.43 + sin(vPositionW.x*.07+vPositionW.z*.025)*1.7);
        surfaceAlbedo *= vec3(1.9,1.85,1.72)*strata*coastalMacro(vPositionW) * mix(vec3(1.),vec3(.48,.53,.51),coastalWet(vPositionW));`
        : `
        vec3 bareRock=surfaceAlbedo;
        if(coastalRockReady>.5) bareRock=toLinearSpace(texture2D(coastalRockSampler,(vPositionW.xz/5.+vec2(5.4))/2.).rgb);
        surfaceAlbedo=mix(surfaceAlbedo,bareRock*vec3(.72,.66,.52),coastalBare(vPositionW)*.92*coastalRockReady);
        surfaceAlbedo*=coastalMacro(vPositionW);`,
      CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: rock ? `
        metallicRoughness.r=0.;
        metallicRoughness.g=clamp(metallicRoughness.g*mix(1.,.58,coastalWet(vPositionW)),.28,1.);`
        : `metallicRoughness.r=0.; metallicRoughness.g=max(.82,metallicRoughness.g);`,
    };
  }
}

/** All exterior surfaces share one local sky override; scene.environmentTexture remains indoors. */
export class CoastalMaterials {
  readonly environment: HDRCubeTexture;
  readonly rock: PBRMaterial;
  readonly farRock: PBRMaterial;
  readonly ground: PBRMaterial;
  readonly farGround: PBRMaterial;
  readonly foliage: PBRMaterial;
  readonly materials: PBRMaterial[] = [];
  private readonly plugins: CoastalSurface[] = [];
  private readonly failed = new Set<BaseTexture>();
  private disposed = false;
  private time?: TimeOfDaySnapshot;
  private readonly environmentBases = new Map<PBRMaterial, { intensity: number; color: Color3 }>();
  readonly textures: BaseTexture[] = [];
  solid(name: string, color: string, environmentIntensity = 3.8) {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace(); material.metallic = 0; material.roughness = .9;
    material.reflectionTexture = this.environment; material.environmentIntensity = environmentIntensity;
    material.maxSimultaneousLights = 1; material.usePhysicalLightFalloff = false;
    this.materials.push(material); this.trackEnvironment(material); return material;
  }
  pineBranches(impostor = false) {
    const m = this.solid(impostor ? "coastal-tree-impostor" : "coastal-pine-branches", "#ffffff");
    const texture = new Texture(impostor ? "./textures/coastal/pine-impostor.png" : "./textures/coastal/pine-branches.png", this.scene,
      false, true, Texture.TRILINEAR_SAMPLINGMODE, undefined, () => this.fallbackFor(texture));
    texture.hasAlpha = true; texture.gammaSpace = true; texture.anisotropicFilteringLevel = 8;
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.textures.push(texture); m.albedoTexture = texture;
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST; m.alphaCutOff = .35;
    // Both faces share upward normals: a cheap canopy-lighting approximation.
    m.backFaceCulling = false; m.twoSidedLighting = false; m.roughness = 1;
    return m;
  }
  finish(name: string, color: string, kind: "plaster" | "wood" | "path" | "paving" | "roof") {
    const m = this.solid(name, color);
    new CoastalFinish(m, kind);
    if (kind === "path" || kind === "paving") {
      m.albedoTexture = this.rock.albedoTexture; m.bumpTexture = this.rock.bumpTexture;
      m.metallicTexture = this.rock.metallicTexture;
      m.useRoughnessFromMetallicTextureAlpha = false; m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = true; m.useAmbientOcclusionFromMetallicTextureRed = true;
      m.invertNormalMapX = !this.scene.useRightHandedSystem; m.invertNormalMapY = this.scene.useRightHandedSystem;
    }
    return m;
  }
  constructor(private readonly scene: Scene) {
    this.environment = new HDRCubeTexture("./environment/coastal-daylight.hdr", scene, 128, false, true, false, true, undefined, () => this.fallbackFor(this.environment));
    this.textures.push(this.environment);
    const maps = (asset: string) => ["color", "normal", "arm"].map((part, index) => {
      const texture = new Texture(`./textures/coastal/${asset}-${part}.jpg`, scene,
        false, true, Texture.TRILINEAR_SAMPLINGMODE, undefined, () => this.fallbackFor(texture));
      texture.gammaSpace = index === 0; texture.anisotropicFilteringLevel = 8;
      if (index === 1) texture.level = asset === "rock" ? .48 : .28;
      this.textures.push(texture); return texture;
    });
    const rock = maps("rock"), ground = maps("ground");
    const make = (name: string, maps?: Texture[]) => {
      const m = new PBRMaterial(name, scene);
      m.albedoColor = Color3.White(); m.metallic = 0; m.roughness = 1;
      m.usePhysicalLightFalloff = false; m.maxSimultaneousLights = 1;
      m.reflectionTexture = this.environment; m.environmentIntensity = 3.8;
      if (maps) {
        [m.albedoTexture, m.bumpTexture, m.metallicTexture] = maps;
        m.invertNormalMapX = !scene.useRightHandedSystem; m.invertNormalMapY = scene.useRightHandedSystem;
        m.useRoughnessFromMetallicTextureAlpha = false;
        m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = true; m.ambientTextureStrength = .4;
        this.plugins.push(new CoastalSurface(m, maps === rock ? "rock" : "ground", rock[0]));
      }
      this.materials.push(m); this.trackEnvironment(m); return m;
    };
    this.rock = make("coastal-rock", rock); this.farRock = make("coastal-rock-distant", rock);
    this.ground = make("coastal-ground", ground); this.farGround = make("coastal-ground-distant", ground);
    // Shared translations/weights across all three maps; no tangent-frame rotation or luminance-dependent drift.
    for (const m of [this.ground, this.farGround]) {
      m.textureRepetitionMode = Constants.TEXTURE_REPETITION_HEX_TILING;
      m.textureRepetitionHexTilingParams = [0, 0, 7, .5];
    }
    this.foliage = make("coastal-foliage"); this.foliage.backFaceCulling = false;
    this.foliage.roughness = .95;
  }
  private trackEnvironment(material: PBRMaterial) {
    this.environmentBases.set(material, { intensity: material.environmentIntensity, color: material.reflectionColor.clone() });
    material.onDisposeObservable.addOnce(() => this.environmentBases.delete(material));
    if (this.time) this.applyEnvironment(material, this.time);
  }
  private applyEnvironment(material: PBRMaterial, state: TimeOfDaySnapshot) {
    const base = this.environmentBases.get(material)!;
    material.environmentIntensity = this.failed.has(this.environment) ? 0 : base.intensity * state.environment.exterior;
    material.reflectionColor.copyFrom(base.color.multiply(timeEnvironmentColor(state)));
    if (this.failed.has(this.environment)) material.reflectionTexture = null;
  }
  applyTimeOfDay(state: TimeOfDaySnapshot) {
    if (this.disposed) return;
    this.time = state;
    for (const material of this.environmentBases.keys()) this.applyEnvironment(material, state);
  }
  /** Failed downloads degrade only this component; disable IBL if the sky fails. */
  fallbackFor(texture: BaseTexture) {
    if (this.disposed || !texture || this.failed.has(texture)) return;
    this.failed.add(texture);
    this.scene.metadata = { ...this.scene.metadata, exteriorFallbacks: [...this.failed].map(t => t.name) };
    for (const m of this.materials) {
      // Failed cutout foliage must not turn into opaque rectangular cards.
      if (m.albedoTexture === texture && m.transparencyMode === PBRMaterial.PBRMATERIAL_ALPHATEST)
        for (const mesh of this.scene.meshes) {
          if (mesh.material === m) mesh.visibility = 0;
          if (mesh instanceof Mesh) for (const level of mesh.getLODLevels())
            if (level.mesh?.material === m) mesh.removeLODLevel(level.mesh);
        }
      for (const key of ["albedoTexture", "bumpTexture", "metallicTexture"] as const) {
        if (m[key] === texture) { m[key] = null; if (key === "albedoTexture") m.albedoColor.set(.32, .34, .26); }
      }
      if (texture === this.environment) { m.reflectionTexture = null; m.environmentIntensity = 0; }
    }
    if (texture === this.textures[1]) this.plugins.forEach(p => p.disableRockBlend());
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.materials.forEach(m => m.dispose(false, false));
    this.textures.forEach(t => t.dispose());
    this.environmentBases.clear();
  }
}
