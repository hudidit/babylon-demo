import { Color3, SpotLight, Vector3 } from "@babylonjs/core/pure";
import type { Mesh, PBRMaterial, Scene } from "@babylonjs/core/pure";
import { CoastalBatch } from "./CoastalLandmark";
import type { CoastalMaterials } from "./CoastalMaterials";
import { COASTAL_SITE } from "./CoastalSite";
import { HOUSE_COORDINATES, HOUSE_ROOMS, planToWorld, worldToPlan } from "./HouseLayout";
import { LIGHTHOUSE, LIGHTHOUSE_FLOORS } from "./LighthouseLayout";
import { lighthouseRecordTexture } from "./LighthouseRecords";
import { setRoomOwners } from "./RoomOwnership";
import type { InspectableItem, InteractiveLamp } from "./RoomInteractions";
import { LighthouseBeacon } from "./LighthouseBeacon";
import type { InteractiveDevice } from "./RoomInteractions";

/** Static maintenance contents and a single local work light owned by the coast. */
export class LighthouseDetails {
  readonly light: SpotLight;
  readonly switch: InteractiveLamp;
  readonly record: InspectableItem;
  readonly panel: InteractiveDevice;
  readonly test: InteractiveDevice;
  readonly beacon: LighthouseBeacon;
  on = true;
  private visible = true;
  private disposed = false;
  private readonly glow: PBRMaterial;
  private readonly targets: Mesh[];
  private readonly document?: Document;
  private readonly visibilityChanged = () => this.update();

