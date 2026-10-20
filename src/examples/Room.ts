import { ArcRotateCamera, Color3, Color4, Engine, HDRCubeTexture, ImageProcessingConfiguration, PBRMaterial, Ray, Scene, SceneLoader, SSAO2RenderingPipeline, TransformNode, UniversalCamera, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, DefaultRenderingPipeline, Mesh } from "@babylonjs/core/pure";
// All four shipped GLBs use core glTF 2.0, with no extensions (verified at release time).
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { registerRoomRuntime } from "./RoomRuntime";
import { RoomFurnishings } from "./RoomFurnishings";
import { RoomLighting } from "./RoomLighting";
import { furnishHouseCeilingLights } from "./HouseCeilingLights";
import { placeFurniture } from "./RoomFurnitureAssets";
import { createRoomFinishing } from "./RoomFinishing";
import { cabinetDrawers, interactionSurface, RoomInteractions } from "./RoomInteractions";
import { RoomPointerLock } from "./RoomPointerLock";
import { RoomAudio } from "./RoomAudio";
import { RoomItemInspection } from "./RoomItemInspection";
import { RoomFloorPlan } from "./RoomFloorPlan";
import { RoomMirrors } from "./RoomMirrors";
import { RoomExterior } from "./RoomExterior";
import type { InspectableItem } from "./RoomInteractions";
import { createHouseArchitecture } from "./HouseArchitecture";
import { houseVector, HOUSE_SPAWN, HOUSE_WALKER_RADIUS } from "./HouseWalking";
import { walkingPointAllowed, walkingSurfaceAt, sweepWalking } from "./WalkingSurface";
import { advanceScooter, createScooterState, emptyScooterInput, resetScooter, scooterDismount, scooterEyeBack, scooterOffset, scooterSupport, stopScooter, SCOOTER } from "./CoastalScooter";
import { CoastalScooterModel } from "./CoastalScooterModel";
import { LIGHTHOUSE } from "./LighthouseLayout";
import { advanceLighthouseLadder, createLighthouseLadderState, emptyLighthouseLadderInput, canBoardLighthouseLadder,
  lighthouseLadderFloor, lighthouseLadderPoint, lighthouseLadderLanding } from "./LighthouseLadder";
import { COASTAL_HOME, COASTAL_SITE } from "./CoastalSite";
import { HOUSE_CONTENT, furnishHouseLiving, furnishHouseStudy } from "./HouseContent";
import { furnishHouseMaster, furnishHouseEnsuite } from "./HouseSuite";
import { furnishHouseBedroom } from "./HouseBedroom";
import { furnishHouseKitchen, furnishHouseBathroom } from "./HouseServiceRooms";
import { furnishHouseBalcony } from "./HouseBalcony";
import { HouseRooms } from "./HouseRooms";
import type { RoomBuild } from "./HouseRooms";
import { HOUSE_LAYOUT_VERSION, HOUSE_ROOMS, planToWorld, worldToPlan } from "./HouseLayout";
import { advanceJump, createJumpState, HOUSE_JUMP, jumpPlatformAt, requestJump, resetJumpState } from "./HouseJump";
import type { HouseRoomId } from "./HouseLayout";
import { roomOwners, setRoomOwners } from "./RoomOwnership";
import { RoomTimeOfDay, TIME_OF_DAY_VERSION } from "./RoomTimeOfDay";
import type { TimeOfDaySnapshot } from "./RoomTimeOfDay";
import { RoomPauseState } from "./RoomPauseState";
import type { RoomPauseReason } from "./RoomPauseState";
import { LighthouseOperation, LIGHTHOUSE_OPERATION_VERSION } from "./LighthouseOperation";
import { LighthousePanel } from "./LighthousePanel";
import { LighthouseInspection } from "./LighthouseInspection";
import { lighthouseBeamStrength } from "./LighthouseBeacon";
import type { LighthousePanelLocation } from "./LighthousePanel";
import { lighthouseEquipmentDefinition, LIGHTHOUSE_EQUIPMENT, LIGHTHOUSE_BACKUP_MOUNT, lighthouseEquipmentReading } from "./LighthouseEquipmentLayout";
import { LighthouseMaintenance } from "./LighthouseMaintenance";
import type { LighthouseDrill, LighthouseTool, MaintenanceCommand } from "./LighthouseMaintenance";
import { LighthouseMaintenancePanel } from "./LighthouseMaintenancePanel";

export type RoomView = "overview" | "coast" | "study" | "living" | "master" | "ensuite" | "bedroom" | "kitchen" | "bathroom" | "balcony" | "reading" | "desk" | "details" | "cabinet" | "first-person";
// The user-requested 50% increase applies to the shared base; the settings multiplier remains unchanged.
export const MOVEMENT_SPEED = { min: 0.25, max: 3, default: 1, base: 0.825 };

/** A shared eight-room scene with cutaway presets and enclosed first-person roaming. */
export class RoomScene {
  readonly scene: Scene;
  readonly engine: Engine;
  readonly audio = new RoomAudio();
  readonly rooms = new HouseRooms();
  private timeState = new RoomTimeOfDay();
  private lighthouseState = new LighthouseOperation();
  private lighthouseInspectionState = new LighthouseInspection();
  private lighthouseMaintenanceState = new LighthouseMaintenance();
  private suspendedLighthouse?: {time: RoomTimeOfDay; operation: LighthouseOperation; inspection: LighthouseInspection; maintenance: LighthouseMaintenance};
  private lighthouseEvidenceKey = "";
  private readonly lighthousePanel: LighthousePanel;
  private readonly lighthouseMaintenancePanel: LighthouseMaintenancePanel;
  private readonly pauses = new RoomPauseState();
  private timeVisualElapsed = 0;
  onTimeOfDayChange: () => void = () => {};
  onPauseChange: () => void = () => {};
  private readonly builds: Record<HouseRoomId, RoomBuild>;
  private readonly architecture: ReturnType<typeof createHouseArchitecture>;
  private readonly camera: ArcRotateCamera;
  private readonly firstPersonCamera: UniversalCamera;
  private readonly jump = createJumpState();
  private readonly scooter = createScooterState();
  private readonly ladder = createLighthouseLadderState();
  private ladderInput = emptyLighthouseLadderInput();
  private ladderTransition?: { from: Vector3; to: Vector3; elapsed: number; leaving: boolean };
  private ladderNotice = "";
  private ladderNoticeUntil = 0;
  private scooterInput = emptyScooterInput();
  private readonly scooterModel: CoastalScooterModel;
  private scooterTransition?: { from: Vector3; to: Vector3; elapsed: number; yaw: number; targetYaw: number; pitch: number; targetPitch: number };
  private scooterNotice = "";
  private scooterNoticeUntil = 0;
  private readonly previousWalk = new Vector3();
  private walkPose?: { position: Vector3; rotation: Vector3; feet: number };
  private stableWalk?: { position: Vector3; feet: number };
  private readonly lighting: RoomLighting;
  private readonly contactShadows?: SSAO2RenderingPipeline;
  private readonly finishing: DefaultRenderingPipeline;
  private disposed = false;
  private controlsEnabled = true;
  private readonly interactions: RoomInteractions;
  private readonly pointerLock: RoomPointerLock;
  private readonly inspection: RoomItemInspection;
  private readonly floorPlan: RoomFloorPlan;
  private readonly exterior: RoomExterior;
  private currentView: RoomView = "overview";
  private previousView: Exclude<RoomView, "first-person"> = "overview";
  private pointerLocked = false;
  private pointerStart?: { x: number; y: number; id: number; dragged: boolean };
  private focusElapsed = 0;
  private viewFramingScale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    registerRoomRuntime();
    this.engine = new Engine(canvas, true, { stencil: true });
    this.engine.setHardwareScalingLevel(1);
    // Render at the display refresh rate; leave Engine.maxFPS uncapped for high-refresh screens.
    this.scene = new Scene(this.engine);
    this.scene.metadata = { layoutVersion: HOUSE_LAYOUT_VERSION,
      timeOfDay: { version: TIME_OF_DAY_VERSION, stage: 3, visualApplied: false, state: this.timeOfDay },
      lighthouseOperation: { version: LIGHTHOUSE_OPERATION_VERSION, stage: 3, visualApplied: false, state: this.lighthouseOperation } };
    this.builds = HOUSE_ROOMS.reduce((all, r) => { all[r.id] = this.rooms.begin(r.id); return all; }, {} as Record<HouseRoomId, RoomBuild>);
    // The final image-processing pass expects a linear clear colour.
    this.scene.clearColor = new Color4(0.14, 0.17, 0.18, 1).toLinearSpace();
    this.scene.ambientColor = new Color3(0.08, 0.075, 0.065);
    this.scene.skipPointerMovePicking = true;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = 1.12;
    this.scene.environmentTexture = new HDRCubeTexture("./environment/study-interior.hdr",
      this.scene, 128, false, true, false, true);
    this.scene.iblIntensity = 0.35;

