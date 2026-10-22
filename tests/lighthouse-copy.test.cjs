const assert=require('node:assert/strict'),{test}=require('node:test');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const {storyMessageText:message,storyReportDetails:details}=load('LighthouseStoryChapters');
const {createLighthouseStorySession:create,encodeLighthouseStorySave:encode,decodeLighthouseStorySave:decode}=load('LighthouseStorySave');

test('editing the presented voice preserves strict original messages and byte-identical story checkpoints',()=>{
 const s=create('copy-compatibility',0),raw=encode(s),v=s.story.snapshot;
 assert.notEqual(message(v,'pickup-plan'),v.messages[0].body);
 assert.match(message(v,'pickup-plan'),/第4日中午12点.*满三天.*下一班/s);
 assert.equal(encode(s),raw);assert.equal(encode(decode(raw)),raw);
 const damaged=JSON.parse(raw);damaged.story.messages[0].body=message(v,'pickup-plan');
 assert.throws(()=>decode(JSON.stringify(damaged)),/checkpoint/);
 assert.equal(message(v,'unknown'), '');
});
test('cancellation copy uses the report available at the original send time, including late handovers',()=>{
 const view={messages:[{id:'pickup-cancelled',sentAt:72,order:40,body:'original'}],reports:[]};
 assert.match(message(view,'pickup-cancelled'),/还没整理完/);
 for(const report of [{id:'handover',at:80,order:41},{id:'handover',at:72,order:41}]){
  view.reports=[report];assert.match(message(view,'pickup-cancelled'),/还没整理完/);
 }
 view.reports=[{id:'handover',at:70,order:39}];assert.match(message(view,'pickup-cancelled'),/交接单收到了/);
 view.messages=[{id:'arrival-report',sentAt:234,order:2,body:'original'}];assert.match(message(view,'arrival-report'),/第11日/);
 view.messages=[{id:'arrival-ack',sentAt:234,order:3,body:'original'}];assert.match(message(view,'arrival-ack'),/第11日/);assert.doesNotMatch(message(view,'arrival-ack'),/明天|第三天晚上/);
});
test('report copy reads the saved measurements and navigation, never the current scene or a blanket all-clear',()=>{
 const report={id:'handover',context:{navigationSource:'none',navigationRequired:false,problems:{cover:'c',solar:'s'}},
  facts:[{kind:'control',data:{mainWh:123.4,solarWatts:80}},{kind:'comparison',data:{actualWatts:17.2,expectedWatts:20.3}}],unresolved:[]};
 const view={reports:[report]},before=JSON.stringify(view);
 assert.match(details(view,'handover-report'),/白天.*待机.*123\.4 Wh.*17\.2 W.*20\.3 W/s);
 assert.match(details(view,'handover-report'),/下一班到站后.*交钥匙/);assert.equal(JSON.stringify(view),before);
 report.context.navigationSource='main';assert.match(details(view,'handover-report'),/日间试灯/);
 report.context.navigationRequired=true;assert.match(details(view,'handover-report'),/需要亮灯.*主灯/);
 report.context.navigationSource='backup';assert.match(details(view,'handover-report'),/备用灯接替/);
 report.context.navigationSource='none';assert.match(details(view,'handover-report'),/主灯和备用灯都未能提供导航/);
 report.unresolved=['s','c','other'];const pending=details(view,'handover-report');
 assert.match(pending,/太阳能表面污损.*保护面污损.*设备异常.*还没处理好/s);assert.doesNotMatch(pending,/没查出/);
 assert.equal(details(view,'arrival-report'),'');
});
test('unverified calls retain the actual call and do not invent the sender',()=>{
 const view={messages:[{id:'old-call',sentAt:78,order:1,body:'original'}]};
 assert.ok(message(view,'old-call').startsWith('海角站，继续值守。收到请回答。'));
 assert.match(message(view,'old-call'),/没有核实是谁/);assert.doesNotMatch(message(view,'old-call'),/周师傅|失踪|幽灵/);
});
