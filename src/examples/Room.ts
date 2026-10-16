import { ArcRotateCamera, Color3, Color4, Engine, HDRCubeTexture, ImageProcessingConfiguration, PBRMaterial, Scene, SceneLoader, SSAO2RenderingPipeline, TransformNode, UniversalCamera, Vector3 } from "@babylonjs/core/pure";
import type { AbstractMesh, DefaultRenderingPipeline } from "@babylonjs/core/pure";
// All four shipped GLBs use core glTF 2.0, with no extensions (verified at release time).
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { registerRoomRuntime } from "./RoomRuntime";
import { RoomFurnishings } from "./RoomFurnishings";
import { RoomLighting } from "./RoomLighting";
import { placeFurniture } from "./RoomFurnitureAssets";
import { createRoomFinishing } from "./RoomFinishing";
import { cabinetDrawers, RoomInteractions } from "./RoomInteractions";
import { RoomPointerLock } from "./RoomPointerLock";
import { RoomAudio } from "./RoomAudio";
import { RoomItemInspection } from "./RoomItemInspection";
import { RoomFloorPlan } from "./RoomFloorPlan";
import type { InspectableItem } from "./RoomInteractions";
import { createHouseArchitecture } from "./HouseArchitecture";
import { constrainHouseWalking, houseVector, HOUSE_SPAWN, HOUSE_WALKER_RADIUS } from "./HouseWalking";
import { HOUSE_CONTENT, furnishHouseLiving, furnishHouseStudy } from "./HouseContent";
import { HouseRooms } from "./HouseRooms";
import type { RoomBuild } from "./HouseRooms";
import { HOUSE_LAYOUT_VERSION, HOUSE_ROOMS } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";
import { roomOwners, setRoomOwners } from "./RoomOwnership";

export type RoomView = "overview" | "study" | "living" | "reading" | "desk" | "details" | "cabinet" | "first-person";
export const MOVEMENT_SPEED = { min: 0.25, max: 3, default: 1, base: 0.55 };

/** An adjoining study and living room with cutaway presets and enclosed first-person roaming. */
export class RoomScene {
  readonly scene: Scene;
  readonly engine: Engine;
  readonly audio = new RoomAudio();
  readonly rooms = new HouseRooms();
  private readonly builds: Record<HouseRoomId, RoomBuild>;
  private readonly architecture: ReturnType<typeof createHouseArchitecture>;
  private readonly camera: ArcRotateCamera;
  private readonly firstPersonCamera: UniversalCamera;
  private readonly lighting: RoomLighting;
  private readonly contactShadows?: SSAO2RenderingPipeline;
  private readonly finishing: DefaultRenderingPipeline;
  private disposed = false;
  private controlsEnabled = true;
  private readonly interactions: RoomInteractions;
  private readonly pointerLock: RoomPointerLock;
  private readonly inspection: RoomItemInspection;
  private readonly floorPlan: RoomFloorPlan;
  private currentView: RoomView = "overview";
  private previousView: Exclude<RoomView, "first-person"> = "overview";
  private pointerLocked = false;
  private pointerStart?: { x: number; y: number; id: number; dragged: boolean };
  private focusElapsed = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    registerRoomRuntime();
    this.engine = new Engine(canvas, true, { stencil: true });
    this.engine.setHardwareScalingLevel(1);
    // Render at the display refresh rate; leave Engine.maxFPS uncapped for high-refresh screens.
    this.scene = new Scene(this.engine);
    this.scene.metadata = { layoutVersion: HOUSE_LAYOUT_VERSION };
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
    // Keep walking at eye level, including while looking up/down or using touch/gamepad inputs.
    const previousPosition = this.firstPersonCamera.position.clone();
    this.firstPersonCamera.onAfterCheckInputsObservable.add(() => {
      constrainHouseWalking(this.firstPersonCamera.position, previousPosition);
    });

