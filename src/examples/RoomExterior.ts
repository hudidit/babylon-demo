import { Color3, Mesh, Plane, StandardMaterial, Texture, Vector3, VertexBuffer, VertexData, CreateSphere } from "@babylonjs/core/pure";
import type { Scene } from "@babylonjs/core/pure";
import { HOUSE_ROOMS, planToWorld } from "./HouseLayout";
import { setRoomOwners } from "./RoomOwnership";
import { stableRandom } from "./RoomSurfaceDetails";

type Geometry = { positions: number[]; indices: number[]; colors: number[]; uvs: number[] };
const geometry = (): Geometry => ({ positions: [], indices: [], colors: [], uvs: [] });
const sun = new Vector3(-0.5, 0.8, -0.3).normalize();
const elevation = (x: number, z: number) => -5.35 + Math.min(1, Math.max(0, (Math.hypot(x, z) - 80) / 90))
  * (.6 + Math.sin(x * .033) * Math.cos(z * .041) * .45);

/** One fixed outdoor world, seen through every real window opening. No camera-facing cards. */
export class RoomExterior {
  readonly meshes: Mesh[] = [];
  private readonly cutaway = new Plane(0,0,1,0);
  private readonly materials: StandardMaterial[] = [];
  private readonly corners: {x:number;z:number}[] = [];
  private clipped = false;
  constructor(scene: Scene) {
    HOUSE_ROOMS.forEach(r=>{for(const x of [r.x,r.x+r.width])for(const y of [r.y,r.y+r.depth])this.corners.push(planToWorld({x,y}));});
    const owners = HOUSE_ROOMS.map(r => r.id);
    const retain = (mesh: Mesh) => {
      mesh.metadata = { exterior: true, castsShadows: false, lightRooms: [] };
      setRoomOwners(mesh, owners);
      mesh.isPickable = false; mesh.checkCollisions = false; mesh.receiveShadows = false;
      mesh.freezeWorldMatrix(); this.meshes.push(mesh);
      return mesh;
    };
    const material = (name: string) => {
      const m = new StandardMaterial(name, scene);
      this.materials.push(m);
      // Static local daylight baked into vertices: room switches cannot relight the forest.
      m.disableLighting = true; m.emissiveColor = Color3.White(); m.specularColor = Color3.Black();
      return m;
    };
    const panorama = material("exterior-distant-forest");
    panorama.diffuseTexture = new Texture("./textures/study/forest-window/panorama.jpg", scene, false, false);
    panorama.diffuseTexture.anisotropicFilteringLevel = 8;
    panorama.diffuseTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    panorama.diffuseTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    // Photography is sRGB, converted to linear by the standard shader before the existing ACES pass.
    const radius = 220;
    const dome = CreateSphere("exterior-forest-horizon", { diameter: radius * 2, segments: 96, sideOrientation: Mesh.BACKSIDE }, scene);
    const positions = dome.getVerticesData(VertexBuffer.PositionKind)!;
    // Keep photographed trunks vertical down to the forest floor, then project only the lower
    // ground band onto terrain. Flattening the whole lower hemisphere would bend tree bases.
    // UVs stay continuous through the sky, distant forest and ground; there is no tiled floor.
    for (let i = 0; i < positions.length; i += 3) {
      const ny = positions[i + 1] / radius;
      if (ny >= 0) continue;
      const v = Math.acos(Math.max(-1, ny)) / Math.PI;
      const radial = v < .67 ? radius : radius * (1 - (v - .67) / .33);
      const horizontal = Math.hypot(positions[i], positions[i + 2]);
      const scale = horizontal > .0001 ? radial / horizontal : 0;
      positions[i] *= scale; positions[i + 2] *= scale;
      const floor = elevation(positions[i], positions[i + 2]) - 3;
      positions[i + 1] = v < .67 ? floor * (v - .5) / .17 : floor;
    }
    const domeNormals: number[] = []; VertexData.ComputeNormals(positions, dome.getIndices()!, domeNormals);
    dome.setVerticesData(VertexBuffer.PositionKind, positions);
    dome.setVerticesData(VertexBuffer.NormalKind, domeNormals);
    dome.position.y = 3; dome.rotation.y = 1.08;
    dome.material = panorama; retain(dome);

    const barkMaterial = material("exterior-bark");
    barkMaterial.diffuseTexture = new Texture("./textures/study/forest-window/bark.jpg", scene);
    barkMaterial.diffuseTexture.anisotropicFilteringLevel = 8;
    const foliageMaterial = material("exterior-foliage"); foliageMaterial.backFaceCulling = false;
    const make = (name: string, data: Geometry, mat: StandardMaterial) => {
      const mesh = new Mesh(name, scene), vd = new VertexData();
      vd.positions = data.positions; vd.indices = data.indices; vd.colors = data.colors; vd.uvs = data.uvs;
      const normals: number[] = []; VertexData.ComputeNormals(data.positions, data.indices, normals); vd.normals = normals;
      vd.applyToMesh(mesh); mesh.material = mat; retain(mesh);
      return mesh;
    };
    const random = stableRandom(41723);
    const vertex = (g: Geometry, p: Vector3, c: number[], u = 0, v = 0) => {
      const i = g.positions.length / 3; g.positions.push(p.x, p.y, p.z); g.colors.push(...c, 1); g.uvs.push(u, v); return i;
    };
    // Fixed sectors retain useful frustum culling rather than merging the whole forest into one mesh.
    for (let sector = 0; sector < 4; sector++) {
      const trunks = geometry(), leaves = geometry();
      const tube = (points: Vector3[], radius: number, shade: number) => {
        const steps = 10, base = trunks.positions.length / 3;
        points.forEach((p, ring) => {
          const axis = points[Math.min(ring + 1, points.length - 1)].subtract(points[Math.max(0, ring - 1)]).normalize();
          const across = Vector3.Cross(axis, new Vector3(0, 0, 1)).normalize(), other = Vector3.Cross(axis, across).normalize();
          const taper = Math.max(.05, 1 - ring / (points.length - 1) * .94);
          for (let a = 0; a <= steps; a++) {
            const angle = a / steps * Math.PI * 2;
            const normal = across.scale(Math.cos(angle)).add(other.scale(Math.sin(angle)));
            const light = shade * (.52 + .48 * Math.max(0, Vector3.Dot(normal, sun)));
            const r = radius * taper * (1 + .06 * Math.sin(a * 3.7 + ring * 1.6));
            vertex(trunks, p.add(normal.scale(r)), [light, light, light], a / steps, ring * .75);
            if (ring < points.length - 1 && a < steps) {
              const i = base + ring * (steps + 1) + a; trunks.indices.push(i, i + steps + 1, i + 1, i + 1, i + steps + 1, i + steps + 2);
            }
          }
        });
      };
      const leaf = (p: Vector3, length: number, yaw: number, tilt: number, tint: number) => {
        const along = new Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
        const across = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).scale(length * .23);
        const normal = Vector3.Cross(along, across).normalize();
        const lighting = .55 + .45 * Math.abs(Vector3.Dot(normal, sun));
        const color = [.19 * tint * lighting, .30 * tint * lighting, .075 * tint * lighting];
        const b = leaves.positions.length / 3;
        vertex(leaves, p, color); vertex(leaves, p.add(along.scale(length * .45)).add(across), color);
        vertex(leaves, p.add(along.scale(length * .55)).add(new Vector3(0, length * .09, 0)), color.map(c => c * 1.15));
        vertex(leaves, p.add(along.scale(length)), color);
        vertex(leaves, p.add(along.scale(length * .45)).subtract(across), color.map(c => c * .8));
        leaves.indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b + 3, b + 4, b + 2, b + 4, b, b + 2);
      };
      for (let tree = 0; tree < 6; tree++) {
        const tall = tree < 4;
        const along = -26 + tree * 12 + random() * 8;
        const distance = (tall ? 49 : 39) + random() * 29;
        const x = sector === 0 || sector === 2 ? along : (sector === 1 ? -distance : distance);
        const z = sector === 1 || sector === 3 ? along : (sector === 0 ? -distance : distance + 10);
        const ground = elevation(x, z), height = tall ? 64 + random() * 28 : 18 + random() * 7;
        const bend = (random() - .5) * 3;
        const points = Array.from({ length: 9 }, (_, i) => new Vector3(x + bend * (i / 8) ** 2, ground + height * i / 8, z + Math.sin(i * .4) * .6));
        tube(points, tall ? .65 + random() * .6 : .2 + random() * .15, 1.15 + random() * .2);
        // Branches have actual depth; every leaf is a bent, pointed opaque mesh, never a billboard.
        for (let branch = 0; branch < (tall ? 12 : 10); branch++) {
          const fraction = (tall ? .48 : .3) + branch / (tall ? 12 : 10) * (tall ? .44 : .58);
          const yaw = branch * 2.39996 + tree * 1.2, reach = (tall ? 7 : 4) * (1 - fraction * .7);
          const start = new Vector3(x + bend * fraction ** 2, ground + height * fraction, z);
          const end = start.add(new Vector3(Math.sin(yaw) * reach, tall ? -.7 : 2.3, Math.cos(yaw) * reach));
          tube([start, Vector3.Lerp(start, end, .5).add(new Vector3(0, .5, 0)), end], tall ? .14 : .07, .55);
          for (let j = 0; j < 80; j++) {
            const t = .3 + random() * .8;
            const p = Vector3.Lerp(start, end, t).add(new Vector3((random() - .5) * 3.6, (random() - .5) * 1.6, (random() - .5) * 3.6));
            leaf(p, .45 + random() * .65, random() * Math.PI * 2, (random() - .5) * 1.5, .7 + random() * .8);
          }
        }
      }
      make(`exterior-trees-${sector}`, trunks, barkMaterial);
      make(`exterior-leaves-${sector}`, leaves, foliageMaterial);
    }
  }

  setVisible(visible: boolean) { this.meshes.forEach(mesh => mesh.isVisible = visible); }

  /** Clear foreground trees in orbit cutaways; indoor views keep the complete outdoor world. */
  updateCutaway(position?: {x:number;z:number}, target?: {x:number;z:number}) {
    if(position&&target) {
      const dx=position.x-target.x,dz=position.z-target.z,length=Math.hypot(dx,dz);
      if(length<.001)return;
      const nx=dx/length,nz=dz/length;
      if(Math.abs(nx-this.cutaway.normal.x)>1e-6||Math.abs(nz-this.cutaway.normal.z)>1e-6||!this.clipped) {
        let boundary=-Infinity;for(const p of this.corners)boundary=Math.max(boundary,p.x*nx+p.z*nz);
        this.cutaway.normal.set(nx,0,nz);this.cutaway.d=-boundary-.25;
      }
    }
    const active=!!(position&&target);if(active===this.clipped)return;this.clipped=active;
    // Plane 1 remains available to MirrorTexture's reflected-view clipping.
    for(const material of this.materials)material.clipPlane2=active?this.cutaway:null;
  }
}
