const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomTimeOfDay}=load('RoomTimeOfDay'),{LighthouseOperation}=load('LighthouseOperation'),{LighthouseInspection}=load('LighthouseInspection');
const {LighthouseMaintenance}=load('LighthouseMaintenance'),{LighthousePower,lighthouseSolarWh,lighthouseWeatherSolarWh}=load('LighthousePower');
const {LighthouseWeatherRisk}=load('LighthouseRisk'),{advanceWeatherDuty,synchronizeWeatherDuty}=load('LighthouseWeatherSession');
const {encodeLighthouseSave,decodeLighthouseSave}=load('LighthouseSave');
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function fixture(kind='clear',dt=.1,options={}){
 const clock=new RoomTimeOfDay(),operation=new LighthouseOperation(),inspection=new LighthouseInspection(),maintenance=new LighthouseMaintenance(),power=new LighthousePower({mainWh:1500});
 const weather=new LighthouseWeatherRisk({seed:20261021,fixedWeather:kind===null?undefined:kind,...options}),s={clock,weather,operation,inspection,maintenance,power};
 clock.advance(0);synchronizeWeatherDuty(s);
 s.step=(paused=false)=>{const before=operation.snapshot;clock.advance(dt,paused,paused);advanceWeatherDuty(s,clock.lastAdvance);
  maintenance.advance(clock.lastAdvance,operation,{action:true,backup:false,main:false,mainOutput:0});
  inspection.advance(clock.lastAdvance,before,operation.snapshot,{optic:false,output:0,cover:true});synchronizeWeatherDuty(s);assert.equal(operation.snapshot.hour,clock.snapshot.hour);};
 s.run=seconds=>{for(let i=0;i<Math.round(seconds/dt);i++)s.step();};return s;
}
test('production bridge applies the four solar multipliers and daytime fog navigation to real Wh, without duplicate loss',()=>{
 for(const [kind,multiplier]of [['clear',1],['overcast',.35],['fog',.45],['storm',.15]]){
  const f=fixture(kind);f.run(60);near(f.power.snapshot.mainWh,1500+lighthouseSolarWh(12,1)*multiplier-(kind==='fog'?55:5));
  assert.equal(f.operation.snapshot.running,kind==='fog');assert.equal(f.maintenance.snapshot.navigationRequired,kind==='fog');
  near(f.power.snapshot.mainLoadW,kind==='fog'?55:5);near(f.power.snapshot.solarW,250*Math.sin(7*Math.PI/12)*multiplier);
 }
});
test('weather bridge replays automatic transitions and energy across different real frame sizes',()=>{
 const results=[];
 for(const dt of [.1,.05,.02]){const f=fixture(null,dt);f.run(720);results.push({weather:f.weather.snapshot,p:f.power.snapshot,op:f.operation.snapshot,m:f.maintenance.snapshot});}
 for(const r of results.slice(1)){assert.deepEqual(r.weather,results[0].weather);near(r.p.mainWh,results[0].p.mainWh,2e-4);near(r.p.backupWh,results[0].p.backupWh);assert.equal(r.op.running,results[0].op.running);assert.deepEqual(r.m.revision,results[0].m.revision);}
});
test('linear weather/daylight analytic integral agrees with independent numerical quadrature including dawn and dusk',()=>{
 for(const [hour,hours,from,slope]of [[6,3,.35,.1],[11,.5,1,-.6],[17,2,.6,-.1],[5,2,.35,.1],[0,2,1,0]]){
  const n=10000,step=hours/n;let expected=0;
  for(let i=0;i<n;i++){const t=(i+.5)*step,h=hour+t;expected+=(h<6||h>18?0:250*Math.sin((h-6)*Math.PI/12))*(from+slope*t)*step;}
  near(lighthouseWeatherSolarWh(hour,hours,from,slope),expected,1e-5);
 }
});
test('fixed weather changes preserve device facts and problems, low-solar alone never requests navigation',()=>{
 const f=fixture('clear');f.run(2);const before={dirty:f.inspection.snapshot.dirty,revision:f.inspection.snapshot.coverRevision,wh:f.power.snapshot.mainWh};
 f.weather.setFixedWeather('fog');synchronizeWeatherDuty(f);assert.equal(f.operation.snapshot.running,true);
 assert.equal(f.power.snapshot.mainWh,before.wh);assert.equal(f.inspection.snapshot.coverRevision,before.revision);
 f.weather.setFixedWeather('overcast');synchronizeWeatherDuty(f);assert.equal(f.operation.snapshot.running,false);assert.equal(f.inspection.snapshot.dirty,before.dirty);
 f.clock.select(21);f.operation.selectTime(21);synchronizeWeatherDuty(f);assert.equal(f.operation.snapshot.running,true);
});
test('weather interval receipts split at fog trigger and sustained recovery, conserving accepted automatic hours',()=>{
 const a=new LighthouseWeatherRisk({seed:20261021}),b=new LighthouseWeatherRisk({seed:20261021});let low=0,total=0;
 for(let h=0;h<72;h++){a.advance({automaticHours:1},i=>{total+=i.hours;if(i.lowVisibility)low+=i.hours;});b.advance({automaticHours:1});}
 near(total,72);assert.deepEqual(a.snapshot,b.snapshot);assert.ok(low>0&&low<72);
});
test('pause, manual selection and resume reset do not advance weather, random streams, Wh or hidden risk',()=>{
 const f=fixture('fog');f.run(3);const before={w:f.weather.snapshot,wh:f.power.snapshot.mainWh};
 for(let i=0;i<100;i++)f.step(true);assert.deepEqual(f.weather.snapshot,before.w);assert.equal(f.power.snapshot.mainWh,before.wh);
 f.clock.select(21);f.operation.selectTime(21);f.run(2);assert.deepEqual(f.weather.snapshot,before.w);assert.equal(f.power.snapshot.mainWh,before.wh);
 f.clock.setAutomatic(true);f.step();assert.deepEqual(f.weather.snapshot,before.w);
});
test('V1 saves from active daytime fog preserve true energy/history without mutating the live weather request',()=>{
 const f=fixture('fog');f.run(60);assert.equal(f.operation.snapshot.detectedDemand,true);const before=f.operation.snapshot;
 const raw=encodeLighthouseSave(f),restored=decodeLighthouseSave(raw);
 assert.equal(f.operation.snapshot,before);assert.equal(f.operation.snapshot.running,true);assert.equal(restored.operation.snapshot.detectedDemand,false);
 assert.equal(restored.power.snapshot.mainWh,f.power.snapshot.mainWh);assert.equal(JSON.stringify(restored.operation.snapshot.events),JSON.stringify(before.events));
 assert.equal(JSON.parse(raw).version,1);assert.equal(restored.clock.playback.automatic,false);
});
test('existing teaching/due surfaces suppress duplicates and weather-created dirt changes the actual surface and invalidates evidence',()=>{
 const rules=[{component:'cover',objectId:'lighthouse-optics-cleaning',remedy:'clean-cover',baseRatePerHour:1e6,soilPerHour:.03,minimumSoil:0,seriousAfterHours:null},
  {component:'solar',objectId:'lighthouse-solar-array',remedy:'clean-solar',baseRatePerHour:1e6,soilPerHour:.02,minimumSoil:0,seriousAfterHours:null}];
 const f=fixture('clear',.1,{rules});f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.run(2.1);
 const revision=f.maintenance.snapshot.revision.solar;f.run(3);
 assert.equal(f.weather.snapshot.problems.length,2);assert.equal(f.weather.snapshot.problems.find(p=>p.component==='cover').origin,'existing');
 assert.equal(f.weather.snapshot.random.streams.equipment.draws,1);assert.equal(f.maintenance.snapshot.solarDirty,true);assert.equal(f.maintenance.snapshot.revision.solar,revision+1);
 f.run(2);assert.equal(f.maintenance.snapshot.revision.solar,revision+1);
});
test('storm cancels an outdoor wipe without clearing dirt/debiting inventory, while indoor cover cleaning stays available',()=>{
 const f=fixture('clear');f.maintenance.soilFromWeather(f.operation.snapshot);f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.run(2.1);
 assert.equal(f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true),true);f.run(.4);
 const before=f.maintenance.snapshot;f.weather.setFixedWeather('storm');synchronizeWeatherDuty(f);f.run(.1);
 assert.equal(f.maintenance.snapshot.action,undefined);assert.equal(f.maintenance.snapshot.solarDirty,true);assert.deepEqual(f.maintenance.snapshot.inventory,before.inventory);
 assert.equal(f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true),false);
 f.inspection.inspectCover(f.operation.snapshot,true);assert.equal(f.inspection.startCleaning(f.operation.snapshot,true),true);f.run(1.6);assert.equal(f.inspection.snapshot.dirty,false);
});
test('paper records retain weather causes across V1 saves and never label an automatic change as a player inspection',()=>{
 const f=fixture('clear');f.inspection.inspectCover(f.operation.snapshot,true);f.inspection.startCleaning(f.operation.snapshot,true);f.run(1.7);
 assert.equal(f.inspection.snapshot.dirty,false);f.inspection.soilFromWeather(f.operation.snapshot);f.maintenance.soilFromWeather(f.operation.snapshot);
 const records=s=>load('LighthouseExperience').lighthouseRecords('log',s.inspection.snapshot,s.maintenance.snapshot,s.power.snapshot);
 const before=records(f),weather=before.filter(r=>r.action==='天气暴露污损');assert.equal(weather.length,2);assert.ok(weather.every(r=>r.result.includes('天气暴露')||r.result.includes('太阳能表面')));
 assert.equal(before.find(r=>r.object==='lighthouse-solar-array').action,'天气暴露污损');assert.deepEqual(records(decodeLighthouseSave(encodeLighthouseSave(f))),before);
});
