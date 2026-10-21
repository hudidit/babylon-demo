const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseWeatherRisk}=load('LighthouseRisk');
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rules=[{component:'cover',objectId:'lighthouse-optics-cleaning',remedy:'clean-cover',baseRatePerHour:.2,soilPerHour:.03,minimumSoil:.15,seriousAfterHours:null},
 {component:'solar',objectId:'lighthouse-solar-array',remedy:'clean-solar',baseRatePerHour:.15,soilPerHour:.02,minimumSoil:.15,seriousAfterHours:null}];
const record={baseline:'1f9ef6c',method:'Isolated pure logic, deterministic stress-rate replay; these .2/.15 rates are fixtures, not default balancing or actual play. Four-hour command boundaries, 48 automatic scene hours, no rendering/wall-clock/offline progression.',rules,seeds:[],files:{}};
for(const seed of [0,1,123,20261021]){
 const results=[];
 for(const stepHours of [1/6,1/60,1/600]){
  const model=new LighthouseWeatherRisk({seed,rules});
  for(let block=0;block<12;block++){
   for(let i=0;i<Math.round(4/stepHours);i++)model.advance({automaticHours:stepHours});
   if(block%2===0)model.maintain('cover');if(block%3===0)model.maintain('solar');
  }
  results.push({stepHours,sha256:sha(model.snapshot),snapshot:model.snapshot});
 }
 assert.deepEqual(results[0].snapshot,results[1].snapshot);assert.deepEqual(results[0].snapshot,results[2].snapshot);
 record.seeds.push({seed,steps:results.map(({stepHours,sha256})=>({stepHours,sha256})),snapshot:results[0].snapshot,passed:true});
}
for(const name of ['LighthouseRandom.ts','LighthouseWeather.ts','LighthouseRisk.ts'])record.files[name]=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../../../src/examples',name))).digest('hex');
assert.ok(!Object.keys(require.cache).some(file=>file.includes('@babylonjs')),'Pure models must not load Babylon');
record.passed=true;fs.writeFileSync(path.join(__dirname,'models.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({passed:true,seeds:record.seeds.map(s=>({seed:s.seed,steps:s.steps,events:s.snapshot.events.length}))}));
