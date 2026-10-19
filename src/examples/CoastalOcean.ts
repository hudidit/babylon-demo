import { Constants, Frustum, RawTexture, ShaderMaterial, Texture, Vector3 } from "@babylonjs/core/pure";
import type { Mesh, Scene } from "@babylonjs/core/pure";
import { COASTAL_CLIFF, coastalBoundary, coastalSeaY, coastalWallPoint } from "./CoastalCliff";
import { HOUSE_COORDINATES } from "./HouseLayout";
import { applySkyTime, coastalSkyGLSL, skyTimeUniforms } from "./CoastalSky";
import { evaluateTimeOfDay, DEFAULT_TIME_OF_DAY } from "./RoomTimeOfDay";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";

/** Metres, seconds and linear radiance. Also used by the vertex and fragment shaders. */
export const OCEAN_WAVES = [
  { direction: [.94, .342], amplitude: .19, length: 18, speed: .85 },
  { direction: [-.55, .835], amplitude: .095, length: 9.5, speed: 1.18 },
  { direction: [.24, -.971], amplitude: .045, length: 4.8, speed: 1.67 },
] as const;
// Preserve at least the old near-house texel density while covering the lighthouse's new cliff.
export const OCEAN_FIELD = { size: 512, minX: -180, minY: -65, width: 260, depth: 220, range: 32 } as const;

