import type { CoastalGeometry } from "./CoastalCliff";
import { COASTAL_CLIFF, coastalTriangleAt } from "./CoastalCliff";
import { COASTAL_WALK_BOUNDARY } from "./CoastalSite";
import { withinWalkingBoundary } from "./WalkingSurface";
import { landscapeGroundHeight } from "./CoastalLandscape";
import type { coastalLandscape } from "./CoastalLandscape";
import { planToWorld } from "./HouseLayout";

type Geometry = CoastalGeometry & { colors: number[] };
export type ForestTree = { x: number; y: number; base: number; height: number; width: number; angle: number; shrub: boolean; first: number };
export const FOREST_BUDGET = Object.freeze({ vertices: 250000, triangles: 55000, trees: 5400, batches: 110 });
export const FOREST_SIGHTLINES = [[13,-3],[-18,10],[-40,12],[-56,8],[-70,25],[-94,44],[-116,63],[-125,87]]
  .reduce((lines, a) => lines.concat([[...a,5.4,5.4],[...a,-125,90]]), [] as number[][]);
export function forestSegmentDistance(x: number, y: number, a: number, b: number, c: number, d: number) {
  const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a-t*dx,y-b-t*dy);
}
const empty = (): Geometry => ({ positions: [], indices: [], normals: [], uvs: [], colors: [] });

/** Two whole-tree elevations and a crown cap. The crown uses a shallow four-triangle cap for oblique views; eight triangles per plant. */
export function appendTreeImpostor(g: Geometry, x: number, y: number, base: number, height: number,
  width: number, angle: number, shade = 1, shrub = false): ForestTree {
  const tree={x,y,base,height,width,angle,shrub,first:g.positions.length/3},c=Math.cos(angle),s=Math.sin(angle);
  g.normals ??= [];
  for(let plane=0;plane<3;plane++) {
    const first=g.positions.length/3, u0=plane===0?.002:plane===1?.252:.502,du=plane<2?.246:.496;
    for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const px=plane===1?0:u*width/2,py=plane===0?0:(plane===1?u:v)*width/2;
      const z=plane===2?base+height*.64:base-.16+(v+1)/2*(height+.16);
      const w=planToWorld({x:x+c*px-s*py,y:y+s*px+c*py},z);
      g.positions.push(w.x,w.y,w.z);g.normals.push(0,1,0);
      g.uvs.push(u0+(u+1)/2*du,plane===2?.998-(v+1)/2*.996:shrub?.46+(v+1)/2*.538:.002+(v+1)/2*.996);
      const tint=shade*(plane===2?1.03:.92+(v+1)*.04);g.colors.push(tint,tint,tint,1);
    }
    if (plane===2) {
      const w=planToWorld({x,y},base+height*.92);g.positions.push(w.x,w.y,w.z);
      g.normals.push(0,1,0);g.uvs.push(.75,.5);g.colors.push(shade*1.08,shade*1.08,shade*1.08,1);
      for (const [a,b] of [[0,2],[2,3],[3,1],[1,0]]) g.indices.push(first+a,first+b,first+4);
    } else g.indices.push(first,first+2,first+1,first+1,first+2,first+3);
  }
  return tree;
}

/** Deterministic, static forest cells. Routes and landmark corridors are excluded before generating geometry. */
export function coastalForest(landscape: ReturnType<typeof coastalLandscape>) {
  const hills=landscape.filter(g=>g.ground).map(g=>{
    const points=Array.from({length:g.ground!.positions.length/3},(_,i)=>({x:g.ground!.positions[i*3]/5+5.4,y:g.ground!.positions[i*3+2]/5+5.4,height:(g.ground!.positions[i*3+1]+5)/5}));
    return {points,indices:g.ground!.indices,x0:Math.min(...points.map(p=>p.x)),x1:Math.max(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y))};
  });
  const support=(x:number,y:number)=>{
    let height=landscapeGroundHeight(x,y);if(height===undefined)return;
    for(const h of hills)if(x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1)
      for(let i=0;i<h.indices.length;i+=3)height=Math.max(height,coastalTriangleAt(x,y,h.points[h.indices[i]],h.points[h.indices[i+1]],h.points[h.indices[i+2]])?.height??-Infinity);
    return height;
  };
  const cells=new Map<string,{name:string;plants:Geometry;trees:ForestTree[]}>();
  let seed=231029;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
  for(let rowY=98;rowY>-590;) {
    const step=rowY> -180?5.4:11, expansion=Math.max(0,(-50-rowY)/550)*660;
    for(let rowX=COASTAL_CLIFF.westX-expansion+step;rowX<COASTAL_CLIFF.eastX+expansion-step;rowX+=step) {
      const x=rowX+(random()-.5)*step*.65,y=rowY+(random()-.5)*step*.65;
      const width=step*(2.1+random()*.25),angle=random()*Math.PI*2,shade=.8+random()*.35;
      const clearance=Math.min(...COASTAL_WALK_BOUNDARY.map((a,i)=>{const b=COASTAL_WALK_BOUNDARY[(i+1)%COASTAL_WALK_BOUNDARY.length];return forestSegmentDistance(x,y,a.x,a.y,b.x,b.y);}));
      const shrub=clearance<24||random()<.06;
      const size=shrub?Math.min(6,width*.7):width,radius=size/Math.SQRT2;
      const height=shrub?1.2+random()*1.3:size*(.66+random()*.15);
      if(withinWalkingBoundary({x,y})||clearance<radius+3||FOREST_SIGHTLINES.some(v=>forestSegmentDistance(x,y,v[0],v[1],v[2],v[3])<radius+1))continue;
      if([[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]].some(([x,y])=>landscapeGroundHeight(x,y)===undefined))continue;
      if(landscape.some(g=>g.trees.some(t=>Math.hypot(x-t.x,y-t.y)<t.height*.55+size*.22)))continue;
      const base=support(x,y);if(base===undefined)continue;
      const key=`${Math.floor(x/80)}-${Math.floor(y/80)}`;
      if(!cells.has(key))cells.set(key,{name:`forest-${key}`,plants:empty(),trees:[]});
      const cell=cells.get(key)!;cell.trees.push(appendTreeImpostor(cell.plants,x,y,base,height,size,angle,shade,shrub));
    }
    rowY-=step;
  }
  return [...cells.values()];
}
