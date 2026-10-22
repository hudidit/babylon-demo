const assert = require('node:assert/strict');
const {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomTimeOfDay} = load('RoomTimeOfDay');
const {LighthouseOperation, lighthouseNavigationRequired: required} = load('LighthouseOperation');
const {RoomPauseState} = load('RoomPauseState');
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

function fixture(hour = 12) {
  const clock = new RoomTimeOfDay(), operation = new LighthouseOperation();
  const select = hour => {clock.select(hour); operation.selectTime(clock.snapshot.hour);};
  select(hour);
  const step = (seconds, paused = false, transitionPaused = paused, visible = true) => {
    clock.advance(seconds, paused, transitionPaused); operation.advance(clock.lastAdvance, visible);
    return operation.snapshot;
  };
  const run = (seconds, dt = .1, visible = true) => {
    const count = Math.round(seconds / dt);
    for (let i = 0; i < count; i++) step(dt, false, false, visible);
    return operation.snapshot;
  };
  const automatic = () => {clock.setAutomatic(true); step(.1);};
  step(.1);
  return {clock, operation, select, step, run, automatic};
}

test('default noon is session-local standby; schedule includes 18:00 and excludes 06:00 precisely', () => {
  assert.deepEqual([0, 5 + 59 / 60, 6, 17 + 59 / 60, 18, 23.999, 24, -6].map(required),
    [true, true, false, false, true, true, true, true]);
  const one = new LighthouseOperation(), two = new LighthouseOperation();
  assert.equal(one.snapshot.hour, 12); assert.equal(one.snapshot.state, 'day-standby');
  assert.equal(one.snapshot.dutyDay, 1); assert.equal(one.snapshot.mode, 'automatic');
  assert.equal(one.snapshot.automaticOperatingHours, 0);
  one.startTest(); assert.equal(two.snapshot.running, false);
  assert.equal(new RoomTimeOfDay().playback.automatic, true);
});

test('clock receipts distinguish accepted automatic hours, active seconds, manual fades, skips and invalid frames', () => {
  const f = fixture(); f.automatic(); f.step(.05);
  near(f.clock.lastAdvance.automaticHours, .05 / 60); near(f.clock.lastAdvance.activeSeconds, .05);
  assert.equal(f.clock.lastAdvance.midnightCrossings, 0);
  const before = f.operation.snapshot;
  for (const invalid of [NaN, Infinity, -1, undefined, '1']) {
    f.step(invalid); assert.equal(f.clock.lastAdvance.automaticHours, 0);
    assert.equal(f.clock.lastAdvance.activeSeconds, 0); assert.equal(f.operation.snapshot, before);
  }
  f.step(3600); near(f.clock.lastAdvance.activeSeconds, .1); near(f.clock.lastAdvance.automaticHours, .1 / 60);
  f.clock.resetDelta(); f.step(3600); assert.equal(f.clock.lastAdvance.activeSeconds, 0);
  f.clock.transitionTo(21); f.step(.1, true, false);
  assert.equal(f.clock.lastAdvance.automaticHours, 0); assert.equal(f.clock.lastAdvance.activeSeconds, 0);
  assert.equal(f.clock.lastAdvance.manualCompleted, false);
  for (let i = 0; i < 11; i++) f.step(.1, true, false);
  assert.equal(f.clock.lastAdvance.manualCompleted, true); assert.equal(f.operation.snapshot.hour, 21);
});

test('automatic 17:59→18:00 and 05:59→06:00 produce exact objective events once', () => {
  const f = fixture(15); f.automatic(); f.run(179);
  assert.equal(f.operation.snapshot.state, 'day-standby'); near(f.operation.snapshot.hour, 17 + 59 / 60);
  f.run(1); assert.equal(f.operation.snapshot.state, 'night-running');
  let event = f.operation.snapshot.events.filter(e => e.type === 'state-changed').at(-1);
  assert.equal(event.hour, 18); assert.equal(event.source, 'automatic-clock');
  near(f.operation.snapshot.automaticOperatingHours, 0);
  f.select(3); f.automatic(); f.run(179);
  assert.equal(f.operation.snapshot.state, 'night-running');
  f.run(1); assert.equal(f.operation.snapshot.state, 'day-standby');
  event = f.operation.snapshot.events.filter(e => e.type === 'state-changed').at(-1);
  assert.equal(event.hour, 6); assert.equal(event.result, 'day-standby');
  const count = f.operation.snapshot.events.length; f.run(1);
  assert.equal(f.operation.snapshot.events.length, count);
});