    this.lighting = new RoomLighting(this.scene, true);
    this.interactions = new RoomInteractions(this.scene, owners => this.lighting.refreshShadows(owners),
      () => this.currentView === "first-person" ? this.firstPersonCamera.position : undefined,
      event => this.audio.event(event));
    this.inspection = new RoomItemInspection(this.scene);
    this.floorPlan = new RoomFloorPlan(() => this.openFloorPlan(), resume => this.closeFloorPlan(resume), this.rooms);
    this.pointerLock = new RoomPointerLock(canvas, locked => {
      this.pointerLocked = locked;
      this.updateControls();
      this.updateInteractionHint();
    }, () => this.leaveFirstPerson(), () => {
      const help = document.querySelector("#view-help");
      if (help && this.currentView === "first-person") help.textContent = "点击画面启用鼠标环顾 · ESC 退出第一人称";
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
    this.architecture = createHouseArchitecture(this.scene, furnishings);
    furnishHouseStudy(furnishings);
    furnishHouseLiving(furnishings);
    this.architecture.setEnclosed(false);
    this.lighting.addLivingRoom(this.scene, true);
    furnishings.finish().forEach(mesh => {
      mesh.checkCollisions = true;
    });
    furnishings.drawers.forEach(drawer => this.interactions.addDrawer(drawer));
    furnishings.doors.forEach(door => this.interactions.addDoor(door));
    furnishings.inspectables.forEach(item => this.interactions.addInspectable(item, item => this.openInspection(item)));
    furnishings.lamps.forEach(lamp => {
      const material = this.scene.getMaterialByName(lamp.id === "desk-lamp" ? "desk-lamp-glow"
        : lamp.id === "living-lamp" ? "living-lamp-shade" : "floor-lamp-shade") as PBRMaterial;
      this.lighting.bindLamp(lamp.id, material);
      this.interactions.addLamp(lamp, () => this.lighting.isLampOn(lamp.id), () => this.lighting.toggleLamp(lamp.id));
    });
    this.lighting.addMeshes(this.scene.meshes);
    this.trackRoomResources(this.scene.meshes);
    for (const { id } of HOUSE_ROOMS) {
      const cleanup = {};
      this.rooms.own(this.builds[id], cleanup, () => {
        this.interactions.removeRoom(id); this.lighting.removeRoom(id);
      });
    }
    HOUSE_ROOMS.filter(r => r.id !== "study" && r.id !== "living").forEach(r => this.rooms.setState(this.builds[r.id], "shell"));
    this.scene.onBeforeRenderObservable.add(() => {
      this.audio.update();
      if (!this.inspection.isOpen && this.scene.activeCamera === this.camera
        && this.architecture.updateCutaway(this.camera.position, this.camera.target)) this.lighting.refreshShadows();
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
      if (status) status.textContent = failed.length ? "部分家具加载失败 · 刷新重试 · 基础结构可用" : "客厅与书房已布置 · 其余六房待布置";
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
    window.addEventListener("blur", this.leaveFirstPerson);
    window.addEventListener("blur", this.pauseAudio);
    window.addEventListener("focus", this.resumeAudio);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.visibilityChanged);
    window.addEventListener("pagehide", this.dispose, { once: true });
    this.visibilityChanged();
  }

  setView(view: RoomView) {
    if (this.isViewing) return;
    this.interactions.silenceMotion();
    this.audio.setSpatialCamera(view === "first-person" ? this.firstPersonCamera : undefined);
    const firstPerson = view === "first-person";
    if (firstPerson && this.currentView !== "first-person") this.previousView = this.currentView;
    this.currentView = view;
    if (!firstPerson) this.pointerLock?.release();
    this.scene.activeCamera?.detachControl();
    this.architecture.setEnclosed(firstPerson, view);
    this.lighting.refreshShadows();
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.cameraRotation.setAll(0);
    this.firstPersonCamera.movement.resetPanVelocity();
    this.firstPersonCamera.movement.resetRotationVelocity();
    const a = HOUSE_CONTENT;
    const views: Record<Exclude<RoomView, "first-person">, { position: Vector3; target: Vector3 }> = {
      overview: { position: new Vector3(-74, 82, 84), target: new Vector3(0, -3, 2) },
      study: { position: houseVector(4.4, 4.2, 4.4), target: houseVector(a.desk.x, a.chair.y, 0.5) },
      living: { position: houseVector(3.2, 13.7, 6.8), target: houseVector(8.1, 7.5, 0.4) },
      reading: { position: houseVector(6.3, 7.2, 3), target: houseVector(a.readingSofa.x, 4.7, 0.55) },
      desk: { position: houseVector(5.4, 3.5, 2.4), target: houseVector(a.desk.x, a.desk.y + 0.18, 0.65) },
      details: { position: houseVector(a.desk.x - 0.1, a.desk.y + 0.98, 1.45), target: houseVector(a.desk.x - 0.1, a.desk.y + 0.08, 0.78) },
      cabinet: { position: houseVector(8.3, 9.3, 2.1), target: houseVector(a.cabinet.x, a.cabinet.y, 0.6) },
    };
    if (firstPerson) {
      this.firstPersonCamera.position.copyFrom(houseVector(HOUSE_SPAWN.x, HOUSE_SPAWN.y, 1.6));
      this.firstPersonCamera.setTarget(houseVector(7.5, 7.8, 1.5));
      this.scene.activeCamera = this.firstPersonCamera;
    } else {
      const selected = views[view];
      this.camera.lowerRadiusLimit = view === "details" ? 3 : 9;
      this.camera.setTarget(selected.target);
      this.camera.setPosition(selected.position);
      this.scene.activeCamera = this.camera;
    }
    this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = this.camera.inertialPanningY = 0;
    this.camera.movement.resetPanVelocity();
    this.updateControls();
    const help = document.querySelector("#view-help");
    const instructions = firstPerson ? "移动鼠标环顾 · WASD / 方向键移动 · 左键交互 · ESC 退出" : "拖动旋转 · 滚轮缩放 · 右键平移 · 点击物品交互";
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

  setMovementSpeed(multiplier: number) {
    if (!Number.isFinite(multiplier)) multiplier = MOVEMENT_SPEED.default;
    const speed = Math.max(MOVEMENT_SPEED.min, Math.min(MOVEMENT_SPEED.max, multiplier));
    this.firstPersonCamera.speed = MOVEMENT_SPEED.base * speed;
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.movement.resetPanVelocity();
    return speed;
  }

  setControlsEnabled(enabled: boolean) {
    this.controlsEnabled = enabled;
    if (!enabled) this.pointerLock.release();
    this.updateControls();
    this.updateInteractionHint();
  }

  private get isViewing() { return !!(this.inspection?.isOpen || this.floorPlan?.isOpen); }

  private updateFloorPlan() {
    this.floorPlan.update(this.currentView, this.firstPersonCamera.position, this.firstPersonCamera.getForwardRay().direction);
  }

  private openFloorPlan() {
    if (!this.controlsEnabled || this.isViewing) return;
    this.updateFloorPlan();
    // Set modal state before releasing the lock so its change event cannot leave first-person.
    this.floorPlan.open();
    this.interactions.silenceMotion();
    this.audio.stopAll();
    this.pointerLock.release();
    this.updateControls();
    this.updateInteractionHint();
  }

  private closeFloorPlan(resumePointer: boolean) {
    if (!this.floorPlan.isOpen) return;
    this.floorPlan.close();
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
    if (!this.isViewing && this.controlsEnabled && (camera !== this.firstPersonCamera || this.pointerLocked)) camera.attachControl(this.canvas, true);
  }

  private openInspection(item: InspectableItem) {
    if (!this.controlsEnabled || this.isViewing || !this.inspection.open(item)) return;
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
    if (this.isViewing) return;
    if (this.currentView === "first-person") this.setView(this.previousView);
  };

  private keyDown = (event: KeyboardEvent) => {
    if (event.isTrusted && !event.repeat && event.key === "Escape") { this.resumeAudio(); this.audio.unlockFromGesture(); }
    if (this.floorPlan.isOpen) {
      if (event.key === "Escape") { event.preventDefault(); this.closeFloorPlan(false); }
      return;
    }
    if (this.inspection.isOpen) {
      if (event.key === "Escape") this.cancelInspection(event);
      return;
    }
    if (!event.repeat && event.key.toLowerCase() === "m" && !event.ctrlKey && !event.metaKey && !event.altKey
      && !(event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable]"))) {
      event.preventDefault();
      this.openFloorPlan();
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
      this.interactions.pick(this.firstPersonCamera.getForwardRay(7.5))?.toggle();
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
    const action = firstPerson && this.pointerLocked && this.controlsEnabled
      ? this.interactions.pick(this.firstPersonCamera.getForwardRay(7.5)) : undefined;
    reticle?.classList.toggle("has-target", !!action);
    if (hint) {
      hint.textContent = action ? `左键 · ${action.label()}` : firstPerson && !this.pointerLocked ? "点击画面开始环顾 · ESC 退出" : "";
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
  private resize = () => {
    this.engine.resize();
    this.resizeInspection();
  };
  private visibilityChanged = () => {
    if (document.hidden) this.pauseAudio(); else this.resumeAudio();
    this.engine.stopRenderLoop(this.render);
    if (!document.hidden && !this.disposed) this.engine.runRenderLoop(this.render);
  };
  private pauseAudio = () => { this.interactions.silenceMotion(); this.audio.pause(); };
  private resumeAudio = () => { if (!document.hidden && !this.disposed) this.audio.foreground(); };
  private dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.dispose();
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
    window.removeEventListener("blur", this.leaveFirstPerson);
    window.removeEventListener("blur", this.pauseAudio);
    window.removeEventListener("focus", this.resumeAudio);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.engine.stopRenderLoop();
    this.finishing.dispose();
    this.contactShadows?.dispose(true);
    this.scene.dispose();
    this.engine.dispose();
  };
}
