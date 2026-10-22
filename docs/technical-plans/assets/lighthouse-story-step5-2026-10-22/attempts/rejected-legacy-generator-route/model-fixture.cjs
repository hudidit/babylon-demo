const assert=require('node:assert/strict');
const load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const {createLighthouseStorySession:create,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode}=load('LighthouseStorySave');
const {LighthouseStoryBridge:Bridge}=load('LighthouseStoryBridge');
const {LighthouseStoryWait:Wait,storyWaitPlan:plan,advanceStoryUnobserved:unobserved}=load('LighthouseStoryWait');
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
  e.power.advanceAction(e.clock.lastAdvance,e.operation.snapshot,e.maintenance.snapshot,!!sight.action,e.clock.playback.automatic,()=>{});e.inspection.advance(e.clock.lastAdvance,before,e.operation.snapshot,sight);sync();}};
 const control=()=>{near=[];e.inspection.confirmControl(e.operation.snapshot,true,true);sync();};
 const compare=()=>{near=[];e.maintenance.compareSolar(e.operation.snapshot,e.power.snapshot.solarW,lighthouseSolarW(e.clock.snapshot.hour)*e.weather.snapshot.weather.solarMultiplier,true);sync();};
 const solar=(command)=>{near=['solar'];sync();assert.equal(e.maintenance.command(command,'lighthouse-solar-array',command==='clean'?'cloth':'meter',e.operation,true),true,e.maintenance.snapshot.notice);sync();active(command==='surface-test'?5:2);};
 const observe=()=>{near=[];e.operation.endTest();if(e.maintenance.snapshot.source==='backup'){active(10);return;}assert.equal(e.operation.startTest(),true);e.inspection.renewObservation();sync();active(30);};
 const arrival=()=>{s.story.readMaterial('CL01');s.story.acceptDuty();e.inspection.inspectCover(e.operation.snapshot,true,true);sync();assert.equal(e.inspection.startCleaning(e.operation.snapshot,true),true);active(1.5);
  e.inspection.inspectCover(e.operation.snapshot,true,true);sync();control();observe();assert.equal(s.story.submitReport('arrival'),true);s.story.deliverReply('arrival-report');s.story.readMessage('arrival-ack');e.operation.endTest();sync();assert.equal(s.story.snapshot.objective.id,'ST04');};
 // Repeated fixture targets use only original shared receipts. They bypass UI location/target selection, never create work evidence.
 const to=target=>{near=[];sync();let attempts=0;while(e.weather.acceptedAutomaticHours<target-1e-7){assert.ok(attempts++<20);const wait=new Wait(s,bridge,{target,title:'fixture accepted-clock target',reason:'',recovery:false});while(wait.batch(600));}};
 const roam=target=>{near=[];sync();const automatic=e.clock.playback.automatic;e.clock.setAutomatic(true);e.clock.advance(0);while(e.weather.acceptedAutomaticHours<target-1e-7)unobserved(s,bridge,Math.min(.1,(target-e.weather.acceptedAutomaticHours)*60));e.clock.setAutomatic(automatic);sync();};
 const recover=()=>{if(!e.power.snapshot.protected&&!e.power.snapshot.warning)return false;
  if(e.maintenance.snapshot.solarDirty){solar('surface-test');solar('clean');solar('inspect');}
  const power=(command,location,seconds=0)=>{assert.equal(e.power.command(command,location,'meter',true,e.clock.playback.automatic,e.operation.snapshot,e.maintenance.snapshot),true,e.power.snapshot.notice);active(seconds);sync();};
  e.clock.setAutomatic(true);e.clock.advance(0);power('start-generator','lighthouse-generator',3);
  let attempts=0;while(e.power.snapshot.mainWh<800){assert.ok(attempts++<12,'Charging recovery must progress');to(e.weather.acceptedAutomaticHours+.5);}
  if(e.power.snapshot.protected)power('verify-main','lighthouse-battery-main',2);
  power('stop-generator','lighthouse-generator');e.clock.setAutomatic(false);sync();return true;};
 e.clock.advance(0);sync();return{s,e,bridge,sync,active,control,compare,solar,observe,arrival,to,roam,recover,away:()=>{near=[];sync();}};
}

module.exports={fixture,load,encode,decode,plan,Wait,LighthousePower};
