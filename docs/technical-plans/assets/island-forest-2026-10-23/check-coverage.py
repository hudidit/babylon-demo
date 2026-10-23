import json,math,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4]
script="""const load=require('./docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');const m=load('CoastalForest');console.log(JSON.stringify({forest:m.coastalForest(load('CoastalLandscape').coastalLandscape()).flatMap(g=>g.trees),boundary:load('CoastalCliff').coastalBoundary(),walk:load('CoastalSite').COASTAL_WALK_BOUNDARY,sightlines:m.FOREST_SIGHTLINES}));"""
D=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT));step=float(sys.argv[1]) if len(sys.argv)>1 else .5
OUT=Path(__file__).resolve().parent
x0,y0,x1,y1=-812,-601,705,107;w=round((x1-x0)/step);h=round((y1-y0)/step)
land=Image.new('1',(w,h));ImageDraw.Draw(land).polygon([((p['x']-x0)/step,(p['y']-y0)/step) for p in D['boundary']],fill=1)
land=np.array(land);covered=np.zeros((h,w),dtype=bool)
alpha=np.array(Image.open(ROOT/'public/textures/coastal/pine-impostor.png').convert('RGBA'))[:,:,3]
for t in D['forest']:
 x,y,size,angle=t['x'],t['y'],t['width'],t['angle'];r=size/math.sqrt(2)
 a=max(0,math.floor((x-r-x0)/step));b=min(w,math.ceil((x+r-x0)/step));c=max(0,math.floor((y-r-y0)/step));d=min(h,math.ceil((y+r-y0)/step))
 yy,xx=np.mgrid[c:d,a:b];dx=x0+(xx+.5)*step-x;dy=y0+(yy+.5)*step-y
 u=(math.cos(angle)*dx+math.sin(angle)*dy)/size+.5;v=(-math.sin(angle)*dx+math.cos(angle)*dy)/size+.5
 # Current runtime top UV. Whole-tree elevation cards have zero plan area.
 tx=np.clip(np.rint((.502+u*.496)*511).astype(int),0,511);ty=np.clip(np.rint((1-(.998-v*.996))*255).astype(int),0,255)
 covered[c:d,a:b]|=(u>=0)&(u<=1)&(v>=0)&(v<=1)&(alpha[ty,tx]>=89)
walk=Image.new('1',(w,h));draw=ImageDraw.Draw(walk);draw.polygon([((p['x']-x0)/step,(p['y']-y0)/step) for p in D['walk']],fill=1)
for i,p in enumerate(D['walk']):
 q=D['walk'][(i+1)%len(D['walk'])];draw.line([((p['x']-x0)/step,(p['y']-y0)/step),((q['x']-x0)/step,(q['y']-y0)/step)],fill=1,width=round(6/step))
for a,b,c,d in D['sightlines']:draw.line([((a-x0)/step,(b-y0)/step),((c-x0)/step,(d-y0)/step)],fill=1,width=round(2/step))
plantable=land&~np.array(walk)
result={'method':'Plan-space raster union of actual new crown alpha >= 0.35, excludes original 88 crowns and existing ground plants; not bounding-box area or screen pixels. Plantable excludes walking polygon plus 3m buffer and landmark corridor plus 1m buffer. PIL boundary rasterization; compare 1m and 0.5m resolution.','stepMetres':step,'newPlants':len(D['forest']),'newTrees':sum(not t['shrub'] for t in D['forest']),'newShrubs':sum(t['shrub'] for t in D['forest'])}
for name,miny in [('all',-601),('main',-180),('near',-50)]:
 area=land.copy();area[:round((miny-y0)/step)]=False
 eligible=plantable&area
 result[name]={'landArea':int(area.sum())*step**2,'canopyArea':int((area&covered).sum())*step**2,'landCoverage':float((area&covered).sum()/area.sum()),'plantableCoverage':float((eligible&covered).sum()/eligible.sum())}
assert .74<=result['all']['plantableCoverage']<=.82;assert result['main']['plantableCoverage']>.65
print(json.dumps(result,indent=2));(OUT/f'coverage-{step:g}m.json').write_text(json.dumps(result,indent=2))
map=np.full((h,w,3),[59,91,109],dtype=np.uint8);map[land]=[170,153,110];map[covered&land]=[54,96,57];map[np.array(walk)&land]=[223,215,184]
Image.fromarray(map).save(OUT/f'coverage-{step:g}m.png')