/** Intersect the same two wall rings used by the rock mesh with mean sea level. */
export function coastalShoreline() {
  const boundary = coastalBoundary();
  return boundary.map((_, index) => {
    const a = coastalWallPoint(boundary, index, 7), b = coastalWallPoint(boundary, index, 8);
    const t = (-COASTAL_CLIFF.seaDepth - a.height) / (b.height - a.height);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

/** Signed distance to the closed cliff section; positive is open water. */
export function coastalShoreDistance(x: number, y: number, shore = coastalShoreline()) {
  let squared = Infinity, inside = false;
  for (let i = 0, j = shore.length - 1; i < shore.length; j = i++) {
    const a = shore[j], b = shore[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    squared = Math.min(squared, (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2);
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return Math.sqrt(squared) * (inside ? -1 : 1);
}

/** R/G store a 16-bit signed distance, B a static sloping seabed approximation, A unused. */
export function coastalShoreField() {
  const f = OCEAN_FIELD, shore = coastalShoreline(), data = new Uint8Array(f.size * f.size * 4);
  const edges = shore.map((b, i) => {
    const a = shore[(i + shore.length - 1) % shore.length], dx = b.x - a.x, dy = b.y - a.y;
    return { a, b, dx, dy, squared: dx * dx + dy * dy, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
  });
  for (let row = 0; row < f.size; row++) {
    const y = f.minY + (row + .5) / f.size * f.depth;
    // Membership changes only at sorted crossings; distant segments cannot affect a clamped field.
    const crossings = edges.filter(e => (e.a.y > y) !== (e.b.y > y))
      .map(e => e.a.x + e.dx * (y - e.a.y) / e.dy).sort((a, b) => a - b);
    const nearby = edges.filter(e => e.minY - f.range <= y && e.maxY + f.range >= y);
    let crossing = 0, inside = false;
    for (let col = 0; col < f.size; col++) {
      const x = f.minX + (col + .5) / f.size * f.width;
      while (crossing < crossings.length && crossings[crossing] < x) { inside = !inside; crossing++; }
      let squared = f.range * f.range;
      for (const e of nearby) {
        const bx = Math.max(e.minX - x, 0, x - e.maxX), by = Math.max(e.minY - y, 0, y - e.maxY);
        if (bx * bx + by * by >= squared) continue;
        const t = Math.max(0, Math.min(1, ((x - e.a.x) * e.dx + (y - e.a.y) * e.dy) / e.squared));
        squared = Math.min(squared, (x - e.a.x - t * e.dx) ** 2 + (y - e.a.y - t * e.dy) ** 2);
      }
      const d = Math.sqrt(squared) * (inside ? -1 : 1), encoded = Math.round((d / f.range + 1) / 2 * 65535), i = (row * f.size + col) * 4;
      data[i] = encoded >> 8; data[i + 1] = encoded & 255;
      data[i + 2] = Math.round(Math.max(0, Math.min(1, d * 1.6 / 32)) * 255); data[i + 3] = 255;
    }
  }
  return data;
}

/** Hidden time is paused; the first resumed frame ignores the potentially huge engine delta. */
export class OceanClock {
  seconds = 0;
  private active = false;
  pause() { this.active = false; }
  advance(deltaSeconds: number, visible: boolean) {
    if (!visible) { this.pause(); return this.seconds; }
    if (this.active && Number.isFinite(deltaSeconds)) this.seconds += Math.max(0, Math.min(.1, deltaSeconds));
    this.active = true;
    return this.seconds;
  }
}

const waveCode = `
  float oceanFade(vec2 p) { return 1.-smoothstep(100.,220.,length(p)); }
  vec3 oceanWave(vec2 p, float time) {
    vec3 result=vec3(0.);
    ${OCEAN_WAVES.map(w => `{
      vec2 d=normalize(vec2(${w.direction.join(",")}));
      float k=${2 * Math.PI / w.length}, phase=dot(p,d)*k-time*${w.speed};
      result+=vec3(${w.amplitude}*sin(phase),${w.amplitude}*k*cos(phase)*d);
    }`).join("\n")}
    return result*oceanFade(p);
  }`;

export const oceanVertex = `
  precision highp float;
  attribute vec3 position;
  uniform mat4 world, viewProjection;
  uniform float oceanTime;
  varying vec3 vPositionW;
  #include<clipPlaneVertexDeclaration>
  ${waveCode}
  void main() {
    vec4 worldPos=world*vec4(position,1.);
    worldPos.y+=oceanWave(worldPos.xz/5.,oceanTime).x*5.;
    vPositionW=worldPos.xyz;
    gl_Position=viewProjection*worldPos;
    #include<clipPlaneVertex>
  }`;

export const oceanFragment = `
  #extension GL_OES_standard_derivatives : enable
  precision highp float;
  varying vec3 vPositionW;
  uniform vec3 cameraPosition;
  uniform float oceanTime, skyIllumination;
  uniform sampler2D shoreSampler;
  #include<clipPlaneFragmentDeclaration>
  ${waveCode}
  ${coastalSkyGLSL}
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
  }
  vec2 noiseSlope(vec2 p) {
    vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f), du=6.*f*(1.-f);
    float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+1.);
    return vec2(mix(b-a,d-c,u.y)*du.x,mix(c-a,d-b,u.x)*du.y);
  }
  vec2 rippleSlope(vec2 p, float scale, vec2 flow, mat2 rotation) {
    vec2 g=noiseSlope(rotation*p*scale+oceanTime*flow);
    return vec2(dot(rotation[0],g),dot(rotation[1],g));
  }
  void main() {
    #include<clipPlaneFragment>
    vec2 p=vPositionW.xz/5.;
    float distanceToEye=length(vPositionW-cameraPosition);
    vec3 wave=oceanWave(p,oceanTime);
    vec2 slope=wave.yz;
    // Irregular travelling gradient normals, filtered by their screen footprint before specular shading.
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    float detail=1.-smoothstep(100.,380.,distanceToEye/5.);
    float a=exp(-pow(footprint*2.8,2.)), b=exp(-pow(footprint*6.,2.)), c=exp(-pow(footprint*13.,2.));
    slope+=detail*(.22*rippleSlope(p,1.4,vec2(-.17,.09),mat2(.8,.6,-.6,.8))*a
      +.11*rippleSlope(p,3.,vec2(.13,-.21),mat2(.36,-.933,.933,.36))*b
      +.05*rippleSlope(p,6.5,vec2(-.27,-.08),mat2(.94,.342,-.342,.94))*c);
    vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
    vec3 v=normalize(cameraPosition-vPositionW), r=reflect(-v,n);
    float nv=max(.001,dot(n,v));
    float fresnel=.0204+.9796*pow(1.-nv,5.);
    vec2 uv=(p+vec2(5.4)-vec2(${OCEAN_FIELD.minX}.,${OCEAN_FIELD.minY}.))/vec2(${OCEAN_FIELD.width}.,${OCEAN_FIELD.depth}.);
    vec4 field=texture2D(shoreSampler,clamp(uv,vec2(.001),vec2(.999)));
    float inField=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
    float shoreDistance=((field.r*65280.+field.g*255.)/65535.*2.-1.)*${OCEAN_FIELD.range}.;
    shoreDistance=mix(32.,shoreDistance,inField);
    float depth=mix(1.,field.b,inField);
    vec3 body=mix(vec3(.045,.19,.18),vec3(.019,.077,.115),smoothstep(0.,.6,depth));
    body*=.94+.06*sin(p.x*.048+p.y*.031+oceanTime*.12);
    body*=skyIllumination;
    vec3 color=mix(body,coastalSkyGradient(r),fresnel);
    // GGX with finite roughness, broadened as subpixel ripples disappear to avoid sparkling aliases.
    vec3 h=normalize(v+sunDirection);
    float nh=max(0.,dot(n,h)), nl=max(.001,dot(n,sunDirection)), vh=max(0.,dot(v,h));
    float rough=mix(.20,.34,1.-a*detail), alpha=rough*rough, a2=alpha*alpha;
    float denom=nh*nh*(a2-1.)+1.;
    float distribution=a2/(3.14159265*denom*denom);
    float k=pow(rough+1.,2.)/8.;
    float geometry=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
    float sunF=.0204+.9796*pow(1.-vh,5.);
    color+=sunColor*sunStrength*distribution*geometry*sunF/(4.*nv)*2.6;
    // Broken advancing swash, shared with the depth transition rather than a fixed white outline.
    float breaker=sin(shoreDistance*2.8-oceanTime*1.12+noise(p*.45)*3.);
    float band=(1.-smoothstep(.5,3.0,shoreDistance))*smoothstep(-.25,.35,shoreDistance);
    float foam=band*smoothstep(.05,.7,breaker)*smoothstep(.28,.66,noise(p*2.1+vec2(oceanTime*.13,-oceanTime*.09)));
    color=mix(color,vec3(.72,.81,.79)*skyIllumination,foam*.8);
    float haze=smoothstep(550.,3300.,distanceToEye);
    color=mix(color,coastalSkyGradient(normalize(vPositionW-cameraPosition)),haze);
    // Linear output: the existing scene image-processing pass applies ACES/exposure exactly once.
    gl_FragColor=vec4(color,1.);
  }`;

/** No image requests or reflection RTT. One generated shoreline field, one shared animation observer. */
export class CoastalOcean {
  readonly material: ShaderMaterial;
  readonly shoreTexture: RawTexture;
  readonly clock = new OceanClock();
  private readonly beforeRender;
  private readonly sceneCleanup;
  private readonly document?: Document;
  private disposed = false;
  private readonly pause = () => this.clock.pause();
  constructor(private readonly scene: Scene, readonly mesh: Mesh) {
    const f = OCEAN_FIELD;
    this.shoreTexture = RawTexture.CreateRGBATexture(coastalShoreField(), f.size, f.size, scene,
      false, false, Texture.BILINEAR_SAMPLINGMODE, Constants.TEXTURETYPE_UNSIGNED_BYTE);
    this.shoreTexture.name = "coastal-shore-distance-depth";
    this.shoreTexture.wrapU = this.shoreTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.shoreTexture.gammaSpace = false;
    this.material = new ShaderMaterial("coastal-ocean", scene, { vertexSource: oceanVertex, fragmentSource: oceanFragment }, {
      attributes: ["position"], uniforms: ["world", "viewProjection", "cameraPosition", "oceanTime", "skyIllumination", ...skyTimeUniforms],
      samplers: ["shoreSampler"], useClipPlane: true,
    });
    this.material.setTexture("shoreSampler", this.shoreTexture);
    this.material.setFloat("oceanTime", 0);
    this.applyTimeOfDay(evaluateTimeOfDay(DEFAULT_TIME_OF_DAY));
    // ShaderMaterial's automatic cameraPosition uses the main eye; mirrors supply a reflected eye.
    this.material.onBindObservable.add(() => {
      const eye = scene._mirroredCameraPosition || scene.activeCamera?.globalPosition;
      if (eye) this.material.getEffect()?.setVector3("cameraPosition", eye);
    });
    mesh.material = this.material;
    // Vertex displacement is GPU-only. Expand CPU bounds so culling never clips a wave crest.
    const bounds = mesh.getBoundingInfo().boundingBox, amplitude = OCEAN_WAVES.reduce((sum, w) => sum + w.amplitude, 0) * HOUSE_COORDINATES.unitsPerMeter;
    mesh.getBoundingInfo().reConstruct(new Vector3(bounds.minimum.x, coastalSeaY - amplitude, bounds.minimum.z),
      new Vector3(bounds.maximum.x, coastalSeaY + amplitude, bounds.maximum.z));
    this.document = scene.getEngine().getRenderingCanvas()?.ownerDocument;
    this.document?.addEventListener("visibilitychange", this.pause);
    this.beforeRender = scene.onBeforeRenderObservable.add(() => {
      const camera = scene.activeCamera;
      const visible = !this.document?.hidden && mesh.isVisible && mesh.isEnabled() && mesh.visibility > 0 && !!camera
        && !!(camera.layerMask & mesh.layerMask) && mesh.isInFrustum(Frustum.GetPlanes(camera.getTransformationMatrix()));
      this.material.setFloat("oceanTime", this.clock.advance(scene.getEngine().getDeltaTime() / 1000, visible));
    });
    this.sceneCleanup = scene.onDisposeObservable.addOnce(() => this.dispose());
  }
  setVisible(visible: boolean) { this.mesh.isVisible = visible; this.clock.pause(); }
  applyTimeOfDay(state: TimeOfDaySnapshot) {
    if (this.disposed) return;
    applySkyTime(this.material, state);
    this.material.setFloat("skyIllumination", state.environment.exterior);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onBeforeRenderObservable.remove(this.beforeRender);
    this.scene.onDisposeObservable.remove(this.sceneCleanup);
    this.document?.removeEventListener("visibilitychange", this.pause);
    this.material.dispose(false, false); this.shoreTexture.dispose();
  }
}
