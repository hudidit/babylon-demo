const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {createLighthouseStorySession:create,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode}=load('LighthouseStorySave');
const {LighthouseStoryBridge}=load('LighthouseStoryBridge');
const {advanceWeatherDuty,synchronizeWeatherDuty,lighthouseDiscoveryFacts}=load('LighthouseWeatherSession');
function fixture(restored){
 const s=restored||create('live-chapter-one',0),e=s.equipment,bridge=new LighthouseStoryBridge(s.story,e);
 const sync=()=>{e.weather.synchronizeSurface('cover',e.inspection.snapshot.dirty);e.weather.synchronizeSurface('solar',e.maintenance.snapshot.solarDirty);
  synchronizeWeatherDuty(e);e.inspection.synchronize(e.operation.snapshot);e.discovery.synchronize(lighthouseDiscoveryFacts(e),e.weather.acceptedAutomaticHours,null);bridge.synchronize(e);};
 const run=(seconds,sight={optic:true,cover:true,output:1})=>{for(let n=0;n<Math.round(seconds*10);n++){
  const before=e.operation.snapshot;e.clock.advance(.1);advanceWeatherDuty(e,e.clock.lastAdvance);e.inspection.advance(e.clock.lastAdvance,before,e.operation.snapshot,sight);sync();}};
 const cover=()=>{e.inspection.inspectCover(e.operation.snapshot,true,true);sync();};
 const clean=()=>{cover();assert.equal(e.inspection.startCleaning(e.operation.snapshot,true),true);run(1.5);cover();};
 const control=()=>{e.inspection.confirmControl(e.operation.snapshot,true,true);sync();};
 const observe=()=>{assert.equal(e.operation.startTest(),true);sync();run(30);};
 e.clock.advance(0);sync();return{s,e,bridge,sync,run,cover,clean,control,observe};
}
test('live native events complete chapter one only after actual cleaning, independent recheck and a full observation',()=>{
 const f=fixture(),{s,e}=f;s.story.readMaterial('CL01');s.story.acceptDuty();f.control();f.cover();
 assert.deepEqual(s.story.arrivalChecks,{control:true,main:false,cover:false});
 assert.equal(e.inspection.startCleaning(e.operation.snapshot,true),true);f.run(1.5);
 assert.equal(e.inspection.snapshot.dirty,false);assert.equal(s.story.arrivalChecks.cover,false);
 f.cover();e.operation.startTest();f.sync();f.run(2.9);assert.equal(s.story.arrivalChecks.main,false);f.run(.1);
 assert.equal(s.story.snapshot.objective.id,'ST03');assert.equal(s.story.canSubmitArrival,true);
 assert.equal(s.story.submitReport('arrival'),true);const saved=encode(s),r=fixture(decode(saved));
 assert.equal(r.s.story.deliverReply('arrival-report'),true);assert.equal(r.s.story.snapshot.objective.id,'ST03');
 assert.equal(r.s.story.readMessage('arrival-ack'),true);assert.equal(r.s.story.snapshot.tasks[2].status,'complete');
 assert.equal(r.s.story.snapshot.messages.filter(m=>m.id==='arrival-report').length,1);
});
test('restore and repeated subscriptions cannot turn old events into new current evidence',()=>{
 const f=fixture();f.control();f.clean();f.observe();const before=encode(f.s);
 for(let n=0;n<10;n++)f.sync();assert.equal(encode(f.s),before);
 const r=fixture(decode(before));for(let n=0;n<10;n++)r.sync();assert.equal(encode(r.s),before);
 r.e.inspection.soilFromWeather(r.e.operation.snapshot);r.sync();assert.equal(r.s.story.arrivalChecks.cover,false);
 const cursor=r.s.story.exportState().cursors.inspection;r.bridge.synchronize(r.e);assert.equal(r.s.story.exportState().cursors.inspection,cursor);
});
test('looking away, reading text and interrupted cleaning provide no patrol proof',()=>{
 const f=fixture();f.s.story.readMaterial('CL01');f.s.story.acceptDuty();assert.equal(f.s.story.submitReport('arrival'),false);
 f.cover();assert.equal(f.e.inspection.startCleaning(f.e.operation.snapshot,true),true);f.run(.5);f.run(.1,{optic:false,cover:false,output:0});
 assert.equal(f.e.inspection.snapshot.dirty,true);assert.equal(f.s.story.arrivalChecks.cover,false);
 f.e.operation.startTest();f.sync();f.run(1.4);f.run(.1,{optic:false,cover:false,output:0});f.run(1.4);
 assert.equal(f.s.story.arrivalChecks.main,false);assert.equal(f.s.story.snapshot.objective.id,'ST02');
});
test('later physical revisions invalidate report evidence and an explicit fresh read can renew it',()=>{
 const f=fixture();f.s.story.readMaterial('CL01');f.s.story.acceptDuty();f.control();f.clean();f.observe();
 assert.equal(f.s.story.canSubmitArrival,true);
 // A new, real surface revision must never inherit the preceding clear observation.
 f.e.operation.endTest();f.e.inspection.soilFromWeather(f.e.operation.snapshot);f.sync();
 assert.equal(f.s.story.arrivalChecks.cover,false);assert.equal(f.s.story.canSubmitArrival,false);
 f.clean();f.e.inspection.invalidateMain(f.e.operation.snapshot);f.sync();f.observe();f.control();
 assert.equal(f.s.story.canSubmitArrival,true);assert.equal(f.s.story.submitReport('arrival'),true);
 assert.equal(f.s.story.submitReport('arrival'),false);
});
test('a delayed bridge refuses historical events rather than applying the current revision or time to them',()=>{
 const f=fixture();f.e.inspection.confirmControl(f.e.operation.snapshot,true,true);
 f.e.clock.setAutomatic(true);f.e.clock.advance(0);f.e.clock.advance(.1);advanceWeatherDuty(f.e,f.e.clock.lastAdvance);f.sync();
 assert.equal(f.s.story.arrivalChecks.control,false);
 f.control();assert.equal(f.s.story.arrivalChecks.control,true);
});
