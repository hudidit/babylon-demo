const assert = require('node:assert/strict');
const {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {TIME_OF_DAY_PRESETS: presets, RoomTimeOfDay, evaluateTimeOfDay: at, wrapTimeOfDay: wrap,
  timeSourceDirection: direction, blendTimeOfDay: blend} = load('RoomTimeOfDay');
const {RoomPauseState} = load('RoomPauseState');
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

test('manual fades change sun/moon direction only while dark and preserve direct-source exclusivity', () => {
  for (const [a, b] of [[12, 0], [0, 6], [6, 18], [21, 3]]) for (const reduced of [false, true]) {
    const from = at(a), to = at(b);
    assert.equal(blend(from, to, 0, reduced), from); assert.equal(blend(from, to, 1, reduced), to);
    for (let i = 1; i < 100; i++) {
      const t = i / 100, state = blend(from, to, t, reduced);
      assert.ok(!(state.sun.enabled && state.moon.enabled));
      for (const body of [state.sun, state.moon]) {
        near(Math.hypot(...body.sourceDirection), 1);
        if (body.elevation <= 0) assert.equal(body.intensity, 0);
      }
      if (reduced || from.primary.kind !== to.primary.kind) {
        if (state.primary) assert.deepEqual(state.primary.sourceDirection, (t < .5 ? from : to).primary.sourceDirection);
        if (t === .5) assert.equal(state.primary, null);
      }
    }
  }
  near(blend(at(6), at(18), .5).sun.azimuth, 180);
  near(blend(at(18), at(6), .5).sun.azimuth, 180);
});

test('manual transitions last 1.2 seconds, retarget the displayed state and reject invalid targets atomically', () => {
  const clock = new RoomTimeOfDay(); clock.transitionTo(0);
  for (let i = 0; i < 4; i++) clock.advance(.1, true);
  const displayed = clock.snapshot;
  assert.equal(clock.playback.targetHour, 0); assert.ok(displayed.environment.exterior < 1);
  clock.transitionTo(6); assert.equal(clock.snapshot, displayed);
  const playback = clock.playback;
  for (const invalid of [7, NaN, null, '6']) {
    assert.throws(() => clock.transitionTo(invalid), RangeError); assert.deepEqual(clock.playback, playback); assert.equal(clock.snapshot, displayed);
  }
  for (let i = 0; i < 11; i++) clock.advance(.1, true);
  assert.equal(clock.playback.transitioning, true);
  clock.advance(.1, true); assert.equal(clock.playback.transitioning, false); assert.equal(clock.snapshot.hour, 6);
  clock.transitionTo(18, true); clock.advance(.1); assert.equal(clock.snapshot.primary, null);
  clock.advance(.1); assert.equal(clock.playback.transitioning, false); assert.equal(clock.snapshot.hour, 18);
});

test('fresh sessions advance automatically from noon and opting out does not change the next session default', () => {
  const clock = new RoomTimeOfDay();
  assert.equal(clock.playback.automatic, true); assert.equal(clock.snapshot.hour, 12);
  clock.advance(.1); // Startup frame never counts loading or background time.
  for (let i = 0; i < 600; i++) clock.advance(.1);
  near(clock.snapshot.hour, 13); near(clock.lastAdvance.automaticHours, .1 / 60);
  clock.setAutomatic(false); const stopped = clock.snapshot;
  for (let i = 0; i < 100; i++) clock.advance(.1);
  assert.equal(clock.snapshot, stopped); assert.equal(clock.lastAdvance.automaticHours, 0);
  const next = new RoomTimeOfDay(); assert.equal(next.playback.automatic, true); assert.equal(next.snapshot.hour, 12);
});

test('automatic time takes 24 real minutes, wraps midnight clockwise and manual selection stops it', () => {
  const clock = new RoomTimeOfDay(); clock.select(21); clock.setAutomatic(true);
  clock.advance(.1); // First resumed frame is deliberately ignored.
  for (let i = 0; i < 1800; i++) clock.advance(.1);
  assert.ok(Math.min(clock.snapshot.hour, 24 - clock.snapshot.hour) < 1e-9);
  for (let i = 0; i < 1800; i++) clock.advance(.1);
  near(clock.snapshot.hour, 3, 1e-8);
  for (let i = 0; i < 10800; i++) clock.advance(.1);
  near(clock.snapshot.hour, 21, 1e-8);
  const current = clock.snapshot;
  clock.setAutomatic(false); clock.advance(.1); clock.advance(.1); assert.equal(clock.snapshot, current);
  clock.setAutomatic(true); clock.advance(.1); clock.advance(.1); assert.ok(clock.snapshot.hour > current.hour);
  clock.transitionTo(12); assert.equal(clock.playback.automatic, false);
});

test('long frames and background restoration never catch up the clock, including invalid deltas', () => {
  const clock = new RoomTimeOfDay(); clock.advance(3600);
  assert.equal(clock.snapshot.hour, 12);
  clock.advance(3600); near(clock.snapshot.hour, 12 + .1 / 60);
  const before = clock.snapshot;
  for (const delta of [NaN, Infinity, -1]) assert.equal(clock.advance(delta), before);
  clock.advance(3600, true); assert.equal(clock.snapshot, before);
  clock.resetDelta(); clock.advance(3600); assert.equal(clock.snapshot, before);
  clock.advance(.05); near(clock.snapshot.hour, before.hour + .05 / 60);
});

test('overlapping pause owners resume independently; only the time menu allows a manual fade', () => {
  const pauses = new RoomPauseState(), clock = new RoomTimeOfDay();
  pauses.set('time-menu', true); pauses.set('settings', true); pauses.set('hidden', true);
  assert.equal(pauses.set('hidden', true), false);
  clock.transitionTo(0); clock.advance(.1, pauses.blocked, pauses.transitionBlocked);
  assert.equal(clock.snapshot.hour, 12);
  pauses.set('settings', false); assert.equal(pauses.blocked, true); assert.equal(pauses.transitionBlocked, true);
  pauses.set('hidden', false); assert.equal(pauses.transitionBlocked, false);
  for (let i = 0; i < 12; i++) clock.advance(.1, pauses.blocked, pauses.transitionBlocked);
  assert.equal(clock.snapshot.hour, 0);
  clock.setAutomatic(true); clock.advance(.1); clock.advance(.1, pauses.blocked); assert.equal(clock.snapshot.hour, 0);
  assert.equal(Reflect.set(pauses.snapshot, '0', 'external'), false);
  pauses.set('time-menu', false); assert.equal(pauses.blocked, false);
  clock.resetDelta(); clock.advance(.1, pauses.blocked); clock.advance(.1, pauses.blocked); assert.ok(clock.snapshot.hour > 0);
});

test('stars fade with the solar horizon gate, stay absent in daylight and wrap midnight with linear cloud colours', () => {
  assert.deepEqual(presets.map(p => at(p.hour).sky.starVisibility), [1, .9, 0, 0, 0, 0, 0, .7]);
  for (let i = 0; i < 2400; i++) {
    const state = at(i / 100);
    assert.ok(state.sky.starVisibility >= 0 && state.sky.starVisibility <= 1);
    if (state.sun.elevation >= -4) assert.equal(state.sky.starVisibility, 0);
  }
  // The artistic solar track reaches -4 and -12 degrees at these continuous hours.
  const dawnOff = 3 + 31 / 40 * 3, duskOn = 18 + 9 / 40 * 3, duskFull = 18 + 17 / 40 * 3;
  near(at(dawnOff).sky.starVisibility, 0); near(at(duskOn).sky.starVisibility, 0);
  assert.ok(at(dawnOff - .01).sky.starVisibility > 0 && at(duskOn + .01).sky.starVisibility > 0);
  for (const hour of [dawnOff, duskOn, duskFull, 3 + 23 / 40 * 3, 0, 3, 6, 18, 21, 24]) {
    const before = at(hour - 1e-6).sky, after = at(hour + 1e-6).sky;
    near(before.starVisibility, after.starVisibility, 1e-5);
    for (const key of ['cloudLight', 'cloudShade']) assert.ok(distance(before[key], after[key]) < 1e-5);
  }
  near(at(12).sky.cloudLight[0], Math.pow((246 / 255 + .055) / 1.055, 2.4));
  for (const key of ['cloudLight', 'cloudShade']) for (let c = 0; c < 3; c++)
    near(at(10.5).sky[key][c], (at(9).sky[key][c] + at(12).sky[key][c]) / 2);
  assert.ok(Object.isFrozen(at(0).sky.cloudLight) && Object.isFrozen(at(0).sky.cloudShade));
});

test('manual cloud/star fades blend the displayed values instead of evaluating an unrelated intermediate hour', () => {
  for (const reduced of [false, true]) for (const [fromHour, toHour] of [[12, 0], [0, 6], [6, 18], [21, 3]]) {
    const from = at(fromHour), to = at(toHour);
    for (const t of [.1, .49, .5, .51, .9]) {
      const state = blend(from, to, t, reduced);
      near(state.sky.starVisibility, from.sky.starVisibility + (to.sky.starVisibility - from.sky.starVisibility) * t);
      for (const key of ['cloudLight', 'cloudShade']) for (let c = 0; c < 3; c++)
        near(state.sky[key][c], from.sky[key][c] + (to.sky[key][c] - from.sky[key][c]) * t);
    }
  }
  // 12 -> 00 passes the numerical hour 06 halfway through, but still displays half the target stars.
  near(blend(at(12), at(0), .5).sky.starVisibility, .5);
  const clock = new RoomTimeOfDay(); clock.transitionTo(0);
  for (let i = 0; i < 5; i++) clock.advance(.1);
  const displayed = clock.snapshot;
  clock.transitionTo(6); assert.equal(clock.snapshot, displayed);
  clock.advance(.1);
  assert.ok(clock.snapshot.sky.starVisibility > 0 && clock.snapshot.sky.starVisibility < displayed.sky.starVisibility);
  clock.transitionTo(18, true);
  clock.advance(.1); assert.ok(clock.snapshot.sky.starVisibility > 0);
  clock.advance(.1); assert.equal(clock.snapshot.sky.starVisibility, 0);
  assert.deepEqual(clock.snapshot.sky.cloudLight, at(18).sky.cloudLight);
});
