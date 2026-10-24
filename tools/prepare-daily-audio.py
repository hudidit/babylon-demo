"""Phase D: pinned CC0 foley; original UI tones; macOS AudioToolbox only."""
from pathlib import Path
from array import array
import importlib.util
import json
import math
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('soundscape', ROOT / 'tools/prepare-soundscape-audio.py')
soundscape = importlib.util.module_from_spec(spec)
spec.loader.exec_module(soundscape)
audio, RATE = soundscape.audio, soundscape.RATE
SOURCE, OUTPUT = ROOT / 'assets/audio-source/daily', ROOT / 'public/audio/daily'


def main():
    sources = json.loads((SOURCE / 'source.json').read_text())['sources']
    generator_hash = audio.digest(Path(__file__).read_bytes())
    sources.append(dict(id='ui-tone', author='babylon-demo contributors', title='Soft interface contact tone',
        page='https://github.com/hudidit/babylon-demo', license='ISC', sha256=generator_hash,
        tier='project original offline sine synthesis; no semantic success fanfare', verifiedOn='2026-10-24'))
    by_id = {s['id']: s for s in sources}
    rows, catalog = [], []
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='babylon-daily-') as tmp:
        temp = Path(tmp); decoded = {}
        for source in sources:
            if source['id'] == 'ui-tone': continue
            p = SOURCE / source['file']; assert audio.digest(p.read_bytes()) == source['sha256']
            channels = audio.read_pcm(p, temp)
            decoded[source['id']] = [sum(v)/len(channels) for v in zip(*channels)]
        def fitted(values, duration):
            count = round(duration*RATE)
            return values[:count]+[0.]*max(0,count-len(values))
        steps = {}
        for material, source, duration in [('wood','wood',.25),('hard','concrete',.12),
                ('earth','grass',.32),('metal','concrete',.22),('soft','carpet',.15)]:
            for i in range(3 if material=='soft' else 4):
                source_index=[0,1,3][i] if material=='soft' else i
                key = f'footstep_{source}_{source_index:03}'
                values = fitted(decoded[key],duration); ids = [key]
                if material == 'metal':
                    plate = f'impactPlate_light_{i:03}'; ids.append(plate)
                    ring = fitted(decoded[plate],duration)
                    values = [v+.3*ring[n] for n,v in enumerate(values)]
                steps[material,i] = (values,ids)
        recipes = []
        # All regular steps are variations; preserve the existing small core warm-up budget.
        for (material,i),(values,ids) in steps.items():
            recipes.append((f'footstep-{material}-{i+1}',f'footstep-{material}',values,ids,0,.4,.25,1,'variation'))
        for material in ['wood','hard','earth','metal','soft']:
            for i in range(2):
                a,ids = steps[material,i]; b,other = steps[material,(i+2)%3 if material=='soft' else i+2]
                a,b = fitted(a,.22),fitted(b,.22); delay=round(.035*RATE)
                values = [v+(.6*b[n-delay] if n>=delay else 0) for n,v in enumerate(a)]
                recipes.append((f'landing-{material}-{i+1}',f'landing-{material}',values,ids+other,0,.45,.3,2,'variation'))
        for i in range(3):
            values,ids = steps['metal',i]
            recipes.append((f'ladder-rung-{i+1}','ladder-rung',fitted(values,.16),ids,0,.4,.23,1,'variation'))
        for i,start in enumerate([3.15,3.72],1):
            values=decoded['cloth'][round(start*RATE):round((start+.48)*RATE)]
            recipes.append((f'curtain-move-{i}','curtain-move',values,['cloth'],.04,.4,.20,1,'variation'))
        # Lower, steady generic motor foley; this is not a recording of the in-game optic.
        motor=decoded['motor'][round(5*RATE):round(9*RATE)]
        motor=[motor[round(i*.6)] for i in range(round(2.2*RATE))]
        motor=soundscape.lowpass(soundscape.lowpass(motor,650),650)
        recipes.append(('beacon-drive','beacon-drive',motor,['motor'],.2,.35,1,0,'world'))
        for i,hz in enumerate([520,570],1):
            values=[math.sin(2*math.pi*hz*n/RATE)*math.exp(-n/(RATE*.011)) for n in range(round(.045*RATE))]
            recipes.append((f'ui-contact-{i}','ui-contact',values,['ui-tone'],0,.22,.15,3,'core' if i==1 else 'variation'))
        for clip_id,cue,raw,ids,overlap,peak,gain,priority,preload in recipes:
            channels=soundscape.finish([raw],peak,overlap)
            wav=audio.wav_bytes(channels); pcm=array('h',wav[44:])
            if preload=='world':
                input=temp/(clip_id+'.wav'); output=temp/(clip_id+'.m4a'); input.write_bytes(wav)
                subprocess.run(['afconvert',str(input),str(output),'-f','m4af','-d','aac','-b','64000'],check=True)
                data,ext=audio.stable_mp4(output.read_bytes()),'m4a'
            else: data,ext=wav,'wav'
            digest=audio.digest(data); name=clip_id+'.'+digest[:10]+'.'+ext
            (OUTPUT/name).write_bytes(data)
            rows.append(dict(id=clip_id,cue=cue,file='audio/daily/'+name,sourceIds=ids,
                sourceSha256s=[by_id[key]['sha256'] for key in ids],license='ISC' if ids==['ui-tone'] else 'CC0-1.0',
                bytes=len(data),sha256=digest,sampleRate=RATE,channels=1,bitDepth=16,frames=len(pcm),
                durationSeconds=len(pcm)/RATE,decodedBytes=len(pcm)*4,referencePcmSha256=audio.digest(wav),
                peak=max(abs(v) for v in pcm)/32768,boundaryStep=abs(pcm[-1]-pcm[0])/32768,
                loop=bool(overlap),format=ext,preload=preload,
                processing=dict(removeDC=True,crossfadeSeconds=overlap,peakTarget=peak,
                    recipe='pinned foley fit/blend; generic motor 0.6x lowpass650Hz; UI sine; see generator')))
            catalog.append(dict(id=clip_id,cue=cue,file='audio/daily/'+name,priority=priority,gain=gain,
                preload=preload,loop=bool(overlap),group='ui' if cue=='ui-contact' else 'actions'))
    total=sum(row['bytes'] for row in rows); pcm=sum(row['decodedBytes'] for row in rows)
    assert total<=.85*1048576 and pcm<=2*1048576
    manifest=dict(schemaVersion=1,verifiedOn='2026-10-24',generator='tools/prepare-daily-audio.py',
        generatorSha256=generator_hash,sources=[{k:v for k,v in s.items() if k!='file'} for s in sources],
        files=rows,totalBytes=total,decodedBytes=pcm)
    (OUTPUT/'source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    used={Path(row['file']).name for row in rows}
    for p in OUTPUT.iterdir():
        if p.suffix in ['.wav','.m4a'] and p.name not in used:p.unlink()
    (ROOT/'src/examples/RoomDailyAudioCatalog.ts').write_text(
        '// Generated by tools/prepare-daily-audio.py; provenance: public/audio/daily/source.json.\n'
        'import type { AudioClip } from "./RoomAudioCatalog";\nexport const DAILY_AUDIO_CLIPS: readonly AudioClip[] = [\n'+
        ''.join('  '+json.dumps(row)+',\n' for row in catalog)+'];\n')
    print(json.dumps(dict(files=len(rows),bytes=total,decodedBytes=pcm)))


if __name__ == '__main__': main()
