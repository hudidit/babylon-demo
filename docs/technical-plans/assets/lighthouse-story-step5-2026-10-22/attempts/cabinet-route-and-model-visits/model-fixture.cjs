const assert=require('node:assert/strict');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {createLighthouseStorySession:create,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode}=load('LighthouseStorySave');
const {LighthouseStoryBridge:Bridge}=load('LighthouseStoryBridge');
const {LighthouseStoryWait:Wait,storyWaitPlan:plan}=load('LighthouseStoryWait');
const {advanceWeatherDuty,synchronizeWeatherDuty,lighthouseDiscoveryFacts}=load('LighthouseWeatherSession');
const {lighthouseSolarW,LighthousePower}=load('LighthousePower');
function fixture(saved,seed=0){
 const s=saved||create('story-acceptance-'+seed,seed),e=s.equipment,bridge=new Bridge(s.story,e);let near=saved?null:[];
 const sync=()=>{e.weather.synchronizeSurface('cover',e.inspection.snapshot.dirty);e.weather.synchronizeSurface('solar',e.maintenance.snapshot.solarDirty);
  synchronizeWeatherDuty(e);e.inspection.synchronize(e.operation.snapshot);e.discovery.synchronize(lighthouseDiscoveryFacts(e),e.weather.acceptedAutomaticHours,near);bridge.synchronize(e);};
 e.maintenance.setSurfaceObserver((method,op)=>{const clue=e.discovery.observe('solar',method,op.dutyDay,op.hour);return clue&&{id:clue.id,result:clue.result,identified:['clear','confirmed'].includes(clue.status)};});
 const active=(seconds,sight={optic:true,cover:true,output:1,action:true})=>{e.clock.advance(0);for(let n=0;n<Math.round(seconds*10);n++){
  const before=e.operation.snapshot;e.clock.advance(.1);advanceWeatherDuty(e,e.clock.lastAdvance);sync();
  e.maintenance.advance(e.clock.lastAdvance,e.operation,{action:sight.action,backup:e.maintenance.snapshot.source==='backup',main:false,mainOutput:0});
  e.inspection.advance(e.clock.lastAdvance,before,e.operation.snapshot,sight);sync();}};
 const control=()=>{e.inspection.confirmControl(e.operation.snapshot,true,true);sync();};
 const compare=()=>{e.maintenance.compareSolar(e.operation.snapshot,e.power.snapshot.solarW,lighthouseSolarW(e.clock.snapshot.hour)*e.weather.snapshot.weather.solarMultiplier,true);sync();};
 const solar=(command)=>{near=['solar'];sync();assert.equal(e.maintenance.command(command,'lighthouse-solar-array',command==='clean'?'cloth':'meter',e.operation,true),true,e.maintenance.snapshot.notice);sync();active(command==='surface-test'?5:2);};
 const observe=()=>{e.operation.endTest();if(e.maintenance.snapshot.source==='backup'){active(10);return;}assert.equal(e.operation.startTest(),true);e.inspection.renewObservation();sync();active(30);};
 const arrival=()=>{s.story.readMaterial('CL01');s.story.acceptDuty();e.inspection.inspectCover(e.operation.snapshot,true,true);sync();assert.equal(e.inspection.startCleaning(e.operation.snapshot,true),true);active(1.5);
  e.inspection.inspectCover(e.operation.snapshot,true,true);sync();control();observe();assert.equal(s.story.submitReport('arrival'),true);s.story.deliverReply('arrival-report');s.story.readMessage('arrival-ack');e.operation.endTest();sync();assert.equal(s.story.snapshot.objective.id,'ST04');};
 // Repeated fixture targets use only original shared receipts. They bypass UI location/target selection, never create work evidence.
 const to=target=>{let attempts=0;while(e.weather.acceptedAutomaticHours<target-1e-7){assert.ok(attempts++<20);const wait=new Wait(s,bridge,{target,title:'fixture accepted-clock target',reason:'',recovery:false});while(wait.batch(600));}};
 e.clock.advance(0);sync();return{s,e,bridge,sync,active,control,compare,solar,observe,arrival,to,away:()=>{near=[];sync();}};
}

module.exports={fixture,load,encode,decode,plan,Wait,LighthousePower};
