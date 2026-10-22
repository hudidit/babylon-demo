const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {createLighthouseStorySession:create,lighthouseStoryContext:context,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode,
  LighthouseStorySave,LIGHTHOUSE_STORY_SAVE_KEY:key}=load('LighthouseStorySave');
const {LighthouseSave,LIGHTHOUSE_SAVE_KEY:explorationKey,LIGHTHOUSE_EXERCISE_SAVE_KEY:exerciseKey,encodeLighthouseSave:encodeEquipment}=load('LighthouseSave');
const {advanceWeatherDuty,synchronizeWeatherDuty,lighthouseDiscoveryFacts}=load('LighthouseWeatherSession');
const copy=x=>JSON.parse(JSON.stringify(x));
function sync(s){const e=s.equipment;e.weather.synchronizeSurface('cover',e.inspection.snapshot.dirty);e.weather.synchronizeSurface('solar',e.maintenance.snapshot.solarDirty);
 synchronizeWeatherDuty(e);e.discovery.synchronize(lighthouseDiscoveryFacts(e),e.weather.acceptedAutomaticHours,null);s.story.synchronize(context(e));}
function active(s,seconds){const e=s.equipment;for(let i=0;i<Math.round(seconds*10);i++){
 const before=e.operation.snapshot,frame={fromHour:e.clock.snapshot.hour,toHour:e.clock.snapshot.hour,automaticHours:0,activeSeconds:.1,midnightCrossings:0,manualCompleted:false};
 advanceWeatherDuty(e,frame);e.inspection.advance(frame,before,e.operation.snapshot,{cover:true,optic:true,output:1});sync(s);
}}
function advance(s,hours){const e=s.equipment;while(hours>1e-10){const h=Math.min(hours,.25),from=e.clock.snapshot.hour,to=(from+h)%24;
 e.clock.restore(to);advanceWeatherDuty(e,{fromHour:from,toHour:to,automaticHours:h,activeSeconds:0,midnightCrossings:Math.floor((from+h)/24),manualCompleted:false});sync(s);hours-=h;
}}
function memory(initial={}){const map=new Map(Object.entries(initial)),access=[];return{map,access,getItem:k=>{access.push(['get',k]);return map.get(k)??null;},
 setItem:(k,v)=>{access.push(['set',k]);map.set(k,v);},removeItem:k=>{access.push(['remove',k]);map.delete(k);}};}
/** Use actual cleaning, independent recheck, test rotation and native inspection events for chapter one's proof. */
function arrival(){const s=create('actual-device-events',0),e=s.equipment,i=e.inspection;
 s.story.readMaterial('CL01');s.story.acceptDuty();i.inspectCover(e.operation.snapshot,true);assert.equal(i.startCleaning(e.operation.snapshot,true),true);active(s,1.5);
 assert.equal(i.snapshot.dirty,false);i.inspectCover(e.operation.snapshot,true);sync(s);
 const cover=i.snapshot.events.findLast(event=>event.type==='cover-observed');
 assert.equal(e.operation.startTest(),true);sync(s);i.confirmControl(e.operation.snapshot,true);active(s,30.1);
 const events=[cover,i.snapshot.events.findLast(event=>event.type==='control-read'),i.snapshot.events.findLast(event=>event.type==='optic-observed')];
 assert.ok(events.every(Boolean));
 for(const event of events.sort((a,b)=>a.id-b.id)){
  const c=context(e),kind={'control-read':'control','optic-observed':'main','cover-observed':'cover'}[event.type];
  assert.equal(s.story.observe({kind,source:'inspection',eventId:event.id,at:0,objectId:event.objectId,revision:c.revisions[kind],problemId:null,method:kind==='main'?'direct-view':'local-panel',
   data:kind==='control'?{mainWh:e.power.snapshot.mainWh,solarWatts:e.power.snapshot.solarW}:kind==='main'?{seconds:i.snapshot.observationSeconds,turns:i.snapshot.observedTurns,outputSeen:i.snapshot.outputSeen,weather:c.weather}:{status:'clear'}}),true);
 }
 assert.equal(s.story.snapshot.objective.id,'ST03');return s;
}