test('midnight advances duty day only from accepted automatic time, without restarting the beacon', () => {
  const f = fixture(21); f.automatic(); f.run(180);
  assert.equal(f.clock.lastAdvance.midnightCrossings, 1);
  assert.equal(f.operation.snapshot.dutyDay, 2); assert.equal(f.operation.snapshot.hour, 0);
  near(f.operation.snapshot.automaticOperatingHours, 3);
  const event = f.operation.snapshot.events.at(-1);
  assert.equal(event.type, 'duty-day-started'); assert.equal(event.hour, 0); assert.equal(event.dutyDay, 2);
  assert.equal(f.operation.snapshot.events.filter(e => e.type === 'state-changed').length, 1);
  const old = f.operation.snapshot;
  for (const h of [21, 0, 12, 0, 21, 0]) f.select(h);
  assert.equal(f.operation.snapshot.dutyDay, old.dutyDay);
  assert.equal(f.operation.snapshot.automaticOperatingHours, old.automaticOperatingHours);
  assert.equal(f.operation.snapshot.rotationTurns, old.rotationTurns);
});

test('device rotation keeps a thirty-active-second period with manual night time and unequal frame sizes', () => {
  for (const dt of [.1, .05, .02, 1 / 60]) {
    const f = fixture(21); f.run(30, dt); near(f.operation.snapshot.rotationTurns, 0);
    f.run(7.5, dt); near(f.operation.snapshot.rotationTurns, .25);
    assert.equal(f.operation.snapshot.hour, 21); assert.equal(f.operation.snapshot.automaticOperatingHours, 0);
    f.run(7.5, dt); near(f.operation.snapshot.rotationTurns, .5);
    f.run(15, dt); near(f.operation.snapshot.rotationRadians, 0);
  }
});

test('daytime test lasts sixty active seconds, repeat start does not extend it, and ending is idempotent', () => {
  const f = fixture(); assert.equal(f.operation.startTest(), true); f.run(5);
  const previous = f.operation.snapshot;
  assert.equal(f.operation.startTest(), false); assert.equal(f.operation.snapshot, previous);
  f.run(54.9); assert.equal(f.operation.snapshot.state, 'test-running');
  f.step(.1); assert.equal(f.operation.snapshot.state, 'day-standby');
  assert.equal(f.operation.snapshot.testSecondsRemaining, 0);
  near(f.operation.snapshot.rotationTurns, 0); assert.equal(f.operation.endTest(), false);
  assert.equal(f.operation.snapshot.events.filter(e => e.type === 'test-expired').length, 1);
  f.operation.startTest(); f.run(1); const phase = f.operation.snapshot.rotationTurns;
  assert.equal(f.operation.endTest(), true); assert.equal(f.operation.endTest(), false);
  f.run(5); near(f.operation.snapshot.rotationTurns, phase);
});

test('night tests and timeout preserve navigation state, phase and original start event', () => {
  const f = fixture(21); f.run(2); f.operation.startTest(); f.run(1);
  assert.equal(f.operation.snapshot.state, 'night-running'); near(f.operation.snapshot.rotationTurns, .1);
  f.operation.endTest(); f.operation.startTest(); f.run(60);
  assert.equal(f.operation.snapshot.state, 'night-running');
  near(f.operation.snapshot.rotationTurns, .1);
  assert.equal(f.operation.snapshot.events.filter(e => e.type === 'state-changed').length, 1);
});

test('18:00 takes over daytime test, while a valid night test can continue after 06:00', () => {
  const f = fixture(15); f.automatic(); f.run(179); f.operation.startTest(); f.run(1);
  assert.equal(f.operation.snapshot.state, 'night-running'); assert.equal(f.operation.snapshot.mode, 'automatic');
  assert.equal(f.operation.snapshot.testSecondsRemaining, 0);
  assert.equal(f.operation.snapshot.events.filter(e => e.type === 'test-superseded').length, 1);
  f.select(3); f.automatic(); f.run(179); f.operation.startTest(); f.run(1);
  assert.equal(f.operation.snapshot.state, 'test-running'); near(f.operation.snapshot.testSecondsRemaining, 59);
  f.run(59); assert.equal(f.operation.snapshot.state, 'day-standby');
  const event = f.operation.snapshot.events.filter(e => e.type === 'test-expired').at(-1);
  near(event.hour, 6 + 59 / 60);
});

