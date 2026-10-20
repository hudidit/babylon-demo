const assert = require('node:assert/strict'), {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseInspection, LIGHTHOUSE_INSPECTION} = load('LighthouseInspection');
const {LighthouseOperation} = load('LighthouseOperation'), {RoomTimeOfDay} = load('RoomTimeOfDay');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture() {
  const clock = new RoomTimeOfDay(), operation = new LighthouseOperation(), inspection = new LighthouseInspection();
  let sight = {optic: true, cover: true, output: 1};
  const step = (dt = .1, paused = false, visible = true) => {
    clock.advance(dt, paused, paused); const before = operation.snapshot; operation.advance(clock.lastAdvance, visible);
    inspection.advance(clock.lastAdvance, before, operation.snapshot, sight); return inspection.snapshot;
  };
  const run = (seconds, dt = .1) => {for (let i = 0; i < Math.round(seconds / dt); i++) step(dt); return inspection.snapshot;};
  const select = hour => {clock.select(hour); operation.selectTime(hour); inspection.synchronize(operation.snapshot); step();};
  step();
  return {clock, operation, inspection, step, run, select, sight};
}
function prepared() {
  const f = fixture(); f.inspection.inspectCover(f.operation.snapshot, true);
  assert.equal(f.inspection.startCleaning(f.operation.snapshot, true), true); return f;
}

test('fresh session has three unconfirmed checks, deterministic salt, and no invented evidence', () => {
  const f = fixture(), initial = f.inspection.snapshot;
  assert.deepEqual(initial.checks, {'check-control': 'pending', 'check-optic': 'pending', 'check-cover': 'pending'});
  assert.equal(initial.dirty, true); near(initial.transmission, .82); assert.equal(initial.events.length, 0);
  assert.equal(initial.completed, false); assert.equal(new LighthouseInspection().snapshot.dirty, true);
});

test('reading requires local authority; repeated readings refresh time without duplicating a result event', () => {
  const f = fixture(); assert.equal(f.inspection.confirmControl(f.operation.snapshot, false), false);
  assert.equal(f.inspection.inspectCover(f.operation.snapshot, false), false); assert.equal(f.inspection.snapshot.events.length, 0);
  f.inspection.confirmControl(f.operation.snapshot, true); const first = f.inspection.snapshot;
  f.select(15); f.inspection.confirmControl(f.operation.snapshot, true);
  assert.equal(f.inspection.snapshot.control.hour, 15); assert.equal(f.inspection.snapshot.events.length, first.events.length);
  assert.match(first.control.result, /自动值守.*日间待机/); assert.equal(first.control.hour, 12);
  f.select(21); f.inspection.confirmControl(f.operation.snapshot, true);
  assert.match(f.inspection.snapshot.control.result, /夜间导航运行/); assert.equal(f.inspection.snapshot.events.length, 2);
});

test('optic evidence needs ten continuous accepted active seconds, one actual turn and output', () => {
  for (const dt of [.1, .05, .02]) {
    const f = fixture(); f.operation.startTest(); f.run(9.8, dt);
    assert.equal(f.inspection.snapshot.checks['check-optic'], 'pending'); f.run(.2, dt);
    assert.equal(f.inspection.snapshot.checks['check-optic'], 'complete');
    assert.match(f.inspection.snapshot.optic.result, /本次周期观察正常/); near(f.inspection.snapshot.observedTurns, 1);
    const count = f.inspection.snapshot.events.length; f.run(5, dt); assert.equal(f.inspection.snapshot.events.length, count);
  }
  const f = fixture(); f.operation.startTest(); f.sight.output = 0; f.run(12);
  assert.equal(f.inspection.snapshot.optic, undefined);
  f.sight.output = 1; f.step(); assert.ok(f.inspection.snapshot.optic);
});

test('turning away or stopping resets observation; pause freezes it and never supplies missed time', () => {
  const f = fixture(); f.operation.startTest(); f.run(4); near(f.inspection.snapshot.observationSeconds, 4);
  f.step(1000, true); near(f.inspection.snapshot.observationSeconds, 4);
  f.sight.optic = false; f.step(); near(f.inspection.snapshot.observationSeconds, 0);
  f.sight.optic = true; f.run(3); f.operation.endTest(); f.step(); near(f.inspection.snapshot.observationSeconds, 0);
  f.operation.startTest(); f.run(5); f.step(.1, false, false); near(f.inspection.snapshot.observationSeconds, 0);
});

test('a frozen or artificially discontinuous turntable cannot earn an observation by waiting', () => {
  const f = fixture(); f.operation.startTest(); const op = f.operation.snapshot;
  for (let i = 0; i < 200; i++) f.inspection.advance({...f.clock.lastAdvance, activeSeconds: .1}, op, op, f.sight);
  assert.equal(f.inspection.snapshot.optic, undefined); assert.equal(f.inspection.snapshot.observationSeconds, 0);
});

