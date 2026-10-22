const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),ts=require('typescript');
const baselineSource=execFileSync('git',['show','9b80607:src/examples/LighthouseWeatherSession.ts'],{cwd:root,encoding:'utf8'}),baseline={exports:{}};
new Function('require','module','exports',ts.transpileModule(baselineSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,baseline,baseline.exports);
const {createLighthouseStorySession:create}=load('LighthouseStorySave'),current=load('LighthouseWeatherSession'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(bridge){const e=create('midnight-reproduction',216).equipment;for(let n=0;n<325;n++){
 const from=e.clock.snapshot.hour,h=.037,to=(from+h)%24;e.clock.restore(to);
 bridge.advanceWeatherDuty(e,{fromHour:from,toHour:to,automaticHours:h,activeSeconds:0,midnightCrossings:Math.floor((from+h)/24),manualCompleted:false});
 }return{acceptedHours:e.weather.acceptedAutomaticHours,hour:e.clock.snapshot.hour,day:e.operation.snapshot.dutyDay,
  midnightEvents:e.operation.snapshot.events.filter(e=>e.type==='duty-day-started').length};}
const before=run(baseline.exports),after=run(current);assert.equal(before.day,3);assert.equal(after.day,2);assert.equal(before.midnightEvents,2);assert.equal(after.midnightEvents,1);
const record={baseline:'9b80607',baselineSourceSha256:sha(baselineSource),currentSourceSha256:sha(fs.readFileSync(path.join(root,'src/examples/LighthouseWeatherSession.ts'))),before,after,passed:true};
fs.writeFileSync(path.join(__dirname,'midnight-regression.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
