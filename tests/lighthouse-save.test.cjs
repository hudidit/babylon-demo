const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomTimeOfDay}=load('RoomTimeOfDay'),{LighthouseOperation}=load('LighthouseOperation'),{LighthouseInspection}=load('LighthouseInspection'),{LighthouseMaintenance}=load('LighthouseMaintenance'),{LighthousePower}=load('LighthousePower');
const {encodeLighthouseSave:encode,decodeLighthouseSave:decode,LighthouseSave,LIGHTHOUSE_SAVE_KEY:key}=load('LighthouseSave');
function fixture(session='normal'){
 const f={clock:new RoomTimeOfDay(),operation:new LighthouseOperation(),inspection:new LighthouseInspection(),maintenance:new LighthouseMaintenance(session),power:new LighthousePower()};
 f.clock.restore(session==='drive'?21:12.512345);f.operation.selectTime(f.clock.snapshot.hour);
 f.sync=()=>{f.power.synchronize(f.operation.snapshot,f.maintenance.snapshot);const p=f.power.snapshot;f.maintenance.configurePower(p.mainAllowed,p.trialAllowed,p.backupAvailable,f.operation.snapshot,p.exerciseComplete);f.maintenance.synchronize(f.operation);f.power.synchronize(f.operation.snapshot,f.maintenance.snapshot);f.inspection.synchronize(f.operation.snapshot);};
 f.step=(dt=.1,sight=true)=>{f.clock.advance(dt);const before=f.operation.snapshot,frame=f.clock.lastAdvance;f.power.advance(frame,before,f.maintenance.snapshot);f.sync();f.operation.advance(frame);f.maintenance.advance(frame,f.operation,{action:sight,backup:true,main:true,mainOutput:1});f.power.advanceAction(frame,f.operation.snapshot,f.maintenance.snapshot,sight,f.clock.playback.automatic,()=>{});f.inspection.advance(frame,before,f.operation.snapshot,{cover:sight,optic:true,output:1});f.sync();};
 f.run=n=>{for(let i=0;i<Math.round(n*10);i++)f.step();};f.sync();f.step();return f;
}
const serial=s=>JSON.parse(encode(s));
function memory(initial=null){let raw=initial;return{getItem:k=>{assert.equal(k,key);return raw;},setItem:(k,v)=>{assert.equal(k,key);raw=v;},removeItem:k=>{assert.equal(k,key);raw=null;},get raw(){return raw;}};}

test('one slot restores exact fractional time, committed evidence, resources and event identifiers without offline catch-up',()=>{
 const f=fixture();f.inspection.confirmControl(f.operation.snapshot,true);f.inspection.inspectCover(f.operation.snapshot,true);
 f.inspection.startCleaning(f.operation.snapshot,true);f.run(1.5);f.inspection.inspectCover(f.operation.snapshot,true);
 const raw=encode(f),restored=decode(raw);assert.deepEqual(serial(restored),JSON.parse(raw));
 assert.equal(restored.clock.snapshot.hour,12.512345);assert.equal(restored.clock.playback.automatic,false);
 const before=restored.clock.snapshot;restored.clock.advance(3600);assert.equal(restored.clock.snapshot,before);restored.clock.advance(.1);assert.equal(restored.clock.snapshot,before);
 assert.equal(restored.inspection.snapshot.dirty,false);assert.equal(restored.inspection.snapshot.checks['check-cover'],'complete');
 const events=restored.inspection.snapshot.events;restored.inspection.invalidateMain(restored.operation.snapshot);assert.ok(restored.inspection.snapshot.events.at(-1).id>events.at(-1).id);
 const storage=memory(),slot=new LighthouseSave(()=>storage);assert.equal(slot.inspect().available,false);assert.equal(slot.save(f).available,true);assert.ok(slot.load().session);assert.equal(JSON.parse(storage.raw).version,2);
});

