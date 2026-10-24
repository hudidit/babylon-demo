"""Prepare phase-B door/cloth foley from pinned CC0 sources (macOS AudioToolbox)."""
from pathlib import Path
import importlib.util
import json
import math
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('audio_prepare', ROOT / 'tools/prepare-audio-lab.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)
SOURCE = ROOT / 'assets/audio-source/actions'
OUTPUT = ROOT / 'public/audio/actions'
# cue, source, two offsets, input duration, overlap, peak, gain, priority
CLIPS = [
    ('metal-door-move', 'metal-motion', (.015, .035), .32, .04, .42, .18, 1),
    ('metal-door-latch', 'metal-close', (.015, .035), .22, 0, .58, .24, 3),
    ('slide-move', 'slide', (.64, 3.30), .48, .04, .42, .24, 1),
    ('slide-stop', 'slide', (1.02, 4.03), .14, 0, .48, .20, 3),
    ('cloth-touch', 'cloth', (3.06, 3.68), .08, 0, .40, .18, 3),
    ('cloth-wipe', 'cloth', (3.15, 3.72), .48, .04, .48, .28, 2),
    ('cloth-lift', 'cloth', (4.30, 4.43), .09, 0, .36, .18, 3),
]


def main():
    sources = json.loads((SOURCE / 'source.json').read_text())['sources']
    source_map = {s['id']: s for s in sources}
    rows, catalog = [], []
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='babylon-action-audio-') as temp:
        decoded = {}
        for source in sources:
            path = SOURCE / source['file']
            assert audio.digest(path.read_bytes()) == source['sha256'], 'Source hash changed'
            channels = audio.read_pcm(path, Path(temp))
            decoded[source['id']] = [sum(v) / len(channels) for v in zip(*channels)]
        for cue, source, starts, duration, overlap, peak, gain, priority in CLIPS:
            for variation, start in enumerate(starts, 1):
                first, count, cross = round(start * audio.RATE), round(duration * audio.RATE), round(overlap * audio.RATE)
                values = decoded[source][first:first + count]
                assert len(values) == count
                mean = sum(values) / count
                values = [v - mean for v in values]
                if cross:
                    blend = [values[-cross+i] * (1-i/cross) + values[i] * i/cross for i in range(cross)]
                    values = values[cross:-cross] + blend
                    # Rotate within the blend to a low-amplitude, low-step boundary.
                    seam = min(range(len(values)-cross+1, len(values)),
                        key=lambda i: abs(values[i]-values[i-1]) + .01 * abs(values[i]))
                    values = values[seam:] + values[:seam]
                else:
                    values = [v * min(1, i / 96, (len(values)-1-i) / 576) for i, v in enumerate(values)]
                scale = peak / max(abs(v) for v in values)
                data = audio.wav_bytes([[v * scale for v in values]])
                digest = audio.digest(data)
                clip_id = cue + '-' + str(variation)
                # Crossfades preserve the delivered waveform, but only sustained wiping repeats.
                loop = cue == 'cloth-wipe'
                name = clip_id + '.' + digest[:10] + '.wav'
                (OUTPUT / name).write_bytes(data)
                # Measure the exact delivered PCM, rather than pre-quantization floats.
                from array import array
                pcm = array('h', data[44:])
                step_rms = math.sqrt(sum((pcm[i+1]-pcm[i])**2 for i in range(len(pcm)-1)) / (len(pcm)-1)) / 32768
                rows.append({'id': clip_id, 'file': 'audio/actions/' + name, 'sourceId': source,
                    'sourceSha256': source_map[source]['sha256'], 'license': 'CC0-1.0',
                    'bytes': len(data), 'sha256': digest, 'sampleRate': audio.RATE, 'channels': 1, 'bitDepth': 16,
                    'frames': len(pcm), 'durationSeconds': len(pcm) / audio.RATE,
                    'peak': max(abs(v) for v in pcm) / 32768, 'loop': loop,
                    'boundaryStep': abs(pcm[-1]-pcm[0]) / 32768, 'adjacentStepRms': step_rms,
                    'processing': {'start': start, 'inputDuration': duration, 'crossfadeSeconds': overlap,
                        'loopRotationFrames': seam if cross else 0,
                        'removeDC': True, 'mono': True, 'peakTarget': peak, 'fadeIn': 0 if cross else .002,
                        'fadeOut': 0 if cross else .012}})
                catalog.append({'id': clip_id, 'cue': cue, 'file': 'audio/actions/' + name,
                    'priority': priority, 'gain': gain, 'preload': 'core' if variation == 1 else 'variation', 'loop': loop})
    total = sum(r['bytes'] for r in rows)
    assert total <= .35 * 1048576, 'Phase-B encoded allowance exceeded'
    manifest = {'schemaVersion': 1, 'license': 'CC0-1.0', 'verifiedOn': '2026-10-24',
        'generator': 'tools/prepare-action-audio.py', 'generatorSha256': audio.digest(Path(__file__).read_bytes()),
        'decoder': 'macOS afconvert / AudioToolbox PCM16@48000',
        'sources': [{k:v for k,v in s.items() if k != 'file'} for s in sources],
        'files': rows, 'totalBytes': total, 'decodedBytes': sum(r['frames']*4 for r in rows)}
    (OUTPUT / 'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    used = {Path(r['file']).name for r in rows}
    for path in OUTPUT.glob('*.wav'):
        if path.name not in used:
            path.unlink()
    (ROOT / 'src/examples/RoomActionAudioCatalog.ts').write_text(
        '// Generated by tools/prepare-action-audio.py; provenance: public/audio/actions/source.json.\n'
        'import type { AudioClip } from "./RoomAudioCatalog";\n'
        'export const ACTION_AUDIO_CLIPS: readonly AudioClip[] = [\n' +
        ''.join('  ' + json.dumps(row) + ',\n' for row in catalog) + '];\n')
    print(json.dumps({'files': len(rows), 'bytes': total, 'decodedBytes': manifest['decodedBytes']}))


if __name__ == '__main__':
    main()
