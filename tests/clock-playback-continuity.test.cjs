const assert = require('node:assert/strict'), {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomTimeOfDay} = load('RoomTimeOfDay'), {RoomPauseState} = load('RoomPauseState');
const {LighthouseOperation} = load('LighthouseOperation'), {LighthouseInspection} = load('LighthouseInspection');
const {LighthouseMaintenance} = load('LighthouseMaintenance'), {LighthousePower} = load('LighthousePower');
const {encodeLighthouseSave: encode, decodeLighthouseSave: decode, completeLighthouseSession: complete} = load('LighthouseSave');
const {createLighthouseStorySession: createStory, encodeLighthouseStorySave: encodeStory, decodeLighthouseStorySave: decodeStory} = load('LighthouseStorySave');
const {advanceWeatherDuty, synchronizeWeatherDuty} = load('LighthouseWeatherSession');
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
const json = value => JSON.parse(JSON.stringify(value));
function session(full) {
  const s = {clock:new RoomTimeOfDay(), operation:new LighthouseOperation(), inspection:new LighthouseInspection(),
    maintenance:new LighthouseMaintenance(), power:new LighthousePower({mainWh:1500})};
  const e=complete(s, 'duty', 0);synchronizeWeatherDuty(e);return full ? e : s;
}

test('both equipment formats and the story envelope retain explicit playback choices without mutating the live clock', () => {
  for (const automatic of [true,false]) {
    for (const full of [true,false]) {
      const s=session(full); s.clock.setAutomatic(automatic); const raw=encode(s), r=decode(raw);
      assert.equal(r.clock.playback.automatic,automatic); assert.equal(encode(r),raw);
      assert.equal(s.clock.playback.automatic,automatic); assert.equal(r.clock.snapshot.hour,12);
    }
    const s=createStory('playback',0);s.equipment.clock.setAutomatic(automatic);const raw=encodeStory(s),r=decodeStory(raw);
    assert.equal(r.equipment.clock.playback.automatic,automatic);assert.equal(encodeStory(r),raw);
  }
});

test('legacy V1, V2 and story checkpoints default to automatic at the exact saved time with no offline catch-up', () => {
  for (const full of [false,true]) {
    const saved=JSON.parse(encode(session(full)));delete saved.automatic;
    const r=decode(JSON.stringify(saved));assert.equal(r.clock.playback.automatic,true);
    assert.equal(r.clock.snapshot.hour,saved.hour);assert.deepEqual(json(r.operation.exportState()),saved.operation);
    r.clock.advance(3600);assert.equal(r.clock.snapshot.hour,saved.hour);assert.equal(r.clock.lastAdvance.automaticHours,0);
    r.clock.advance(.1);near(r.clock.snapshot.hour,saved.hour+.1/60);
  }
  const saved=JSON.parse(encodeStory(createStory('legacy',0)));delete saved.equipment.automatic;
  const r=decodeStory(JSON.stringify(saved));assert.equal(r.equipment.clock.playback.automatic,true);
  assert.deepEqual(json(r.story.exportState()),saved.story);
});

test('optional playback fields reject non-boolean values in all existing save envelopes', () => {
  for (const bad of [null,0,1,'true',{},[]]) {
    for (const full of [false,true]) {
      const raw=JSON.parse(encode(session(full)));raw.automatic=bad;assert.throws(()=>decode(JSON.stringify(raw)));
    }
    const raw=JSON.parse(encodeStory(createStory('invalid',0)));raw.equipment.automatic=bad;
    assert.throws(()=>decodeStory(JSON.stringify(raw)));
  }
});

test('loaded automatic time and actual energy freeze for overlapping reading pauses, then resume only after all owners close', () => {
  for (const automatic of [true,false]) {
    const original=session(true);original.clock.setAutomatic(automatic);const s=decode(encode(original)),pauses=new RoomPauseState();
    const step=(dt=.1)=>{s.clock.advance(dt,pauses.blocked,pauses.transitionBlocked);advanceWeatherDuty(s,s.clock.lastAdvance);synchronizeWeatherDuty(s);};
    pauses.set('story-panel',true);pauses.set('lighthouse-panel',true);step(3600);
    const before=encode(s);for(let i=0;i<50;i++)step();assert.equal(encode(s),before);
    pauses.set('story-panel',false);for(let i=0;i<50;i++)step();assert.equal(encode(s),before);
    pauses.set('lighthouse-panel',false);s.clock.resetDelta();step(3600);assert.equal(encode(s),before);
    for(let i=0;i<100;i++)step();
    near(s.clock.snapshot.hour,12+(automatic?1/6:0));near(s.weather.acceptedAutomaticHours,automatic?1/6:0);
    assert.equal(s.power.snapshot.mainWh>1500,automatic);
  }
});