test('one clock frame splits schedule crossings and test expiry without counting a stopped segment as running', () => {
  const f = fixture(15); f.automatic(); f.run(179.95, .05);
  f.step(.1); assert.equal(f.operation.snapshot.state, 'night-running');
  near(f.operation.snapshot.rotationTurns, .05 / 30); near(f.operation.snapshot.automaticOperatingHours, .05 / 60);
  f.select(12); f.step(.1); f.operation.startTest(); f.run(59.95, .05);
  const before = f.operation.snapshot.rotationTurns; f.step(.1);
  assert.equal(f.operation.snapshot.state, 'day-standby');
  near(f.operation.snapshot.rotationTurns, (before + .05 / 30) % 1);
});

test('manual fades settle once, can be retargeted and cannot create a day, work hours or intermediate schedule events', () => {
  const f = fixture(21); f.run(1); f.clock.transitionTo(3);
  for (let i = 0; i < 5; i++) f.step(.1, true, false);
  assert.equal(f.operation.snapshot.hour, 21); assert.equal(f.operation.snapshot.dutyDay, 1);
  f.clock.transitionTo(12);
  for (let i = 0; i < 12; i++) f.step(.1, true, false);
  assert.equal(f.operation.snapshot.hour, 12); assert.equal(f.operation.snapshot.state, 'day-standby');
  assert.equal(f.operation.snapshot.dutyDay, 1); assert.equal(f.operation.snapshot.automaticOperatingHours, 0);
  near(f.operation.snapshot.rotationTurns, 1 / 30);
  assert.equal(f.operation.snapshot.events.filter(e => e.type === 'time-selected').length, 2);
  f.select(12); assert.equal(f.operation.snapshot.events.filter(e => e.type === 'time-selected').length, 2);
});

test('overlapping pauses freeze phase and test; return frame and invalid deltas do not catch up', () => {
  const f = fixture(), pauses = new RoomPauseState(); f.operation.startTest(); f.run(2);
  const before = f.operation.snapshot;
  pauses.set('map', true); pauses.set('hidden', true); f.clock.resetDelta();
  for (let i = 0; i < 10; i++) f.step(3600, pauses.blocked, pauses.transitionBlocked);
  assert.equal(f.operation.snapshot, before);
  pauses.set('map', false); f.step(3600, pauses.blocked, pauses.transitionBlocked);
  assert.equal(f.operation.snapshot, before);
  pauses.set('hidden', false); f.clock.resetDelta(); f.step(3600);
  assert.equal(f.operation.snapshot, before);
  f.step(.05); near(f.operation.snapshot.testSecondsRemaining, 57.95);
});

test('coast hiding freezes visible motion/test while the shared automatic calendar and schedule stay synchronized', () => {
  const f = fixture(15); f.automatic(); f.run(179); f.operation.startTest();
  f.run(1, .1, false);
  assert.equal(f.operation.snapshot.state, 'night-running'); assert.equal(f.operation.snapshot.rotationTurns, 0);
  assert.equal(f.operation.snapshot.hour, 18);
  f.run(360, .1, false); assert.equal(f.operation.snapshot.dutyDay, 2);
  f.run(1); near(f.operation.snapshot.rotationTurns, 1 / 30);
});

test('daily log keeps seven duty days with monotonic IDs; pruning preserves phase, calendar and work hours', () => {
  const f = fixture(21); f.automatic(); f.run(180);
  for (let day = 2; day < 10; day++) {f.select(21); f.automatic(); f.run(180);}
  const s = f.operation.snapshot;
  assert.equal(s.dutyDay, 10); near(s.automaticOperatingHours, 27);
  assert.deepEqual([...new Set(s.events.map(e => e.dutyDay))], [4, 5, 6, 7, 8, 9, 10]);
  assert.ok(s.events[0].id > 1);
  for (let i = 1; i < s.events.length; i++) assert.ok(s.events[i].id > s.events[i - 1].id);
  assert.ok(s.events.every(e => e.objectId === 'lighthouse-beacon-main'));
});

