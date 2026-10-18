import { houseDrawingHeading, houseDrawingPoint, housePlanSvg } from "./HouseFloorPlan";
import { HOUSE_LAYOUT_VERSION, HOUSE_ROOMS, worldToPlan } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";
import type { HouseRooms } from "./HouseRooms";
import { coastalDrawingPoint, coastalPlanSvg } from "./CoastalMap";
import { coastalRouteLength } from "./CoastalSite";
import { coastalSurfaceHeight } from "./CoastalCliff";
import { walkingSurfaceAt } from "./WalkingSurface";

/** DOM-only map: the 3D camera stays in place while the modal is open. */
export class RoomFloorPlan {
  private readonly button = document.querySelector<HTMLButtonElement>("#floor-plan-toggle")!;
  private readonly dialog = document.querySelector<HTMLDialogElement>("#floor-plan-dialog")!;
  private readonly returnButton = document.querySelector<HTMLButtonElement>("#floor-plan-return")!;
  private readonly location = document.querySelector<HTMLElement>("#floor-plan-location")!;
  private focusRoom?: HouseRoomId;
  private mode = "";
  private miniCoast = false;
  private region = "";
  private scope: "house" | "coast" = "house";
  private lastUpdate?: { view: string; position: { x: number; z: number }; direction?: { x: number; z: number } };

  private readonly unsubscribe: () => void;

  constructor(open: () => void, private readonly onClose: (resumePointer: boolean) => void, private readonly rooms: HouseRooms,
    private readonly previewCoast: () => void, private readonly returnHome: () => void) {
    this.refresh();
    this.unsubscribe = rooms.subscribe(() => this.refresh());
    document.querySelector("#floor-plan-area")!.textContent = HOUSE_ROOMS.reduce((sum, room) => sum + room.width * room.depth, 0).toFixed(1);
    document.querySelector("#floor-plan-room-sizes")!.innerHTML = HOUSE_ROOMS.map(room =>
      `<div><dt>${room.name}</dt><dd>${room.width.toFixed(1)} × ${room.depth.toFixed(1)} m</dd></div>`).join("");
    this.openHandler = open;
    this.button.addEventListener("click", this.openHandler);
    this.returnButton.addEventListener("click", this.returnHandler);
    this.dialog.addEventListener("cancel", this.cancelHandler);
    this.dialog.addEventListener("keydown", this.trapFocus);
    document.querySelector("#map-scope-house")!.addEventListener("click", this.selectHouse);
    document.querySelector("#map-scope-coast")!.addEventListener("click", this.selectCoast);
    document.querySelector("#coast-preview")!.addEventListener("click", this.coastPreview);
    document.querySelector("#coast-return-home")!.addEventListener("click", this.returnHome);
    document.querySelector("#coast-route-length")!.textContent = coastalRouteLength((x, y) => coastalSurfaceHeight(x, y)!).toFixed(0);
  }

