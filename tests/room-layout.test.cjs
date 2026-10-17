const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const babylon = require("@babylonjs/core");
require("@babylonjs/loaders/glTF");

const sourceCache = new Map();
function loadSource(name) {
  if (sourceCache.has(name)) return sourceCache.get(name);
  const source = fs.readFileSync(path.join(__dirname, "../src/examples", name + ".ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    id => id.startsWith("./") ? loadSource(id.slice(2)) : require(id), module, module.exports);
  sourceCache.set(name, module.exports);
  return module.exports;
}

const { measureBookshelf } = loadSource("BookshelfLayout");
const { RoomFurnishings } = loadSource("RoomFurnishings");
const { RoomScene } = loadSource("Room");
const { createLegacyArchitecture } = loadSource("RoomLegacyArchitecture");
const { RoomItemInspection } = loadSource("RoomItemInspection");
const { RoomInteractions, cabinetDrawers } = loadSource("RoomInteractions");
const { RoomLighting } = loadSource("RoomLighting");
const { placeFurniture } = loadSource("RoomFurnitureAssets");
const { mappedMaterial, paintedWallMaterial, tileMaterial } = loadSource("RoomMaterials");
const { beveledBox, creasedLetter, curtainPanel, ficusLeaf } = loadSource("RoomDetailGeometry");
const { buildWearMask } = loadSource("RoomSurfaceDetails");
const { partitionMergedCollisions } = loadSource("RoomCollisions");
const { createLivingRoom, constrainWalkingPosition } = loadSource("RoomLivingRoom");
const { HouseRooms } = loadSource("HouseRooms");
const { setRoomOwners } = loadSource("RoomOwnership");
const { sharedRoomMaterials } = loadSource("RoomMaterialLibrary");
const { createHouseArchitecture } = loadSource("HouseArchitecture");
const { houseWallSpans, HOUSE_WINDOWS } = loadSource("HouseStructure");
const { HOUSE_DOORS, HOUSE_ROOMS } = loadSource("HouseLayout");
const { houseVector, HOUSE_WALKER_RADIUS, constrainHouseWalking } = loadSource("HouseWalking");
const { doorSweepIsClear } = loadSource("RoomInteractions");
const { furnishHouseStudy, furnishHouseLiving, HOUSE_CONTENT } = loadSource("HouseContent");
const { furnishHouseMaster, furnishHouseEnsuite } = loadSource("HouseSuite");
const { bathroomVanity, bathroomToilet, bathroomShower, bedroomBed, bedroomWardrobe } = loadSource("HouseRoomComponents");
const { furnishHouseBedroom } = loadSource("HouseBedroom");
const { furnishHouseKitchen, furnishHouseBathroom } = loadSource("HouseServiceRooms");
const { furnishHouseBalcony } = loadSource("HouseBalcony");
const { slidingDoorSweepIsClear } = loadSource("RoomInteractions");
const { RoomMirrors } = loadSource("RoomMirrors");
const { RoomExterior } = loadSource("RoomExterior");
const { COASTAL_CLIFF, coastalSeaY, coastalCrestY, coastalBoundary, coastalWallPoint, coastalLandPatch } = loadSource("CoastalCliff");
const { OceanClock, coastalShoreline, coastalShoreDistance, coastalShoreField, OCEAN_FIELD } = loadSource("CoastalOcean");

test("ocean time pauses offscreen/background and ignores a stale resume delta", () => {
  const clock = new OceanClock();
  assert.equal(clock.advance(60, true), 0);
  assert.equal(clock.advance(.04, true), .04);
  assert.equal(clock.advance(90, false), .04);
  assert.equal(clock.advance(90, true), .04);
  assert.equal(clock.advance(.05, true), .09);
  clock.pause();
  assert.equal(clock.advance(120, true), .09);
  assert.equal(clock.advance(10, true), .19, 'foreground stalls are capped');
  assert.equal(clock.advance(NaN, true), .19);
  assert.equal(clock.advance(-3, true), .19);
});

test("ocean shoreline intersects the real cliff and one deterministic field controls depth and foam", () => {
  const shore = coastalShoreline();
  assert.equal(shore.length, coastalBoundary().length);
  for (const i of [0, 32, 64, 96, 140, 250, 319]) {
    assert.ok(Math.abs(coastalShoreDistance(shore[i].x, shore[i].y, shore)) < 1e-9);
    const a = coastalWallPoint(coastalBoundary(), i, 7), b = coastalWallPoint(coastalBoundary(), i, 8);
    assert.ok(a.height > -28 && b.height < -28);
  }
  assert.ok(coastalShoreDistance(8.1, 5, shore) < 0, 'house footprint is dry');
  assert.ok(coastalShoreDistance(8.1, 40, shore) > 0, 'open water south of the balcony');
  const field = coastalShoreField(), f = OCEAN_FIELD;
  assert.deepEqual(field, coastalShoreField());
  assert.equal(field.length, f.size * f.size * 4);
  for (const [col, row] of [[150, 145], [145, 170], [100, 200], [200, 200]]) {
    const i = (row * f.size + col) * 4;
    const actual = ((field[i] * 256 + field[i + 1]) / 65535 * 2 - 1) * f.range;
    const exact = coastalShoreDistance(f.minX + (col + .5) / f.size * f.width, f.minY + (row + .5) / f.size * f.depth, shore);
    assert.ok(Math.abs(actual - Math.max(-f.range, Math.min(f.range, exact))) < .001);
  }
});

test("ocean visibility, camera layers, page transitions and disposal stop the shared observer", t => {
  const scene = createScene(t), doc = new EventTarget();
  doc.hidden = false;
  scene.getEngine().getRenderingCanvas = () => ({ ownerDocument: doc });
  const exterior = new RoomExterior(scene), ocean = exterior.ocean;
  const sea = ocean.mesh, camera = new babylon.FreeCamera('ocean-test-camera', babylon.Vector3.Zero(), scene);
  camera.position.set(0, 0, 0); camera.setTarget(new babylon.Vector3(0, -145, 500));
  camera.getTransformationMatrix();
  const advance = () => scene.onBeforeRenderObservable.notifyObservers(scene);
  scene.getEngine().getDeltaTime = () => 50;
  advance(); advance(); assert.equal(ocean.clock.seconds, .05);
  exterior.setVisible(false); advance(); assert.equal(ocean.clock.seconds, .05);
  exterior.setVisible(true); advance(); advance(); assert.equal(ocean.clock.seconds, .1);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); advance();
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); advance();
  assert.equal(ocean.clock.seconds, .1);
  camera.layerMask = 0x10000000; advance(); assert.equal(ocean.clock.seconds, .1);
  camera.layerMask = sea.layerMask; advance(); advance(); assert.ok(Math.abs(ocean.clock.seconds - .15) < 1e-9);
  assert.ok(ocean.material.clipPlane2 == null);
  assert.equal(ocean.material.options.useClipPlane, true, 'mirror clip plane must be honoured');
  assert.ok(sea.getBoundingInfo().boundingBox.maximum.y > coastalSeaY + 1);
  assert.equal(ocean.shoreTexture.gammaSpace, false);
  const count = scene.onBeforeRenderObservable.observers.length;
  exterior.dispose(); exterior.dispose(); advance();
  assert.ok(Math.abs(ocean.clock.seconds - .15) < 1e-9);
  assert.equal(scene.onBeforeRenderObservable.observers.filter(o => !o._willBeUnregistered).length, count - 1);
  assert.ok(!scene.textures.includes(ocean.shoreTexture));
  assert.ok(!scene.materials.includes(ocean.material));
});

test("all window centres see the outside through transparent glass while retaining walker collisions", t => {
  const { scene } = houseShell(t);
  for (const w of HOUSE_WINDOWS) {
    const centre = houseVector(w.x + (w.axis === 'x' ? w.width * .3 : 0), w.y + (w.axis === 'y' ? w.width * .3 : 0), w.sill + w.height * .7);
    const inward = w.axis === 'x' ? new babylon.Vector3(0, 0, 1) : new babylon.Vector3(w.x === 0 ? 1 : -1, 0, 0);
    const ray = new babylon.Ray(centre.add(inward.scale(2)), inward.negate(), 5);
    const hit = scene.pickWithRay(ray, m => m.getTotalVertices() > 0 && m.material?.alpha === 1 && !m.metadata?.collisionOnly);
    assert.ok(!hit?.hit, w.id + ': no solid wood panel or wall behind the window opening');
    const glass = scene.meshes.find(m => m.name.startsWith(w.id + '-') && m.material?.name === 'window-glass');
    assert.ok(glass && glass.material.alpha > 0 && glass.material.alpha < .08);
    assert.equal(glass.material.emissiveTexture, null, 'no scenery attached to the glass');
    const travel = inward.scale(-6), start = centre.add(inward.scale(3));
    const result = sweep(scene, start, travel, new babylon.Vector3(.8, .8, .8)).position;
    assert.ok(result.subtract(start).length() < 4, w.id + ': glass still blocks crossing the facade');
  }
});

test("shared PBR coast keeps house support, sea height, bounded geometry and ownership", t => {
  const scene = createScene(t), exterior = new RoomExterior(scene);
  assert.equal(scene.metadata.exteriorVersion, COASTAL_CLIFF.version);
  assert.equal(scene.meshes.filter(m => m.name === 'coastal-sea').length, 1);
  assert.equal(scene.meshes.filter(m => m.name === 'coastal-sky').length, 1);
  assert.equal(exterior.surfaces.textures.length, 7, 'six shared PBR maps plus one outdoor HDR');
  assert.equal(scene.lights.filter(l => l.name === 'coastal-afternoon-sun').length, 1);
  assert.ok(exterior.meshes.reduce((n, m) => n + m.getTotalVertices(), 0) < 160000);
  assert.equal(coastalCrestY(8.1), COASTAL_CLIFF.balconyEdgeY + COASTAL_CLIFF.setback);
  const sea = scene.getMeshByName('coastal-sea');
  assert.equal(coastalSeaY, -145);
  assert.ok(sea.getVerticesData(babylon.VertexBuffer.PositionKind).filter((_, i) => i % 3 === 1).every(y => y === coastalSeaY));
  assert.ok(sea.getVerticesData(babylon.VertexBuffer.NormalKind).filter((_, i) => i % 3 === 1).some(y => y > .99), 'water faces upward');
  for (const room of HOUSE_ROOMS) for (const dx of [.1, .5, .9]) for (const dy of [.1, .5, .9]) {
    const start = houseVector(room.x + room.width * dx, room.y + room.depth * dy, 1);
    const hit = scene.pickWithRay(new babylon.Ray(start, new babylon.Vector3(0, -1, 0), 200), m => m.metadata?.exteriorLayer === 'terrain');
    assert.ok(hit.hit, room.id + ': continuous platform under the footprint');
    assert.ok(Math.abs(hit.pickedPoint.y - (-5.7)) < .001, room.id + ': ground lies below the existing floor');
  }
  const plinth = scene.getMeshByName('coastal-house-plinth').getBoundingInfo().boundingBox;
  assert.ok(plinth.minimumWorld.y < -5.7 && plinth.maximumWorld.y > -5.42, 'plinth overlaps ground and existing foundation');
  const cliff = scene.getMeshByName('coastal-cliff-front-0');
  assert.ok(cliff.getBoundingInfo().boundingBox.minimumWorld.y < coastalSeaY, 'cliff continues beneath water');
  assert.ok(cliff.getVerticesData(babylon.VertexBuffer.NormalKind)[2] > 0, 'south-facing rock is visible from the sea');
  for (const m of exterior.meshes) {
    assert.deepEqual([...m.metadata.ownerRooms].sort(), HOUSE_ROOMS.map(r => r.id).sort());
    assert.deepEqual(m.metadata.lightRooms, []);
    assert.ok(!m.isPickable && !m.checkCollisions && !m.metadata.castsShadows);
    assert.ok(!exterior.sun.canAffectMesh(m) || m.material instanceof babylon.PBRMaterial, 'sun is limited to outdoor PBR');
    assert.ok(m.getVerticesData(babylon.VertexBuffer.PositionKind).every(Number.isFinite));
    assert.ok(m.getVerticesData(babylon.VertexBuffer.NormalKind).every(Number.isFinite));
  }
  exterior.setVisible(false); assert.ok(exterior.meshes.every(m => !m.isVisible));
  exterior.setVisible(true); assert.ok(exterior.meshes.every(m => m.isVisible));
  scene.dispose(); assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0); assert.equal(scene.textures.length, 0);
});

test("coastal terrain is deterministic and cliff rings share the exact closed crest and seabed", t => {
  const scene = createScene(t), exterior = new RoomExterior(scene);
  assert.deepEqual(coastalLandPatch(0, 48, 0, 20), coastalLandPatch(0, 48, 0, 20));
  const whole = coastalLandPatch(0, COASTAL_CLIFF.columns, 0, COASTAL_CLIFF.rows);
  for (let i = 0; i < whole.indices.length; i += 3) {
    const [a, b, c] = whole.indices.slice(i, i + 3).map(n => n * 3), p = whole.positions;
    const areaY = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    assert.ok(areaY < -1e-6, 'every land triangle faces up; the cape-to-inland grid must never fold');
  }
  const boundary = coastalBoundary(), crest = new Set();
  for (const m of exterior.meshes.filter(m => ['terrain', 'distant'].includes(m.metadata.exteriorLayer) && /platform|inland/.test(m.name))) {
    const p = m.getVerticesData(babylon.VertexBuffer.PositionKind);
    for (let i = 0; i < p.length; i += 3) crest.add(p.slice(i, i + 3).join(','));
  }
  for (let index = 0; index < boundary.length; index++) {
    const top = coastalWallPoint(boundary, index, 0), point = houseVector(top.x, top.y, top.height);
    assert.ok(crest.has(point.asArray().join(',')), 'every wall top is a terrain boundary vertex');
    assert.equal(coastalWallPoint(boundary, index, 8).height, -32, 'bottom closes below the water');
  }
  assert.deepEqual(coastalWallPoint(boundary, 0, 4), coastalWallPoint(boundary, boundary.length, 4), 'wrap seam is identical');
  assert.ok(coastalCrestY(-8) > coastalCrestY(8.1) + 35, 'asymmetric cape extends into the balcony side view');
});

