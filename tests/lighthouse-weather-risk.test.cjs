const assert = require('node:assert/strict');
const {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseRandom, LIGHTHOUSE_RANDOM_STREAMS} = load('LighthouseRandom');
const {LIGHTHOUSE_WEATHER, LighthouseWeatherSequence, LighthouseVisibility, lighthouseWeatherNavigationRequired: required} = load('LighthouseWeather');
const {LighthouseWeatherRisk, LIGHTHOUSE_RISK_RULES, lighthouseRiskProbability: probability} = load('LighthouseRisk');
const {RoomTimeOfDay} = load('RoomTimeOfDay');
const near = (a,b,epsilon=1e-8) => assert.ok(Math.abs(a-b)<epsilon, `${a} != ${b}`);
const rule = (component='cover', options={}) => ({component, objectId:component==='cover'?'lighthouse-optics-cleaning':'lighthouse-solar-array',
  remedy:component==='cover'?'clean-cover':'clean-solar', baseRatePerHour:1e6,soilPerHour:.03,minimumSoil:0,seriousAfterHours:null,...options});
const model = options => new LighthouseWeatherRisk({seed:123,fixedWeather:'clear',...options});
const advance = (m,hours) => {while(hours>0){const h=Math.min(24,hours);m.advance({automaticHours:h});hours-=h;}};

