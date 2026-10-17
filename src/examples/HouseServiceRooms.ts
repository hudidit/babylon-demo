import { HOUSE_COORDINATES } from "./HouseLayout";
import type { RoomFurnishings } from "./RoomFurnishings";
import { bathroomShower, bathroomToilet, bathroomVanity, localPosition, metres } from "./HouseRoomComponents";

const u = HOUSE_COORDINATES.unitsPerMeter;
export const HOUSE_SERVICE = {
  kitchenLamp: { x: 1.25, y: 1.75, height: 2.55 },
  vanity: { x: 0.32, y: 0.6, width: 0.9, yaw: Math.PI / 2 },
  toilet: { x: 1.5, y: 0.42 },
  shower: { x: 1.5, y: 1.89, width: 2.7, depth: 0.9 },
  bathroomLamp: { x: 0.65, y: 0.6, height: 2.18 },
};

export function furnishHouseKitchen(room: RoomFurnishings) {
  room.ensureKitchenMaterials();
  room.section("kitchen", "kitchen-sink-run", () => {
    const g = room.group("kitchen-sink-root", localPosition("kitchen", { x: 1.2, y: 0.39 }));
    const box = (n: string, s: [number, number, number], p: [number, number, number], m: string) => room.box(n, metres(...s), metres(...p), m, g);
    box("sink-plinth", [2.1,.12,.52], [0,.06,0], "darkWood");
    box("sink-base", [2.18,.04,.6], [0,.14,0], "wood");
    box("sink-back", [2.18,.68,.035], [0,.5,-.29], "wood");
    for(const x of [-1.075,1.075]) box("sink-side", [.03,.68,.6], [x,.5,0], "wood");
    for(const x of [-.825,-.275,.275,.825]) {
      box("sink-cabinet-door", [.535,.65,.035], [x,.5,.3], "paintGreen");
      box("sink-cabinet-pull", [.16,.018,.035], [x,.72,.33], "brass");
    }
    // Four counter pieces surround a real open basin; no opaque slab covers the sink.
    for(const x of [-.705,.705])box("sink-counter-side", [.79,.055,.62], [x,.88,0], "bath-porcelain");
    for(const z of [-.255,.255])box("sink-counter-edge", [.62,.055,.11], [0,.88,z], "bath-porcelain");
    box("sink-bottom", [.62,.025,.4], [0,.755,0], "kitchen-steel");
    for(const x of [-.3,.3])box("sink-basin-side", [.02,.12,.4], [x,.8175,0], "kitchen-steel");
    for(const z of [-.19,.19])box("sink-basin-edge", [.6,.12,.02], [0,.8175,z], "kitchen-steel");
    room.cylinder("sink-drain", .005*u, .055*u, metres(0,.77,0), "black", g);
    room.cylinder("sink-tap", .25*u, .035*u, metres(.12,1.01,-.255), "brass", g);
    box("sink-spout", [.035,.035,.22], [.12,1.12,-.16], "brass");
    box("sink-backsplash", [2.18,.2,.025], [0,1.015,-.31], "bath-tile");
    box("chopping-board", [.32,.018,.22], [-.72,.916,0], "wood");
    room.cylinder("kitchen-bowl", .07*u, .17*u, metres(.73,.943,0), "ceramic", g, .21*u);
  });
  room.section("kitchen", "kitchen-cooker-run", () => {
    const g=room.group("kitchen-cooker-root", localPosition("kitchen", {x:2.02,y:1.72}), -Math.PI/2);
    room.box("cooker-plinth", metres(1.82,.12,.52), metres(0,.06,0), "darkWood", g);
    room.box("cooker-cabinet", metres(1.9,.7,.6), metres(0,.49,0), "wood", g);
    for(const x of [-.63,0,.63]) {
      room.box("cooker-door", metres(.61,.65,.035), metres(x,.5,.315), "paintGreen", g);
      room.box("cooker-pull", metres(.15,.018,.035), metres(x,.74,.34), "brass", g);
    }
    room.box("cooker-counter", metres(1.92,.055,.62), metres(0,.88,0), "bath-porcelain", g);
    room.box("cooktop", metres(.65,.015,.49), metres(0,.915,0), "black", g);
    for(const x of [-.17,.17])for(const z of [-.12,.12]) {
      room.ring("burner-ring", .13*u, .012*u, metres(x,.93,z), "kitchen-steel", g);
      room.cylinder("burner-cap", .009*u, .08*u, metres(x,.932,z), "black", g);
    }
    room.box("cooker-backsplash", metres(1.9,.48,.025), metres(0,1.15,-.31), "bath-tile", g);
    room.box("extractor-hood", metres(.78,.12,.45), metres(0,1.91,-.08), "kitchen-steel", g);
    room.box("extractor-duct", metres(.2,.73,.18), metres(0,2.335,-.2), "kitchen-steel", g);
    for(const x of [-.7,.7]) {
      room.box("upper-cabinet", metres(.48,.65,.32), metres(x,2.1,-.15), "wood", g);
      room.box("upper-door", metres(.46,.62,.025), metres(x,2.1,.025), "paintGreen", g);
      room.box("upper-pull", metres(.015,.16,.025), metres(x,2.05,.05), "brass", g);
    }
  });
  room.section("kitchen", "kitchen-fridge", () => {
    const g=room.group("kitchen-fridge-root", localPosition("kitchen", {x:.42,y:1.5}), Math.PI/2);
    for(const x of [-.25,.25])for(const z of [-.25,.25])room.box("fridge-foot",metres(.055,.08,.055),metres(x,.04,z),"black",g);
    room.box("fridge-body", metres(.65,1.81,.65),metres(0,.985,0),"kitchen-steel",g);
    for(const [h,height]of [[.48,.74],[1.38,1.02]]) {
      room.box("fridge-front",metres(.63,height,.035),metres(0,h,.34),"kitchen-steel",g);
      room.box("fridge-handle",metres(.018,.32,.055),metres(-.22,h,.385),"darkWood",g);
    }
  });
  room.section("kitchen", "kitchen-light", () => {
    const a=HOUSE_SERVICE.kitchenLamp;
    room.fixtureLamp("kitchen-lamp","厨房工作灯",localPosition("kitchen",a,a.height),(g,glow)=>{
      room.cylinder("kitchen-light-mount",.12*u,.25*u,metres(0,.1,0),"brass",g);
      room.cylinder("kitchen-light-diffuser",.06*u,.42*u,metres(0,0,0),glow,g);
    });
  });
}

