"""Reject blank matrix captures; visual review is still required for actual scene quality."""
import json
from pathlib import Path
from PIL import Image, ImageStat

root = Path(__file__).resolve().parent
records = []
for path in sorted(root.glob('engines/*.jpg')):
    image = Image.open(path).convert('RGB')
    width, height = image.size
    crop = image.crop((int(width * .15), int(height * .25), int(width * .8), int(height * .65)))
    deviations = ImageStat.Stat(crop).stddev
    records.append({'file': path.relative_to(root).as_posix(), 'size': [width, height],
                    'sceneCropStddev': deviations, 'nonblank': max(deviations) > 5})
result = {'method': 'Pillow scene-region RGB standard deviation above 5 only detects blank captures; representative interior/exit/exterior views also visually inspected. Not a visual quality or performance metric.', 'files': records}
(root / 'screenshot-qa.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
assert len(records) == 24 and all(record['nonblank'] for record in records)
print(f'{len(records)} nonblank matrix screenshots; visual review required separately')
