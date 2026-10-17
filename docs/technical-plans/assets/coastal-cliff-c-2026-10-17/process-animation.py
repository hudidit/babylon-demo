"""Package browser-captured frames as reviewable animations; no performance sampling."""
from pathlib import Path
from PIL import Image, ImageChops
import json

output = Path(__file__).resolve().parent
result = {'fixedAnimationFrameStepSeconds': .2, 'fpsOrLoadTimeSampling': False, 'sequences': []}
for prefix, name in [('frame', 'ocean-animation'), ('shore', 'shore-animation')]:
    frames = [Image.open(p).convert('RGB') for p in sorted(Path('/tmp/coastal-c-animation').glob(prefix + '-*.png'))]
    if not frames:
        raise SystemExit('Run check-ocean.cjs first')
    frames[0].save(output / (name + '-first.jpg'), quality=90)
    frames[-1].save(output / (name + '-last.jpg'), quality=90)
    small = [im.resize((768, 480), Image.Resampling.LANCZOS) for im in frames]
    small[0].save(output / (name + '.webp'), save_all=True, append_images=small[1:], duration=200, loop=0, quality=82, method=6)
    sheet = Image.new('RGB', (1536, 960))
    for slot, index in enumerate([0, len(small)//3, len(small)*2//3, len(small)-1]):
        sheet.paste(small[index], ((slot % 2)*768, (slot // 2)*480))
    sheet.save(output / (name + '-sequence.jpg'), quality=88)
    diff = ImageChops.difference(frames[0], frames[-1])
    changes = sum(a != b for a, b in zip(frames[0].tobytes(), frames[-1].tobytes()))
    result['sequences'].append({'name': name, 'frames': len(frames), 'firstLastChangedChannels': changes,
                              'differenceBounds': diff.getbbox(), 'size': frames[0].size})
assert all(s['firstLastChangedChannels'] > 1000 for s in result['sequences'])
(output / 'animation-check.json').write_text(json.dumps(result, indent=2) + '\n')