test('independent stories start with explicit identity and deterministic seeds without touching exploration storage',()=>{
 for(const seed of [0,0xffffffff]){const a=create('same-story',seed),b=create('same-story',seed);assert.equal(encode(a),encode(b));assert.equal(a.mode,'story');assert.equal(a.story.snapshot.start.hour,12);assert.equal(a.story.snapshot.transport.plannedAt,72);
  assert.equal(a.equipment.weather.snapshot.random.seed,seed);assert.equal(a.equipment.clock.playback.automatic,false);}
 for(const seed of [-1,NaN,Infinity,0x100000000])assert.throws(()=>create('invalid',seed));
});
test('real device events satisfy the first patrol and retain reports through sent, delivered and read checkpoints',()=>{
 let s=arrival();const hardware=encodeEquipment(s.equipment);assert.equal(s.story.submitReport('arrival'),true);
 for(const command of [null,'deliverReply','readMessage']){if(command)s.story[command](command==='deliverReply'?'arrival-report':'arrival-ack');
  const raw=encode(s),restored=decode(raw);assert.equal(encode(restored),raw);assert.deepEqual(restored.story.snapshot,s.story.snapshot);assert.equal(encodeEquipment(s.equipment),hardware);s=restored;
 }
 assert.equal(s.story.snapshot.objective.id,'ST04');assert.equal(s.story.snapshot.messages.find(m=>m.id==='arrival-report').state,'replied');
});
test('fractional accepted time, weather transition and random streams survive repeated complete-story checkpoints',()=>{
 let a=create('fractional-weather',216),b=decode(encode(a));
 for(let n=0;n<2300;n++){advance(a,.037);advance(b,.037);if(n%7===0)b=decode(encode(b));assert.equal(encode(a),encode(b));}
 assert.equal(a.equipment.operation.snapshot.dutyDay,5);assert.equal(a.story.snapshot.transport.cancelledAt,72);
 const raw=encode(a),resumed=decode(raw);resumed.equipment.clock.advance(1000);assert.equal(encode(resumed),raw);
 assert.equal(resumed.equipment.weather.snapshot.random.streams.weather.draws,a.equipment.weather.snapshot.random.streams.weather.draws);
});
test('saving unfinished actual work discards the action without committing proof, consuming resources or emitting a deferred message',()=>{
 const s=create('interrupted-clean',0),e=s.equipment;e.inspection.inspectCover(e.operation.snapshot,true);assert.equal(e.inspection.startCleaning(e.operation.snapshot,true),true);active(s,.5);
 const before=copy(s.story.exportState()),hardware=encodeEquipment(e),raw=encode(s),r=decode(raw);
 assert.equal(e.inspection.snapshot.cleaning,true);assert.equal(r.equipment.inspection.snapshot.cleaning,false);assert.equal(r.equipment.inspection.snapshot.dirty,true);
 assert.equal(r.story.exportState().context.actionInProgress,false);assert.equal(r.story.snapshot.objective.id,'ST01');assert.deepEqual(s.story.exportState(),before);assert.equal(encodeEquipment(e),hardware);
 assert.deepEqual(r.equipment.weather.snapshot.random,e.weather.snapshot.random);assert.deepEqual(r.equipment.maintenance.snapshot.inventory,e.maintenance.snapshot.inventory);
});
test('story saves use only their own key and neither migrate nor overwrite legacy exploration or exercise data',()=>{
 const store=memory({[explorationKey]:'old-v1-data',[exerciseKey]:'exercise-data'}),slot=new LighthouseStorySave(()=>store),s=create('isolated',0);
 assert.equal(slot.inspect().available,false);assert.equal(slot.save(s).available,true);const raw=store.map.get(key);
 for(let n=0;n<4;n++){assert.equal(slot.inspect().available,true);assert.ok(slot.load().session);assert.equal(store.map.get(key),raw);}
 assert.equal(store.map.get(explorationKey),'old-v1-data');assert.equal(store.map.get(exerciseKey),'exercise-data');assert.ok(store.access.every(([,k])=>k===key));
 assert.equal(new LighthouseSave(()=>store).inspect().invalid,true);
});
test('unknown, corrupt and cross-model saves are retained and cannot replace the live story or any other slot',()=>{
 const s=arrival(),good=JSON.parse(encode(s)),before=s.story.exportState();
 const edits=[v=>v.version=2,v=>v.mode='exercise',v=>v.extra=1,v=>v.equipment.version=1,v=>v.equipment.mode='exercise',v=>v.story.mode='duty',
  v=>v.story.context.elapsedHours=1,v=>v.story.context.revisions.cover++,v=>v.story.context.problems.cover='wrong-problem',v=>v.story.context.weather='fog',
  v=>v.story.context.navigationSource='none',v=>v.story.context.navigationRequired=true,v=>v.story.context.knownCriticalIssues=['invented'],v=>v.story.context.actionInProgress=true,
  v=>v.equipment.operation.dutyDay++,v=>v.equipment.hour=21,v=>v.story.completions[1].facts[1].objectId='different-device'];
 for(const edit of edits){const v=copy(good);edit(v);const raw=JSON.stringify(v);assert.throws(()=>decode(raw),String(edit));
  const store=memory({[key]:raw,[explorationKey]:'exploration'}),slot=new LighthouseStorySave(()=>store);assert.equal(slot.inspect().invalid,true);assert.equal(slot.load().session,undefined);assert.equal(slot.save(s).invalid,true);
  assert.equal(store.map.get(key),raw);assert.equal(store.map.get(explorationKey),'exploration');assert.ok(store.access.every(([,k])=>k===key));
 }
 for(const raw of ['broken','null','x'.repeat(1048577)])assert.throws(()=>decode(raw));assert.deepEqual(s.story.exportState(),before);
});
test('quota, denied reads, failed deletion, time selection and wrong-mode writes preserve old data and live state',()=>{
 const s=create('failure-safe',0),good=encode(s),before=s.story.exportState();let stored=good;
 const failing={getItem:()=>stored,setItem:()=>{throw new Error('quota');},removeItem:()=>{throw new Error('denied');}},slot=new LighthouseStorySave(()=>failing);
 assert.match(slot.save(s).message,/保存失败/);assert.equal(stored,good);assert.deepEqual(s.story.exportState(),before);
 const denied=new LighthouseStorySave(()=>{throw new Error('denied');});assert.equal(denied.load().session,undefined);assert.match(denied.save(s).message,/失败/);
 stored='unknown';assert.match(slot.clearInvalid().message,/保留/);assert.equal(stored,'unknown');
 const store=memory({[key]:good,[explorationKey]:'keep'}),safe=new LighthouseStorySave(()=>store);s.equipment.clock.transitionTo(21);assert.match(safe.save(s).message,/失败/);assert.equal(store.map.get(key),good);
 const wrong=create('wrong-mode',0);wrong.equipment.mode='exercise';assert.match(safe.save(wrong).message,/失败/);wrong.equipment.mode='duty';wrong.mode='duty';assert.match(safe.save(wrong).message,/失败/);
 assert.equal(store.map.get(key),good);assert.equal(store.map.get(explorationKey),'keep');
 const corrupt=memory({[key]:'future',[explorationKey]:'keep'}),clear=new LighthouseStorySave(()=>corrupt);assert.equal(clear.clearInvalid().invalid,false);assert.equal(corrupt.map.has(key),false);assert.equal(corrupt.map.get(explorationKey),'keep');
});