test("coastal PBR isolates daylight, reuses maps, caches a local caster list and releases shared resources", t => {
  const scene = createScene(t), baseline = new babylon.Texture(null, scene);
  scene.environmentTexture = baseline;
  const exterior = new RoomExterior(scene), s = exterior.surfaces;
  const interior = babylon.CreateBox('indoor-furniture', {}, scene);
  setRoomOwners(interior, ['study']);
  const lighting = new RoomLighting(scene, true);
  lighting.addMeshes([...exterior.meshes, interior]);
  assert.equal(scene.environmentTexture, baseline, 'indoor environment is untouched');
  assert.ok(!exterior.sun.canAffectMesh(interior));
  assert.ok(scene.getLightByName('room-bounce-light').excludedMeshes.includes(exterior.meshes[0]));
  for (const m of s.materials) {
    assert.equal(m.reflectionTexture, s.environment);
    assert.equal(m.metallic, 0);
    if (!m.bumpTexture) continue;
    assert.equal(m.albedoTexture.gammaSpace, true);
    assert.equal(m.bumpTexture.gammaSpace, false);
    assert.equal(m.metallicTexture.gammaSpace, false);
    assert.equal(m.invertNormalMapX, true, 'OpenGL normals in left-handed scene');
    assert.equal(m.useRoughnessFromMetallicTextureAlpha, false);
    assert.ok(m.useRoughnessFromMetallicTextureGreen && m.useAmbientOcclusionFromMetallicTextureRed);
  }
  assert.equal(s.rock.albedoTexture, s.farRock.albedoTexture);
  assert.equal(s.ground.bumpTexture, s.farGround.bumpTexture);
  assert.equal(s.ground.textureRepetitionMode, babylon.Constants.TEXTURE_REPETITION_HEX_TILING);
  assert.deepEqual(s.ground.textureRepetitionHexTilingParams, [0, 0, 7, .5], 'all maps share translation and weights; no normal rotation');
  const sunIntensity = exterior.sun.intensity;
  lighting.toggleLamp('floor-lamp'); assert.equal(exterior.sun.intensity, sunIntensity);
  const shadow = exterior.shadow.getShadowMap();
  assert.equal(shadow.getSize().width, 1024);
  assert.equal(shadow.refreshRate, babylon.RenderTargetTexture.REFRESHRATE_RENDER_ONCE);
  exterior.bindShadowCasters([interior]);
  assert.ok(shadow.renderList.length > 0);
  assert.ok(shadow.renderList.every(m => ['rocks', 'vegetation', 'foundation'].includes(m.metadata.exteriorLayer)));
  assert.ok(!shadow.renderList.includes(interior) && !shadow.renderList.includes(scene.getMeshByName('coastal-sea')));
  const rooms = new HouseRooms(), builds = HOUSE_ROOMS.map(r => rooms.begin(r.id));
  rooms.own(builds, exterior, () => exterior.dispose());
  HOUSE_ROOMS.slice(0, -1).forEach(r => rooms.release(r.id));
  assert.ok(scene.lights.includes(exterior.sun) && scene.textures.includes(s.environment));
  rooms.release(HOUSE_ROOMS.at(-1).id);
  assert.ok(!scene.lights.includes(exterior.sun) && !scene.textures.includes(s.environment));
  assert.ok(scene.textures.includes(baseline));
  assert.equal(scene.meshes.filter(m => m.metadata?.exterior).length, 0);
  exterior.dispose(); rooms.dispose(); assert.deepEqual(rooms.cleanupErrors, []);
});

test("outdoor cached shadows select only the static exterior shell and balcony rails", t => {
  const { scene } = houseShell(t), exterior = new RoomExterior(scene);
  exterior.bindShadowCasters(scene.meshes);
  const casters = exterior.shadow.getShadowMap().renderList;
  const walls = scene.meshes.filter(m => m.metadata?.structure === 'wall');
  assert.ok(walls.some(m => m.metadata.span.owners.length === 1));
  for (const wall of walls) assert.equal(casters.includes(wall), wall.metadata.span.owners.length === 1);
  const rails = scene.meshes.filter(m => /^balcony-rail-/.test(m.name));
  assert.ok(rails.length > 0 && rails.every(m => casters.includes(m)));
  assert.ok(casters.every(m => m.metadata?.exterior || m.metadata?.structure === 'wall' || /^balcony-rail-/.test(m.name)));
  assert.ok(scene.meshes.filter(m => m.metadata?.structure === 'floor').every(m => !casters.includes(m)));
});

test("failed coastal downloads retain sunlit fallback surfaces without reflecting the indoor HDR", t => {
  const scene = createScene(t), baseline = new babylon.Texture(null, scene);
  scene.environmentTexture = baseline;
  const exterior = new RoomExterior(scene), s = exterior.surfaces, color = s.rock.albedoTexture;
  s.fallbackFor(color); s.fallbackFor(color);
  assert.equal(s.rock.albedoTexture, null); assert.equal(s.farRock.albedoTexture, null);
  assert.ok(s.ground.albedoTexture, 'unaffected scan survives');
  s.fallbackFor(s.environment);
  assert.ok(s.materials.every(m => m.environmentIntensity === 0));
  assert.equal(scene.environmentTexture, baseline);
  assert.ok(exterior.sun.isEnabled());
  assert.equal(scene.metadata.exteriorFallbacks.length, 2);
  exterior.dispose(); assert.ok(scene.textures.includes(baseline));
  const failures = [...scene.metadata.exteriorFallbacks];
  s.fallbackFor(s.ground.bumpTexture); s.dispose();
  assert.deepEqual(scene.metadata.exteriorFallbacks, failures, 'late download callbacks must ignore a disposed component');
});

test("buried coastal rock clusters have outward normals and repeatable opaque geometry", () => {
  const { coastalScatter } = loadSource('CoastalScatter'), g = coastalScatter().rocks;
  assert.deepEqual(g, coastalScatter().rocks);
  const normals = []; babylon.VertexData.ComputeNormals(g.positions, g.indices, normals);
  for (let first = 0; first < g.positions.length / 3; first += 45) {
    const centre = [0, 0, 0];
    for (let j = 0; j < 45; j++) for (let k = 0; k < 3; k++) centre[k] += g.positions[(first + j) * 3 + k] / 45;
    for (let j = 0; j < 45; j++) {
      let outward = 0;
      for (let k = 0; k < 3; k++) outward += (g.positions[(first + j) * 3 + k] - centre[k]) * normals[(first + j) * 3 + k];
      assert.ok(outward >= -1e-6, 'surface normals must not turn buried boulders black from above');
    }
  }
});

test("cliff UVs retain vertical density and exact phase across mesh boundaries", () => {
  const { coastalWallPatch } = loadSource('CoastalCliff'), boundary = coastalBoundary();
  const left = coastalWallPatch(boundary, 0, 32), right = coastalWallPatch(boundary, 32, 64);
  // Four vertices per face, eight vertical bands per column.
  for (let ring = 0; ring < 8; ring++) {
    const a = (31 * 8 + ring) * 4, b = ring * 4;
    assert.equal(left.uvs[(a + 1) * 2], right.uvs[b * 2]);
    assert.deepEqual(left.normals.slice((a + 1) * 3, (a + 2) * 3), right.normals.slice(b * 3, (b + 1) * 3), 'shared column normals do not form patch seams');
    assert.equal(left.uvs[(a + 1) * 2 + 1], right.uvs[b * 2 + 1]);
    assert.ok(left.uvs[(a + 1) * 2 + 1] > left.uvs[(a + 2) * 2 + 1], 'vertical faces have a noncollapsed V');
    const height = (left.positions[(a + 1) * 3 + 1] - left.positions[(a + 2) * 3 + 1]) / 5;
    assert.ok(Math.abs(height / 2 - (left.uvs[(a + 1) * 2 + 1] - left.uvs[(a + 2) * 2 + 1])) < 1e-6);
  }
});

test("foreground clipping leaves sea, sky and distant coast whole and clears stale planes", t => {
  const scene = createScene(t), exterior = new RoomExterior(scene), camera = houseVector(8.1, 25, 5), target = houseVector(8.1, 11.55, .55);
  exterior.updateCutaway(camera, target); assert.ok(scene.clipPlane == null);
  const close = exterior.meshes.filter(m => ['terrain', 'cliff', 'foundation', 'rocks', 'vegetation'].includes(m.metadata.exteriorLayer));
  const distant = exterior.meshes.filter(m => ['sea', 'sky', 'distant'].includes(m.metadata.exteriorLayer));
  const plane = close[0].material.clipPlane2;
  assert.ok(close.every(m => m.material.clipPlane2 === plane));
  assert.ok(distant.every(m => m.material.clipPlane2 == null), 'no missing half-ocean or sky');
  assert.ok(exterior.meshes.every(m => m.material.clipPlane == null), 'mirror plane remains independent');
  assert.ok(plane.signedDistanceTo(houseVector(8.1, 25)) > 0);
  for (const r of HOUSE_ROOMS) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.depth])
    assert.ok(plane.signedDistanceTo(houseVector(x, y)) < 0, 'whole house remains on retained side');
  exterior.updateCutaway(); assert.ok(exterior.meshes.every(m => m.material.clipPlane2 == null));
  exterior.updateCutaway(camera, target); exterior.updateCutaway(target, target);
  assert.ok(exterior.meshes.every(m => m.material.clipPlane2 == null), 'degenerate pose cannot leave a stale cut');
  exterior.updateCutaway(houseVector(60, 60, 30), target);
  assert.ok(exterior.meshes.every(m => m.material.clipPlane2 == null), 'distant site inspection retains the complete cliff and platform');
});

test("bathroom planar mirrors clip behind the actual face, isolate rooms and restore cutaway visibility", t => {
  const { scene,architecture }=furnishedSuite(t);
  architecture.setEnclosed(false);
  const room=new RoomFurnishings(scene,'bathroom');
  bathroomVanity(room,'bathroom',{x:2.6,y:.6},.82,-Math.PI/2);
  new RoomMirrors(scene);
  const mirrors=scene.meshes.filter(m=>m.metadata?.mirrorPlane);
  assert.equal(mirrors.length,2); assert.notEqual(mirrors[0].material,mirrors[1].material);
  assert.notEqual(mirrors[0].material.reflectionTexture,mirrors[1].material.reflectionTexture);
  for(const mesh of mirrors) {
    const target=mesh.material.reflectionTexture,owner=mesh.metadata.reflectionRoom;
    assert.ok(target instanceof babylon.MirrorTexture);assert.equal(target.getSize().width,512);assert.equal(target.getSize().height,512);
    assert.equal(target.noPrePassRenderer,true);
    const b=mesh.getBoundingInfo().boundingBox;
    const point=b.centerWorld.clone(); point.x=b.minimumWorld.x;
    assert.ok(Math.abs(target.mirrorPlane.signedDistanceTo(point))<.001,'plane lies on the front face');
    assert.ok(target.mirrorPlane.signedDistanceTo(point.add(new babylon.Vector3(-1,0,0)))<0,'bathroom lies on the unclipped side');
    const connected=HOUSE_DOORS.filter(d=>d.from===owner||d.to===owner).flatMap(d=>[d.from,d.to]);
    assert.ok(target.renderList.length>0&&target.renderList.every(m=>m.metadata.ownerRooms.some(id=>connected.includes(id))&&!m.metadata.mirrorPlane&&!m.metadata.collisionOnly));
    const hidden=target.renderList.filter(m=>!m.isVisible); assert.ok(hidden.length);
    target.onBeforeBindObservable.notifyObservers(target);assert.ok(hidden.every(m=>m.isVisible));
    target.onAfterUnbindObservable.notifyObservers(target);assert.ok(hidden.every(m=>!m.isVisible));
    const material=mesh.material;mesh.dispose();
    assert.ok(!scene.textures.includes(target)&&!scene.materials.includes(material));
  }
});

function furnishedSuite(t) {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  const architecture = createHouseArchitecture(scene, room);
  furnishHouseMaster(room); furnishHouseEnsuite(room);
  room.finish().forEach(m => m.checkCollisions = true);
  scene.meshes.forEach(m => m.computeWorldMatrix(true)); scene.collisionsEnabled = true;
  return { scene, room, architecture };
}

function furnishedBedroom(t) {
  const result = furnishedSuite(t);
  furnishHouseBedroom(result.room); result.room.finish().forEach(m => m.checkCollisions = true);
  result.scene.meshes.forEach(m => m.computeWorldMatrix(true));
  return result;
}

function furnishedServiceRooms(t) {
  const result=furnishedSuite(t);
  furnishHouseKitchen(result.room);furnishHouseBathroom(result.room);
  result.room.finish().forEach(m=>m.checkCollisions=true);
  result.scene.meshes.forEach(m=>m.computeWorldMatrix(true));return result;
}

