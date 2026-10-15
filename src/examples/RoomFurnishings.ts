import { Color3, DynamicTexture, Mesh, CreateBox, CreateCylinder, CreatePlane, CreateSphere, CreateTorus, CreateTube, StandardMaterial, Texture, TransformNode, Vector3, VertexBuffer, VertexData } from "@babylonjs/core/pure";
import type { AbstractMesh, Material, PBRMaterial, Scene } from "@babylonjs/core/pure";
import { measureBookshelf } from "./BookshelfLayout";
import { linenMaterial, mappedMaterial, surfaceMaterial } from "./RoomMaterials";
import { beveledBox, creasedLetter, curtainPanel, ficusLeaf } from "./RoomDetailGeometry";
import { applyWear, letterTexture, stableRandom, wearTexture } from "./RoomSurfaceDetails";
import { partitionMergedCollisions } from "./RoomCollisions";
import type { InspectableItem, InteractiveDrawer, InteractiveLamp } from "./RoomInteractions";

type Triple = [number, number, number];

/** Reusable, static furniture parts, merged by material to keep draw calls low. */
export class RoomFurnishings {
  private materials = new Map<string, Material>();
  private parts: Mesh[] = [];
  readonly drawers: InteractiveDrawer[] = [];
  readonly lamps: InteractiveLamp[] = [];
  readonly inspectables: InspectableItem[] = [];
  private interactiveGroups: { meshes: Mesh[]; root: TransformNode; fixed: boolean }[] = [];

  constructor(private scene: Scene) {
    const colors: Record<string, string> = {
      wood: "#795032", darkWood: "#362a20", brass: "#b8a077", cream: "#d9cfbb",
      moss: "#77816a", cushion: "#b7a282", rust: "#91684f", burgundy: "#76544e",
      navy: "#525e65", paper: "#e0d8c5", leaf: "#667955", stem: "#615841",
      ceramic: "#c3b894", soil: "#33281d", shade: "#f3dfad", black: "#272b29",
      paintGreen: "#68715d", lampGlass: "#425e4b", deskLeather: "#59634e",
    };
    Object.entries(colors).forEach(([name, color]) => {
      const material = surfaceMaterial(name, scene, color,
        name === "brass" ? 0.32 : name === "ceramic" || name === "lampGlass" ? 0.26 : 0.78);
      if (name === "brass") material.metallic = 1;
      if (name === "shade") material.emissiveColor = new Color3(0.2, 0.13, 0.065);
      if (["paintGreen", "lampGlass", "ceramic"].includes(name)) {
        material.clearCoat.isEnabled = true;
        material.clearCoat.intensity = name === "lampGlass" ? 0.45 : 0.18;
        material.clearCoat.roughness = 0.35;
      }
      this.materials.set(name, material);
    });
    for (const name of ["wood", "darkWood"]) {
      this.materials.get(name)!.dispose();
      const wood = mappedMaterial(name, scene, "wood_table_001",
        name === "wood" ? "#e4dbd0" : "#b0a99d", 1, 0.16);
      wood.clearCoat.isEnabled = true;
      wood.clearCoat.intensity = 0.15;
      wood.clearCoat.roughness = 0.5;
      this.materials.set(name, wood);
    }
    for (const name of ["moss", "cream", "cushion"]) {
      this.materials.get(name)!.dispose();
      this.materials.set(name, linenMaterial(name, scene, colors[name]));
    }
    this.materials.set("curtain-linen", linenMaterial("curtain-linen", scene, "#c8bea7", 5));
    this.createLeafMaterial();
    const pages = new DynamicTexture("paper-edges", { width: 128, height: 256 }, scene, false);
    const pageContext = pages.getContext();
    pageContext.fillStyle = "#dbd1b9"; pageContext.fillRect(0, 0, 128, 256);
    for (let y = 1; y < 256; y += 4) {
      pageContext.fillStyle = y % 3 === 0 ? "#a99d83" : "#bcb097";
      pageContext.fillRect(0, y, 128, 1);
    }
    pages.update();
    const paper = surfaceMaterial("book-paper", scene, "#ffffff", 0.92);
    paper.albedoTexture = pages; this.materials.set("book-paper", paper);
    const woodWear = wearTexture("handled-wood", scene, "wood");
    const wood = this.materials.get("wood") as PBRMaterial;
    this.materials.set("desktop-wood", applyWear(wood.clone("desktop-wood")!, woodWear));
    this.materials.set("coffee-wood", applyWear(wood.clone("coffee-wood")!, woodWear, 0.13, 0.28));
    applyWear(this.materials.get("brass") as PBRMaterial,
      wearTexture("handled-brass", scene, "brass"), 0.12, 0.3);
    const covers = wearTexture("cloth-book-covers", scene, "cover");
    for (const color of ["burgundy", "moss", "navy", "cushion", "rust", "cream"]) {
      for (let variant = 0; variant < 2; variant++) {
        const cover = (this.materials.get(color) as PBRMaterial)
          .clone(`book-${color}-${variant}`)!;
        cover.albedoColor = cover.albedoColor.scale(variant ? 1.035 : 0.955);
        cover.roughness = variant ? 0.86 : 0.78;
        this.materials.set(cover.name, applyWear(cover, covers, variant ? 0.24 : 0.16, 0.3));
      }
    }
    const letter = surfaceMaterial("letter-paper", scene, "#ffffff", 0.96);
    letter.albedoTexture = letterTexture(scene);
    this.materials.set("letter-paper", letter);
  }

  box(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const detail = /^(table-|console-(top|apron|leg|drawer)|chair-(leg|back-frame|stretcher)|seat-frame|back-post|window-(casing|mullion|crossbar|sill)|door-(frame|raised-panel|panel-inset)|floating-shelf|book-cover$|book-spine$|desk-blotter)/.test(name);
    const mesh = detail ? beveledBox(name, size, Math.min(0.065, Math.min(...size) * 0.18), this.scene)
      : CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
    return this.place(mesh, position, material, parent);
  }

  cylinder(name: string, height: number, diameter: number, position: Triple,
    material: string, parent?: TransformNode, top = diameter) {
    const mesh = CreateCylinder(name, { height, diameterBottom: diameter, diameterTop: top, tessellation: 24 }, this.scene);
    return this.place(mesh, position, material, parent);
  }

