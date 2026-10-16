import { houseDrawingHeading, houseDrawingPoint, housePlanSvg } from "./HouseFloorPlan";
import { HOUSE_LAYOUT_VERSION, HOUSE_ROOMS, worldToPlan } from "./HouseLayout";
import type { HouseRoomId } from "./HouseLayout";
import type { HouseRooms } from "./HouseRooms";

/** DOM-only map: the 3D camera stays in place while the modal is open. */
export class RoomFloorPlan {
  private readonly button = document.querySelector<HTMLButtonElement>("#floor-plan-toggle")!;
  private readonly dialog = document.querySelector<HTMLDialogElement>("#floor-plan-dialog")!;
  private readonly returnButton = document.querySelector<HTMLButtonElement>("#floor-plan-return")!;
  private readonly location = document.querySelector<HTMLElement>("#floor-plan-location")!;
  private focusRoom?: HouseRoomId;
  private mode = "";
  private lastUpdate?: { view: string; position: { x: number; z: number }; direction?: { x: number; z: number } };

  private readonly unsubscribe: () => void;

  constructor(open: () => void, private readonly onClose: (resumePointer: boolean) => void, private readonly rooms: HouseRooms) {
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
  }

  private readonly openHandler: () => void;
  private refresh() {
    const content = this.rooms.contentRoomIds();
    for (const [selector, compact] of [["#floor-plan-mini", true], ["#floor-plan-drawing", false]] as const) {
      const host = document.querySelector<HTMLElement>(selector)!;
      host.innerHTML = housePlanSvg(compact, content);
      host.dataset.layoutVersion = this.rooms.layoutVersion;
      host.querySelectorAll<SVGGElement>("[data-room]").forEach(node => {
        node.dataset.state = this.rooms.snapshot(node.dataset.room as HouseRoomId).state;
        const state = node.dataset.state;
        node.querySelector("title")!.textContent = `${HOUSE_ROOMS.find(r => r.id === node.dataset.room)!.name} · ${{ planned: "规划", shell: "基础结构，可漫游", furnishing: "布置中", ready: "已布置", error: "加载失败，基础结构可用" }[state]}`;
      });
      host.querySelectorAll(".plan-door").forEach(node => node.classList.toggle("is-planned", this.rooms.layoutVersion !== HOUSE_LAYOUT_VERSION));
      host.querySelector("svg")!.insertAdjacentHTML("beforeend", '<g class="plan-position" style="display:none"><path d="M 0 -14 L -7 -2 L 7 -2 Z"/><circle r="4.5"/></g>');
    }
    this.mode = "";
    // Asset completion may refresh the SVG while the map modal pauses the scene's usual updates.
    if (this.lastUpdate) this.update(this.lastUpdate.view, this.lastUpdate.position, this.lastUpdate.direction);
  }
  private returnHandler = () => this.onClose(true);
  private cancelHandler = (event: Event) => { event.preventDefault(); this.onClose(false); };
  private trapFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const targets = Array.from(this.dialog.querySelectorAll<HTMLElement>("button, [tabindex='0']"));
    const index = targets.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length].focus();
  };

  get isOpen() { return this.dialog.open; }

  open() {
    if (this.isOpen) return;
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
      : view === "overview" ? undefined : view === "master" || view === "ensuite" ? view
      : ["living", "reading", "cabinet"].includes(view) ? "living" : "study";
    const valid = firstPerson && this.rooms.layoutVersion === HOUSE_LAYOUT_VERSION && !!room
      && Number.isFinite(position.x) && Number.isFinite(position.z);
    const point = worldToPlan(position), drawing = houseDrawingPoint(point.x, point.y);
    const angle = direction ? houseDrawingHeading(direction) : 0;
    document.querySelectorAll<SVGGElement>(".plan-position").forEach(node => {
      node.style.display = valid ? "" : "none";
      if (valid) node.setAttribute("transform", `translate(${drawing.x} ${drawing.y}) rotate(${angle})`);
    });
    if (room !== this.focusRoom || view !== this.mode) {
      this.focusRoom = room;
      this.mode = view;
      document.querySelectorAll<SVGGElement>(".plan-room").forEach(node => node.classList.toggle("is-current", node.dataset.room === room));
      const name = HOUSE_ROOMS.find(candidate => candidate.id === room)?.name;
      this.location.textContent = firstPerson ? name ? `你在${name}` : "位置未识别"
        : name ? `正在看${name}` : "全屋布局";
    }
  }

  dispose() {
    this.unsubscribe();
    this.close();
    this.button.removeEventListener("click", this.openHandler);
    this.returnButton.removeEventListener("click", this.returnHandler);
    this.dialog.removeEventListener("cancel", this.cancelHandler);
    this.dialog.removeEventListener("keydown", this.trapFocus);
  }
}