test('versioned random streams reproduce seed zero and uint32 boundaries and resume a JSON checkpoint',()=>{
 const golden=new LighthouseRandom(0);
 assert.equal(golden.snapshot.streams.weather.state,2462723854);
 assert.deepEqual(Array.from({length:5},()=>golden.next('weather')*0x100000000),[3620793109,1690452336,609150479,4220623906,1180396825]);
 for(const seed of [0,123,0xffffffff]){
  const a=new LighthouseRandom(seed),b=new LighthouseRandom(seed);
  for(let n=0;n<50;n++)for(const stream of LIGHTHOUSE_RANDOM_STREAMS){const v=a.next(stream);assert.ok(v>=0&&v<1);assert.equal(v,b.next(stream));}
  const state=JSON.parse(JSON.stringify(a.snapshot)),c=LighthouseRandom.fromState(state);
  for(let n=0;n<100;n++)for(const stream of LIGHTHOUSE_RANDOM_STREAMS)assert.equal(a.next(stream),c.next(stream));
  assert.deepEqual(a.snapshot,c.snapshot);assert.deepEqual(state,JSON.parse(JSON.stringify(b.snapshot)));
 }
 assert.notDeepEqual(new LighthouseRandom(0).snapshot.streams,new LighthouseRandom(1).snapshot.streams);
});
test('information stream consumption cannot perturb future weather or equipment events',()=>{
 const a=model({fixedWeather:undefined}),b=model({fixedWeather:undefined});
 for(let n=0;n<40;n++){for(let i=0;i<7;i++){b.drawInformation('inspection');b.drawInformation('forecast');}advance(a,1);advance(b,1);assert.deepEqual(a.snapshot.weather,b.snapshot.weather);assert.deepEqual(a.snapshot.problems,b.snapshot.problems);}
 assert.deepEqual(a.snapshot.random.streams.weather,b.snapshot.random.streams.weather);
 assert.deepEqual(a.snapshot.random.streams.equipment,b.snapshot.random.streams.equipment);
 assert.throws(()=>a.drawInformation('equipment'),RangeError);
});
test('random seed/checkpoint validation rejects unknown versions, missing streams and nonintegers',()=>{
 for(const seed of [-1,NaN,Infinity,1.5,0x100000000])assert.throws(()=>new LighthouseRandom(seed),RangeError);
 const initial=new LighthouseRandom(1).snapshot;
 for(const bad of [null,{}, {...initial,algorithm:'future'}, {...initial,streams:{}},
  {...initial,streams:{...initial.streams,equipment:{state:-1,draws:0}}},
  {...initial,streams:{...initial.streams,equipment:{state:1,draws:1.5}}}])assert.throws(()=>LighthouseRandom.fromState(bad),RangeError);
 assert.throws(()=>new LighthouseRandom(1).next('invalid'),RangeError);
});
test('four fixed conditions preserve explicit visibility and solar input, without drawing weather randomness',()=>{
 for(const [kind,multiplier]of [['clear',1],['overcast',.35],['fog',.45],['storm',.15]]){
  const f=model({fixedWeather:kind}),initial=f.snapshot.weather;advance(f,72);
  assert.equal(initial.solarMultiplier,multiplier);assert.deepEqual(f.snapshot.weather,initial);
  assert.equal(f.snapshot.random.streams.weather.draws,0);assert.equal(initial.remainingHours,null);
  assert.equal(required(12,f.snapshot.visibility.required),kind==='fog');
  assert.equal(required(21,f.snapshot.visibility.required),true);
 }
 assert.equal(LIGHTHOUSE_WEATHER.overcast.visibilityKm,8);assert.throws(()=>model({fixedWeather:'snow'}),RangeError);
});
test('automatic segments last 2–6 hours and fog/storm only enter and leave through overcast',()=>{
 const random=new LighthouseRandom(20261021),f=new LighthouseWeatherSequence(random),seen=new Set(),segments=[];
 let previous=f.sample().kind,lastBoundary=0;
 for(let tick=1;tick<=12*24*100;tick++){
  f.advanceTick();const s=f.sample();seen.add(s.kind);
  if(s.kind!==previous){const length=tick-lastBoundary;assert.ok(length>=24&&length<=72);segments.push(length);
   assert.ok(previous==='overcast'||s.kind==='overcast');assert.equal(s.from,previous);assert.equal(s.transition,0);
   lastBoundary=tick;previous=s.kind;
  }
 }
 assert.deepEqual([...seen].sort(),['clear','fog','overcast','storm']);assert.ok(segments.length>100);
});
test('a weather transition is continuous, bounded and complete after four ticks (20 reference active seconds)',()=>{
 const f=new LighthouseWeatherSequence(new LighthouseRandom(42));while(f.sample().kind==='clear')f.advanceTick();
 assert.equal(f.sample().phase,'entering');assert.equal(f.sample().solarMultiplier,1);
 const values=[];for(let i=0;i<=4;i++){const s=f.sample();values.push(s.solarMultiplier);assert.ok(s.solarMultiplier>=.35&&s.solarMultiplier<=1);if(i<4)f.advanceTick();}
 assert.deepEqual(values,[1,.8375,.675,.5125,.35]);assert.equal(f.sample().phase,'holding');
 assert.throws(()=>f.sample(NaN),RangeError);assert.throws(()=>f.sample(-.1),RangeError);
});
test('visibility hysteresis separates low visibility, gray-zone reset and ten-minute sustained recovery',()=>{
 const v=new LighthouseVisibility();v.advance(1.9,1/12);assert.equal(v.snapshot.required,true);
 v.advance(3,1/12);assert.equal(v.snapshot.required,true);v.advance(2.99,1/12);assert.equal(v.snapshot.recoveryHours,0);
 v.advance(3,1/12);v.advance(3,0);assert.equal(v.snapshot.required,true);v.advance(3,1/12);assert.equal(v.snapshot.required,false);
 v.advance(2,1);assert.equal(v.snapshot.required,false);v.advance(1.999,1/12);assert.equal(v.snapshot.required,true);
 assert.equal(required(5.999,false),true);assert.equal(required(6,false),false);assert.equal(required(18,false),true);
 for(const h of [-1,24,NaN])assert.throws(()=>required(h,false),RangeError);
 assert.throws(()=>v.advance(-1,1),RangeError);assert.throws(()=>v.advance(1,-1),RangeError);
});
test('visibility threshold crossings inside a risk interval are continuous and display projections do not mutate history',()=>{
 const v=new LighthouseVisibility();const before=v.snapshot;
 assert.equal(v.sampleLinear(8,1.9,1/12).required,true);assert.deepEqual(v.snapshot,before);
 v.advanceLinear(8,.8,1/3);assert.equal(v.snapshot.required,true);
 // .8 -> 8 reaches 3 after 11/108 hours, leaving 25/108 hours above 3: enough recovery.
 v.advanceLinear(.8,8,1/3);assert.equal(v.snapshot.required,false);
 const a=new LighthouseVisibility(),b=new LighthouseVisibility();a.advanceLinear(8,.8,1/3);
 for(let i=0;i<4;i++)b.advanceLinear(8-1.8*i,8-1.8*(i+1),1/12);assert.deepEqual(a.snapshot,b.snapshot);
});
test('Poisson probability handles zero, tiny rates and saturation without invalid probabilities',()=>{
 assert.equal(probability(0,1),0);assert.equal(probability(1,0),0);assert.equal(probability(1e6,1),1);
 near(probability(.01,1),1-Math.exp(-.01));near(probability(1e-15,1),1e-15,1e-28);
 near(1-probability(.7,1),(1-probability(.7,.25))**4);
 for(const pair of [[-1,1],[1,-1],[NaN,1],[1,Infinity]])assert.throws(()=>probability(...pair),RangeError);
});
test('risk waits for a complete five-minute interval and retains its fractional remainder',()=>{
 const f=model({rules:[rule()]});advance(f,1/24);assert.equal(f.snapshot.ticks,0);assert.equal(f.snapshot.problems.length,0);near(f.snapshot.remainderHours,1/24);
 advance(f,1/24);assert.equal(f.snapshot.ticks,1);assert.equal(f.snapshot.problems.length,1);assert.equal(f.snapshot.remainderHours,0);
 const before=f.snapshot;for(let i=0;i<100;i++){advance(f,0);assert.deepEqual(f.snapshot,before);}assert.equal(before.random.streams.equipment.draws,1);
});
test('default candidate pool has only locally treatable surface issues and no random severe outage',()=>{
 assert.deepEqual(LIGHTHOUSE_RISK_RULES.map(r=>[r.component,r.remedy,r.seriousAfterHours]),[['cover','clean-cover',null],['solar','clean-solar',null]]);
 const quiet=model({seed:1});advance(quiet,24);assert.equal(quiet.snapshot.problems.length,0,'A normal day must remain a valid result');
 const f=model();advance(f,24*100);assert.ok(f.snapshot.problems.every(p=>p.stage==='degraded'));assert.ok(f.snapshot.problems.length<=2);
});
test('empty, zero-rate, insufficient exposure and unavailable treatment pools do not draw equipment randomness',()=>{
 for(const options of [{rules:[]},{rules:[rule('cover',{baseRatePerHour:0})]},
  {rules:[rule('cover',{soilPerHour:0,minimumSoil:.1})]},{rules:[rule()],remedies:[]}]){
  const f=model(options);advance(f,48);assert.equal(f.snapshot.problems.length,0);assert.equal(f.snapshot.random.streams.equipment.draws,0);
 }
 const f=model({rules:[rule()]});f.setTreatmentAvailable('cover',false);advance(f,24);assert.equal(f.snapshot.random.streams.equipment.draws,0);
 f.setTreatmentAvailable('cover',true);advance(f,1/12);assert.equal(f.snapshot.problems.length,1);assert.equal(f.snapshot.random.streams.equipment.draws,1);
});
test('instances and cause survive repeated reads, existing problems are not rerolled, stale repairs fail',()=>{
 const f=model({rules:[rule()]});advance(f,1/12);const initial=f.snapshot,problem=initial.problems[0];
 for(let i=0;i<50;i++)assert.deepEqual(f.snapshot,initial);
 advance(f,4);assert.deepEqual(f.snapshot.problems,[problem]);assert.equal(f.snapshot.random.streams.equipment.draws,1);
 assert.equal(problem.objectId,'lighthouse-optics-cleaning');assert.equal(problem.createdHour,1/12);assert.equal(problem.cause.weather,'clear');assert.equal(problem.cause.probability,1);
 assert.equal(f.maintain('cover','stale-id'),false);assert.deepEqual(f.snapshot.problems,[problem]);
 assert.equal(f.maintain('cover',problem.id),true);assert.equal(f.maintain('cover',problem.id),false);
 advance(f,1/12);assert.notEqual(f.snapshot.problems[0].id,problem.id);
});
test('soil grows progressively with weather exposure and maintenance reduces only the specified component risk',()=>{
 const calm=model({rules:[rule('cover',{baseRatePerHour:0}),rule('solar',{baseRatePerHour:0})]}),storm=model({fixedWeather:'storm',rules:[rule('cover',{baseRatePerHour:0}),rule('solar',{baseRatePerHour:0})]});
 advance(calm,1);advance(storm,1);near(storm.snapshot.components.cover.soil,calm.snapshot.components.cover.soil*3);
 const before=calm.snapshot,solar=before.components.solar;assert.equal(calm.maintain('cover'),true);const after=calm.snapshot;
 assert.equal(after.components.cover.soil,0);assert.equal(after.components.cover.conditionMultiplier,.35);
 assert.deepEqual(after.components.solar,solar);assert.equal(after.components.cover.revision,before.components.cover.revision+1);
 assert.equal(calm.maintain('cover'),false);assert.ok(probability(.006*.35,1)<probability(.006,1));
});
test('a severe candidate needs a latent warning, full first-day protection, mutual exclusion and repair cooldown',()=>{
 const f=model({rules:[rule('cover',{seriousAfterHours:1/12}),rule('solar',{seriousAfterHours:1/12})]});
 advance(f,24-1/12);assert.equal(f.snapshot.problems.length,0);assert.equal(f.snapshot.random.streams.equipment.draws,0);
 advance(f,1/12);assert.deepEqual(f.snapshot.problems.map(p=>p.stage),['latent','latent']);
 advance(f,1/12);assert.equal(f.snapshot.problems.filter(p=>p.stage==='serious').length,1);
 const serious=f.snapshot.problems.find(p=>p.stage==='serious');assert.equal(f.maintain(serious.component,serious.id),true);
 const until=f.snapshot.seriousCooldownUntil;advance(f,6-1/12);assert.ok(f.snapshot.problems.every(p=>p.stage==='latent'));
 advance(f,1/12);assert.equal(f.snapshot.problems.filter(p=>p.stage==='serious').length,1);near(f.snapshot.elapsedHours,until);
 // The cooldown did not create a queue of replacement problems or consume suppressed random draws.
 assert.equal(f.snapshot.random.streams.equipment.draws,2);assert.equal(f.snapshot.problems.length,1);
});
test('component iteration order is stable even when a configured pool arrives in another order',()=>{
 const rules=[rule('cover'),rule('solar')],a=model({rules}),b=model({rules:[...rules].reverse()});advance(a,12);advance(b,12);assert.deepEqual(a.snapshot,b.snapshot);
});
test('same seed and effective commands replay identically across coarse/fine simulation frames',()=>{
 const results=[];
 for(const dt of [1/6,1/60,1/600]){
  const f=model({fixedWeather:undefined,rules:[rule('cover',{baseRatePerHour:.2}),rule('solar',{baseRatePerHour:.15})]});
  for(let block=0;block<12;block++){
   for(let i=0;i<Math.round(4/dt);i++)advance(f,dt);
   if(block%2===0)f.maintain('cover');if(block%3===0)f.maintain('solar');
  }
  results.push(f.snapshot);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);assert.equal(results[0].ticks,576);
});
test('real shared clock receipts are frame invariant, while pause, explicit clock stop and reset never advance hazards',()=>{
 const results=[];
 for(const dt of [.1,.05,.02]){
  const clock=new RoomTimeOfDay(),f=model({fixedWeather:undefined});clock.advance(0);const run=(seconds,paused=false)=>{for(let i=0;i<Math.round(seconds/dt);i++){clock.advance(dt,paused,paused);f.advance(clock.lastAdvance);}};
  run(240);const before=f.snapshot;run(2,true);assert.deepEqual(f.snapshot,before);
  clock.setAutomatic(false);clock.select(21);run(2);assert.deepEqual(f.snapshot,before);
  clock.setAutomatic(true);clock.advance(999);f.advance(clock.lastAdvance);assert.deepEqual(f.snapshot,before);
  run(240);results.push(f.snapshot);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);near(results[0].elapsedHours,8);assert.equal(results[0].ticks,96);
});
test('invalid simulation input fails without changing state and diagnostic snapshots are deeply immutable JSON',()=>{
 const f=model({rules:[rule()]});advance(f,1);const before=f.snapshot;
 for(const h of [-1,NaN,Infinity,24.001]){assert.throws(()=>f.advance({automaticHours:h}),RangeError);assert.deepEqual(f.snapshot,before);}
 assert.throws(()=>f.setTreatmentAvailable('missing',true),RangeError);assert.equal(f.maintain('drive'),false);
 const frozen=o=>{if(o&&typeof o==='object'){assert.equal(Object.isFrozen(o),true);Object.values(o).forEach(frozen);}};frozen(before);
 assert.deepEqual(JSON.parse(JSON.stringify(before)),before);
 for(const rules of [[rule('cover',{baseRatePerHour:-1})],[rule('cover',{seriousAfterHours:0})],[rule('cover',{remedy:'repair-seal'})],[rule(),rule()]])assert.throws(()=>model({rules}),RangeError);
});
