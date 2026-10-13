import {
  AbstractMesh, Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Texture,
  TransformNode, Vector3, VertexBuffer, VertexData,
} from "@babylonjs/core";
import { measureBookshelf } from "./BookshelfLayout";

type Triple = [number, number, number];

/** Reusable, static furniture parts, merged by material to keep draw calls low. */
export class RoomFurnishings {
  private materials = new Map<string, StandardMaterial>();
  private parts: Mesh[] = [];

  constructor(private scene: Scene) {
    const colors: Record<string, string> = {
      wood: "#795032", darkWood: "#362a20", brass: "#b18b47", cream: "#e2d2af",
      moss: "#4e624b", cushion: "#b69a68", rust: "#955338", burgundy: "#763c38",
      navy: "#354756", paper: "#e2d3ac", leaf: "#506c3a", stem: "#424a28",
      ceramic: "#c3b894", soil: "#33281d", shade: "#f3dfad", black: "#272b29",
    };
    Object.entries(colors).forEach(([name, color]) => {
      const material = new StandardMaterial(name, scene);
      material.diffuseColor = Color3.FromHexString(color);
      material.specularColor = name === "brass" ? new Color3(0.65, 0.5, 0.27) : new Color3(0.08, 0.07, 0.05);
      material.maxSimultaneousLights = 4;
      if (name === "shade") material.emissiveColor = new Color3(0.32, 0.22, 0.1);
      if (["moss", "cream", "cushion", "leaf"].includes(name)) material.specularColor.set(0.025, 0.025, 0.02);
      this.materials.set(name, material);
    });
    const wood = this.materials.get("wood")!;
    wood.diffuseColor.set(0.45, 0.4, 0.32);
    wood.diffuseTexture = new Texture("./textures/woodFloor/wood_floor_diff.jpg", scene);
    wood.bumpTexture = new Texture("./textures/woodFloor/wood_floor_normal.jpg", scene);
    wood.bumpTexture.level = 0.18;
    this.fabric("moss", "#4e624b", "#819072");
    this.fabric("cream", "#d6c5a3", "#eee0bf");
    this.fabric("cushion", "#ad8754", "#d6b879");
  }

  box(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
    return this.place(mesh, position, material, parent);
  }

  private cylinder(name: string, height: number, diameter: number, position: Triple,
    material: string, parent?: TransformNode, top = diameter) {
    const mesh = MeshBuilder.CreateCylinder(name, { height, diameterBottom: diameter, diameterTop: top, tessellation: 24 }, this.scene);
    return this.place(mesh, position, material, parent);
  }