// Material batches can span empty space (e.g. glass trim and a distant shower head).
// Only accept a broad-phase overlap as a collision when the actual triangle edges cross.
function surfacesIntersect(scene,a,b) {
  if(!a.intersectsMesh(b,true))return false;
  for(const [source,target]of [[a,b],[b,a]]) {
    const data=source.getVerticesData(babylon.VertexBuffer.PositionKind),indices=source.getIndices(),edges=new Set();
    const points=[];for(let i=0;i<data.length;i+=3)points.push(babylon.Vector3.TransformCoordinates(babylon.Vector3.FromArray(data,i),source.getWorldMatrix()));
    for(let i=0;i<indices.length;i+=3)for(const [from,to]of [[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]) {
      const key=[from,to].sort((x,y)=>x-y).join(':');if(edges.has(key))continue;edges.add(key);
      const d=points[to].subtract(points[from]),length=d.length();if(length<.00001)continue;
      const hit=scene.pickWithRay(new babylon.Ray(points[from],d.scale(1/length),length),m=>m===target,true);
      if(hit?.hit&&hit.distance<length-.00001)return true;
    }
  }
  return false;
}

function furnishedBalcony(t) {
  const result=furnishedServiceRooms(t);furnishHouseBalcony(result.room);
  result.room.finish().forEach(m=>m.checkCollisions=true);result.scene.meshes.forEach(m=>m.computeWorldMatrix(true));return result;
}

test("balcony furniture and transparent sliding panels fit, stay grounded and clear both tracks",t=>{
  const {scene,room}=furnishedBalcony(t),door=room.slidingDoors[0];assert.equal(door.id,'balcony-door');
  for(const m of scene.meshes.filter(m=>/^balcony-(seat|table|plants)-/.test(m.name))) {
    const b=m.getBoundingInfo().boundingBox,min=houseVector(5.45,10.85),max=houseVector(10.75,12.25);
    assert.ok(b.minimumWorld.x>=min.x-.001&&b.maximumWorld.x<=max.x+.001&&b.minimumWorld.z>=min.z-.001&&b.maximumWorld.z<=max.z+.001,`${m.name}: ${b.minimumWorld.asArray()} / ${b.maximumWorld.asArray()}`);
    assert.ok(b.minimumWorld.y>=-5.001,m.name);
  }
  for(const prefix of ['balcony-seat-','balcony-table-','balcony-plants-'])assert.ok(Math.abs(babylon.Mesh.MinMax(scene.meshes.filter(m=>m.name.startsWith(prefix))).min.y+5)<.001,prefix+' grounded');
  const glass=scene.meshes.filter(m=>m.name.includes('window-glass')&&m.metadata.ownerRooms.includes('balcony'));
  assert.equal(glass.length,2);assert.ok(glass.every(m=>m.checkCollisions&&m.material.alpha===.045&&!m.material.reflectionTexture));
  for(let step=0;step<=20;step++) {
    door.root.position.copyFrom(door.closed).addInPlace(door.travel.scale(step/20));door.root.computeWorldMatrix(true);door.root.getChildMeshes().forEach(m=>m.computeWorldMatrix(true));
    for(const leaf of door.meshes)for(const m of [...door.fixedMeshes,...scene.meshes.filter(m=>/^balcony-(seat|table|plants)-/.test(m.name))])
      assert.equal(surfacesIntersect(scene,leaf,m),false,`track collision ${m.name} at ${step}`);
  }
});

test("sliding door blocks when shut, opens for a continuous two-way balcony route and remains pickable from both faces",t=>{
  const {scene,room}=furnishedBalcony(t),door=room.slidingDoors[0],interactions=new RoomInteractions(scene,()=>{});
  interactions.addSlidingDoor(door);assert.throws(()=>interactions.addSlidingDoor(door),/Duplicate/);
  const target=babylon.Vector3.TransformCoordinates(door.closed.add(new babylon.Vector3(0,5,door.width/2)),door.root.parent.getWorldMatrix());
  const normal=babylon.Vector3.TransformNormal(babylon.Vector3.Right(),door.root.parent.getWorldMatrix()).normalize();
  const action=interactions.pick(new babylon.Ray(target.add(normal.scale(3)),normal.negate(),6));assert.ok(action);
  assert.equal(interactions.pick(new babylon.Ray(target.subtract(normal.scale(3)),normal,6)),action);
  const radius=new babylon.Vector3(HOUSE_WALKER_RADIUS,3.9,HOUSE_WALKER_RADIUS),a=houseVector(7.7,10.3,.82),b=houseVector(7.7,11.45,.82);
  assert.ok(!sweep(scene,a,b.subtract(a),radius).position.equalsWithEpsilon(b,.03));
  action.toggle();for(let i=0;i<16;i++)interactions.update(.05);assert.ok(door.root.position.equalsWithEpsilon(door.closed.add(door.travel),.001));
  const route=[[7.7,10.3],[7.7,11.45],[6.5,11.4],[7.7,11.45],[9.6,11.45]];
  for(const points of [route,[...route].reverse()])for(let i=1;i<points.length;i++) {
    const p=houseVector(...points[i-1],.82),q=houseVector(...points[i],.82);
    assert.ok(sweep(scene,p,q.subtract(p),radius).position.equalsWithEpsilon(q,.03),`${points[i-1]} → ${points[i]}`);
  }
  const fixedA=houseVector(8.8,10.3,.82),fixedB=houseVector(8.8,11.3,.82);
  assert.ok(!sweep(scene,fixedA,fixedB.subtract(fixedA),radius).position.equalsWithEpsilon(fixedB,.03),'fixed panel stays solid');
  for(const [from,to]of [[[9.6,11.45],[9.6,12.8]],[[6.5,11.4],[5,11.4]]]) {
    const p=houseVector(...from,.82),q=houseVector(...to,.82);
    assert.ok(!sweep(scene,p,q.subtract(p),radius).position.equalsWithEpsilon(q,.03),'outer safety rail');
  }
});

test("sliding sweep pauses before the walker, reverses smoothly, refreshes only its rooms and releases sound/actions",t=>{
  const {scene,room}=furnishedBalcony(t),door=room.slidingDoors[0],events=[],refresh=[];let walker;
  const interactions=new RoomInteractions(scene,ids=>refresh.push(...ids),()=>walker,e=>events.push(e));interactions.addSlidingDoor(door);
  const state=interactions.slidingDoors[0];state.open=true;
  for(let i=0;i<16;i++)interactions.update(.05);
  walker=houseVector(7.7,10.8,1.6);assert.equal(slidingDoorSweepIsClear(door,1,0,walker),false);
  state.open=false;for(let i=0;i<16;i++)interactions.update(.05);
  assert.ok(state.blocked&&state.progress>0&&state.progress<1);const paused=door.root.position.clone();
  interactions.update(.05);assert.ok(door.root.position.equals(paused));assert.equal(state.moving,false);
  state.open=true;for(let i=0;i<16;i++)interactions.update(.05);assert.equal(state.progress,1);
  walker=undefined;state.open=false;interactions.update(.05);const middle=door.root.position.clone();interactions.silenceMotion();
  assert.ok(door.root.position.equals(middle)&&!state.moving);for(let i=0;i<16;i++)interactions.update(.05);assert.equal(state.progress,0);
  assert.ok(door.root.position.equalsWithEpsilon(door.closed,.001));assert.deepEqual([...new Set(refresh)].sort(),['balcony','living']);
  assert.ok(events.some(e=>e.cue==='door-move')&&events.some(e=>e.cue==='door-latch'));assert.equal(events.filter(e=>e.cue==='door-latch').length,1);
  interactions.removeRoom('living');assert.equal(interactions.slidingDoors.length,1);
  interactions.removeRoom('balcony');assert.equal(interactions.slidingDoors.length,0);assert.equal(interactions.entities.size,0);assert.equal(events.at(-1).cue,'stop');
});

test("the fully furnished house has a continuous entrance-to-every-room-and-balcony walking tour",async t=>{
  const {scene,room}=await furnishedHouse(t);
  furnishHouseMaster(room);furnishHouseEnsuite(room);furnishHouseBedroom(room);
  furnishHouseKitchen(room);furnishHouseBathroom(room);furnishHouseBalcony(room);
  room.finish().forEach(m=>m.checkCollisions=true);scene.meshes.forEach(m=>m.computeWorldMatrix(true));
  const interactions=new RoomInteractions(scene,()=>{});room.doors.forEach(d=>interactions.addDoor(d));room.slidingDoors.forEach(d=>interactions.addSlidingDoor(d));
  interactions.doors.forEach(s=>s.open=s.door.id!=='entry-door');interactions.slidingDoors.forEach(s=>s.open=true);
  for(let i=0;i<16;i++)interactions.update(.05);
  const suite=[[6.6,4.05],[4.3,4.05],[3.4,4.05],[1.2,4.05],[1.2,5.6],[1.45,5.9],[1.55,6.25],[1.55,6.8]];
  const wet=[[6.6,6],[4.8,6],[4.5,6.45],[4.5,6.85]];
  const route=[[9.4,5.35],[9.25,4.6],[9.55,3.8],[9.6,2.2],[9.6,1.05],[9.6,2.2],[9.55,3.8],[9.25,4.6],[9.4,5.55],[7,5.55],
    [7,4.7],[6.65,4.2],[6.65,2.7],[6.65,4.2],[7,4.7],...suite,...[...suite].reverse().slice(1),[7,4.7],[7,5.55],...wet,
    ...[...wet].reverse().slice(1),[7,6.6],[7,8.3],[7,9.15],[4.5,9.15],[3.4,9.15],[3.4,8.35],[4.15,8.35],[3.4,8.35],[3.4,9.15],[4.5,9.15],[7,9.15],
    [7,10.3],[7.7,10.3],[7.7,11.45],[6.5,11.4],[7.7,11.45],[9.6,11.45]];
  const radius=new babylon.Vector3(HOUSE_WALKER_RADIUS,3.9,HOUSE_WALKER_RADIUS),visited=new Set();let position=houseVector(...route[0],.82);
  for(let i=0;i<route.length;i++) {
    const r=HOUSE_ROOMS.find(r=>route[i][0]>r.x&&route[i][0]<r.x+r.width&&route[i][1]>r.y&&route[i][1]<r.y+r.depth);if(r)visited.add(r.id);
    if(!i)continue;const q=houseVector(...route[i],.82),actual=sweep(scene,position,q.subtract(position),radius).position;position=actual;
    assert.ok(actual.equalsWithEpsilon(q,.03),`tour ${route[i-1]} → ${route[i]} at ${actual.asArray()}`);
  }
  assert.deepEqual([...visited].sort(),HOUSE_ROOMS.map(r=>r.id).sort());
});

test("kitchen and public bathroom fit the unchanged shell, ground their fixtures and share downloaded textures",t=>{
  const {scene,room}=furnishedSuite(t),textures=scene.textures.slice();
  furnishHouseKitchen(room);furnishHouseBathroom(room);room.finish();assert.deepEqual(scene.textures,textures);
  for(const m of scene.meshes.filter(m=>/^(kitchen-(sink-run|cooker-run|fridge)-|bathroom-(vanity|toilet|shower|tiles)-)/.test(m.name))) {
    const r=HOUSE_ROOMS.find(r=>r.id===m.metadata.ownerRooms[0]),b=m.getBoundingInfo().boundingBox;
    const min=houseVector(r.x+.05,r.y+.05),max=houseVector(r.x+r.width-.05,r.y+r.depth-.05);
    assert.ok(b.minimumWorld.x>=min.x-.001&&b.maximumWorld.x<=max.x+.001&&b.minimumWorld.z>=min.z-.001&&b.maximumWorld.z<=max.z+.001,m.name);
    assert.ok(b.minimumWorld.y>=-5.001&&b.maximumWorld.y<9,m.name);
  }
  for(const prefix of ['kitchen-sink-run-','kitchen-cooker-run-','kitchen-fridge-','bathroom-vanity-','bathroom-toilet-'])
    assert.ok(Math.abs(babylon.Mesh.MinMax(scene.meshes.filter(m=>m.name.startsWith(prefix))).min.y+5)<.001,prefix+' grounded');
});

test("service entrances and usable counter, toilet, vanity and shower paths pass in both directions",t=>{
  const {scene,room}=furnishedServiceRooms(t),interactions=new RoomInteractions(scene,()=>{});
  room.doors.forEach(d=>interactions.addDoor(d));
  interactions.doors.forEach(s=>s.open=['kitchen-door','bathroom-door'].includes(s.door.id));
  for(let i=0;i<16;i++)interactions.update(.05);
  const radius=new babylon.Vector3(HOUSE_WALKER_RADIUS,3.9,HOUSE_WALKER_RADIUS);
  const routes=[[[9.55,4.1],[9.55,2.9],[9.6,2.2],[9.6,1.05]],
    [[6.2,6],[4.8,6],[4.5,6.45],[4.5,6.85]],
    [[4.8,6],[3.9,5.9],[3.35,5.9],[3.35,5.4]]];
  for(const route of routes)for(const points of [route,[...route].reverse()])for(let i=1;i<points.length;i++) {
    const p=houseVector(...points[i-1],.82),q=houseVector(...points[i],.82),actual=sweep(scene,p,q.subtract(p),radius).position;
    assert.ok(actual.equalsWithEpsilon(q,.03),`${points[i-1]} → ${points[i]} at ${actual.asArray()}`);
  }
  for(const [from,to]of [[[9.6,1.1],[9.6,.3]],[[9.6,1.8],[10.6,1.8]],[[9.6,1.5],[8.7,1.5]],[[3.4,5.9],[3.4,6.6]]]) {
    const p=houseVector(...from,.82),q=houseVector(...to,.82);
    assert.ok(!sweep(scene,p,q.subtract(p),radius).position.equalsWithEpsilon(q,.03),'solid counter/fridge/glass');
  }
  const furniture=scene.meshes.filter(m=>/^(kitchen-(sink-run|cooker-run|fridge)-|bathroom-(vanity|toilet|shower)-)/.test(m.name));
  for(const door of room.doors.filter(d=>['kitchen-door','bathroom-door'].includes(d.id)))for(let step=0;step<=20;step++) {
    door.root.rotation.y=door.openAngle*step/20;door.root.computeWorldMatrix(true);door.meshes.forEach(m=>m.computeWorldMatrix(true));
    for(const leaf of door.meshes)for(const m of furniture)assert.equal(surfacesIntersect(scene,leaf,m),false,door.id+' hits '+m.name);
  }
});

test("service lamps isolate their rooms, avoid self-occlusion and keep two independent real bathroom mirrors",t=>{
  const {scene,room}=furnishedServiceRooms(t),lighting=new RoomLighting(scene,true);
  lighting.addMasterSuite(scene);lighting.addServiceRooms(scene);lighting.addMeshes(scene.meshes);
  const touched=[];scene.lights.filter(l=>l.getShadowGenerator?.()).forEach(l=>l.getShadowGenerator().getShadowMap().resetRefreshCounter=()=>touched.push(l.metadata.ownerRooms[0]));
  for(const owner of ['kitchen','bathroom']) {
    const id=owner+'-lamp',material=scene.getMaterialByName(id+'-glow'),glow=material.emissiveColor.clone(),light=scene.getLightByName(id+'-light');
    lighting.bindLamp(id,material);touched.length=0;const intensities=scene.lights.map(l=>l.intensity);
    lighting.toggleLamp(id);assert.ok(material.emissiveColor.equals(babylon.Color3.Black()));assert.deepEqual([...new Set(touched)],[owner]);
    assert.ok(scene.lights.every((l,i)=>l===light?l.intensity===0:l.intensity===intensities[i]));lighting.toggleLamp(id);assert.ok(material.emissiveColor.equals(glow));
    assert.ok(!scene.pickWithRay(new babylon.Ray(light.position,light.direction,1),m=>room.lamps.find(l=>l.id===id).meshes.includes(m))?.hit,id);
    for(const m of scene.meshes.filter(m=>m.getTotalVertices()&&m.metadata.ownerRooms.length===1&&!m.metadata.ownerRooms.includes(owner)))assert.ok(light.excludedMeshes.includes(m));
  }
  new RoomMirrors(scene);const mirrors=scene.meshes.filter(m=>m.metadata?.mirrorPlane);
  assert.equal(mirrors.length,2);assert.notEqual(mirrors[0].material.reflectionTexture,mirrors[1].material.reflectionTexture);
  const bath=mirrors.find(m=>m.metadata.reflectionRoom==='bathroom'),target=bath.material.reflectionTexture;
  assert.equal(target.noPrePassRenderer,true);assert.equal(target.getSize().width,512);
  assert.ok(target.mirrorPlane.signedDistanceTo(houseVector(3.4,5.4,1.6))<0);
  assert.ok(target.renderList.every(m=>!m.metadata?.mirrorPlane&&!m.metadata?.collisionOnly&&m.metadata.ownerRooms.some(id=>['bathroom','living'].includes(id))));
  lighting.removeRoom('bathroom');assert.equal(scene.getLightByName('bathroom-lamp-light'),null);assert.equal(lighting.isLampOn('kitchen-lamp'),true);
});

test("guest bedroom reuses textures, fits its shell and grounds the bed, storage and window seat", t => {
  const { scene, room } = furnishedSuite(t), textures = scene.textures.slice();
  furnishHouseBedroom(room); room.finish();
  assert.deepEqual(scene.textures, textures, 'existing linen, wood, curtains and maps are shared');
  assert.equal(scene.materials.filter(m => m.name === 'bedroom-lamp-glow').length, 1);
  for (const m of scene.meshes.filter(m => /^bedroom-(bed-|nightstand-|wardrobe-|reading-seat-)/.test(m.name))) {
    const b = m.getBoundingInfo().boundingBox;
    assert.deepEqual(m.metadata.ownerRooms, ['bedroom']);
    assert.ok(b.minimumWorld.x >= houseVector(.05,7.25).x-.001 && b.maximumWorld.x <= houseVector(5.35,10.75).x+.001, m.name);
    assert.ok(b.minimumWorld.z >= houseVector(.05,7.25).z-.001 && b.maximumWorld.z <= houseVector(5.35,10.75).z+.001, m.name);
    assert.ok(b.minimumWorld.y >= -5.001 && b.maximumWorld.y <= 9, m.name);
  }
  for (const prefix of ['bedroom-bed-', 'bedroom-nightstand-', 'bedroom-wardrobe-', 'bedroom-reading-seat-'])
    assert.ok(Math.abs(babylon.Mesh.MinMax(scene.meshes.filter(m=>m.name.startsWith(prefix))).min.y+5)<.001, prefix+' grounded');
});

test("guest bedroom allows both bedside paths, wardrobe access and the full entrance door sweep", t => {
  const { scene, room, architecture } = furnishedBedroom(t), interactions = new RoomInteractions(scene, () => {});
  room.doors.forEach(d => interactions.addDoor(d));
  interactions.doors.find(s=>s.door.id==='bedroom-door').open=true;
  for(let i=0;i<16;i++)interactions.update(.05);
  const radius=new babylon.Vector3(HOUSE_WALKER_RADIUS,3.9,HOUSE_WALKER_RADIUS);
  const routes=[[[6.6,9.15],[4.5,9.15],[3.4,9.15],[3.4,8.35],[4.15,8.35]],
    [[4.5,9.15],[4.5,10.25],[2.1,10.25],[.95,10.25],[.95,9],[.95,8.35]]];
  for(const route of routes)for(const points of [route,[...route].reverse()])for(let i=1;i<points.length;i++) {
    const p=houseVector(...points[i-1],.82),q=houseVector(...points[i],.82);
    assert.ok(sweep(scene,p,q.subtract(p),radius).position.equalsWithEpsilon(q,.03),`${points[i-1]} → ${points[i]}`);
  }
  for(const [from,to]of [[[3.4,9],[2.1,9]],[[4.15,8.35],[4.15,7.6]],[[.95,9],[.35,9]]]) {
    const p=houseVector(...from,.82),q=houseVector(...to,.82);
    assert.ok(!sweep(scene,p,q.subtract(p),radius).position.equalsWithEpsilon(q,.03),'solid guest furniture');
  }
  const door=room.doors.find(d=>d.id==='bedroom-door');
  const furniture=scene.meshes.filter(m=>/^bedroom-(bed-|nightstand-|wardrobe-|reading-seat-)/.test(m.name));
  for(let step=0;step<=20;step++) {
    door.root.rotation.y=door.openAngle*step/20;door.root.computeWorldMatrix(true);
    door.meshes.forEach(m=>m.computeWorldMatrix(true));
    for(const leaf of door.meshes)for(const m of furniture)assert.equal(leaf.intersectsMesh(m,true),false,m.name+' door sweep');
  }
  architecture.setEnclosed(false,'bedroom');
  architecture.updateCutaway(houseVector(5.1,13.1,4.7),houseVector(2.7,9,.7));
  assert.ok(architecture.upperWalls.some(m=>m.isVisible&&m.metadata.ownerRooms.includes('bedroom')));
  assert.ok(architecture.upperWalls.every(m=>!m.isVisible||m.metadata.ownerRooms.includes('bedroom')));
});

test("guest lamp controls only its room, emits outside its fixture and releases its two shadow targets", t => {
  const { scene, room }=furnishedBedroom(t), lighting=new RoomLighting(scene,true);
  lighting.addMasterSuite(scene);lighting.addBedroom(scene);lighting.addMeshes(scene.meshes);
  const material=scene.getMaterialByName('bedroom-lamp-glow');lighting.bindLamp('bedroom-lamp',material);
  const before=scene.lights.map(l=>l.intensity),touched=[];
  scene.lights.filter(l=>l.getShadowGenerator?.()).forEach(l=>l.getShadowGenerator().getShadowMap().resetRefreshCounter=()=>touched.push(l.metadata.ownerRooms[0]));
  lighting.toggleLamp('bedroom-lamp');assert.equal(lighting.isLampOn('bedroom-lamp'),false);
  assert.ok(material.emissiveColor.equals(babylon.Color3.Black()));assert.deepEqual([...new Set(touched)],['bedroom']);
  assert.ok(scene.lights.every((l,i)=>l.intensity===(l.name==='bedroom-lamp-light'?0:before[i])));
  lighting.toggleLamp('bedroom-lamp');assert.ok(!material.emissiveColor.equals(babylon.Color3.Black()));
  const lamp=scene.getLightByName('bedroom-lamp-light'),day=scene.getLightByName('bedroom-window-daylight');
  assert.equal(lamp.getShadowGenerator().getShadowMap().getSize().width,512);
  assert.equal(day.getShadowGenerator().getShadowMap().getSize().width,1024);
  assert.ok(!scene.pickWithRay(new babylon.Ray(lamp.position,lamp.direction,1),m=>room.lamps.find(l=>l.id==='bedroom-lamp').meshes.includes(m))?.hit);
  for(const m of scene.meshes.filter(m=>m.getTotalVertices()&&m.metadata.ownerRooms.length===1&&m.metadata.ownerRooms[0]!=='bedroom'))
    assert.ok(lamp.excludedMeshes.includes(m)&&day.excludedMeshes.includes(m));
  const targets=[lamp,day].map(l=>l.getShadowGenerator().getShadowMap());lighting.removeRoom('bedroom');
  assert.ok(targets.every(t=>!scene.textures.includes(t)));assert.equal(scene.getLightByName('bedroom-lamp-light'),null);
});

test("suite components fit inside their rooms, meet the floor and share materials with the second bedroom/bathroom", t => {
  const { scene } = furnishedSuite(t);
  for (const mesh of scene.meshes.filter(m => /^(master-(bed|nightstand|wardrobe|accessories)|ensuite-(vanity|toilet|shower|tiles))/.test(m.name))) {
    const owner = mesh.metadata.ownerRooms[0], r = HOUSE_ROOMS.find(r => r.id === owner), b = mesh.getBoundingInfo().boundingBox;
    const min = houseVector(r.x + .05, r.y + .05), max = houseVector(r.x + r.width - .05, r.y + r.depth - .05);
    assert.ok(b.minimumWorld.x >= min.x - .001 && b.maximumWorld.x <= max.x + .001 && b.minimumWorld.z >= min.z - .001 && b.maximumWorld.z <= max.z + .001, mesh.name);
    assert.ok(b.minimumWorld.y >= -5.001 && b.maximumWorld.y <= 9, mesh.name);
  }
  for (const prefix of ['master-bed-', 'master-nightstand-', 'master-wardrobe-', 'ensuite-vanity-', 'ensuite-toilet-']) {
    const meshes = scene.meshes.filter(m => m.name.startsWith(prefix));
    assert.ok(meshes.length); assert.ok(Math.abs(babylon.Mesh.MinMax(meshes).min.y + 5) < .001, prefix + ' grounded');
  }
  const before = { materials: scene.materials.length, textures: scene.textures.length };
  const other = new RoomFurnishings(scene, 'bedroom');
  bedroomBed(other, 'bedroom', { x: 2.7, y: 1.5 }, 1.5);
  bedroomWardrobe(other, 'bedroom', { x: 4.9, y: 1.5 }, 2.2, -Math.PI/2);
  bathroomVanity(other, 'bathroom', { x: 2.6, y: .6 }, 1, -Math.PI/2);
  bathroomToilet(other, 'bathroom', { x: .5, y: 1 });
  bathroomShower(other, 'bathroom', { x: 1.5, y: 1.9 }, 2.6, .8);
  assert.deepEqual({ materials: scene.materials.length, textures: scene.textures.length }, before);
  const glass = scene.getMaterialByName('bath-glass');
  assert.equal(glass.backFaceCulling, false); assert.equal(glass.alpha, .2);
  assert.ok(scene.meshes.some(m => m.name.startsWith('ensuite-shower') && m.material === glass && m.checkCollisions));
});

test("suite has continuous bed-side, wardrobe and private bathroom/shower routes with solid glass and furniture", t => {
  const { scene, room } = furnishedSuite(t), interactions = new RoomInteractions(scene, () => {});
  room.doors.forEach(d => interactions.addDoor(d));
  interactions.doors.forEach(s => s.open = ['master-door', 'ensuite-door'].includes(s.door.id));
  for (let i = 0; i < 16; i++) interactions.update(.05);
  const radius = new babylon.Vector3(HOUSE_WALKER_RADIUS, 3.9, HOUSE_WALKER_RADIUS);
  const routes = [
    [[6.6,4.05],[4.3,4.05],[3.4,4.05],[1.2,4.05],[1.2,5.6],[1.45,5.9],[1.8,6.25],[1.8,6.8]],
    [[4.3,4.05],[4,3.3],[4,1.65],[3.3,1.65],[3.3,.7],[1.8,.7],[1.8,1.0]],
    [[3.4,4.05],[3.2,3.5],[1.3,3.5]],
  ];
  for (const route of routes) for (let i = 1; i < route.length; i++) {
    const p = houseVector(...route[i - 1], .82), q = houseVector(...route[i], .82);
    const actual = sweep(scene, p, q.subtract(p), radius).position;
    assert.ok(actual.equalsWithEpsilon(q, .03), `${route[i-1]} → ${route[i]} blocked at ${actual.asArray()}`);
  }
  for (const [from,to] of [ [[.7,6],[.7,6.6]], [[3.4,2.3],[1.5,2.3]], [[4,1.6],[5.25,1.6]], [[2.8,6],[1.8,6]] ]) {
    const p = houseVector(...from, .82), q = houseVector(...to, .82);
    assert.ok(!sweep(scene, p, q.subtract(p), radius).position.equalsWithEpsilon(q, .03), `solid obstacle ${from} → ${to}`);
  }
  assert.deepEqual(HOUSE_DOORS.filter(d => d.from === 'ensuite' || d.to === 'ensuite').map(d=>d.id), ['ensuite-door']);
});

test("suite furniture clears both door sweeps at every angle and cutaway retains glass collision", t => {
  const { scene, room, architecture } = furnishedSuite(t);
  const meshes = scene.meshes.filter(m => /^(master-(bed|nightstand|wardrobe)|ensuite-(vanity|toilet|shower))/.test(m.name));
  for (const door of room.doors.filter(d => ['master-door','ensuite-door'].includes(d.id))) {
    for (let step = 0; step <= 20; step++) {
      door.root.rotation.y = door.openAngle * step / 20; door.root.computeWorldMatrix(true);
      door.meshes.forEach(m=>m.computeWorldMatrix(true));
      for (const leaf of door.meshes) for (const furniture of meshes)
        assert.equal(leaf.intersectsMesh(furniture, true), false, `${door.id} hits ${furniture.name} at ${step}`);
    }
  }
  architecture.setEnclosed(false, 'master');
  architecture.updateCutaway(houseVector(6.4,6.3,4.7),houseVector(2.5,2.2,.7));
  assert.ok(architecture.upperWalls.some(m=>m.isVisible&&m.metadata.ownerRooms.includes('master')));
  assert.ok(architecture.upperWalls.every(m=>!m.isVisible||m.metadata.ownerRooms.includes('master')));
  const glass = scene.meshes.find(m=>m.material?.name==='bath-glass');
  assert.ok(glass.isVisible&&glass.checkCollisions);
  architecture.setEnclosed(true); assert.ok(architecture.ceilings.every(m=>m.isVisible));
});

test("suite lamps have isolated emissive/light state, room masks and shadow invalidation", t => {
  const { scene, room } = furnishedSuite(t), lights = new RoomLighting(scene,true);
  lights.addLivingRoom(scene,true); lights.addMasterSuite(scene); lights.addMeshes(scene.meshes);
  room.lamps.forEach(l=>lights.bindLamp(l.id,scene.getMaterialByName(l.id+'-glow')));
  const touched=[];
  scene.lights.filter(l=>l.getShadowGenerator?.()).forEach(l=>l.getShadowGenerator().getShadowMap().resetRefreshCounter=()=>touched.push(l.metadata.ownerRooms[0]));
  for (const [id,owner] of [['master-lamp','master'],['ensuite-lamp','ensuite']]) {
    const intensity = scene.lights.map(l=>l.intensity), material=scene.getMaterialByName(id+'-glow'), glow=material.emissiveColor.clone();
    lights.toggleLamp(id); assert.equal(lights.isLampOn(id),false); assert.ok(material.emissiveColor.equals(babylon.Color3.Black()));
    assert.deepEqual([...new Set(touched)], [owner]); touched.length=0;
    assert.ok(scene.lights.every((l,i)=>l.name===id+'-light'?l.intensity===0:l.intensity===intensity[i]));
    lights.toggleLamp(id); assert.ok(material.emissiveColor.equals(glow)); touched.length=0;
  }
  const main=scene.getLightByName('master-window-daylight'), bath=scene.getLightByName('ensuite-lamp-light');
  for(const id of ['master-lamp','ensuite-lamp']) {
    const light=scene.getLightByName(id+'-light');
    const ray=new babylon.Ray(light.position,light.direction,1);
    const fixture=room.lamps.find(l=>l.id===id);
    const hit=scene.pickWithRay(ray,m=>fixture.meshes.includes(m));
    assert.ok(!hit?.hit, id+' must emit outside its opaque fixture');
  }
  for(const mesh of scene.meshes.filter(m=>m.getTotalVertices()&&m.metadata.ownerRooms.length===1)) {
    const id=mesh.metadata.ownerRooms[0];
    if(id==='ensuite')assert.ok(main.excludedMeshes.includes(mesh));
    if(id==='master')assert.ok(bath.excludedMeshes.includes(mesh));
  }
  lights.removeRoom('master');
  assert.equal(scene.getLightByName('master-lamp-light'),null); assert.equal(lights.isLampOn('ensuite-lamp'),true);
});

async function furnishedHouse(t) {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  const architecture = createHouseArchitecture(scene, room);
  furnishHouseStudy(room); furnishHouseLiving(room); room.finish().forEach(m => m.checkCollisions = true);
  const imported = {};
  for (const [file, id, owner, a] of [
    ["study/sofa_03", "reading-sofa", "living", HOUSE_CONTENT.readingSofa],
    ["study/modern_arm_chair_01", "reading-armchair", "living", HOUSE_CONTENT.readingChair],
    ["gothic_commode", "antique-cabinet", "living", HOUSE_CONTENT.cabinet],
    ["wooden_bookshelf", "antique-bookshelf", "study", HOUSE_CONTENT.bookshelf],
  ]) {
    const source = new Uint8Array(fs.readFileSync(path.join(__dirname, `../public/models/${file}.glb`)));
    const result = await babylon.ImportMeshAsync(source, scene, { pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } } });
    result.meshes.forEach(m => setRoomOwners(m, [owner]));
    const placement = placeFurniture(result.meshes, scene, id, houseVector(a.x, a.y), a.width, id === "antique-bookshelf" ? 0 : a.rotation, owner);
    if (id === "antique-bookshelf") {
      const books = room.furnishBookshelf(result.meshes);
      books.forEach(m => { m.unfreezeWorldMatrix(); m.setParent(placement); m.checkCollisions = true; });
      placement.unfreezeWorldMatrix(); const nodes = placement.getDescendants(false); nodes.forEach(n => n.unfreezeWorldMatrix());
      placement.rotation.y = a.rotation; placement.computeWorldMatrix(true);
      nodes.forEach(n => { n.computeWorldMatrix(true); n.freezeWorldMatrix(); }); placement.freezeWorldMatrix();
      imported.books = books;
    }
    imported[id] = result.meshes;
  }
  room.drawers.push(...cabinetDrawers(imported["antique-cabinet"]));
  scene.meshes.forEach(m => m.computeWorldMatrix(true)); scene.collisionsEnabled = true;
  return { scene, room, architecture, imported };
}

