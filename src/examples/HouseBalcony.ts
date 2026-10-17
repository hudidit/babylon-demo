import { HOUSE_COORDINATES } from "./HouseLayout";
import type { RoomFurnishings } from "./RoomFurnishings";
import { localPosition, metres } from "./HouseRoomComponents";

export function furnishHouseBalcony(room: RoomFurnishings) {
  const u=HOUSE_COORDINATES.unitsPerMeter;
  room.section("balcony","balcony-seat",()=>{
    const g=room.group("balcony-seat-root",localPosition("balcony",{x:.95,y:1.13}));
    for(const x of [-.49,.49])for(const z of [-.16,.16])room.box("bench-leg",metres(.06,.4,.06),metres(x,.2,z),"wood",g);
    room.box("bench-frame",metres(1.2,.08,.45),metres(0,.4,0),"darkWood",g);
    room.paddedBox("bench-cushion",metres(1.2,.08,.45),metres(0,.48,0),"moss",g);
    for(const x of [-.55,.55])room.box("bench-back-post",metres(.045,.6,.045),metres(x,.6,.23),"wood",g);
    room.box("bench-back",metres(1.2,.24,.04),metres(0,.77,.23),"wood",g);
    room.paddedBox("bench-back-pad",metres(1.1,.21,.04),metres(0,.76,.2),"cream",g);
  });
  room.section("balcony","balcony-table",()=>{
    const g=room.group("balcony-table-root",localPosition("balcony",{x:1.75,y:1.13}));
    room.cylinder("balcony-table-base",.04*u,.24*u,metres(0,.02,0),"brass",g);
    room.cylinder("balcony-table-stem",.49*u,.035*u,metres(0,.285,0),"brass",g);
    room.cylinder("balcony-table-top",.04*u,.36*u,metres(0,.55,0),"wood",g);
    room.cylinder("balcony-cup",.09*u,.07*u,metres(0,.615,0),"ceramic",g);
  });
  room.section("balcony","balcony-plants",()=>{
    room.plant(localPosition("balcony",{x:.4,y:.38}),.6);
    room.plant(localPosition("balcony",{x:4.9,y:1.05}),.8);
  });
}
