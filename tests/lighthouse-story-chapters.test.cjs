const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {createLighthouseStorySession:create,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode}=load('LighthouseStorySave');
const {LighthouseStoryBridge:Bridge}=load('LighthouseStoryBridge');
const {LighthouseStoryWait:Wait,storyWaitPlan:plan,advanceStoryUnobserved:unobserved}=load('LighthouseStoryWait');
const {advanceWeatherDuty,synchronizeWeatherDuty,lighthouseDiscoveryFacts}=load('LighthouseWeatherSession');
const {lighthouseSolarW,LighthousePower}=load('LighthousePower');
const {epilogueCommand:epilogue,endingRecord,sourceCheckDetails}=load('LighthouseStoryEpilogue');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(saved){
 const s=saved||create('chapters-real-events',0),e=s.equipment,bridge=new Bridge(s.story,e);let near=[];
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
 e.clock.advance(0);sync();return{s,e,bridge,sync,active,control,compare,solar,observe,arrival,to};
}
test('second and third chapters use actual fog navigation, treatment, independent recheck and handover evidence',()=>{
 const f=fixture(),{s,e}=f;f.arrival();f.to(18.5);
 assert.equal(e.weather.snapshot.weather.kind,'fog');assert.equal(e.weather.snapshot.visibility.required,true);assert.equal(e.operation.snapshot.running,true);
 assert.equal(e.maintenance.snapshot.solarLatent,true);assert.equal(e.power.snapshot.solarW,lighthouseSolarW(e.clock.snapshot.hour)*.45*.85);
 f.compare();f.observe();assert.equal(s.story.snapshot.objective.id,'ST05');assert.equal(s.story.fieldWork.canReport,false);
 assert.equal(s.story.recordSolarUncertainty(),true);const note=encode(s);assert.equal(encode(decode(note)),note);
 f.solar('surface-test');assert.equal(e.discovery.view('solar').latest.status,'confirmed');f.solar('clean');
 assert.equal(s.story.fieldWork.canReport,false);assert.equal(s.story.fieldWork.checks.find(c=>c.id==='cleaned').complete,true);
 f.solar('inspect');assert.equal(s.story.fieldWork.checks.find(c=>c.id==='recheck').complete,true);assert.equal(s.story.fieldWork.canReport,false);
 f.compare();assert.equal(s.story.fieldWork.canReport,true);assert.equal(s.story.submitReport('solar'),true);
 let r=fixture(decode(encode(s)));assert.equal(r.s.story.deliverReply('solar-report'),true);r.s.story.readMessage('solar-ack');
 assert.equal(r.s.story.snapshot.objective.id,'ST06');r.to(42.5);assert.equal(r.e.weather.snapshot.weather.kind,'storm');assert.equal(r.e.maintenance.snapshot.solarDirty,false);
 r.s.story.readMessage('transport-warning');assert.equal(r.s.story.reviewStormPlan(),false);r.control();assert.equal(r.s.story.reviewStormPlan(),true);
 assert.equal(r.s.story.fieldWork.canReport,false);r.to(48.5);r.control();r.solar('surface-test');r.compare();
 if(r.e.maintenance.snapshot.solarDirty){assert.equal(r.s.story.submitReport('handover'),false);assert.equal(r.s.story.fieldWork.knownIssues.length,1);
  assert.notEqual(r.s.story.exportState().context.problems.solar,r.s.story.solarProblemId);
  const originalTreatments=r.s.story.exportState().facts.filter(f=>f.kind==='solar-cleaned').length;r.solar('clean');
  assert.equal(r.s.story.exportState().facts.filter(f=>f.kind==='solar-cleaned').length,originalTreatments,'a new risk instance must not impersonate the original film treatment');
  r.solar('inspect');r.compare();r.control();}
 assert.equal(r.s.story.fieldWork.canReport,true,JSON.stringify({work:r.s.story.fieldWork,context:r.s.story.exportState().context,facts:r.s.story.exportState().facts}));assert.equal(r.s.story.submitReport('handover',r.s.story.fieldWork.knownIssues),true);
 assert.equal(r.s.story.snapshot.tasks[6].status,'complete');assert.equal(r.s.story.snapshot.transport.stayRegistered,false);
 assert.equal(r.s.story.chooseDiary('familiar-path'),true);assert.equal(r.s.story.chooseDiary('three-days'),false);
 const raw=encode(r.s);assert.equal(encode(decode(raw)),raw);assert.equal(r.e.weather.storySolarProblemId,s.story.solarProblemId);
});
test('wait and ordinary unobserved automatic receipts agree exactly, including split waits and checkpoint continuation',()=>{
 const a=fixture(),b=fixture(decode(encode(a.s)));a.e.clock.setAutomatic(true);a.e.clock.advance(0);
 const w=new Wait(b.s,b.bridge,{target:26.037,title:'equivalence',reason:'',recovery:false});
 let steps=0;while(b.e.weather.acceptedAutomaticHours<26.037-1e-8){
  if(!w.running)break;w.batch(1);unobserved(a.s,a.bridge,Math.min(.1,Math.max(0,(26.037-a.e.weather.acceptedAutomaticHours)*60)));steps++;
 }
 // New thin-film/cover boundaries intentionally stop a wait; the ordinary path must have the identical state there.
 a.e.clock.setAutomatic(false);b.e.clock.setAutomatic(false);assert.equal(encode(a.s),encode(b.s));assert.ok(steps>100);
 const saved=fixture(decode(encode(b.s)));const x=new Wait(b.s,b.bridge,{target:b.e.weather.acceptedAutomaticHours+.037,title:'fraction',reason:'',recovery:false}),y=new Wait(saved.s,saved.bridge,{...x.plan});
 while(x.batch(7));while(y.batch(41));assert.equal(encode(b.s),encode(saved.s));assert.ok(Math.abs(b.e.weather.acceptedAutomaticHours-x.plan.target)<1e-8);
});
test('waiting never submits actions, observes a main-light cycle or reads messages; cancel keeps accepted time',()=>{
 const f=fixture();f.arrival();const before=clone(f.s.story.exportState().facts),wait=new Wait(f.s,f.bridge,plan(f.s));
 wait.batch(20);wait.cancel();assert.ok(f.e.weather.acceptedAutomaticHours>0);assert.equal(f.e.clock.playback.automatic,false);
 assert.deepEqual(f.s.story.exportState().facts,before);assert.equal(f.s.story.snapshot.tasks[3].status,'active');
 const at=f.e.weather.acceptedAutomaticHours;wait.batch(600);assert.equal(f.e.weather.acceptedAutomaticHours,at);
 assert.equal(f.e.inspection.snapshot.observationSeconds,3);assert.equal(f.e.maintenance.snapshot.action,undefined);
 assert.ok(f.s.story.snapshot.messages.filter(m=>m.id==='night-notice').every(m=>m.state==='unread'));
 const paused=encode(f.s);f.e.clock.advance(1000,true,true);assert.equal(encode(f.s),paused);
});
test('story solar is one persistent original-risk instance, escalates after two hours and does not recur to satisfy a task',()=>{
 const f=fixture();f.to(18);const id=f.e.weather.storySolarProblemId;
 assert.equal(f.s.story.solarProblemId,id);assert.equal(f.e.weather.snapshot.problems.find(p=>p.id===id).origin,'story');
 assert.equal(f.e.maintenance.snapshot.solarLatent,true);const early=fixture(decode(encode(f.s)));early.to(19.999);
 assert.equal(early.e.maintenance.snapshot.solarLatent,true);early.to(20);assert.equal(early.e.maintenance.snapshot.solarLatent,false);
 f.solar('surface-test');f.solar('clean');f.solar('inspect');f.compare();assert.equal(f.e.weather.snapshot.problems.some(p=>p.id===id),false);
 const saved=fixture(decode(encode(f.s)));saved.to(26);assert.equal(saved.e.weather.storySolarProblemId,id);
 assert.equal(saved.e.weather.snapshot.events.filter(e=>e.type==='created'&&e.problemId===id).length,1);
});
test('early treatment carries into the fog chapter without duplicate dirt; reports still need new valid evidence',()=>{
 const f=fixture();f.to(18.5);f.solar('surface-test');f.solar('clean');f.solar('inspect');f.compare();
 const id=f.s.story.solarProblemId;f.to(26.5);f.arrival();assert.equal(f.e.weather.storySolarProblemId,id);
 f.to(66.5);f.compare();f.observe();assert.equal(f.s.story.snapshot.objective.id,'ST05');
 assert.equal(f.s.story.fieldWork.canReport,false);f.solar('inspect');f.compare();assert.equal(f.s.story.fieldWork.canReport,true);
 f.s.story.submitReport('solar');assert.match(f.s.story.snapshot.messages.find(m=>m.id==='solar-report').body,/此前已经处理/);
});
test('late play keeps original transport times and offers repeated genuine daylight fog windows',()=>{
 const f=fixture();f.arrival();f.to(75);assert.equal(f.s.story.snapshot.calendar.day,4);assert.equal(f.s.story.snapshot.messages.find(m=>m.id==='pickup-cancelled').sentAt,72);
 const next=plan(f.s);assert.equal(next.target,90.5);f.to(next.target);assert.equal(f.e.weather.snapshot.weather.kind,'fog');
 assert.equal(f.e.weather.snapshot.visibility.required,true);f.compare();f.observe();assert.equal(f.s.story.snapshot.objective.id,'ST05');
 assert.equal(f.s.story.snapshot.messages.filter(m=>m.id==='pickup-cancelled').length,1);assert.match(f.s.story.snapshot.objective.reason,/薄膜/);
});
test('low power blocks ordinary rest while a separate recharge wait uses real solar Wh and stops at recovery',()=>{
 const f=fixture();f.e.power=new LighthousePower({mainWh:200,backupWh:10});f.sync();
 assert.equal(plan(f.s).target,undefined);assert.match(plan(f.s).reason,/电量|供电/);
 const recovery=plan(f.s,true);assert.ok(recovery.target>0);const before=f.e.power.snapshot.mainWh,w=new Wait(f.s,f.bridge,recovery);
 while(w.batch(300));assert.equal(f.e.power.snapshot.recoveryReady,true);assert.ok(f.e.power.snapshot.mainWh>before);
 assert.match(w.reason,/电量回升/);assert.equal(f.e.power.snapshot.protected,true);assert.equal(plan(f.s,true).target,undefined);
 assert.ok(f.e.power.snapshot.events.some(e=>/回升|20%/.test(e.result)));assert.equal(f.e.inspection.snapshot.optic,undefined);
});
test('unsafe outdoor work and unavailable navigation cannot be papered over with handover or safe-rest controls',()=>{
 const f=fixture();f.to(42.5);f.e.maintenance.setSurfaceObserver(undefined);
 assert.equal(f.e.maintenance.command('clean','lighthouse-solar-array','cloth',f.e.operation,true),false);assert.match(f.e.maintenance.snapshot.notice,/风雨/);
 const raw=encode(f.s),r=fixture(decode(raw));r.e.power=new LighthousePower({mainWh:0,backupWh:0});r.sync();
 r.to(53);assert.equal(r.e.maintenance.snapshot.navigationRequired,false);
 r.to(54);assert.equal(r.e.maintenance.snapshot.navigationRequired,true);assert.equal(r.e.maintenance.snapshot.source,'none');
 assert.equal(plan(r.s).target,undefined);assert.match(plan(r.s).reason,/导航/);
});
test('new story schedule and uncertainty checkpoints reject corrupt cross-model state and preserve old first-chapter saves',()=>{
 const f=fixture();f.arrival();const good=JSON.parse(encode(f.s));
 for(const edit of [v=>v.equipment.weather.weather.story.tick++,v=>v.equipment.weather.weather.story.joinedAt=99,
  v=>v.equipment.weather.storySolar='weather-problem-999',v=>v.equipment.weather.weather.kind='storm']){
  const raw=clone(good);edit(raw);assert.throws(()=>decode(JSON.stringify(raw)));
 }
 // A legacy chapter-one checkpoint has the exact old automatic weather fields and no new optional narrative fields.
 const legacy=clone(good);delete legacy.equipment.weather.weather.story;
 Object.assign(legacy.equipment.weather.weather,{mode:'automatic',kind:'clear',from:'clear',ageTicks:0,remainingTicks:40});
 const resumed=fixture(decode(JSON.stringify(legacy)));assert.equal(resumed.s.story.snapshot.tasks[2].status,'complete');
 assert.equal(resumed.e.clock.playback.automatic,false);assert.ok(resumed.e.weather.exportState().weather.story);
 assert.equal(encode(decode(encode(resumed.s))),encode(resumed.s));
});
test('recharge waiting stops for a newly protected main battery and a later loss of actual backup navigation',()=>{
 const f=fixture();f.to(5.5);f.e.power=new LighthousePower({mainWh:300,backupWh:1});f.sync();
 const first=new Wait(f.s,f.bridge,plan(f.s,true));while(first.batch(100));
 assert.equal(f.e.power.snapshot.protected,true);assert.equal(f.e.maintenance.snapshot.source,'backup');assert.match(first.reason,/灯况或电量有变化/);
 const second=new Wait(f.s,f.bridge,plan(f.s,true));while(second.batch(100));
 assert.equal(f.e.maintenance.snapshot.navigationRequired,true);assert.equal(f.e.maintenance.snapshot.source,'none');assert.match(second.reason,/灯况或电量有变化/);
 assert.ok(f.e.maintenance.snapshot.evidence.some(e=>e.method==='导航不可用'));assert.ok(plan(f.s,true).target>f.e.weather.acceptedAutomaticHours);
});
test('ordinary save services refuse a story schedule even though its inner equipment codec is shared',()=>{
 const {LighthouseSave,encodeLighthouseSave,LIGHTHOUSE_SAVE_KEY}=load('LighthouseSave'),f=fixture(),values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},normal=new LighthouseSave(()=>storage);
 assert.match(normal.save(f.e).message,/没存上/);assert.equal(values.size,0);
 const raw=encodeLighthouseSave(f.e);values.set(LIGHTHOUSE_SAVE_KEY,raw);assert.equal(normal.inspect().invalid,true);assert.equal(normal.load().session,undefined);
 assert.equal(values.get(LIGHTHOUSE_SAVE_KEY),raw);assert.equal(encode(decode(encode(f.s))),encode(f.s));
});
test('uncertainty notes retain real proof and reject invented, action-in-progress or future checkpoints',()=>{
 const f=fixture();f.arrival();f.to(18.5);f.compare();f.observe();assert.equal(f.s.story.recordSolarUncertainty(),true);const good=JSON.parse(encode(f.s));
 for(const edit of [v=>v.story.solarNote.context.actionInProgress=true,v=>v.story.solarNote.at++,v=>v.story.solarNote.facts=[],v=>v.story.solarNote.extra=true]){
  const value=clone(good);edit(value);assert.throws(()=>decode(JSON.stringify(value)));
 }
 assert.equal(f.s.story.recordSolarUncertainty(),false);assert.equal(encode(decode(JSON.stringify(good))),JSON.stringify(good));
});