test("migrated furniture, open drawers and bookshelf contents fit the real room bounds", async t => {
  const { scene, room, imported } = await furnishedHouse(t);
  assert.equal(room.drawers.length, 8); assert.equal(room.lamps.length, 3); assert.equal(room.inspectables[0].id, "desk-letter");
  const interactions = new RoomInteractions(scene, () => {}); room.drawers.forEach(d => interactions.addDrawer(d));
  interactions.drawers.forEach(d => d.open = true);
  for (let i = 0; i < 12; i++) interactions.update(.05);
  for (const mesh of scene.meshes.filter(m => m.getTotalVertices() && (m.name.startsWith("study-content") || m.name.startsWith("living-content") || m.metadata?.interactionId?.includes("drawer") || Object.values(imported).some(parts => parts.includes(m))))) {
    const id = mesh.metadata.ownerRooms[0], r = HOUSE_ROOMS.find(r => r.id === id), box = mesh.getBoundingInfo().boundingBox;
    const min = houseVector(r.x + .05, r.y + .05), max = houseVector(r.x + r.width - .05, r.y + r.depth - .05);
    assert.ok(box.minimumWorld.x >= min.x - .01 && box.maximumWorld.x <= max.x + .01 && box.minimumWorld.z >= min.z - .01 && box.maximumWorld.z <= max.z + .01,
      `${mesh.name} crosses ${id} boundary: ${box.minimumWorld.asArray()} / ${box.maximumWorld.asArray()}`);
    assert.ok(box.minimumWorld.y >= -5.01 && box.maximumWorld.y < 9, `${mesh.name} must fit between floor and ceiling`);
  }
  const shelf = babylon.Mesh.MinMax(imported["antique-bookshelf"].filter(m => m.getTotalVertices()));
  assert.ok(Math.abs(shelf.min.y + 5) < .001); assert.ok(shelf.max.x < 14.75);
  assert.ok(imported.books.length && imported.books.every(m => m.getBoundingInfo().boundingBox.maximumWorld.x <= shelf.max.x + .01));
});

