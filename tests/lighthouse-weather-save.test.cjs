const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {RoomTimeOfDay}=load('RoomTimeOfDay'),{LighthouseOperation}=load('LighthouseOperation'),{LighthouseInspection}=load('LighthouseInspection');
const {LighthouseMaintenance}=load('LighthouseMaintenance'),{LighthousePower}=load('LighthousePower'),{LighthouseWeatherRisk}=load('LighthouseRisk');
const {LighthouseVisibility}=load('LighthouseWeather'),{LighthouseRandom}=load('LighthouseRandom');
const {advanceWeatherDuty,synchronizeWeatherDuty,lighthouseDiscoveryFacts:facts}=load('LighthouseWeatherSession');
const {completeLighthouseSession:complete,encodeLighthouseSave:encode,decodeLighthouseSave:decode,LighthouseSave,LIGHTHOUSE_SAVE_KEY:dutyKey,LIGHTHOUSE_EXERCISE_SAVE_KEY:exerciseKey}=load('LighthouseSave');
const json=x=>JSON.parse(JSON.stringify(x));
function base(){const s={clock:new RoomTimeOfDay(),operation:new LighthouseOperation(),inspection:new LighthouseInspection(),maintenance:new LighthouseMaintenance(),power:new LighthousePower({mainWh:1500})};s.clock.restore(12);synchronizeWeatherDuty({...s,weather:new LighthouseWeatherRisk({seed:0})});return s;}
function fixture(seed=216,kind='clear',mode='exercise'){const s=complete(base(),mode,seed);if(kind)s.weather.setFixedWeather(kind);sync(s);return s;}
function sync(s,near=['solar']){s.weather.synchronizeSurface('cover',s.inspection.snapshot.dirty);s.weather.synchronizeSurface('solar',s.maintenance.snapshot.solarDirty);synchronizeWeatherDuty(s);s.discovery.synchronize(facts(s),s.weather.acceptedAutomaticHours,near);
 s.maintenance.setSurfaceObserver((method,op)=>{const e=s.discovery.observe('solar',method,op.dutyDay,op.hour);return e&&{id:e.id,result:e.result+' '+e.next,identified:['clear','confirmed'].includes(e.status)};});}
function step(s,h,near=['solar'],active=0){const before=s.operation.snapshot,from=s.clock.snapshot.hour,to=(from+h)%24;s.clock.restore(to);
 const frame={fromHour:from,toHour:to,automaticHours:h,activeSeconds:active,midnightCrossings:Math.floor((from+h)/24),manualCompleted:false};
 advanceWeatherDuty(s,frame);sync(s,near);s.maintenance.advance(frame,s.operation,{action:near.includes('solar'),backup:false,main:false,mainOutput:0});s.inspection.advance(frame,before,s.operation.snapshot,{cover:true,optic:false,output:0});sync(s,near);}
function latent(){const s=fixture();for(let n=0;!s.maintenance.snapshot.solarLatent&&n<60000;n++)step(s,1/600);assert.equal(s.maintenance.snapshot.solarLatent,true);return s;}
const observe=s=>s.discovery.observe('solar','patrol',s.operation.snapshot.dutyDay,s.operation.snapshot.hour);
function memory(initial={}){const map=new Map(Object.entries(initial));return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}

test('weather subintervals cross each shared-clock midnight once across fractional frames and manual time origins',()=>{
 for(const h of [.037,1/600,.25])for(const origin of [12,23.99]){
  const s=fixture(216,null);s.clock.restore(origin);s.operation.selectTime(origin);sync(s);let expected=1;
  const count=Math.ceil(13/h);
  for(let n=0;n<count;n++){const from=s.clock.snapshot.hour,raw=from+h,to=Math.abs(raw-Math.round(raw))<1e-10?Math.round(raw):raw;
   expected+=Math.floor(to/24);step(s,to-from,[],0);
   assert.equal(s.operation.snapshot.dutyDay,expected,JSON.stringify({h,origin,n,hour:s.clock.snapshot.hour}));assert.equal(s.inspection.snapshot.dutyDay,expected);
  }
  const events=s.operation.snapshot.events.filter(e=>e.type==='duty-day-started');assert.equal(events.length,expected-1);assert.equal(encode(decode(encode(s))),encode(s));
 }
});

