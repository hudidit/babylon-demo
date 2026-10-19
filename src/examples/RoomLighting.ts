import { Color3, HemisphericLight, PBRMaterial, RenderTargetTexture, ShadowGenerator, SpotLight, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, Scene } from "@babylonjs/core/pure";
import { roomOwners, setRoomOwners } from "./RoomOwnership";
import type { HouseRoomId } from "./HouseLayout";
import { HOUSE_CONTENT } from "./HouseContent";
import { houseVector } from "./HouseWalking";
import { HOUSE_SUITE } from "./HouseSuite";
import { HOUSE_BEDROOM } from "./HouseBedroom";
import { HOUSE_WINDOWS, houseWindowSide } from "./HouseStructure";
import { HOUSE_SERVICE } from "./HouseServiceRooms";
import { localPosition } from "./HouseRoomComponents";
import { timeEnvironmentColor } from "./CoastalSky";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";
import { HOUSE_CEILING_LIGHTS, ceilingLampPosition } from "./HouseCeilingLights";
import { HOUSE_COORDINATES } from "./HouseLayout";

/** Room-specific window/lamp sources plus the original restrained indirect bounce. */
export class RoomLighting {
  private readonly fill: HemisphericLight;
  private readonly shadows: ShadowGenerator[];
  private readonly natural = new Map<SpotLight, { normal: Vector3; intensity: number; windowId?: string }>();
  private readonly curtainClosure = new Map<string, number>();
  private readonly environments = new Map<PBRMaterial, { intensity: number; color: Color3 }>();
  private readonly fillIntensity: number;
  private readonly ambient: Color3;
  private time?: TimeOfDaySnapshot;
  private hasCeilingLights = false;
  private readonly lamps = new Map<string, { light: SpotLight; intensity: number; on: boolean;
    material?: PBRMaterial; glow?: Color3 }>();

  constructor(private readonly scene: Scene, house = false) {
    const fill = this.fill = new HemisphericLight("room-bounce-light", new Vector3(-0.35, 1, 0.15), scene);
    fill.intensity = house ? 0.38 : 0.18;
    fill.diffuse = new Color3(0.95, 0.97, 1);
    fill.groundColor = new Color3(0.68, 0.62, 0.53);
    fill.specular = Color3.Black();
    this.fillIntensity = fill.intensity;
    this.ambient = scene.ambientColor.clone();

    // Place daylight just in front of the garden window, rather than shining through opaque walls.
    const daylight = new SpotLight("window-daylight", new Vector3(-18.85, 5.6, 9),
      new Vector3(1, -0.35, -0.25).normalize(), Math.PI / 1.5, 1, scene);
    daylight.innerAngle = Math.PI / 2;
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 3.5;
    daylight.range = 55;

    // Emit below the shades so the closed shade meshes cannot occlude their own bulbs.
    const reading = new SpotLight("reading-lamp-light", new Vector3(16, 1.48, 5),
      new Vector3(-0.55, -1, 0.5).normalize(), Math.PI / 1.8, 1.5, scene);
    reading.innerAngle = Math.PI / 2.4;
    reading.diffuse = new Color3(1, 0.85, 0.64);
    reading.intensity = 3.3;
    reading.range = 14;

    const desk = new SpotLight("banker-lamp-light", new Vector3(-0.55, 0.8, -2.65),
      new Vector3(-0.65, -1, 0.4).normalize(), Math.PI / 1.7, 1.5, scene);
    desk.innerAngle = Math.PI / 2.5;
    desk.diffuse = new Color3(1, 0.88, 0.68);
    desk.intensity = 1.25;
    desk.range = 10;
    this.lamps.set("floor-lamp", { light: reading, intensity: reading.intensity, on: true });
    this.lamps.set("desk-lamp", { light: desk, intensity: desk.intensity, on: true });

    if (house) {
      daylight.position.copyFrom(houseVector(6.9, 0.16, 2.1)); daylight.direction.set(0.15, -0.55, 1).normalize(); daylight.range = 24;
      reading.position.copyFrom(houseVector(HOUSE_CONTENT.floorLamp.x, HOUSE_CONTENT.floorLamp.y, 1.296)); reading.direction.set(0.7, -1, 0).normalize();
      desk.position.copyFrom(houseVector(HOUSE_CONTENT.desk.x + 0.49, HOUSE_CONTENT.desk.y - 0.33, (4.6 + 1.2) * HOUSE_CONTENT.desk.heightScale / 5));
    }

    this.shadows = [daylight, reading, desk].map((light, index) => {
      setRoomOwners(light, [house && index === 1 ? "living" : "study"]);
      light.metadata.affectsShared = index === 0;
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      light.specular = light.diffuse.scale(0.65);
      // Explicit light depth bounds keep cached maps independent of the active camera.
      light.shadowMinZ = index === 0 ? 0.5 : 0.1;
      light.shadowMaxZ = index === 0 ? 48 : light.range;
      const size = index === 0 ? Math.min(house ? 2048 : 4096, scene.getEngine().getCaps().maxTextureSize) : 1024;
      const shadow = new ShadowGenerator(size, light);
      if (index === 0) {
        shadow.useContactHardeningShadow = true;
        shadow.contactHardeningLightSizeUVRatio = 0.022;
      } else {
        shadow.usePercentageCloserFiltering = true;
      }
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      // Perspective depth bias grows in world space across the room: keep small feet attached.
      shadow.bias = index === 0 ? 0.0001 : 0.00015;
      shadow.normalBias = 0.012;
      shadow.setDarkness(0);
      return shadow;
    });
    if (house) this.registerWindow(daylight, "study-window");
    else this.natural.set(daylight, { normal: new Vector3(-1, 0, 0), intensity: daylight.intensity });
  }