let preparedStory;
function afterHandover(){
 if(!preparedStory){const f=fixture(),{s,e}=f;f.arrival();f.to(18.5);f.observe();f.compare();f.solar('surface-test');f.solar('clean');f.solar('inspect');f.compare();
  assert.equal(s.story.submitReport('solar'),true);s.story.deliverReply('solar-report');s.story.readMessage('solar-ack');f.to(42.5);
  s.story.readMessage('transport-warning');f.control();assert.equal(s.story.reviewStormPlan(),true);f.to(48.5);
  f.solar('surface-test');if(e.maintenance.snapshot.solarDirty){f.solar('clean');f.solar('inspect');}f.compare();f.control();
  assert.equal(s.story.submitReport('handover',s.story.fieldWork.knownIssues),true);preparedStory=encode(s);
 }
 return fixture(decode(preparedStory));
}
function registerAtNight(f){f.to(78);f.s.story.readMessage('pickup-cancelled');assert.equal(epilogue(f.s,'stay',true),true);f.sync();}
function readyToFinish(){const f=afterHandover();registerAtNight(f);f.active(30);assert.equal(f.s.story.snapshot.objective.id,'ST10');
 f.s.story.readMessage('old-call');assert.equal(epilogue(f.s,'check',false),true);f.s.story.deliverReply('source-check');f.s.story.readMessage('source-check-reply');return f;}

