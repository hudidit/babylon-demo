// Integration audit of the real scooter controller. Guidance chooses W/A/D/brake only; no in-trip pose changes.
const fs=require('node:fs'),assert=require('node:assert/strict'),load=require('../lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),site=load('CoastalSite');
const middle=site.coastalRoute().filter(p=>p.y<82&&p.x<13.1).filter(p=>!(p.x>10&&p.y>1));
const outbound=[{x:13,y:0},...middle.filter(p=>p.x<12.9||p.y<0),{x:-123.5,y:82.3}];
const results=[];
for(const reverse of [false,true]){
 const points=reverse?[...outbound].reverse().slice(1).concat({x:14,y:2.2}):outbound;
 const start=reverse?results[0].end:v.SCOOTER_PARKING[0];
 const s={...v.createScooterState(),...start,riding:true,speed:0,distance:0,steer:0};let index=0,stuck=0,maxCrossTrack=0;
 if(reverse){for(let n=0;n<240;n++)v.advanceScooter(s,{...v.emptyScooterInput(),left:true},1/60);}
 let frames=0;
 for(;frames<7200;frames++){
  let closest=index,d=Infinity;
  for(let j=index;j<Math.min(points.length,index+18);j++){const distance=Math.hypot(points[j].x-s.x,points[j].y-s.y);if(distance<d){d=distance;closest=j;}}
  index=closest;maxCrossTrack=Math.max(maxCrossTrack,d);
  const endDistance=Math.hypot(points.at(-1).x-s.x,points.at(-1).y-s.y);
  if(index>points.length-5&&endDistance<1.1&&Math.abs(s.speed)<.1)break;
  let goal=points[index],j=index;while(j<points.length-1&&Math.hypot(goal.x-s.x,goal.y-s.y)<.8+Math.abs(s.speed)*.22)goal=points[++j];
  const desired=Math.atan2(goal.x-s.x,goal.y-s.y),error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading)),predicted=error-s.steer*.16;
  const brake=Math.abs(error)>=.8 || index>points.length-40&&endDistance<s.speed*s.speed/14+.8;
  const input={...v.emptyScooterInput(),forward:!brake,brake,right:predicted>.06,left:predicted<-.06};
  const before=s.distance;v.advanceScooter(s,input,1/60);assert.ok(v.scooterSupport(s));
  stuck=input.forward&&s.distance-before<.0001?stuck+1:0;
  assert.ok(stuck<60,JSON.stringify({reverse,index,pose:s,error,goal}));
 }
 assert.ok(frames<7200,JSON.stringify({reverse,index,s}));
 for(let n=0;n<120;n++)v.advanceScooter(s,{...v.emptyScooterInput(),brake:true},1/60);
 results.push({direction:reverse?'tower-to-home':'home-to-tower',simulationSeconds:frames/60,maxCrossTrack,end:{...s}});
}
fs.writeFileSync(require('node:path').join(__dirname,'route-check.json'),JSON.stringify({method:'real controller, fixed 1/60 integration; autonomous keyboard-state guidance; no browser time or travel-time benchmark',results},null,2)+'\n');console.log(JSON.stringify(results));