  addLivingRoom(scene: Scene, house = false) {
    const daylight = new SpotLight("living-window-daylight", new Vector3(48, 5.6, -18.85),
      new Vector3(-0.35, -0.38, 1).normalize(), Math.PI / 1.5, 1, scene);
    daylight.innerAngle = Math.PI / 2;
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 3.5; daylight.range = 48;
    // The emitter sits just below the shade, above the side table.
    const lamp = new SpotLight("living-table-lamp-light", new Vector3(45.2, -0.24, 9.2),
      new Vector3(-0.55, -0.85, -0.45).normalize(), Math.PI / 1.7, 1.4, scene);
    lamp.innerAngle = Math.PI / 2.4;
    lamp.diffuse = new Color3(1, 0.85, 0.64);
    lamp.intensity = 2.4; lamp.range = 15;
    this.lamps.set("living-lamp", { light: lamp, intensity: lamp.intensity, on: true });
    if (house) {
      daylight.position.copyFrom(houseVector(10.6, 8.4, 2.1)); daylight.direction.set(-1, -0.4, -0.1).normalize();
      lamp.position.copyFrom(houseVector(HOUSE_CONTENT.console.x, HOUSE_CONTENT.console.y, 1.2)); lamp.direction.set(0.5, -1, 0).normalize();
    }
    [daylight, lamp].forEach((light, index) => {
      setRoomOwners(light, ["living"]);
      light.metadata.affectsShared = true;
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      light.specular = light.diffuse.scale(0.65);
      light.shadowMinZ = index ? 0.1 : 0.5; light.shadowMaxZ = light.range;
      const shadow = new ShadowGenerator(index ? 1024 : 2048, light);
      shadow.usePercentageCloserFiltering = true;
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = index ? 0.00015 : 0.0001; shadow.normalBias = 0.012;
      this.shadows.push(shadow);
    });
    this.registerWindow(daylight, "living-window");
  }

  addMasterSuite(scene: Scene) {
    const a = HOUSE_SUITE;
    const daylight = new SpotLight("master-window-daylight", houseVector(2.4, 0.18, 2.1),
      new Vector3(0.1, -0.5, 1).normalize(), Math.PI / 1.5, 1, scene);
    daylight.diffuse = new Color3(1, 0.96, 0.88);
    daylight.intensity = 3.2; daylight.range = 32;
    const master = new SpotLight("master-lamp-light", Vector3.FromArray(localPosition("master", { x: a.masterLamp.x + 0.04, y: a.masterLamp.y }, a.masterLamp.emitterHeight)),
      new Vector3(0.5, -0.8, 0.2).normalize(), Math.PI / 1.5, 1, scene);
    master.diffuse = new Color3(1, 0.85, 0.64); master.intensity = 2.3; master.range = 18;
    const ensuite = new SpotLight("ensuite-lamp-light", Vector3.FromArray(localPosition("ensuite", { x: a.ensuiteLamp.x - 0.08, y: a.ensuiteLamp.y }, a.ensuiteLamp.height)),
      new Vector3(-0.5, -0.8, 0.3).normalize(), Math.PI / 1.35, 1, scene);
    ensuite.diffuse = new Color3(1, 0.94, 0.82); ensuite.intensity = 3.2; ensuite.range = 18;
    this.lamps.set("master-lamp", { light: master, intensity: master.intensity, on: true });
    this.lamps.set("ensuite-lamp", { light: ensuite, intensity: ensuite.intensity, on: true });
    [daylight, master, ensuite].forEach((light, index) => {
      setRoomOwners(light, [index === 2 ? "ensuite" : "master"]);
      light.metadata.affectsShared = true;
      light.falloffType = SpotLight.FALLOFF_STANDARD; light.specular = light.diffuse.scale(0.65);
      light.shadowMinZ = 0.1; light.shadowMaxZ = light.range;
      const shadow = new ShadowGenerator(index === 1 ? 512 : 1024, light);
      shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = 0.00012; shadow.normalBias = 0.012;
      this.shadows.push(shadow);
    });
    this.registerWindow(daylight, "master-window");
  }

