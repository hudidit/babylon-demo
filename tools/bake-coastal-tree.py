"""Bake an orthographic whole-tree atlas from the checked-in tree geometry and CC0 foliage.
Run with Python + numpy 2.3.5 + Pillow 12.3.0; --check compares deterministic output.
No external downloads or runtime image processing. Node/TypeScript exports the authored mesh.
"""
import hashlib, io, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, __version__
ROOT=Path(__file__).resolve().parents[1]
script="""const load=require('./docs/technical-plans/assets/lighthouse-d-2026-10-18/source-loader.cjs');
const [height,radius,phase]=process.argv.slice(1).map(Number);const g={positions:[],indices:[],uvs:[],colors:[]};load('CoastalTree').appendCoastalTree(g,0,0,0,height,false,1,radius,phase);console.log(JSON.stringify(g));"""
source=ROOT/'public/textures/coastal/pine-branches.png'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_hash==json.loads(source.with_name('pine-source.json').read_text())['output']['sha256']
texture=np.array(Image.open(source).convert('RGBA'))/255

def render(axis,w,h):
    w*=2;h*=2
    if axis==0: view=p[:,[0,1,2]].copy()
    elif axis==1: view=p[:,[2,1,0]].copy();view[:,2]*=-1
    else: view=p[:,[0,2,1]].copy();view[:,1:]*=-1
    lo,hi=(-.25,6) if axis<2 else (-half_width,half_width)
    view[:,0]=(view[:,0]+half_width)/(2*half_width)*(w-1);view[:,1]=(hi-view[:,1])/(hi-lo)*(h-1)
    out=np.zeros((h,w,4));depth=np.full((h,w),np.inf)
    for ids in np.array(g['indices']).reshape(-1,3):
        a,b,c=view[ids];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-9:continue
        x0=max(0,int(np.floor(min(a[0],b[0],c[0]))));x1=min(w,int(np.ceil(max(a[0],b[0],c[0])))+1)
        y0=max(0,int(np.floor(min(a[1],b[1],c[1]))));y1=min(h,int(np.ceil(max(a[1],b[1],c[1])))+1)
        if x1<=x0 or y1<=y0:continue
        yy,xx=np.mgrid[y0:y1,x0:x1]
        wa=((b[1]-c[1])*(xx+.5-c[0])+(c[0]-b[0])*(yy+.5-c[1]))/den
        wb=((c[1]-a[1])*(xx+.5-c[0])+(a[0]-c[0])*(yy+.5-c[1]))/den;wc=1-wa-wb
        weights=np.stack([wa,wb,wc],axis=-1);texuv=weights@uv[ids]
        tx=np.clip(np.rint(texuv[:,:,0]*1023).astype(int),0,1023);ty=np.clip(np.rint((1-texuv[:,:,1])*1023).astype(int),0,1023)
        tex=texture[ty,tx];z=weights@view[ids,2]
        hit=(wa>=0)&(wb>=0)&(wc>=0)&(tex[:,:,3]>=.35)&(z<depth[y0:y1,x0:x1])
        # Neutral ambient form shading, without baking a directional sun or cast shadow.
        tint=weights@(colors[ids]*(.78+.22*np.maximum(0,normals[ids,1,None])))
        rgba=np.concatenate([np.clip(tex[:,:,:3]**2.2*tint,0,1)**(1/2.2),np.ones((*wa.shape,1))],axis=-1)
        out[y0:y1,x0:x1][hit]=rgba[hit];depth[y0:y1,x0:x1][hit]=z[hit]
    return Image.fromarray(np.rint(out*255).astype('uint8'),'RGBA').resize((w//2,h//2),Image.Resampling.LANCZOS)

shapes=[[6,1.05,2.2],[6,1.05,.6]]
atlas=Image.new('RGBA',(1024,256))
for variant,shape in enumerate(shapes):
    half_width=[2.6,2.45][variant]
    g=json.loads(subprocess.check_output(['node','-e',script,*map(str,shape)],cwd=ROOT))
    p=np.array(g['positions']).reshape(-1,3)/5;p[:,0]+=5.4;p[:,1]+=1;p[:,2]+=5.4
    uv=np.array(g['uvs']).reshape(-1,2);colors=np.array(g['colors']).reshape(-1,4)[:,:3]
    normals=np.array(g['normals']).reshape(-1,3)
    for axis,size,origin in [(0,(128,256),(0,0)),(1,(128,256),(128,0)),(2,(256,256),(256,0))]:
        tile=render(axis,*size)
        if axis==2:
            mask=np.array(tile)[:,:,3];assert max(mask[0].max(),mask[-1].max(),mask[:,0].max(),mask[:,-1].max())<89,'Crown clipped by atlas boundary'
        atlas.paste(tile,(origin[0]+variant*512,origin[1]))
a=atlas.getchannel('A');rgb=atlas.convert('RGB');mask=a.point(lambda v:255 if v>32 else 0)
for _ in range(3):rgb=Image.composite(rgb,rgb.filter(ImageFilter.MaxFilter(3)),mask);mask=mask.filter(ImageFilter.MaxFilter(3))
atlas=rgb.convert('RGBA');atlas.putalpha(a)
atlas=atlas.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
stream=io.BytesIO();atlas.save(stream,format='PNG',optimize=True);raw=stream.getvalue()
output=ROOT/'public/textures/coastal/pine-impostor.png'
record={'asset':'Two whole-tree silhouettes with front, side and crown views','derivedFrom':'textures/coastal/pine-source.json','license':'CC0-1.0 texture source; ISC authored geometry and baker','geometrySource':'src/examples/CoastalTree.ts','geometrySha256':hashlib.sha256((ROOT/'src/examples/CoastalTree.ts').read_bytes()).hexdigest(),'foliageSha256':source_hash,'processing':{'script':'tools/bake-coastal-tree.py','pillow':__version__,'numpy':np.__version__,'trees':[{'height':h,'radius':r,'phase':p} for h,r,p in shapes],'halfWidths':[2.6,2.45],'verticalBounds':[-.25,6],'tilesPerVariant':[[0,0,128,256],[128,0,128,256],[256,0,256,256]],'variantOffsetX':512,'method':'Orthographic z-buffer rasterization, cutout 0.35, 2x supersampling, neutral ambient form shading, RGB dilation 3px, FASTOCTREE 128-color indexed PNG; no baked sun/cast shadow.'},'output':{'file':'textures/coastal/pine-impostor.png','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'width':1024,'height':256}}
manifest=output.with_name('pine-impostor-source.json')
if '--check' in sys.argv:assert output.read_bytes()==raw;assert json.loads(manifest.read_text())==record
else:output.write_bytes(raw);manifest.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(record['output']))
print('Crown alpha coverage:',[float(np.mean(np.array(atlas.convert('RGBA'))[:,i*512+256:i*512+512,3]>=89)) for i in range(2)])
