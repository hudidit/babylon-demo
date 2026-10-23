const load=require('../lighthouse-d-2026-10-18/source-loader.cjs'),v=load('CoastalScooter'),w=load('WalkingSurface');
const old=require('./before-scan.json');
const result=[];
for(const p of old.rows.filter(p=>!p.reasons.some(r=>r.reason==='walking'))){
 const sample=(side,along)=>{const q=v.scooterOffset(p,side,along);return w.walkingSurfaceAt(q.x,q.y);};
 const f=sample(0,.56),r=sample(0,-.56),l=sample(-.325,0),h=sample(.325,0),height=(f.height+r.height)/2,pitch=Math.atan2(f.height-r.height,1.12),roll=Math.atan2(h.height-l.height,.65);
 let bump=0,minNormal=1;
 for(const a of [-.825,-.4,0,.4,.825])for(const s of [-.325,0,.325]){const x=sample(s,a);minNormal=Math.min(minNormal,x.normal.y);bump=Math.max(bump,Math.abs(x.height-height-Math.tan(pitch)*a-Math.tan(roll)*s));}
 result.push({x:p.x,y:p.y,side:p.side,pitch,roll,bump,slope:Math.acos(minNormal)});
}
console.log(JSON.stringify(result,null,2));
