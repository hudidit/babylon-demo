const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=require('../docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const before=require('./fixtures/coastal-obstacles-before.json');
const {coastalScatter}=load('CoastalScatter'),{worldToPlan}=load('HouseLayout');
const walking=load('WalkingSurface'),vehicle=load('CoastalScooter');

test('former blocking boulders are absent while all four vegetation zones retain their exact layout',()=>{
 const scatter=coastalScatter();
 const hashes=[scatter.plants,...scatter.zones.map(z=>z.plants)].map(g=>crypto.createHash('sha256').update(JSON.stringify(g)).digest('hex'));
 assert.deepEqual(hashes,before.plants,'removing stones must not shift the seeded vegetation');
 for(const g of [scatter.rocks,...scatter.zones.map(z=>z.rocks)])for(let first=0;first<g.positions.length;first+=45*3){
  // Each stone starts at its top pole, directly above its original plan position.
  const p=worldToPlan({x:g.positions[first],z:g.positions[first+2]});
  assert.ok(before.obstacles.every(o=>Math.hypot(p.x-o.x,p.y-o.y)>1e-7),'no removed boulder geometry remains');
 }
 assert.ok(scatter.rocks.positions.length>0,'nonblocking decorative pebbles remain');
});

test('both formerly reachable boulder sites support continuous walking and riding in both directions',()=>{
 const sites=[before.obstacles[2],before.obstacles[8]];
 for(const site of sites)for(const reverse of [false,true]){
  assert.ok(walking.walkingPointAllowed(site));
  const a={x:site.x,y:site.y+(reverse?2.5:-2.5)},z={x:site.x,y:site.y+(reverse?-2.5:2.5)};
  const end=walking.sweepWalking(a,z);assert.ok(end);assert.ok(Math.hypot(end.x-z.x,end.y-z.y)<1e-7);
  const state={...vehicle.createScooterState(),...a,heading:reverse?Math.PI:0,riding:true,speed:2};
  for(let i=0;i<150;i++)vehicle.advanceScooter(state,{...vehicle.emptyScooterInput(),forward:true},1/120);
  assert.ok(state.speed>2);assert.ok((state.y-site.y)*(reverse?-1:1)>1.5,'vehicle crosses the whole former obstacle');
  assert.ok(vehicle.scooterSupport(state));assert.ok(vehicle.scooterDismount(state));
 }
});