  addBedroom(scene: Scene) {
    const a = HOUSE_BEDROOM.lamp, window = HOUSE_WINDOWS.find(w => w.id === "bedroom-window")!;
    // Emit just inside the south opening so the window frame and curtains cannot block their own daylight.
    const daylight = new SpotLight("bedroom-window-daylight",
      houseVector(window.x + window.width / 2, window.y - 0.16, 1.8),
      new Vector3(-0.08, -0.45, -1).normalize(), Math.PI / 1.5, 1, scene);
    daylight.diffuse = new Color3(1, 0.96, 0.88); daylight.intensity = 3.2; daylight.range = 30;
    const lamp = new SpotLight("bedroom-lamp-light", Vector3.FromArray(localPosition("bedroom", { x: a.x + 0.04, y: a.y }, a.emitterHeight)),
      new Vector3(0.5, -0.8, 0.2).normalize(), Math.PI / 1.5, 1, scene);
    lamp.diffuse = new Color3(1, 0.85, 0.64); lamp.intensity = 2.3; lamp.range = 18;
    this.lamps.set("bedroom-lamp", { light: lamp, intensity: lamp.intensity, on: true });
    [daylight, lamp].forEach((light, index) => {
      setRoomOwners(light, ["bedroom"]); light.metadata.affectsShared = true;
      light.falloffType = SpotLight.FALLOFF_STANDARD; light.specular = light.diffuse.scale(0.65);
      light.shadowMinZ = 0.1; light.shadowMaxZ = light.range;
      const shadow = new ShadowGenerator(index ? 512 : 1024, light);
      shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = 0.00012; shadow.normalBias = 0.012; this.shadows.push(shadow);
    });
    this.registerWindow(daylight, "bedroom-window");
  }

  addServiceRooms(scene: Scene) {
    const a=HOUSE_SERVICE;
    const day=new SpotLight("kitchen-window-daylight",houseVector(9.6,.18,2.1),new Vector3(.1,-.55,1).normalize(),Math.PI/1.5,1,scene);
    day.diffuse=new Color3(1,.96,.88);day.intensity=2.8;day.range=23;
    const kitchen=new SpotLight("kitchen-lamp-light",Vector3.FromArray(localPosition("kitchen",a.kitchenLamp,a.kitchenLamp.height-.06)),
      new Vector3(.2,-1,-.15).normalize(),Math.PI/1.3,1,scene);
    kitchen.diffuse=new Color3(1,.94,.82);kitchen.intensity=3; kitchen.range=24;
    const bath=new SpotLight("bathroom-lamp-light",Vector3.FromArray(localPosition("bathroom",{x:a.bathroomLamp.x+.08,y:a.bathroomLamp.y},a.bathroomLamp.height)),
      new Vector3(.5,-.8,.4).normalize(),Math.PI/1.2,1,scene);
    bath.diffuse=new Color3(1,.94,.82);bath.intensity=3.8;bath.range=22;
    this.lamps.set("kitchen-lamp",{light:kitchen,intensity:kitchen.intensity,on:true});
    this.lamps.set("bathroom-lamp",{light:bath,intensity:bath.intensity,on:true});
    [day,kitchen,bath].forEach((light,index)=>{
      setRoomOwners(light,[index===2?"bathroom":"kitchen"]);light.metadata.affectsShared=true;
      light.falloffType=SpotLight.FALLOFF_STANDARD;light.specular=light.diffuse.scale(.65);
      light.shadowMinZ=.1;light.shadowMaxZ=light.range;
      const shadow=new ShadowGenerator(index===1?512:1024,light);
      shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias=.00012;shadow.normalBias=.012;this.shadows.push(shadow);
    });
    this.registerWindow(day, "kitchen-window");
  }