test("furnished house keeps the living spine and each doorway physically reachable", async t => {
  const { scene, room } = await furnishedHouse(t), interactions = new RoomInteractions(scene, () => {});
  room.doors.forEach(d => interactions.addDoor(d)); interactions.doors.forEach(s => s.open = s.door.id !== "entry-door");
  room.slidingDoors.forEach(d=>interactions.addSlidingDoor(d));interactions.slidingDoors.forEach(s=>s.open=true);
  for (let i = 0; i < 16; i++) interactions.update(.05);
  const radius = new babylon.Vector3(HOUSE_WALKER_RADIUS, 3.9, HOUSE_WALKER_RADIUS);
  const route = [[9.4,5.35],[9.25,4.6],[9.55,3.8],[9.55,2.6],[9.55,3.8],[9.25,4.6],[9.4,5.55],[7,5.55],[7,4.7],[7,6.6],[7,8.3],[7,10.3],[7.7,10.3],[7.7,11.6]];
  for (let i = 1; i < route.length; i++) {
    const start = houseVector(...route[i - 1], .82), end = houseVector(...route[i], .82);
    const actual = sweep(scene, start, end.subtract(start), radius).position;
    assert.ok(actual.equalsWithEpsilon(end, .03), `route ${route[i - 1]} → ${route[i]} blocked at ${actual.asArray()}`);
  }
  // Private rooms and compact study are reached from the clear western spine.
  for (const [start, end] of [ [[6.6,4.05],[4.5,4.05]], [[6.6,6],[4.5,6]], [[7,9.15],[4.5,9.15]], [[6.65,4.2],[6.65,2.6]], [[1.2,4],[1.2,5.6]] ]) {
    const p = houseVector(...start, .82), q = houseVector(...end, .82);
    assert.ok(sweep(scene, p, q.subtract(p), radius).position.equalsWithEpsilon(q, .03), `door route ${start} → ${end}`);
  }
});

test("migrated lights stay below their actual shades and refresh only affected room shadows", t => {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  furnishHouseStudy(room); furnishHouseLiving(room);
  const lights = new RoomLighting(scene, true); lights.addLivingRoom(scene, true);
  scene.meshes.forEach(m => m.computeWorldMatrix(true));
  for (const [lightName, shadeName] of [["banker-lamp-light", "banker-green-shade"], ["reading-lamp-light", "linen-lampshade"], ["living-table-lamp-light", "living-lamp-shade"]]) {
    const light = scene.getLightByName(lightName), shade = scene.getMeshByName(shadeName).getBoundingInfo().boundingBox;
    assert.ok(light.position.y < shade.minimumWorld.y && shade.minimumWorld.y - light.position.y < .1, lightName);
    assert.ok(Math.abs(light.position.x - shade.centerWorld.x) < .01 && Math.abs(light.position.z - shade.centerWorld.z) < .01);
  }
  const touched = [];
  scene.lights.filter(l => l.getShadowGenerator?.()).forEach(l => l.getShadowGenerator().getShadowMap().resetRefreshCounter = () => touched.push(l.metadata.ownerRooms[0]));
  lights.refreshShadows(["study"]); assert.deepEqual([...new Set(touched)], ["study"]);
  touched.length = 0; lights.refreshShadows(["living"]); assert.deepEqual([...new Set(touched)], ["living"]);
});

function houseShell(t) {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  const architecture = createHouseArchitecture(scene, room);
  room.finish().forEach(m => m.checkCollisions = true);
  scene.meshes.forEach(m => m.computeWorldMatrix(true)); scene.collisionsEnabled = true;
  return { scene, room, architecture };
}

test("house spans deduplicate shared edges, split T junctions and leave full-height doorway gaps", () => {
  const spans = houseWallSpans();
  for (const [i, a] of spans.entries()) for (const b of spans.slice(i + 1)) {
    if (a.axis !== b.axis || Math.abs(a.at - b.at) > 1e-6) continue;
    const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
    assert.ok(overlap < 1e-6 || Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) < 1e-6, "no doubled wall volume");
  }
  for (const d of HOUSE_DOORS) {
    const spansAtDoor = spans.filter(s => s.opening === d.id);
    assert.ok(spansAtDoor.length); assert.ok(spansAtDoor.every(s => s.bottom >= 2.2));
    assert.deepEqual(spansAtDoor[0].owners, [d.from, d.to].filter(id => id !== "outside").sort());
  }
  assert.ok(!HOUSE_WINDOWS.some(w => w.room === "bathroom"));
  assert.ok(!spans.some(s => s.owners.length === 1 && s.owners[0] === "living" && s.at > 5.4 && s.at < 10.8 && s.axis === "y"), "no corridor partition");
});

test("all house doors block when closed and pass the actual walker in both directions when open", t => {
  const { scene, room, architecture } = houseShell(t);
  const interactions = new RoomInteractions(scene, () => {});
  room.doors.forEach(d => interactions.addDoor(d));
  const radius = new babylon.Vector3(HOUSE_WALKER_RADIUS, 3.9, HOUSE_WALKER_RADIUS);
  room.slidingDoors.forEach(d=>interactions.addSlidingDoor(d));
  const check = (d, open) => {
    const axis = d.axis === "x" ? "z" : "x";
    const centre = houseVector(d.x + (d.axis === "x" ? d.width * (d.sliding ? .25 : .5) : 0), d.y + (d.axis === "y" ? d.width / 2 : 0), 0.82);
    for (const side of [-1, 1]) {
      const start = centre.clone(); start[axis] += side * 4;
      const travel = babylon.Vector3.Zero(); travel[axis] = -side * 8;
      const result = sweep(scene, start, travel, radius).position;
      assert.ok(open ? Math.abs(result[axis] - centre[axis] + side * 4) < 0.03 : side * (result[axis] - centre[axis]) > (d.sliding ? 1 : 1.2),
        `${d.id} ${open ? "open" : "closed"}, direction ${side}: ${result[axis]}`);
    }
  };
  const indoor = HOUSE_DOORS.filter(d => d.to !== "outside" && !d.sliding);
  indoor.forEach(d => check(d, false)); check(HOUSE_DOORS.find(d=>d.sliding),false);
  interactions.doors.forEach(s => s.open = s.door.id !== "entry-door");
  interactions.slidingDoors.forEach(s=>s.open=true);
  for (let i = 0; i < 16; i++) interactions.update(0.05);
  indoor.forEach(d => check(d, true));
  check(HOUSE_DOORS.find(d => d.sliding), true);
  architecture.setEnclosed(false);
  indoor.forEach(d => check(d, true));
  assert.ok(architecture.upperWalls.every(m => !m.isVisible && m.checkCollisions && m.isEnabled()));
  assert.equal(scene.meshes.filter(m => m.metadata?.structure === "floor").length, 8);
  for (const [x, y, dx, dz] of [[2, 1, -20, 0], [8, 12, 0, 10], [10, 4.65, 10, 0]]) {
    const start = houseVector(x, y, 0.82), result = sweep(scene, start, new babylon.Vector3(dx, 0, dz), radius).position;
    assert.ok(result.subtract(start).length() < Math.hypot(dx, dz) - 1, "outer walls, balcony and entry boundary must stop the walker");
  }
});

test("mounted door sweep protection uses the fixed yaw and the house walker radius", t => {
  const { room } = houseShell(t);
  for (const door of room.doors) {
    const parent = door.root.parent, local = new babylon.Vector3(-door.openAngle > 0 ? -1.5 : 1.5, 0, door.width * .75);
    const walker = babylon.Vector3.TransformCoordinates(local, parent.computeWorldMatrix(true));
    assert.equal(doorSweepIsClear(door, 0, 1, walker), false, door.id);
    local.x *= -1;
    assert.equal(doorSweepIsClear(door, 0, 1, babylon.Vector3.TransformCoordinates(local, parent.getWorldMatrix())), true, door.id);
  }
});

test("cutaway follows camera direction and hides attached art while retaining wall collisions", t => {
  const { scene, architecture } = houseShell(t);
  architecture.setEnclosed(false, "study");
  architecture.updateCutaway(houseVector(4.4, 4.2, 4.4), houseVector(6.9, 1.8, .5));
  const westArt = scene.meshes.filter(m => m.name.startsWith("study-wall-art"));
  assert.ok(westArt.length && westArt.every(m => !m.isVisible));
  const north = architecture.upperWalls.filter(m => m.metadata.span?.owners.includes("study") && m.metadata.span?.axis === "x" && m.metadata.span.at === 0);
  assert.ok(north.length && north.every(m => m.isVisible && m.checkCollisions));
  architecture.updateCutaway(houseVector(9, -1, 4), houseVector(6.9, 1.8, .5));
  assert.ok(north.every(m => !m.isVisible && m.checkCollisions));
  assert.ok(westArt.every(m => m.isVisible));
  architecture.setEnclosed(true);
  assert.ok(architecture.upperWalls.every(m => m.isVisible) && architecture.ceilings.every(m => m.isVisible));
});

test("outer guard preserves eye height and rejects the balcony concave outside corner", () => {
  const previous = houseVector(5, 10, 1.6), current = houseVector(4, 11.5, 9);
  constrainHouseWalking(current, previous); assert.ok(current.equals(houseVector(5, 10, 1.6)));
  for (const r of HOUSE_ROOMS) {
    const p = houseVector(r.x + r.width / 2, r.y + r.depth / 2, 7);
    constrainHouseWalking(p, previous); assert.equal(p.y, 3);
  }
});

test("failed shared material initialization cleans only its new resources and can retry", t => {
  const scene = createScene(t), existing = new babylon.StandardMaterial("existing", scene);
  assert.throws(() => sharedRoomMaterials(scene, map => {
    map.set("partial", new babylon.StandardMaterial("partial", scene));
    throw new Error("fixture");
  }), /fixture/);
  assert.deepEqual(scene.materials, [existing]);
  const next = sharedRoomMaterials(scene, map => map.set("ready", new babylon.StandardMaterial("ready", scene)));
  assert.ok(next.has("ready"));
  scene.dispose(); assert.equal(next.size, 0);
  assert.throws(() => sharedRoomMaterials(scene, () => {}), /disposed/);
});

test("multiple room builders share scene materials and retain explicit ownership after merging", t => {
  const scene = createScene(t), study = new RoomFurnishings(scene);
  const counts = [scene.materials.length, scene.textures.length];
  const bedroom = new RoomFurnishings(scene, "bedroom");
  assert.deepEqual([scene.materials.length, scene.textures.length], counts);
  const a = study.box("desk", [1, 1, 1], [0, 0, 0], "wood");
  const b = bedroom.box("bed", [1, 1, 1], [3, 0, 0], "wood");
  assert.equal(a.material, b.material);
  const meshes = bedroom.finish();
  assert.deepEqual(meshes[0].metadata.ownerRooms, ["bedroom"]);
  const lighting = new RoomLighting(scene); lighting.addLivingRoom(scene); lighting.addMeshes(meshes);
  scene.lights.filter(light => light instanceof babylon.SpotLight).forEach(light => {
    assert.ok(light.excludedMeshes.includes(meshes[0]), "a bedroom must not accidentally receive study/living light slots");
  });
  const material = a.material; meshes[0].dispose(false, false);
  assert.ok(scene.materials.includes(material));
  assert.equal(a.material, material, "releasing one room must retain the other room's shared material");
  lighting.removeRoom("study");
  assert.equal(scene.lights.filter(light => light instanceof babylon.SpotLight).length, 2);
});

test("room-level interaction cleanup respects shared ownership and rejects duplicate IDs", t => {
  const scene = createScene(t), box = babylon.MeshBuilder.CreateBox("shared-lamp", {}, scene);
  box.computeWorldMatrix(true); setRoomOwners(box, ["study", "living"]);
  const interactions = new RoomInteractions(scene, () => {});
  let on = false;
  const lamp = { id: "shared-test-lamp", label: "lamp", meshes: [box] };
  interactions.addLamp(lamp, () => on, () => on = !on);
  assert.throws(() => interactions.addLamp(lamp, () => on, () => {}), /Duplicate/);
  const ray = new babylon.Ray(new babylon.Vector3(0, 0, -3), new babylon.Vector3(0, 0, 1), 7.5);
  interactions.removeRoom("study"); interactions.pick(ray).toggle(); assert.equal(on, true);
  interactions.removeRoom("living"); assert.equal(interactions.pick(ray), undefined);
});

function adjacentRooms(t) {
  const scene = createScene(t), room = new RoomFurnishings(scene);
  const shell = new babylon.TransformNode("shell", scene);
  createLegacyArchitecture.call({ scene, interiorShell: shell }, room);
  room.furnish();
  createLivingRoom(scene, room, shell);
  room.finish().forEach(mesh => mesh.checkCollisions = true);
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  return { scene, room, shell };
}

test("adjacent rooms have a real bidirectional passage and closed walls outside it", t => {
  const { scene, shell, room } = adjacentRooms(t);
  scene.collisionsEnabled = true;
  const interactions = new RoomInteractions(scene, () => {});
  interactions.addDoor(room.doors[0]);
  interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5)).toggle();
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  for (const [x, dx, expected] of [[17, 7, 24], [24, -7, 17]]) {
    const result = sweep(scene, new babylon.Vector3(x, -1.8, -5), new babylon.Vector3(dx, 0, 0));
    assert.ok(Math.abs(result.position.x - expected) < 0.02, "walls, trims and casing must leave a walkable passage");
  }
  for (const z of [-12, -8, -2, 0]) {
    const result = sweep(scene, new babylon.Vector3(17, -1.8, z), new babylon.Vector3(7, 0, 0));
    assert.ok(result.position.x < 19.2, "shared wall outside the passage must block walking");
  }
  const outside = sweep(scene, new babylon.Vector3(50, -1.8, 15), new babylon.Vector3(0, 0, 10));
  assert.ok(outside.position.z < 19.2, "living room perimeter must block walking");
  const furniture = sweep(scene, new babylon.Vector3(37, -1.8, 15), new babylon.Vector3(0, 0, -8));
  assert.ok(furniture.position.z > 9, "sofa remains a physical obstacle");
  shell.setEnabled(false);
  assert.equal(scene.getMeshByName("shared-wall-0").isEnabled(), false);
  assert.equal(scene.getMeshByName("living-back-wall").isEnabled(), true);
  assert.equal(scene.getMeshByName("living-oak-floor").position.y, -5);
  for (const value of [new babylon.Vector3(37, 8, 0), new babylon.Vector3(100, -10, 30)]) {
    constrainWalkingPosition(value);
    assert.equal(value.y, 1); assert.ok(value.x > 20 && value.x <= 52.8 && value.z <= 18.8);
  }
});

test("living room lamps and shadows stay in their room without taking study light slots", t => {
  const { scene, room } = adjacentRooms(t);
  const lighting = new RoomLighting(scene); lighting.addLivingRoom(scene);
  const lamp = room.lamps.find(lamp => lamp.id === "living-lamp");
  assert.ok(lamp.meshes.every(mesh => mesh.metadata.room === "living"));
  const shade = scene.getMaterialByName("living-lamp-shade"), initial = shade.emissiveColor.clone();
  lighting.bindLamp("living-lamp", shade); lighting.addMeshes(scene.meshes);
  for (const light of scene.lights.filter(light => light instanceof babylon.SpotLight)) {
    const living = light.name.startsWith("living-");
    for (const mesh of scene.meshes.filter(mesh => mesh.getTotalVertices() > 0)) {
      const excluded = mesh.metadata?.lightRooms ? !mesh.metadata.lightRooms.includes(living ? "living" : "study")
        : mesh.metadata?.room === "shared" ? /banker|reading-lamp/.test(light.name)
        : (mesh.metadata?.room === "living") !== living;
      assert.equal(light.excludedMeshes.includes(mesh), excluded);
    }
    assert.ok(light.getShadowGenerator().getShadowMap().renderList.every(mesh =>
      mesh.metadata?.room === "shared" || (mesh.metadata?.room === "living") === living));
  }
  const studyIntensity = scene.getLightByName("banker-lamp-light").intensity;
  lighting.toggleLamp("living-lamp");
  assert.equal(scene.getLightByName("living-table-lamp-light").intensity, 0);
  assert.ok(shade.emissiveColor.equals(babylon.Color3.Black()));
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, studyIntensity);
  lighting.toggleLamp("living-lamp"); assert.ok(shade.emissiveColor.equals(initial));
  lighting.freezeShadows();
  assert.ok(scene.lights.filter(light => light instanceof babylon.SpotLight).every(light =>
    light.getShadowGenerator().getShadowMap().refreshRate === babylon.RenderTargetTexture.REFRESHRATE_RENDER_ONCE));
});