test('exact weather checkpoints retain fractional risk time, transitions and all stream positions across repeated restores',()=>{
 for(const seed of [0,216,0xffffffff]){let a=new LighthouseWeatherRisk({seed});for(let n=0;n<1500;n++){
   a.advance({automaticHours:.037});if(n%19===0){const state=json(a.exportState()),b=LighthouseWeatherRisk.fromState(state);assert.deepEqual(json(b.exportState()),state);assert.deepEqual(json(b.snapshot),json(a.snapshot));b.drawInformation('forecast');a.drawInformation('forecast');
    for(let j=0;j<3;j++){a.advance({automaticHours:.019});b.advance({automaticHours:.019});}assert.deepEqual(json(b.exportState()),json(a.exportState()));a=b;}
  }}
 const v=new LighthouseVisibility(.8);v.advance(4,.07123456789);const restored=LighthouseVisibility.fromState(json(v.exportState()));assert.deepEqual(restored.exportState(),v.exportState());for(const x of [v,restored])x.advance(4,.1);assert.deepEqual(restored.exportState(),v.exportState());assert.equal(restored.snapshot.required,false);
});
test('full V2 sessions resume actual weather, energy, calendar, latent surfaces and knowledge without adding history',()=>{
 for(const kind of ['clear','overcast','fog','storm',null]){const a=fixture(216,kind);step(a,1.23456789);const raw=encode(a),b=decode(raw);assert.deepEqual(json(JSON.parse(encode(b))),JSON.parse(raw));assert.equal(b.clock.playback.automatic,false);
  for(let n=0;n<240;n++){step(a,.037);step(b,.037);}assert.deepEqual(json(a.weather.exportState()),json(b.weather.exportState()));assert.deepEqual(json(a.discovery.exportState()),json(b.discovery.exportState()));assert.equal(a.power.snapshot.mainWh,b.power.snapshot.mainWh);assert.deepEqual(json(a.operation.exportState()),json(b.operation.exportState()));}
 const a=latent(),raw=encode(a),b=decode(raw);assert.equal(b.maintenance.snapshot.solarLatent,true);assert.deepEqual(json(b.maintenance.exportState()),json(a.maintenance.exportState()));for(let n=0;n<25;n++){step(a,.1);step(b,.1);}assert.equal(b.maintenance.snapshot.solarLatent,false);assert.deepEqual(json(b.weather.exportState()),json(a.weather.exportState()));assert.equal(b.power.snapshot.mainWh,a.power.snapshot.mainWh);
});
test('daytime fog restores a protected main battery and actual backup source before validating equipment',()=>{
 const s=fixture(0,'fog');s.power=new LighthousePower({mainWh:200,backupWh:100});
 // Visibility demand is accepted by the original weather/clock bridge, independent of night scheduling.
 for(let n=0;n<600&&!s.weather.snapshot.visibility.required;n++)step(s,1/600,[]);
 sync(s,[]);assert.equal(s.operation.snapshot.hour>=6&&s.operation.snapshot.hour<18,true);
 assert.equal(s.weather.snapshot.visibility.required,true);assert.equal(s.operation.snapshot.available,false);
 assert.equal(s.maintenance.snapshot.source,'backup');const raw=encode(s),restored=decode(raw);
 assert.equal(restored.maintenance.snapshot.source,'backup');assert.equal(encode(restored),raw);
 assert.equal(restored.clock.playback.automatic,false);
 const bad=JSON.parse(raw);bad.operation.available=true;assert.throws(()=>decode(JSON.stringify(bad)),/Inconsistent saved equipment/);
});
test('a cached missed patrol, two-miss hint, deterministic deep check and logged clue IDs survive saving',()=>{
 let s=latent();const first=observe(s);assert.equal(first.status,'unseen');const random=json(s.weather.snapshot.random);s=decode(encode(s));sync(s,null);
 assert.deepEqual(json(observe(s)),json(first));assert.deepEqual(json(s.weather.snapshot.random),random);
 // Binding the new scene without a location cannot make loading itself count as departure.
 for(let n=0;n<20;n++)sync(s,null);assert.equal(observe(s).visit,1);
 sync(s,[]);step(s,1/6,[]);sync(s,['solar']);const second=observe(s);assert.equal(second.status,'unseen');assert.match(second.next,/看过两次.*拿不准/);s=decode(encode(s));sync(s,['solar']);assert.equal(observe(s).id,second.id);assert.equal(s.weather.snapshot.random.streams.inspection.draws,2);
 const act=command=>{assert.equal(s.maintenance.command(command,'lighthouse-solar-array','meter',s.operation,true),true);for(let i=0;i<(command==='surface-test'?51:21);i++)step(s,0,['solar'],.1);};
 act('inspect');const rows=s.maintenance.snapshot.evidence.filter(e=>e.method==='现场观察').length;s=decode(encode(s));sync(s,['solar']);act('inspect');assert.equal(s.maintenance.snapshot.evidence.filter(e=>e.method==='现场观察').length,rows);
 act('surface-test');assert.equal(s.discovery.view('solar').latest.status,'confirmed');assert.equal(s.weather.snapshot.random.streams.inspection.draws,2);
 assert.equal(s.maintenance.command('clean','lighthouse-solar-array','cloth',s.operation,true),true);for(let i=0;i<21;i++)step(s,0,['solar'],.1);assert.equal(s.maintenance.snapshot.solarDirty,false);assert.equal(s.discovery.view('solar').latest,undefined);const r=decode(encode(s));assert.ok(r.discovery.view('solar').history.every(e=>!e.valid));
});
test('serious problem protection, maintenance revisions and cooldown are exact model checkpoints',()=>{
 const rule=c=>({component:c,objectId:c,remedy:c==='cover'?'clean-cover':'clean-solar',baseRatePerHour:1e6,soilPerHour:.03,minimumSoil:0,seriousAfterHours:1/12});
 let a=new LighthouseWeatherRisk({seed:0,rules:[rule('cover'),rule('solar')],fixedWeather:'clear'});a.advance({automaticHours:24});a.advance({automaticHours:1/12});const p=a.snapshot.problems.find(p=>p.stage==='serious');assert.ok(p);a.maintain(p.component,p.id);
 const b=LighthouseWeatherRisk.fromState(json(a.exportState()));for(let n=0;n<100;n++){a.advance({automaticHours:.071});b.advance({automaticHours:.071});assert.deepEqual(json(a.exportState()),json(b.exportState()));}
});
test('V1 migration is atomic and one-time; read-only inspection never creates a seed or changes the slot',()=>{
 const raw=encode(base()),store=memory({[dutyKey]:raw});let seeds=0;const slot=new LighthouseSave(()=>store,'duty',()=>{seeds++;return 0;});
 for(let n=0;n<5;n++){assert.equal(slot.inspect().available,true);assert.equal(store.getItem(dutyKey),raw);}assert.equal(seeds,0);
 const first=slot.load();assert.ok(first.session);assert.equal(first.session.weather.snapshot.random.seed,0);assert.equal(first.session.inspection.snapshot.dirty,true);assert.equal(JSON.parse(store.getItem(dutyKey)).version,2);
 const upgraded=store.getItem(dutyKey);for(let n=0;n<5;n++)assert.deepEqual(json(slot.load().session.weather.exportState()),json(first.session.weather.exportState()));assert.equal(seeds,1);assert.equal(store.getItem(dutyKey),upgraded);
 const failStore={...store,getItem:()=>raw,setItem:()=>{throw new Error('quota');}},failed=new LighthouseSave(()=>failStore,'duty',()=>1);assert.equal(failed.load().session,undefined);assert.match(failed.load().status.message,/升级后没能存上.*还没有载入/);assert.equal(failStore.getItem(dutyKey),raw);
});
test('normal and exercise slots are independent, reject cross-slot writes and reproduce boundary seeds',()=>{
 const store=memory(),duty=new LighthouseSave(()=>store),exercise=new LighthouseSave(()=>store,'exercise');const a=fixture(0,null,'duty'),b=fixture(0xffffffff,'storm');
 assert.equal(duty.save(a).available,true);const raw=store.getItem(dutyKey);assert.equal(exercise.save(b).available,true);assert.equal(store.getItem(dutyKey),raw);assert.equal(exercise.load().session.weather.snapshot.random.seed,0xffffffff);assert.equal(duty.load().session.weather.snapshot.random.seed,0);
 const before=store.getItem(exerciseKey);assert.match(exercise.save(a).message,/没存上/);assert.equal(store.getItem(exerciseKey),before);
 for(const seed of [0,0xffffffff]){const x=fixture(seed,null),y=fixture(seed,null);for(let n=0;n<150;n++){step(x,.031);step(y,.031);}assert.equal(encode(x),encode(y));}
});
test('corrupt, unsupported or contradictory V2 data is retained and cannot replace a live session',()=>{
 const initial=json(JSON.parse(encode(fixture()))),bad=[];
 for(const edit of [s=>s.version=3,s=>s.weather.extra=1,s=>s.weather.random.streams.weather.state^=1,s=>s.weather.random.streams.inspection.draws++,s=>s.weather.compensation=1,s=>s.weather.ticks++,s=>s.weather.acceptedHours=Infinity,s=>s.discovery.elapsedHours=1,s=>s.maintenanceWeather.solarLatent=true,s=>s.weather.problems=[],s=>s.weather.components.cover.soil=-1,s=>s.weather.weather.remainingTicks=1,s=>s.weather.rules[0].baseRatePerHour=1,s=>s.maintenance.lastRequired=true,s=>{s.discovery.nextId=2;s.discovery.entries=[{id:1,target:'solar',revision:0,problemId:s.weather.problems[0].id,method:'patrol',visit:1,day:1,hour:12,status:'confirmed',result:'wrong object',next:'test'}];}]){const s=structuredClone(initial);edit(s);bad.push(JSON.stringify(s));}
 for(const raw of bad){assert.throws(()=>decode(raw),raw);const store=memory({[exerciseKey]:raw}),slot=new LighthouseSave(()=>store,'exercise');assert.equal(slot.inspect().invalid,true);assert.equal(slot.load().session,undefined);assert.equal(slot.save(fixture()).invalid,true);assert.equal(store.getItem(exerciseKey),raw);}
 const state=json(new LighthouseRandom(1).snapshot);state.streams.weather.draws=Number.MAX_SAFE_INTEGER;assert.throws(()=>LighthouseRandom.fromState(state));
});

test('a full checkpoint cancels unfinished field work without consuming inventory, proving completion or drawing information',()=>{
 const s=latent();assert.equal(s.maintenance.command('surface-test','lighthouse-solar-array','meter',s.operation,true),true);step(s,0,['solar'],2);
 const before={inventory:s.maintenance.snapshot.inventory,random:s.weather.snapshot.random,wh:s.power.snapshot.mainWh};const r=decode(encode(s));assert.equal(r.maintenance.snapshot.action,undefined);assert.equal(r.discovery.view('solar').latest,undefined);assert.deepEqual(r.maintenance.snapshot.inventory,before.inventory);assert.deepEqual(r.weather.snapshot.random,before.random);assert.equal(r.power.snapshot.mainWh,before.wh);
 const time=r.clock.snapshot;r.clock.advance(3600);assert.equal(r.clock.snapshot,time);assert.equal(r.clock.lastAdvance.automaticHours,0);
});