test('saving an unfinished wipe or transaction restores pre-commit state without inventing completion or consuming resources',()=>{
 const f=fixture();f.inspection.inspectCover(f.operation.snapshot,true);f.inspection.startCleaning(f.operation.snapshot,true);f.run(.7);
 assert.equal(f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true),true);f.run(.5);
 const before=f.power.snapshot,restored=decode(encode(f));assert.equal(restored.inspection.snapshot.cleaning,false);assert.equal(restored.inspection.snapshot.dirty,true);
 assert.equal(restored.maintenance.snapshot.action,undefined);assert.deepEqual(restored.maintenance.snapshot.inventory,f.maintenance.snapshot.inventory);assert.equal(restored.power.snapshot.mainWh,before.mainWh);
 const g=fixture();g.power.command('refuel','lighthouse-generator','meter',true,false,g.operation.snapshot,g.maintenance.snapshot);g.run(1);
 const resumed=decode(encode(g));assert.equal(resumed.power.snapshot.action,undefined);assert.equal(resumed.power.snapshot.fuel,4);assert.equal(resumed.power.snapshot.reserveFuel,8);
});

test('legacy thirty-second test saves retain their remaining time, phase and committed ten-second observation text',()=>{
 const f=fixture();f.inspection.confirmControl(f.operation.snapshot,true);f.inspection.inspectCover(f.operation.snapshot,true);
 f.inspection.startCleaning(f.operation.snapshot,true);f.run(1.5);f.inspection.inspectCover(f.operation.snapshot,true);f.operation.startTest();f.run(30);
 const saved=serial(f),oldResult='本次周期观察正常：连续10活跃秒、转台一圈及方向出光';
 saved.operation.testRemaining=12.75;saved.operation.turns=.625;saved.inspection.optic.result=oldResult;
 saved.inspection.events.findLast(e=>e.type==='optic-observed').result=oldResult;
 const restored=decode(JSON.stringify(saved));assert.deepEqual(serial(restored),saved);
 assert.equal(restored.operation.snapshot.testSecondsRemaining,12.75);assert.equal(restored.operation.snapshot.rotationTurns,.625);
 assert.equal(restored.inspection.snapshot.completed,true);assert.equal(restored.inspection.snapshot.optic.result,oldResult);
 restored.operation.advance({fromHour:saved.hour,toHour:saved.hour,automaticHours:0,activeSeconds:.1,midnightCrossings:0,manualCompleted:false});
 assert.ok(Math.abs(restored.operation.snapshot.rotationTurns-(.625+.1/30))<1e-10);
 assert.ok(Math.abs(restored.operation.snapshot.testSecondsRemaining-12.65)<1e-10);
});

test('committed module inventory and fuel transactions remain atomic across repeated save/load and stale proofs stay stale',()=>{
 const f=fixture('drive');f.run(10.1);assert.ok(f.maintenance.snapshot.backupConfirmed);
 const command=(c,tool='meter')=>f.maintenance.command(c,'lighthouse-drive-hatch',tool,f.operation,true);
 command('isolate-main');command('diagnose');f.run(2.1);command('replace','drive-module');f.run(3.1);
 assert.equal(f.maintenance.snapshot.inventory.drive,0);assert.equal(f.maintenance.snapshot.mainVerified,false);
 let restored=decode(encode(f));for(let i=0;i<3;i++)restored=decode(encode(restored));
 assert.equal(restored.maintenance.snapshot.inventory.drive,0);assert.equal(restored.maintenance.snapshot.driveFault,false);assert.equal(restored.maintenance.snapshot.mainIsolated,true);assert.equal(restored.maintenance.snapshot.mainVerified,false);
 const g=fixture();g.power.command('refuel','lighthouse-generator','meter',true,false,g.operation.snapshot,g.maintenance.snapshot);g.run(3.1);
 let r=decode(encode(g));r=decode(encode(r));assert.equal(r.power.snapshot.fuel,8);assert.equal(r.power.snapshot.reserveFuel,4);
});