export function furnishHouseBathroom(room: RoomFurnishings) {
  const a=HOUSE_SERVICE;room.ensureBathroomMaterials();
  room.section("bathroom","bathroom-tiles",()=>{
    room.box("bath-grout-bed",metres(2.9,.008,2.3),localPosition("bathroom",{x:1.5,y:1.2},.004),"bath-grout");
    for(let x=0;x<8;x++)for(let y=0;y<6;y++)room.box("bath-floor-tile",metres(2.9/8-.006,.006,2.3/6-.006),
      localPosition("bathroom",{x:.05+(x+.5)*2.9/8,y:.05+(y+.5)*2.3/6},.011),"bath-tile");
  });
  bathroomVanity(room,"bathroom",a.vanity,a.vanity.width,a.vanity.yaw);
  bathroomToilet(room,"bathroom",a.toilet);
  bathroomShower(room,"bathroom",a.shower,a.shower.width,a.shower.depth);
  room.section("bathroom","bathroom-light",()=>{
    const l=a.bathroomLamp;
    room.fixtureLamp("bathroom-lamp","公卫镜前灯",localPosition("bathroom",l,l.height),(g,glow)=>{
      room.box("bathroom-light-back",metres(.09,.08,.7),metres(-.035,0,0),"brass",g);
      room.box("bathroom-light-diffuser",metres(.05,.055,.65),metres(.035,0,0),glow,g);
    });
  });
}