test('cleaning requires a dirty observation and standby; completion changes the surface once, then requires recheck', () => {
  const f = fixture(), op = () => f.operation.snapshot;
  assert.equal(f.inspection.startCleaning(op(), true), false);
  f.inspection.inspectCover(op(), true); assert.equal(f.inspection.startCleaning(op(), false), false);
  assert.equal(f.inspection.startCleaning(op(), true), true); assert.equal(f.inspection.startCleaning(op(), true), false);
  f.run(1.4); assert.equal(f.inspection.snapshot.dirty, true); assert.equal(f.inspection.snapshot.coverRevision, 0);
  f.run(.1); const clean = f.inspection.snapshot;
  assert.equal(clean.dirty, false); assert.equal(clean.transmission, 1); assert.equal(clean.coverRevision, 1);
  assert.equal(clean.checks['check-cover'], 'awaiting-recheck'); assert.equal(clean.coverEvidence.revision, 0);
  assert.equal(f.inspection.startCleaning(op(), true), false);
  f.inspection.inspectCover(op(), true); const checked = f.inspection.snapshot;
  assert.equal(checked.checks['check-cover'], 'complete'); assert.equal(checked.coverEvidence.revision, 1);
  const length = checked.events.length; f.inspection.inspectCover(op(), true); f.run(2);
  assert.equal(f.inspection.snapshot.events.length, length); assert.equal(checked.events.filter(e => e.type === 'cover-cleaned').length, 1);
});

test('cancel, lost contact and interruption at the last cleaning frame preserve dirt and record no completed action', () => {
  for (const reason of ['leave', 'modal', 'ladder']) {
    const f = prepared(); f.run(1.4);
    if (reason === 'leave') {f.sight.cover = false; f.step();} else f.inspection.cancelCleaning(f.operation.snapshot, reason);
    f.run(2); const state = f.inspection.snapshot;
    assert.equal(state.dirty, true); assert.equal(state.coverRevision, 0); assert.equal(state.cleaning, false);
    assert.equal(state.checks['check-cover'], 'dirty'); assert.equal(state.events.filter(e => e.type === 'cover-cleaned').length, 0);
    assert.equal(state.events.filter(e => e.type === 'cleaning-cancelled').length, 1);
    assert.equal(f.inspection.cancelCleaning(f.operation.snapshot, reason), false);
  }
});

test('starting a test or selecting night cancels immediately, and a last-frame 18:00 crossing cannot commit', () => {
  for (const command of ['test', 'night']) {
    const f = prepared(); f.run(1.4);
    if (command === 'test') {f.operation.startTest(); f.inspection.synchronize(f.operation.snapshot);} else f.select(18);
    assert.equal(f.inspection.snapshot.cleaning, false); f.run(2); assert.equal(f.inspection.snapshot.dirty, true);
    assert.equal(f.inspection.startCleaning(f.operation.snapshot, true), false);
  }
  const f = prepared(); f.run(1.4);
  f.operation.selectTime(18 - .05 / 60); // Legitimate schedule boundary fixture; one receipt crosses it.
  const before = f.operation.snapshot, receipt = {...f.clock.lastAdvance, activeSeconds: .1, automaticHours: .1 / 60, toHour: 18 + .05 / 60};
  f.operation.advance(receipt); f.inspection.advance(receipt, before, f.operation.snapshot, f.sight);
  assert.equal(f.operation.snapshot.state, 'night-running'); assert.equal(f.inspection.snapshot.dirty, true);
  assert.equal(f.inspection.snapshot.events.some(e => e.type === 'cover-cleaned'), false);
});

test('three independent checks form the round summary only after cover recheck', () => {
  const f = prepared(); f.run(1.5); f.inspection.confirmControl(f.operation.snapshot, true);
  f.operation.startTest(); f.run(10); assert.equal(f.inspection.snapshot.completed, false);
  f.inspection.inspectCover(f.operation.snapshot, true); assert.equal(f.inspection.snapshot.completed, true);
  assert.equal(f.inspection.snapshot.days[0].completed, true); assert.equal(f.operation.snapshot.state, 'test-running');
});

test('manual time never rebuilds tasks; automatic midnight rebuilds checks and retains the clean physical surface', () => {
  const f = prepared(); f.run(1.5); f.inspection.inspectCover(f.operation.snapshot, true);
  f.inspection.confirmControl(f.operation.snapshot, true);
  for (const hour of [21, 0, 12, 0, 21]) f.select(hour);
  assert.equal(f.inspection.snapshot.dutyDay, 1); assert.equal(f.inspection.snapshot.checks['check-control'], 'complete');
  f.operation.selectTime(23.999); const receipt = {...f.clock.lastAdvance, activeSeconds: .1, automaticHours: .002, toHour: .001};
  const before = f.operation.snapshot; f.operation.advance(receipt); f.inspection.advance(receipt, before, f.operation.snapshot, f.sight);
  const day = f.inspection.snapshot; assert.equal(day.dutyDay, 2); assert.equal(day.dirty, false); assert.equal(day.coverRevision, 1);
  assert.ok(Object.values(day.checks).every(s => s === 'pending')); assert.equal(day.days[0].checks['check-cover'], 'complete');
  f.inspection.inspectCover(f.operation.snapshot, true); assert.equal(f.inspection.snapshot.checks['check-cover'], 'complete');
});