test('maintenance expiry changes real surfaces/revisions once on accepted day progression; cleaning reschedules and requires recheck',()=>{
 const f=fixture();f.inspection.inspectCover(f.operation.snapshot,true);f.inspection.startCleaning(f.operation.snapshot,true);f.run(1.5);f.inspection.inspectCover(f.operation.snapshot,true);
 const nextDay=()=>{f.operation.advance({fromHour:12.512345,toHour:12.512345,automaticHours:24,activeSeconds:0,midnightCrossings:1,manualCompleted:false});f.sync();};
 const first=f.inspection.snapshot;nextDay();nextDay();assert.equal(f.inspection.snapshot.dirty,false);nextDay();
 assert.equal(f.operation.snapshot.dutyDay,4);assert.equal(f.inspection.snapshot.dirty,true);assert.equal(f.inspection.snapshot.coverRevision,first.coverRevision+1);assert.equal(f.inspection.snapshot.coverEvidence,undefined);
 assert.equal(f.inspection.snapshot.events.filter(e=>e.type==='maintenance-due').length,1);f.sync();f.sync();assert.equal(f.inspection.snapshot.coverRevision,first.coverRevision+1);
 nextDay();nextDay();assert.equal(f.maintenance.snapshot.solarDirty,true);const revision=f.maintenance.snapshot.revision.solar;f.sync();assert.equal(f.maintenance.snapshot.revision.solar,revision);assert.equal(f.maintenance.snapshot.chargerVerified,false);
 assert.equal(f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true),false,'new revision needs a fresh inspection');
 f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.run(2.1);f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true);f.run(2.1);
 assert.equal(f.maintenance.snapshot.solarDirty,false);assert.equal(f.maintenance.snapshot.nextSolarMaintenanceDay,11);assert.ok(f.power.snapshot.solarW>200);
 const restored=decode(encode(f));assert.equal(restored.maintenance.snapshot.nextSolarMaintenanceDay,11);assert.equal(restored.inspection.snapshot.dirty,true);assert.equal(restored.inspection.snapshot.nextMaintenanceDay,4);
});

test('malformed, unknown, excessive, inconsistent and future-revision saves never overwrite an existing slot',()=>{
 const good=serial(fixture());const cases=[null,{}, {...good,version:2},{...good,hour:24},{...good,hour:13},{...good,extra:1}];
 for(const edit of [s=>s.power.mainWh=-1,s=>s.maintenance.inventory.drive=-1,s=>s.inspection.dutyDay=2,s=>s.maintenance.revision.drive=-1,s=>s.operation.available=false,s=>s.inspection.coverStatus='complete',s=>s.maintenance.mainProof=2,s=>{s.power.fuel=0;s.power.generatorRunning=true;}]){
  const s=structuredClone(good);edit(s);cases.push(s);
 }
 for(const value of cases){const raw=JSON.stringify(value),storage=memory(raw),slot=new LighthouseSave(()=>storage);assert.throws(()=>decode(raw));assert.equal(slot.inspect().invalid,true);assert.equal(slot.load().session,undefined);assert.equal(slot.save(fixture()).invalid,true);assert.equal(storage.raw,raw);}
 for(const raw of ['{','x'.repeat(524289)])assert.throws(()=>decode(raw));
 const store=memory('{'),slot=new LighthouseSave(()=>store);slot.clearInvalid();assert.equal(store.raw,null);slot.save(fixture());const raw=store.raw;slot.clearInvalid();assert.equal(store.raw,raw,'healthy saves cannot be removed through the invalid-slot action');
});

test('storage denial, failed writes and time transitions leave the live session and previous data intact',()=>{
 const f=fixture(),before=serial(f),good=encode(f);let raw=good;
 const slot=new LighthouseSave(()=>({getItem:()=>raw,setItem:()=>{throw new Error('QuotaExceeded');},removeItem:()=>{throw new Error('Denied');}}));
 assert.match(slot.save(f).message,/没存上/);assert.equal(raw,good);assert.deepEqual(serial(f),before);
 const blocked=new LighthouseSave(()=>{throw new Error('Denied');});assert.equal(blocked.inspect().available,false);assert.equal(blocked.load().session,undefined);assert.match(blocked.save(f).message,/没存上/);
 const storage=memory(good),transition=new LighthouseSave(()=>storage);f.clock.transitionTo(21);assert.match(transition.save(f).message,/没存上/);assert.equal(storage.raw,good);
});
