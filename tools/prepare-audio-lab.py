"""Build phase-A audition candidates; macOS AudioToolbox, no game release changes."""
from array import array
from pathlib import Path
import hashlib
import io
import json
import math
import struct
import subprocess
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/audio-source/soundscape-lab'
OUTPUT = ROOT / 'assets/audio-lab'
RATE = 48000
# id, source, trim start, input duration, overlap, channels, peak target
CLIPS = [
    ('door-motion', 'study/door_creak_open.wav', .11, .40, 0, 1, .48),
    ('door-latch', 'study/door_close.wav', .275, .16, 0, 1, .58),
    ('cloth-wipe', 'cloth', 3.1, 1.5, 0, 1, .48),
    ('motor-loop', 'motor', 5, 3.25, .25, 1, .40),
    ('wind-loop', 'wind', 12, 8.5, .5, 1, .35),
    ('rain-loop', 'rain', 4, 8.5, .5, 1, .38),
    ('sea-loop', 'sea', .05, 2.8, .3, 2, .40),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_pcm(path, temporary):
    decoded = temporary / (path.name + '.wav')
    subprocess.run(['afconvert', str(path), str(decoded), '-f', 'WAVE', '-d', 'LEI16@48000'], check=True)
    # AudioToolbox may emit WAVE_FORMAT_EXTENSIBLE, unsupported by Python 3.9 wave.
    data = decoded.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
    chunks, at = {}, 12
    while at + 8 <= len(data):
        size = struct.unpack_from('<I', data, at + 4)[0]
        chunks[data[at:at + 4]] = data[at + 8:at + 8 + size]
        at += 8 + size + size % 2
    fmt = chunks[b'fmt ']
    tag, channels, rate = struct.unpack_from('<HHI', fmt)
    assert tag == 1 or tag == 65534 and struct.unpack_from('<H', fmt, 24)[0] == 1
    assert struct.unpack_from('<H', fmt, 14)[0] == 16 and rate == RATE
    samples = array('h', chunks[b'data'])
    return [[samples[i + c] / 32768 for i in range(0, len(samples), channels)] for c in range(channels)]


def wav_bytes(channels):
    pcm = array('h', (round(max(-1, min(1, channels[c][i])) * 32767)
                      for i in range(len(channels[0])) for c in range(len(channels))))
    out = io.BytesIO()
    with wave.open(out, 'wb') as writer:
        writer.setparams((len(channels), 2, RATE, 0, 'NONE', 'not compressed'))
        writer.writeframes(pcm.tobytes())
    return out.getvalue()


def stable_mp4(data):
    """Remove encoder wall-clock dates, leaving the AAC packets and timing intact."""
    result = bytearray(data)
    def walk(start, end):
        at = start
        while at < end:
            size = struct.unpack_from('>I', result, at)[0]
            assert size >= 8 and at + size <= end
            kind = result[at + 4:at + 8]
            if kind in (b'mvhd', b'tkhd', b'mdhd'):
                width = 8 if result[at + 8] == 1 else 4
                result[at + 12:at + 12 + width * 2] = bytes(width * 2)
            elif kind in (b'moov', b'trak', b'mdia'):
                walk(at + 8, at + size)
            at += size
        assert at == end
    walk(0, len(result))
    return bytes(result)


def main():
    sources = json.loads((SOURCE / 'source.json').read_text())['sources']
    source_map = {s['id']: s for s in sources}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory(prefix='babylon-audio-prepare-') as temp:
        temporary = Path(temp)
        for clip, source, start, duration, overlap, channel_count, peak in CLIPS:
            path = ROOT / 'assets/audio-source' / source if source.startswith('study/') else SOURCE / source_map[source]['file']
            raw = path.read_bytes()
            expected = (json.loads((ROOT / 'assets/audio-source/study/source.json').read_text())['files'][path.name]
                        if source.startswith('study/') else source_map[source]['sha256'])
            assert digest(raw) == expected, 'Source hash changed: ' + source
            decoded = read_pcm(path, temporary)
            first, count, cross = round(start * RATE), round(duration * RATE), round(overlap * RATE)
            assert first + count <= len(decoded[0]), 'Trim exceeds source: ' + clip
            if channel_count == 1:
                channels = [[sum(values) / len(decoded) for values in zip(*(a[first:first + count] for a in decoded))]]
            else:
                assert len(decoded) == channel_count
                channels = [a[first:first + count] for a in decoded]
            for c, values in enumerate(channels):
                mean = sum(values) / len(values)
                values = [v - mean for v in values]
                if cross:
                    # End blends into the beginning, then wraps to the next beginning frame.
                    # Linear crossfade avoids gain lift for correlated motor samples.
                    blend = [values[-cross + i] * (1 - i / cross) + values[i] * (i / cross) for i in range(cross)]
                    values = values[cross:-cross] + blend
                else:
                    fade_in, fade_out = round(.002 * RATE), round(.02 * RATE)
                    values = [v * min(1, i / fade_in, (len(values) - 1 - i) / fade_out) for i, v in enumerate(values)]
                channels[c] = values
            scale = peak / max(abs(v) for a in channels for v in a)
            channels = [[v * scale for v in a] for a in channels]
            data = wav_bytes(channels)
            name = clip + '.' + digest(data)[:10] + '.wav'
            (OUTPUT / name).write_bytes(data)
            formats = [{'format': 'wav', 'file': name, 'bytes': len(data), 'sha256': digest(data)}]
            if cross:
                aac = temporary / (clip + '.m4a')
                subprocess.run(['afconvert', str(OUTPUT / name), str(aac), '-f', 'm4af', '-d', 'aac', '-b', '64000'], check=True)
                encoded = stable_mp4(aac.read_bytes())
                aac_name = clip + '.' + digest(encoded)[:10] + '.m4a'
                (OUTPUT / aac_name).write_bytes(encoded)
                formats.append({'format': 'aac', 'file': aac_name, 'bytes': len(encoded), 'sha256': digest(encoded)})
            step_rms = math.sqrt(sum((a[i + 1] - a[i]) ** 2 for a in channels for i in range(len(a) - 1)) /
                                 (len(channels) * (len(channels[0]) - 1)))
            boundary = max(abs(a[-1] - a[0]) for a in channels)
            rows.append({'id': clip, 'sourceId': source, 'sourceSha256': expected,
                         'license': 'CC0-1.0', 'status': 'audition-candidate', 'sampleRate': RATE,
                         'channels': channel_count, 'frames': len(channels[0]), 'duration': len(channels[0]) / RATE,
                         'loop': bool(cross), 'loopStart': 0, 'loopEnd': len(channels[0]) / RATE,
                         'decodedBytes': len(channels[0]) * channel_count * 4,
                         'processing': {'start': start, 'inputDuration': duration, 'crossfadeSeconds': overlap,
                                        'removeDC': True, 'peakTarget': peak, 'mono': channel_count == 1,
                                        'normalizeMp4Timestamps': bool(cross)},
                         'boundaryStep': boundary, 'adjacentStepRms': step_rms,
                         'boundaryToStepRms': boundary / step_rms, 'formats': formats})
    manifest = {'schemaVersion': 1, 'status': 'phase-A-only; no game integration',
                'generator': 'tools/prepare-audio-lab.py', 'generatorSha256': digest(Path(__file__).read_bytes()),
                'decoderEncoder': 'macOS afconvert / AudioToolbox, PCM16@48000, AAC 64000 bit/s',
                'clips': rows, 'decodedBytes': sum(r['decodedBytes'] for r in rows),
                'wavBytes': sum(r['formats'][0]['bytes'] for r in rows),
                'compactBytes': sum(r['formats'][-1]['bytes'] for r in rows)}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    used = {f['file'] for row in rows for f in row['formats']}
    prefixes = tuple(clip[0] + '.' for clip in CLIPS)
    for candidate in OUTPUT.iterdir():
        if candidate.name.startswith(prefixes) and candidate.suffix in ('.wav', '.m4a') and candidate.name not in used:
            candidate.unlink()
    print(json.dumps({k: v for k, v in manifest.items() if k not in ['clips']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