  sphere(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const mesh = CreateSphere(name, { diameter: 1, segments: 12 }, this.scene);
    mesh.scaling.set(...size);
    return this.place(mesh, position, material, parent);
  }

  paddedBox(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const mesh = CreateSphere(name, { diameter: 1, segments: 16, updatable: true }, this.scene);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    // A superellipsoid gives upholstery broad, flat faces with soft corners.
    for (let i = 0; i < positions.length; i++) {
      const value = positions[i];
      positions[i] = Math.sign(value) * Math.pow(Math.abs(value) * 2, 0.24) * 0.5;
    }
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (name === "seat-cushion" && y > 0) {
        // Wear compresses only the upper stuffing; the supported bottom stays unchanged.
        positions[i + 1] -= y * 0.08 * Math.exp(-12 * ((x + 0.045) ** 2 + (z - 0.025) ** 2));
      }
      if (name === "chair-back-pad" && z < 0) {
        positions[i + 2] += -z * 0.06 * Math.exp(-10 * ((x - 0.04) ** 2 + y ** 2));
      }
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, mesh.getIndices()!, normals);
    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
    mesh.scaling.set(...size);
    return this.place(mesh, position, material, parent);
  }

  ring(name: string, diameter: number, thickness: number, position: Triple, material: string, parent?: TransformNode) {
    return this.place(CreateTorus(name, { diameter, thickness, tessellation: 32 }, this.scene), position, material, parent);
  }

  private place(mesh: Mesh, position: Triple, material: string, parent?: TransformNode) {
    mesh.position.set(...position);
    mesh.material = this.materials.get(material)!;
    mesh.parent = parent || null;
    mesh.receiveShadows = true;
    mesh.metadata = { castsShadows: ![
      "foundation", "persian-rug", "rug-fringe", "reading-rug", "reading-rug-border", "garden-view",
      "book-spine-gilt", "banker-lit-underside", "candle-flame",
    ].includes(mesh.name) };
    mesh.isPickable = false;
    this.parts.push(mesh);
    return mesh;
  }

  group(name: string, position: Triple, rotation = 0) {
    const group = new TransformNode(name, this.scene);
    group.position.set(...position);
    group.rotation.y = rotation;
    return group;
  }

  /** Keep room and cutaway-shell batches separate while sharing the same materials. */
  section(name: string, build: () => void, parent?: TransformNode) {
    const start = this.parts.length;
    build();
    return this.merge(this.parts.splice(start)).map(mesh => {
      mesh.name = name + "-" + mesh.name;
      mesh.metadata = { ...mesh.metadata, room: "living" };
      // A one-part batch still has its modeling parent; preserve its world transform.
      mesh.setParent(parent || null);
      mesh.freezeWorldMatrix();
      mesh.checkCollisions = true;
      return mesh;
    });
  }

  tableLamp(position: Triple) {
    const start = this.parts.length;
    const root = this.group("living-table-lamp", position);
    this.materials.set("living-lamp-shade", this.materials.get("shade")!.clone("living-lamp-shade")!);
    this.cylinder("living-lamp-foot", 0.12, 1.15, [0, 0.06, 0], "brass", root);
    this.sphere("living-lamp-body", [0.8, 1.4, 0.8], [0, 0.8, 0], "ceramic", root);
    this.cylinder("living-lamp-neck", 0.45, 0.12, [0, 1.6, 0], "brass", root);
    this.cylinder("living-lamp-shade", 1.5, 2.5, [0, 2.55, 0], "living-lamp-shade", root, 1.6);
    this.ring("living-shade-trim", 2.5, 0.055, [0, 1.8, 0], "brass", root);
    this.sphere("living-lamp-finial", [0.17, 0.25, 0.17], [0, 3.4, 0], "brass", root);
    const meshes = this.keepInteractive(start, root, true);
    meshes.forEach(mesh => mesh.metadata = { ...mesh.metadata, room: "living" });
    this.lamps.push({ id: "living-lamp", label: "客厅台灯", meshes });
  }

  architecturalDetails() {
    // Timber skirting, paneled lower walls, and a slim brass picture rail.
    this.box("left-wainscot", [0.18, 2.5, 40], [-19.65, -3.7, 0], "darkWood");
    this.box("left-baseboard", [0.32, 0.32, 40], [-19.5, -4.75, 0], "wood");
    this.box("left-chair-rail", [0.32, 0.16, 40], [-19.5, -2.4, 0], "wood");
    this.box("left-brass-inlay", [0.34, 0.045, 40], [-19.48, -2.2, 0], "brass");
    [-13, 11].forEach((x, i) => {
      const width = i ? 18 : 14;
      this.box("back-wainscot", [width, 2.5, 0.18], [x, -3.7, -19.65], "darkWood");
      this.box("back-baseboard", [width, 0.32, 0.32], [x, -4.75, -19.5], "wood");
      this.box("back-chair-rail", [width, 0.16, 0.32], [x, -2.4, -19.5], "wood");
      this.box("back-brass-inlay", [width, 0.045, 0.34], [x, -2.2, -19.48], "brass");
    });
    for (let z = -18; z < 20; z += 3.2) this.box("panel-stile", [0.24, 2.2, 0.1], [-19.5, -3.6, z], "wood");
    for (let x = -18; x < 20; x += 3.2) {
      if (x < -6 || x > 2) this.box("panel-stile", [0.1, 2.2, 0.24], [x, -3.6, -19.5], "wood");
    }
    this.box("back-cornice", [40.5, 0.4, 0.65], [0, 8.8, -19.7], "darkWood");
    this.box("left-cornice", [0.65, 0.4, 40.5], [-19.7, 8.8, 0], "darkWood");
    this.box("back-cornice-gold", [40, 0.07, 0.7], [0, 8.52, -19.65], "brass");
    this.box("left-cornice-gold", [0.7, 0.07, 40], [-19.65, 8.52, 0], "brass");

    this.box("green-door", [7.6, 10.7, 0.35], [-2, 0.35, -19.8], "paintGreen");
    [-6.1, 2.1].forEach(x => this.box("door-frame", [0.4, 11.3, 0.65], [x, 0.5, -19.5], "wood"));
    this.box("door-frame-top", [8.6, 0.45, 0.65], [-2, 6.1, -19.5], "wood");
    [-2.3, 2.4].forEach(y => {
      this.box("door-raised-panel", [6.25, 3.6, 0.12], [-2, y, -19.53], "darkWood");
      this.box("door-panel-inset", [5.95, 3.3, 0.15], [-2, y, -19.45], "paintGreen");
    });
    this.box("door-knob-plate", [0.25, 0.9, 0.08], [1, 0.1, -19.35], "brass");
    this.sphere("door-knob", [0.3, 0.3, 0.3], [1, 0.1, -19.15], "brass");
    this.window();
    this.clock();
    this.framedArt("landscape", "./textures/pictures/pic1.jpg", [-19.35, 3.1, -7], 7.5, 4.5);
  }

  furnish() {
    this.rug();
    this.writingTable();
    this.chair([-3, -5, 5.1], 0);
    this.chair([-8.4, -5, -1], -Math.PI / 2);
    this.chair([2.4, -5, -1], Math.PI / 2);
    this.sofa();
    this.coffeeTable();
    this.floorLamp();
    this.windowDesk();
    this.armchair();
    this.plant([-16, -5, 16], 1.1);
    this.plant([17, -5, 12], 0.85);
    this.cabinetAccessories();
  }

  enclosingDetails(shell: TransformNode) {
    const start = this.parts.length;
    const plaster = new StandardMaterial("plaster-ceiling", this.scene);
    plaster.diffuseColor = Color3.FromHexString("#e2d2af");
    plaster.emissiveColor = new Color3(0.14, 0.12, 0.09);
    plaster.specularColor = Color3.Black();
    this.materials.set("plaster", plaster);
    this.box("plaster-ceiling", [40.5, 0.5, 40.5], [0, 9.25, 0], "plaster");
    // Close the small reveal behind the existing door as part of the interior shell.
    this.box("door-backing", [8, 10.8, 0.2], [-2, 0.4, -20.1], "darkWood");
    // Match the shared wall opening; no rail, panel or collision may bridge the passage.
    const sharedSpans = [{ length: 11, z: -14.5 }, { length: 21, z: 9.5 }];
    sharedSpans.forEach(({ length, z }) =>
      this.box("right-wainscot", [0.18, 2.5, length], [19.65, -3.7, z], "darkWood"));
    this.box("front-wainscot", [40, 2.5, 0.18], [0, -3.7, 19.65], "darkWood");
    const rails: [string, number, number, number, string][] = [
      ["baseboard", 0.32, 0.32, -4.75, "wood"],
      ["chair-rail", 0.32, 0.16, -2.4, "wood"],
      ["brass-inlay", 0.34, 0.045, -2.2, "brass"],
      ["cornice", 0.65, 0.4, 8.8, "darkWood"],
      ["cornice-gold", 0.7, 0.07, 8.52, "brass"],
    ];
    rails.forEach(([name, depth, height, y, material]) => {
      if (y > 6) this.box("right-" + name, [depth, height, 40], [19.5, y, 0], material);
      else sharedSpans.forEach(({ length, z }) =>
        this.box("right-" + name, [depth, height, length], [19.5, y, z], material));
      this.box("front-" + name, [40, height, depth], [0, y, 19.5], material);
    });
    for (let offset = -18; offset < 20; offset += 3.2) {
      if (offset < -9 || offset > -1) this.box("right-panel-stile", [0.24, 2.2, 0.1], [19.5, -3.6, offset], "wood");
      this.box("front-panel-stile", [0.1, 2.2, 0.24], [offset, -3.6, 19.5], "wood");
    }
    [-7, 7].forEach(offset => {
      this.box("ceiling-beam-x", [40, 0.22, 0.3], [0, 8.9, offset], "darkWood");
      this.box("ceiling-beam-z", [0.3, 0.22, 40], [offset, 8.9, 0], "darkWood");
    });
    // Merge separately so hiding the shell never hides the original furniture.
    this.merge(this.parts.splice(start)).forEach(mesh => {
      mesh.name = "interior-" + mesh.name;
      mesh.parent = shell;
      mesh.checkCollisions = true;
    });
  }

  private rug() {
    const texture = new DynamicTexture("woven-persian-rug", { width: 1024, height: 1024 }, this.scene, false);
    const c = texture.getContext();
    c.fillStyle = "#6c3832"; c.fillRect(0, 0, 1024, 1024);
    c.strokeStyle = "#c6a36f"; c.lineWidth = 25; c.strokeRect(24, 24, 976, 976);
    c.lineWidth = 7; c.strokeRect(57, 57, 910, 910);
    c.lineWidth = 18; c.strokeRect(100, 100, 824, 824);
    c.strokeStyle = "#243b36"; c.lineWidth = 28; c.strokeRect(79, 79, 866, 866);
    const diamond = (x: number, y: number, size: number, color: string) => {
      c.fillStyle = color; c.beginPath(); c.moveTo(x, y - size); c.lineTo(x + size, y);
      c.lineTo(x, y + size); c.lineTo(x - size, y); c.closePath(); c.fill();
    };
    for (let i = 150; i < 900; i += 64) {
      diamond(i, 80, 17, "#d9bd83"); diamond(i, 944, 17, "#d9bd83");
      diamond(80, i, 17, "#d9bd83"); diamond(944, i, 17, "#d9bd83");
    }
    for (let y = 175; y < 900; y += 95) for (let x = 175; x < 900; x += 95) {
      diamond(x, y, 18, "#ad7954"); diamond(x, y, 8, "#e0c38e");
    }
    diamond(512, 512, 270, "#d1ac77"); diamond(512, 512, 236, "#344a40");
    diamond(512, 512, 195, "#8b4d37"); diamond(512, 512, 147, "#d1ac77");
    diamond(512, 512, 110, "#344a40"); diamond(512, 512, 58, "#bd885d");
    c.globalAlpha = 0.1; c.strokeStyle = "#f2d8ab"; c.lineWidth = 1;
    for (let y = 0; y < 1024; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(1024, y); c.stroke(); }
    c.globalAlpha = 1;
    const fade = c.createRadialGradient(512, 512, 80, 512, 512, 600);
    fade.addColorStop(0, "rgba(205,185,150,0.2)"); fade.addColorStop(1, "rgba(205,185,150,0)");
    c.fillStyle = fade; c.fillRect(0, 0, 1024, 1024);
    texture.update();
    const mat = linenMaterial("rug", this.scene, "#ffffff", 18);
    mat.albedoTexture = texture; mat.roughness = 0.95; mat.sheen.intensity = 0.12;
    this.materials.set("rug", mat);
    this.box("persian-rug", [14.5, 0.055, 13], [-3, -4.95, -0.3], "rug");
    const fringeVariation = stableRandom(357);
    for (let i = 0; i < 38; i++) {
      const x = -9.9 + i * 0.37;
      [-1, 1].forEach(side => {
        const length = 0.4 + fringeVariation() * 0.2;
        const z = (side < 0 ? -6.8 : 6.2) + side * (length / 2 - 0.04);
        this.box("rug-fringe", [0.085, 0.025, length], [x, -4.95, z], "cream")
          .rotation.x = side * Math.atan2(0.055, length);
      });
    }
    this.cylinder("reading-rug", 0.05, 13, [10, -4.95, 10], "cream");
    this.ring("reading-rug-border", 12.5, 0.09, [10, -4.9, 10], "cushion");
  }

  private writingTable() {
    const g = this.group("central-writing-table", [-3, -5, -1]);
    this.box("table-top", [8.3, 0.4, 6], [0, 4.4, 0], "desktop-wood", g);
    this.box("table-edge-step", [8.15, 0.1, 5.85], [0, 4.2, 0], "darkWood", g);
    this.box("table-apron", [7.7, 0.7, 0.2], [0, 3.85, -2.55], "darkWood", g);
    // Rails and stiles leave two real openings behind the moving drawer fronts.
    [3.54, 4.16].forEach(y => this.box("table-front-rail", [7.7, 0.08, 0.2], [0, y, 2.55], "darkWood", g));
    [-3.5, 0, 3.5].forEach(x => this.box("table-front-stile", [x === 0 ? 0.16 : 0.5, 0.7, 0.2], [x, 3.85, 2.55], "darkWood", g));
    [-3.75, 3.75].forEach(x => this.box("table-apron", [0.2, 0.7, 4.9], [x, 3.85, 0], "darkWood", g));
    [-1.65, 1.65].forEach((x, index) => {
      const drawer = this.group(`writing-drawer-${index + 1}`, [x, 3.86, 2.69]); drawer.parent = g;
      const start = this.parts.length;
      this.box("table-drawer", [3.12, 0.48, 0.14], [0, 0, 0], "wood", drawer);
      this.ring("table-drawer-pull", 0.22, 0.045, [0, 0, 0.14], "brass", drawer).rotation.x = Math.PI / 2;
      this.drawerBox(drawer, 2.98, 0.42, 2.3);
      const meshes = this.keepInteractive(start, drawer);
      this.drawers.push({ id: drawer.name, label: `书桌${index ? "右" : "左"}侧抽屉`, root: drawer,
        meshes, travel: new Vector3(0, 0, 1.8) });
    });
    [-3.45, 3.45].forEach(x => [-2.25, 2.25].forEach(z => {
      this.cylinder("turned-table-leg", 3.4, 0.4, [x, 1.8, z], "wood", g, 0.58);
      this.sphere("leg-collar", [0.65, 0.6, 0.65], [x, 2.9, z], "wood", g);
      this.cylinder("brass-table-foot", 0.3, 0.4, [x, 0.15, z], "brass", g);
    }));
    this.box("desk-blotter", [4.1, 0.035, 2.8], [0, 4.62, 0.45], "deskLeather", g);
    const letterStart = this.parts.length;
    const letter = this.place(creasedLetter("letter", this.scene), [-0.5, 4.639, 0.35], "letter-paper", g);
    letter.rotation.y = -0.2;
    this.keepInteractive(letterStart, g, true);
    this.inspectables.push({ id: "desk-letter", label: "桌上的信", mesh: letter,
      displayRotation: new Vector3(-Math.PI / 2, Math.PI, 0) });
    this.box("pen", [0.07, 0.07, 1.5], [0.7, 4.7, 0.35], "brass", g).rotation.y = -0.25;
    this.bookStack([-2.5, 4.6, -1.5], g);
    this.mug([2.55, 4.5975, 1.5], "ceramic", g);
    this.bankerLamp([2.45, 4.6, -1.65], g);
  }

  private chair(position: Triple, rotation: number) {
    const g = this.group("upholstered-chair", position, rotation);
    [-0.95, 0.95].forEach(x => [-0.9, 0.9].forEach(z => {
      this.box("chair-leg", [0.2, 2.3, 0.2], [x, 1.15, z], "darkWood", g);
    }));
    this.box("seat-frame", [2.35, 0.25, 2.35], [0, 2.3, 0], "wood", g);
    this.paddedBox("seat-cushion", [2.25, 0.45, 2.25], [0, 2.58, 0], "moss", g);
    [-1, 1].forEach(x => this.box("back-post", [0.2, 2.7, 0.2], [x, 3.25, 1], "wood", g));
    this.box("chair-back-frame", [2.25, 1.5, 0.25], [0, 3.85, 1], "wood", g);
    this.paddedBox("chair-back-pad", [1.9, 1.25, 0.3], [0, 3.85, 0.82], "moss", g);
    this.box("chair-stretcher", [2, 0.12, 0.12], [0, 0.8, 0.9], "wood", g);
    [-0.95, 0.95].forEach(x => this.box("chair-stretcher", [0.12, 0.12, 1.8], [x, 0.8, 0], "wood", g));
    [-0.95, 0.95].forEach(x => {
      const pin = this.cylinder("chair-joinery-pin", 0.018, 0.065, [x, 2.3, 1.185], "brass", g);
      pin.rotation.x = Math.PI / 2;
    });
  }

  private sofa() {
    // The sofa itself is an imported upholstered asset; accessories stay procedural.
    const ottoman = this.group("reading-ottoman", [15, -5, 16]);
    this.cylinder("ottoman-foot", 0.28, 3.15, [0, 0.14, 0], "darkWood", ottoman);
    this.cylinder("ottoman-base", 1.2, 3.3, [0, 0.85, 0], "darkWood", ottoman);
    this.sphere("ottoman-cushion", [3.7, 1, 3.7], [0, 1.6, 0], "cushion", ottoman);
  }

  private armchair() {
    // The scanned armchair supplies the frame, cushions and their seams.
    this.cylinder("side-table-top", 0.2, 2.6, [-13.4, -2.6, 15.2], "wood");
    this.cylinder("side-table-stem", 2.3, 0.18, [-13.4, -3.78, 15.2], "brass");
    this.cylinder("side-table-base", 0.14, 1.5, [-13.4, -4.93, 15.2], "brass");
    this.bookStack([-13.5, -2.5, 15.1]);
  }

  private coffeeTable() {
    const g = this.group("oval-coffee-table", [9.5, -5, 12.5]);
    const top = this.cylinder("oval-walnut-top", 0.3, 4.8, [0, 2.15, 0], "coffee-wood", g);
    top.scaling.x = 1.45; top.scaling.z = 0.8;
    const edge = this.cylinder("coffee-table-edge", 0.09, 4.65, [0, 1.98, 0], "darkWood", g);
    edge.scaling.x = 1.45; edge.scaling.z = 0.8;
    [-2.5, 2.5].forEach(x => [-1.2, 1.2].forEach(z => this.cylinder("coffee-table-leg", 2, 0.16, [x, 1, z], "brass", g)));
    this.bookStack([-1.5, 2.3, 0], g);
    this.cylinder("tea-tray", 0.08, 1.6, [1.5, 2.34, 0], "brass", g);
    this.ring("tea-tray-rim", 1.52, 0.065, [1.5, 2.38, 0], "brass", g);
    this.mug([1.6, 2.3775, 0], "navy", g);
  }

  private floorLamp() {
    const start = this.parts.length;
    const g = this.group("brass-floor-lamp", [16, -5, 5]);
    this.materials.set("floor-lamp-shade", this.materials.get("shade")!.clone("floor-lamp-shade")!);
    // A felt foot and a sloping metal shoulder make the base's contact and thickness readable.
    this.cylinder("lamp-base-foot", 0.045, 1.82, [0, 0.0225, 0], "black", g);
    this.cylinder("lamp-weighted-base", 0.12, 2, [0, 0.105, 0], "brass", g, 1.9);
    this.cylinder("lamp-base-shoulder", 0.06, 1.9, [0, 0.195, 0], "brass", g, 1.65);
    this.cylinder("lamp-stem", 7.5, 0.13, [0, 3.9, 0], "brass", g);
    this.cylinder("linen-lampshade", 2.1, 3.4, [0, 7.6, 0], "floor-lamp-shade", g, 2.1);
    this.ring("shade-bottom-trim", 3.4, 0.07, [0, 6.55, 0], "brass", g);
    this.sphere("lamp-finial", [0.28, 0.42, 0.28], [0, 8.85, 0], "brass", g);
    this.lamps.push({ id: "floor-lamp", label: "落地灯", meshes: this.keepInteractive(start, g, true) });
  }

  private windowDesk() {
    const g = this.group("window-console", [-17, -5, 9], Math.PI / 2);
    this.box("console-top", [8, 0.3, 2.9], [0, 4.1, 0], "wood", g);
    this.box("console-top-lip", [7.85, 0.08, 2.8], [0, 3.95, 0], "darkWood", g);
    this.box("console-apron-back", [7.5, 0.85, 0.14], [0, 3.51, -1.15], "darkWood", g);
    [-3.68, 3.68].forEach(x => this.box("console-apron-side", [0.14, 0.85, 2.45], [x, 3.51, 0], "darkWood", g));
    [3.13, 3.89].forEach(y => this.box("console-front-rail", [7.5, 0.09, 0.14], [0, y, 1.15], "darkWood", g));
    [-3.55, -1.15, 1.15, 3.55].forEach(x => this.box("console-front-stile", [0.15, 0.85, 0.14], [x, 3.51, 1.15], "darkWood", g));
    [-3.4, 3.4].forEach(x => [-1, 1].forEach(z => this.box("console-leg", [0.25, 3.4, 0.25], [x, 1.7, z], "wood", g)));
    [-2.3, 0, 2.3].forEach((x, index) => {
      const drawer = this.group(`console-drawer-${index + 1}`, [x, 3.51, 1.3]); drawer.parent = g;
      const start = this.parts.length;
      this.box("console-drawer", [2.15, 0.65, 0.12], [0, 0, 0], "wood", drawer);
      this.box("console-drawer-inset", [1.9, 0.43, 0.045], [0, 0, 0.07], "darkWood", drawer);
      this.sphere("drawer-pull", [0.18, 0.18, 0.18], [0, 0.04, 0.1], "brass", drawer);
      this.drawerBox(drawer, 2.02, 0.57, 2.15);
      const meshes = this.keepInteractive(start, drawer);
      this.drawers.push({ id: drawer.name, label: `窗边桌${["左侧", "中间", "右侧"][index]}抽屉`, root: drawer,
        meshes, travel: new Vector3(0, 0, 1.55) });
    });
    this.bookStack([-2, 4.25, 0], g);
    this.vase([2.5, 4.25, 0], 0.65, g);
    this.cylinder("console-stool", 2.2, 2.1, [-12.9, -3.9, 9], "wood");
    this.sphere("console-stool-cushion", [2.2, 0.35, 2.2], [-12.9, -2.65, 9], "cream");
  }

  private cabinetAccessories() {
    const g = this.group("cabinet-top-accessories", [-13.5, 0.75, -17.6]);
    this.vase([-1.7, 0, 0], 0.8, g);
    this.bookStack([1.1, 0, 0], g);
    this.cylinder("cabinet-candle-base", 0.1, 0.7, [0, 0.05, 0.1], "brass", g);
    this.cylinder("cabinet-candle", 1.2, 0.36, [0, 0.7, 0.1], "cream", g);
    this.sphere("candle-flame", [0.12, 0.35, 0.12], [0, 1.45, 0.1], "shade", g);
    this.box("floating-shelf", [8, 0.25, 1.5], [-13, 5, -18.9], "wood");
    this.vase([-15, 5.15, -18.7], 0.7);
    this.bookStack([-11.2, 5.125, -18.7]);
  }

  furnishBookshelf(meshes: AbstractMesh[]): Mesh[] {
    const start = this.parts.length;
    const { bounds, compartments } = measureBookshelf(meshes);
    const colors = ["burgundy", "moss", "navy", "cushion", "rust", "cream"];
    const thicknessRatios = [0.07, 0.11, 0.055, 0.16, 0.085, 0.13, 0.06, 0.095, 0.18, 0.075, 0.12];
    compartments.forEach(({ min, max }, row) => {
      const hasVase = row === compartments.length - 2;
      const front = max.z - 0.12;
      let edge = min.x + 0.08;
      for (let i = 0; i < 64; i++) {
        const height = (max.y - min.y - 0.16) * (0.72 + ((i * 7 + row * 3) % 9) * 0.03);
        // Scale all dimensions together: mostly slim volumes, with occasional thicker editions.
        const width = height * thicknessRatios[(i * 7 + row * 3) % thicknessRatios.length];
        const depth = Math.min(height * (0.62 + ((i * 3 + row) % 5) * 0.035), max.z - min.z - 0.2);
        const z = front - depth / 2 - ((i * 5 + row) % 4) * 0.015;
        if (edge + width > max.x - (hasVase ? 1.1 : 0.28)) break;
        const x = edge + width / 2;
        const bottom = min.y + 0.015;
        const color = colors[(i + row) % colors.length];
        const cover = `book-${color}-${(Math.floor(i / colors.length) + row) % 2}`;
        this.box("shelf-book", [width, height, depth], [x, bottom + height / 2, z], cover);
        [height * 0.15, height * 0.85].forEach(y => this.box("book-spine-gilt", [width * 0.8, height * 0.02, 0.02],
          [x, bottom + y, z + depth / 2 + 0.01], "brass"));
        edge += width + 0.012 + ((i + row) % 3) * 0.006 + (i % 9 === 8 ? 0.1 : 0);
      }
      if (hasVase) {
        const scale = Math.min(0.7, (max.y - min.y - 0.16) / 3.35);
        const vaseZ = front - Math.min(1.15, max.z - min.z - 0.2) / 2;
        this.vase([max.x - 0.55, min.y + 0.015, vaseZ], scale);
      }
    });
    this.sphere("shelf-sculpture", [0.7, 0.7, 0.7],
      [bounds.min.x + 0.8, bounds.max.y + 0.35, (bounds.min.z + bounds.max.z) / 2], "brass");
    return this.merge(this.parts.splice(start));
  }

  bookStack(position: Triple, parent?: TransformNode) {
    const g = this.group("stacked-books", position);
    g.parent = parent || null;
    ["burgundy", "navy", "cushion"].forEach((color, i) => {
      const cover = `book-${color}-${(Math.round(position[0] * 7 + position[2] * 5) + i) & 1}`;
      const book = this.group("closed-book", [0, i * 0.265, 0], (i - 1) * 0.13);
      book.parent = g;
      const pages = this.box("book-pages", [1.7, 0.18, 1.15], [0, 0.1325, 0], "book-paper", book);
      const positions = pages.getVerticesData(VertexBuffer.PositionKind)!;
      const normals = pages.getVerticesData(VertexBuffer.NormalKind)!;
      const uvs = pages.getVerticesData(VertexBuffer.UVKind)!;
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        // CreateBox rotates some side UVs; page layers must follow the book's height on every edge.
        if (Math.abs(normals[vertex * 3 + 1]) < 0.5) {
          uvs[vertex * 2 + 1] = positions[vertex * 3 + 1] / 0.18 + 0.5;
        }
      }
      pages.setVerticesData(VertexBuffer.UVKind, uvs);
      [0.0225, 0.2425].forEach(y => this.box("book-cover", [1.85, 0.045, 1.26], [0, y, 0], cover, book));
      this.box("book-spine", [1.85, 0.22, 0.06], [0, 0.1325, -0.61], cover, book);
    });
  }

  mug(position: Triple, color: string, parent?: TransformNode) {
    const g = this.group("tea-cup", position); g.parent = parent || null;
    this.cylinder("saucer", 0.045, 0.9, [0, 0.025, 0], color, g);
    this.cylinder("cup", 0.55, 0.52, [0, 0.3225, 0], color, g, 0.65);
    this.cylinder("tea", 0.01, 0.51, [0, 0.59, 0], "darkWood", g);
    this.ring("cup-rim", 0.57, 0.055, [0, 0.6, 0], "brass", g);
    this.ring("cup-handle", 0.39, 0.075, [0.37, 0.35, 0], color, g).rotation.x = Math.PI / 2;
  }

  private bankerLamp(position: Triple, parent?: TransformNode) {
    const start = this.parts.length;
    const g = this.group("banker-lamp", position); g.parent = parent || null;
    this.materials.set("desk-lamp-glow", this.materials.get("shade")!.clone("desk-lamp-glow")!);
    this.cylinder("banker-base", 0.12, 1.1, [0, 0.06, 0], "brass", g);
    this.cylinder("banker-stem", 1.4, 0.1, [0, 0.8, 0], "brass", g);
    this.sphere("banker-green-shade", [2.1, 0.8, 0.95], [0, 1.65, 0], "lampGlass", g);
    this.box("banker-lit-underside", [1.5, 0.06, 0.65], [0, 1.38, 0], "desk-lamp-glow", g);
    this.lamps.push({ id: "desk-lamp", label: "台灯", meshes: this.keepInteractive(start, g, true) });
  }

  vase(position: Triple, scale = 1, parent?: TransformNode) {
    const g = this.group("ceramic-vase", position); g.parent = parent || null; g.scaling.setAll(scale);
    this.sphere("vase-body", [1, 1.25, 1], [0, 0.63, 0], "ceramic", g);
    this.cylinder("vase-neck", 0.6, 0.4, [0, 1.3, 0], "ceramic", g, 0.5);
    for (let i = 0; i < 5; i++) {
      const angle = i * 1.4;
      const flower = new Vector3(Math.sin(angle) * 0.28, 3 + (i % 2) * 0.2, Math.cos(angle) * 0.28);
      const root = new Vector3(Math.sin(angle) * 0.1, 1.4, Math.cos(angle) * 0.1);
      const stem = CreateTube("dried-flower-stem", {
        path: [root, flower], radius: 0.0125, tessellation: 8, cap: Mesh.CAP_ALL,
      }, this.scene);
      this.place(stem, [0, 0, 0], "stem", g);
      this.sphere("dried-flower", [0.4, 0.3, 0.4], [flower.x, flower.y, flower.z], "cushion", g);
    }
  }

  private createLeafMaterial() {
    const texture = new DynamicTexture("ficus-leaf-veins", { width: 256, height: 512 }, this.scene, false);
    const c = texture.getContext();
    const green = c.createLinearGradient(0, 0, 256, 0);
    green.addColorStop(0, "#33492d"); green.addColorStop(0.46, "#617747");
    green.addColorStop(0.52, "#536a3b"); green.addColorStop(1, "#3b522e");
    c.fillStyle = green; c.fillRect(0, 0, 256, 512);
    c.strokeStyle = "#94a16c"; c.lineWidth = 2.5; c.globalAlpha = 0.65;
    c.beginPath(); c.moveTo(128, 0); c.lineTo(128, 512); c.stroke();
    c.lineWidth = 1.3; c.globalAlpha = 0.4;
    for (let y = 40; y < 500; y += 38) for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(128, y);
      for (let step = 1; step <= 12; step++) {
        const t = step / 12;
        c.lineTo(128 + side * 125 * t, y - 6 * t - 54 * t * t);
      }
      c.stroke();
    }
    c.globalAlpha = 1; texture.update();
    this.materials.get("leaf")!.dispose();
    const leaf = surfaceMaterial("leaf", this.scene, "#ffffff", 0.54);
    leaf.albedoTexture = texture;
    leaf.clearCoat.isEnabled = true; leaf.clearCoat.intensity = 0.12; leaf.clearCoat.roughness = 0.6;
    this.materials.set("leaf", leaf);
  }

  plant(position: Triple, scale: number) {
    const g = this.group("potted-ficus", position); g.scaling.setAll(scale);
    this.cylinder("terracotta-pot", 1.9, 1.5, [0, 0.95, 0], "rust", g, 2.2);
    this.ring("pot-rim", 2.15, 0.18, [0, 1.85, 0], "rust", g);
    this.cylinder("pot-soil", 0.04, 1.95, [0, 1.8, 0], "soil", g);
    const trunk = CreateTube("plant-trunk", {
      path: [new Vector3(0, 1.72, 0), new Vector3(0.06, 3.3, 0.04),
        new Vector3(-0.12, 5.1, 0.1), new Vector3(0.08, 7.05, 0)],
      radiusFunction: i => 0.095 - i * 0.022, tessellation: 8, cap: Mesh.CAP_ALL,
    }, this.scene);
    this.place(trunk, [0, 0, 0], "stem", g);
    for (let i = 0; i < 32; i++) {
      const angle = i * 2.39996, y = 2.65 + i * 0.13;
      const reach = 0.55 + ((i * 7) % 5) * 0.19;
      const root = new Vector3(Math.sin(angle) * reach, y + 0.22, Math.cos(angle) * reach);
      const lower = y <= 3.3 ? new Vector3(0, 1.72, 0) : y <= 5.1
        ? new Vector3(0.06, 3.3, 0.04) : new Vector3(-0.12, 5.1, 0.1);
      const upper = y <= 3.3 ? new Vector3(0.06, 3.3, 0.04) : y <= 5.1
        ? new Vector3(-0.12, 5.1, 0.1) : new Vector3(0.08, 7.05, 0);
      const attach = Vector3.Lerp(lower, upper, (y - lower.y) / (upper.y - lower.y));
      const branch = CreateTube("ficus-branch", {
        path: [attach, Vector3.Lerp(attach, root, 0.55).add(new Vector3(0, 0.08, 0)), root],
        radius: 0.022, tessellation: 6, cap: Mesh.CAP_ALL,
      }, this.scene);
      this.place(branch, [0, 0, 0], "stem", g);
      const length = 1.05 + (i % 4) * 0.16;
      const leaf = ficusLeaf("ficus-leaf", length, length * 0.46, this.scene);
      this.place(leaf, [root.x, root.y, root.z], "leaf", g);
      leaf.rotation.set(-0.2 + (i % 4) * 0.1, angle, (i % 3 - 1) * 0.18);
    }
  }

  framedArt(name: string, file: string, position: Triple, width: number, height: number, rotation = -Math.PI / 2) {
    const g = this.group(name + "-frame", position, rotation);
    this.box("art-backing", [width + 0.7, height + 0.7, 0.2], [0, 0, 0], "darkWood", g);
    this.box("art-gilt-mat", [width + 0.25, height + 0.25, 0.07], [0, 0, -0.14], "brass", g);
    const material = new StandardMaterial(name + "-artwork", this.scene);
    material.diffuseTexture = new Texture(file, this.scene); material.specularColor = Color3.Black();
    this.materials.set(name + "-artwork", material);
    const image = CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    this.place(image, [0, 0, -0.19], name + "-artwork", g);
  }

  window(position: Triple = [-19.35, 2.5, 9], rotation = -Math.PI / 2, name = "garden-window") {
    if (!this.materials.has("window-glass")) {
      const texture = new Texture("./textures/study/forest-window/view.jpg", this.scene);
      texture.anisotropicFilteringLevel = 8;
      texture.level = 0.85;
      const mat = new StandardMaterial("window-glass", this.scene);
      mat.disableLighting = true; mat.diffuseColor = Color3.Black();
      mat.emissiveTexture = texture; mat.emissiveColor = Color3.Black();
      mat.specularColor = Color3.Black();
      this.materials.set("window-glass", mat);
    }
    const g = this.group(name, position, rotation);
    this.box("window-casing", [11, 8.2, 0.35], [0, 0, 0], "darkWood", g);
    const plane = CreatePlane("garden-view", { width: 10.3, height: 7.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    this.place(plane, [0, 0, -0.21], "window-glass", g).receiveShadows = false;
    [-5.3, 0, 5.3].forEach(x => {
      this.box("window-mullion", [0.2, 7.8, 0.28], [x, 0, -0.36], "wood", g);
      this.box("window-mullion-bead", [0.065, 7.5, 0.08], [x, 0, -0.53], "darkWood", g);
    });
    [-3.8, 0, 3.8].forEach(y => {
      this.box("window-crossbar", [10.7, 0.2, 0.28], [0, y, -0.36], "wood", g);
      this.box("window-crossbar-bead", [10.3, 0.065, 0.08], [0, y, -0.53], "darkWood", g);
    });
    this.box("window-sill", [11.8, 0.3, 1.3], [0, -4.2, -0.15], "wood", g);
    this.box("window-sill-step", [11.45, 0.12, 0.9], [0, -4.4, -0.08], "darkWood", g);
    const rod = this.cylinder("curtain-rod", 13.3, 0.09, [0, 4.63, -0.72], "brass", g);
    rod.rotation.z = Math.PI / 2;
    [-1, 1].forEach(side => {
      this.sphere("curtain-finial", [0.24, 0.24, 0.24], [side * 6.7, 4.63, -0.72], "brass", g);
      const cloth = curtainPanel("linen-curtain", side, this.scene);
      this.place(cloth, [0, 0, 0], "curtain-linen", g);
      for (let i = 0; i < 7; i++) {
        const ring = this.ring("curtain-hanging-ring", 0.24, 0.035,
          [side * 5.55 + (i - 3) * 0.245, 4.53, -0.72], "brass", g);
        ring.rotation.z = Math.PI / 2;
      }
      const tiePath = [];
      for (let i = 0; i <= 20; i++) {
        const angle = i / 20 * Math.PI * 2;
        tiePath.push(new Vector3(side * 5.81 + Math.cos(angle) * 0.4, -1.33,
          -0.79 + Math.sin(angle) * 0.14));
      }
      const tie = CreateTube("curtain-tie", { path: tiePath, radius: 0.045, tessellation: 6 }, this.scene);
      this.place(tie, [0, 0, 0], "cushion", g);
      const cord = CreateTube("curtain-tassel-cord", { path: [
        new Vector3(side * 5.5, -1.33, -0.96), new Vector3(side * 5.43, -1.63, -1.02),
        new Vector3(side * 5.48, -1.82, -1.01)], radius: 0.022, tessellation: 6 }, this.scene);
      this.place(cord, [0, 0, 0], "cushion", g);
      this.cylinder("curtain-tassel", 0.26, 0.14, [side * 5.48, -1.94, -1.01], "cushion", g, 0.06);
    });
    return g;
  }

  private clock() {
    const g = this.group("wall-clock", [-2, 7.25, -19.4]);
    this.cylinder("clock-case", 0.2, 1.65, [0, 0, 0], "brass", g).rotation.x = Math.PI / 2;
    const face = this.cylinder("clock-face", 0.04, 1.45, [0, 0, 0.13], "cream", g);
    face.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const mark = this.box("clock-tick", [0.035, 0.12, 0.025], [Math.sin(angle) * 0.61, Math.cos(angle) * 0.61, 0.17], "darkWood", g);
      mark.rotation.z = -angle;
    }
    this.box("hour-hand", [0.055, 0.4, 0.025], [0.14, 0.09, 0.2], "darkWood", g).rotation.z = -1.1;
    this.box("minute-hand", [0.035, 0.56, 0.025], [-0.1, 0.24, 0.22], "darkWood", g).rotation.z = 0.4;
    this.sphere("clock-pivot", [0.12, 0.12, 0.08], [0, 0, 0.23], "brass", g);
  }

  private drawerBox(parent: TransformNode, width: number, height: number, depth: number) {
    this.box("drawer-bottom", [width, 0.06, depth], [0, -height / 2 + 0.03, -depth / 2], "darkWood", parent);
    [-1, 1].forEach(side => this.box("drawer-side", [0.07, height, depth],
      [side * (width / 2 - 0.035), 0, -depth / 2], "wood", parent));
    this.box("drawer-back", [width, height, 0.07], [0, 0, -depth + 0.035], "wood", parent);
  }

  private keepInteractive(start: number, root: TransformNode, fixed = false) {
    const meshes = this.parts.splice(start);
    this.interactiveGroups.push({ meshes, root, fixed });
    return meshes;
  }

  finish(): Mesh[] {
    const fixed = this.merge(this.parts);
    const interactive: Mesh[] = [];
    this.interactiveGroups.forEach(({ meshes, root, fixed }) => {
      const merged = this.merge(meshes, false);
      merged.forEach(mesh => {
        mesh.setParent(root); // Preserve world-space geometry baked by MergeMeshes.
        if (root.name.startsWith("living-")) mesh.metadata = { ...mesh.metadata, room: "living" };
        mesh.checkCollisions = true;
        if (fixed) mesh.freezeWorldMatrix();
      });
      meshes.splice(0, meshes.length, ...merged); // Keep the interaction descriptors current.
      interactive.push(...merged);
    });
    return [...fixed, ...interactive];
  }

  private merge(parts: Mesh[], fixed = true): Mesh[] {
    const groups = new Map<string, { material: Material; castsShadows: boolean; parts: Mesh[] }>();
    parts.forEach(mesh => {
      mesh.computeWorldMatrix(true);
      const material = mesh.material!;
      const castsShadows = mesh.metadata?.castsShadows !== false;
      const key = material.uniqueId + ":" + castsShadows;
      if (!groups.has(key)) groups.set(key, { material, castsShadows, parts: [] });
      groups.get(key)!.parts.push(mesh);
    });
    const merged: Mesh[] = [];
    groups.forEach(({ parts, material, castsShadows }) => {
      const collisionParts = parts.map(part => ({ vertices: part.getTotalVertices(), indices: part.getTotalIndices() }));
      const mesh = parts.length === 1 ? parts[0] : Mesh.MergeMeshes(parts, true, true)!;
      mesh.name = "study-" + material.name + (castsShadows ? "" : "-surface");
      mesh.metadata = { castsShadows };
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      if (fixed) {
        mesh.freezeWorldMatrix();
        partitionMergedCollisions(mesh, collisionParts);
      }
      merged.push(mesh);
    });
    return merged;
  }
}