test("single door picks from both rooms, reverse smoothly and move their physical collision", t => {
  const { scene, room } = adjacentRooms(t), door = room.doors[0];
  scene.collisionsEnabled = true;
  let refreshed = 0;
  const interactions = new RoomInteractions(scene, () => refreshed++);
  interactions.addDoor(door);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  const reverseAction = interactions.pick(new babylon.Ray(new babylon.Vector3(24, 1, -5), new babylon.Vector3(-1, 0, 0), 7.5));
  assert.ok(action && action === reverseAction);
  assert.match(action.label(), /^打开/);
  for (const [x, dx] of [[16, 8], [24, -8]]) {
    const blocked = sweep(scene, new babylon.Vector3(x, -1.8, -5), new babylon.Vector3(dx, 0, 0)).position;
    assert.ok(x < 20 ? blocked.x < 19.2 : blocked.x > 20.8, "closed door must block both directions");
  }
  action.toggle(); interactions.update(0.05);
  const partial = door.root.rotation.y;
  action.toggle(); assert.deepEqual(door.root.rotation.y, partial);
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y) < 1e-6);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.equal(room.doors.length, 1);
  assert.ok(Math.abs(door.root.rotation.y - door.openAngle) < 1e-6);
  assert.ok(door.meshes.every(mesh => mesh.checkCollisions && !mesh.isWorldMatrixFrozen));
  const contact = sweep(scene, new babylon.Vector3(22, -1.8, -5), new babylon.Vector3(0, 0, -5)).position;
  assert.ok(Math.abs(contact.z + 5) < 3.3, "open door must still collide at its new position");
  const passed = sweep(scene, new babylon.Vector3(16, -1.8, -5), new babylon.Vector3(8, 0, 0)).position;
  assert.ok(Math.abs(passed.x - 24) < 0.01);
  assert.ok(refreshed > 0);
  refreshed = 0; interactions.update(0.05); assert.equal(refreshed, 0);
});

test("door sweep pauses for a walker, resumes after clearance and supports reversing while blocked", t => {
  const { scene, room } = adjacentRooms(t), door = room.doors[0];
  let walker = new babylon.Vector3(19, 1, -5);
  const interactions = new RoomInteractions(scene, () => {}, () => walker);
  interactions.addDoor(door);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y - Math.PI / 2) < 1e-6, "standing at the study face must permit opening away from the walker");
  walker = new babylon.Vector3(20, 1, -5);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.match(action.label(), /让开门口/);
  assert.ok(door.root.rotation.y > 0.2);
  const paused = door.root.rotation.y;
  interactions.update(0.05); assert.equal(door.root.rotation.y, paused);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y - Math.PI / 2) < 1e-6);
  action.toggle(); for (let i = 0; i < 20; i++) interactions.update(0.05);
  walker = new babylon.Vector3(16, 1, -5);
  for (let i = 0; i < 20; i++) interactions.update(0.05);
  assert.ok(Math.abs(door.root.rotation.y) < 1e-6);
  assert.match(action.label(), /^打开/);
});

test("audio events follow actual movement, blocking and completion rather than click timers", t => {
  const { scene, room } = adjacentRooms(t), events = [];
  let walker = new babylon.Vector3(19, 1, -5);
  const interactions = new RoomInteractions(scene, () => {}, () => walker, event => events.push(event));
  interactions.addDoor(room.doors[0]);
  const action = interactions.pick(new babylon.Ray(new babylon.Vector3(16, 1, -5), new babylon.Vector3(1, 0, 0), 7.5));
  action.toggle(); assert.deepEqual(events.map(event => event.cue), ['stop']);
  interactions.update(0); assert.equal(events.length, 1, 'no sound before movement');
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'door-move').length, 1);
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 0, 'opening never emits closing latch');
  walker = new babylon.Vector3(20, 1, -5); action.toggle();
  for (let i = 0; i < 20; i++) interactions.update(.05);
  const count = events.length;
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.length, count, 'blocked frames do not repeatedly sound');
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 0);
  walker = new babylon.Vector3(16, 1, -5);
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'door-latch').length, 1);
  const drawer = room.drawers[0]; interactions.addDrawer(drawer);
  const state = interactions.drawers[0]; state.open = true;
  interactions.update(.05); interactions.silenceMotion(); interactions.update(.05);
  state.open = false;
  for (let i = 0; i < 20; i++) interactions.update(.05);
  assert.equal(events.filter(event => event.cue === 'drawer-stop').length, 1);
  assert.ok(events.some(event => event.entity === drawer.id && event.position().x === event.position().x));
});

test("section batching preserves singleton artwork/window world transforms and cutaway parenting", t => {
  const { scene } = adjacentRooms(t);
  const artwork = scene.getMeshByName("living-study-living-landscape-artwork");
  const window = scene.getMeshByName("living-study-window-glass-surface");
  assert.ok(artwork.getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(new babylon.Vector3(37, 4, -18.66), 0.001));
  assert.ok(window.getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(new babylon.Vector3(48, 2.5, -19.14), 0.001));
  const furnishings = new RoomFurnishings(scene), shell = new babylon.TransformNode("test-shell", scene);
  const meshes = furnishings.section("living", "singleton", () => {
    const parent = furnishings.group("model-parent", [30, 2, -4], Math.PI / 2);
    furnishings.box("only-part", [2, 1, 1], [0, 1, 2], "wood", parent);
  }, shell);
  const centre = meshes[0].getBoundingInfo().boundingBox.centerWorld;
  assert.ok(centre.equalsWithEpsilon(new babylon.Vector3(32, 3, -4), 0.001));
  shell.setEnabled(false); assert.ok(!meshes[0].isEnabled());
  shell.setEnabled(true); meshes[0].computeWorldMatrix(true);
  assert.ok(meshes[0].getBoundingInfo().boundingBox.centerWorld.equalsWithEpsilon(centre));
});

function sweep(scene, position, displacement, radius = new babylon.Vector3(0.65, 2.8, 0.65)) {
  const collider = scene.collisionCoordinator.createCollider();
  collider._radius = radius;
  let testedIndices = 0;
  const collide = collider._collide;
  collider._collide = function (...args) {
    testedIndices += args[4] - args[3];
    return collide.apply(this, args);
  };
  let result;
  scene.collisionCoordinator.getNewPosition(position, displacement, collider, 3, null,
    (_, finalPosition) => result = finalPosition.clone(), 0);
  return { position: result, testedIndices };
}

test("collision partitions preserve swept collisions and cull distant geometry without extra draw calls", t => {
  const scene = createScene(t);
  const parts = Array.from({ length: 20 }, (_, i) => {
    const mesh = babylon.MeshBuilder.CreateSphere("obstacle", { diameter: 3, segments: 24 }, scene);
    mesh.position.set(i * 8, 0, 4);
    return mesh;
  });
  const ranges = parts.map(part => ({ vertices: part.getTotalVertices(), indices: part.getTotalIndices() }));
  const mesh = babylon.Mesh.MergeMeshes(parts, true, true);
  mesh.material = new babylon.StandardMaterial("obstacles", scene);
  mesh.checkCollisions = true;
  mesh.freezeWorldMatrix();
  const vertices = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  const fallback = scene.getCollidingSubMeshCandidates;
  const sweeps = [
    [[0, 0, 0], [0, 0, 8]], // Direct contact.
    [[4, 0, 0], [0, 0, 8]], // Pass through the gap.
    [[-2, 0, 4], [6, 0, 0]], // Side contact and sliding.
    [[0, 6, 0], [0, 0, 8]], // Pass above the obstacles.
    [[-5, 0, -3], [24, 0, 14]], // A large swept displacement.
  ].map(([start, delta]) => [new babylon.Vector3(...start), new babylon.Vector3(...delta)]);
  const baseline = sweeps.map(([start, delta]) => sweep(scene, start, delta));
  partitionMergedCollisions(mesh, ranges);
  const candidates = scene.getCollidingSubMeshCandidates(mesh, scene.collisionCoordinator.createCollider());
  assert.equal(candidates.length, parts.length);
  assert.equal(mesh.subMeshes.length, 1, "collision partitions must not split the render batch");
  assert.equal(scene.meshes.length, 1, "collision partitions share geometry instead of adding proxy meshes");
  assert.strictEqual(mesh.getVerticesData(babylon.VertexBuffer.PositionKind), vertices);
  assert.strictEqual(mesh.getIndices(), indices);
  assert.ok(baseline[0].position.z < 4, "the baseline actually blocks movement");
  const optimized = sweeps.map(([start, delta]) => sweep(scene, start, delta));
  optimized.forEach((result, i) => assert.ok(result.position.equalsWithEpsilon(baseline[i].position, 1e-6),
    `sweep ${i} must keep the original precise collision response`));
  assert.ok(optimized[0].testedIndices <= baseline[0].testedIndices / 10,
    `a local sweep should avoid at least 90% of unrelated triangle tests (${optimized[0].testedIndices}/${baseline[0].testedIndices})`);
  const other = babylon.MeshBuilder.CreateBox("unregistered", {}, scene);
  assert.strictEqual(scene.getCollidingSubMeshCandidates(other, null).data, fallback(other, null).data,
    "architecture and imported meshes continue to use the original candidate provider");
});

test("actual room collision partitions cover every merged index and preserve first-person sweeps", t => {
  const scene = createScene(t);
  const fallback = scene.getCollidingSubMeshCandidates;
  const furnishings = new RoomFurnishings(scene);
  furnishings.furnish();
  const meshes = furnishings.finish();
  meshes.forEach(mesh => {
    mesh.checkCollisions = true;
    const candidates = scene.getCollidingSubMeshCandidates(mesh, null);
    assert.equal(candidates.data.slice(0, candidates.length).reduce((sum, part) => sum + part.indexCount, 0),
      mesh.getTotalIndices(), "no merged triangles may be omitted");
    assert.equal(mesh.subMeshes.length, 1);
  });
  const optimized = scene.getCollidingSubMeshCandidates;
  for (const [x, z] of [[4, 16], [0, 8], [-7, 5], [-7, -1], [10, 5], [-17, 9]]) {
    for (const [dx, dz] of [[0, -2], [2, 0], [-2, -1]]) {
      const start = new babylon.Vector3(x, -1.8, z);
      const delta = new babylon.Vector3(dx, 0, dz);
      scene.getCollidingSubMeshCandidates = fallback;
      const before = sweep(scene, start, delta);
      scene.getCollidingSubMeshCandidates = optimized;
      const after = sweep(scene, start, delta);
      assert.ok(after.position.equalsWithEpsilon(before.position, 1e-6),
        `first-person sweep from (${x}, ${z}) must retain exact collisions`);
    }
  }
});

function createScene(t) {
  const engine = new babylon.NullEngine();
  // Canvas drawing is irrelevant to geometry; use the real meshes, materials and glTF loader.
  const context = new Proxy({}, { get: (_, key) => ["createLinearGradient", "createRadialGradient"].includes(key)
    ? () => ({ addColorStop() {} }) : () => {} });
  engine.createCanvas = () => ({ width: 1, height: 1, getContext: () => context, remove() {} });
  engine.getDeltaTime = () => 1000 / 30;
  engine.getFps = () => 30;
  t.after(() => engine.dispose());
  const scene = new babylon.Scene(engine);
  // NullEngine cannot upload HDR cubes; WebGL browser checks cover actual pixels.
  scene.useDelayedTextureLoading = true;
  return scene;
}

for (const scale of [5.2, 3.7]) {
  test(`books and vase fit the actual bookshelf model at scale ${scale}`, async t => {
    const scene = createScene(t);
    const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/wooden_bookshelf.glb")));
    const result = await babylon.ImportMeshAsync(source, scene, {
      pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
    });
    const placement = new babylon.TransformNode("bookshelf-placement", scene);
    placement.position.set(11.5, -5, -17.8);
    placement.scaling.setAll(scale);
    result.meshes[0].parent = placement;
    const { compartments } = measureBookshelf(result.meshes);
    assert.equal(compartments.length, 6, "the model has six interior compartments");
    const localShelfHeights = [0.107607, 0.391878, 0.671547, 0.960453, 1.276524, 1.663383];
    compartments.forEach((slot, row) => {
      assert.ok(Math.abs(slot.min.y - (-5 + scale * localShelfHeights[row])) < 0.01);
    });
    const furnishings = new RoomFurnishings(scene);
    const parts = [];
    const merge = furnishings.merge.bind(furnishings);
    furnishings.merge = meshes => {
      meshes.forEach(mesh => {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        parts.push({ name: mesh.name, min: box.minimumWorld.clone(), max: box.maximumWorld.clone() });
      });
      return merge(meshes);
    };
    furnishings.furnishBookshelf(result.meshes);
    const books = parts.filter(part => part.name === "shelf-book");
    assert.ok(books.length >= 40, "every compartment contains books");
    for (const book of books) {
      const slot = compartments.find(slot => Math.abs(book.min.y - slot.min.y - 0.015) < 0.002);
      assert.ok(slot, "each book must rest on a real shelf");
      for (const axis of ["x", "y", "z"]) {
        assert.ok(book.min[axis] >= slot.min[axis] - 0.002 && book.max[axis] <= slot.max[axis] + 0.002,
          `book protrudes through compartment on ${axis}`);
      }
    }
    const vaseParts = parts.filter(part => /^(vase-|dried-flower)/.test(part.name));
    const vaseSlot = compartments[compartments.length - 2];
    assert.equal(vaseParts.length, 12);
    for (const part of vaseParts) {
      for (const axis of ["x", "y", "z"]) {
        assert.ok(part.min[axis] >= vaseSlot.min[axis] - 0.002 && part.max[axis] <= vaseSlot.max[axis] + 0.002,
          `${part.name} protrudes through compartment on ${axis}`);
      }
    }
  });
}

test("all flower stems connect to both the vase neck and their flower heads", t => {
  const scene = createScene(t);
  const furnishings = new RoomFurnishings(scene);
  const parent = new babylon.TransformNode("console", scene);
  parent.rotation.y = Math.PI / 2;
  furnishings.vase([2.5, 4.27, 0], 0.65, parent);
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  const neck = scene.getMeshByName("vase-neck");
  const body = scene.getMeshByName("vase-body");
  const stems = scene.meshes.filter(mesh => mesh.name === "dried-flower-stem");
  const flowers = scene.meshes.filter(mesh => mesh.name === "dried-flower");
  assert.ok(neck.intersectsMesh(body, true));
  assert.equal(stems.length, 5);
  stems.forEach((stem, index) => {
    assert.ok(stem.intersectsMesh(neck, true), `stem ${index} must enter the vase neck`);
    assert.ok(stem.intersectsMesh(flowers[index], true), `stem ${index} must reach its flower`);
  });
});

test("changing movement speed applies immediately and clears previous movement", t => {
  const scene = createScene(t);
  const camera = new babylon.UniversalCamera("first-person", babylon.Vector3.Zero(), scene);
  const room = Object.create(RoomScene.prototype);
  room.firstPersonCamera = camera;
  room.setMovementSpeed(1);
  camera.cameraDirection.set(0.4, 0, 0);
  camera._checkInputs();
  const previous = camera.position.clone();
  room.setMovementSpeed(0.25);
  camera._checkInputs();
  assert.ok(camera.position.equals(previous), "old movement must stop when speed changes");
  const slow = camera._computeLocalCameraSpeed();
  room.setMovementSpeed(3);
  assert.ok(Math.abs(camera._computeLocalCameraSpeed() / slow - 12) < 0.0001);
  assert.equal(room.setMovementSpeed(NaN), 1);
  assert.equal(room.setMovementSpeed(-1), 0.25);
  assert.equal(room.setMovementSpeed(100), 3);
});

