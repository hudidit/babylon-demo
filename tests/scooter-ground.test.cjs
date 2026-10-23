const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),w=load('WalkingSurface'),before=require('./fixtures/scooter-ground-before.json');

test('formerly rejected gentle shoulders have full real support in both travel directions',()=>{
 for(const p of before.accepted)for(const reverse of [0,Math.PI]){
  const support=v.scooterSupport({...p,heading:p.heading+reverse});
  assert.ok(support,JSON.stringify(p));assert.ok(Number.isFinite(support.height));
  assert.ok(Math.abs(support.pitch)<=Math.PI/10&&Math.abs(support.roll)<=Math.PI/10);
 }
});

test('home shoulders and the later road no longer stop continuous driving across triangle boundaries',()=>{
 const results=[];
 for(const p of before.cases.filter(p=>p.id!=='lookout-crossfall'))for(const reverse of [false,true])
  for(const dt of [1/120,1/30,.2])for(const speed of [3,v.SCOOTER.cruise]){
   const start=v.scooterOffset(p,0,reverse?2:-2),s={...v.createScooterState(),...start,heading:p.heading+(reverse?Math.PI:0),riding:true,speed};
   assert.ok(v.scooterSupport(s));
   for(let n=0;n<240&&s.distance<4;n++){
    v.advanceScooter(s,{...v.emptyScooterInput(),forward:true},dt);
    assert.ok(s.speed>0,JSON.stringify({id:p.id,reverse,dt,s}));assert.ok(v.scooterSupport(s));
   }
   assert.ok(s.distance>=4,JSON.stringify({id:p.id,reverse,dt,s}));results.push(s.distance);
  }
 assert.equal(results.length,36);
});

test('visible bench, walls, service equipment, guardrail and unsupported land stay blocked',()=>{
 assert.equal(v.scooterSupport(before.cases.find(p=>p.id==='lookout-crossfall')),undefined,'a corner of this footprint touches the real bench');
 const poses=[{x:9.4,y:5.35,heading:0},{x:-125,y:90,heading:0},{x:16,y:0,heading:0},
  {x:-125-5.1,y:90+5.9,heading:0},{x:-125+4.8,y:90+5.8,heading:0},{x:-145,y:105,heading:0}];
 for(const p of poses)assert.equal(v.scooterSupport(p),undefined,JSON.stringify(p));
 for(const p of [{x:14,y:0,heading:Math.PI/2},{x:-125,y:84,heading:0},{x:13.3,y:4.65,heading:-Math.PI/2}]){
  const s={...v.createScooterState(),...p,speed:v.SCOOTER.cruise,riding:true};
  for(let n=0;n<10;n++)v.advanceScooter(s,{...v.emptyScooterInput(),forward:true},.2);
  assert.equal(s.speed,0);assert.ok(v.scooterSupport(s));
 }
});
