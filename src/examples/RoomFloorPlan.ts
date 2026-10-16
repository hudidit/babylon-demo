import { HOUSE_ROOMS, housePlanSvg } from "./HouseFloorPlan";
import type { HouseRoomId } from "./HouseFloorPlan";
import { LIVING_ROOM } from "./RoomLayout";

/** DOM-only map: the 3D camera stays in place while the modal is open. */
export class RoomFloorPlan {
  private readonly button = document.querySelector<HTMLButtonElement>("#floor-plan-toggle")!;
  private readonly dialog = document.querySelector<HTMLDialogElement>("#floor-plan-dialog")!;
  private readonly returnButton = document.querySelector<HTMLButtonElement>("#floor-plan-return")!;
  private readonly location = document.querySelector<HTMLElement>("#floor-plan-location")!;
  private focusRoom?: HouseRoomId;
  private mode = "";

  constructor(open: () => void, private readonly onClose: (resumePointer: boolean) => void) {
    document.querySelector("#floor-plan-mini")!.innerHTML = housePlanSvg(true);
    document.querySelector("#floor-plan-drawing")!.innerHTML = housePlanSvg();
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

  update(view: string, position: { x: number; z: number }) {
    const firstPerson = view === "first-person";
    // The revised plan resizes/repositions rooms; identify the existing 3D room semantically.
    const room = firstPerson ? position.x >= LIVING_ROOM.minX ? "living" : "study"
      : view === "overview" ? undefined : view === "living" ? "living" : "study";
    if (room !== this.focusRoom || view !== this.mode) {
      this.focusRoom = room;
      this.mode = view;
      document.querySelectorAll<SVGGElement>(".plan-room").forEach(node => node.classList.toggle("is-current", node.dataset.room === room));
      this.location.textContent = firstPerson ? `你在${room === "living" ? "客厅" : "书房"}`
        : room ? `正在看${room === "living" ? "客厅" : "书房"}` : "全屋布局";
    }
  }

  dispose() {
    this.close();
    this.button.removeEventListener("click", this.openHandler);
    this.returnButton.removeEventListener("click", this.returnHandler);
    this.dialog.removeEventListener("cancel", this.cancelHandler);
    this.dialog.removeEventListener("keydown", this.trapFocus);
  }
}
