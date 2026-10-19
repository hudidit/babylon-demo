"""Read-only pixel check: camera targets the designed source direction in each fixture.
Run with the bundled Python/Pillow runtime after check-visuals.cjs. No image editing.
"""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent
results = []
for hour in [0, 6, 12, 18]:
    image = Image.open(root / f'{hour:02}-sky-body.jpg').convert('RGB')
    points = []
    for y in range(360, 440):
        for x in range(600, 680):
            r, g, b = image.getpixel((x, y))
            points.append((x + .5, y + .5, .2126 * r + .7152 * g + .0722 * b))
    low = min(p[2] for p in points)
    high = max(p[2] for p in points)
    assert high - low > 25, (hour, low, high)
    disk = [p for p in points if p[2] >= low + (high - low) * .8]
    cx = sum(p[0] for p in disk) / len(disk)
    cy = sum(p[1] for p in disk) / len(disk)
    distance = ((cx - 640) ** 2 + (cy - 400) ** 2) ** .5
    results.append({'hour': hour, 'centroid': [cx, cy], 'expected': [640, 400],
                    'offsetPixels': distance, 'corePixels': len(disk), 'passed': distance < 2})
    assert distance < 2, (hour, cx, cy, distance)
(root / 'sky-alignment.json').write_text(json.dumps({'passed': True, 'cases': results}, indent=2) + '\n')
print(json.dumps(results))
transitions = []
for name in ['dawn', 'dusk']:
    before = Image.open(root / f'{name}-handoff-before.jpg').convert('RGB').crop((300, 180, 1000, 650))
    after = Image.open(root / f'{name}-handoff-after.jpg').convert('RGB').crop((300, 180, 1000, 650))
    mean = ImageStat.Stat(ImageChops.difference(before, after)).mean
    assert max(mean) < 1.5, (name, mean)
    transitions.append({'name': name, 'meanAbsoluteChannelDifference': mean, 'threshold': 1.5, 'passed': True})
(root / 'twilight-continuity.json').write_text(json.dumps({'passed': True, 'cases': transitions}, indent=2) + '\n')
print(json.dumps(transitions))