    this.camera = new ArcRotateCamera("study-camera", 0.8, 1.08, 66, new Vector3(0, 0, 0), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 9;
    this.camera.upperRadiusLimit = 145;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.03;
    this.camera.wheelDeltaPercentage = 0.015;
    this.camera.panningSensibility = 85;
    this.camera.minZ = 0.2;
    this.camera.fov = 0.65;

    this.firstPersonCamera = new UniversalCamera("study-first-person", houseVector(HOUSE_SPAWN.x, HOUSE_SPAWN.y, 1.6), this.scene);
    this.firstPersonCamera.minZ = 0.1;
    this.firstPersonCamera.fov = 0.95;
    this.firstPersonCamera.speed = MOVEMENT_SPEED.base;
    this.firstPersonCamera.inertia = 0.55;
    this.firstPersonCamera.angularSensibility = 1800;
    this.firstPersonCamera.keysUp = [87, 38];
    this.firstPersonCamera.keysDown = [83, 40];
    this.firstPersonCamera.keysLeft = [65, 37];
    this.firstPersonCamera.keysRight = [68, 39];
    this.firstPersonCamera.keysUpward = [];
    this.firstPersonCamera.keysDownward = [];
    this.firstPersonCamera.checkCollisions = true;
    this.firstPersonCamera.ellipsoid.set(HOUSE_WALKER_RADIUS, 3.9, HOUSE_WALKER_RADIUS);
    this.scene.collisionsEnabled = true;
    // Horizontal collision stays with Babylon; this controller owns feet height, gravity and landing.
    this.firstPersonCamera.onAfterCheckInputsObservable.add(() => {
      if (this.currentView !== "first-person" || !this.controlsEnabled || this.isViewing) return;
      if (this.ladder.attached) this.updateLadder();
      else if (this.scooter.riding || this.scooterTransition) this.updateScooter(); else this.updateFirstPersonHeight();
    });

    this.lighting = new RoomLighting(this.scene, true);
    this.interactions = new RoomInteractions(this.scene, owners => this.lighting.refreshShadows(owners),
      () => this.currentView === "first-person" ? this.firstPersonCamera.position : undefined,
      event => this.audio.event(event));
    this.inspection = new RoomItemInspection(this.scene);
    this.floorPlan = new RoomFloorPlan(() => this.openFloorPlan(), resume => this.closeFloorPlan(resume), this.rooms,
      () => this.setView("coast"), () => this.returnHome());
    this.pointerLock = new RoomPointerLock(canvas, locked => {
      this.pointerLocked = locked;
      if (!locked) { this.pauseScooter(); this.pauseLadder(); }
      this.updateControls();
      this.updateInteractionHint();
    }, () => this.leaveFirstPerson(), () => {
      const help = document.querySelector("#view-help");
      if (help && this.currentView === "first-person") help.textContent = "点击画面启用鼠标环顾 · 空格跳跃 · ESC 退出第一人称";
    });
    if (SSAO2RenderingPipeline.IsSupported) {
      // Directional shadows describe the lights; short-range AO grounds feet under indirect light.
      this.contactShadows = new SSAO2RenderingPipeline("room-contact-shadows", this.scene,
        { ssaoRatio: 0.5, blurRatio: 1 }, [this.camera, this.firstPersonCamera]);
      this.contactShadows.radius = 1;
      this.contactShadows.totalStrength = 1.1;
      this.contactShadows.base = 0;
      this.contactShadows.samples = 16;
      this.contactShadows.maxZ = 110;
      this.contactShadows.bilateralSamples = 8;
      this.contactShadows.bilateralSoften = 0.5;
      this.contactShadows.textureSamples = 2;
    }
    this.finishing = createRoomFinishing(this.scene, [this.camera, this.firstPersonCamera, this.inspection.camera]);

    const furnishings = new RoomFurnishings(this.scene);
    this.exterior = new RoomExterior(this.scene);
    this.interactions.addDoor(this.exterior.lighthouseDoor);
    const lighthouse = this.exterior.lighthouseDetails;
    this.lighthousePanel = new LighthousePanel(canvas.ownerDocument, resume => this.closeLighthousePanel(resume), () => this.toggleLocalLighthouseTest(), {
      confirm: () => this.confirmLighthouseControl(), cover: () => this.inspectLighthouseCover(), clean: () => this.cleanLighthouseCover()});
    this.lighthouseMaintenancePanel = new LighthouseMaintenancePanel(canvas.ownerDocument,
      (command, tool) => this.localLighthouseMaintenance(command, tool), session => this.selectLighthouseDrill(session));
    this.interactions.addDevice(lighthouse.panel, () => this.openLighthousePanel("control"));
    this.interactions.addDevice(lighthouse.test, () => this.openLighthousePanel("test"));
    this.interactions.addLamp(lighthouse.switch, () => lighthouse.on, () => lighthouse.toggle());
    this.interactions.addDevice(lighthouse.log, () => this.openLighthousePanel("log"));
    this.interactions.addDevice(lighthouse.cover.device, () => this.openLighthousePanel("cover"));
    lighthouse.equipment.devices.forEach(device => this.interactions.addDevice(device,
      () => this.openLighthousePanel(device.id as LighthousePanelLocation)));
    this.scooterModel = new CoastalScooterModel(this.scene, this.exterior.sun, this.exterior.surfaces, this.exterior.meshes);
    this.scooterModel.update(this.scooter, false);
    this.notifyLighthouseOperation();
    this.architecture = createHouseArchitecture(this.scene, furnishings);
    furnishHouseStudy(furnishings);
    furnishHouseLiving(furnishings);
    furnishHouseMaster(furnishings);
    furnishHouseEnsuite(furnishings);
    furnishHouseBedroom(furnishings);
    furnishHouseKitchen(furnishings); furnishHouseBathroom(furnishings);
    furnishHouseBalcony(furnishings);
    furnishHouseCeilingLights(furnishings);
    this.lighting.addLivingRoom(this.scene, true);
    this.lighting.addMasterSuite(this.scene);
    this.lighting.addBedroom(this.scene);
    this.lighting.addServiceRooms(this.scene);
    this.lighting.addBalcony(this.scene);
    this.lighting.addCeilingLights();
    furnishings.finish().forEach(mesh => {
      mesh.checkCollisions = !mesh.metadata?.softCurtain;
    });
    this.architecture.setEnclosed(false);
    new RoomMirrors(this.scene);
    furnishings.drawers.forEach(drawer => this.interactions.addDrawer(drawer));
    furnishings.doors.forEach(door => this.interactions.addDoor(door));
    furnishings.slidingDoors.forEach(door => this.interactions.addSlidingDoor(door));
    furnishings.curtains.forEach(curtain => this.interactions.addCurtain(curtain,
      amount => this.lighting.setCurtain(curtain.windowId, amount)));
    furnishings.inspectables.forEach(item => this.interactions.addInspectable(item, item => this.openInspection(item)));
    furnishings.lamps.forEach(lamp => {
      const material = this.scene.getMaterialByName(lamp.id === "desk-lamp" ? "desk-lamp-glow"
        : lamp.id === "living-lamp" ? "living-lamp-shade" : lamp.id === "floor-lamp" ? "floor-lamp-shade" : lamp.id + "-glow") as PBRMaterial;
      this.lighting.bindLamp(lamp.id, material);
      this.interactions.addLamp(lamp, () => this.lighting.isLampOn(lamp.id), () => this.lighting.toggleLamp(lamp.id));
    });
    this.lighting.addMeshes(this.scene.meshes);
    this.applyTimeOfDay(this.timeOfDay);
    this.trackRoomResources(this.scene.meshes);
    this.exterior.bindShadowCasters(this.scene.meshes);
    this.rooms.own(HOUSE_ROOMS.map(r => this.builds[r.id]), this.exterior, () => this.exterior.dispose());
    for (const { id } of HOUSE_ROOMS) {
      const cleanup = {};
      this.rooms.own(this.builds[id], cleanup, () => {
        this.interactions.removeRoom(id); this.lighting.removeRoom(id);
      });
    }
    HOUSE_ROOMS.filter(r => !["study", "living"].includes(r.id)).forEach(r =>
      this.rooms.setState(this.builds[r.id], "ready"));
    this.scene.onBeforeRenderObservable.add(() => {
      this.updateTimeOfDay(this.engine.getDeltaTime() / 1000);
      this.updateScooterHeadlight();
      this.audio.update();
      if (!this.inspection.isOpen && this.scene.activeCamera === this.camera
        && this.architecture.updateCutaway(this.camera.position, this.camera.target)) {
        this.lighting.refreshShadows(); this.exterior.refreshShadows();
      }
      if (!this.inspection.isOpen && this.scene.activeCamera === this.camera)
        this.exterior.updateCutaway(this.currentView === "overview" ? undefined : this.camera.position, this.camera.target);
      if (this.isViewing) return;
      const delta = this.engine.getDeltaTime() / 1000;
      this.interactions.update(delta);
      this.focusElapsed += delta;
      if (this.focusElapsed >= 0.1) { this.focusElapsed = 0; this.updateInteractionHint(); this.updateFloorPlan(); }
    });

    const a = HOUSE_CONTENT;
    const livingModels = Promise.all([
      this.importFurniture("sofa_03.glb", "reading-sofa", houseVector(a.readingSofa.x, a.readingSofa.y), a.readingSofa.width, a.readingSofa.rotation, "living"),
      this.importFurniture("modern_arm_chair_01.glb", "reading-armchair", houseVector(a.readingChair.x, a.readingChair.y), a.readingChair.width, a.readingChair.rotation, "living"),
      this.importModel("gothic_commode.glb", "antique-cabinet", houseVector(a.cabinet.x, a.cabinet.y), a.cabinet.width, "living", a.cabinet.rotation).then(meshes => {
        if (meshes && this.rooms.isCurrent(this.builds.living)) cabinetDrawers(meshes).forEach(drawer => this.interactions.addDrawer(drawer));
      }),
    ]);
    const studyModels = this.importModel("wooden_bookshelf.glb", "antique-bookshelf", houseVector(a.bookshelf.x, a.bookshelf.y), a.bookshelf.width, "study").then(meshes => {
      if (!meshes || !this.rooms.isCurrent(this.builds.study)) return;
      const placement = this.scene.getTransformNodeByName("antique-bookshelf")!;
      const books = furnishings.furnishBookshelf(meshes);
      books.forEach(mesh => { mesh.unfreezeWorldMatrix(); mesh.setParent(placement); mesh.checkCollisions = true; });
      // Measure and fill in the unrotated model basis, then rotate the complete shelf once.
      placement.unfreezeWorldMatrix();
      const descendants = placement.getDescendants(false) as TransformNode[];
      descendants.forEach(node => node.unfreezeWorldMatrix());
      placement.rotation.y = a.bookshelf.rotation; placement.computeWorldMatrix(true);
      descendants.forEach(node => { node.computeWorldMatrix(true); node.freezeWorldMatrix(); });
      placement.freezeWorldMatrix();
      this.lighting.addMeshes(books); this.trackRoomResources(books);
    });
    const loads = ([ ["living", livingModels], ["study", studyModels] ] as const).map(([id, promise]) =>
      promise.then(() => { if (this.rooms.isCurrent(this.builds[id])) this.rooms.setState(this.builds[id], "ready"); })
        .catch(error => {
          if (this.disposed || !this.rooms.isCurrent(this.builds[id])) return;
          console.error(`${id} model loading failed`, error); this.rooms.fail(this.builds[id], error);
        }));
    Promise.all(loads).then(() => this.scene.executeWhenReady(() => {
      if (this.disposed) return;
      this.lighting.freezeShadows();
      const failed = ["study", "living"].filter((id: HouseRoomId) => this.rooms.snapshot(id).state === "error");
      const status = document.querySelector("#scene-status");
      if (status) status.textContent = failed.length ? "部分家具加载失败 · 刷新重试 · 基础结构可用" : "全屋八个房间已布置 · 可自由漫游";
      this.audio.sceneReady();
    }));

    this.setView("overview");
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    document.querySelector("#item-inspection-return")!.addEventListener("click", this.returnFromInspection);
    document.querySelector("#item-inspection")!.addEventListener("cancel", this.cancelInspection);
    document.addEventListener("keydown", this.keyDown);
    document.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.foregroundLost);
    window.addEventListener("blur", this.pauseAudio);
    window.addEventListener("focus", this.foregroundReturned);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.visibilityChanged);
    window.addEventListener("pagehide", this.dispose, { once: true });
    this.visibilityChanged();
  }

  /** Immediate selection remains available for callers; the menu uses transitionTimeOfDay. */
  get timeOfDay(): TimeOfDaySnapshot { return this.timeState.snapshot; }
  get timePlayback() { return this.timeState.playback; }
  get lighthouseOperation() { return this.lighthouseState.snapshot; }
  get lighthouseInspection() { return this.lighthouseInspectionState?.snapshot; }
  get lighthouseMaintenance() { return this.lighthouseMaintenanceState.snapshot; }
  startLighthouseTest(): boolean {
    if (this.disposed) return false;
    this.lighthouseMaintenanceState.synchronize(this.lighthouseState);
    if (this.lighthouseMaintenance.mainIsolated || this.lighthouseMaintenance.source === "backup") return false;
    const started = this.lighthouseState.startTest(); this.notifyLighthouseOperation(); return started;
  }
  endLighthouseTest(): boolean {
    if (this.disposed) return false;
    const ended = this.lighthouseState.endTest(); this.notifyLighthouseOperation(); return ended;
  }
  private notifyLighthouseOperation() {
    this.lighthouseMaintenanceState.synchronize(this.lighthouseState);
    const m = this.lighthouseMaintenance, evidenceKey = `${m.revision.drive}:${m.mainIsolated}:${m.mainAvailable}`;
    if (this.lighthouseEvidenceKey && evidenceKey !== this.lighthouseEvidenceKey) this.lighthouseInspectionState.invalidateMain(this.lighthouseOperation);
    this.lighthouseEvidenceKey = evidenceKey;
    this.lighthouseInspectionState?.synchronize(this.lighthouseOperation);
    this.scene.metadata.lighthouseOperation.state = this.lighthouseOperation;
    this.scene.metadata.lighthouseOperation.inspection = this.lighthouseInspection;
    this.scene.metadata.lighthouseEquipment = { project: 2, step: 2, commissioned: true, state: m,
      devices: LIGHTHOUSE_EQUIPMENT.map(device => ({id: device.id, parent: device.parent, label: device.label,
        ...lighthouseEquipmentReading(device.id, this.lighthouseOperation, m)})) };
    if (this.exterior?.lighthouseDetails?.beacon) {
      this.exterior.lighthouseDetails.beacon.apply(this.lighthouseOperation, this.lighthouseInspection?.transmission);
      this.exterior.lighthouseDetails.equipment.apply(m);
      if (this.lighthouseInspection) this.exterior.lighthouseDetails.cover?.apply(this.lighthouseInspection);
      this.scene.metadata.lighthouseOperation.visualApplied = true;
    }
    if (this.lighthouseInspection) {
      const rendered = this.lighthousePanel?.render(this.lighthouseOperation, this.lighthouseInspection);
      const near = this.atLighthouseFloor(LIGHTHOUSE.gallery) && !this.isViewing && !this.pauses.blocked;
      this.lighthousePanel?.renderActivity(this.lighthouseInspection, near, this.lighthouseOperation.running);
      this.lighthouseMaintenancePanel?.render(this.lighthousePanel.activeLocation, this.lighthouseOperation, m, !!rendered);
      this.lighthouseMaintenancePanel?.renderActivity(m, near, this.isViewing || this.pauses.blocked);
    }
  }
  setTimeOfDay(hour: number): TimeOfDaySnapshot {
    if (this.disposed) return this.timeOfDay;
    const state = this.timeState.select(hour);
    this.lighthouseState.selectTime(state.hour);
    this.notifyLighthouseOperation();
    this.applyTimeOfDay(state);
    this.notifyTimeOfDay();
    return state;
  }
  transitionTimeOfDay(hour: number, reducedMotion = false) {
    if (this.disposed) return;
    this.timeState.transitionTo(hour, reducedMotion);
    this.notifyTimeOfDay();
  }
  setTimeAutomatic(enabled: boolean) {
    if (this.disposed) return;
    this.timeState.setAutomatic(enabled);
    // Stopping between 10Hz batches must leave light, shadow and displayed clock in agreement.
    if (!enabled) this.applyTimeOfDay(this.timeOfDay);
    this.notifyTimeOfDay();
  }
  private updateTimeOfDay(delta: number) {
    if (this.disposed) return;
    const before = this.timeOfDay, transitioning = this.timePlayback.transitioning;
    const state = this.timeState.advance(delta, this.pauses.blocked, this.pauses.transitionBlocked);
    this.lighthouseMaintenanceState.synchronize(this.lighthouseState);
    const operationBefore = this.lighthouseOperation;
    this.lighthouseState.advance(this.timeState.lastAdvance, this.exterior.isVisible);
    const details = this.exterior.lighthouseDetails, eye = this.firstPersonCamera.position, origin = details.beacon.root.position;
    const output = this.lighthouseOperation.running ? lighthouseBeamStrength(this.lighthouseOperation.rotationTurns, eye.x - origin.x, eye.z - origin.z) * this.lighthouseInspection.transmission : 0;
    this.lighthouseMaintenanceState.advance(this.exterior.isVisible ? this.timeState.lastAdvance : {...this.timeState.lastAdvance, activeSeconds: 0}, this.lighthouseState, {
      action: !!this.lighthouseMaintenance.action && this.canObserveEquipment(this.lighthouseMaintenance.action.location),
      backup: this.lighthouseMaintenance.backupOn && this.canObserveBackup(),
      main: this.lighthouseMaintenance.trial && this.canObserveLighthouse({id: "lighthouse-beacon-main", label: "灯具与转台", meshes: details.beacon.meshes}, [details.cover.pane]), mainOutput: output
    });
    if (this.lighthouseInspectionState) {
      const inspection = this.lighthouseInspection;
      this.lighthouseInspectionState.advance(this.timeState.lastAdvance, operationBefore, this.lighthouseOperation, {
        optic: !inspection.optic && this.canObserveLighthouse({id: "lighthouse-beacon-main", label: "灯具与转台", meshes: details.beacon.meshes}, [details.cover.pane]),
        output: lighthouseBeamStrength(this.lighthouseOperation.rotationTurns, eye.x - origin.x, eye.z - origin.z),
        cover: inspection.cleaning && this.canObserveLighthouse(details.cover.device)
      });
    }
    this.notifyLighthouseOperation();
    if (state === before) return;
    this.timeVisualElapsed += Math.min(.1, Math.max(0, delta));
    if (transitioning || this.timeVisualElapsed >= .1 - 1e-10) {
      this.applyTimeOfDay(state); this.timeVisualElapsed = 0;
    }
    this.notifyTimeOfDay();
  }
  private notifyTimeOfDay() {
    Object.assign(this.scene.metadata.timeOfDay, { state: this.timeOfDay, playback: this.timePlayback, pauseReasons: this.pauseReasons });
    this.onTimeOfDayChange();
  }
  private applyTimeOfDay(state: TimeOfDaySnapshot) {
    if (this.disposed) return;
    this.lighting.applyTimeOfDay(state);
    this.exterior.applyTimeOfDay(state);
    this.scooterModel.headlight.applyTimeOfDay(state);
    this.scene.metadata.timeOfDay.visualApplied = true;
    this.scene.metadata.timeOfDay.visualHour = state.hour;
  }

  setView(view: RoomView) {
    if (this.isViewing) return;
    this.pauseScooter(); this.pauseLadder();
    if (this.currentView === "first-person" && !this.scooter.riding) this.saveWalkingPose();
    this.interactions.silenceMotion();
    this.audio.setSpatialCamera(view === "first-person" ? this.firstPersonCamera : undefined);
    const firstPerson = view === "first-person";
    if (firstPerson && this.currentView !== "first-person") this.previousView = this.currentView;
    this.currentView = view;
    if (view !== "first-person") {this.lighthouseInspectionState?.cancelCleaning(this.lighthouseOperation, "离开第一人称，清洁中断；盐膜保持原状。"); this.lighthouseMaintenanceState?.cancel(this.lighthouseOperation);}
    this.exterior.setVisible(view !== "overview");
    this.scooterModel.update(this.scooter, view !== "overview");
    this.updateScooterHeadlight();
    this.exterior.setHouseEnclosed(firstPerson || view === "coast");
    if (firstPerson) this.exterior.updateCutaway();
    if (!firstPerson) this.pointerLock?.release();
    this.scene.activeCamera?.detachControl();
    this.architecture.setEnclosed(firstPerson, view);
    this.lighting.refreshShadows(); this.exterior.refreshShadows();
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.cameraRotation.setAll(0);
    this.firstPersonCamera.movement.resetPanVelocity();
    this.firstPersonCamera.movement.resetRotationVelocity();
    const a = HOUSE_CONTENT;
    const views: Record<Exclude<RoomView, "first-person">, { position: Vector3; target: Vector3 }> = {
      overview: { position: new Vector3(-74, 82, 84), target: new Vector3(0, -3, 2) },
      coast: { position: houseVector(-65, 235, 180), target: houseVector(-65, 45, 0) },
      study: { position: houseVector(4.4, 4.2, 4.4), target: houseVector(a.desk.x, a.chair.y, 0.5) },
      living: { position: houseVector(3.2, 13.7, 6.8), target: houseVector(8.1, 7.5, 0.4) },
      master: { position: houseVector(3.8, 6.6, 4.7), target: houseVector(2.5, 2.2, 0.7) },
      bedroom: { position: houseVector(0.6, 6.8, 2.6), target: houseVector(3.6, 10.8, 0.9) },
      ensuite: { position: houseVector(-1.6, 8.3, 3.8), target: houseVector(1.2, 6, 0.9) },
      kitchen: { position: houseVector(10.5, 5.4, 4.5), target: houseVector(9.6, 1.7, .9) },
      bathroom: { position: houseVector(6.9, 3.8, 4.5), target: houseVector(3.9, 6, .8) },
      balcony: { position: houseVector(8.1, 11.45, 1.6), target: houseVector(3.2, 37, .5) },
      reading: { position: houseVector(6.3, 7.2, 3), target: houseVector(a.readingSofa.x, 4.7, 0.55) },
      desk: { position: houseVector(5.4, 3.5, 2.4), target: houseVector(a.desk.x, a.desk.y + 0.18, 0.65) },
      details: { position: houseVector(a.desk.x - 0.1, a.desk.y + 0.98, 1.45), target: houseVector(a.desk.x - 0.1, a.desk.y + 0.08, 0.78) },
      cabinet: { position: houseVector(8.3, 9.3, 2.1), target: houseVector(a.cabinet.x, a.cabinet.y, 0.6) },
    };
    if (firstPerson) {
      if (this.ladder?.attached) this.placeLadderCamera();
      else if (this.scooter.riding && scooterSupport(this.scooter)) {
        this.placeRiderCamera();
      } else if (this.walkPose && this.walkPoseIsValid(this.walkPose)) {
        this.firstPersonCamera.position.copyFrom(this.walkPose.position);
        this.firstPersonCamera.rotation.copyFrom(this.walkPose.rotation);
        if (this.jump) resetJumpState(this.jump, this.walkPose.feet);
      } else if (this.walkPose) this.restoreStableWalk(true);
      else {
        this.firstPersonCamera.position.copyFrom(houseVector(HOUSE_SPAWN.x, HOUSE_SPAWN.y, 1.6));
        this.firstPersonCamera.setTarget(houseVector(7.5, 7.8, 1.5));
        if (this.jump) resetJumpState(this.jump);
      }
      if (this.previousWalk) this.previousWalk.copyFrom(this.firstPersonCamera.position);
      this.scene.activeCamera = this.firstPersonCamera;
    } else {
      const selected = views[view];
      this.camera.fov = view === "balcony" ? .95 : view === "bedroom" || view === "coast" ? .8 : .65;
      // The distant graybox needs depth precision for its 25mm road overlay; room close-ups keep 0.2.
      this.camera.minZ = view === "coast" ? 5 : .2;
      this.camera.lowerRadiusLimit = view === "coast" ? 150 : view === "details" ? 3 : view === "bedroom" ? 4 : 9;
      // setPosition rebuilds/clamps the radius immediately; expand before applying a coastal pose.
      this.camera.upperRadiusLimit = view === "coast" ? 1800 : 145;
      this.camera.setTarget(selected.target);
      this.camera.setPosition(selected.position);
      this.viewFramingScale = 1;
      this.fitSuiteView();
      this.scene.activeCamera = this.camera;
    }
    this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = this.camera.inertialPanningY = 0;
    this.camera.movement.resetPanVelocity();
    this.updateControls();
    const help = document.querySelector("#view-help");
    const instructions = (firstPerson ? "移动鼠标环顾 · WASD / 方向键移动 · 空格跳跃 · 左键交互 · ESC 退出" : "拖动旋转 · 滚轮缩放 · 右键平移 · 点击物品交互") + " · T 调整时间";
    if (help) help.textContent = instructions;
    this.canvas.setAttribute("aria-label", "余晖小居八房三维场景，" + instructions);
    this.updateInteractionHint();
    this.updateFloorPlan();
    if (firstPerson && this.controlsEnabled) {
      this.canvas.focus({ preventScroll: true });
      this.pointerLock?.request();
    }
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
  }

  private scooterKey(code: string): keyof typeof this.scooterInput | undefined {
    return ({ KeyW: "forward", ArrowUp: "forward", KeyS: "back", ArrowDown: "back", KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right", Space: "brake" } as const)[code];
  }
  private keyUp = (event: KeyboardEvent) => {
    const key = this.scooterKey(event.code); if (key) this.scooterInput[key] = false;
    if (["KeyW", "ArrowUp"].includes(event.code)) this.ladderInput.up = false;
    if (["KeyS", "ArrowDown"].includes(event.code)) this.ladderInput.down = false;
  };
  private pauseScooter() {
    stopScooter(this.scooter); this.scooterInput = emptyScooterInput();
    this.scooter.exitRequested = false;
    if (this.scooterTransition) {
      this.firstPersonCamera.position.copyFrom(this.scooterTransition.to);
      this.firstPersonCamera.rotation.y = this.scooterTransition.targetYaw;
      this.firstPersonCamera.rotation.x = this.scooterTransition.targetPitch;
      this.scooterTransition = undefined;
    }
  }
  private scooterTarget() {
    if (this.ladder?.attached || this.scooter.riding || this.scooterTransition || !this.jump.grounded) return false;
    const hit = this.scene.pickWithRay(this.firstPersonCamera.getForwardRay(7.5), m => m.isPickable && m.isVisible && !m.metadata?.collisionOnly);
    return !!hit?.hit && !!hit.pickedMesh?.metadata?.scooter;
  }
  private updateScooterHeadlight() {
    this.scooterModel.headlight.setActive(this.scooter.riding && this.currentView === "first-person" && !document.hidden);
  }
  private boardScooter() {
    if (!this.scooterTarget() || !scooterSupport(this.scooter)) return false;
    this.pauseScooter(); this.saveWalkingPose(); this.scooter.riding = true;
    this.updateScooterHeadlight();
    const camera = this.firstPersonCamera, from = camera.position.clone(), yaw = camera.rotation.y;
    this.placeRiderCamera();
    this.scooterTransition = { from, to: camera.position.clone(), elapsed: 0, yaw, targetYaw: this.scooter.heading, pitch: camera.rotation.x, targetPitch: .08 };
    camera.position.copyFrom(from); this.updateControls(); this.updateInteractionHint(); return true;
  }
  private placeRiderCamera() {
    const support = scooterSupport(this.scooter); if (!support) return;
    const back = scooterEyeBack(this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight()));
    const point = scooterOffset(this.scooter, 0, -back), p = planToWorld(point, support.height + SCOOTER.eyeHeight);
    this.firstPersonCamera.position.set(p.x, p.y, p.z);
    this.firstPersonCamera.cameraDirection.setAll(0); this.firstPersonCamera.movement.resetPanVelocity();
  }
  private updateScooter() {
    const camera = this.firstPersonCamera, dt = Math.min(.2, Math.max(0, this.engine.getDeltaTime() / 1000));
    if (this.scooterTransition) {
      const t = this.scooterTransition; t.elapsed += dt;
      const a = Math.min(1, t.elapsed / .32), ease = a * a * (3 - 2 * a);
      Vector3.LerpToRef(t.from, t.to, ease, camera.position);
      camera.rotation.y = t.yaw + Math.atan2(Math.sin(t.targetYaw - t.yaw), Math.cos(t.targetYaw - t.yaw)) * ease;
      camera.rotation.x = t.pitch + (t.targetPitch - t.pitch) * ease;
      if (a === 1) { this.scooterTransition = undefined; this.updateControls(); }
      return;
    }
    if (!scooterSupport(this.scooter)) { this.returnHome(); return; }
    const heading = this.scooter.heading;
    if (this.pointerLocked && !document.hidden) advanceScooter(this.scooter, this.scooterInput, dt); else this.pauseScooter();
    const change = this.scooter.heading - heading;
    camera.rotation.y += Math.atan2(Math.sin(change), Math.cos(change));
    this.scooterModel.update(this.scooter, true); this.placeRiderCamera();
    if (this.scooter.exitRequested && Math.abs(this.scooter.speed) < .01) {
      this.scooter.exitRequested = false;
      const point = scooterDismount(this.scooter, (p, h) => this.interactions.walkerIsClear(houseVector(p.x, p.y, h + HOUSE_JUMP.eyeHeight)));
      if (!point) {
        this.scooterNotice = "这里没有安全落脚点，请稍微挪车再按 E"; this.scooterNoticeUntil = performance.now() + 3500;
        this.scooterInput = emptyScooterInput(); return;
      }
      const from = camera.position.clone(), to = houseVector(point.x, point.y, point.height + HOUSE_JUMP.eyeHeight);
      this.scooter.riding = false; this.pauseScooter(); resetJumpState(this.jump, point.height);
      this.updateScooterHeadlight();
      this.previousWalk.copyFrom(to); this.stableWalk = { position: to.clone(), feet: point.height };
      this.walkPose = { position: to.clone(), rotation: camera.rotation.clone(), feet: point.height };
      this.scooterTransition = { from, to, elapsed: 0, yaw: camera.rotation.y, targetYaw: camera.rotation.y, pitch: camera.rotation.x, targetPitch: camera.rotation.x };
      this.scooterNotice = "已停车 · 空格跳跃 · M 地图寻车"; this.scooterNoticeUntil = performance.now() + 2200;
      this.updateControls(); this.updateInteractionHint();
    }
  }

  private ladderTarget() {
    return !this.ladder?.attached && !this.scooter.riding && !this.scooterTransition
      && canBoardLighthouseLadder(worldToPlan(this.firstPersonCamera.position), this.jump.feet, this.jump.grounded);
  }
  private boardLadder() {
    if (!this.ladderTarget()) return false;
    this.lighthouseInspectionState?.cancelCleaning(this.lighthouseOperation, "转入爬梯，清洁中断；盐膜保持原状。");
    this.lighthouseMaintenanceState?.cancel(this.lighthouseOperation);
    const floor = lighthouseLadderFloor(this.jump.feet, .08)!;
    this.ladder.attached = true; this.ladder.feet = floor.height; this.ladderInput = emptyLighthouseLadderInput();
    const p = lighthouseLadderPoint();
    this.ladderTransition = { from: this.firstPersonCamera.position.clone(),
      to: houseVector(p.x, p.y, floor.height + HOUSE_JUMP.eyeHeight), elapsed: 0, leaving: false };
    this.jump.queued = false; this.jump.grounded = false;
    this.updateControls(); this.updateInteractionHint(); return true;
  }
  private leaveLadder() {
    if (!this.ladder.attached || this.ladderTransition) return;
    const floor = lighthouseLadderFloor(this.ladder.feet), p = lighthouseLadderLanding();
    if (!floor || !walkingPointAllowed(p, HOUSE_JUMP.playerRadius, floor.height)
      || !this.interactions.walkerIsClear(houseVector(p.x, p.y, floor.height + HOUSE_JUMP.eyeHeight))) {
      this.ladderNotice = floor ? "落脚处暂时被挡住，请稍后再试" : "先爬到楼层停靠点，再按 E 离梯";
      this.ladderNoticeUntil = performance.now() + 2500; this.ladderInput = emptyLighthouseLadderInput();
      this.updateInteractionHint(); return;
    }
    this.ladder.feet = floor.height; this.ladderInput = emptyLighthouseLadderInput();
    this.ladderTransition = { from: this.firstPersonCamera.position.clone(),
      to: houseVector(p.x, p.y, floor.height + HOUSE_JUMP.eyeHeight), elapsed: 0, leaving: true };
  }
  private finishLeavingLadder() {
    this.ladder.attached = false; this.ladderTransition = undefined;
    resetJumpState(this.jump, this.ladder.feet);
    this.previousWalk.copyFrom(this.firstPersonCamera.position);
    this.stableWalk = { position: this.firstPersonCamera.position.clone(), feet: this.ladder.feet };
    this.walkPose = { ...this.stableWalk, rotation: this.firstPersonCamera.rotation.clone() };
    this.updateControls(); this.updateInteractionHint();
  }
  private pauseLadder() {
    if (!this.ladder) return;
    this.ladderInput = emptyLighthouseLadderInput();
    if (this.ladderTransition) {
      const leaving = this.ladderTransition.leaving;
      this.firstPersonCamera.position.copyFrom(this.ladderTransition.to); this.ladderTransition = undefined;
      if (leaving) this.finishLeavingLadder();
    }
  }
  private placeLadderCamera() {
    const p = lighthouseLadderPoint(), camera = this.firstPersonCamera;
    camera.position.copyFrom(houseVector(p.x, p.y, this.ladder.feet + HOUSE_JUMP.eyeHeight));
    camera.cameraDirection.setAll(0); camera.movement.resetPanVelocity();
    this.jump.feet = this.ladder.feet; this.jump.velocity = 0; this.jump.grounded = false; this.jump.queued = false;
    this.previousWalk.copyFrom(camera.position);
  }
  private updateLadder() {
    if (!Number.isFinite(this.ladder.feet) || this.ladder.feet < LIGHTHOUSE.floor - .01 || this.ladder.feet > LIGHTHOUSE.gallery + .01) {
      this.ladder.attached = false; this.ladderTransition = undefined; this.pauseLadder(); this.restoreStableWalk(); this.updateControls(); return;
    }
    const dt = Math.min(.2, Math.max(0, this.engine.getDeltaTime() / 1000));
    if (this.ladderTransition) {
      const transition = this.ladderTransition; transition.elapsed += dt;
      const t = Math.min(1, transition.elapsed / .32), eased = t * t * (3 - 2 * t);
      Vector3.LerpToRef(transition.from, transition.to, eased, this.firstPersonCamera.position);
      this.firstPersonCamera.cameraDirection.setAll(0); this.firstPersonCamera.movement.resetPanVelocity();
      if (t === 1) { this.ladderTransition = undefined; if (transition.leaving) this.finishLeavingLadder(); else this.placeLadderCamera(); }
      return;
    }
    if (this.pointerLocked && !document.hidden) {
      const arrived = advanceLighthouseLadder(this.ladder, this.ladderInput, dt);
      if (arrived) {
        const p = lighthouseLadderLanding(); this.stableWalk = { position: houseVector(p.x, p.y, arrived.height + HOUSE_JUMP.eyeHeight), feet: arrived.height };
      }
    } else this.pauseLadder();
    this.placeLadderCamera();
  }

  private updateFirstPersonHeight() {
    const camera = this.firstPersonCamera, previous = this.previousWalk;
    if (!camera || !previous) return;
    const wanted = worldToPlan(camera.position), point = sweepWalking(worldToPlan(previous), wanted, this.jump.feet, this.jump.grounded && !this.jump.queued);
    if (!point) { this.restoreStableWalk(); return; }
    if (Math.hypot(point.x - wanted.x, point.y - wanted.y) > .001) {
      const p = planToWorld(point); camera.position.x = p.x; camera.position.z = p.z;
      camera.cameraDirection.setAll(0); camera.movement.resetPanVelocity();
    }
    if (point.stepped && this.jump.grounded && !this.jump.queued) {
      this.jump.feet = point.height; this.jump.originTop = point.height;
    }
    const support = walkingSurfaceAt(point.x, point.y, this.jump.feet, this.jump.grounded && !this.jump.queued ? .18 : 0);
    if (!support) { this.restoreStableWalk(); return; }
    let remaining = Math.min(.2, Math.max(1 / 240, this.engine.getDeltaTime() / 1000));
    let frame = { feet: this.jump.feet, grounded: this.jump.grounded } as ReturnType<typeof advanceJump>;
    while (remaining > 1e-8) {
      const dt = Math.min(1 / 60, remaining); remaining -= dt;
      frame = advanceJump(this.jump, dt, point, { floor: support.height, ceiling: support.ceiling });
      if (frame.snapped) break;
    }
    if (frame.snapped) {
      if (walkingPointAllowed(frame.snapped, HOUSE_JUMP.playerRadius, frame.feet)) {
        const snapped = planToWorld(frame.snapped); camera.position.x = snapped.x; camera.position.z = snapped.z;
      }
    }
    camera.position.y = planToWorld(point, frame.feet + HOUSE_JUMP.eyeHeight).y;
    if (!Number.isFinite(frame.feet) || frame.feet < support.height - .3) { this.restoreStableWalk(); return; }
    previous.copyFrom(camera.position);
    if (frame.grounded && Math.abs(frame.feet - support.height) < .06)
      this.stableWalk = { position: camera.position.clone(), feet: frame.feet };
  }

  private walkPoseIsValid(pose: { position: Vector3; feet: number }) {
    const p = worldToPlan(pose.position), support = walkingSurfaceAt(p.x, p.y, pose.feet);
    const platform = jumpPlatformAt(p.x, p.y);
    return walkingPointAllowed(p, HOUSE_JUMP.playerRadius, pose.feet) && !!support && (Math.abs(pose.feet - support.height) < .08
      || !!platform && Math.abs(pose.feet - platform.top) < .08) && this.interactions.walkerIsClear(pose.position);
  }

  private saveWalkingPose() {
    if (this.ladder?.attached) return;
    if (!this.jump) return;
    const position = this.jump.grounded ? this.firstPersonCamera.position.clone() : this.stableWalk?.position.clone();
    const feet = this.jump.grounded ? this.jump.feet : this.stableWalk?.feet;
    if (position && feet !== undefined) this.walkPose = { position, feet, rotation: this.firstPersonCamera.rotation.clone() };
  }

  private restoreStableWalk(home = false) {
    const camera = this.firstPersonCamera;
    const stable = !home && this.stableWalk && this.walkPoseIsValid(this.stableWalk) ? this.stableWalk : undefined;
    const support = walkingSurfaceAt(COASTAL_HOME.x, COASTAL_HOME.y)!;
    camera.position.copyFrom(stable?.position || houseVector(COASTAL_HOME.x, COASTAL_HOME.y, support.height + HOUSE_JUMP.eyeHeight));
    resetJumpState(this.jump, stable?.feet ?? support.height);
    camera.cameraDirection.setAll(0); camera.cameraRotation.setAll(0);
    camera.movement.resetPanVelocity(); camera.movement.resetRotationVelocity();
    this.previousWalk.copyFrom(camera.position);
    this.stableWalk = { position: camera.position.clone(), feet: this.jump.feet };
  }

  private returnHome() {
    this.closeFloorPlan(false);
    this.pauseScooter(); resetScooter(this.scooter); this.scooterTransition = undefined;
    if (this.ladder) { this.ladder.attached = false; this.ladderTransition = undefined; this.pauseLadder(); }
    this.scooterModel.update(this.scooter, this.currentView !== "overview");
    this.updateScooterHeadlight();
    this.updateControls();
    this.restoreStableWalk(true);
    this.firstPersonCamera.setTarget(houseVector(13, -3, 1.6));
    this.walkPose = { position: this.firstPersonCamera.position.clone(), feet: this.jump.feet, rotation: this.firstPersonCamera.rotation.clone() };
    if (this.currentView === "first-person") {
      this.updateFloorPlan();
      if (this.controlsEnabled) this.pointerLock.request();
    } else this.setView("first-person");
  }

  setMovementSpeed(multiplier: number) {
    if (!Number.isFinite(multiplier)) multiplier = MOVEMENT_SPEED.default;
    const speed = Math.max(MOVEMENT_SPEED.min, Math.min(MOVEMENT_SPEED.max, multiplier));
    this.firstPersonCamera.speed = MOVEMENT_SPEED.base * speed;
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.movement.resetPanVelocity();
    return speed;
  }

  setControlsEnabled(enabled: boolean) {
    this.setPaused("external", !enabled);
  }
  get pauseReasons() { return this.pauses.snapshot; }
  setPaused(reason: RoomPauseReason, paused: boolean) {
    if (this.disposed || !this.pauses.set(reason, paused)) return;
    this.timeState.resetDelta();
    if (paused) this.lighthouseInspectionState?.cancelCleaning(this.lighthouseOperation, "打开界面或失焦，清洁中断；盐膜保持原状。");
    if (paused) this.lighthouseMaintenanceState?.cancel(this.lighthouseOperation);
    this.controlsEnabled = !this.pauses.blocked;
    if (paused && !this.timePlayback.transitioning) this.applyTimeOfDay(this.timeOfDay);
    if (!this.controlsEnabled) {
      this.pauseScooter(); this.pauseLadder(); this.jump.queued = false;
      this.interactions.silenceMotion(); this.pointerLock.release();
    }
    this.updateControls();
    this.updateInteractionHint();
    this.notifyTimeOfDay();
    this.onPauseChange();
  }

  private get isViewing() { return !!(this.inspection?.isOpen || this.floorPlan?.isOpen || this.lighthousePanel?.isOpen); }

  private atLighthouseFloor(expected: number) {
    return !this.disposed && this.currentView === "first-person" && this.exterior.isVisible
      && !this.ladder.attached && !this.ladderTransition && !this.scooter.riding && !this.scooterTransition
      && this.jump.grounded && Math.abs(this.jump.feet - expected) < .08;
  }
  private canAccessLighthouse(location: LighthousePanelLocation) {
    const details = this.exterior.lighthouseDetails;
    const equipment = lighthouseEquipmentDefinition(location);
    if (equipment) {
      const device = details.equipment.device(equipment.id);
      return !!device && this.atLighthouseFloor(equipment.floor)
        && this.interactions.canReachDevice(device, this.firstPersonCamera.position);
    }
    const device = location === "test" ? details.test : location === "cover" ? details.cover.device : location === "log" ? details.log : details.panel;
    return this.atLighthouseFloor(location === "test" || location === "cover" ? LIGHTHOUSE.gallery : LIGHTHOUSE.floor)
      && this.interactions.canReachDevice(device, this.firstPersonCamera.position);
  }
  private canObserveLighthouse(device: import("./RoomInteractions").InteractiveDevice, transparent: readonly Mesh[] = []) {
    return this.atLighthouseFloor(LIGHTHOUSE.gallery) && !this.isViewing && !this.pauses.blocked
      && this.interactions.canReachDevice(device, this.firstPersonCamera.position, 7.5,
        this.firstPersonCamera.getForwardRay().direction, transparent);
  }
  private canObserveEquipment(location: string) {
    const equipment = lighthouseEquipmentDefinition(location), device = equipment && this.exterior.lighthouseDetails.equipment.device(equipment.id);
    return !!equipment && !!device && this.atLighthouseFloor(equipment.floor) && !this.isViewing && !this.pauses.blocked
      && this.interactions.canReachDevice(device, this.firstPersonCamera.position, 7.5, this.firstPersonCamera.getForwardRay().direction);
  }
  private canObserveBackup() {
    if (!this.atLighthouseFloor(LIGHTHOUSE.gallery) || this.isViewing || this.pauses.blocked) return false;
    const mount = LIGHTHOUSE_BACKUP_MOUNT, t = COASTAL_SITE.tower;
    const p = planToWorld({x: t.x + mount.x - .09, y: t.y + mount.y - .06}, mount.lensBottom + mount.lensHeight * .86);
    const target = new Vector3(p.x, p.y, p.z), eye = this.firstPersonCamera.position, direction = target.subtract(eye).normalize();
    if (Vector3.Distance(eye, target) > 15 || Vector3.Dot(direction, this.firstPersonCamera.getForwardRay().direction) < Math.cos(Math.PI / 7.2)) return false;
    const hit = this.scene.pickWithRay(new Ray(eye, direction, 15), interactionSurface);
    return hit?.pickedMesh?.name === "coastal-lighthouse-equipment-beacon-backup-solar";
  }

  private openLighthousePanel(location: LighthousePanelLocation) {
    if (!this.controlsEnabled || this.isViewing || !this.pointerLocked || !this.canAccessLighthouse(location)) return;
    if (!this.lighthousePanel.open(location, this.lighthouseOperation, this.lighthouseInspection)) return;
    // Modal state exists before lock release, preserving the first-person pose.
    this.setPaused("lighthouse-panel", true);
    this.lighthouseMaintenancePanel.render(location, this.lighthouseOperation, this.lighthouseMaintenance);
    this.audio.stopAll(); this.audio.play("switch", "lighthouse-control-panel");
    this.updateControls(); this.updateInteractionHint();
  }

  private closeLighthousePanel(resumePointer: boolean) {
    if (!this.lighthousePanel.isOpen) return;
    this.lighthousePanel.close(); this.setPaused("lighthouse-panel", false);
    this.updateControls(); this.updateInteractionHint(); this.canvas.focus({preventScroll: true});
    if (resumePointer && this.currentView === "first-person" && this.controlsEnabled) this.pointerLock.request();
  }

  private toggleLocalLighthouseTest() {
    if (this.lighthousePanel.activeLocation !== "test" || !this.canAccessLighthouse("test")
      || this.pauseReasons.some(reason => reason !== "lighthouse-panel")) {
      this.lighthousePanel.notice("请在顶层灯座旁恢复操作；当前试灯状态保持。"); return;
    }
    if (this.lighthouseOperation.testSecondsRemaining > 0) this.endLighthouseTest();
    else if (!this.startLighthouseTest()) {this.lighthousePanel.notice("主灯当前故障、隔离或由备用接替，请从检修口按隔离检测/受控试机流程操作。"); return;}
    this.audio.play("switch", "lighthouse-beacon-main"); this.closeLighthousePanel(true);
  }

  private lighthouseCommandAllowed(location: LighthousePanelLocation) {
    return this.lighthousePanel.activeLocation === location && this.canAccessLighthouse(location)
      && !this.pauseReasons.some(reason => reason !== "lighthouse-panel");
  }
  private localLighthouseMaintenance(command: MaintenanceCommand, tool: LighthouseTool) {
    const location = this.lighthousePanel.activeLocation;
    if (!location) return;
    const accepted = this.lighthouseMaintenanceState.command(command, location, tool, this.lighthouseState, this.lighthouseCommandAllowed(location));
    this.notifyLighthouseOperation();
    if (accepted && (this.lighthouseMaintenance.action || ["self-test", "takeover", "trial"].includes(command))) this.closeLighthousePanel(true);
  }
  private selectLighthouseDrill(session: LighthouseDrill) {
    const location = this.lighthousePanel.activeLocation;
    if ((location !== "control" && location !== "log") || !this.lighthouseCommandAllowed(location)) return;
    if (session === "normal") {
      if (!this.suspendedLighthouse) return;
      const saved = this.suspendedLighthouse;
      this.timeState = saved.time; this.lighthouseState = saved.operation; this.lighthouseInspectionState = saved.inspection;
      this.lighthouseMaintenanceState = saved.maintenance; this.suspendedLighthouse = undefined;
    } else {
      if (this.suspendedLighthouse || !["drive", "charger", "sensor"].includes(session)) return;
      this.suspendedLighthouse = {time: this.timeState, operation: this.lighthouseState, inspection: this.lighthouseInspectionState, maintenance: this.lighthouseMaintenanceState};
      this.timeState = new RoomTimeOfDay(); this.lighthouseState = new LighthouseOperation(); this.lighthouseInspectionState = new LighthouseInspection();
      this.lighthouseMaintenanceState = new LighthouseMaintenance(session);
      this.timeState.select(session === "drive" ? 21 : 12); this.lighthouseState.selectTime(this.timeOfDay.hour);
    }
    this.lighthouseEvidenceKey = ""; this.timeState.resetDelta(); this.timeVisualElapsed = 0;
    this.notifyLighthouseOperation(); this.applyTimeOfDay(this.timeOfDay); this.notifyTimeOfDay();
  }
  private confirmLighthouseControl() {
    if (!this.lighthouseCommandAllowed("control")) {this.lighthousePanel.notice("请回到首层运行面板旁确认读数。"); return;}
    this.lighthouseInspectionState.confirmControl(this.lighthouseOperation, true); this.notifyLighthouseOperation();
  }
  private inspectLighthouseCover() {
    if (!this.lighthouseCommandAllowed("cover")) {this.lighthousePanel.notice("请回到顶层固定保护面旁进行观察。"); return;}
    this.lighthouseInspectionState.inspectCover(this.lighthouseOperation, true); this.notifyLighthouseOperation();
  }
  private cleanLighthouseCover() {
    if (!this.lighthouseCommandAllowed("cover") || !LighthouseInspection.canClean(this.lighthouseOperation)) {
      this.lighthousePanel.notice("仅在顶层近距离、白天自动待机时可以擦拭。运行状态保持。"); return;
    }
    // Closing releases only this modal's pause. The action advances later from accepted active receipts.
    if (!this.lighthouseInspectionState.startCleaning(this.lighthouseOperation, true)) return;
    this.closeLighthousePanel(true); this.notifyLighthouseOperation();
  }

  private updateFloorPlan() {
    this.floorPlan.update(this.currentView, this.firstPersonCamera.position, this.firstPersonCamera.getForwardRay().direction, this.scooter, this.ladder?.attached ? this.ladder.feet : undefined);
  }

  private openFloorPlan() {
    if (!this.controlsEnabled || this.isViewing) return;
    this.pauseScooter(); this.pauseLadder();
    this.updateFloorPlan();
    // Set modal state before releasing the lock so its change event cannot leave first-person.
    this.floorPlan.open();
    this.setPaused("map", true);
    this.interactions.silenceMotion();
    this.audio.stopAll();
    this.pointerLock.release();
    this.updateControls();
    this.updateInteractionHint();
  }

  private closeFloorPlan(resumePointer: boolean) {
    if (!this.floorPlan.isOpen) return;
    this.floorPlan.close();
    this.setPaused("map", false);
    this.updateControls();
    this.updateInteractionHint();
    if (this.currentView === "first-person") {
      this.canvas.focus({ preventScroll: true });
      if (resumePointer && this.controlsEnabled) this.pointerLock.request();
    }
  }

  private updateControls() {
    this.pointerStart = undefined;
    this.camera.detachControl();
    this.firstPersonCamera.detachControl();
    this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = this.camera.inertialPanningY = 0;
    this.camera.movement.resetPanVelocity();
    this.camera.movement.resetRotationVelocity();
    const camera = this.scene.activeCamera === this.firstPersonCamera ? this.firstPersonCamera : this.camera;
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.cameraRotation.setAll(0);
    camera.movement.resetPanVelocity();
    camera.movement.resetRotationVelocity();
    if (!this.isViewing && this.controlsEnabled && (camera !== this.firstPersonCamera || this.pointerLocked)) {
      camera.attachControl(this.canvas, true);
      if (camera === this.firstPersonCamera && (this.scooter.riding || this.scooterTransition || this.ladder?.attached)) {
        for (const name of ["keyboard", "touch", "gamepad"]) this.firstPersonCamera.inputs.attached[name]?.detachControl();
      }
    }
  }

  private openInspection(item: InspectableItem) {
    if (!this.controlsEnabled || this.isViewing || !this.inspection.open(item)) return;
    this.setPaused("inspection", true);
    this.interactions.silenceMotion();
    this.audio.stopAll();
    this.audio.play("paper", "inspection");
    this.pointerLock.release();
    this.updateControls();
    this.updateInteractionHint();
    document.querySelector("#item-inspection-title")!.textContent = item.label;
    document.body.classList.add("viewing-item");
    this.resizeInspection();
    document.querySelector<HTMLDialogElement>("#item-inspection")!.showModal();
  }

  private closeInspection(resumePointer: boolean) {
    if (!this.inspection.close()) return;
    this.audio.stopEntity("inspection");
    this.audio.play("paper", "inspection");
    document.querySelector<HTMLDialogElement>("#item-inspection")!.close();
    document.body.classList.remove("viewing-item");
    this.setPaused("inspection", false);
    this.updateControls();
    this.updateInteractionHint();
    this.canvas.focus({ preventScroll: true });
    if (resumePointer && this.currentView === "first-person" && this.controlsEnabled) this.pointerLock.request();
  }

  private returnFromInspection = () => this.closeInspection(true);
  private cancelInspection = (event: Event) => {
    event.preventDefault();
    this.closeInspection(false);
  };

  private resizeInspection() {
    if (!this.inspection.isOpen) return;
    const pixels = this.inspection.resize() * this.canvas.clientHeight / this.engine.getRenderHeight();
    document.querySelector<HTMLElement>("#item-inspection")!.style.setProperty("--item-half-height", pixels + "px");
  }

  private leaveFirstPerson = () => {
    if (this.isViewing || this.pauses.blocked) return;
    if (this.currentView === "first-person") this.setView(this.previousView);
  };

  private keyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.isTrusted && !event.repeat && event.key === "Escape") { this.resumeAudio(); this.audio.unlockFromGesture(); }
    if (this.lighthousePanel.isOpen) return; // The native dialog owns Escape/Tab/Enter.
    if (this.floorPlan.isOpen) {
      if (event.key === "Escape") { event.preventDefault(); this.closeFloorPlan(false); }
      return;
    }
    if (this.inspection.isOpen) {
      if (event.key === "Escape") this.cancelInspection(event);
      return;
    }
    if (!this.controlsEnabled) return;
    if (!event.repeat && event.key.toLowerCase() === "m" && !event.ctrlKey && !event.metaKey && !event.altKey
      && !(event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable]"))) {
      event.preventDefault();
      this.openFloorPlan();
      return;
    }
    const editable = event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable]");
    if (editable || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.currentView === "first-person" && this.controlsEnabled && this.pointerLocked) {
      if (this.ladder?.attached) {
        if (["KeyW", "ArrowUp", "KeyS", "ArrowDown"].includes(event.code)) {
          event.preventDefault();
          if (!event.repeat && !this.ladderTransition) this.ladderInput[["KeyW", "ArrowUp"].includes(event.code) ? "up" : "down"] = true;
          return;
        }
        if (event.code === "KeyE") { event.preventDefault(); if (!event.repeat) this.leaveLadder(); return; }
        if (["Space", "KeyA", "KeyD", "ArrowLeft", "ArrowRight"].includes(event.code)) { event.preventDefault(); return; }
      }
      if (this.scooterKey(event.code)) {
        if (this.scooter.riding) {
          event.preventDefault();
          if (!event.repeat && !this.scooterTransition) this.scooterInput[this.scooterKey(event.code)!] = true;
          return;
        }
      }
      if (event.code === "KeyE" && !event.repeat) {
        event.preventDefault();
        if (this.scooter.riding) this.scooter.exitRequested = true; else if (!this.boardLadder()) this.boardScooter();
        return;
      }
    }
    if (!event.repeat && event.code === "Space" && this.currentView === "first-person" && this.controlsEnabled
      && !(event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable]"))) {
      event.preventDefault();
      if (!this.ladder?.attached && !this.scooter.riding && !this.scooterTransition && this.jump) requestJump(this.jump);
      return;
    }
    if (event.key === "Escape") this.leaveFirstPerson();
  };

  private pointerDown = (event: PointerEvent) => {
    if (event.isTrusted && event.button === 0) { this.resumeAudio(); this.audio.unlockFromGesture(); }
    if (event.button !== 0 || !this.controlsEnabled || this.isViewing) return;
    if (this.currentView === "first-person" && !this.pointerLocked) {
      this.pointerLock.request();
      this.pointerStart = undefined;
      return;
    }
    this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId, dragged: false };
  };

  private pointerMove = (event: PointerEvent) => {
    const start = this.pointerStart;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start.dragged = true;
  };

  private pointerCancel = () => { this.pointerStart = undefined; };

  private pointerUp = (event: PointerEvent) => {
    const start = this.pointerStart;
    this.pointerStart = undefined;
    if (event.button !== 0 || !start || start.id !== event.pointerId || start.dragged || !this.controlsEnabled || this.isViewing) return;
    if (this.currentView === "first-person") {
      if (!this.pointerLocked) return;
      if (this.ladder?.attached) { this.leaveLadder(); return; }
      if (this.scooter.riding || this.scooterTransition) return;
      if (!this.boardLadder() && !this.boardScooter()) this.interactions.pick(this.firstPersonCamera.getForwardRay(7.5))?.toggle();
    } else {
      const rect = this.canvas.getBoundingClientRect();
      const ray = this.scene.createPickingRay(event.clientX - rect.left, event.clientY - rect.top, null, this.camera);
      this.interactions.pick(ray)?.toggle();
    }
    this.updateInteractionHint();
  };

  private updateInteractionHint() {
    const reticle = document.querySelector<HTMLElement>("#interaction-reticle");
    const hint = document.querySelector<HTMLElement>("#interaction-hint");
    const firstPerson = this.currentView === "first-person" && !this.isViewing;
    if (reticle) reticle.hidden = !firstPerson;
    if (firstPerson) {
      const help = document.querySelector("#view-help");
      const point = worldToPlan(this.firstPersonCamera.position);
      const lighthouseRegion = walkingSurfaceAt(point.x, point.y, this.jump.feet)?.region;
      const inLighthouse = lighthouseRegion?.startsWith("灯塔") && !["灯塔前场", "灯塔入口", "灯塔独立机房"].includes(lighthouseRegion);
      if (help) help.textContent = this.ladder?.attached ? "垂直梯 · W/↑ 上爬 · S/↓ 下爬 · E 到层离梯 · 松键停留 · M 地图" : this.scooter.riding ? "鼠标环顾 · WASD 驾驶 · 空格刹车 · E 下车 · M 地图 · ESC 退出"
        : lighthouseRegion === "灯塔独立机房" ? "独立机房 · 点击设备查看 · 保持检修入口畅通 · M 地图" : inLighthouse
          ? `${lighthouseRegion} · 靠近垂直梯按 E 上下楼 · M 地图`
          : "移动鼠标环顾 · WASD / 方向键移动 · 空格跳跃 · 左键交互 · ESC 退出";
      if (help) help.textContent += " · T 调整时间";
    }
    const ladderTarget = firstPerson && this.pointerLocked && this.controlsEnabled && this.ladderTarget();
    const vehicle = firstPerson && this.pointerLocked && this.controlsEnabled && this.scooterTarget();
    const action = firstPerson && !this.ladder?.attached && !ladderTarget && !this.scooter.riding && !this.scooterTransition && !vehicle && this.pointerLocked && this.controlsEnabled
      ? this.interactions.pick(this.firstPersonCamera.getForwardRay(7.5)) : undefined;
    reticle?.classList.toggle("has-target", !!action || !!vehicle || !!ladderTarget);
    if (hint) {
      const ladderFloor = this.ladder?.attached ? lighthouseLadderFloor(this.ladder.feet) : undefined;
      hint.textContent = firstPerson && this.ladder?.attached ? this.ladderNoticeUntil > performance.now() ? this.ladderNotice
        : ladderFloor ? `已到${ladderFloor.label} · E / 左键离梯 · 松开后按 W/S 继续`
        : "W/↑ 上爬 · S/↓ 下爬 · 松开停留 · 到楼层后按 E 离梯"
        : ladderTarget ? "E / 左键 · 抓住垂直梯" : firstPerson && this.scooter.riding ? this.scooterNoticeUntil > performance.now() ? this.scooterNotice
        : this.scooter.exitRequested ? "正在停车，寻找安全下车位置…"
        : `骑行 ${Math.abs(this.scooter.speed * 3.6).toFixed(0)} km/h · W 前进 / S 刹车倒车 · A/D 转向 · 空格急刹 · E 下车`
        : firstPerson && this.scooterNoticeUntil > performance.now() ? this.scooterNotice
        : vehicle ? "左键 / E · 骑上小电驴" : action ? `左键 · ${action.label()}` : firstPerson && !this.pointerLocked ? "点击画面开始环顾 · ESC 退出" : "";
      hint.hidden = !hint.textContent;
    }
  }

  private async importFurniture(file: string, name: string, position: Vector3, width: number, rotation = 0, roomId: HouseRoomId = "study") {
    const result = await SceneLoader.ImportMeshAsync("", "./models/study/", file, this.scene);
    if (!this.adoptImported(result.meshes, result.transformNodes, roomId)) return;
    result.meshes.forEach(mesh => {
      if (mesh.material instanceof PBRMaterial) {
        mesh.material.usePhysicalLightFalloff = false;
        mesh.material.maxSimultaneousLights = 4;
        mesh.material.environmentIntensity = 0.85;
        if (mesh.material.name.includes("_pillow")) {
          // Preserve the scanned wrinkles and roughness, with warm moss leather instead of black.
          mesh.material.albedoTexture = null;
          mesh.material.albedoColor = Color3.FromHexString("#596247").toLinearSpace();
          mesh.material.roughness = 0.85;
        }
      }
    });
    placeFurniture(result.meshes, this.scene, name, position, width, rotation, roomId);
    this.lighting.addMeshes(result.meshes);
    this.trackRoomResources(result.meshes);
    return result.meshes;
  }

  private async importModel(file: string, name: string, position: Vector3, width: number, roomId: HouseRoomId, rotation = 0) {
    const result = await SceneLoader.ImportMeshAsync("", "./models/", file, this.scene);
    if (!this.adoptImported(result.meshes, result.transformNodes, roomId)) return;
    result.meshes.forEach(mesh => {
      if (mesh.material instanceof PBRMaterial) {
        mesh.material.usePhysicalLightFalloff = false; mesh.material.maxSimultaneousLights = 4;
      }
    });
    placeFurniture(result.meshes, this.scene, name, position, width, rotation, roomId);
    this.lighting.addMeshes(result.meshes); this.trackRoomResources(result.meshes);
    return result.meshes;
  }

  private adoptImported(meshes: AbstractMesh[], nodes: TransformNode[], roomId: HouseRoomId) {
    const build = this.builds[roomId];
    const materials = Array.from(new Set(meshes.map(mesh => mesh.material).filter(Boolean)));
    const textures = Array.from(new Set(materials.reduce((all, material) => [...all, ...material!.getActiveTextures()], [])));
    textures.forEach(texture => {
      if (texture !== this.scene.environmentTexture) this.rooms.own(build, texture, () => texture.dispose());
    });
    materials.forEach(material => this.rooms.own(build, material!, () => material!.dispose(false, false)));
    nodes.forEach(node => {
      setRoomOwners(node, [roomId]);
      this.rooms.own(build, node, () => node.dispose(true));
    });
    meshes.forEach(mesh => setRoomOwners(mesh, [roomId]));
    if (!this.rooms.isCurrent(build)) { meshes.forEach(mesh => mesh.dispose(false, false)); return false; }
    return true;
  }

  private trackRoomResources(meshes: AbstractMesh[]) {
    this.scene.transformNodes.forEach(node => {
      const builds = roomOwners(node).map(id => this.builds[id]).filter(Boolean);
      if (builds.length) this.rooms.own(builds, node, () => node.dispose(true));
    });
    meshes.forEach(mesh => {
      const builds = roomOwners(mesh).map(id => this.builds[id]).filter(Boolean);
      if (builds.length) this.rooms.own(builds, mesh, () => {
        this.lighting.removeMeshes([mesh]); mesh.dispose(false, false);
      });
    });
  }

  private render = () => this.scene.render();
  private fitSuiteView() {
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    // The sea-facing eye stays on the balcony in portrait; pulling back would enter the house.
    let scale = ["overview", "coast", "study", "living", "master", "ensuite", "bedroom", "kitchen", "bathroom"].includes(this.currentView) ? Math.max(1, 1.4 / aspect) : 1;
    // The guest room already frames the sea window closely; a full portrait pullback would become an all-house overview.
    if (this.currentView === "bedroom") scale = Math.min(scale, 1.9);
    // The whole-house portrait radius exceeds the old fixed orbit limit.
    this.camera.upperRadiusLimit = this.currentView === "coast" ? Math.min(4200, 1800 * scale) : 145 * scale;
    // Keep the suite readable on portrait screens; resizing preserves the user's relative zoom.
    this.camera.radius *= scale / this.viewFramingScale;
    this.viewFramingScale = scale;
  }
  private resize = () => {
    this.engine.resize();
    this.fitSuiteView();
    this.resizeInspection();
  };
  private visibilityChanged = () => {
    this.setPaused("hidden", document.hidden);
    this.updateScooterHeadlight();
    if (document.hidden) { this.pauseScooter(); this.pauseLadder(); this.pauseAudio(); } else this.resumeAudio();
    this.engine.stopRenderLoop(this.render);
    if (!document.hidden && !this.disposed) this.engine.runRenderLoop(this.render);
  };
  private foregroundLost = () => { this.setPaused("blur", true); };
  private foregroundReturned = () => { this.setPaused("blur", false); this.resumeAudio(); };
  private pauseAudio = () => { this.interactions.silenceMotion(); this.audio.pause(); };
  private resumeAudio = () => { if (!document.hidden && !this.disposed) this.audio.foreground(); };
  private dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.pauseScooter(); this.pauseLadder(); this.scooterModel.dispose();
    this.audio.dispose();
    this.lighthousePanel.dispose();
    this.lighthouseMaintenancePanel.dispose();
    document.querySelector("#item-inspection-return")?.removeEventListener("click", this.returnFromInspection);
    document.querySelector("#item-inspection")?.removeEventListener("cancel", this.cancelInspection);
    document.querySelector<HTMLDialogElement>("#item-inspection")?.close();
    document.body.classList.remove("viewing-item");
    this.inspection.dispose();
    this.floorPlan.dispose();
    this.rooms.dispose();
    this.pointerLock.dispose();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    document.removeEventListener("keydown", this.keyDown);
    document.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.foregroundLost);
    window.removeEventListener("blur", this.pauseAudio);
    window.removeEventListener("focus", this.foregroundReturned);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.engine.stopRenderLoop();
    this.finishing.dispose();
    this.contactShadows?.dispose(true);
    this.scene.dispose();
    this.onTimeOfDayChange = this.onPauseChange = () => {};
    this.engine.dispose();
  };
}