test("lamp lights emit below their shades and the window is the main light source", t => {
  const scene = createScene(t);
  new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  furnishings.floorLamp();
  scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
  for (const [lightName, shadeName] of [
    ["reading-lamp-light", "linen-lampshade"], ["banker-lamp-light", "banker-green-shade"],
  ]) {
    const light = scene.getLightByName(lightName);
    const shade = scene.getMeshByName(shadeName).getBoundingInfo().boundingBox;
    assert.ok(light.position.y < shade.minimumWorld.y, `${lightName} must not be enclosed in its shade`);
    assert.ok(Math.abs(light.position.x - (shade.minimumWorld.x + shade.maximumWorld.x) / 2) < 0.01);
    assert.ok(Math.abs(light.position.z - (shade.minimumWorld.z + shade.maximumWorld.z) / 2) < 0.01);
    assert.ok(light.getShadowGenerator(), `${lightName} must cast shadows`);
  }
  const windowLight = scene.getLightByName("window-daylight");
  const directSources = scene.lights.filter(light => light instanceof babylon.SpotLight);
  assert.deepEqual(directSources.map(light => light.name).sort(),
    ["banker-lamp-light", "reading-lamp-light", "window-daylight"], "each direct source corresponds to a visible window or lamp");
  assert.equal(new Set(directSources.map(light => light.getShadowGenerator())).size, 3,
    "each direct source must own an independent shadow map");
  assert.ok(windowLight.position.x < -18 && windowLight.direction.x > 0, "daylight must enter from the window wall");
  assert.ok(scene.materials.filter(material => material instanceof babylon.StandardMaterial || material instanceof babylon.PBRMaterial)
    .every(material => material.maxSimultaneousLights >= scene.lights.length));
});

test("floor lamp foot touches the floor and its stacked base joins the stem", t => {
  const scene = createScene(t);
  const lighting = new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.floorLamp();
  const names = ["lamp-base-foot", "lamp-weighted-base", "lamp-base-shoulder", "lamp-stem"];
  const parts = names.map(name => scene.getMeshByName(name));
  parts.forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = parts.map(mesh => mesh.getBoundingInfo().boundingBox);
  assert.ok(Math.abs(bounds[0].minimumWorld.y + 5) < 0.0001, "foot must rest on the floor");
  bounds.slice(1).forEach((box, index) => {
    assert.ok(box.minimumWorld.y <= bounds[index].maximumWorld.y + 0.0001,
      `${names[index + 1]} must touch or overlap the part below`);
  });
  const merged = furnishings.finish();
  lighting.addMeshes(merged);
  scene.lights.filter(light => light instanceof babylon.SpotLight).forEach(light => {
    assert.ok(merged.every(mesh => light.getShadowGenerator().getShadowMap().renderList.includes(mesh)),
      "the complete lamp base must cast shadows from each direct source after merging");
  });
});

for (const [file, width, rotation, x, z] of [
  ["sofa_03", 10.8, 0, 10, 6],
  ["modern_arm_chair_01", 3.8, Math.PI / 2, -10, 12],
]) {
  test(`${file} fits its room footprint and sits on the floor after glTF conversion`, async t => {
    const scene = createScene(t);
    const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/study", file + ".glb")));
    const result = await babylon.ImportMeshAsync(source, scene, {
      pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
    });
    const geometry = result.meshes.filter(mesh => mesh.getTotalVertices() > 0);
    const parents = geometry.map(mesh => mesh.parent);
    placeFurniture(result.meshes, scene, file, new babylon.Vector3(x, -5, z), width, rotation);
    let min = new babylon.Vector3(Infinity, Infinity, Infinity);
    let max = new babylon.Vector3(-Infinity, -Infinity, -Infinity);
    geometry.forEach((mesh, index) => {
      assert.equal(mesh.parent, parents[index], "fitting must preserve the imported transform hierarchy");
      assert.ok(mesh.checkCollisions && mesh.receiveShadows && mesh.metadata.castsShadows);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min = babylon.Vector3.Minimize(min, bounds.minimumWorld);
      max = babylon.Vector3.Maximize(max, bounds.maximumWorld);
    });
    assert.ok(Math.abs(min.y + 5) < 0.001, "lowest vertex must touch the floor");
    assert.ok(Math.abs((min.x + max.x) / 2 - x) < 0.001);
    assert.ok(Math.abs((min.z + max.z) / 2 - z) < 0.001);
    const widthAxis = rotation === 0 ? "x" : "z";
    assert.ok(Math.abs(max[widthAxis] - min[widthAxis] - width) < 0.001);
    assert.ok(max.y < 1, "furniture must remain below the standing camera's eye level");
  });
}

test("wall colour, normal and ARM maps tile together without modifying other walls", t => {
  const scene = createScene(t);
  const source = paintedWallMaterial(scene);
  const wall = tileMaterial(source, "wall", 3.5, 1.2);
  const other = tileMaterial(source, "lintel", 0.7, 0.3);
  for (const key of ["albedoTexture", "bumpTexture", "metallicTexture"]) {
    assert.notEqual(wall[key], source[key]);
    assert.equal(wall[key].uScale, 3.5);
    assert.equal(wall[key].vScale, 1.2);
    assert.equal(other[key].uScale, 0.7);
    assert.equal(source[key].uScale, 1);
  }
  assert.equal(wall.albedoTexture.gammaSpace, true);
  assert.equal(wall.bumpTexture.gammaSpace, false);
  assert.equal(wall.metallicTexture.gammaSpace, false);
  assert.equal(wall.bumpTexture.level, 0.18);
  assert.ok([wall.albedoTexture, wall.bumpTexture, wall.metallicTexture].every(texture =>
    texture.url.includes('/painted_wall/') && texture.url.endsWith('.png')));
});

test("all exterior, shared and lintel walls use the same painted finish while wood remains separate", t => {
  const { scene } = adjacentRooms(t);
  const names = ['back-wall-left', 'back-wall-right', 'door-lintel-wall', 'left-painted-wall',
    'front-painted-wall', 'shared-wall-0', 'shared-wall-1', 'shared-wall-2', 'living-back-wall',
    'living-right-wall', 'living-front-wall', 'living-right-painted-facing'];
  for (const name of names) {
    const mesh = scene.getMeshByName(name);
    assert.ok(mesh, name);
    assert.ok(mesh.material.albedoTexture.url.includes('/painted_wall/'), name);
    assert.equal(mesh.material.bumpTexture.level, 0.18);
    assert.equal(mesh.material.metallicTexture.gammaSpace, false);
  }
  assert.ok(scene.getMaterialByName('wood').albedoTexture.url.includes('/wood_table_001/'));
  assert.ok(!scene.textures.some(texture => texture.url?.includes('/brick_wall_001/')));
});

test("rugs receive shadows without hiding chair legs; cached shadows refresh after enclosure changes", t => {
  const scene = createScene(t);
  const lighting = new RoomLighting(scene);
  const furnishings = new RoomFurnishings(scene);
  furnishings.chair([-3, -5, 5.1], 0);
  furnishings.box("persian-rug", [14.5, 0.055, 13], [-3, -4.95, -0.3], "wood");
  furnishings.box("foundation", [40.6, 0.6, 40.6], [0, -5.4, 0], "darkWood");
  const meshes = furnishings.finish();
  lighting.addMeshes(meshes);
  const receivers = meshes.filter(mesh => mesh.metadata.castsShadows === false);
  const furniture = meshes.filter(mesh => mesh.metadata.castsShadows);
  assert.equal(receivers.length, 2, "receivers sharing furniture materials must merge separately");
  const shadows = scene.lights.filter(light => light instanceof babylon.SpotLight)
    .map(light => light.getShadowGenerator());
  for (const shadow of shadows) {
    const casters = shadow.getShadowMap().renderList;
    assert.ok(receivers.every(mesh => mesh.receiveShadows && !casters.includes(mesh)));
    assert.ok(furniture.every(mesh => casters.includes(mesh)), "chair geometry must cast shadows from every light");
  }
  lighting.freezeShadows();
  for (const shadow of shadows) {
    assert.equal(shadow.getShadowMap()._shouldRender(), true);
    assert.equal(shadow.getShadowMap()._shouldRender(), false);
  }
  lighting.refreshShadows();
  for (const shadow of shadows) {
    assert.equal(shadow.getShadowMap()._shouldRender(), true, "changed walls must invalidate all cached shadows");
  }
});

test("beveled boards keep their dimensions and have outward, finite surface normals", t => {
  const scene = createScene(t);
  for (const size of [[8.3, 0.4, 6], [0.2, 2.3, 0.2], [10.7, 0.2, 0.28]]) {
    const mesh = beveledBox("board", size, 0.065, scene);
    const positions = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(babylon.VertexBuffer.NormalKind);
    const fromWinding = [];
    babylon.VertexData.ComputeNormals(positions, mesh.getIndices(), fromWinding);
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(box.maximum.asArray()[axis] - size[axis] / 2) < 0.00001);
      assert.ok(Math.abs(box.minimum.asArray()[axis] + size[axis] / 2) < 0.00001);
    }
    for (let i = 0; i < normals.length; i += 3) {
      const normal = babylon.Vector3.FromArray(normals, i);
      assert.ok(Math.abs(normal.length() - 1) < 0.00001);
      assert.ok(babylon.Vector3.Dot(normal, babylon.Vector3.FromArray(fromWinding, i)) > 0.8,
        "triangle winding must agree with the visible outer surface");
      assert.ok(babylon.Vector3.Dot(normal, babylon.Vector3.FromArray(positions, i)) > 0);
    }
  }
});

test("stacked book covers touch the support and the next book without floating gaps", t => {
  const scene = createScene(t);
  const furnishings = new RoomFurnishings(scene);
  furnishings.bookStack([0, 2, 0]);
  const covers = scene.meshes.filter(mesh => mesh.name === "book-cover");
  covers.forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = covers.map(mesh => mesh.getBoundingInfo().boundingBox);
  assert.ok(Math.abs(bounds[0].minimumWorld.y - 2) < 0.00001);
  for (let book = 0; book < 2; book++) {
    assert.ok(Math.abs(bounds[book * 2 + 1].maximumWorld.y - bounds[(book + 1) * 2].minimumWorld.y) < 0.00001);
  }
});

test("cloth gathers around its tie and leaves have a thin, curved pointed silhouette", t => {
  const scene = createScene(t);
  const cloth = curtainPanel("cloth", 1, scene);
  const clothPositions = cloth.getVerticesData(babylon.VertexBuffer.PositionKind);
  const rowWidth = row => {
    const start = row * 41 * 3;
    return clothPositions[start + 40 * 3] - clothPositions[start];
  };
  assert.ok(rowWidth(23) < rowWidth(0) * 0.6, "the panel must visibly gather at the tie height");
  assert.ok(rowWidth(36) > rowWidth(23) * 2, "cloth must spread back out toward the hem");
  const leaf = ficusLeaf("leaf", 1.5, 0.7, scene);
  const leafPositions = leaf.getVerticesData(babylon.VertexBuffer.PositionKind);
  const halfVertices = leafPositions.length / 6;
  const tipY = leafPositions[(14 * 9 + 4) * 3 + 1];
  assert.ok(tipY < -0.2, "the tip must droop below its attachment");
  assert.ok(Math.abs(leafPositions[14 * 9 * 3]) < 0.005, "the silhouette must taper to a point");
  assert.ok(halfVertices > 100, "curvature must come from geometry rather than a stretched sphere");
  assert.ok([...clothPositions, ...leafPositions].every(Number.isFinite));
});

test("desk accessories, tea tray and small furniture rest on their actual supports", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  const bounds = mesh => {
    mesh.computeWorldMatrix(true);
    return mesh.getBoundingInfo().boundingBox;
  };
  furnishings.writingTable();
  const deskY = bounds(scene.getMeshByName("table-top")).maximumWorld.y;
  for (const name of ["book-cover", "saucer", "banker-base"]) {
    assert.ok(Math.abs(bounds(scene.getMeshByName(name)).minimumWorld.y - deskY) < 0.00001,
      `${name} must touch the desktop`);
  }
  furnishings.coffeeTable();
  const teaTray = bounds(scene.getMeshByName("tea-tray"));
  assert.ok(Math.abs(teaTray.minimumWorld.y - bounds(scene.getMeshByName("oval-walnut-top")).maximumWorld.y) < 0.00001);
  const saucers = scene.meshes.filter(mesh => mesh.name === "saucer");
  assert.ok(Math.abs(bounds(saucers[1]).minimumWorld.y - teaTray.maximumWorld.y) < 0.00001);
  furnishings.armchair(); furnishings.sofa();
  for (const name of ["side-table-base", "ottoman-foot"]) {
    assert.ok(Math.abs(bounds(scene.getMeshByName(name)).minimumWorld.y + 5) < 0.00001,
      `${name} must touch the floor`);
  }
});

test("wear masks preserve tangent normals and keep surface variation subtle and reproducible", () => {
  for (const kind of ["wood", "brass", "cover"]) {
    const { size, pixels } = buildWearMask(kind);
    assert.deepEqual(pixels, buildWearMask(kind).pixels, "wear must remain stable across reloads");
    assert.equal(pixels.length, size * size * 4);
    let roughnessMin = 255, roughnessMax = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const nx = pixels[i + 3] / 255 * 2 - 1, ny = pixels[i + 1] / 255 * 2 - 1;
      assert.ok(Math.sqrt(1 - nx * nx - ny * ny) > 0.999,
        "detail maps must not flatten or bend the original normal, including materials without a bump map");
      assert.ok(pixels[i] >= 120 && pixels[i] <= 150, "albedo variation must be restrained");
      roughnessMin = Math.min(roughnessMin, pixels[i + 2]);
      roughnessMax = Math.max(roughnessMax, pixels[i + 2]);
    }
    assert.ok(roughnessMin >= 110 && roughnessMax <= 160);
    assert.ok(roughnessMax - roughnessMin > 12, "roughness must contain actual local wear");
  }
});

test("creased letter rests on the blotter and curls only a small distance above it", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  const letter = scene.getMeshByName("letter"), blotter = scene.getMeshByName("desk-blotter");
  letter.computeWorldMatrix(true); blotter.computeWorldMatrix(true);
  const paperBounds = letter.getBoundingInfo().boundingBox;
  const support = blotter.getBoundingInfo().boundingBox.maximumWorld.y;
  assert.ok(paperBounds.minimumWorld.y >= support && paperBounds.minimumWorld.y - support < 0.003);
  assert.ok(paperBounds.maximumWorld.y - support > 0.04 && paperBounds.maximumWorld.y - support < 0.07);
  assert.ok(letter.material.albedoTexture && letter.material.roughness > 0.9);
  const mesh = creasedLetter("check-normals", scene);
  const positions = mesh.getVerticesData(babylon.VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(babylon.VertexBuffer.NormalKind);
  assert.ok([...positions, ...normals].every(Number.isFinite));
  assert.ok(normals[1] > 0.9, "the top side must face the room lights");
});