test('complete 24-minute automatic cycles agree across uniform and unequal steps, with one accepted midnight', () => {
  const results = [];
  for (const steps of [[.1], [.02], [.03, .07]]) {
    const f = fixture(); f.automatic(); let midnights = 0;
    const cycles = Math.round(1440 / steps.reduce((sum, dt) => sum + dt, 0));
    for (let i = 0; i < cycles; i++) for (const dt of steps) {f.step(dt); midnights += f.clock.lastAdvance.midnightCrossings;}
    const s = f.operation.snapshot;
    assert.equal(midnights, 1); assert.equal(s.dutyDay, 2); assert.equal(s.state, 'day-standby');
    near(s.hour, 12); near(s.automaticOperatingHours, 12); near(s.rotationTurns, 0);
    results.push(s.events);
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
});

test('all snapshots, receipts and log entries are immutable; rejected selections leave state unchanged', () => {
  const f = fixture(), previous = f.operation.snapshot;
  const frozen = value => {assert.ok(Object.isFrozen(value)); Object.values(value).filter(v => v && typeof v === 'object').forEach(frozen);};
  frozen(previous); frozen(f.clock.lastAdvance);
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '18']) {
    assert.throws(() => f.operation.selectTime(invalid), RangeError); assert.equal(f.operation.snapshot, previous);
  }
  f.operation.startTest(); assert.equal(previous.state, 'day-standby'); assert.equal(previous.events.length, 1);
  assert.equal(Reflect.set(f.operation.snapshot.events[0], 'result', 'night-running'), false);
});

test('Room updates lighthouse even with a frozen manual hour and guards all mutations after disposal', () => {
  const {RoomScene} = load('Room'), room = Object.create(RoomScene.prototype);
  room.timeState = new RoomTimeOfDay(); room.lighthouseState = new LighthouseOperation(); room.pauses = new RoomPauseState();
  room.lighthouseMaintenanceState = new(load('LighthouseMaintenance').LighthouseMaintenance)();
  room.lighthousePowerState = new(load('LighthousePower').LighthousePower)();
  room.weatherState = new(load('LighthouseRisk').LighthouseWeatherRisk)({seed:1,fixedWeather:'clear'});
  room.rain = {apply:()=>{}};
  room.lighthousePanel = {};
  room.scene = {metadata: {timeOfDay: {}, lighthouseOperation: {stage: 1, visualApplied: false}}};
  room.scene.activeCamera={globalPosition:{}};
  room.exterior = {isVisible: true, lighthouseDetails: {beacon:{root:{position:{x:0,z:0}},apply:()=>{}},equipment:{apply:()=>{}},cover:{pane:{},apply:()=>{}}}}; room.timeVisualElapsed = 0;
  room.firstPersonCamera = {position:{x:0,z:1}}; room.lighthouseInspectionState = new(load('LighthouseInspection').LighthouseInspection)();
  room.canObserveLighthouse = () => false; room.canObserveBackup = () => false;
  room.lighthousePanel.render = () => {}; room.lighthousePanel.renderActivity = () => {};
  room.applyTimeOfDay = () => {}; room.onTimeOfDayChange = () => {};
  room.setTimeOfDay(21); room.restoredDiscovery=true;room.updateTimeOfDay(.1); room.updateTimeOfDay(.1);
  assert.equal(room.restoredDiscovery,false,'accepted active time rebinds location even when automatic time is off');
  near(room.lighthouseOperation.rotationTurns, .1 / 30);
  assert.equal(room.lighthouseOperation, room.scene.metadata.lighthouseOperation.state);
  room.startLighthouseTest(); const before = room.lighthouseOperation;
  room.disposed = true;
  assert.equal(room.startLighthouseTest(), false); assert.equal(room.endLighthouseTest(), false);
  room.setTimeOfDay(12); room.transitionTimeOfDay(6); room.setTimeAutomatic(true); room.updateTimeOfDay(100);
  assert.equal(room.lighthouseOperation, before);
  assert.equal(room.scene.metadata.lighthouseOperation.visualApplied, true);
});
