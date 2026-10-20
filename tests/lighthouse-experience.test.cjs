const assert = require('node:assert/strict'), {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {lighthouseMaintenanceAllowed, lighthousePowerAllowed, lighthouseProgress, lighthouseRecords, lighthouseRecordPage} = load('LighthouseExperience');
const fixture = () => ({i: new (load('LighthouseInspection').LighthouseInspection)().snapshot,
 m: new (load('LighthouseMaintenance').LighthouseMaintenance)().snapshot,
 p: new (load('LighthousePower').LighthousePower)().snapshot});
test('player commands retain local solar patrol and recovery, excluding the four deferred groups', () => {
 for (const location of ['control','lighthouse-drive-hatch','lighthouse-beacon-backup','lighthouse-solar-charger','lighthouse-light-sensor']) {
  for (const command of ['inspect','clean','replace','takeover','self-test','isolate-main','probe','override-on']) assert.equal(lighthouseMaintenanceAllowed(location,command),false);
 }
 assert.equal(lighthouseMaintenanceAllowed('lighthouse-solar-array','inspect'),true);
 assert.equal(lighthouseMaintenanceAllowed('lighthouse-solar-array','clean'),true);
 assert.equal(lighthouseMaintenanceAllowed('lighthouse-solar-array','diagnose'),false);
 assert.equal(lighthousePowerAllowed('lighthouse-battery-main','verify-main'),true);
 for(const cmd of ['start-generator','stop-generator','refuel','probe-solar','probe-generator'])assert.equal(lighthousePowerAllowed('lighthouse-generator',cmd),false);
});
test('reticle uses accepted progress and cannot close merely by waiting without turn/output evidence', () => {
 const {i,m,p}=fixture();assert.equal(lighthouseProgress(i,m,p),undefined);
 assert.equal(lighthouseProgress({...i,observationSeconds:5},m,p).fraction,.5);
 assert.equal(lighthouseProgress({...i,observationSeconds:10,outputSeen:false},m,p).fraction,.97);
 assert.equal(lighthouseProgress({...i,observationSeconds:10,optic:{hour:12}},m,p),undefined);
 assert.equal(lighthouseProgress({...i,cleaning:true,cleaningSeconds:.75},m,p).fraction,.5);
 assert.equal(lighthouseProgress(i,{...m,action:{command:'inspect',elapsed:1,duration:2}},p).fraction,.5);
 assert.equal(lighthouseProgress(i,m,{...p,action:{elapsed:.5,duration:2}}).fraction,.25);
});
test('paper records filter by local object and remove technical events while preserving dirty/clean and interruption', () => {
 const {i,m,p}=fixture(); const events=[
  {id:1,dutyDay:1,hour:12,type:'control-read',objectId:'lighthouse-control-panel',result:'日间待机'},
  {id:2,dutyDay:1,hour:12,type:'cover-observed',objectId:'lighthouse-optics-cleaning',result:'轻度盐膜'},
  {id:3,dutyDay:1,hour:12,type:'cleaning-started',objectId:'lighthouse-optics-cleaning'},
  {id:4,dutyDay:1,hour:12,type:'cleaning-cancelled',objectId:'lighthouse-optics-cleaning'},
  {id:5,dutyDay:1,hour:12,type:'cover-cleaned',objectId:'lighthouse-optics-cleaning'},
  {id:6,dutyDay:1,hour:12,type:'cover-observed',objectId:'lighthouse-optics-cleaning',result:'保护面洁净，复查通过'}];
 const cover=lighthouseRecords('cover',{...i,events},m,p);assert.equal(cover.length,4);
 assert.equal(cover[0].result,'表面洁净，已确认');assert.equal(cover[1].result,'已清洁，待复查');assert.equal(cover[2].result,'表面保持原状');
 assert.equal(lighthouseRecords('control',{...i,events},m,p).length,1);
 assert.equal(lighthouseRecords('lighthouse-solar-charger',{...i,events},m,p).length,0);
 assert.equal(lighthouseRecords('log',{...i,events},m,p).length,5);
 const solar=lighthouseRecords('lighthouse-solar-array',i,{...m,evidence:[{id:1,component:'solar',method:'开始现场观察',day:1,hour:12},{id:2,component:'solar',method:'现场观察',day:1,hour:12,result:'面板有遮挡污损。'}]},p);
 assert.equal(solar.length,1);assert.equal(solar[0].result,'发现污损');
});
test('paper pagination clamps changing and empty records and never requires an unbounded scroll', () => {
 const rows=Array.from({length:12},(_,n)=>({day:1,hour:n}));
 assert.deepEqual(lighthouseRecordPage(rows,1).rows,rows.slice(5,10));assert.equal(lighthouseRecordPage(rows,200).page,2);
 assert.equal(lighthouseRecordPage(rows,-1).page,0);assert.deepEqual(lighthouseRecordPage([],5),{rows:[],page:0,pages:1});
});
