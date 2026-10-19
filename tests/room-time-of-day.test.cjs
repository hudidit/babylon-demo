const assert = require('node:assert/strict');
const {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {TIME_OF_DAY_PRESETS: presets, RoomTimeOfDay, evaluateTimeOfDay: at, wrapTimeOfDay: wrap,
  timeSourceDirection: direction} = load('RoomTimeOfDay');
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));

test('eight immutable nodes match the designed solar and lunar tracks and retain linear colour data', () => {
  assert.deepEqual(presets.map(p => p.hour), [0, 3, 6, 9, 12, 15, 18, 21]);
  assert.deepEqual(presets.map(p => p.sun.elevation), [-60, -35, 5, 35, 65, 35, 5, -35]);
  assert.deepEqual(presets.map(p => p.moon.elevation), [50, 25, -5, -35, -60, -35, -5, 25]);
  assert.deepEqual(presets.map(p => p.sun.azimuth), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(presets.map(p => p.moon.azimuth), [180, 225, 270, 315, 0, 45, 90, 135]);
  const frozen = object => {assert.ok(Object.isFrozen(object)); for (const value of Object.values(object)) if (value && typeof value === 'object') frozen(value);};
  frozen(presets); frozen(at(12));
  assert.equal(Reflect.set(presets[4].sun, 'elevation', 0), false);
  assert.equal(Reflect.set(at(0).moon.sourceDirection, '1', -1), false);
  near(at(6).sun.color[1], Math.pow((208 / 255 + .055) / 1.055, 2.4));
  near(at(0).sky.zenith[0], Math.pow((16 / 255 + .055) / 1.055, 2.4));
});

test('world directions and opposite light vectors put noon shadows north and sunrise/sunset shadows west/east', () => {
  const morning = at(6).sun, noon = at(12).sun, evening = at(18).sun;
  near(noon.sourceDirection[0], 0); near(noon.sourceDirection[1], Math.sin(65 * Math.PI / 180));
  near(noon.sourceDirection[2], Math.cos(65 * Math.PI / 180));
  assert.ok(morning.sourceDirection[0] > .99 && morning.lightDirection[0] < -.99);
  assert.ok(evening.sourceDirection[0] < -.99 && evening.lightDirection[0] > .99);
  for (const hour of [0, 3, 6, 9, 12, 15, 18, 21]) for (const body of [at(hour).sun, at(hour).moon]) {
    near(Math.hypot(...body.sourceDirection), 1);
    body.sourceDirection.forEach((n, i) => near(body.lightDirection[i], -n));
  }
  near(Math.hypot(noon.sourceDirection[0], noon.sourceDirection[2]) / noon.sourceDirection[1], .4663076581549986);
  near(Math.hypot(morning.sourceDirection[0], morning.sourceDirection[2]) / morning.sourceDirection[1], 11.430052302761343);
});

test('midnight uses a weak above-horizon moon instead of reversing or recolouring a subterranean sun', () => {
  const midnight = at(0), night = at(21), dawn = at(6), noon = at(12);
  assert.equal(midnight.sun.enabled, false); assert.equal(midnight.sun.intensity, 0);
  assert.ok(midnight.sun.sourceDirection[1] < 0);
  assert.equal(midnight.primary, midnight.moon); near(midnight.primary.intensity, .152);
  assert.equal(night.primary.kind, 'moon'); assert.equal(dawn.primary.kind, 'sun'); assert.equal(noon.primary.kind, 'sun');
  for (const hour of [5.55, 18.4]) {
    const state = at(hour);
    assert.equal(state.primary, null); assert.equal(state.sun.intensity, 0); assert.equal(state.moon.intensity, 0);
    assert.ok(state.environment.exterior > 0, 'twilight retains indirect sky illumination');
  }
  for (let i = 0; i < 24 * 60; i++) {
    const state = at(i / 60);
    assert.ok(!(state.sun.enabled && state.moon.enabled), 'only one direct light may be active');
    for (const body of [state.sun, state.moon]) if (body.elevation <= 0) assert.equal(body.intensity, 0);
  }
  assert.ok(at(5.7).sun.intensity > 0 && at(5.7).sun.intensity < at(6).sun.intensity);
});

test('continuous evaluation wraps midnight clockwise and interpolates light in linear space', () => {
  const before = at(23.999999), after = at(.000001);
  assert.ok(distance(before.sun.sourceDirection, after.sun.sourceDirection) < .000001);
  assert.ok(distance(before.moon.sourceDirection, after.moon.sourceDirection) < .000001);
  assert.ok(before.sun.azimuth > 359 && after.sun.azimuth < 1);
  near(at(10.5).sun.azimuth, 157.5); near(at(10.5).sun.elevation, 50);
  near(at(10.5).sun.strength, .9);
  for (let c = 0; c < 3; c++) near(at(10.5).sun.color[c], (at(9).sun.color[c] + at(12).sun.color[c]) / 2);
  near(at(22.5).environment.exterior, .19);
  assert.equal(at(23.9).periodHour, 21); assert.equal(at(24).periodHour, 0);
  for (const [input, expected] of [[24, 0], [48, 0], [-24, 0], [-3, 21], [25.5, 1.5], [-.5, 23.5], [-1e-20, 0]]) near(wrap(input), expected);
  assert.equal(Object.is(wrap(-0), -0), false);
  assert.deepEqual(at(-3), at(21));
});

test('manual selection is atomic, scene-local, node-only and cannot be changed through an old snapshot', () => {
  const one = new RoomTimeOfDay(), two = new RoomTimeOfDay();
  assert.equal(one.snapshot.hour, 12); assert.equal(one.snapshot.periodName, '正午');
  const noon = one.snapshot;
  assert.equal(one.select(12), noon, 'selecting the same node preserves snapshot identity');
  assert.equal(one.select(6).hour, 6); assert.equal(one.select(0).primary.kind, 'moon');
  assert.equal(noon.hour, 12); assert.equal(two.snapshot.hour, 12);
  for (const hour of [3, 9, 15, 18, 21, 12, 6, 0]) assert.equal(one.select(hour).hour, hour);
  const current = one.snapshot;
  for (const invalid of [7, 1.5, NaN, Infinity, -Infinity, undefined, null, '6']) {
    assert.throws(() => one.select(invalid), RangeError); assert.equal(one.snapshot, current);
  }
  assert.equal(one.select(24).hour, 0); assert.equal(one.select(-3).hour, 21);
  assert.equal(two.snapshot, two.select(12));
});

test('invalid evaluation and angles fail explicitly instead of producing NaN lighting values', () => {
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '12']) assert.throws(() => at(invalid), RangeError);
  for (const angles of [[NaN, 5], [0, Infinity], [0, 91], [0, -91]]) assert.throws(() => direction(...angles), RangeError);
  near(distance(direction(0, 0), [0, 0, -1]), 0);
  near(distance(direction(90, 0), [1, 0, 0]), 0);
  near(distance(direction(270, 0), [-1, 0, 0]), 0);
});
