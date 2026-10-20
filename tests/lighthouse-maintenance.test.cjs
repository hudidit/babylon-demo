const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseOperation}=load('LighthouseOperation'),{RoomTimeOfDay}=load('RoomTimeOfDay'),{LighthouseMaintenance}=load('LighthouseMaintenance');
const ids={drive:'lighthouse-drive-hatch',backup:'lighthouse-beacon-backup',charger:'lighthouse-solar-charger',solar:'lighthouse-solar-array',sensor:'lighthouse-light-sensor'};
function setup(session='normal',hour=session==='drive'?21:12){
 const clock=new RoomTimeOfDay(),op=new LighthouseOperation(),m=new LighthouseMaintenance(session);
 const select=h=>{clock.select(h);op.selectTime(h);m.synchronize(op);};select(hour);
 const tick=(dt=.05,sight={},paused=false)=>{clock.advance(dt,paused,paused);m.synchronize(op);op.advance(clock.lastAdvance);m.advance(clock.lastAdvance,op,{action:true,backup:true,main:true,mainOutput:1,...sight});assert.ok(!(op.snapshot.running&&m.snapshot.backupOn),'main / backup interlock');};
 const run=(sec,sight,paused)=>{for(let i=0;i<Math.round(sec/.05);i++)tick(.05,sight,paused);};tick();
 const cmd=(command,id='drive',tool='meter',accessible=true)=>m.command(command,ids[id]||id,tool,op,accessible);
 const action=(command,id='drive',tool='meter')=>{assert.equal(cmd(command,id,tool),true,m.snapshot.notice);run(5);assert.equal(m.snapshot.action,undefined);};
 return {clock,op,m,select,tick,run,cmd,action};
}
test('drive drill requires actual backup, isolated diagnosis, correct replacement and one real main cycle before restore',()=>{
 const f=setup('drive'),{op,m,cmd,run,action}=f;
 assert.equal(op.snapshot.running,false);assert.equal(m.snapshot.source,'backup');
 assert.equal(cmd('isolate-main'),false);assert.equal(cmd('self-test','backup'),false);
 run(5);run(.1,{backup:false});run(5);assert.equal(m.snapshot.backupConfirmed,false);
 run(5.1);assert.equal(m.snapshot.backupConfirmed,true);assert.equal(cmd('isolate-main'),true);
 assert.equal(cmd('replace','drive','drive-module'),false);action('diagnose');
 assert.equal(cmd('replace','drive','charger-module'),false);assert.equal(m.snapshot.inventory.drive,1);
 assert.equal(cmd('replace','drive','drive-module'),true);assert.equal(cmd('replace','drive','drive-module'),false);run(1);m.cancel(op.snapshot);assert.equal(m.snapshot.inventory.drive,1);assert.equal(m.snapshot.driveFault,true);
 action('replace','drive','drive-module');assert.equal(m.snapshot.inventory.drive,0);assert.equal(m.snapshot.driveFault,false);assert.equal(op.snapshot.running,false);
 assert.equal(cmd('replace','drive','drive-module'),false);assert.equal(m.snapshot.inventory.drive,0);assert.equal(cmd('trial'),false);
 action('diagnose');assert.equal(cmd('restore'),false);assert.equal(cmd('trial'),true);assert.equal(m.snapshot.source,'main');assert.equal(m.snapshot.backupOn,false);
 assert.equal(cmd('trial'),false);assert.equal(cmd('diagnose'),false);assert.equal(cmd('restore'),false);
 run(5);run(.1,{main:false});run(5);assert.equal(m.snapshot.mainVerified,false);run(5.1);assert.equal(m.snapshot.mainVerified,true);
 assert.equal(cmd('restore'),true);assert.equal(m.snapshot.resolved,true);assert.equal(m.snapshot.source,'main');
 assert.ok(m.snapshot.evidence.some(e=>e.component==='drive'&&e.revision===0&&e.method==='隔离检测'));
 assert.ok(m.snapshot.evidence.some(e=>e.component==='drive'&&e.revision===1&&e.method==='试机复验'));
});
test('self-test is a separate 12-second local test and cannot supply actual takeover proof',()=>{
 const {m,op,cmd,run,select}=setup();assert.equal(cmd('self-test','backup'),true);run(10.1);
 assert.equal(m.snapshot.backupConfirmed,false);assert.ok(m.snapshot.evidence.some(e=>e.method==='自检复验'));
 assert.equal(cmd('takeover','backup'),true);run(1);assert.equal(m.snapshot.backupConfirmed,false);
 select(21);assert.equal(cmd('isolate-main'),false);run(9.1);assert.equal(m.snapshot.backupConfirmed,true);assert.equal(cmd('isolate-main'),true);
 assert.equal(op.snapshot.running,false);
 const g=setup();g.cmd('self-test','backup');g.run(12.1);assert.equal(g.m.snapshot.backupOn,false);assert.equal(g.m.snapshot.source,'none');
});
test('backup flash phase is 10 active seconds, 0.8 bright and pauses do not catch up',()=>{
 const f=setup('drive');assert.equal(f.m.snapshot.backupFlash,true);f.run(.8);assert.equal(f.m.snapshot.backupFlash,false);
 const phase=f.m.snapshot.backupPhase;f.run(20,{},true);assert.equal(f.m.snapshot.backupPhase,phase);assert.equal(f.m.snapshot.backupConfirmed,false);
 f.clock.resetDelta();f.tick(3600);assert.equal(f.m.snapshot.backupPhase,phase);f.tick();assert.ok(f.m.snapshot.backupPhase>phase);
 f.run(9.2);assert.equal(f.m.snapshot.backupFlash,true);
});
test('trial timeout returns to isolation and backup; frozen phase and absent output cannot pass verification',()=>{
 const f=setup('drive');f.run(10);f.cmd('isolate-main');f.action('diagnose');f.action('replace','drive','drive-module');f.action('diagnose');f.cmd('trial');
 f.run(10,{mainOutput:0});assert.equal(f.m.snapshot.mainVerified,false);
 const phase=f.op.snapshot.rotationTurns;
 for(let i=0;i<220;i++)f.m.advance({activeSeconds:.05},f.op,{action:true,main:true,backup:true,mainOutput:1});
 assert.equal(f.op.snapshot.rotationTurns,phase);assert.equal(f.m.snapshot.mainVerified,false);
 f.run(20.1,{main:false});assert.equal(f.m.snapshot.trial,false);assert.equal(f.m.snapshot.mainIsolated,true);assert.equal(f.m.snapshot.source,'backup');assert.equal(f.cmd('restore'),false);
});
test('charger drill excludes surface dirt, diagnoses a separate module and measures actual test-circuit energy before resolving',()=>{
 const f=setup('charger'),{m,cmd,action}=f;assert.equal(m.snapshot.outputW,0);
 action('probe','charger');assert.equal(m.snapshot.chargerVerified,false);assert.equal(cmd('isolate-charge','charger'),true);assert.equal(cmd('diagnose','charger'),false);
 action('inspect','solar');assert.equal(cmd('clean','solar','meter'),false);action('clean','solar','cloth');assert.equal(m.snapshot.outputW,0);
 assert.equal(cmd('diagnose','charger'),false,'changed surface must be rechecked');action('inspect','solar');action('diagnose','charger');
 assert.equal(cmd('replace','charger','drive-module'),false);action('replace','charger','charger-module');assert.equal(m.snapshot.inventory.charger,0);assert.equal(cmd('reconnect','charger'),false);
 action('diagnose','charger');assert.equal(cmd('reconnect','charger'),true);assert.equal(m.snapshot.outputW,200);assert.equal(m.snapshot.resolved,false);
 action('probe','charger');assert.equal(m.snapshot.chargerVerified,true);assert.equal(m.snapshot.resolved,true);
 const record=m.snapshot.evidence.at(-1);assert.match(record.result,/0\.2014Wh/);assert.match(record.result,/非主电池/);
 assert.equal(cmd('isolate-charge','charger'),true);assert.equal(m.snapshot.chargerVerified,false);assert.equal(m.snapshot.resolved,false);
});
test('sensor drill requires a controlled daytime override, surface observation and tool retest with override withdrawn; night remains authoritative',()=>{
 const {m,op,select,cmd,action}=setup('sensor');assert.equal(op.snapshot.running,true);assert.equal(m.snapshot.detectedDemand,true);
 action('verify-sensor','sensor');assert.equal(m.snapshot.sensorVerified,false);action('inspect','sensor');assert.equal(cmd('clean','sensor','cloth'),false);
 assert.equal(cmd('override-on','control'),true);assert.equal(op.snapshot.running,false);
 select(21);assert.equal(op.snapshot.running,true);assert.equal(cmd('override-on','control'),false);assert.equal(cmd('clean','sensor','cloth'),false);
 select(12);action('clean','sensor','cloth');action('inspect','sensor');assert.equal(cmd('verify-sensor','sensor'),false);
 assert.equal(m.snapshot.resolved,false);assert.equal(cmd('override-off','control'),true);action('verify-sensor','sensor');assert.equal(m.snapshot.resolved,true);
 select(21);assert.equal(op.snapshot.running,true);assert.equal(m.snapshot.backupOn,false);
});
test('unavailable backup blocks night isolation and maintenance; automatic main fallback and inspection invalidation use actual facts',()=>{
 const f=setup('drive');f.run(10);f.cmd('isolate-main');f.action('diagnose');f.cmd('replace','drive','drive-module');f.run(1);
 f.m.setBackupAvailable(false,f.op.snapshot);f.tick();assert.equal(f.m.snapshot.action,undefined);assert.equal(f.m.snapshot.inventory.drive,1);assert.equal(f.m.snapshot.source,'none');
 const g=setup('normal',21);g.cmd('takeover','backup');assert.equal(g.op.snapshot.running,false);g.m.setBackupAvailable(false,g.op.snapshot);g.tick();assert.equal(g.op.snapshot.running,true);assert.equal(g.m.snapshot.source,'main');
 const flip=setup('drive');flip.run(10);assert.equal(flip.m.snapshot.backupConfirmed,true);flip.m.setBackupAvailable(false,flip.op.snapshot);flip.m.setBackupAvailable(true,flip.op.snapshot);flip.tick();assert.equal(flip.m.snapshot.backupConfirmed,false,'revised backup needs fresh observation even if availability flips within one frame');
 const h=setup();h.m.setBackupAvailable(false,h.op.snapshot);assert.equal(h.cmd('isolate-main'),true,'daytime isolation needs no backup');h.select(21);assert.equal(h.m.snapshot.source,'none');assert.equal(h.op.snapshot.running,false);assert.equal(h.cmd('trial'),false);assert.equal(h.cmd('restore'),false);
 const inspection=new(load('LighthouseInspection').LighthouseInspection)();inspection.confirmControl(g.op.snapshot,true);inspection.invalidateMain(g.op.snapshot);
 assert.equal(inspection.snapshot.control,undefined);assert.equal(inspection.snapshot.completed,false);assert.equal(inspection.snapshot.events.at(-1).type,'equipment-changed');
});
test('scene drill swapping preserves normal clock, maintenance, parts and patrol objects; nested drills and remote commands are rejected',()=>{
 const proto=load('Room').RoomScene.prototype,f=setup(),inspection=new(load('LighthouseInspection').LighthouseInspection)();f.op.startTest();f.clock.setAutomatic(true);f.run(.5);
 const normal={clock:f.clock,op:f.op,m:f.m,inspection},room=Object.create(proto),ops=f.op.snapshot,time=f.clock.snapshot,parts=f.m.snapshot.inventory;
 Object.assign(room,{timeState:f.clock,lighthouseState:f.op,lighthouseInspectionState:inspection,lighthouseMaintenanceState:f.m,
   lighthousePanel:{activeLocation:'control'},lighthouseCommandAllowed:()=>true,notifyLighthouseOperation:()=>{},applyTimeOfDay:()=>{},notifyTimeOfDay:()=>{}});
 room.selectLighthouseDrill('drive');assert.equal(room.lighthouseMaintenance.session,'drive');assert.equal(room.timeOfDay.hour,21);assert.equal(room.timePlayback.automatic,false);
 room.selectLighthouseDrill('charger');assert.equal(room.lighthouseMaintenance.session,'drive');
 room.selectLighthouseDrill('normal');assert.equal(room.timeState,normal.clock);assert.equal(room.lighthouseState,normal.op);assert.equal(room.lighthouseInspectionState,normal.inspection);assert.equal(room.lighthouseMaintenanceState,normal.m);
 assert.equal(room.timeOfDay,time);assert.equal(room.lighthouseOperation,ops);assert.deepEqual(room.lighthouseMaintenance.inventory,parts);assert.equal(room.timePlayback.automatic,true);
 room.lighthouseCommandAllowed=()=>false;room.selectLighthouseDrill('sensor');assert.equal(room.lighthouseMaintenance.session,'normal');
});