  addBalcony(scene: Scene) {
    const light=new SpotLight("balcony-daylight",houseVector(8.1,12.1,3),new Vector3(0,-1,-.15).normalize(),Math.PI/1.3,1,scene);
    light.diffuse=new Color3(1,.96,.88);light.intensity=2.2;light.range=24;
    setRoomOwners(light,["balcony"]);light.metadata.affectsShared=true;
    light.falloffType=SpotLight.FALLOFF_STANDARD;light.specular=light.diffuse.scale(.65);
    light.shadowMinZ=.1;light.shadowMaxZ=light.range;
    const shadow=new ShadowGenerator(512,light);shadow.usePercentageCloserFiltering=true;
    shadow.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;shadow.bias=.00012;shadow.normalBias=.012;this.shadows.push(shadow);
    this.natural.set(light, { normal: new Vector3(0, 1, 0), intensity: light.intensity });
  }

  addCeilingLights() {
    this.hasCeilingLights = true;
    for (const lamp of HOUSE_CEILING_LIGHTS) {
      const light = new SpotLight(lamp.id + "-light",
        Vector3.FromArray(ceilingLampPosition(lamp.room, HOUSE_COORDINATES.clearHeight - .15)),
        new Vector3(0, -1, 0), 2.9, 1, this.scene);
      light.innerAngle = 2.35;
      light.diffuse = new Color3(1, .94, .82);
      light.specular = light.diffuse.scale(.45);
      light.intensity = lamp.intensity; light.range = 45;
      light.falloffType = SpotLight.FALLOFF_STANDARD;
      setRoomOwners(light, [lamp.room]); light.metadata.affectsShared = true;
      light.shadowMinZ = .1; light.shadowMaxZ = light.range;
      const shadow = new ShadowGenerator(1024, light);
      shadow.usePercentageCloserFiltering = true;
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      // The near-hemispherical cone needs more depth offset than the narrow table lamps.
      shadow.bias = .001; shadow.normalBias = .03;
      this.shadows.push(shadow);
      this.lamps.set(lamp.id, { light, intensity: light.intensity, on: true });
    }
  }

  private registerWindow(light: SpotLight, id: string) {
    const side = houseWindowSide(HOUSE_WINDOWS.find(w => w.id === id)!);
    const normals = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
    this.natural.set(light, { normal: Vector3.FromArray(normals[side]), intensity: light.intensity, windowId: id });
  }
  setCurtain(windowId: string, amount: number) {
    this.curtainClosure.set(windowId, Math.max(0, Math.min(1, amount)));
    for (const [light, base] of this.natural) if (base.windowId === windowId) {
      const body = this.time?.primary;
      const incidence = body ? Math.max(0, Vector3.Dot(base.normal, Vector3.FromArray(body.sourceDirection))) : 0;
      light.intensity = base.intensity * (this.time ? (body?.strength || 0) * incidence : 1) * this.transmission(windowId);
    }
  }
  private transmission(windowId?: string) { return 1 - .96 * (this.curtainClosure.get(windowId || "") || 0); }
  /** Natural lighting changes independently of the user's lamp switches and their cached maps. */
  applyTimeOfDay(state: TimeOfDaySnapshot) {
    this.time = state;
    const body = state.primary, tint = timeEnvironmentColor(state);
    this.fill.intensity = this.fillIntensity * state.environment.interior;
    this.fill.diffuse.copyFrom(new Color3(.95, .97, 1).multiply(tint));
    this.fill.groundColor.copyFrom(new Color3(.68, .62, .53).multiply(tint));
    this.scene.ambientColor.copyFrom(this.ambient.scale(state.environment.interior));
    for (const [light, base] of this.natural) {
      const incidence = body ? Math.max(0, Vector3.Dot(base.normal, Vector3.FromArray(body.sourceDirection))) : 0;
      light.intensity = base.intensity * (body?.strength || 0) * incidence * this.transmission(base.windowId);
      light.diffuse.copyFrom(body ? Color3.FromArray(body.color) : Color3.Black());
      light.specular.copyFrom(light.diffuse.scale(.65));
      if (body && incidence > .00001) light.direction.copyFromFloats(...body.lightDirection);
      light.forceProjectionMatrixCompute();
      light.getShadowGenerator()?.getShadowMap()?.resetRefreshCounter();
    }
    for (const material of this.environments.keys()) this.applyEnvironment(material, state);
  }
  private applyEnvironment(material: PBRMaterial, state: TimeOfDaySnapshot) {
    const base = this.environments.get(material)!;
    material.environmentIntensity = base.intensity * state.environment.interior;
    material.reflectionColor.copyFrom(base.color.multiply(timeEnvironmentColor(state)));
  }
  private trackEnvironment(mesh: AbstractMesh) {
    const material = mesh.material;
    if (!(material instanceof PBRMaterial) || mesh.metadata?.exterior || mesh.metadata?.mirrorPlane
      || mesh.metadata?.inspectionPreview || material.reflectionTexture?.isRenderTarget) return;
    if (!this.environments.has(material)) {
      this.environments.set(material, { intensity: material.environmentIntensity, color: material.reflectionColor.clone() });
      material.onDisposeObservable.addOnce(() => this.environments.delete(material));
    }
    if (this.time) this.applyEnvironment(material, this.time);
  }

