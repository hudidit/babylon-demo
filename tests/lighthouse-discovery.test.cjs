const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseDiscovery}=load('LighthouseDiscovery'),{LighthouseRandom}=load('LighthouseRandom');
const {LighthouseWeatherRisk}=load('LighthouseRisk'),{LighthouseOperation}=load('LighthouseOperation');
const {LighthouseMaintenance}=load('LighthouseMaintenance'),{LighthouseInspection}=load('LighthouseInspection'),{LighthousePower,lighthouseSolarWh}=load('LighthousePower');
const {RoomTimeOfDay}=load('RoomTimeOfDay'),{advanceWeatherDuty,synchronizeWeatherDuty}=load('LighthouseWeatherSession');
const {encodeLighthouseSave,decodeLighthouseSave}=load('LighthouseSave');
const facts=(solar={})=>[{target:'cover',revision:0,problemId:'cover-1',stage:'obvious',severity:1},
 {target:'solar',revision:1,problemId:'solar-1',stage:'latent',severity:0,...solar}];
function fixture(draw=()=>.99){let draws=0;const d=new LighthouseDiscovery(()=>{draws++;return draw();});
 d.synchronize(facts(),0,['cover','solar']);return {d,draws:()=>draws};}
const inspect=(d,method='patrol')=>d.observe('solar',method,1,12);
function revisit(d,h=1/6,f=facts()){d.synchronize(f,h-1/6,[]);d.synchronize(f,h,['solar']);}
test('ordinary latent patrol caches one honest incomplete result across repeated reads, button presses and unchanged facts',()=>{
 const f=fixture(),a=inspect(f.d);assert.equal(a.status,'unseen');assert.match(a.result,/仍可能漏看/);
 for(let i=0;i<100;i++){f.d.synchronize(facts({severity:.99}),0,['solar']);assert.equal(inspect(f.d),a);assert.equal(f.d.view('solar').latest,a);}
 assert.equal(f.draws(),1);assert.equal(f.d.view('solar').history.length,1);assert.equal(f.d.view('solar').visit,1);
});
test('obvious surfaces and deeper checks give definite scoped evidence without any inspection randomness',()=>{
 const f=fixture();assert.equal(f.d.observe('cover','patrol',1,12).status,'confirmed');
 const deep=inspect(f.d,'surface-test');assert.equal(deep.status,'confirmed');assert.match(deep.result,/薄薄的污膜/);assert.equal(f.draws(),0);
 assert.equal(inspect(f.d).status,'confirmed');assert.equal(f.draws(),0);
 f.d.synchronize(facts({stage:'clear',revision:2,problemId:'clean-solar'}),0,['solar']);const clear=inspect(f.d,'surface-test');assert.equal(clear.status,'clear');assert.match(clear.result,/设备内部是否正常.*另查/);
 assert.equal(f.d.view('solar').history.filter(e=>!e.valid).length,2);
});
test('initial latent discovery thresholds range from .35 to .8 with strict probability boundaries',()=>{
 for(const [severity,draw,expected]of [[0,.34999,'suspected'],[0,.35,'unseen'],[1,.79999,'suspected'],[1,.8,'unseen']]){
  const d=new LighthouseDiscovery(()=>draw);d.synchronize(facts({severity}),0,['solar']);assert.equal(inspect(d).status,expected);
 }
});
test('leaving the area requires ten continuous automatic scene minutes, and pauses/brief returns do not renew a visit',()=>{
 const f=fixture();inspect(f.d);f.d.synchronize(facts(),0,[]);
 for(let i=0;i<50;i++)f.d.synchronize(facts(),0,[]);f.d.synchronize(facts(),0,['solar']);assert.equal(inspect(f.d).visit,1);
 f.d.synchronize(facts(),0,[]);f.d.synchronize(facts(),.16,['solar']);assert.equal(inspect(f.d).visit,1);
 f.d.synchronize(facts(),.16,[]);f.d.synchronize(facts(),.17,['solar']);assert.equal(inspect(f.d).visit,1);
 f.d.synchronize(facts(),.17,[]);f.d.synchronize(facts(),.17+1/6,['solar']);assert.equal(inspect(f.d).visit,2);assert.equal(f.draws(),2);
});
test('two effective misses point to a deterministic next method and existing suspicion is never erased by a later glance',()=>{
 const f=fixture();inspect(f.d);revisit(f.d);const second=inspect(f.d);assert.equal(second.status,'unseen');assert.match(second.next,/两次.*细看5秒/);
 assert.equal(inspect(f.d,'surface-test').status,'confirmed');assert.equal(f.draws(),2);
 const g=fixture(()=>0);assert.equal(inspect(g.d).status,'suspected');revisit(g.d);assert.equal(inspect(g.d).status,'suspected');assert.equal(g.draws(),1);
});
test('a changed instance or revision invalidates current knowledge while retaining historical evidence',()=>{
 const f=fixture();inspect(f.d,'surface-test');f.d.synchronize(facts({revision:2,problemId:'new-solar'}),0,['solar']);assert.equal(f.d.view('solar').latest,undefined);
 assert.equal(f.d.view('solar').history[0].valid,false);assert.equal(inspect(f.d).status,'unseen');assert.equal(f.draws(),1);
});
test('observation out of range and interrupted actions cannot consume information randomness',()=>{
 const f=fixture();f.d.synchronize(facts(),0,[]);assert.equal(inspect(f.d),undefined);assert.equal(f.draws(),0);
 const m=new LighthouseMaintenance(),op=new LighthouseOperation();m.soilFromWeather(op.snapshot,true);
 m.setSurfaceObserver(method=>{const clue=inspect(f.d,method);return clue&&{id:clue.id,result:clue.result,identified:clue.status==='confirmed'};});
 m.command('surface-test','lighthouse-solar-array','meter',op,true);m.advance({activeSeconds:.1},op,{action:false});assert.equal(m.snapshot.action,undefined);assert.equal(f.draws(),0);
});
test('knowledge checkpoints resume the same cached result and independent random stream without extra draws',()=>{
 const random=new LighthouseRandom(70),d=new LighthouseDiscovery(()=>random.next('inspection'));d.synchronize(facts(),0,['solar']);inspect(d);
 const saved=JSON.parse(JSON.stringify(d.exportState())),r=LighthouseRandom.fromState(random.snapshot),restored=LighthouseDiscovery.fromState(saved,()=>r.next('inspection'));
 restored.synchronize(facts(),0,['solar']);assert.deepEqual(inspect(restored),inspect(d));assert.deepEqual(r.snapshot,random.snapshot);
 for(const x of [d,restored]){revisit(x);inspect(x);}assert.deepEqual(restored.exportState(),d.exportState());assert.deepEqual(r.snapshot,random.snapshot);
 assert.throws(()=>LighthouseDiscovery.fromState({...saved,version:2},()=>0));assert.throws(()=>LighthouseDiscovery.fromState({...saved,nextId:1},()=>0));
 assert.throws(()=>d.synchronize(facts(),-1,[]));
});
test('long histories remain bounded without evicting another devices current cached result or two-miss hint',()=>{
 const f=fixture(),first=inspect(f.d);let h=0;
 for(let i=0;i<180;i++){f.d.synchronize(facts(),h,['solar']);h+=1/6;f.d.synchronize(facts(),h,['cover','solar']);f.d.observe('cover','patrol',1,12);f.d.observe('cover','surface-test',1,12);}
 assert.equal(inspect(f.d),first);assert.equal(f.draws(),1);assert.ok(f.d.exportState().entries.length<=128);
});
test('inspection draws and checkpoint reads never change future weather or equipment events',()=>{
 const a=new LighthouseWeatherRisk({seed:4}),b=new LighthouseWeatherRisk({seed:4}),d=new LighthouseDiscovery(()=>b.drawInformation('inspection'));
 for(let i=0;i<40;i++){d.synchronize(facts({revision:i}),i,['solar']);inspect(d);d.exportState();a.advance({automaticHours:1});b.advance({automaticHours:1});}
 assert.deepEqual(a.snapshot.weather,b.snapshot.weather);assert.deepEqual(a.snapshot.problems,b.snapshot.problems);
 for(const stream of ['weather','equipment','forecast'])assert.deepEqual(a.snapshot.random.streams[stream],b.snapshot.random.streams[stream]);
});
function duty(){const s={clock:new RoomTimeOfDay(),operation:new LighthouseOperation(),inspection:new LighthouseInspection(),maintenance:new LighthouseMaintenance(),power:new LighthousePower({mainWh:1500}),weather:new LighthouseWeatherRisk({seed:1,fixedWeather:'clear',rules:[{component:'solar',objectId:'lighthouse-solar-array',remedy:'clean-solar',baseRatePerHour:1e6,soilPerHour:.02,minimumSoil:0,seriousAfterHours:null,visibleAfterHours:2}]})};
 const d=new LighthouseDiscovery(()=>.99);let near=true;
 const sync=()=>{const p=s.weather.snapshot.problems[0],m=s.maintenance.snapshot;d.synchronize(facts({revision:m.revision.solar,problemId:p?.id||'clean',stage:m.solarDirty?m.solarLatent?'latent':'obvious':'clear'}),s.weather.acceptedAutomaticHours,near?['solar']:[]);};
 s.maintenance.setSurfaceObserver(method=>{const e=d.observe('solar',method,s.operation.snapshot.dutyDay,s.operation.snapshot.hour);return e&&{id:e.id,result:e.result+' '+e.next,identified:['confirmed','clear'].includes(e.status)};});
 s.clock.advance(0);s.step=(n=1)=>{for(let i=0;i<n;i++){s.clock.advance(.1);advanceWeatherDuty(s,s.clock.lastAdvance);sync();s.maintenance.advance(s.clock.lastAdvance,s.operation,{action:near,backup:false,main:false,mainOutput:0});synchronizeWeatherDuty(s);}};s.d=d;return s;
}
test('surface warning affects real solar input before becoming obvious, and never turns into a serious outage',()=>{
 const f=duty();f.step(51);assert.equal(f.maintenance.snapshot.solarLatent,true);assert.equal(f.weather.snapshot.problems[0].stage,'latent');
 const before=f.power.snapshot.mainWh,hour=f.operation.snapshot.hour;f.step(60);const deltaHours=.1;
 assert.ok(Math.abs(f.power.snapshot.mainWh-before-(lighthouseSolarWh(hour,deltaHours)*.85-5*deltaHours))<1e-5);
 const rev=f.maintenance.snapshot.revision.solar;f.step(1200);assert.equal(f.weather.snapshot.problems[0].stage,'degraded');assert.equal(f.maintenance.snapshot.solarLatent,false);assert.equal(f.maintenance.snapshot.revision.solar,rev+1);
 assert.equal(f.power.snapshot.solarW<60,true);assert.ok(!f.weather.snapshot.problems.some(p=>p.stage==='serious'));
});
test('real five-second detection enables only the corresponding cleaning transaction, followed by independent recheck',()=>{
 const f=duty();f.step(51);f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.step(20);assert.equal(f.d.view('solar').latest.status,'unseen');
 assert.equal(f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true),false);
 const count=f.maintenance.snapshot.evidence.length;f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.step(20);assert.equal(f.maintenance.snapshot.evidence.filter(e=>e.method==='现场观察').length,1);
 f.maintenance.command('surface-test','lighthouse-solar-array','meter',f.operation,true);f.step(49);assert.ok(f.maintenance.snapshot.action);f.step();assert.equal(f.d.view('solar').latest.status,'confirmed');
 assert.equal(f.maintenance.command('clean','lighthouse-solar-array','cloth',f.operation,true),true);f.step(20);assert.equal(f.maintenance.snapshot.solarDirty,false);assert.equal(f.maintenance.snapshot.solarRecheck,true);assert.equal(f.inspection.snapshot.dirty,true);
 f.step();assert.equal(f.weather.snapshot.problems.length,0);assert.equal(f.d.view('solar').latest,undefined);
 f.maintenance.command('inspect','lighthouse-solar-array','meter',f.operation,true);f.step(20);assert.equal(f.d.view('solar').latest.status,'clear');assert.equal(f.maintenance.snapshot.solarRecheck,false);
});
test('cross checks use observed environment/input and V1 keeps honest wording without pretending to persist latent state',()=>{
 const f=duty();f.step(51);f.maintenance.compareSolar(f.operation.snapshot,85,100);assert.match(f.maintenance.snapshot.notice,/比估算值低.*判断不了内部原因/);
 f.maintenance.compareSolar(f.operation.snapshot,0,0);assert.match(f.maintenance.snapshot.notice,/日照太弱/);
 const restored=decodeLighthouseSave(encodeLighthouseSave({...f,weather:undefined}));assert.equal(restored.maintenance.snapshot.solarDirty,true);assert.equal(restored.maintenance.snapshot.solarLatent,false);
 assert.equal(restored.power.snapshot.mainWh,f.power.snapshot.mainWh);assert.equal(restored.clock.playback.automatic,f.clock.playback.automatic);
 const rows=load('LighthouseExperience').lighthouseRecords('log',restored.inspection.snapshot,restored.maintenance.snapshot,restored.power.snapshot);assert.ok(rows.some(r=>r.action==='读数对照'&&r.result.includes('日照太弱')));
});
