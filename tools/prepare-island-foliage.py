"""Bake a compact branch atlas from fixed CC0 Poly Haven pine twig maps.
Usage: python prepare-island-foliage.py /path/to/originals [--check]
Originals stay outside public; no model or other maps are downloaded by this script.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, __version__
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
inputs = {}
images = {}
for part, md5 in [('diff', 'a4fa4a55aab9231915a4023ea9841577'), ('alpha', '641911a5a3f543911dad04ebb26e7bca')]:
    name = f'pine_tree_01_twig_{part}_1k.png'
    raw = (SOURCE / name).read_bytes()
    expected_sha = {'diff':'d02c031de64b8ad671f3dd0da19870fa4783d912ae6674aeab0702871deeaeaa', 'alpha':'6f91aa99f2c27108d6f817f874954aa7df8bfbb4dea2673e9322555a6ae79d99'}[part]
    assert hashlib.md5(raw).hexdigest() == md5 and hashlib.sha256(raw).hexdigest() == expected_sha, f'Unexpected source: {name}'
    inputs[name] = dict(url=f'https://dl.polyhaven.org/file/ph-assets/Models/png/1k/pine_tree_01/{name}', bytes=len(raw), md5=md5, sha256=hashlib.sha256(raw).hexdigest())
    images[part] = Image.open(SOURCE / name)
# Isolate the full upright twig; the other atlas regions contain pinecones and opaque UV padding.
twig = images['diff'].convert('RGBA').crop((27, 35, 227, 456))
mask = Image.new('L', (1024, 1024))
ImageDraw.Draw(mask).polygon([(27,35),(210,35),(230,125),(224,230),(170,390),(167,456),(118,456),(114,355),(39,300),(27,240)], fill=255)
twig.putalpha(ImageChops.multiply(images['alpha'].convert('L'), mask).crop((27,35,227,456)))
canvas = Image.new('RGBA', (512, 512))
draw = ImageDraw.Draw(canvas)
draw.line([(256,493),(253,280),(257,65)], fill=(91,81,55,255), width=5)
# Alternating needle shoots form one branch, with a clear stem root and porous tips.
for row in range(6):
    cy = 410-row*58
    for side in [-1,1]:
        size = (98-row*5, 207-row*11)
        shoot = twig.resize(size, Image.Resampling.LANCZOS).rotate(side*(53-row*3), Image.Resampling.BICUBIC, expand=True)
        cx = 256-side*(63-row*6)
        canvas.alpha_composite(shoot,(int(cx-shoot.width/2),int(cy-shoot.height/2)))
shoot=twig.resize((81,171),Image.Resampling.LANCZOS)
canvas.alpha_composite(shoot,(216,14))
# A constant opaque bark patch for trunk UVs keeps trees in the same draw batch.
ImageDraw.Draw(canvas).rectangle((496,496,511,511),fill=(112,106,87,255))
# Dilate RGB under transparent pixels to avoid black filtering fringes; keep alpha untouched.
a=canvas.getchannel('A'); rgb=canvas.convert('RGB')
mask=a.point(lambda v:255 if v>32 else 0)
for _ in range(4):
    rgb=Image.composite(rgb,rgb.filter(ImageFilter.MaxFilter(3)),mask)
    mask=mask.filter(ImageFilter.MaxFilter(3))
canvas=rgb.convert('RGBA');canvas.putalpha(a)
# Indexed PNG retains a separate alpha value for each palette entry, with no runtime decoder.
canvas=canvas.quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
import io
stream=io.BytesIO();canvas.save(stream,format='PNG',optimize=True);raw=stream.getvalue()
output=ROOT/'public/textures/coastal/pine-branches.png'
manifest=dict(asset='Poly Haven Pine Tree 01 — twig maps only',source='https://polyhaven.com/a/pine_tree_01',authors={'Rob Tuytel':'photography','Rico Cilliers':'modeling'},license='CC0-1.0',licenseUrl='https://polyhaven.com/license',retrieved='2026-10-23',inputs=inputs,processing=dict(script='tools/prepare-island-foliage.py',pillow=__version__,crop=[27,35,227,456],size=[512,512],method='Deterministic arrangement of 13 source twig cutouts; Lanczos scaling, bicubic rotation, RGB dilation, FASTOCTREE 256-color indexed PNG; alpha test 0.35, sRGB color.',modelImported=False),output=dict(file='textures/coastal/pine-branches.png',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),width=512,height=512))
if '--check' in sys.argv:
    assert output.read_bytes()==raw
    assert json.loads(output.with_name('pine-source.json').read_text())==manifest
else:
    output.write_bytes(raw)
    output.with_name('pine-source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest['output']))
