const root=require('node:path').resolve(__dirname,'../../../..'),load=require(root+'/docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const v=load('CoastalScooter'),w=load('WalkingSurface'),{coastalRoute,coastalRouteDistance,COASTAL_SITE}=load('CoastalSite');
const {houseRoomAt}=load('HouseLayout'),{lighthouseServiceRoomAt}=load('LighthouseEquipmentLayout');
function explain(p){
 const reasons=[];
 const sample=(side,along)=>{
  const q=v.scooterOffset(p,side,along),s=w.walkingSurfaceAt(q.x,q.y);
  let reason;
  if(Math.hypot(q.x+125,q.y-90)<4.155)reason='tower';
  else if(q.x>10.65&&q.x<12.3&&q.y>3.7&&q.y<5.6)reason='entry';
  else if(houseRoomAt(q.x,q.y)||lighthouseServiceRoomAt(q.x,q.y))reason='room';
  else if(!w.walkingPointAllowed(q,.055))reason='walking';
  else if(!s)reason='surface';
  else if(s.normal.y<Math.cos(Math.PI/10))reason='normal';
  if(reason)reasons.push({reason,side,along,...q,s});
  return reason?undefined:s;
 };
 const f=sample(0,.56),r=sample(0,-.56),l=sample(-.325,0),h=sample(.325,0);
 if(!f||!r||!l||!h)return reasons;
 const height=(f.height+r.height)/2,pitch=Math.atan2(f.height-r.height,1.12),roll=Math.atan2(h.height-l.height,.65);
 if(Math.abs(pitch)>.18||Math.abs(roll)>.12)return [{reason:'tilt',pitch,roll}];
 for(const along of [-.825,-.4,0,.4,.825])for(const side of [-.325,0,.325]){
  const s=sample(side,along);if(s&&Math.abs(s.height-height-Math.tan(pitch)*along-Math.tan(roll)*side)>.12)reasons.push({reason:'clearance',along,side,height:s.height,predicted:height+Math.tan(pitch)*along+Math.tan(roll)*side});
 }return reasons;
}
const route=coastalRoute(),rows=[],counts={};let tested=0;
for(let i=2;i<route.length-2;i+=2){
 const p=route[i],a=route[i-1],b=route[i+1],heading=Math.atan2(b.x-a.x,b.y-a.y);
 if(p.x>10.5||Math.hypot(p.x+125,p.y-90)<6)continue;
 for(const side of [-3,-2,-1,-.5,0,.5,1,2,3]){
  const pose={...v.scooterOffset({...p,heading},side,0),heading};
  if(!w.withinWalkingBoundary(pose,1)||!w.walkingPointAllowed(pose))continue;
  tested++;
  if(!v.scooterSupport(pose)){
   const reasons=explain(pose);for(const r of new Set(reasons.map(x=>x.reason)))counts[r]=(counts[r]||0)+1;
   rows.push({i,side,...pose,reasons});
  }
 }
}
require('node:fs').writeFileSync(require('node:path').join(__dirname,'scan.json'),JSON.stringify({tested,counts,rows},null,2));
console.log(JSON.stringify({counts,failures:rows.length,examples:rows.filter(x=>Math.abs(x.side)<=.5).slice(0,12),shoulder:rows.slice(0,5)},null,2));
