const assert = require('node:assert/strict');
const {test} = require('node:test');
const load = require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {LighthouseStory, LIGHTHOUSE_STORY_TASKS:tasks} = load('LighthouseStory');
const copy = value => JSON.parse(JSON.stringify(value));
const initial = () => ({elapsedHours:0,revisions:{control:0,main:0,backup:0,cover:0,solar:0},problems:{cover:null,solar:null},
  weather:'clear',navigationRequired:false,navigationSource:'none',outsideWorkAllowed:true,actionInProgress:false,knownCriticalIssues:[]});
const rules = {
  control:['inspection','lighthouse-control-panel','local-panel'], main:['inspection','lighthouse-beacon-main','direct-view'],
  backup:['maintenance','lighthouse-beacon-backup','direct-view'],cover:['inspection','lighthouse-optics-cleaning','local-panel'],
  comparison:['comparison','lighthouse-solar-charger','meter-comparison'], 'solar-check':['discovery','lighthouse-solar-array','surface-test'],
  'solar-cleaned':['maintenance','lighthouse-solar-array','active-action']
};
function fixture({restore=false}={}) {
  const f={story:new LighthouseStory('three-day-test',initial()),c:initial(),checkpoints:[]};
  f.check=()=>{const raw=f.story.exportState();f.checkpoints.push(raw);const restored=LighthouseStory.fromState(copy(raw));assert.deepEqual(restored.exportState(),raw);assert.deepEqual(restored.snapshot,f.story.snapshot);if(restore)f.story=restored;};
  f.move=(at,changes={})=>{f.c={...f.c,elapsedHours:at,...changes};f.story.synchronize(f.c);f.check();};
  f.fact=(kind,changes={})=>{
    const [source,objectId,method]=rules[kind],c=f.c,rev=kind.startsWith('solar-')||kind==='comparison'?'solar':kind;
    const data={control:{mainWh:2000,solarWatts:100},main:{seconds:10,turns:1,outputSeen:true,weather:c.weather},
      backup:{seconds:10,flashes:1,weather:c.weather},cover:{status:c.problems.cover?'confirmed':'clear'},
      comparison:{weather:c.weather,daylight:f.story.calendar().hour>=6&&f.story.calendar().hour<18,actualWatts:100,expectedWatts:100},
      'solar-check':{status:c.problems.solar?'confirmed':'clear'},'solar-cleaned':{resolvedProblemId:'solar-story-1'}}[kind];
    const fact={kind,source,eventId:f.story.exportState().cursors[source]+1,at:c.elapsedHours,objectId,revision:c.revisions[rev],
      problemId:rev==='cover'?c.problems.cover:rev==='solar'?c.problems.solar:null,method,data,...changes};
    const accepted=f.story.observe(fact);f.check();return {fact,accepted};
  };
  f.call=(name,...args)=>{const result=f.story[name](...args);f.check();return result;};
  f.round=()=>{f.fact('control');f.fact('main');f.fact('cover');};
  f.arrival=()=>{
    f.call('readMaterial','CL01');f.call('acceptDuty');f.move(f.c.elapsedHours,{navigationSource:'main'});f.round();
    assert.equal(f.call('submitReport','arrival'),true);assert.equal(f.call('deliverReply','arrival-report'),true);assert.equal(f.call('readMessage','arrival-ack'),true);
  };
  f.fog=()=>{f.move(20,{weather:'fog',navigationRequired:true,navigationSource:'main'});f.fact('main');f.fact('comparison');};
  f.soil=()=>{f.move(f.c.elapsedHours,{problems:{...f.c.problems,solar:'solar-story-1'},revisions:{...f.c.revisions,solar:f.c.revisions.solar+1}});assert.equal(f.call('bindSolarProblem','solar-story-1'),true);};
  f.clean=()=>{f.move(f.c.elapsedHours,{problems:{...f.c.problems,solar:null},revisions:{...f.c.revisions,solar:f.c.revisions.solar+1}});f.fact('solar-cleaned');f.fact('solar-check');f.fact('comparison');};
  f.solar=()=>{f.soil();f.fact('solar-check');f.clean();assert.equal(f.call('submitReport','solar'),true);f.call('deliverReply','solar-report');f.call('readMessage','solar-ack');};
  f.storm=()=>{f.move(42,{weather:'storm',navigationRequired:false,navigationSource:'none',outsideWorkAllowed:false});f.call('readMessage','transport-warning');f.fact('control');assert.equal(f.call('reviewStormPlan'),true);};
  f.handover=()=>{f.move(48,{weather:'clear',navigationRequired:false,navigationSource:'none',outsideWorkAllowed:true});f.fact('control');f.fact('solar-check');f.fact('comparison');assert.equal(f.call('submitReport','handover'),true);};
  f.stay=()=>{f.move(72);f.call('readMessage','pickup-cancelled');assert.equal(f.call('registerStay'),true);};
  f.night=(source='main')=>{f.move(78,{navigationRequired:true,navigationSource:source});f.fact(source);};
  f.end=()=>{f.call('readMessage','old-call');f.call('requestSourceCheck');f.call('deliverReply','source-check');f.call('readMessage','source-check-reply');assert.equal(f.call('finishChapter'),true);f.call('acknowledgeEnding');};
  f.all=()=>{f.arrival();f.fog();f.solar();f.storm();f.handover();f.stay();f.night();f.end();return f;};
  f.check();return f;
}

