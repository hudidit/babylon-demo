// Full original model/codec routes. Functional state coverage, separate from physical browser walking.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,load,encode,decode,plan,Wait,LighthousePower}=require('./model-fixture.cjs');
const {epilogueCommand:command,endingRecord}=load('LighthouseStoryEpilogue'),root=path.resolve(__dirname,'../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=x=>JSON.parse(JSON.stringify(x));
const record={baseline:'a7178ce',method:'Original clock receipts, equipment/risk/discovery models, committed native model events and strict full-session codec. Model sight inputs are fixtures, not physical browser line-of-sight. No synthetic story evidence/completions, no skipped validators.',routes:[],boundaries:[],errors:[]};
function route(seed,variant='normal',restoreEvery=false){let f=fixture(undefined,seed),checkpoints=0;const events=[];
 const checkpoint=label=>{let raw;try{raw=encode(f.s);}catch(error){const e=f.e;fs.writeFileSync(path.join(__dirname,'equipment-divergence.json'),JSON.stringify({seed,variant,restoreEvery,label,operation:e.operation.exportState(),maintenance:e.maintenance.exportState(),power:e.power.exportState(),weather:e.weather.exportState(),story:f.s.story.exportState()},null,2)+'\n');throw error;}const r=decode(raw);assert.equal(encode(r),raw,label);events.push({label,at:f.s.story.snapshot.elapsedHours,task:f.s.story.snapshot.objective.id,messages:f.s.story.snapshot.messages.length});checkpoints++;if(restoreEvery)f=fixture(r);};
 if(variant==='late-arrival')f.roam(98.5);
 if(f.recover())events.push({label:'solar-only-power-recovery-before-arrival',at:f.e.weather.acceptedAutomaticHours});f.arrival();checkpoint('arrival-ack');
 if(variant==='late-fog')f.to(75);
 let target=plan(f.s).target;assert.ok(target!==undefined,JSON.stringify({variant,seed,view:f.s.story.snapshot,plan:plan(f.s)}));f.to(target);
 const issue=f.s.story.solarProblemId;assert.ok(issue);const at=f.e.weather.acceptedAutomaticHours;
 if(variant==='early-treatment'){f.solar('surface-test');f.solar('clean');f.solar('inspect');f.compare();checkpoint('early-treatment');}
 f.compare();f.observe();assert.equal(f.s.story.snapshot.objective.id,'ST05');checkpoint('fog-observed');
 if(variant!=='early-treatment'){f.solar('surface-test');if(f.e.maintenance.snapshot.solarDirty){f.solar('clean');checkpoint('cleaned-not-rechecked');assert.equal(f.s.story.fieldWork.canReport,false);}f.solar('inspect');}
 else f.solar('inspect');
 f.compare();assert.equal(f.s.story.submitReport('solar'),true);checkpoint('solar-report-awaiting');f.s.story.deliverReply('solar-report');checkpoint('solar-reply-unread');f.s.story.readMessage('solar-ack');checkpoint('solar-ack');
 f.to(Math.max(42.5,f.e.weather.acceptedAutomaticHours));f.s.story.readMessage('transport-warning');f.control();assert.equal(f.s.story.reviewStormPlan(),true);checkpoint('storm-plan');
 f.to(Math.max(48.5,f.e.weather.acceptedAutomaticHours));if(variant==='late-handover')f.roam(194.5);
 if(f.recover())events.push({label:'solar-only-power-recovery-before-handover',at:f.e.weather.acceptedAutomaticHours});f.solar('surface-test');if(f.e.maintenance.snapshot.solarDirty){f.solar('clean');f.solar('inspect');}f.compare();f.control();if(f.e.maintenance.snapshot.navigationRequired)f.observe();
 assert.equal(f.s.story.submitReport('handover',f.s.story.fieldWork.knownIssues),true);checkpoint('handover');
 if(variant==='all-materials'){for(const id of ['CL02','CL05','CL06'])f.s.story.readMaterial(id);f.s.story.chooseDiary('familiar-path');}
 f.to(Math.max(72,f.e.weather.acceptedAutomaticHours));f.s.story.readMessage('pickup-cancelled');assert.equal(command(f.s,'stay',true),true);f.sync();checkpoint('stay-registered');
 const v=f.s.story.snapshot,h=v.calendar.hour;if(h>=6&&h<18)f.to(v.elapsedHours+18-h);checkpoint('night-before-observation');assert.equal(f.s.story.snapshot.objective.id,'ST09');
 f.observe();assert.equal(f.s.story.snapshot.objective.id,'ST10');checkpoint('night-observed');
 f.s.story.readMessage('old-call');assert.equal(command(f.s,'check',false),true);checkpoint('source-awaiting');f.s.story.deliverReply('source-check');checkpoint('source-reply-unread');f.s.story.readMessage('source-check-reply');checkpoint('goals-complete');
 assert.equal(f.s.story.snapshot.finished,false);assert.equal(command(f.s,'finish',false),true);checkpoint('ending-unseen');assert.equal(command(f.s,'seen',false),true);checkpoint('ending-seen');
 const final=f.s.story.snapshot;assert.equal(final.tasks.filter(t=>t.status==='complete').length,11);assert.equal(final.messages.filter(m=>m.id==='pickup-cancelled').length,1);assert.equal(final.messages.find(m=>m.id==='pickup-cancelled').sentAt,72);assert.equal(final.sourceCheck.sender,null);assert.equal(final.transport.stayRegistered,true);
 const before=encode(f.s);for(const c of ['stay','check','finish'])assert.equal(command(f.s,c,true),false);assert.equal(command(f.s,'seen',true),true);assert.equal(encode(f.s),before);
 return{seed,variant,restoreEvery,checkpoints,events,finishAt:final.elapsedHours,finishDay:final.calendar.day,solarProblem:issue,mainWh:f.e.power.snapshot.mainWh,retainedFacts:final.retainedFacts,completionTimes:final.tasks.map(t=>({id:t.id,at:t.completion.at})),finalSha256:sha(Buffer.from(before)),fullState:JSON.parse(before),ending:endingRecord(final)};
}
try{
 record.sources=Object.fromEntries(['LighthouseSave.ts','RoomTimeOfDay.ts','LighthousePower.ts','LighthouseMaintenance.ts','LighthouseInspection.ts','LighthouseStory.ts','LighthouseStorySave.ts','LighthouseStoryBridge.ts','LighthouseStoryChapters.ts','LighthouseStoryWait.ts','LighthouseStoryEpilogue.ts','LighthouseDiscovery.ts','LighthouseWeatherSession.ts'].map(p=>['src/examples/'+p,sha(fs.readFileSync(path.join(root,'src/examples',p)))]));
 for(const seed of [0,1,7,42,216,65535,2147483648,4294967295])for(const variant of ['normal','all-materials','early-treatment','late-fog','late-arrival','late-handover']){
  const uninterrupted=route(seed,variant,false),restored=route(seed,variant,true);assert.deepEqual(restored.completionTimes,uninterrupted.completionTimes);if(restored.finalSha256!==uninterrupted.finalSha256){const changes=[];function diff(a,b,p=''){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'/'+k);}else changes.push({path:p,a,b});}diff(uninterrupted.fullState,restored.fullState);record.divergence=changes;fs.writeFileSync(path.join(__dirname,'checkpoint-divergence.json'),JSON.stringify({seed,variant,changes},null,2)+'\n');}assert.equal(restored.finalSha256,uninterrupted.finalSha256);delete restored.fullState;delete uninterrupted.fullState;record.routes.push(uninterrupted,restored);console.log(seed,variant,'day',restored.finishDay);
 }
 // Find a real independent-stream seed with two misses while the original film is still latent.
 for(let seed=0;seed<128&&!record.twoMissSeed;seed++){const f=fixture(undefined,seed);f.to(18.5);f.solar('inspect');const a=f.e.discovery.view('solar').latest;if(a.status!=='unseen')continue;f.away();f.to(18.75);f.solar('inspect');const b=f.e.discovery.view('solar').latest;if(b.status!=='unseen')continue;
  assert.notEqual(a.visit,b.visit);assert.match(b.next,/两次.*5秒/);const draws=f.e.weather.snapshot.random.streams.inspection.draws;f.solar('inspect');assert.equal(f.e.weather.snapshot.random.streams.inspection.draws,draws);f.solar('surface-test');assert.equal(f.e.discovery.view('solar').latest.status,'confirmed');f.solar('clean');f.solar('inspect');assert.equal(f.e.discovery.view('solar').latest.status,'clear');record.twoMissSeed={seed,first:a,second:b,draws,confirmedAfterTest:true};
 }
 assert.ok(record.twoMissSeed,'deterministic seed batch must cover two genuine misses');record.passed=true;
}catch(e){record.failure=String(e.stack||e);throw e;}finally{fs.writeFileSync(path.join(__dirname,'branches.json'),JSON.stringify(record,null,2)+'\n');}
console.log(JSON.stringify({passed:record.passed,routes:record.routes.length,checkpoints:record.routes.reduce((n,r)=>n+r.checkpoints,0),twoMissSeed:record.twoMissSeed?.seed}));
