"""Bake a compact branch atlas from fixed CC0 Poly Haven pine twig maps.
Usage: python prepare-island-foliage.py /path/to/originals [--check]
Originals stay outside public; no model or other maps are downloaded by this script.
"""
import hashlib, json, sys, math, random
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, __version__
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
inputs = {}
images = {}
for part, md5 in [('diff', 'a4fa4a55aab9231915a4023ea9841577'), ('alpha', '641911a5a3f543911dad04ebb26e7bca'), ('bark', '63688d7bcdd5ff5500f12bde192b197a')]:
    name = 'pine_tree_01_bark_diff_1k.png' if part == 'bark' else f'pine_tree_01_twig_{part}_1k.png'
    raw = (SOURCE / name).read_bytes()
    expected_sha = {'diff':'d02c031de64b8ad671f3dd0da19870fa4783d912ae6674aeab0702871deeaeaa', 'alpha':'6f91aa99f2c27108d6f817f874954aa7df8bfbb4dea2673e9322555a6ae79d99', 'bark':'91e79e9bd1d5d68922262b4eee752808c49c55c2941b531a65b586dae8984bc9'}[part]
    assert hashlib.md5(raw).hexdigest() == md5 and hashlib.sha256(raw).hexdigest() == expected_sha, f'Unexpected source: {name}'
    inputs[name] = dict(url=f'https://dl.polyhaven.org/file/ph-assets/Models/png/1k/pine_tree_01/{name}', bytes=len(raw), md5=md5, sha256=hashlib.sha256(raw).hexdigest())
    images[part] = Image.open(SOURCE / name)
# Isolate the full upright twig; the other atlas regions contain pinecones and opaque UV padding.
twig = images['diff'].convert('RGBA').crop((27, 35, 227, 456))
mask = Image.new('L', (1024, 1024))
ImageDraw.Draw(mask).polygon([(27,35),(210,35),(230,125),(224,230),(170,390),(167,456),(118,456),(114,355),(39,300),(27,240)], fill=255)
twig.putalpha(ImageChops.multiply(images['alpha'].convert('L'), mask).crop((27,35,227,456)))
canvas = Image.new('RGBA', (1024, 1024))
# Three irregular foliage clumps. Fine shoots overlap densely inside, with broken outer edges.
# Each tile represents a branch cluster rather than an enlarged single needle shoot.
for variant, (ox, oy) in enumerate([(0,0),(512,0),(0,512)]):
    rng = random.Random(231026 + variant)
    tile = Image.new('RGBA', (512,512))
    centres = [(210,245),(315,225),(265,325),(155,305),(275,145)]
    if variant == 1: centres = [(160,225),(290,245),(350,210),(225,300),(245,160)]
    if variant == 2: centres = [(180,190),(290,200),(260,315),(145,300),(340,300)]
    for n in range(360):
        cx,cy = centres[n % len(centres)]
        angle=rng.random()*math.tau; r=math.sqrt(rng.random())
        px=cx+math.cos(angle)*r*90; py=cy+math.sin(angle)*r*76
        h=rng.randrange(48,85); w=round(h*.48)
        shoot=twig.resize((w,h),Image.Resampling.LANCZOS)
        # Source color retained with restrained variation between overlapping shoots.
        red,green,blue,alpha=shoot.split(); value=.8+rng.random()*.4
        shoot=Image.merge('RGBA',(red.point(lambda v:round(v*value*.9)),green.point(lambda v:round(v*value*1.08)),blue.point(lambda v:round(v*value*1.05)),alpha))
        shoot=shoot.rotate(rng.uniform(-180,180),Image.Resampling.BICUBIC,expand=True)
        tile.alpha_composite(shoot,(round(px-shoot.width/2),round(py-shoot.height/2)))
    canvas.alpha_composite(tile,(ox,oy))
# Full opaque bark quadrant; inset UVs protect against foliage bleed through mip levels.
canvas.paste(images['bark'].convert('RGBA').resize((512,512),Image.Resampling.LANCZOS),(512,512))
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
manifest=dict(asset='Poly Haven Pine Tree 01 - twig and bark maps',source='https://polyhaven.com/a/pine_tree_01',authors={'Rob Tuytel':'photography','Rico Cilliers':'modeling'},license='CC0-1.0',licenseUrl='https://polyhaven.com/license',retrieved='2026-10-23',inputs=inputs,processing=dict(script='tools/prepare-island-foliage.py',pillow=__version__,crop=[27,35,227,456],size=[1024,1024],method='Three 512px clump tiles, each 360 fine source twig cutouts with fixed seeds 231026-231028; one 512px bark tile. Lanczos scaling, bicubic rotation, restrained per-shoot color variation, RGB dilation, FASTOCTREE 256-color indexed PNG; alpha test 0.35, sRGB color.',modelImported=False),output=dict(file='textures/coastal/pine-branches.png',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),width=1024,height=1024))
if '--check' in sys.argv:
    assert output.read_bytes()==raw
    assert json.loads(output.with_name('pine-source.json').read_text())==manifest
else:
    output.write_bytes(raw)
    output.with_name('pine-source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest['output']))
