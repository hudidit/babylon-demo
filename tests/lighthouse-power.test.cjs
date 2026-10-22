const assert=require('node:assert/strict'),{test}=require('node:test'),load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthousePower,lighthouseSolarW,lighthouseSolarWh,LIGHTHOUSE_POWER:C}=load('LighthousePower');
const {LighthouseOperation}=load('LighthouseOperation'),{LighthouseMaintenance}=load('LighthouseMaintenance'),{RoomTimeOfDay}=load('RoomTimeOfDay');
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function setup(initial={},session='normal',hour=12){
 const clock=new RoomTimeOfDay(),op=new LighthouseOperation(),m=new LighthouseMaintenance(session),p=new LighthousePower(initial);
 const sync=()=>{p.synchronize(op.snapshot,m.snapshot);const s=p.snapshot;m.configurePower(s.mainAllowed,s.trialAllowed,s.backupAvailable,op.snapshot,s.exerciseComplete);m.synchronize(op);p.synchronize(op.snapshot,m.snapshot);};
 const select=h=>{clock.setAutomatic(false);clock.select(h);op.selectTime(h);sync();};select(hour);
 const step=(dt=.1,paused=false,sight=true)=>{clock.advance(dt,paused,paused);m.synchronize(op);p.advance(clock.lastAdvance,op.snapshot,m.snapshot);sync();op.advance(clock.lastAdvance);m.advance(clock.lastAdvance,op,{action:true,backup:false,main:false,mainOutput:0});
  p.advanceAction(clock.lastAdvance,op.snapshot,m.snapshot,sight,clock.playback.automatic,(wh,r)=>m.confirmCharging(op.snapshot,wh,r));sync();assert.ok(!(op.snapshot.running&&m.snapshot.backupOn));};
 const run=(seconds,dt=.1,paused=false,sight=true)=>{for(let i=0;i<Math.round(seconds/dt);i++)step(dt,paused,sight);};
 const auto=()=>{clock.setAutomatic(true);step();};
 const cmd=(c,tool='meter',location=c==='verify-main'?'lighthouse-battery-main':c==='probe-solar'?'lighthouse-solar-charger':'lighthouse-generator',access=true)=>p.command(c,location,tool,access,clock.playback.automatic,op.snapshot,m.snapshot);
 step();return{p,m,op,clock,sync,select,step,run,auto,cmd};
}
test('solar envelope and analytic integrals obey dawn, noon, dusk and exact daily Wh',()=>{
 assert.deepEqual([0,6,12,18,21].map(h=>Math.round(lighthouseSolarW(h))),[0,0,250,0,0]);near(lighthouseSolarWh(6,12),6000/Math.PI);near(lighthouseSolarWh(0,6),0);near(lighthouseSolarWh(18,6),0);
 const f=setup({mainWh:1000},'normal',6);f.auto();f.run(720);near(f.p.snapshot.mainWh,1000+6000/Math.PI-60);near(f.p.snapshot.backupWh,96);
});
test('scene-hour energy is frame independent through solar, night schedule and capacities',()=>{
 const results=[];for(const dt of [.1,.05,.02]){const f=setup();f.auto();f.run(1440,dt);results.push(f.p.snapshot);}
 for(const p of results.slice(1)){near(p.mainWh,results[0].mainWh);near(p.backupWh,results[0].backupWh);near(p.fuel,4);}
 assert.ok(results.every(p=>p.mainWh<=2880&&p.mainWh>=0));
});
test('10% protection switches to independent backup at a frame-independent boundary; 25% warning is separate',()=>{
 const results=[];for(const dt of [.1,.05,.02]){const f=setup({mainWh:300},'charger',21);f.auto();f.run(60,dt);assert.equal(f.p.snapshot.protected,true);assert.equal(f.op.snapshot.running,false);assert.equal(f.m.snapshot.source,'backup');
  near(f.p.snapshot.mainWh,288-5*(1-12/55));near(f.p.snapshot.backupWh,96-5*(1-12/55));results.push(f.p.snapshot.events.find(e=>e.type==='main-protected'));}
 for(const event of results){near(event.hour,21+12/55);assert.equal(event.day,1);}
 const f=setup({mainWh:721},'charger',21);f.auto();f.run(2);assert.equal(f.p.snapshot.warning,true);assert.equal(f.p.snapshot.protected,false);
});
test('manual time, automatic off, pauses and recovery frames never consume Wh or fuel',()=>{
 const f=setup();assert.equal(f.cmd('start-generator'),true);f.run(3.1);assert.equal(f.p.snapshot.generatorRunning,true);const before=f.p.snapshot;
 f.run(60);near(f.p.snapshot.mainWh,before.mainWh);near(f.p.snapshot.fuel,4);for(const h of [21,0,12,3])f.select(h);near(f.p.snapshot.mainWh,before.mainWh);
 f.auto();f.run(1);const energy=f.p.snapshot.mainWh,fuel=f.p.snapshot.fuel;f.run(100,.1,true);near(f.p.snapshot.mainWh,energy);near(f.p.snapshot.fuel,fuel);
 f.clock.resetDelta();f.step(3600);near(f.p.snapshot.mainWh,energy);near(f.p.snapshot.fuel,fuel);assert.equal(f.cmd('probe-generator','cloth'),false);
});
test('generator output, isolated solar failure and independent backup charging are distinct from main stored energy',()=>{
 const f=setup({mainWh:0,backupWh:20},'charger',21);assert.equal(f.m.snapshot.source,'backup');assert.equal(f.p.snapshot.solarW,0);
 assert.equal(f.cmd('start-generator'),true);f.run(3.1);assert.equal(f.p.snapshot.generatorW,200);assert.equal(f.p.snapshot.generatorVerified,false);
 f.auto();f.run(60);near(f.p.snapshot.mainWh,185);near(f.p.snapshot.backupWh,25);near(f.p.snapshot.fuel,3);assert.equal(f.p.snapshot.protected,true);
 assert.equal(f.cmd('probe-generator'),true);f.run(5.1);assert.equal(f.p.snapshot.generatorVerified,true);
});
test('fuel exhaustion stops exactly, refuel is stopped-only, cancellation and duplicate commands cannot debit twice',()=>{
 const f=setup({fuel:.1},'normal',21);f.cmd('start-generator');assert.equal(f.cmd('start-generator'),false);f.run(3.1);assert.equal(f.cmd('refuel'),false);f.auto();f.run(6.1);
 assert.equal(f.p.snapshot.generatorRunning,false);near(f.p.snapshot.fuel,0);near(f.p.snapshot.events.find(e=>e.type==='fuel-empty').hour,21.1);
 assert.equal(f.cmd('start-generator'),false);assert.equal(f.cmd('refuel'),true);f.run(1);f.p.cancel(f.op.snapshot);f.sync();near(f.p.snapshot.reserveFuel,8);near(f.p.snapshot.fuel,0);
 f.cmd('refuel');assert.equal(f.cmd('refuel'),false);f.run(3.1);near(f.p.snapshot.reserveFuel,4);near(f.p.snapshot.fuel,4);assert.equal(f.p.snapshot.generatorRunning,false);
});
test('backup full-charge, recovery-ready and fuel boundaries agree across different frame sizes',()=>{
 const results=[];
 for(const dt of [.1,.05,.02]){const f=setup({mainWh:280,backupWh:119.8,fuel:2},'charger',21);f.cmd('start-generator');f.run(3.1);f.auto();f.run(180,dt);results.push(f.p.snapshot);}
 for(const p of results.slice(1)){near(p.mainWh,results[0].mainWh);near(p.backupWh,results[0].backupWh);assert.equal(p.events.length,results[0].events.length);p.events.forEach((e,i)=>{assert.equal(e.type,results[0].events[i].type);near(e.hour,results[0].events[i].hour);});}
 assert.equal(results[0].protected,true);assert.equal(results[0].recoveryReady,true);assert.equal(results[0].generatorRunning,false);
});
test('20% recovery is latched until local meter verification, and drive faults cannot be cleared by battery checks',()=>{
 const f=setup({mainWh:280},'normal',21);assert.equal(f.cmd('verify-main'),false);f.cmd('start-generator');f.run(3.1);f.auto();f.run(110);
 assert.equal(f.p.snapshot.recoveryReady,true);assert.equal(f.p.snapshot.protected,true);assert.equal(f.m.snapshot.source,'backup');assert.equal(f.cmd('verify-main','cloth'),false);
 assert.equal(f.cmd('verify-main','meter','lighthouse-battery-main',false),false);assert.equal(f.cmd('verify-main'),true);f.run(2.1);assert.equal(f.p.snapshot.protected,false);assert.equal(f.op.snapshot.running,true);assert.equal(f.m.snapshot.backupOn,false);
 const g=setup({mainWh:280},'drive',21);g.cmd('start-generator');g.run(3.1);g.auto();g.run(110);assert.equal(g.cmd('verify-main'),false);assert.equal(g.op.snapshot.running,false);
});
test('actual solar sampling requires automatic time, unchanged revisions and positive main battery Wh; no fabricated test load',()=>{
 const f=setup();assert.equal(f.cmd('probe-solar'),false);f.auto();assert.equal(f.cmd('probe-solar'),true);f.run(5.1);assert.equal(f.p.snapshot.solarVerified,true);assert.equal(f.m.snapshot.chargerVerified,true);
 const full=setup({mainWh:2880});full.auto();full.cmd('probe-solar');full.run(5.1);assert.equal(full.p.snapshot.solarVerified,false);
 const night=setup({},'normal',21);night.auto();night.cmd('probe-solar');night.run(5.1);assert.equal(night.p.snapshot.solarVerified,false);
 const fault=setup({},'charger');fault.auto();fault.cmd('probe-solar');fault.run(5.1);assert.equal(fault.m.snapshot.chargerVerified,false);
});
test('depleted main and backup are independent, bounds and snapshots remain immutable and invalid initial state fails',()=>{
 const f=setup({mainWh:0,backupWh:.01},'drive',21);f.auto();f.run(1);assert.equal(f.p.snapshot.mainWh,0);assert.equal(f.p.snapshot.backupWh,0);assert.equal(f.m.snapshot.source,'none');
 assert.match(load('LighthouseEquipmentLayout').lighthouseEquipmentReading('lighthouse-beacon-backup',f.op.snapshot,f.m.snapshot,f.p.snapshot).state,/不可用/);
 assert.ok(Object.isFrozen(f.p.snapshot)&&Object.isFrozen(f.p.snapshot.events));for(const mainWh of [-1,2881,NaN,Infinity])assert.throws(()=>new LighthousePower({mainWh}),RangeError);
});
test('empty battery at dawn cannot accumulate sub-controller solar power through a frame-size artefact',()=>{
 for(const dt of [.1,.05,.02]){const f=setup({mainWh:0},'normal',6);f.auto();f.run(.1,dt);near(f.p.snapshot.mainWh,0,1e-10);}
});
test('labelled 11% supply exercise completes only after actual protection, refill, recovery and positive generator proof',()=>{
 const f=setup({mainWh:2880*.11},'power',21);f.auto();f.run(32);assert.equal(f.p.snapshot.protected,true);assert.equal(f.m.snapshot.resolved,false);
 f.cmd('refuel');f.run(3.1);f.cmd('start-generator');f.run(3.1);f.run(110);assert.equal(f.p.snapshot.recoveryReady,true);assert.equal(f.m.snapshot.resolved,false);
 f.cmd('verify-main');f.run(2.1);assert.equal(f.m.snapshot.resolved,false);f.cmd('probe-generator');f.run(5.1);assert.equal(f.p.snapshot.exerciseComplete,true);assert.equal(f.m.snapshot.resolved,true);
});
