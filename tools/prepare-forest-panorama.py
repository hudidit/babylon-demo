"""Rebuild forest delivery assets from the fixed CC0 source, never a prior compressed output.
Usage: python3 tools/prepare-forest-panorama.py /path/to/forest-slope-original.jpg
"""
from PIL import Image, __version__ as pillow_version
from pathlib import Path
import hashlib
import json
import sys

original = Path(sys.argv[1])
raw = original.read_bytes()
assert hashlib.md5(raw).hexdigest() == 'e6fb0022bb9f216edc7b2dfb58f19f15', 'Unexpected panorama original'
assert hashlib.sha256(raw).hexdigest() == 'd6ed6cbd2458979198403cd63f6774308eb49571b8f637da47339cad7339589a', 'Unexpected source SHA256'
folder = Path(__file__).resolve().parents[1] / 'public/textures/study/forest-window'
Image.open(original).resize((4096, 2048), Image.Resampling.LANCZOS).save(
    folder / 'panorama.jpg', quality=64, subsampling=2, optimize=True)
bark_crop = [7040, 1100, 7096, 2100]
Image.open(original).crop(bark_crop).resize((256, 512), Image.Resampling.LANCZOS).save(
    folder / 'bark.jpg', quality=88, subsampling=0, optimize=True)
source = json.loads((folder / 'source.json').read_text())
source['sourceSHA256'] = hashlib.sha256(raw).hexdigest()
source.pop('outputSHA256', None)
source['processing'] = {
    'method': 'full equirectangular panorama; Lanczos resize; JPEG quality 64, 4:2:0, optimize',
    'outputSize': [4096, 2048], 'tool': 'Pillow ' + pillow_version, 'script': 'tools/prepare-forest-panorama.py',
}
source['files'] = {name: {'file': 'textures/study/forest-window/' + name,
    'bytes': (folder / name).stat().st_size, 'sha256': hashlib.sha256((folder / name).read_bytes()).hexdigest()}
    for name in ['panorama.jpg', 'bark.jpg']}
source.pop('ground', None)
source['bark'] = {'author': 'Andreas Mischok', 'license': 'CC0-1.0',
    'source': 'same Forest Slope original', 'cropPixels': bark_crop, 'size': [256, 512],
    'method': 'crop; Lanczos resize; JPEG quality 88, 4:4:4, optimize'}
source['updateDate'] = '2026-10-17'
(folder / 'source.json').write_text(json.dumps(source, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(source['files'], indent=2))
