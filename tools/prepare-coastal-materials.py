#!/usr/bin/env python3
"""Rebuild delivery maps from locked lossless originals; no recompression of delivery files.
Usage: python3 tools/prepare-coastal-materials.py /path/to/originals
Download originals from coastal-material-inputs.json; SHA256 must match before conversion.
"""
import hashlib, json, sys
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

# Shared deterministic generator; does not add a fixed sun to the IBL.
import importlib.util
spec = importlib.util.spec_from_file_location('coastal_environment', ROOT/'tools/generate-coastal-environment.py')
environment_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(environment_module)
generate_environment = environment_module.generate_environment
files.append(generate_environment(ROOT))
manifest = {'version':'coastal-day-night-v1','tools':{'python':sys.version.split()[0],'Pillow':PIL.__version__,'numpy':np.__version__,
            'jpeg':features.version('jpg')},
            'procedure':'tools/prepare-coastal-materials.py; maps always rebuilt from SHA256-locked lossless PNG originals; Lanczos resize, normal renormalization, nonmetal B=0; progressive optimized JPEG; sun-free neutral HDR from tools/generate-coastal-environment.py',
            'files':files,'runtimeBytes':sum(f['bytes'] for f in files)}
(ROOT/'public/textures/coastal/source.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'runtimeBytes':manifest['runtimeBytes'],'files':[(f['file'],f['bytes']) for f in files]},indent=2))
