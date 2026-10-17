#!/usr/bin/env python3
"""Rebuild delivery maps from locked lossless originals; no recompression of delivery files.
Usage: python3 tools/prepare-coastal-materials.py /path/to/originals
Download originals from coastal-material-inputs.json; SHA256 must match before conversion.
"""
import hashlib, json, math, re, sys
from pathlib import Path
import numpy as np
import PIL
from PIL import Image, features
ROOT = Path(__file__).resolve().parents[1]
ORIGINALS = Path(sys.argv[1])
lock = json.loads((ROOT / 'tools/coastal-material-inputs.json').read_text())
out = ROOT / 'public/textures/coastal'
files = []
for entry in lock['inputs']:
    original = ORIGINALS / entry['input']
    raw = original.read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry['sha256']:
        raise ValueError('Original checksum mismatch: ' + str(original))
    im = Image.open(original).convert('RGB')
    original_size = list(im.size)
    im = im.resize(tuple(entry['size']), Image.Resampling.LANCZOS)
    if entry['semantic'] == 'OpenGL tangent normal':
        v = np.asarray(im, dtype=np.float64) / 127.5 - 1
        v /= np.maximum(1e-8, np.linalg.norm(v, axis=2, keepdims=True))
        im = Image.fromarray(np.rint((v + 1) * 127.5).clip(0, 255).astype(np.uint8))
    if entry['semantic'] == 'linear ARM: R=AO G=roughness B=metalness':
        a = np.array(im); a[:, :, 2] = 0; im = Image.fromarray(a)
    dest = out / entry['output']
    im.save(dest, quality=entry['quality'], subsampling=entry['subsampling'], optimize=True, progressive=True)
    data = dest.read_bytes()
    files.append({**entry, 'originalSize': original_size, 'file': str(dest.relative_to(ROOT / 'public')),
                  'bytes': len(data), 'deliverySha256': hashlib.sha256(data).hexdigest()})

# Deterministic 256x128 linear RGBE sky. No photographic room or local building reflection.
a = json.loads(re.search(r'export const COASTAL_SKY = (.*?) as const;', (ROOT/'src/examples/CoastalSky.ts').read_text()).group(1))
sun = np.array(a['sun']); sun /= np.linalg.norm(sun)
w, h = 256, 128
header = b'#?RADIANCE\n# babylon-demo analytic coastal sky\nFORMAT=32-bit_rle_rgbe\n\n-Y 128 +X 256\n'
result = bytearray(header)
def rle(values):
    buf = bytearray(); i = 0
    while i < len(values):
        run = 1
        while i+run < len(values) and values[i+run] == values[i] and run < 127: run += 1
        if run >= 4:
            buf.extend([128+run, int(values[i])]); i += run
        else:
            start = i; i += run
            while i < len(values) and i-start < 127:
                n = 1
                while i+n < len(values) and values[i+n] == values[i] and n < 4: n += 1
                if n >= 4: break
                i += min(n, 127-(i-start))
            buf.append(i-start); buf.extend(values[start:i].tobytes())
    return buf
# Babylon panoramaToCubemap uses theta=acos(y), phi=atan2(z,x), u=(phi+pi)/2pi.
for y in range(h):
    row = []
    for x in range(w):
        theta = (y+.5)/h*math.pi; phi = (x+.5)/w*2*math.pi-math.pi
        d = np.array([math.sin(theta)*math.cos(phi), math.cos(theta), math.sin(theta)*math.sin(phi)])
        t = min(1,abs(d[1])*2)**.65
        c = np.array(a['horizon'])*(1-t) + np.array(a['ground'] if d[1]<0 else a['zenith'])*t
        c += np.array(a['sunColor'])*a['sunPower']*max(0,float(d@sun))**a['sunSharpness']
        mantissa, exponent = math.frexp(float(max(c)))
        rgb = np.floor(c*mantissa*256/max(c)).clip(0,255).astype(np.uint8)
        row.append([*rgb, exponent+128])
    result.extend([2,2,w>>8,w&255])
    for channel in np.array(row,dtype=np.uint8).T: result.extend(rle(channel))
dest = ROOT/'public/environment/coastal-daylight.hdr'; dest.write_bytes(result)
files.append({'file':'environment/coastal-daylight.hdr','bytes':len(result),'deliverySha256':hashlib.sha256(result).hexdigest(),
              'semantic':'linear RGBE analytic sky, 256x128; runtime cubemap 128 with harmonics and specular prefilter', 'parameters':a})
manifest = {'version':'coastal-static-v1','tools':{'python':sys.version.split()[0],'Pillow':PIL.__version__,'numpy':np.__version__,
            'jpeg':features.version('jpg')},
            'procedure':'tools/prepare-coastal-materials.py; maps always rebuilt from SHA256-locked lossless PNG originals; Lanczos resize, normal renormalization, nonmetal B=0; progressive optimized JPEG',
            'files':files,'runtimeBytes':sum(f['bytes'] for f in files)}
(ROOT/'public/textures/coastal/source.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'runtimeBytes':manifest['runtimeBytes'],'files':[(f['file'],f['bytes']) for f in files]},indent=2))