  private sphere(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, this.scene);
    mesh.scaling.set(...size);
    return this.place(mesh, position, material, parent);
  }

  private paddedBox(name: string, size: Triple, position: Triple, material: string, parent?: TransformNode) {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16, updatable: true }, this.scene);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    // A superellipsoid gives upholstery broad, flat faces with soft corners.
    for (let i = 0; i < positions.length; i++) {
      const value = positions[i];
      positions[i] = Math.sign(value) * Math.pow(Math.abs(value) * 2, 0.24) * 0.5;
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, mesh.getIndices()!, normals);
    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
    mesh.scaling.set(...size);
    return this.place(mesh, position, material, parent);
  }

  private ring(name: string, diameter: number, thickness: number, position: Triple, material: string, parent?: TransformNode) {
    return this.place(MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 32 }, this.scene), position, material, parent);
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

  private group(name: string, position: Triple, rotation = 0) {
    const group = new TransformNode(name, this.scene);
    group.position.set(...position);
    group.rotation.y = rotation;
    return group;
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

    this.box("green-door", [7.6, 10.7, 0.35], [-2, 0.35, -19.8], "moss");
    [-6.1, 2.1].forEach(x => this.box("door-frame", [0.4, 11.3, 0.65], [x, 0.5, -19.5], "wood"));
    this.box("door-frame-top", [8.6, 0.45, 0.65], [-2, 6.1, -19.5], "wood");
    [-2.3, 2.4].forEach(y => {
      this.box("door-raised-panel", [6.25, 3.6, 0.12], [-2, y, -19.53], "darkWood");
      this.box("door-panel-inset", [5.95, 3.3, 0.15], [-2, y, -19.45], "moss");
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
    this.box("right-wainscot", [0.18, 2.5, 40], [19.65, -3.7, 0], "darkWood");
    this.box("front-wainscot", [40, 2.5, 0.18], [0, -3.7, 19.65], "darkWood");
    const rails: [string, number, number, number, string][] = [
      ["baseboard", 0.32, 0.32, -4.75, "wood"],
      ["chair-rail", 0.32, 0.16, -2.4, "wood"],
      ["brass-inlay", 0.34, 0.045, -2.2, "brass"],
      ["cornice", 0.65, 0.4, 8.8, "darkWood"],
      ["cornice-gold", 0.7, 0.07, 8.52, "brass"],
    ];
    rails.forEach(([name, depth, height, y, material]) => {
      this.box("right-" + name, [depth, height, 40], [19.5, y, 0], material);
      this.box("front-" + name, [40, height, depth], [0, y, 19.5], material);
    });
    for (let offset = -18; offset < 20; offset += 3.2) {
      this.box("right-panel-stile", [0.24, 2.2, 0.1], [19.5, -3.6, offset], "wood");
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

  private fabric(name: string, base: string, thread: string) {
    const texture = new DynamicTexture(name + "-weave", 128, this.scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = thread; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    for (let i = 0; i < 128; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    texture.uScale = texture.vScale = 4;
    texture.update();
    const mat = this.materials.get(name)!;
    mat.diffuseColor = Color3.White(); mat.diffuseTexture = texture;
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
    c.globalAlpha = 1; texture.update();
    const mat = new StandardMaterial("rug", this.scene);
    mat.diffuseTexture = texture; mat.specularColor = Color3.Black(); this.materials.set("rug", mat);
    this.box("persian-rug", [14.5, 0.055, 13], [-3, -4.95, -0.3], "rug");
    for (let i = 0; i < 38; i++) {
      const x = -9.9 + i * 0.37;
      [-7, 6.4].forEach(z => this.box("rug-fringe", [0.1, 0.025, 0.5], [x, -4.93, z], "cream"));
    }
    this.cylinder("reading-rug", 0.05, 13, [10, -4.95, 10], "cream");
    this.ring("reading-rug-border", 12.5, 0.09, [10, -4.9, 10], "cushion");
  }

  private writingTable() {
    const g = this.group("central-writing-table", [-3, -5, -1]);
    this.box("table-top", [8.3, 0.4, 6], [0, 4.4, 0], "wood", g);
    this.box("table-apron", [7.7, 0.7, 5.3], [0, 3.85, 0], "darkWood", g);
    [-3.45, 3.45].forEach(x => [-2.25, 2.25].forEach(z => {
      this.cylinder("turned-table-leg", 3.4, 0.4, [x, 1.8, z], "wood", g, 0.58);
      this.sphere("leg-collar", [0.65, 0.6, 0.65], [x, 2.9, z], "wood", g);
      this.cylinder("brass-table-foot", 0.3, 0.4, [x, 0.15, z], "brass", g);
    }));
    this.box("desk-blotter", [4.1, 0.035, 2.8], [0, 4.62, 0.45], "moss", g);
    const letter = this.box("letter", [1.5, 0.02, 2], [-0.5, 4.66, 0.35], "paper", g);
    letter.rotation.y = -0.2;
    this.box("pen", [0.07, 0.07, 1.5], [0.7, 4.7, 0.35], "brass", g).rotation.y = -0.25;
    this.bookStack([-2.5, 4.63, -1.5], g);
    this.mug([2.55, 4.65, 1.5], "ceramic", g);
    this.bankerLamp([2.45, 4.65, -1.65], g);
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
  }

  private sofa() {
    const g = this.group("moss-reading-sofa", [10, -5, 6]);
    [-4.6, 4.6].forEach(x => [-1.3, 1.3].forEach(z => this.cylinder("sofa-foot", 0.75, 0.3, [x, 0.38, z], "darkWood", g)));
    this.paddedBox("sofa-base", [10.8, 1.05, 4.2], [0, 1.2, 0], "moss", g);
    this.box("sofa-lower-trim", [10.9, 0.13, 4.22], [0, 0.77, 0], "brass", g);
    [-2.85, 0, 2.85].forEach(x => {
      this.paddedBox("sofa-seat-cushion", [2.8, 0.75, 3.45], [x, 1.95, 0.35], "moss", g);
      this.paddedBox("sofa-back-cushion", [2.8, 2.65, 0.85], [x, 3.1, -1.5], "moss", g);
      [-0.65, 0.65].forEach(dx => this.sphere("tuft-button", [0.09, 0.09, 0.09], [x + dx, 3.2, -0.99], "darkWood", g));
    });
    [-5, 5].forEach(x => {
      this.paddedBox("rolled-sofa-arm", [1.25, 2.3, 4.35], [x, 2.3, 0], "moss", g);
      this.sphere("brass-arm-end", [0.12, 0.12, 0.12], [x, 2.6, 2.2], "brass", g);
    });
    this.paddedBox("ochre-throw-pillow", [1.6, 1.6, 0.7], [-3.6, 2.8, -0.5], "cushion", g).rotation.z = -0.18;
    this.paddedBox("linen-throw-pillow", [1.6, 1.6, 0.7], [3.6, 2.8, -0.5], "cream", g).rotation.z = 0.18;
    this.box("folded-throw", [1.7, 0.15, 2.5], [2, 2.34, 0.6], "rust", g).rotation.y = 0.12;
    const ottoman = this.group("reading-ottoman", [15, -5, 16]);
    this.cylinder("ottoman-base", 1.2, 3.3, [0, 0.85, 0], "darkWood", ottoman);
    this.sphere("ottoman-cushion", [3.7, 1, 3.7], [0, 1.6, 0], "cushion", ottoman);
  }

  private armchair() {
    const g = this.group("window-reading-armchair", [-10, -5, 12], Math.PI / 2);
    [-1.65, 1.65].forEach(x => [-1.4, 1.4].forEach(z => this.cylinder("armchair-foot", 0.65, 0.24, [x, 0.33, z], "darkWood", g)));
    this.paddedBox("armchair-base", [4, 1, 3.8], [0, 1.2, 0], "cushion", g);
    this.paddedBox("armchair-seat", [3, 0.7, 3.3], [0, 1.9, 0.3], "cushion", g);
    this.paddedBox("armchair-back", [3.3, 2.8, 0.8], [0, 3.1, -1.4], "cushion", g);
    [-1.8, 1.8].forEach(x => this.paddedBox("armchair-arm", [0.65, 1.8, 3.8], [x, 2.25, 0], "cushion", g));
    this.paddedBox("armchair-pillow", [1.4, 1.4, 0.65], [0.5, 2.6, -0.6], "cream", g).rotation.z = -0.2;
    this.cylinder("side-table-top", 0.2, 2.6, [-13.4, -2.6, 15.2], "wood");
    this.cylinder("side-table-stem", 2.15, 0.18, [-13.4, -3.75, 15.2], "brass");
    this.cylinder("side-table-base", 0.14, 1.5, [-13.4, -4.85, 15.2], "brass");
    this.bookStack([-13.5, -2.48, 15.1]);
  }

  private coffeeTable() {
    const g = this.group("oval-coffee-table", [9.5, -5, 12.5]);
    const top = this.cylinder("oval-walnut-top", 0.3, 4.8, [0, 2.15, 0], "wood", g);
    top.scaling.x = 1.45; top.scaling.z = 0.8;
    [-2.5, 2.5].forEach(x => [-1.2, 1.2].forEach(z => this.cylinder("coffee-table-leg", 2, 0.16, [x, 1, z], "brass", g)));
    this.bookStack([-1.5, 2.32, 0], g);
    this.cylinder("tea-tray", 0.08, 1.6, [1.5, 2.35, 0], "brass", g);
    this.mug([1.6, 2.41, 0], "navy", g);
  }

  private floorLamp() {
    const g = this.group("brass-floor-lamp", [16, -5, 5]);
    this.cylinder("lamp-weighted-base", 0.22, 2, [0, 0.11, 0], "brass", g);
    this.cylinder("lamp-stem", 7.5, 0.13, [0, 3.9, 0], "brass", g);
    this.cylinder("linen-lampshade", 2.1, 3.4, [0, 7.6, 0], "shade", g, 2.1);
    this.ring("shade-bottom-trim", 3.4, 0.07, [0, 6.55, 0], "brass", g);
    this.sphere("lamp-finial", [0.28, 0.42, 0.28], [0, 8.85, 0], "brass", g);
  }

  private windowDesk() {
    const g = this.group("window-console", [-17, -5, 9], Math.PI / 2);
    this.box("console-top", [8, 0.3, 2.9], [0, 4.1, 0], "wood", g);
    this.box("console-apron", [7.5, 0.85, 2.45], [0, 3.55, 0], "darkWood", g);
    [-3.4, 3.4].forEach(x => [-1, 1].forEach(z => this.box("console-leg", [0.25, 3.4, 0.25], [x, 1.7, z], "wood", g)));
    [-2.3, 0, 2.3].forEach(x => {
      this.box("console-drawer", [2.15, 0.65, 0.12], [x, 3.55, 1.28], "wood", g);
      this.sphere("drawer-pull", [0.18, 0.18, 0.18], [x, 3.55, 1.4], "brass", g);
    });
    this.bookStack([-2, 4.27, 0], g);
    this.vase([2.5, 4.27, 0], 0.65, g);
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
    this.bookStack([-11.2, 5.15, -18.7]);
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
        this.box("shelf-book", [width, height, depth], [x, bottom + height / 2, z], colors[(i + row) % colors.length]);
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

  private bookStack(position: Triple, parent?: TransformNode) {
    const g = this.group("stacked-books", position);
    g.parent = parent || null;
    ["burgundy", "navy", "cushion"].forEach((color, i) => {
      const book = this.group("closed-book", [0, i * 0.26, 0], (i - 1) * 0.13);
      book.parent = g;
      this.box("book-pages", [1.7, 0.18, 1.15], [0, 0.13, 0], "paper", book);
      [0.02, 0.24].forEach(y => this.box("book-cover", [1.85, 0.045, 1.26], [0, y, 0], color, book));
      this.box("book-spine", [1.85, 0.23, 0.06], [0, 0.13, -0.61], color, book);
    });
  }

  private mug(position: Triple, color: string, parent?: TransformNode) {
    const g = this.group("tea-cup", position); g.parent = parent || null;
    this.cylinder("saucer", 0.045, 0.9, [0, 0.025, 0], color, g);
    this.cylinder("cup", 0.55, 0.52, [0, 0.31, 0], color, g, 0.65);
    this.cylinder("tea", 0.01, 0.51, [0, 0.59, 0], "darkWood", g);
    this.ring("cup-rim", 0.57, 0.055, [0, 0.6, 0], "brass", g);
    this.ring("cup-handle", 0.39, 0.075, [0.37, 0.35, 0], color, g).rotation.x = Math.PI / 2;
  }

  private bankerLamp(position: Triple, parent?: TransformNode) {
    const g = this.group("banker-lamp", position); g.parent = parent || null;
    this.cylinder("banker-base", 0.12, 1.1, [0, 0.06, 0], "brass", g);
    this.cylinder("banker-stem", 1.4, 0.1, [0, 0.8, 0], "brass", g);
    this.sphere("banker-green-shade", [2.1, 0.8, 0.95], [0, 1.65, 0], "moss", g);
    this.box("banker-lit-underside", [1.5, 0.06, 0.65], [0, 1.38, 0], "shade", g);
  }

  private vase(position: Triple, scale = 1, parent?: TransformNode) {
    const g = this.group("ceramic-vase", position); g.parent = parent || null; g.scaling.setAll(scale);
    this.sphere("vase-body", [1, 1.25, 1], [0, 0.63, 0], "ceramic", g);
    this.cylinder("vase-neck", 0.6, 0.4, [0, 1.3, 0], "ceramic", g, 0.5);
    for (let i = 0; i < 5; i++) {
      const angle = i * 1.4;
      const flower = new Vector3(Math.sin(angle) * 0.28, 3 + (i % 2) * 0.2, Math.cos(angle) * 0.28);
      const root = new Vector3(Math.sin(angle) * 0.1, 1.4, Math.cos(angle) * 0.1);
      const stem = MeshBuilder.CreateTube("dried-flower-stem", {
        path: [root, flower], radius: 0.0125, tessellation: 8, cap: Mesh.CAP_ALL,
      }, this.scene);
      this.place(stem, [0, 0, 0], "stem", g);
      this.sphere("dried-flower", [0.4, 0.3, 0.4], [flower.x, flower.y, flower.z], "cushion", g);
    }
  }

  private plant(position: Triple, scale: number) {
    const g = this.group("potted-ficus", position); g.scaling.setAll(scale);
    this.cylinder("terracotta-pot", 1.9, 1.5, [0, 0.95, 0], "rust", g, 2.2);
    this.ring("pot-rim", 2.15, 0.18, [0, 1.85, 0], "rust", g);
    this.cylinder("pot-soil", 0.04, 1.95, [0, 1.8, 0], "soil", g);
    this.cylinder("plant-trunk", 4.2, 0.09, [0, 3.6, 0], "stem", g, 0.04);
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.4; const y = 2.6 + i * 0.22; const radius = 0.8 + (i % 3) * 0.3;
      const leaf = this.sphere("ficus-leaf", [0.85, 0.11, 1.9], [Math.sin(angle) * radius, y, Math.cos(angle) * radius], "leaf", g);
      leaf.rotation.set(0.2 + (i % 2) * 0.3, angle, 0.25);
    }
  }

  private framedArt(name: string, file: string, position: Triple, width: number, height: number) {
    const g = this.group(name + "-frame", position, -Math.PI / 2);
    this.box("art-backing", [width + 0.7, height + 0.7, 0.2], [0, 0, 0], "darkWood", g);
    this.box("art-gilt-mat", [width + 0.25, height + 0.25, 0.07], [0, 0, -0.14], "brass", g);
    const material = new StandardMaterial(name + "-artwork", this.scene);
    material.diffuseTexture = new Texture(file, this.scene); material.specularColor = Color3.Black();
    this.materials.set(name + "-artwork", material);
    const image = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    this.place(image, [0, 0, -0.19], name + "-artwork", g);
  }

  private window() {
    const texture = new DynamicTexture("window-garden-view", { width: 768, height: 512 }, this.scene, false);
    const c = texture.getContext();
    const sky = c.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, "#9cbdc3"); sky.addColorStop(0.6, "#e5d7ad"); sky.addColorStop(1, "#81917b");
    c.fillStyle = sky; c.fillRect(0, 0, 768, 512);
    c.fillStyle = "#ead6a0"; c.beginPath(); c.arc(550, 145, 53, 0, Math.PI * 2); c.fill();
    ["#879383", "#657f70", "#48665a"].forEach((color, i) => {
      c.fillStyle = color; c.beginPath(); c.moveTo(0, 512);
      for (let x = 0; x <= 768; x += 24) c.lineTo(x, 300 + i * 65 + Math.sin(x * 0.01 + i) * 35);
      c.lineTo(768, 512); c.closePath(); c.fill();
    });
    c.fillStyle = "#3b554a";
    [70, 160, 690].forEach((x, i) => {
      c.fillRect(x, 155 + i * 30, 9, 360);
      for (let j = 0; j < 5; j++) { c.beginPath(); c.arc(x + 3, 185 + j * 48 + i * 25, 54 - j * 5, 0, Math.PI * 2); c.fill(); }
    });
    texture.update();
    const mat = new StandardMaterial("window-glass", this.scene); mat.diffuseTexture = texture;
    mat.emissiveTexture = texture; mat.emissiveColor = new Color3(0.38, 0.38, 0.38); mat.specularColor = Color3.Black();
    this.materials.set("window-glass", mat);
    const g = this.group("garden-window", [-19.35, 2.5, 9], -Math.PI / 2);
    this.box("window-casing", [11, 8.2, 0.35], [0, 0, 0], "darkWood", g);
    const plane = MeshBuilder.CreatePlane("garden-view", { width: 10.3, height: 7.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    this.place(plane, [0, 0, -0.21], "window-glass", g);
    [-5.3, 0, 5.3].forEach(x => this.box("window-mullion", [0.17, 7.8, 0.23], [x, 0, -0.36], "wood", g));
    [-3.8, 0, 3.8].forEach(y => this.box("window-crossbar", [10.7, 0.17, 0.23], [0, y, -0.36], "wood", g));
    this.box("window-sill", [11.8, 0.3, 1.3], [0, -4.2, -0.15], "wood", g);
    [-5.7, 5.7].forEach(x => {
      this.box("linen-curtain", [0.9, 8.7, 0.5], [x, -0.05, -0.4], "cream", g);
      this.box("curtain-tie", [0.95, 0.12, 0.55], [x, -1.3, -0.4], "brass", g);
    });
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

  finish(): Mesh[] {
    return this.merge(this.parts);
  }

  private merge(parts: Mesh[]): Mesh[] {
    const groups = new Map<string, { material: StandardMaterial; castsShadows: boolean; parts: Mesh[] }>();
    parts.forEach(mesh => {
      mesh.computeWorldMatrix(true);
      const material = mesh.material as StandardMaterial;
      const castsShadows = mesh.metadata?.castsShadows !== false;
      const key = material.uniqueId + ":" + castsShadows;
      if (!groups.has(key)) groups.set(key, { material, castsShadows, parts: [] });
      groups.get(key)!.parts.push(mesh);
    });
    const merged: Mesh[] = [];
    groups.forEach(({ parts, material, castsShadows }) => {
      const mesh = parts.length === 1 ? parts[0] : Mesh.MergeMeshes(parts, true, true)!;
      mesh.name = "study-" + material.name + (castsShadows ? "" : "-surface");
      mesh.metadata = { castsShadows };
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      merged.push(mesh);
    });
    return merged;
  }
}
