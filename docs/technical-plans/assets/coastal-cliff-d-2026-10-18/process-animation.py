"""Package actual cross-engine captures; fixed animation delta is not an FPS sample."""
from pathlib import Path
from PIL import Image, ImageChops
import json

folder = Path(__file__).resolve().parent / 'engines'
records = []
for kind in ['chromium', 'firefox', 'webkit']:
    paths = sorted(folder.glob(kind + '-frame-*.png'))
    if not paths:
        continue
    frames = [Image.open(p).convert('RGB') for p in paths]
    assert len(frames) == 12
    small = [f.resize((768, 480), Image.Resampling.LANCZOS) for f in frames]
    small[0].save(folder/(kind+'-ocean.webp'), save_all=True, append_images=small[1:], quality=85, method=6, duration=200, loop=0)
    sheet = Image.new('RGB', (1536, 960))
    for slot, index in enumerate([0, 4, 8, 11]):
        sheet.paste(small[index], ((slot % 2)*768, (slot // 2)*480))
    sheet.save(folder/(kind+'-sequence.jpg'), quality=90)
    diff = ImageChops.difference(frames[0], frames[-1])
    records.append({'engine': kind, 'frames': len(frames), 'fixedFrameStepSeconds': .2, 'firstLastDifferenceBounds': diff.getbbox()})
    assert diff.getbbox(), 'Ocean must change during a continuous capture'
    for p in paths:
        p.unlink()
(folder/'animation-check.json').write_text(json.dumps({'fpsOrLoadTimeSampling': False, 'sequences': records}, indent=2)+'\n')
