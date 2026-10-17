import { Color3, Constants, HDRCubeTexture, MaterialPluginBase, PBRMaterial, Texture } from "@babylonjs/core/pure";
import type { BaseTexture, Scene, UniformBuffer } from "@babylonjs/core/pure";
import { COASTAL_CLIFF } from "./CoastalCliff";

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
        float coastalMacro(vec3 p) {
          return .88 + .08*sin(p.x*.061 + sin(p.z*.043)*2.) + .04*sin(p.z*.147+p.y*.11);
        }
        float coastalWet(vec3 p) {
          return 1.-smoothstep(-144., -127., p.y + 1.8*sin(p.x*.08+p.z*.06));
        }
        float coastalBare(vec3 p) {
          vec2 q=p.xz/5.+vec2(5.4);
          float crest=${COASTAL_CLIFF.balconyEdgeY + COASTAL_CLIFF.setback}
            +40.*(exp(-pow((q.x+8.)/6.,2.))-exp(-pow(16.1/6.,2.)))
            -4.*(exp(-pow((q.x-28.)/8.,2.))-exp(-pow(-19.9/8.,2.)))
            +.55*(sin(q.x*.37)-sin(8.1*.37));
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
  readonly textures: BaseTexture[] = [];
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
      this.materials.push(m); return m;
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
  /** Failed downloads degrade only this component; disable IBL if the sky fails. */
  fallbackFor(texture: BaseTexture) {
    if (this.disposed || !texture || this.failed.has(texture)) return;
    this.failed.add(texture);
    this.scene.metadata = { ...this.scene.metadata, exteriorFallbacks: [...this.failed].map(t => t.name) };
    for (const m of this.materials) {
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
  }
}