test("detail zoom limits and responsive suite framing preserve camera controls across views", t => {
  const scene = createScene(t), room = Object.create(RoomScene.prototype);
  room.camera = new babylon.ArcRotateCamera("orbit", 0.8, 1.08, 66, babylon.Vector3.Zero(), scene);
  room.firstPersonCamera = new babylon.UniversalCamera("walking", new babylon.Vector3(4, 1, 16), scene);
  room.interiorShell = new babylon.TransformNode("shell", scene);
  room.interiorShell.setEnabled(false);
  room.architecture = { setEnclosed(value) { room.interiorShell.setEnabled(value); } };
  room.scene = scene; room.engine = scene.getEngine(); room.controlsEnabled = false;
  room.interactions = { silenceMotion() {} };
  room.audio = { setSpatialCamera() {} };
  room.floorPlan = { isOpen: false, update() {} };
  room.exterior = { setVisible() {}, updateCutaway() {}, refreshShadows() {} };
  room.canvas = { setAttribute() {} };
  let refreshed = 0;
  room.lighting = { refreshShadows() { refreshed++; } };
  const previousDocument = global.document;
  global.document = { querySelector: () => null, querySelectorAll: () => [] };
  try {
    room.setView("details");
    room.camera._checkInputs();
    assert.equal(scene.activeCamera, room.camera);
    assert.ok(room.camera.radius < 6 && room.camera.lowerRadiusLimit <= room.camera.radius,
      "the close preset must not be pushed away by the general room zoom limit");
    room.setView("overview");
    assert.equal(room.camera.lowerRadiusLimit, 9);
    room.setView("first-person");
    assert.equal(scene.activeCamera, room.firstPersonCamera);
    assert.ok(room.interiorShell.isEnabled() && refreshed === 3);
    room.setView("details");
    assert.ok(!room.interiorShell.isEnabled() && refreshed === 4);
    let width = 1280, height = 800;
    room.engine = { getRenderWidth: () => width, getRenderHeight: () => height };
    for (const view of ['overview', 'study', 'living', 'master', 'ensuite', 'bedroom', 'kitchen', 'bathroom', 'balcony']) {
      room.setView(view); const desktopRadius = room.camera.radius;
      width = 390; height = 844; room.fitSuiteView();
      if (view === 'balcony') {
        assert.ok(Math.abs(room.camera.radius - desktopRadius) < .001, 'portrait sea view must keep the eye on the balcony');
        assert.ok(room.camera.position.z > houseVector(8.1, 10.8).z && room.camera.position.z < houseVector(8.1, 12.3).z);
        assert.ok(room.camera.target.z > room.camera.position.z, 'balcony looks south over the sea');
        assert.equal(room.camera.fov, .95);
      } else assert.ok(room.camera.radius > desktopRadius * 3, 'portrait view must keep the room in frame');
      const portraitRadius=room.camera.radius;room.camera._checkInputs();
      assert.ok(Math.abs(room.camera.radius-portraitRadius)<.001,'orbit limits must not undo portrait framing');
      room.camera.radius *= .8; // User zoom survives an orientation change.
      width = 1280; height = 800; room.fitSuiteView();
      assert.ok(Math.abs(room.camera.radius - desktopRadius * .8) < .001);
    }
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});


test("all five procedural drawers retain boxes, independent motion and live collisions after merging", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable(); furnishings.windowDesk();
  assert.equal(furnishings.drawers.length, 5);
  for (const drawer of furnishings.drawers) {
    assert.equal(drawer.meshes.filter(mesh => /drawer-(bottom|side|back)/.test(mesh.name)).length, 4);
  }
  furnishings.finish().forEach(mesh => mesh.checkCollisions = true);
  let refreshed = 0;
  const interactions = new RoomInteractions(scene, () => refreshed++);
  furnishings.drawers.forEach(drawer => interactions.addDrawer(drawer));
  const initial = furnishings.drawers.map(drawer => drawer.root.getAbsolutePosition().clone());
  for (const [index, drawer] of furnishings.drawers.entries()) {
    drawer.meshes.forEach(mesh => {
      assert.ok(!mesh.isWorldMatrixFrozen && mesh.checkCollisions);
      mesh.computeWorldMatrix(true);
    });
    const front = drawer.meshes.find(mesh => mesh.material.name === "wood");
    const bounds = front.getBoundingInfo().boundingBox;
    const centre = bounds.centerWorld.clone();
    const outward = index < 2 ? new babylon.Vector3(0, 0, 1) : new babylon.Vector3(1, 0, 0);
    const ray = new babylon.Ray(centre.add(outward.scale(5)), outward.negate(), 7.5);
    const action = interactions.pick(ray);
    assert.ok(action && action.label().startsWith("打开"), drawer.id + " must have a reachable front");
    action.toggle();
    interactions.update(0.05);
    const partial = drawer.root.position.clone();
    action.toggle(); // Reverse while moving; toggling must not snap to either endpoint.
    assert.ok(drawer.root.position.equals(partial));
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    assert.ok(drawer.root.getAbsolutePosition().equalsWithEpsilon(initial[index], 0.00001));
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    const delta = drawer.root.getAbsolutePosition().subtract(initial[index]);
    assert.ok(delta.equalsWithEpsilon(outward.scale(drawer.travel.length()), 0.0001), "travel must respect the rotated console");
    front.computeWorldMatrix(true);
    const openBounds = front.getBoundingInfo().boundingBox;
    const start = openBounds.centerWorld.add(outward.scale(2));
    const contact = sweep(scene, start, outward.scale(-3), new babylon.Vector3(0.1, 0.1, 0.1)).position;
    assert.ok(babylon.Vector3.Dot(contact.subtract(openBounds.centerWorld), outward) > 0.1,
      "the moving drawer must still block movement at its new position");
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
  }
  assert.ok(refreshed > 0, "motion must invalidate cached shadows");
  refreshed = 0; interactions.update(0.05);
  assert.equal(refreshed, 0, "settled drawers must retain shadow caching");
});

test("actual cabinet drawers move outward through the glTF conversion, preserving their geometry", async t => {
  const scene = createScene(t);
  const source = new Uint8Array(fs.readFileSync(path.join(__dirname, "../public/models/gothic_commode.glb")));
  const result = await babylon.ImportMeshAsync(source, scene, {
    pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true } },
  });
  const placement = new babylon.TransformNode("antique-cabinet", scene);
  placement.position.set(-13.5, -5, -17.6); placement.scaling.setAll(4.7);
  result.meshes[0].parent = placement;
  result.meshes.forEach(mesh => { mesh.freezeWorldMatrix(); mesh.checkCollisions = true; });
  placement.freezeWorldMatrix();
  const interactions = new RoomInteractions(scene, () => {});
  const drawers = cabinetDrawers(result.meshes);
  assert.equal(drawers.length, 3);
  drawers.forEach(drawer => interactions.addDrawer(drawer));
  for (const drawer of drawers) {
    const mesh = drawer.meshes[0]; mesh.computeWorldMatrix(true);
    const before = mesh.getBoundingInfo().boundingBox.centerWorld.clone();
    const vertices = [...mesh.getVerticesData(babylon.VertexBuffer.PositionKind)];
    const action = interactions.pick(new babylon.Ray(before.add(new babylon.Vector3(0, 0, 5)), new babylon.Vector3(0, 0, -1), 7.5));
    assert.ok(action, drawer.id + " must be reachable on the visible cabinet front");
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
    mesh.computeWorldMatrix(true);
    const delta = mesh.getBoundingInfo().boundingBox.centerWorld.subtract(before);
    assert.ok(delta.equalsWithEpsilon(new babylon.Vector3(0, 0, 1.786), 0.0001), JSON.stringify({delta:delta.asArray(),label:action.label(),drawer:drawer.id}));
    assert.deepEqual([...mesh.getVerticesData(babylon.VertexBuffer.PositionKind)], vertices);
    assert.ok(!mesh.isWorldMatrixFrozen && mesh.checkCollisions);
    action.toggle();
    for (let step = 0; step < 12; step++) interactions.update(0.05);
  }
  assert.throws(() => cabinetDrawers([]), /drawer missing/);
});

test("picking respects occlusion, hidden geometry and first-person reach", t => {
  const scene = createScene(t), interactions = new RoomInteractions(scene, () => {});
  const lamp = babylon.CreateBox("lamp", {}, scene); lamp.position.z = 4; lamp.isPickable = false; lamp.computeWorldMatrix(true);
  let toggled = 0;
  interactions.addLamp({ id: "lamp", label: "灯", meshes: [lamp] }, () => true, () => toggled++);
  const ray = new babylon.Ray(babylon.Vector3.Zero(), new babylon.Vector3(0, 0, 1), 7.5);
  assert.ok(interactions.pick(ray));
  const blocker = babylon.CreateBox("blocker", {}, scene); blocker.position.z = 2; blocker.isPickable = false;
  blocker.computeWorldMatrix(true);
    assert.equal(interactions.pick(ray), undefined, "static non-pickable furniture must occlude interactions");
    blocker.metadata={exterior:true};assert.ok(interactions.pick(ray),"outdoor geometry must not intercept indoor actions");blocker.metadata=null;
  blocker.setEnabled(false); assert.ok(interactions.pick(ray));
  blocker.setEnabled(true); blocker.isVisible = false; assert.ok(interactions.pick(ray));
  lamp.position.z = 10; lamp.computeWorldMatrix(true); assert.equal(interactions.pick(ray), undefined, "out-of-reach lamps must not activate");
  ray.length = 100; interactions.pick(ray).toggle(); assert.equal(toggled, 1);
});

test("lamp switches independently restore direct light and their own emission", t => {
  const scene = createScene(t), lighting = new RoomLighting(scene), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable(); furnishings.floorLamp(); furnishings.finish();
  const desk = scene.getMaterialByName("desk-lamp-glow"), floor = scene.getMaterialByName("floor-lamp-shade");
  lighting.bindLamp("desk-lamp", desk); lighting.bindLamp("floor-lamp", floor);
  const deskGlow = desk.emissiveColor.clone(), floorGlow = floor.emissiveColor.clone();
  const candle = scene.getMaterialByName("shade").emissiveColor.clone();
  lighting.toggleLamp("desk-lamp");
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, 0);
  assert.ok(desk.emissiveColor.equals(babylon.Color3.Black()) && floor.emissiveColor.equals(floorGlow));
  assert.ok(lighting.isLampOn("floor-lamp") && !lighting.isLampOn("desk-lamp"));
  lighting.toggleLamp("floor-lamp");
  assert.equal(scene.getLightByName("reading-lamp-light").intensity, 0);
  assert.ok(scene.getMaterialByName("shade").emissiveColor.equals(candle));
  assert.equal(scene.getLightByName("window-daylight").intensity, 3.5);
  lighting.toggleLamp("desk-lamp"); lighting.toggleLamp("floor-lamp");
  assert.equal(scene.getLightByName("banker-lamp-light").intensity, 1.25);
  assert.equal(scene.getLightByName("reading-lamp-light").intensity, 3.3);
  assert.ok(desk.emissiveColor.equals(deskGlow) && floor.emissiveColor.equals(floorGlow));
});


test("the inspectable letter remains a complete independent mesh on its original desk support", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  furnishings.writingTable();
  const letter = scene.getMeshByName("letter"), geometry = letter.geometry;
  const world = letter.computeWorldMatrix(true).clone();
  const material = letter.material;
  furnishings.finish();
  assert.equal(furnishings.inspectables.length, 1);
  const item = furnishings.inspectables[0];
  assert.equal(item.id, "desk-letter"); assert.equal(item.mesh, letter);
  assert.equal(letter.geometry, geometry); assert.equal(letter.material, material);
  assert.ok(letter.computeWorldMatrix(true).equalsWithEpsilon(world));
  assert.ok(letter.isWorldMatrixFrozen && letter.receiveShadows);
  assert.equal(letter.getTotalVertices(), 17 * 23 * 2, "the full creased sheet must be retained");
});

test("inspection centres and fits the actual shared geometry, restores the original camera and releases only preview resources", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  const originalCamera = new babylon.UniversalCamera("walking", new babylon.Vector3(4, 1, 10), scene);
  originalCamera.rotation.set(0.3, 1.2, 0);
  furnishings.writingTable(); furnishings.finish();
  const item = furnishings.inspectables[0], texture = item.mesh.material.albedoTexture;
  const world = item.mesh.computeWorldMatrix(true).clone();
  const inspection = new RoomItemInspection(scene);
  scene.activeCamera = originalCamera;
  const counts = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };
  let width = 1280, height = 720;
  scene.getEngine().getRenderWidth = () => width; scene.getEngine().getRenderHeight = () => height;
  for (let iteration = 0; iteration < 5; iteration++) {
    assert.ok(inspection.open(item)); assert.equal(inspection.open(item), false, "do not nest or leak duplicate previews");
    const preview = scene.getMeshByName("inspection-desk-letter");
    assert.equal(preview.geometry, item.mesh.geometry);
    assert.equal(preview.material.emissiveTexture, texture);
    assert.ok(!preview.checkCollisions && !preview.isPickable && !preview.receiveShadows);
    assert.equal(preview.layerMask & originalCamera.layerMask, 0);
    assert.ok(preview.layerMask & inspection.camera.layerMask);
    assert.deepEqual(Object.keys(inspection.camera.inputs.attached), []);
    for (const dimensions of [[1280, 720], [390, 844], [844, 390]]) {
      [width, height] = dimensions; inspection.resize();
      const transform = inspection.camera.getViewMatrix(true).multiply(inspection.camera.getProjectionMatrix(true));
      const viewport = new babylon.Viewport(0, 0, width, height);
      const bounds = preview.getBoundingInfo().boundingBox;
      const centre = babylon.Vector3.Project(bounds.centerWorld, babylon.Matrix.Identity(), transform, viewport);
      assert.ok(Math.abs(centre.x - width / 2) < 0.001 && Math.abs(centre.y - height / 2) < 0.001);
      for (const corner of bounds.vectorsWorld) {
        const point = babylon.Vector3.Project(corner, babylon.Matrix.Identity(), transform, viewport);
        assert.ok(point.x >= width * 0.08 && point.x <= width * 0.92);
        assert.ok(point.y >= height * 0.18 && point.y <= height * 0.82);
      }
    }
    assert.ok(inspection.close()); assert.equal(inspection.close(), false);
    assert.equal(scene.activeCamera, originalCamera);
    assert.ok(originalCamera.position.equalsWithEpsilon(new babylon.Vector3(4, 1, 10)));
    assert.ok(originalCamera.rotation.equalsWithEpsilon(new babylon.Vector3(0.3, 1.2, 0)));
    assert.ok(item.mesh.computeWorldMatrix(true).equalsWithEpsilon(world));
    assert.equal(scene.meshes.length, counts.meshes); assert.equal(scene.materials.length, counts.materials);
    assert.equal(scene.textures.length, counts.textures); assert.ok(scene.textures.includes(texture));
  }
  inspection.open(item); inspection.dispose();
  assert.equal(scene.activeCamera, originalCamera);
  assert.ok(!scene.cameras.includes(inspection.camera));
  assert.ok(scene.textures.includes(texture), "disposing inspection must preserve the desk letter texture");
});

test("letter inspection uses the existing ray action and preview geometry cannot occlude scene actions", t => {
  const scene = createScene(t), furnishings = new RoomFurnishings(scene);
  new babylon.UniversalCamera("camera", new babylon.Vector3(-3.5, 2, -0.65), scene);
  furnishings.writingTable(); furnishings.finish();
  const item = furnishings.inspectables[0], interactions = new RoomInteractions(scene, () => {});
  let selected;
  interactions.addInspectable(item, value => selected = value);
  item.mesh.computeWorldMatrix(true);
  const centre = item.mesh.getBoundingInfo().boundingBox.centerWorld;
  const ray = new babylon.Ray(centre.add(new babylon.Vector3(0, 4, 0)), new babylon.Vector3(0, -1, 0), 7.5);
  const action = interactions.pick(ray);
  assert.equal(action.label(), "查看桌上的信"); action.toggle(); assert.equal(selected, item);
  const preview = item.mesh.clone("ignored-preview"); preview.unfreezeWorldMatrix(); preview.position.y += 1;
  preview.metadata = { inspectionPreview: true }; preview.computeWorldMatrix(true);
  assert.equal(interactions.pick(ray), action, "preview layer meshes must never intercept room interactions");
});
