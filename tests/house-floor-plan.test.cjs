const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/examples', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => load(id.slice(2)), module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}
const { HOUSE_ROOMS, HOUSE_DOORS, houseRoomAt } = load('HouseLayout');
const { houseDrawingPoint, houseDrawingHeading, housePlanSvg } = load('HouseFloorPlan');

test('map left/right and north agree with an actual north-up left-handed camera projection', () => {
  const { Matrix, Vector3, Viewport } = require('@babylonjs/core/pure');
  const { planToWorld } = load('HouseLayout');
  const view = Matrix.LookAtLH(new Vector3(0,100,0), Vector3.Zero(), new Vector3(0,0,-1));
  const transform = view.multiply(Matrix.OrthoLH(70,70,.1,200));
  const project = point => Vector3.Project(Vector3.FromArray(Object.values(planToWorld(point))),Matrix.Identity(),transform,new Viewport(0,0,600,600));
  for(const a of HOUSE_ROOMS)for(const b of HOUSE_ROOMS) {
    const pa={x:a.x+a.width/2,y:a.y+a.depth/2},pb={x:b.x+b.width/2,y:b.y+b.depth/2};
    assert.equal(Math.sign(houseDrawingPoint(pa.x,pa.y).x-houseDrawingPoint(pb.x,pb.y).x),Math.sign(project(pa).x-project(pb).x));
    assert.equal(Math.sign(houseDrawingPoint(pa.x,pa.y).y-houseDrawingPoint(pb.x,pb.y).y),Math.sign(project(pa).y-project(pb).y));
  }
  for(const compact of [true,false]) {
    const svg=housePlanSvg(compact);
    assert.ok(!svg.includes('<text transform="scale(-1'), 'room text must stay readable');
    for(const d of HOUSE_DOORS) {
      const p=houseDrawingPoint(d.x,d.y);
      assert.ok(svg.includes(`translate(${p.x} ${p.y}) scale(-1 1) rotate(${d.axis==='y'?90:0})`),d.id);
    }
  }
});

test('map heading follows the same projected movement in all four cardinal directions', () => {
  const origin=houseDrawingPoint(5.4,5.4);
  for(const d of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]) {
    const end=houseDrawingPoint(5.4+d.x,5.4+d.z);
    const projected=Math.atan2(end.x-origin.x,-(end.y-origin.y))*180/Math.PI;
    assert.ok(Math.cos((houseDrawingHeading(d)-projected)*Math.PI/180)>1-1e-9);
  }
});

test('revised plan has a direct living-room entry, a compact study and a larger master bedroom', () => {
  assert.equal(HOUSE_ROOMS.length, 8);
  assert.ok(!HOUSE_ROOMS.some(room => /hall|corridor/.test(room.id) || /过廊|走廊/.test(room.name)));
  const entry = HOUSE_DOORS.filter(door => door.to === 'outside');
  assert.equal(entry.length, 1); assert.equal(entry[0].from, 'living');
  const study = HOUSE_ROOMS.find(room => room.id === 'study'), master = HOUSE_ROOMS.find(room => room.id === 'master');
  assert.ok(study.width * study.depth >= 8 && study.width * study.depth <= 12, 'study should have a normal compact floor area');
  assert.ok(master.width * master.depth > 4.6 * 4.4, 'master must be enlarged from the first draft');
  assert.ok(master.width * master.depth > study.width * study.depth * 2);
  assert.ok(HOUSE_ROOMS.every(room => !('hasContent' in room)), 'runtime status must not be stored in layout geometry');
  // The former corridor is part of the continuous living rectangle: entry has no intervening partition.
  const living = HOUSE_ROOMS.find(room => room.id === 'living');
  for (const y of [entry[0].y + entry[0].width / 2, living.y + living.depth / 2])
    for (const t of [.1, .5, .9]) assert.equal(houseRoomAt(living.x + living.width * t, y).id, 'living');
});

test('floor spans do not overlap and every doorway lies on both connected room boundaries', () => {
  for (const [i, a] of HOUSE_ROOMS.entries()) {
    assert.ok(a.width > 0 && a.depth > 0);
    for (const b of HOUSE_ROOMS.slice(i + 1)) {
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
      assert.ok(w < 1e-8 || h < 1e-8, `${a.id} overlaps ${b.id}`);
    }
  }
  for (const door of HOUSE_DOORS) for (const id of [door.from, door.to].filter(id => id !== 'outside')) {
    const room = HOUSE_ROOMS.find(room => room.id === id);
    assert.ok(room, `unknown room ${id}`);
    const axis = door.axis, other = axis === 'x' ? 'y' : 'x';
    const span = axis === 'x' ? room.width : room.depth, otherSpan = axis === 'x' ? room.depth : room.width;
    assert.ok(Math.abs(door[other] - room[other]) < 1e-8 || Math.abs(door[other] - room[other] - otherSpan) < 1e-8,
      `${door.from}-${door.to} is not on ${id}'s wall`);
    assert.ok(door[axis] >= room[axis] - 1e-8 && door[axis] + door.width <= room[axis] + span + 1e-8,
      `${door.from}-${door.to} extends past ${id}'s wall`);
  }
});

test('every room is reachable from the entry and the private bathroom only connects to the master bedroom', () => {
  const seen = new Set(['outside']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const door of HOUSE_DOORS) if (seen.has(door.from) || seen.has(door.to)) {
      if (!seen.has(door.from) || !seen.has(door.to)) changed = true;
      seen.add(door.from); seen.add(door.to);
    }
  }
  for (const room of HOUSE_ROOMS) assert.ok(seen.has(room.id), `${room.id} has no route from the entry`);
  const ensuite = HOUSE_DOORS.filter(door => door.from === 'ensuite' || door.to === 'ensuite');
  assert.equal(ensuite.length, 1);
  assert.ok(ensuite.some(door => door.from === 'master' || door.to === 'master'));
  const publicBath = HOUSE_DOORS.filter(door => door.from === 'bathroom' || door.to === 'bathroom');
  assert.equal(publicBath.length, 1);
  assert.ok(publicBath.some(door => door.from === 'living' || door.to === 'living'), 'public bathroom must open outside the master bedroom');
  for (const id of ['master', 'bedroom', 'study', 'kitchen'])
    assert.ok(HOUSE_DOORS.some(door => [door.from, door.to].includes(id) && [door.from, door.to].includes('living')),
      `${id} should be reached without passing through another private room`);
});