  constructor(private readonly scene: Scene, surfaces: CoastalMaterials, retain: (mesh: Mesh, layer: "landmark") => Mesh) {
    const t = COASTAL_SITE.tower, a = LIGHTHOUSE, b = new CoastalBatch(scene, (mesh, layer) => {
      retain(mesh, layer as "landmark"); mesh.metadata.lighthouseDetail = true; return mesh;
    });
    const m = (name: string) => scene.getMaterialByName(name) as PBRMaterial;
    const metal = m("coastal-painted-metal"), brass = m("coastal-lantern-brass"), wood = m("coastal-weathered-timber"), green = m("coastal-lighthouse-door");
    const paper = surfaces.solid("coastal-lighthouse-record-print", "#ffffff", .9);
    const atlas = lighthouseRecordTexture(scene); surfaces.textures.push(atlas); paper.albedoTexture = atlas;
    this.glow = surfaces.solid("coastal-lighthouse-work-glow", "#f0dfad"); this.glow.emissiveColor.set(.8, .51, .19);
    const batchName = (name: string, material: PBRMaterial) => "coastal-lighthouse-detail-" +
      (["work-switch", "distribution-panel", "panel-hardware", "test-control"].includes(name) ? name : material.name.replace(/^coastal-/, ""));
    const box = (name: string, material: PBRMaterial, w: number, h: number, d: number, x: number, y: number, z: number, angle = 0) =>
      b.box(batchName(name, material), material, w, h, d, t.x + x, t.y + y, z, angle);
    const cylinder = (name: string, material: PBRMaterial, x: number, y: number, z: number, h: number, diameter: number, top = diameter, sides = 24) =>
      b.cylinder(batchName(name, material), material, t.x + x, t.y + y, z, h, diameter, top, sides);
    const print = (name: string, x: number, y: number, bottom: number, w: number, h: number, uv: number[]) => {
      const p: number[] = [];
      for (const [px,py,z] of [[x-w/2,y,bottom],[x+w/2,y,bottom],[x+w/2,y,bottom+h],[x-w/2,y,bottom+h]]) {
        const v=planToWorld({x:t.x+px,y:t.y+py},z);p.push(v.x,v.y,v.z);
      }
      b.geometry("coastal-lighthouse-detail-" + name, paper, {positions:p,indices:[0,1,2,0,2,3],uvs:uv});
    };
    // All low projections remain inside the existing cabinet/workbench footprints.
    box("cabinet-joinery", metal, .018, .96, .014, -1.438, .1, a.floor+.59);
    box("distribution-panel", green, .08, .64, .48, -1.69, .1, a.floor+1.55);
    for (const y of [-.06,.09,.24]) box("panel-hardware", brass, .018, .06, .055, -1.64, y, a.floor+1.56);
    box("work-switch", metal, .035, .15, .10, -1.63, -.01, a.floor+1.39);
    box("toolboard", wood, .54, .47, .035, .74, 1.98, a.floor+1.43);
    for (const [x,w] of [[.56,.035],[.72,.028],[.9,.025]]) {
      box("tools", brass, w, .23, .025, x, 1.95, a.floor+1.43);
      box("tools", metal, .09, .05, .025, x, 1.94, a.floor+1.55);
    }
    cylinder("cable-reel", wood, -.1, 1.82, a.floor+.87, .04, .25);
    cylinder("cable-reel", metal, -.1, 1.82, a.floor+.91, .12, .18);
    cylinder("cable-reel", wood, -.1, 1.82, a.floor+1.03, .035, .25);
    box("clipboard", wood, .53, .77, .035, .08, 2.02, a.floor+1.51);
    print("maintenance-record", .08, 1.998, a.floor+1.155, .48, .70, [0,1,.5,1,.5,0,0,0]);
    box("tools", brass, .17, .045, .03, .08, 1.977, a.floor+1.88);
    for (const f of LIGHTHOUSE_FLOORS) {
      // The signs face the clear ladder landing, above the handrail and outside the well.
      const y = f.index === 4 ? 1.38 : Math.min(1.78, f.radius-.28);
      const signBottom = f.height + (f.index === 0 ? 2.12 : 1.56);
      box("sign-backs", metal, .78, .18, .035, .05, y, signBottom+.08);
      print("floor-signs", .05, y-.021, signBottom, .74, .14, [.5,(f.index*96+92)/512,1,(f.index*96+92)/512,1,f.index*96/512,.5,f.index*96/512]);
      box("light-housings", metal, .24, .12, .15, .82, .85, f.height+1.78);
      box("work-glows", this.glow, .19, .045, .11, .82, .85, f.height+1.71);
      for (const x of [.75,.89]) box("light-housings", metal, .018, .12, .17, x, .85, f.height+1.77);
    }
    // Fixed base and protection frame; only LighthouseBeacon owns rotating parts.
    cylinder("optic-base", green, 0, 0, a.gallery+.04, .12, .8);
    for (let i=0;i<4;i++) {const angle=i*Math.PI/2;box("optic-frame",brass,.026,.9,.026,.39*Math.cos(angle),.39*Math.sin(angle),t.ground+17.88);}
    box("optic-cable", metal, .04, .48, .04, .13, .12, a.gallery+.30);
    box("test-control", green, .24, .16, .05, 0, -.37, a.gallery+.44);
    print("test-label", 0, -.398, a.gallery+.405, .21, .07, [.52,1,.68,1,.68,.945,.52,.945]);
    const meshes = b.finish();
    this.switch = {id:"lighthouse-work-light",label:"灯塔工作照明",meshes:meshes.filter(m=>m.name.endsWith("work-switch"))};
    this.record = {id:"lighthouse-maintenance-log",label:"灯塔维护记录",mesh:meshes.find(m=>m.name.endsWith("maintenance-record"))!,displayRotation:Vector3.Zero()};
    this.panel = {id:"lighthouse-control-panel",label:"首层运行面板",meshes:meshes.filter(m=>/distribution-panel|panel-hardware/.test(m.name))};
    this.test = {id:"lighthouse-beacon-main",label:"灯室试灯控制",meshes:meshes.filter(m=>/test-control|test-label/.test(m.name))};
    this.beacon = new LighthouseBeacon(scene, surfaces, retain);
    this.targets = scene.meshes.filter((m): m is Mesh => !!m.metadata?.lighthouse &&
      (/inner-wall|ground-floor|level-|ladder-|maintenance-cabinet|workbench|service-hardware|entry-door|door-rib|door-handle|detail-/.test(m.name)));
    this.targets.forEach(mesh => {if(mesh.material) (mesh.material as PBRMaterial).maxSimultaneousLights=2;});
    this.light = new SpotLight("lighthouse-local-work-light", Vector3.Zero(), new Vector3(0,-1,0), Math.PI*.85, 1, scene);
    this.light.diffuse = Color3.FromHexString("#ffe1ad").toLinearSpace();this.light.specular = this.light.diffuse.scale(.35);
    this.light.intensity = 2.1;this.light.range=3.4*HOUSE_COORDINATES.unitsPerMeter;this.light.falloffType=SpotLight.FALLOFF_STANDARD;
    this.light.includedOnlyMeshes=this.targets;setRoomOwners(this.light,HOUSE_ROOMS.map(r=>r.id));this.light.setEnabled(false);
    this.document = scene.getEngine().getRenderingCanvas()?.ownerDocument;
    this.document?.addEventListener("visibilitychange", this.visibilityChanged);
  }
  toggle() {if(!this.disposed){this.on=!this.on;this.glow.emissiveColor.copyFrom(this.on?new Color3(.8,.51,.19):Color3.Black());this.update();}}
  setVisible(visible:boolean){this.visible=visible;this.beacon.setVisible(visible);this.update();}
  update() {
    if(this.disposed)return;
    const camera=this.scene.activeCamera,p=camera&&worldToPlan(camera.globalPosition),t=COASTAL_SITE.tower;
    const feet=camera?(camera.globalPosition.y-HOUSE_COORDINATES.floorY)/HOUSE_COORDINATES.unitsPerMeter-1.6:0;
    const floor=LIGHTHOUSE_FLOORS.filter(f=>f.height<=feet+.18).slice(-1)[0];
    const active=this.visible&&this.on&&!!p&&Math.hypot(p.x-t.x,p.y-t.y)<2.6&&!!floor&&feet>=LIGHTHOUSE.floor-.1&&feet<=LIGHTHOUSE.gallery+.8
      && !this.scene.getEngine().getRenderingCanvas()?.ownerDocument.hidden;
    this.light.setEnabled(active);
    if(active){const v=planToWorld({x:t.x+.82,y:t.y+.85},floor!.height+1.69);this.light.position.set(v.x,v.y,v.z);}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.document?.removeEventListener("visibilitychange",this.visibilityChanged);this.light.dispose();this.beacon.dispose();}
}
