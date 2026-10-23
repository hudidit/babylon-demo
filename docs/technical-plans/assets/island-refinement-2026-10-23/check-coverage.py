import json,math,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4]
script="""const load=require('./docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');const m=load('CoastalForest');console.log(JSON.stringify({forest:m.coastalForest(load('CoastalLandscape').coastalLandscape()).flatMap(g=>g.trees),details:m.coastalForest(load('CoastalLandscape').coastalLandscape()).filter(g=>g.detail.positions.length).map(g=>g.detail),boundary:load('CoastalCliff').coastalBoundary(),walk:load('CoastalSite').COASTAL_WALK_BOUNDARY,sightlines:m.FOREST_SIGHTLINES}));"""
D=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT));step=float(sys.argv[1]) if len(sys.argv)>1 else .5
OUT=Path(__file__).resolve().parent
x0,y0,x1,y1=-812,-601,705,107;w=round((x1-x0)/step);h=round((y1-y0)/step)
land=Image.new('1',(w,h));ImageDraw.Draw(land).polygon([((p['x']-x0)/step,(p['y']-y0)/step) for p in D['boundary']],fill=1)
land=np.array(land);covered=np.zeros((h,w),dtype=bool);near_covered=covered.copy()
alpha=np.array(Image.open(ROOT/'public/textures/coastal/pine-impostor.png').convert('RGBA'))[:,:,3]
for t in D['forest']:
 x,y,size,angle=t['x'],t['y'],t['width'],t['angle'];r=size/math.sqrt(2)
 a=max(0,math.floor((x-r-x0)/step));b=min(w,math.ceil((x+r-x0)/step));c=max(0,math.floor((y-r-y0)/step));d=min(h,math.ceil((y+r-y0)/step))
 yy,xx=np.mgrid[c:d,a:b];dx=x0+(xx+.5)*step-x;dy=y0+(yy+.5)*step-y
 u=(math.cos(angle)*dx+math.sin(angle)*dy)/size+.5;v=(-math.sin(angle)*dx+math.cos(angle)*dy)/size+.5
 # Current runtime top UV. Whole-tree elevation cards have zero plan area.
 tx=np.clip(np.rint((t['variant']+.502+u*.496)/2*1023).astype(int),0,1023);ty=np.clip(np.rint((1-(.998-v*.996))*255).astype(int),0,255)
 hit=(u>=0)&(u<=1)&(v>=0)&(v<=1)&(alpha[ty,tx]>=89)
 covered[c:d,a:b]|=hit
 if 'detailFirst' not in t:near_covered[c:d,a:b]|=hit
# Alternative state: all 93 detailed plants enabled; rasterize their actual projected triangles and source alpha.
leaf_alpha=np.array(Image.open(ROOT/'public/textures/coastal/pine-branches.png').convert('RGBA'))[:,:,3]
for g in D['details']:
 points=np.array(g['positions']).reshape(-1,3)[:,[0,2]]/5+5.4;uvs=np.array(g['uvs']).reshape(-1,2)
 for ids in np.array(g['indices']).reshape(-1,3):
  a,b,c=points[ids];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-9:continue
  left=max(0,math.floor((min(a[0],b[0],c[0])-x0)/step));right=min(w,math.ceil((max(a[0],b[0],c[0])-x0)/step))
  top=max(0,math.floor((min(a[1],b[1],c[1])-y0)/step));bottom=min(h,math.ceil((max(a[1],b[1],c[1])-y0)/step))
  yy,xx=np.mgrid[top:bottom,left:right];xx=x0+(xx+.5)*step;yy=y0+(yy+.5)*step
  wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;wc=1-wa-wb
  uv=np.stack([wa,wb,wc],axis=-1)@uvs[ids]
  tx=np.clip(np.rint(uv[:,:,0]*1023).astype(int),0,1023);ty=np.clip(np.rint((1-uv[:,:,1])*1023).astype(int),0,1023)
  near_covered[top:bottom,left:right]|=(wa>=0)&(wb>=0)&(wc>=0)&(leaf_alpha[ty,tx]>=89)
walk=Image.new('1',(w,h));draw=ImageDraw.Draw(walk);draw.polygon([((p['x']-x0)/step,(p['y']-y0)/step) for p in D['walk']],fill=1)
for i,p in enumerate(D['walk']):
 q=D['walk'][(i+1)%len(D['walk'])];draw.line([((p['x']-x0)/step,(p['y']-y0)/step),((q['x']-x0)/step,(q['y']-y0)/step)],fill=1,width=round(6/step))
for a,b,c,d in D['sightlines']:draw.line([((a-x0)/step,(b-y0)/step),((c-x0)/step,(d-y0)/step)],fill=1,width=round(2/step))
plantable=land&~np.array(walk)
result={'method':'Plan-space raster union of actual new crown alpha >= 0.35, excludes original 88 crowns and existing ground plants; not bounding-box area or screen pixels. Plantable excludes walking polygon plus 3m buffer and landmark corridor plus 1m buffer. PIL boundary rasterization; compare 1m and 0.5m resolution.','detailMethod':'Second state replaces all 93 selected impostors with a plan raster of actual branch/leaf triangles and pine-branches alpha >=0.35; Two reference states; mixed per-cell camera selections are not asserted to be bounded by these two totals.','stepMetres':step,'newPlants':len(D['forest']),'newTrees':sum(not t['shrub'] for t in D['forest']),'newShrubs':sum(t['shrub'] for t in D['forest'])}
for name,miny in [('all',-601),('main',-180),('near',-50)]:
 area=land.copy();area[:round((miny-y0)/step)]=False
 eligible=plantable&area
 result[name]={'landArea':int(area.sum())*step**2,'canopyArea':int((area&covered).sum())*step**2,'landCoverage':float((area&covered).sum()/area.sum()),'plantableCoverage':float((eligible&covered).sum()/eligible.sum()),'allDetailsLandCoverage':float((area&near_covered).sum()/area.sum()),'allDetailsPlantableCoverage':float((eligible&near_covered).sum()/eligible.sum())}
assert .74<=result['all']['plantableCoverage']<=.82;assert result['all']['allDetailsPlantableCoverage']>=.74;assert result['main']['plantableCoverage']>.65
print(json.dumps(result,indent=2));(OUT/f'coverage-{step:g}m.json').write_text(json.dumps(result,indent=2))
map=np.full((h,w,3),[59,91,109],dtype=np.uint8);map[land]=[170,153,110];map[covered&land]=[54,96,57];map[np.array(walk)&land]=[223,215,184]
Image.fromarray(map).save(OUT/f'coverage-{step:g}m.png')