test('handover saves continue to the real 72-hour cancellation and offer only the next genuine night wait',()=>{
 const f=afterHandover();assert.equal(plan(f.s).target,72);assert.equal(epilogue(f.s,'stay',true),false);
 f.to(72);assert.equal(f.s.story.snapshot.messages.find(m=>m.id==='pickup-cancelled').sentAt,72);
 assert.equal(epilogue(f.s,'stay',true),false);f.s.story.readMessage('pickup-cancelled');assert.equal(epilogue(f.s,'stay',false),false);
 assert.equal(epilogue(f.s,'stay',true),true);f.sync();assert.equal(epilogue(f.s,'stay',true),false);
 assert.equal(plan(f.s).target,78);f.to(78);assert.equal(plan(f.s).target,undefined);
 assert.equal(f.s.story.snapshot.objective.id,'ST09');assert.equal(f.e.inspection.snapshot.observationSeconds,0);
 const r=fixture(decode(encode(f.s)));r.active(2.9);assert.equal(r.s.story.snapshot.objective.id,'ST09');r.active(.1);
 assert.equal(r.s.story.snapshot.objective.id,'ST10');assert.equal(r.s.story.snapshot.tasks[8].completion.facts[0].kind,'main');
 assert.equal(r.s.story.snapshot.messages.filter(m=>m.id==='old-call').length,1);
});
test('a completed main observation before registration cannot be reused and interruption or reload restarts pending work',()=>{
 const f=afterHandover();f.to(78);f.observe();assert.ok(f.e.inspection.snapshot.optic);f.s.story.readMessage('pickup-cancelled');
 epilogue(f.s,'stay',true);f.sync();assert.equal(f.e.inspection.snapshot.optic,undefined);assert.equal(f.s.story.snapshot.objective.id,'ST09');
 f.active(2);f.active(.1,{optic:false,cover:false,output:0,action:false});assert.equal(f.e.inspection.snapshot.observationSeconds,0);
 f.active(2);const r=fixture(decode(encode(f.s)));r.active(1);assert.equal(r.s.story.snapshot.objective.id,'ST09');
 r.active(2);assert.equal(r.s.story.snapshot.objective.id,'ST10');
});
test('actual backup observation shows read-only progress and needs ten new seconds after registration',()=>{
 const f=afterHandover();f.to(78);f.e.power=new LighthousePower({mainWh:200,backupWh:120});f.sync();
 assert.equal(f.e.maintenance.snapshot.source,'backup');f.active(10);assert.equal(f.e.maintenance.snapshot.backupConfirmed,true);
 f.s.story.readMessage('pickup-cancelled');epilogue(f.s,'stay',true);f.sync();assert.equal(f.e.maintenance.snapshot.backupConfirmed,false);
 f.active(4);const {lighthouseProgress:progress}=load('LighthouseExperience');
 assert.equal(progress(f.e.inspection.snapshot,f.e.maintenance.snapshot,f.e.power.snapshot).kind,'backup-observation');
 f.active(.1,{optic:false,cover:false,output:0,action:false}); // fixture sight.backup follows the actual lamp; explicitly interrupt below.
 f.e.clock.advance(.1);f.e.maintenance.advance(f.e.clock.lastAdvance,f.e.operation,{action:false,backup:false,main:false,mainOutput:0});f.sync();
 assert.equal(f.e.maintenance.snapshot.backupObservationSeconds,0);f.active(9.9);assert.equal(f.s.story.snapshot.objective.id,'ST09');
 f.active(.1);assert.equal(f.s.story.snapshot.objective.id,'ST10');
 assert.equal(f.s.story.snapshot.tasks[8].completion.facts[0].kind,'backup');assert.equal(f.e.inspection.snapshot.optic,undefined);
 assert.match(f.s.story.snapshot.tasks[8].completion.facts[0].method,/direct-view/);
 f.s.story.readMessage('old-call');epilogue(f.s,'check',false);f.s.story.deliverReply('source-check');f.s.story.readMessage('source-check-reply');epilogue(f.s,'finish',false);
 assert.match(endingRecord(f.s.story.snapshot).pending,/主灯仍需检查和恢复/);
});
test('daylight fog backup confirmation cannot satisfy the later night and a lost navigator cannot be bypassed',()=>{
 const f=afterHandover();f.to(90.5);f.e.power=new LighthousePower({mainWh:200,backupWh:120});f.sync();
 f.s.story.readMessage('pickup-cancelled');epilogue(f.s,'stay',true);f.sync();assert.equal(f.e.maintenance.snapshot.source,'backup');
 f.active(10);assert.equal(f.e.maintenance.snapshot.backupConfirmed,true);assert.equal(f.s.story.snapshot.objective.id,'ST09');
 assert.equal(plan(f.s,true).recovery,true);f.to(102);assert.equal(f.e.maintenance.snapshot.backupConfirmed,false);
 f.active(9.9);assert.equal(f.s.story.snapshot.objective.id,'ST09');f.active(.1);assert.equal(f.s.story.snapshot.objective.id,'ST10');
 const g=afterHandover();registerAtNight(g);g.e.power=new LighthousePower({mainWh:0,backupWh:0});g.sync();g.active(35);
 assert.equal(g.e.maintenance.snapshot.source,'none');assert.equal(g.s.story.snapshot.objective.id,'ST09');assert.equal(plan(g.s).target,undefined);
 assert.ok(plan(g.s,true).target>g.s.story.snapshot.elapsedHours);assert.equal(epilogue(g.s,'check',false),false);assert.equal(epilogue(g.s,'finish',false),false);
});
test('night registration across midnight starts a new watch without changing completed history or sender time',()=>{
 const f=afterHandover();f.to(83.999);f.s.story.readMessage('pickup-cancelled');epilogue(f.s,'stay',true);f.sync();f.active(1.5);
 assert.equal(f.s.story.snapshot.calendar.day,4);f.to(84);assert.equal(f.e.inspection.snapshot.observationSeconds,0);
 f.active(2.9);assert.equal(f.s.story.snapshot.objective.id,'ST09');f.active(.1);assert.equal(f.s.story.snapshot.objective.id,'ST10');
 assert.equal(f.s.story.snapshot.tasks[8].completion.context.elapsedHours,84);assert.equal(f.s.story.snapshot.tasks[6].status,'complete');
 assert.equal(f.s.story.snapshot.messages.find(m=>m.id==='pickup-cancelled').sentAt,72);
});
test('source verification and ending restore each distinct boundary without duplicate messages or implicit finish',()=>{
 let f=afterHandover();registerAtNight(f);f.active(30);const original=f.s.story.snapshot.messages.find(m=>m.id==='old-call');
 assert.equal(epilogue(f.s,'check',false),false);f.s.story.readMessage('old-call');assert.equal(epilogue(f.s,'check',false),true);
 assert.equal(epilogue(f.s,'check',false),false);assert.equal(f.s.story.snapshot.sourceCheck.status,'pending');
 f=fixture(decode(encode(f.s)));assert.equal(f.s.story.snapshot.sourceCheck.status,'pending');assert.equal(f.s.story.snapshot.finished,false);
 f.s.story.deliverReply('source-check');f=fixture(decode(encode(f.s)));assert.equal(f.s.story.snapshot.goalsComplete,false);
 assert.equal(f.s.story.snapshot.sourceCheck.sender,null);assert.equal(f.s.story.snapshot.messages.find(m=>m.id==='source-check-reply').state,'unread');
 f.s.story.readMessage('source-check-reply');assert.equal(f.s.story.snapshot.goalsComplete,true);assert.equal(f.s.story.snapshot.finished,false);
 f=fixture(decode(encode(f.s)));assert.equal(epilogue(f.s,'finish',false),true);assert.equal(epilogue(f.s,'finish',false),false);
 f=fixture(decode(encode(f.s)));assert.equal(f.s.story.snapshot.finished,true);assert.equal(f.s.story.snapshot.endingSeen,false);
 assert.equal(epilogue(f.s,'seen',false),true);const before=encode(f.s);assert.equal(epilogue(f.s,'seen',false),true);assert.equal(encode(f.s),before);
 const r=fixture(decode(before));assert.equal(r.s.story.snapshot.endingSeen,true);assert.equal(r.s.story.snapshot.transport.stayRegistered,true);
 assert.deepEqual(r.s.story.snapshot.messages.find(m=>m.id==='old-call'),{...original,readAt:original.sentAt,readOrder:r.s.story.snapshot.messages.find(m=>m.id==='old-call').readOrder,state:'read'});
 assert.equal(r.s.story.snapshot.messages.filter(m=>m.id==='source-check-reply').length,1);assert.equal(r.e.clock.playback.automatic,false);
 assert.ok(sourceCheckDetails(r.s.story.snapshot).includes(original.body));assert.match(sourceCheckDetails(r.s.story.snapshot),/来源待核验/);
});
test('ending summaries use completion-time work and pending issues while later island play preserves the finished chapter',()=>{
 const f=readyToFinish();f.s.story.chooseDiary('familiar-path');epilogue(f.s,'finish',false);const record=endingRecord(f.s.story.snapshot),end=f.s.story.snapshot.tasks[10].completion;
 assert.match(record.work.join('\n'),/3秒.*转动和出光正常/s);assert.match(record.work[1],/输入.*W.*估算.*W/s);assert.match(record.source,/发送者仍未查明/);
 assert.equal(record.diary,'现在不用看地图了。');f.to(110);assert.deepEqual(endingRecord(f.s.story.snapshot),record);
 assert.deepEqual(f.s.story.snapshot.tasks[10].completion,end);assert.equal(f.s.story.snapshot.messages.filter(m=>m.id==='old-call').length,1);
 const backup=readyToFinish(),state=backup.s.story.snapshot; // view-only variant tests wording without pretending it is a valid checkpoint.
 const view=clone(state);view.tasks[8].completion.facts[0].kind='backup';view.tasks[10].completion=view.tasks[9].completion;
 assert.match(endingRecord(view).work[3],/备用灯.*10秒.*主灯仍需/s);
});
test('a failed final save preserves the old slot and the live ending can be retried without repeating its completion',()=>{
 const {LighthouseStorySave:Save,LIGHTHOUSE_STORY_SAVE_KEY:key}=load('LighthouseStorySave');const f=readyToFinish();let raw=encode(f.s),fail=true;
 const old=raw,storage={getItem:k=>k===key?raw:null,setItem:(k,v)=>{if(fail)throw Error('quota');raw=v;},removeItem:()=>{}};
 const slot=new Save(()=>storage);epilogue(f.s,'finish',false);const complete=f.s.story.snapshot.tasks[10].completion;
 assert.equal(slot.save(f.s).saved,false);assert.equal(raw,old);assert.equal(f.s.story.snapshot.finished,true);
 epilogue(f.s,'seen',false);assert.equal(slot.save(f.s).saved,false);assert.equal(raw,old);fail=false;assert.equal(slot.save(f.s).saved,true);
 const restored=slot.load().session;assert.deepEqual(restored.story.snapshot.tasks[10].completion,complete);assert.equal(restored.story.snapshot.endingSeen,true);
});