test('seven-day history prunes observations while retaining current checks, revision and monotonic immutable events', () => {
  const f = prepared(); f.run(1.5); const first = f.inspection.snapshot;
  for (let day = 2; day <= 10; day++) {
    f.inspection.synchronize({...f.operation.snapshot, dutyDay: day});
    f.inspection.inspectCover({...f.operation.snapshot, dutyDay: day}, true);
  }
  const s = f.inspection.snapshot; assert.deepEqual(s.days.map(d => d.dutyDay), [4,5,6,7,8,9,10]);
  assert.ok(s.events.every(e => e.dutyDay >= 4)); assert.equal(s.dirty, true); assert.equal(s.coverRevision, 2);
  assert.equal(s.checks['check-cover'], 'dirty'); assert.equal(first.dutyDay, 1); assert.equal(first.events.length, 3);
  assert.ok(Object.isFrozen(s)); assert.ok(Object.isFrozen(s.checks)); assert.ok(Object.isFrozen(s.days));
  assert.ok(s.events.every((event, i) => Object.isFrozen(event) && (!i || event.id > s.events[i-1].id)));
});

test('safe top-floor stand can reach the fixed pane and view optics; looking away, outer glass, walls and floor occlude evidence', t => {
  load('RoomRuntime').registerRoomRuntime(); const b = require('@babylonjs/core/pure');
  const engine = new b.NullEngine(), scene = new b.Scene(engine); scene.useDelayedTextureLoading = true;
  const exterior = new (load('RoomExterior').RoomExterior)(scene), d = exterior.lighthouseDetails;
  t.after(() => {scene.dispose(); engine.dispose();});
  const {LIGHTHOUSE: a} = load('LighthouseLayout'), {COASTAL_SITE: {tower}} = load('CoastalSite'), {planToWorld} = load('HouseLayout');
  const point = (x,y,h) => {const p = planToWorld({x:tower.x+x,y:tower.y+y},h);return new b.Vector3(p.x,p.y,p.z);};
  const eye = point(.25,-1.1,a.gallery+1.6), interactions = new (load('RoomInteractions').RoomInteractions)(scene,()=>{});
  const forward = d.beacon.root.position.subtract(eye).normalize(), optic = {id:'optic',label:'optic',meshes:d.beacon.meshes};
  assert.ok(load('WalkingSurface').walkingPointAllowed({x:tower.x+.25,y:tower.y-1.1},.26,a.gallery));
  assert.equal(interactions.canReachDevice(d.cover.device,eye), true);
  assert.equal(interactions.canReachDevice(optic,eye,7.5,forward,[d.cover.pane]),true);
  assert.equal(interactions.canReachDevice(optic,eye,7.5,forward.scale(-1),[d.cover.pane]),false);
  assert.equal(interactions.canReachDevice(d.cover.device,point(0,-2.5,a.gallery+1.6)),false);
  assert.equal(interactions.canReachDevice(d.cover.device,point(.25,-1.1,a.gallery-1)),false);
  const centre = point(0,0,a.gallery), positions = d.cover.pane.getVerticesData('position');
  for(let i=0;i<positions.length;i+=3) assert.ok(Math.hypot(positions[i]-centre.x,positions[i+2]-centre.z)<=.44*5+1e-4);
  const transform = d.cover.pane.computeWorldMatrix(true).asArray().slice(); d.beacon.apply({...new LighthouseOperation().snapshot,rotationRadians:1});
  assert.deepEqual(d.cover.pane.computeWorldMatrix(true).asArray(),transform);
  const state = new LighthouseInspection().snapshot; d.cover.apply({...state,cleaning:true,cleaningSeconds:.7});
  assert.equal(d.cover.cloth.isEnabled(),true); assert.equal(exterior.shadow.getShadowMap().renderList.includes(d.cover.cloth),false);
  d.cover.apply({...state,dirty:false,coverRevision:1}); assert.equal(d.cover.material._floats.saltAmount,0); assert.equal(d.cover.cloth.isEnabled(),false);
  d.beacon.apply(new LighthouseOperation().snapshot,LIGHTHOUSE_INSPECTION.dirtyTransmission); near(d.beacon.material._floats.surfaceTransmission,.82);
});
