"""Pinned recordings, calm non-tonal wind/sea beds and original offline tyre/brake synthesis."""
from pathlib import Path
from array import array
import importlib.util
import json
import math
import random
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('audio_prepare', ROOT / 'tools/prepare-audio-lab.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)
RATE = audio.RATE
SOURCE = ROOT / 'assets/audio-source/soundscape'
OUTPUT = ROOT / 'public/audio/soundscape'


def lowpass(values, hz):
    alpha = 1 - math.exp(-2 * math.pi * hz / RATE)
    result, previous = [], values[0]
    # Warm the periodic filter; then retain one complete period.
    for _ in range(2):
        result = []
        for value in values:
            previous += alpha * (value - previous)
            result.append(previous)
    return result


def finish(channels, peak, overlap=0):
    result = []
    cross = round(overlap * RATE)
    for values in channels:
        mean = sum(values) / len(values)
        values = [v - mean for v in values]
        if cross:
            blend = [values[-cross+i] * (1-i/cross) + values[i] * i/cross for i in range(cross)]
            values = values[cross:-cross] + blend
        else:
            values = [v * min(1, i / 144, (len(values)-1-i) / 720) for i, v in enumerate(values)]
        result.append(values)
    if cross:
        seam = min(range(len(result[0])-cross+1, len(result[0])),
            key=lambda i: sum(abs(v[i]-v[i-1]) + .01*abs(v[i]) for v in result))
        result = [v[seam:] + v[:seam] for v in result]
    scale = peak / max(abs(v) for values in result for v in values)
    return [[v * scale for v in values] for values in result]


def main():
    sources = json.loads((SOURCE / 'source.json').read_text())['sources']
    generator_hash = audio.digest(Path(__file__).read_bytes())
    sources.append({'id': 'procedural', 'author': 'babylon-demo contributors', 'title': 'Fixed-seed tyre/brake noise synthesis',
        'page': 'https://github.com/hudidit/babylon-demo', 'license': 'ISC', 'sha256': generator_hash,
        'tier': 'project original offline synthesis; not a tyre recording', 'verifiedOn': '2026-10-24'})
    sources.append({'id': 'calm-beds', 'author': 'babylon-demo contributors', 'title': 'Calm non-tonal wind and wave wash',
        'page': 'https://github.com/hudidit/babylon-demo', 'license': 'ISC', 'sha256': generator_hash,
        'tier': 'project original fixed-seed filtered noise; no embedded bird calls or tonal oscillators; not a field recording', 'verifiedOn': '2026-10-24'})
    by_id = {s['id']: s for s in sources}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows, catalog = [], []
    with tempfile.TemporaryDirectory(prefix='babylon-soundscape-') as temp:
        temp = Path(temp)
        decoded = {}
        for s in sources:
            if s['id'] in ['procedural','calm-beds']:
                continue
            p = SOURCE / s['file']; assert audio.digest(p.read_bytes()) == s['sha256']
            decoded[s['id']] = audio.read_pcm(p, temp)
        mono = lambda key: [sum(v)/len(decoded[key]) for v in zip(*decoded[key])]
        def cut(key, start, duration):
            values = mono(key)[round(start*RATE):round((start+duration)*RATE)]
            assert len(values) == round(duration*RATE)
            return [values]
        # Quiet beds contain only broadband wash and slow envelopes; birds are separate one-shots.
        count=round(8.5*RATE)
        bed_rng=random.Random(2026102401)
        wind=lowpass(lowpass([bed_rng.uniform(-1,1) for _ in range(count)],1200),1200)
        rumble=lowpass(wind,70);wind=[v-rumble[i] for i,v in enumerate(wind)]
        wave_rng=random.Random(2026102402)
        shared=[wave_rng.uniform(-1,1) for _ in range(count)]
        sea=[]
        for c in range(2):
            wash=lowpass([.65*v+.35*wave_rng.uniform(-1,1) for v in shared],2800)
            low=lowpass(wash,130)
            sea.append([(v+.35*low[i])*(.65+.25*math.sin(2*math.pi*i/count)+.1*math.sin(4*math.pi*i/count+1)) for i,v in enumerate(wash)])
        rng = random.Random(20261024)
        noise = [rng.uniform(-1,1) for _ in range(round(2.2*RATE))]
        rolling = lowpass(noise, 1400)
        low = lowpass(rolling, 160)
        rolling = [(v-low[i])*(.9+.1*math.sin(i/RATE*2*math.pi*11)) for i,v in enumerate(rolling)]
        recipes = [
            ('motor-loop', ['motor'], cut('motor', 5, 3.25), .25, .40, 'vehicle', None),
            ('roll-loop', ['procedural'], [rolling], .2, .35, 'vehicle', None),
        ]
        for name, ids, raw, hz, peak in [('wind', ['calm-beds'], [wind],900,.35),
                ('rain', ['rain'], cut('rain',4,8.5),1500,.38),
                ('sea', ['calm-beds'], sea,1100,.40)]:
            recipes.append((name+'-open', ids, raw, .5, peak, 'ambience', None))
            # Two cascaded low-pass passes; normalized to the same peak before gain crossfade.
            sheltered = [lowpass(lowpass(v,hz),hz) for v in raw]
            recipes.append((name+'-sheltered', ids, sheltered, .5, peak, 'ambience', hz))
        for index, start in enumerate([3.04,3.69],1):
            recipes.append(('scooter-mount-'+str(index), ['cloth'], cut('cloth',start,.10),0,.36,'vehicle',None))
            n = [rng.uniform(-1,1) for _ in range(round(.18*RATE))]
            n = lowpass(n,1800)
            n = [v * math.exp(-i/(RATE*.07)) for i,v in enumerate(n)]
            recipes.append(('scooter-brake-'+str(index), ['procedural'], [n],0,.36,'vehicle',None))
        for clip_id, source_ids, raw, overlap, peak, group, hz in recipes:
            channels = finish(raw, peak, overlap)
            wav = audio.wav_bytes(channels); pcm = array('h', wav[44:])
            if overlap:
                file = temp/(clip_id+'.wav'); file.write_bytes(wav)
                encoded = temp/(clip_id+'.m4a')
                subprocess.run(['afconvert',str(file),str(encoded),'-f','m4af','-d','aac','-b',str(96000 if len(channels)==2 else 64000)],check=True)
                data, ext = audio.stable_mp4(encoded.read_bytes()), 'm4a'
            else:
                data, ext = wav, 'wav'
            digest = audio.digest(data); name = clip_id+'.'+digest[:10]+'.'+ext
            (OUTPUT/name).write_bytes(data)
            row = {'id':clip_id,'file':'audio/soundscape/'+name,'sourceIds':source_ids,
                'sourceSha256s':[by_id[s]['sha256'] for s in source_ids],
                'license':'ISC' if source_ids in [['procedural'],['calm-beds']] else 'CC0-1.0',
                'bytes':len(data),'sha256':digest,'sampleRate':RATE,'channels':len(channels),'bitDepth':16,
                'frames':len(channels[0]),'durationSeconds':len(channels[0])/RATE,'decodedBytes':len(pcm)*4,
                'referencePcmSha256':audio.digest(wav),'loop':bool(overlap),'format':ext,
                'peak':max(abs(v) for v in pcm)/32768,
                'boundaryStep':max(abs(v[-1]-v[0]) for v in channels),
                'processing':{'removeDC':True,'crossfadeSeconds':overlap,'lowPassHz':hz,'peakTarget':peak,
                    'recipe': 'fixed-seed non-tonal filtered noise and slow wash envelope; birds separate' if source_ids==['calm-beds'] else 'pinned trim or fixed-seed noise; see generator'}}
            rows.append(row)
            catalog.append({'id':clip_id,'cue':clip_id if overlap else clip_id[:-2], 'file':row['file'],
                'priority':0 if group=='ambience' else 2,'gain':1 if overlap else .18,
                'preload':'world' if overlap else 'core' if clip_id.endswith('-1') else 'variation',
                'group':group,'loop':bool(overlap)})
    total = sum(r['bytes'] for r in rows); decoded_bytes = sum(r['decodedBytes'] for r in rows)
    assert total < 1.1*1048576 and decoded_bytes+1223040 < 16*1048576
    manifest = {'schemaVersion':1,'verifiedOn':'2026-10-24','generator':'tools/prepare-soundscape-audio.py',
        'generatorSha256':generator_hash,'sources':[{k:v for k,v in s.items() if k!='file'} for s in sources if any(s['id'] in r['sourceIds'] for r in rows)],
        'files':rows,'totalBytes':total,'decodedBytes':decoded_bytes,'delivery':'AAC64k mono/AAC96k stereo loops; PCM16 short sounds; no runtime decoder library'}
    (OUTPUT/'source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    used = {Path(r['file']).name for r in rows}
    for p in OUTPUT.iterdir():
        if p.suffix in ['.wav','.m4a'] and p.name not in used:p.unlink()
    (ROOT/'src/examples/RoomSoundscapeAudioCatalog.ts').write_text(
        '// Generated by tools/prepare-soundscape-audio.py; provenance: public/audio/soundscape/source.json.\n'
        'import type { AudioClip } from "./RoomAudioCatalog";\nexport const SOUNDSCAPE_AUDIO_CLIPS: readonly AudioClip[] = [\n'+
        ''.join('  '+json.dumps(r)+',\n' for r in catalog)+'];\n')
    print(json.dumps({'files':len(rows),'bytes':total,'decodedBytes':decoded_bytes}))


if __name__ == '__main__':main()
