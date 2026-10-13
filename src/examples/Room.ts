import {
  AbstractMesh, ArcRotateCamera, Color3, Color4, CubeTexture, Engine,
  ImageProcessingConfiguration, MeshBuilder, PBRMaterial, Scene,
  SceneLoader, StandardMaterial, Texture, TransformNode, UniversalCamera, Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { RoomFurnishings } from "./RoomFurnishings";
import { RoomLighting } from "./RoomLighting";

export type RoomView = "overview" | "reading" | "desk" | "cabinet" | "first-person";
export const MOVEMENT_SPEED = { min: 0.25, max: 3, default: 1, base: 0.55 };

/** A furnished study with cutaway presets and an enclosed first-person view. */
export class RoomScene {
  readonly scene: Scene;
  readonly engine: Engine;
  private readonly camera: ArcRotateCamera;
  private readonly firstPersonCamera: UniversalCamera;
  private readonly interiorShell: TransformNode;
  private readonly lighting: RoomLighting;
  private disposed = false;
  private controlsEnabled = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { stencil: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.engine.maxFPS = 30;
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.14, 0.17, 0.18, 1);
    this.scene.ambientColor = new Color3(0.08, 0.075, 0.065);
    this.scene.skipPointerMovePicking = true;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = 1.05;
    this.scene.environmentTexture = CubeTexture.CreateFromPrefilteredData("./environment/sky.env", this.scene);
    this.scene.iblIntensity = 0.3;

    this.camera = new ArcRotateCamera("study-camera", 0.8, 1.08, 66, new Vector3(0, 0, 0), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 9;
    this.camera.upperRadiusLimit = 85;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.03;
    this.camera.wheelDeltaPercentage = 0.015;
    this.camera.panningSensibility = 85;
    this.camera.minZ = 0.2;
    this.camera.fov = 0.65;

    this.firstPersonCamera = new UniversalCamera("study-first-person", new Vector3(4, 1, 16), this.scene);
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
    this.firstPersonCamera.ellipsoid.set(0.65, 2.8, 0.65);
    this.scene.collisionsEnabled = true;
    // Keep walking at eye level, including while looking up/down or using touch/gamepad inputs.
    this.firstPersonCamera.onAfterCheckInputsObservable.add(() => {
      const position = this.firstPersonCamera.position;
      position.set(Math.max(-18.8, Math.min(18.8, position.x)), 1,
        Math.max(-18.8, Math.min(18.8, position.z)));
    });
    this.interiorShell = new TransformNode("first-person-room-shell", this.scene);
    this.interiorShell.setEnabled(false);

    this.lighting = new RoomLighting(this.scene);

    const furnishings = new RoomFurnishings(this.scene);
    this.createArchitecture(furnishings);
    furnishings.furnish();
    furnishings.finish().forEach(mesh => {
      mesh.checkCollisions = true;
    });
    this.lighting.addMeshes(this.scene.meshes);

    // A parent keeps the glTF loader's handedness conversion intact.
    const models = [
      this.importModel("gothic_commode.glb", "antique-cabinet", new Vector3(-13.5, -5, -17.6), 4.7),
      this.importModel("wooden_bookshelf.glb", "antique-bookshelf", new Vector3(11.5, -5, -17.8), 5.2).then(meshes => {
        if (!meshes || this.disposed) return;
        const books = furnishings.furnishBookshelf(meshes);
        books.forEach(mesh => mesh.checkCollisions = true);
        this.lighting.addMeshes(books);
      }),
    ];
    Promise.all(models).then(() => {
      if (this.disposed) return;
      this.scene.executeWhenReady(() => {
        if (this.disposed) return;
        this.lighting.freezeShadows();
        const status = document.querySelector("#scene-status");
        if (status) status.textContent = "胡桃木 · 黄铜 · 苔绿织物";
      });
    }).catch(error => {
      if (this.disposed) return;
      console.error("Study model loading failed", error);
      const status = document.querySelector("#scene-status");
      if (status) status.textContent = "部分模型加载失败，请刷新重试";
    });

    this.setView("overview");
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.visibilityChanged);
    window.addEventListener("pagehide", this.dispose, { once: true });
    this.visibilityChanged();
  }

  setView(view: RoomView) {
    const firstPerson = view === "first-person";
    this.scene.activeCamera?.detachControl();
    const shellChanged = this.interiorShell.isEnabled() !== firstPerson;
    this.interiorShell.setEnabled(firstPerson);
    if (shellChanged) this.lighting.refreshShadows();
    this.firstPersonCamera.cameraDirection.setAll(0);
    this.firstPersonCamera.cameraRotation.setAll(0);
    this.firstPersonCamera.movement.resetPanVelocity();
    this.firstPersonCamera.movement.resetRotationVelocity();
    const views: Record<Exclude<RoomView, "first-person">, { position: Vector3; target: Vector3 }> = {
      overview: { position: new Vector3(42, 31, 45), target: new Vector3(-1, -2, -1) },
      reading: { position: new Vector3(23, 10, 25), target: new Vector3(9, -1.5, 8) },
      desk: { position: new Vector3(13, 12, 16), target: new Vector3(-7, -1, -3) },
      cabinet: { position: new Vector3(0, 7, -1), target: new Vector3(-11, 0, -16) },
    };
    if (firstPerson) {
      this.firstPersonCamera.position.set(4, 1, 16);
      this.firstPersonCamera.setTarget(new Vector3(-3, 0, -6));
      this.scene.activeCamera = this.firstPersonCamera;
    } else {
      const selected = views[view];
      this.camera.setTarget(selected.target);
      this.camera.setPosition(selected.position);
      this.scene.activeCamera = this.camera;
    }
    this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = this.camera.inertialPanningY = 0;
    this.camera.movement.resetPanVelocity();
    if (this.controlsEnabled) this.scene.activeCamera.attachControl(this.canvas, true);
    const help = document.querySelector("#view-help");
    const instructions = firstPerson ? "拖动环顾 · WASD / 方向键移动" : "拖动旋转 · 滚轮缩放 · 右键平移";
    if (help) help.textContent = instructions;
    this.canvas.setAttribute("aria-label", "复古书房三维场景，" + instructions);
    if (firstPerson && this.controlsEnabled) this.canvas.focus({ preventScroll: true });
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
    const camera = this.scene.activeCamera === this.firstPersonCamera ? this.firstPersonCamera : this.camera;
    camera.detachControl();
    camera.movement.resetPanVelocity();
    camera.movement.resetRotationVelocity();
    if (enabled) camera.attachControl(this.canvas, true);
  }

  private createArchitecture(room: RoomFurnishings) {
    const scene = this.scene;
    const floor = new StandardMaterial("oak-floor", scene);
    floor.diffuseTexture = new Texture("./textures/woodFloor/wood_floor_diff.jpg", scene);
    floor.bumpTexture = new Texture("./textures/woodFloor/wood_floor_normal.jpg", scene);
    floor.bumpTexture.level = 0.4;
    [floor.diffuseTexture, floor.bumpTexture].forEach(texture => {
      (texture as Texture).uScale = 5;
      (texture as Texture).vScale = 5;
    });
    floor.diffuseColor = new Color3(0.55, 0.6, 0.58);
    floor.specularColor = new Color3(0.14, 0.11, 0.08);
    const ground = MeshBuilder.CreateGround("oak-floor", { width: 40, height: 40 }, scene);
    ground.position.y = -5;
    ground.material = floor;
    ground.receiveShadows = true;
    ground.metadata = { castsShadows: false };
    ground.checkCollisions = true;
    room.box("foundation", [40.6, 0.6, 40.6], [0, -5.4, 0], "darkWood");

    const brick = new StandardMaterial("warm-exposed-brick", scene);
    brick.diffuseTexture = new Texture("./textures/brick1/brick_diff.jpg", scene);
    brick.bumpTexture = new Texture("./textures/brick1/brick_normal.jpg", scene);
    brick.bumpTexture.level = 0.45;
    brick.diffuseColor = new Color3(0.75, 0.64, 0.53);
    brick.specularColor = Color3.Black();
    [brick.diffuseTexture, brick.bumpTexture].forEach(texture => {
      (texture as Texture).uScale = 5;
      (texture as Texture).vScale = 1.8;
    });
    const leftBack = MeshBuilder.CreateBox("back-wall-left", { width: 14, height: 14, depth: 0.5 }, scene);
    leftBack.position.set(-13, 2, -20);
    const rightBack = MeshBuilder.CreateBox("back-wall-right", { width: 18, height: 14, depth: 0.5 }, scene);
    rightBack.position.set(11, 2, -20);
    const lintel = MeshBuilder.CreateBox("door-lintel-wall", { width: 8, height: 3.2, depth: 0.5 }, scene);
    lintel.position.set(-2, 7.4, -20);
    const left = MeshBuilder.CreateBox("left-brick-wall", { width: 0.5, height: 14, depth: 40 }, scene);
    left.position.set(-20, 2, 0);
    const right = MeshBuilder.CreateBox("right-brick-wall", { width: 0.5, height: 14, depth: 40.5 }, scene);
    right.position.set(20, 2, 0);
    right.parent = this.interiorShell;
    const front = MeshBuilder.CreateBox("front-brick-wall", { width: 40.5, height: 14, depth: 0.5 }, scene);
    front.position.set(0, 2, 20);
    front.parent = this.interiorShell;
    const spans = [14, 18, 8, 40, 40.5, 40.5];
    [leftBack, rightBack, lintel, left, right, front].forEach((mesh, index) => {
      const wallMaterial = brick.clone(mesh.name + "-brick");
      wallMaterial.diffuseTexture = brick.diffuseTexture!.clone();
      wallMaterial.bumpTexture = brick.bumpTexture!.clone();
      [wallMaterial.diffuseTexture, wallMaterial.bumpTexture].forEach(texture => {
        (texture as Texture).uScale = spans[index] / 8;
        (texture as Texture).vScale = index === 2 ? 3.2 / 8 : 14 / 8;
      });
      mesh.material = wallMaterial;
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      if (mesh === left || mesh === right) {
        // The box's narrow side UVs rotate the brick map; use a wall-sized face.
        const facing = MeshBuilder.CreatePlane(mesh === left ? "left-wall-brick-facing" : "right-wall-brick-facing",
          { width: 40, height: 14 }, scene);
        facing.position.set(mesh === left ? -19.74 : 19.74, 2, 0);
        facing.rotation.y = mesh === left ? -Math.PI / 2 : Math.PI / 2;
        facing.parent = mesh.parent;
        facing.material = wallMaterial;
        facing.receiveShadows = true;
        facing.isPickable = false;
        facing.freezeWorldMatrix();
      }
    });
    room.architecturalDetails();
    room.enclosingDetails(this.interiorShell);
  }

  private async importModel(file: string, name: string, position: Vector3, scale: number) {
    const result = await SceneLoader.ImportMeshAsync("", "./models/", file, this.scene);
    if (this.disposed) {
      result.meshes.forEach(mesh => mesh.dispose());
      return;
    }
    const placement = new TransformNode(name, this.scene);
    placement.position.copyFrom(position);
    placement.scaling.setAll(scale);
    result.meshes[0].parent = placement;
    result.meshes.forEach((mesh: AbstractMesh) => {
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.isPickable = false;
      if (mesh.material instanceof PBRMaterial) {
        mesh.material.usePhysicalLightFalloff = false;
        mesh.material.maxSimultaneousLights = 4;
      }
      mesh.freezeWorldMatrix();
    });
    placement.freezeWorldMatrix();
    this.lighting.addMeshes(result.meshes);
    return result.meshes;
  }

  private render = () => this.scene.render();
  private resize = () => this.engine.resize();
  private visibilityChanged = () => {
    this.engine.stopRenderLoop(this.render);
    if (!document.hidden && !this.disposed) this.engine.runRenderLoop(this.render);
  };
  private dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  };
}