  bindLamp(id: string, material: PBRMaterial) {
    const lamp = this.lamps.get(id)!;
    lamp.material = material;
    lamp.glow = material.emissiveColor.clone();
  }

  isLampOn(id: string) { return this.lamps.get(id)!.on; }

  toggleLamp(id: string) {
    const lamp = this.lamps.get(id)!;
    lamp.on = !lamp.on;
    lamp.light.intensity = lamp.on ? lamp.intensity : 0;
    if (lamp.material && lamp.glow) lamp.material.emissiveColor.copyFrom(lamp.on ? lamp.glow : Color3.Black());
    this.refreshShadows(roomOwners(lamp.light));
  }

  addMeshes(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => {
      if (mesh.getTotalVertices() === 0) return;
      this.trackEnvironment(mesh);
      if (!mesh.metadata?.exterior) mesh.receiveShadows = true;
      else if (!this.fill.excludedMeshes.includes(mesh)) this.fill.excludedMeshes.push(mesh);
      this.shadows.forEach(shadow => {
        const light = shadow.getLight() as SpotLight;
        const owners: readonly HouseRoomId[] = mesh.metadata?.lightRooms || roomOwners(mesh);
        const matchesRoom = owners.some(id => roomOwners(light).includes(id))
          && (owners.length === 1 || light.metadata.affectsShared);
        if (!matchesRoom) {
          if (!light.excludedMeshes.includes(mesh)) light.excludedMeshes.push(mesh);
          return;
        }
        if (mesh.metadata?.castsShadows !== false) shadow.addShadowCaster(mesh, false);
      });
      // Count sources, including switched-off lamps, after masks have been assigned. A shared
      // material retains the largest requirement of its users, including late GLB furniture.
      if (this.hasCeilingLights && !mesh.metadata?.exterior && mesh.material instanceof PBRMaterial) {
        const slots = 1 + this.shadows.filter(shadow => shadow.getLight().canAffectMesh(mesh)).length;
        mesh.material.maxSimultaneousLights = Math.max(mesh.material.maxSimultaneousLights, slots);
      }
    });
    this.refreshShadows();
  }

  freezeShadows() {
    this.shadows.forEach(shadow => {
      shadow.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    });
    this.refreshShadows();
  }

  removeMeshes(meshes: AbstractMesh[]) {
    this.fill.excludedMeshes = this.fill.excludedMeshes.filter(mesh => !meshes.includes(mesh));
    this.shadows.forEach(shadow => {
      const light = shadow.getLight() as SpotLight;
      meshes.forEach(mesh => {
        shadow.removeShadowCaster(mesh, false);
        const index = light.excludedMeshes.indexOf(mesh);
        if (index >= 0) light.excludedMeshes.splice(index, 1);
      });
    });
  }

  removeRoom(id: HouseRoomId) {
    HOUSE_WINDOWS.filter(window => window.room === id).forEach(window => this.curtainClosure.delete(window.id));
    for (const [lampId, lamp] of this.lamps) if (roomOwners(lamp.light).includes(id)) this.lamps.delete(lampId);
    for (let i = this.shadows.length - 1; i >= 0; i--) {
      const shadow = this.shadows[i], light = shadow.getLight();
      if (!roomOwners(light).includes(id)) continue;
      this.natural.delete(light as SpotLight);
      this.shadows.splice(i, 1); shadow.dispose(); light.dispose();
    }
  }

  refreshShadows(owners?: readonly HouseRoomId[]) {
    this.shadows.filter(shadow => !owners || roomOwners(shadow.getLight()).some(id => owners.includes(id)))
      .forEach(shadow => shadow.getShadowMap()!.resetRefreshCounter());
  }
}
