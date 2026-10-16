const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/examples', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => load(id.slice(2)), module, module.exports);
  cache.set(name, module.exports); return module.exports;
}
const layout = load('HouseLayout');
const { HOUSE_ROOMS, HOUSE_DOORS, HOUSE_LAYOUT_VERSION, planToWorld, worldToPlan, roomLocalToWorld, roomInnerBounds } = layout;
const { HouseRooms } = load('HouseRooms');
const { LEGACY_LAYOUT_VERSION, legacyRoomAt } = load('RoomLayout');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('pure immutable layout has stable unique room/door IDs without runtime state', () => {
  assert.equal(new Set(HOUSE_DOORS.map(door => door.id)).size, HOUSE_DOORS.length);
  assert.equal(HOUSE_DOORS.find(door => door.from === 'study').id, 'connecting-door');
  assert.ok(Object.isFrozen(HOUSE_ROOMS) && Object.isFrozen(HOUSE_DOORS));
  assert.ok(HOUSE_ROOMS.every(room => Object.isFrozen(room) && !('hasContent' in room)));
  assert.ok(HOUSE_DOORS.every(Object.isFrozen));
  assert.equal(typeof global.document, 'undefined');
  assert.ok(!Object.keys(require.cache).some(key => key.includes('@babylonjs/core')));
});

test('metric coordinates round-trip across rooms, outer corners and balcony; legacy locations stay separate', () => {
  for (const room of HOUSE_ROOMS) for (const [x, y] of [[room.x, room.y], [room.x + room.width, room.y + room.depth]]) {
    const world = planToWorld({ x, y }); const back = worldToPlan(world);
    near(back.x, x); near(back.y, y); near(world.y, -5);
    const local = roomLocalToWorld(room.id, { x: x - room.x, y: y - room.y });
    near(local.x, world.x); near(local.z, world.z);
  }
  near(planToWorld({ x: 0, y: 0 }).x, -27);
  near(planToWorld({ x: 10.8, y: 12.3 }).z, 34.5);
  near(planToWorld({ x: 5.4, y: 5.4 }, 1.6).y, 3);
  assert.equal(legacyRoomAt({ x: 37, z: 16 }), 'living');
  assert.equal(legacyRoomAt({ x: 4, z: 16 }), 'study');
  assert.equal(legacyRoomAt({ x: 100, z: 0 }), undefined);
  assert.equal(legacyRoomAt({ x: 25, z: 100 }), undefined);
  const bounds = roomInnerBounds('study');
  near(bounds.minX, 5.45); near(bounds.maxX, 8.35);
  assert.throws(() => roomInnerBounds('study', -1));
  assert.throws(() => roomInnerBounds('study', 3));
});

test('ready legacy content does not claim that the target layout is built', () => {
  const rooms = new HouseRooms(LEGACY_LAYOUT_VERSION, legacyRoomAt);
  assert.equal(rooms.snapshot('master').state, 'planned');
  const build = rooms.begin('study'); rooms.setState(build, 'ready');
  assert.equal(rooms.isReadyForLayout('study'), false);
  assert.equal(rooms.isReadyForLayout('study', LEGACY_LAYOUT_VERSION), true);
  assert.equal(rooms.roomAt({ x: 0, z: 16 }), 'study');
  const target = new HouseRooms();
  assert.equal(target.roomAt(planToWorld({ x: 6.5, y: 1 })), 'study');
  assert.equal(target.layoutVersion, HOUSE_LAYOUT_VERSION);
  assert.deepEqual(target.contentRoomIds(), []);
  target.setState(target.begin('master'), 'shell');
  assert.deepEqual(target.contentRoomIds(), [], 'an empty shell must not be presented as furnished');
  rooms.dispose(); target.dispose();
});

test('replaced/disposed builds discard late resources and never register stale readiness', async () => {
  const rooms = new HouseRooms();
  const first = rooms.begin('study');
  let cleanup = 0, resolve;
  const pending = new Promise(done => resolve = done).then(resource => rooms.own(first, resource, () => cleanup++));
  const next = rooms.begin('study');
  resolve({}); assert.equal(await pending, false); assert.equal(cleanup, 1);
  assert.equal(rooms.setState(first, 'ready'), false);
  assert.equal(rooms.setState(next, 'ready'), true);
  rooms.dispose();
  assert.equal(rooms.own(next, {}, () => cleanup++), false);
  assert.equal(cleanup, 2); assert.throws(() => rooms.begin('study'));
});

test('shared resources release only after the last owner; actions/children clean up in reverse order', () => {
  const rooms = new HouseRooms(), events = [];
  const study = rooms.begin('study'), living = rooms.begin('living');
  const shared = {};
  rooms.own([study, living], shared, () => events.push('shared'));
  rooms.own(study, {}, () => events.push('root'));
  rooms.own(study, {}, () => events.push('mesh'));
  rooms.own(study, {}, () => events.push('action'));
  rooms.own(study, shared, () => events.push('duplicate'));
  rooms.release('study'); assert.deepEqual(events, ['action', 'mesh', 'root']);
  rooms.release('living'); assert.deepEqual(events, ['action', 'mesh', 'root', 'shared']);
  rooms.dispose(); rooms.dispose(); assert.equal(events.length, 4);
});

test('a failed room retains available resources and does not break another room; retry clears the old generation', () => {
  const rooms = new HouseRooms(); let cleaned = 0, changes = 0;
  const unsubscribe = rooms.subscribe(() => changes++);
  const study = rooms.begin('study'), living = rooms.begin('living');
  rooms.own(study, {}, () => cleaned++); rooms.setState(living, 'ready');
  rooms.fail(study, new Error('missing model'));
  assert.equal(cleaned, 0); assert.equal(rooms.setState(study, 'ready'), false);
  assert.match(rooms.snapshot('study').error, /missing model/);
  assert.equal(rooms.isReadyForLayout('living'), true);
  const retry = rooms.begin('study'); assert.equal(cleaned, 1);
  assert.equal(rooms.snapshot('study').error, undefined);
  assert.equal(rooms.isCurrent(study), false); rooms.setState(retry, 'ready');
  unsubscribe(); const before = changes; rooms.dispose(); assert.equal(changes, before);
});

test('cleanup failures are retained for diagnostics without leaking the remaining room resources', () => {
  const rooms = new HouseRooms(); const study = rooms.begin('study'), living = rooms.begin('living');
  let cleaned = 0;
  rooms.own(study, {}, () => cleaned++);
  rooms.own(study, {}, () => { throw new Error('cleanup fixture'); });
  rooms.own(living, {}, () => cleaned++);
  rooms.dispose();
  assert.equal(cleaned, 2); assert.equal(rooms.cleanupErrors.length, 1);
  assert.match(String(rooms.cleanupErrors[0]), /cleanup fixture/);
});