test('eleven tasks, all chapters and the ending replay identically with a restore at every committed boundary',()=>{
  const uninterrupted=fixture().all(),resumed=fixture({restore:true}).all(),view=resumed.story.snapshot;
  assert.deepEqual(resumed.story.exportState(),uninterrupted.story.exportState());
  assert.deepEqual(view.tasks.map(t=>[t.id,t.status]),tasks.map(id=>[id,'complete']));
  assert.equal(view.chapter,'ended');assert.equal(view.finished,true);assert.equal(view.endingSeen,true);assert.equal(view.goalsComplete,true);
  assert.equal(view.transport.status,'cancelled');assert.equal(view.transport.stayRegistered,true);assert.equal(view.transport.nextWindow,null);
  assert.deepEqual(view.calendar,{day:4,hour:18});assert.equal(view.sourceCheck.status,'no-official-record');assert.equal(view.sourceCheck.sender,null);
  assert.deepEqual(view.materials.map(m=>m.id),['CL01']);assert.equal(view.messages.find(m=>m.id==='old-call').provenance,'unverified-label');
  assert.ok(view.messages.find(m=>m.id==='pickup-cancelled').body.includes('值守报告已经收到'));
  assert.ok(uninterrupted.checkpoints.some(s=>s.messages.some(m=>m.id==='arrival-report')&&!s.messages.some(m=>m.id==='arrival-ack')));
  assert.ok(uninterrupted.checkpoints.some(s=>s.messages.some(m=>m.id==='source-check')&&!s.messages.some(m=>m.id==='source-check-reply')));
});
test('all optional materials and a personal diary change no work or transport requirements',()=>{
  const a=fixture().all(),b=fixture();for(const id of ['CL02','CL03','CL04','CL05','CL06'])b.call('readMaterial',id);
  assert.equal(b.call('chooseDiary','familiar-path'),true);assert.equal(b.call('chooseDiary','blank'),false);b.all();
  assert.deepEqual(b.story.snapshot.tasks.map(t=>t.status),a.story.snapshot.tasks.map(t=>t.status));assert.deepEqual(b.story.snapshot.transport,a.story.snapshot.transport);
});
test('rejecting an out-of-order command does not consume it and every semantic command is idempotent',()=>{
  const f=fixture(),before=f.story.exportState();
  for(const [command,args]of [['acceptDuty',[]],['submitReport',['arrival']],['registerStay',[]],['requestSourceCheck',[]],['deliverReply',['source-check']],['finishChapter',[]]])assert.equal(f.story[command](...args),false);
  assert.deepEqual(f.story.exportState(),before);f.all();const ended=f.story.exportState();
  for(const [command,args]of [['acceptDuty',[]],['readMaterial',['CL01']],['submitReport',['arrival']],['submitReport',['solar']],['submitReport',['handover']],
    ['reviewStormPlan',[]],['registerStay',[]],['readMessage',['old-call']],['requestSourceCheck',[]],['deliverReply',['arrival-report']],['deliverReply',['source-check']],['finishChapter',[]],['acknowledgeEnding',[]]])assert.equal(f.story[command](...args),false,command);
  f.story.synchronize(f.c);assert.deepEqual(f.story.exportState(),ended);
});
test('early valid observations count, while dirty surfaces, incomplete turns, no output and text alone cannot complete patrol',()=>{
  const f=fixture();f.move(0,{navigationSource:'main'});f.fact('control');f.fact('main',{data:{seconds:10,turns:.9,outputSeen:true,weather:'clear'}});f.fact('cover');
  f.call('readMaterial','CL01');f.call('acceptDuty');assert.equal(f.story.snapshot.objective.id,'ST02');
  f.fact('main',{data:{seconds:10,turns:1,outputSeen:false,weather:'clear'}});assert.equal(f.story.snapshot.objective.id,'ST02');
  const {fact}=f.fact('main');assert.equal(f.story.snapshot.objective.id,'ST03');const before=f.story.exportState();assert.equal(f.story.observe(fact),false);assert.deepEqual(f.story.exportState(),before);
  const dirty=fixture();dirty.move(0,{navigationSource:'main',problems:{cover:'salt-1',solar:null},revisions:{...dirty.c.revisions,cover:1}});dirty.round();dirty.call('readMaterial','CL01');dirty.call('acceptDuty');assert.equal(dirty.story.snapshot.objective.id,'ST02');
});
test('crossing a day or changing a physical revision keeps completed history but requires new report evidence',()=>{
  const f=fixture();f.call('readMaterial','CL01');f.call('acceptDuty');f.move(0,{navigationSource:'main'});f.round();
  const completion=copy(f.story.snapshot.tasks[1].completion);f.move(20,{weather:'fog',navigationRequired:true});assert.equal(f.call('submitReport','arrival'),false);
  f.round();f.move(20,{revisions:{...f.c.revisions,cover:1,main:1},problems:{cover:'salt-2',solar:null}});assert.equal(f.call('submitReport','arrival'),false);
  f.move(20,{revisions:{...f.c.revisions,cover:2,main:2},problems:{cover:null,solar:null}});f.round();assert.equal(f.call('submitReport','arrival'),true);
  assert.deepEqual(f.story.snapshot.tasks[1].completion,completion);
});
test('a late arrival report and its unread reply retain their actual dates and late messages are never rescheduled',()=>{
  const f=fixture();f.move(200,{navigationRequired:true,navigationSource:'main'});
  const cancel=copy(f.story.snapshot.messages.find(m=>m.id==='pickup-cancelled'));assert.equal(cancel.sentAt,72);assert.match(cancel.body,/尚未完成/);
  f.arrival();assert.match(f.story.snapshot.messages.find(m=>m.id==='arrival-ack').body,/第9日/);assert.doesNotMatch(f.story.snapshot.messages.find(m=>m.id==='arrival-ack').body,/明天/);
  assert.deepEqual(f.story.snapshot.messages.find(m=>m.id==='pickup-cancelled'),cancel);assert.equal(f.story.snapshot.objective.id,'ST04');
  f.move(212,{weather:'clear'});f.fact('main');f.fact('comparison');assert.equal(f.story.snapshot.objective.id,'ST04');
  f.move(212,{weather:'fog'});f.fact('main');f.fact('comparison');assert.equal(f.story.snapshot.objective.id,'ST05');
});
test('an extremely late route still completes with true report and extension dates, preserving the original cancellation',()=>{
  const f=fixture({restore:true});f.move(200,{navigationRequired:true,navigationSource:'main'});f.arrival();
  f.move(212,{weather:'fog'});f.fact('main');f.fact('comparison');f.solar();
  f.move(234,{weather:'storm',navigationRequired:false,navigationSource:'none',outsideWorkAllowed:false});f.call('readMessage','transport-warning');f.fact('control');f.call('reviewStormPlan');
  f.move(240,{weather:'clear',outsideWorkAllowed:true});f.fact('control');f.fact('solar-check');f.fact('comparison');assert.equal(f.call('submitReport','handover'),true);
  f.call('readMessage','pickup-cancelled');assert.equal(f.call('registerStay'),true);f.move(246,{navigationRequired:true,navigationSource:'main'});f.fact('main');f.end();
  assert.equal(f.story.snapshot.finished,true);assert.deepEqual(f.story.snapshot.calendar,{day:11,hour:18});
  assert.equal(f.story.snapshot.transport.cancelledAt,72);assert.equal(f.story.snapshot.messages.find(m=>m.id==='old-call').sentAt,246);
  assert.match(f.story.snapshot.messages.find(m=>m.id==='pickup-cancelled').body,/尚未完成/);assert.match(f.story.snapshot.messages.find(m=>m.id==='stay-registration').body,/第11日/);
});
test('departure preparations remain in chapter three until the actual cancellation arrives',()=>{
  const f=fixture();f.arrival();f.fog();f.solar();f.storm();f.handover();assert.equal(f.story.snapshot.chapter,'departure');
  f.move(72);assert.equal(f.story.snapshot.chapter,'epilogue');
});
test('ordinary misses do not become a repair, deterministic inspection and a separate post-clean check provide a path',()=>{
  const f=fixture();f.arrival();f.fog();f.soil();
  for(let i=0;i<2;i++)f.fact('solar-check',{method:'patrol',data:{status:'unseen'}});
  assert.equal(f.call('submitReport','solar'),false);assert.equal(f.story.snapshot.objective.id,'ST05');
  f.fact('solar-check',{method:'surface-test',data:{status:'confirmed'}});
  f.move(20,{problems:{cover:null,solar:null},revisions:{...f.c.revisions,solar:f.c.revisions.solar+1}});f.fact('solar-cleaned');f.fact('comparison');
  assert.equal(f.call('submitReport','solar'),false);f.fact('solar-check');assert.equal(f.call('submitReport','solar'),true);
});
test('cleaning before the fog task is acknowledged, stale comparisons are not reused and no second problem is created',()=>{
  const f=fixture();f.arrival();f.soil();f.fact('solar-check');f.clean();const bound=copy(f.story.exportState().solarProblem);
  f.fog();f.fact('solar-check');assert.equal(f.call('submitReport','solar'),true);assert.match(f.story.snapshot.messages.find(m=>m.id==='solar-report').body,/此前已经处理/);
  assert.equal(f.call('bindSolarProblem','different-problem'),false);assert.deepEqual(f.story.exportState().solarProblem,bound);
  const other=fixture();other.arrival();other.fog();other.soil();other.clean();other.move(20,{revisions:{...other.c.revisions,solar:other.c.revisions.solar+1}});
  assert.equal(other.call('submitReport','solar'),false);
});
test('later surface revisions require current recheck and input facts while retaining the original story treatment',()=>{
  const f=fixture();f.arrival();f.fog();f.soil();f.clean();
  f.move(20,{revisions:{...f.c.revisions,solar:4}});for(let i=0;i<90;i++)f.fact('control');
  assert.equal(f.call('submitReport','solar'),false);f.fact('solar-check');f.fact('comparison');assert.equal(f.call('submitReport','solar'),true);
  assert.equal(f.story.snapshot.reports.find(r=>r.id==='solar').facts.find(f=>f.kind==='solar-cleaned').revision,2);
});
test('handover refuses unsafe weather, unfinished actions, missing navigation and unreported critical issues',()=>{
  const f=fixture();f.arrival();f.fog();f.solar();f.storm();assert.equal(f.call('submitReport','handover'),false);
  f.move(48,{weather:'clear',outsideWorkAllowed:true,navigationRequired:true,navigationSource:'none'});f.fact('control');f.fact('solar-check');f.fact('comparison');
  assert.equal(f.call('submitReport','handover'),false);f.move(48,{navigationSource:'backup'});f.fact('backup');
  f.move(48,{actionInProgress:true});assert.equal(f.call('submitReport','handover'),false);f.move(48,{actionInProgress:false,knownCriticalIssues:['drive-fault']});
  assert.equal(f.call('submitReport','handover'),false);assert.equal(f.call('submitReport','handover',['unrelated']),false);assert.equal(f.call('submitReport','handover',['drive-fault']),true);
  assert.deepEqual(f.story.snapshot.reports.find(r=>r.id==='handover').unresolved,['drive-fault']);
});
test('cancellation is independent of local weather and cannot complete departure preparation on its own',()=>{
  const f=fixture();f.move(72,{weather:'clear'});assert.equal(f.story.snapshot.transport.status,'cancelled');assert.equal(f.story.snapshot.transport.departure.day,4);
  f.call('readMessage','pickup-cancelled');assert.equal(f.call('registerStay'),false);f.move(300,{weather:'storm'});
  assert.equal(f.story.snapshot.messages.filter(m=>m.id==='pickup-cancelled').length,1);assert.equal(f.story.snapshot.transport.cancelledAt,72);assert.equal(f.story.snapshot.tasks[0].status,'active');
});
test('night confirmation must follow registration, use the currently running source and defer old calls during actions',()=>{
  const f=fixture();f.arrival();f.fog();f.solar();f.storm();f.handover();f.move(78,{navigationSource:'main',navigationRequired:true});f.fact('main');
  f.call('readMessage','pickup-cancelled');f.call('registerStay');assert.equal(f.story.snapshot.objective.id,'ST09');
  f.move(78,{navigationSource:'backup',actionInProgress:true});const main=f.fact('main');assert.equal(main.accepted,false);assert.equal(f.story.snapshot.objective.id,'ST09');
  f.fact('backup',{data:{seconds:9,flashes:1,weather:'clear'}});assert.equal(f.story.snapshot.objective.id,'ST09');f.fact('backup');assert.equal(f.story.snapshot.objective.id,'ST10');
  assert.equal(f.story.snapshot.messages.some(m=>m.id==='old-call'),false);f.move(78,{actionInProgress:false});assert.equal(f.story.snapshot.messages.filter(m=>m.id==='old-call').length,1);
  assert.equal(f.story.snapshot.tasks[8].completion.facts[0].kind,'backup');f.end();
});
test('a long exploration prunes only the live cache, preserves completed proofs and rejects old source events after reloading',()=>{
  const f=fixture();f.arrival();const old=f.fact('control').fact,completion=copy(f.story.snapshot.tasks[1].completion);
  for(let i=0;i<130;i++)f.fact('control');assert.ok(f.story.snapshot.retainedFacts<=64);f.move(24*12,{navigationSource:'main',navigationRequired:true});
  f.story=LighthouseStory.fromState(f.story.exportState());const before=f.story.exportState();assert.equal(f.story.observe(old),false);assert.deepEqual(f.story.exportState(),before);assert.deepEqual(f.story.snapshot.tasks[1].completion,completion);
});
test('invalid inputs are rejected atomically and snapshots cannot mutate the model',()=>{
  const f=fixture(),before=f.story.exportState();
  for(const patch of [{elapsedHours:NaN},{elapsedHours:-1},{extra:true},{weather:'snow'},{knownCriticalIssues:['same','same']},
    {problems:{cover:'unrevisioned',solar:null}}])assert.throws(()=>f.story.synchronize({...f.c,...patch}));
  assert.deepEqual(f.story.exportState(),before);assert.throws(()=>f.story.readMaterial('ST01'));assert.throws(()=>f.story.chooseDiary('wrong'));
  const snapshot=f.story.snapshot;assert.equal(Object.isFrozen(snapshot.messages[0]),true);assert.equal(Object.isFrozen(snapshot.tasks[0]),true);
  const raw=f.story.exportState();raw.context.elapsedHours=900;assert.equal(f.story.snapshot.elapsedHours,0);
});
test('strict checkpoint validation rejects unsupported, contradictory and forged causal state',()=>{
  const f=fixture().all(),base=f.story.exportState();
  const edits=[s=>s.version=2,s=>s.mode='duty',s=>s.extra=1,s=>s.start.hour=9,s=>s.context.elapsedHours=-1,s=>s.sequence++,s=>s.completions.splice(3,1),
    s=>s.completions[1].facts[1].data.turns=0,s=>s.messages[0].sentAt=1,s=>s.messages.push(copy(s.messages[0])),s=>s.messages.find(m=>m.id==='pickup-cancelled').sentAt=73,
    s=>s.messages.find(m=>m.id==='old-call').provenance='official-channel',s=>s.messages.find(m=>m.id==='source-check-reply').replyTo='arrival-report',
    s=>s.messages.find(m=>m.id==='old-call').body='sender confirmed',s=>delete s.messages.find(m=>m.id==='source-check-reply').readAt,
    s=>s.reports.find(r=>r.id==='solar').facts[0].data.resolvedProblemId='different',s=>s.reports.find(r=>r.id==='handover').unresolved=['undisclosed'],
    s=>s.endingSeen.order=s.completions[10].order,s=>s.cursors.inspection=0,s=>s.facts[0].objectId='wrong-device'];
  for(const edit of edits){const s=copy(base);edit(s);assert.throws(()=>LighthouseStory.fromState(s),String(edit));}
  assert.deepEqual(f.story.exportState(),base);
});
test('a handover report without its atomic completion is rejected instead of leaving an unfinishable task',()=>{
  const f=fixture();f.arrival();f.fog();f.solar();f.storm();f.handover();const state=f.story.exportState();
  state.completions.pop();state.sequence--;assert.throws(()=>LighthouseStory.fromState(state));
});