  private readonly openHandler: () => void;
  private refresh() {
    const content = this.rooms.contentRoomIds();
    for (const [selector, compact] of [["#floor-plan-mini", true], ["#floor-plan-drawing", false]] as const) {
      const host = document.querySelector<HTMLElement>(selector)!;
      const coast = compact ? this.miniCoast : this.scope === "coast";
      host.innerHTML = coast ? coastalPlanSvg(compact) : housePlanSvg(compact, content);
      host.dataset.layoutVersion = this.rooms.layoutVersion;
      host.querySelectorAll<SVGGElement>("[data-room]").forEach(node => {
        node.dataset.state = this.rooms.snapshot(node.dataset.room as HouseRoomId).state;
        const state = node.dataset.state;
        node.querySelector("title")!.textContent = `${HOUSE_ROOMS.find(r => r.id === node.dataset.room)!.name} · ${{ planned: "规划", shell: "基础结构，可漫游", furnishing: "布置中", ready: "已布置", error: "加载失败，基础结构可用" }[state]}`;
      });
      host.querySelectorAll(".plan-door").forEach(node => node.classList.toggle("is-planned", this.rooms.layoutVersion !== HOUSE_LAYOUT_VERSION));
      host.querySelector("svg")!.insertAdjacentHTML("beforeend", coast && compact
        ? '<g class="plan-position" style="display:none"><path d="M 0 -23 L -11 -3 L 11 -3 Z"/><circle r="8"/></g>'
        : '<g class="plan-position" style="display:none"><path d="M 0 -14 L -7 -2 L 7 -2 Z"/><circle r="4.5"/></g>');
    }
    this.mode = "";
    // Asset completion may refresh the SVG while the map modal pauses the scene's usual updates.
    if (this.lastUpdate) this.update(this.lastUpdate.view, this.lastUpdate.position, this.lastUpdate.direction);
  }
  private readonly selectHouse = () => this.selectScope("house");
  private readonly selectCoast = () => this.selectScope("coast");
  private readonly coastPreview = () => { this.onClose(false); this.previewCoast(); };
  private selectScope(scope: "house" | "coast") {
    this.scope = scope;
    document.querySelector("#map-scope-house")!.setAttribute("aria-pressed", String(scope === "house"));
    document.querySelector("#map-scope-coast")!.setAttribute("aria-pressed", String(scope === "coast"));
    document.querySelector<HTMLElement>("#house-map-notes")!.hidden = scope !== "house";
    document.querySelector<HTMLElement>("#coast-map-notes")!.hidden = scope !== "coast";
    document.querySelector("#floor-plan-title")!.textContent = scope === "house" ? "余晖小居 · 户型图" : "余晖小居 · 海岸路线";
    document.querySelector("#map-caption-scope")!.textContent = scope === "house" ? "尺寸单位：米 · 全屋户型规划" : "尺寸单位：米 · 海岸步行路线";
    document.querySelector("#floor-plan-drawing")!.setAttribute("aria-label", scope === "house" ? "全屋按比例户型图" : "房屋至灯塔海岸路线图");
    this.dialog.setAttribute("aria-describedby", scope === "house" ? "floor-plan-description" : "coast-plan-description");
    this.refresh();
  }
  private returnHandler = () => this.onClose(true);
  private cancelHandler = (event: Event) => { event.preventDefault(); this.onClose(false); };
  private trapFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const targets = Array.from(this.dialog.querySelectorAll<HTMLElement>("button, [tabindex='0']")).filter(node => node.getClientRects().length);
    const index = targets.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length].focus();
  };

  get isOpen() { return this.dialog.open; }

  open() {
    if (this.isOpen) return;
    this.selectScope(this.miniCoast ? "coast" : "house");
    document.body.classList.add("viewing-map");
    this.button.setAttribute("aria-expanded", "true");
    this.dialog.showModal();
  }

  close() {
    this.dialog.close();
    document.body.classList.remove("viewing-map");
    this.button.setAttribute("aria-expanded", "false");
  }

  update(view: string, position: { x: number; z: number }, direction?: { x: number; z: number }) {
    this.lastUpdate = { view, position: { x: position.x, z: position.z },
      direction: direction && { x: direction.x, z: direction.z } };
    const firstPerson = view === "first-person";
    const room = firstPerson ? this.rooms.roomAt(position)
      : view === "overview" || view === "coast" ? undefined : ["master", "ensuite", "bedroom", "kitchen", "bathroom", "balcony"].includes(view) ? view as HouseRoomId
      : ["living", "reading", "cabinet"].includes(view) ? "living" : "study";
    const point = worldToPlan(position);
    const outdoor = firstPerson && !room ? walkingSurfaceAt(point.x, point.y) : undefined;
    const miniCoast = !!outdoor || view === "coast";
    if (miniCoast !== this.miniCoast) {
      this.miniCoast = miniCoast;
      document.querySelector("#map-mini-title")!.textContent = miniCoast ? "海岸地图" : "全屋地图";
      this.button.setAttribute("aria-label", `查看${miniCoast ? "海岸路线" : "全屋户型"}图，快捷键 M`);
      this.refresh(); return;
    }
    const valid = firstPerson && this.rooms.layoutVersion === HOUSE_LAYOUT_VERSION && (!!room || !!outdoor)
      && Number.isFinite(position.x) && Number.isFinite(position.z);
    const angle = direction ? houseDrawingHeading(direction) : 0;
    document.querySelectorAll<SVGGElement>(".plan-position").forEach(node => {
      const coast = node.closest("#floor-plan-mini") ? this.miniCoast : this.scope === "coast";
      const visible = valid && (coast || !!room);
      node.style.display = visible ? "" : "none";
      const drawing = coast ? coastalDrawingPoint(point.x, point.y) : houseDrawingPoint(point.x, point.y);
      if (visible) node.setAttribute("transform", `translate(${drawing.x} ${drawing.y}) rotate(${angle})`);
    });
    if (room !== this.focusRoom || view !== this.mode || this.region !== (outdoor?.region || "")) {
      this.focusRoom = room;
      this.mode = view;
      this.region = outdoor?.region || "";
      document.querySelectorAll<SVGGElement>(".plan-room").forEach(node => node.classList.toggle("is-current", node.dataset.room === room));
      const name = HOUSE_ROOMS.find(candidate => candidate.id === room)?.name;
      this.location.textContent = firstPerson ? name ? `你在${name}` : outdoor ? `你在${outdoor.region}` : "正在恢复位置"
        : name ? `正在看${name}` : view === "coast" ? "海岸路线预览" : "全屋布局";
    }
  }

  dispose() {
    this.unsubscribe();
    this.close();
    this.button.removeEventListener("click", this.openHandler);
    this.returnButton.removeEventListener("click", this.returnHandler);
    this.dialog.removeEventListener("cancel", this.cancelHandler);
    this.dialog.removeEventListener("keydown", this.trapFocus);
    document.querySelector("#map-scope-house")!.removeEventListener("click", this.selectHouse);
    document.querySelector("#map-scope-coast")!.removeEventListener("click", this.selectCoast);
    document.querySelector("#coast-preview")!.removeEventListener("click", this.coastPreview);
    document.querySelector("#coast-return-home")!.removeEventListener("click", this.returnHome);
  }
}
