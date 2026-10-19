#!/usr/bin/env python3
"""Generate the sun-free neutral RGBE environment without touching photographic maps.

Run directly to update the HDR/provenance, or --check to verify deterministic output.
Also imported by prepare-coastal-materials.py when rebuilding all reviewed materials.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys


def rle(values):
    result = bytearray()
    i = 0
    while i < len(values):
        run = 1
        while i + run < len(values) and values[i + run] == values[i] and run < 127:
            run += 1
        if run >= 4:
            result.extend([128 + run, values[i]])
            i += run
        else:
            start = i
            i += run
            while i < len(values) and i - start < 127:
                n = 1
                while i + n < len(values) and values[i + n] == values[i] and n < 4:
                    n += 1
                if n >= 4:
                    break
                i += min(n, 127 - (i - start))
            result.append(i - start)
            result.extend(values[start:i])
    return result


def environment_bytes(root):
    source = (root / 'src/examples/CoastalSky.ts').read_text()
    parameters = json.loads(re.search(r'export const COASTAL_ENVIRONMENT = (.*?) as const;', source).group(1))
    w, h = parameters['width'], parameters['height']
    data = bytearray(('#?RADIANCE\n# babylon-demo neutral sun-free analytic sky\n'
                      f'FORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n').encode())
    for y in range(h):
        vertical = math.cos((y + .5) / h * math.pi)
        t = min(1, abs(vertical) * 2) ** .65
        other = parameters['ground'] if vertical < 0 else parameters['zenith']
        c = [a * (1 - t) + b * t for a, b in zip(parameters['horizon'], other)]
        mantissa, exponent = math.frexp(max(c))
        pixel = [min(255, max(0, math.floor(channel * mantissa * 256 / max(c)))) for channel in c]
        pixel.append(exponent + 128)
        data.extend([2, 2, w >> 8, w & 255])
        for value in pixel:
            data.extend(rle([value] * w))
    return bytes(data), parameters


def generate_environment(root, check=False):
    data, parameters = environment_bytes(root)
    file = 'environment/coastal-daylight.hdr'
    path = root / 'public' / file
    source_path = root / 'public/textures/coastal/source.json'
    source = json.loads(source_path.read_text())
    previous = next(entry for entry in source['files'] if entry['file'] == file)
    digest = hashlib.sha256(data).hexdigest()
    if check:
        assert path.read_bytes() == data, 'HDR differs from deterministic generator output'
        assert previous['parameters'] == parameters
        assert previous['deliverySha256'] == digest and previous['bytes'] == len(data)
        return previous
    record = {'file': file, 'bytes': len(data), 'deliverySha256': digest,
              'semantic': 'linear RGBE neutral sun-free sky, 256x128; azimuth invariant; runtime cubemap 128 with harmonics and specular prefilter',
              'parameters': parameters, 'generator': 'tools/generate-coastal-environment.py',
              'replaces': previous.get('replaces') or {'commit': 'ed703e8', 'bytes': previous['bytes'],
                  'sha256': previous['deliverySha256'], 'parameters': previous['parameters'],
                  'reason': 'Remove the baked fixed-direction sun; dynamic sun/moon and analytic sky now share scene time.'}}
    path.write_bytes(data)
    return record


def main():
    root = Path(__file__).resolve().parents[1]
    check = '--check' in sys.argv[1:]
    record = generate_environment(root, check)
    if not check:
        path = root / 'public/textures/coastal/source.json'
        source = json.loads(path.read_text())
        source['files'] = [record if entry['file'] == record['file'] else entry for entry in source['files']]
        source['version'] = 'coastal-day-night-v1'
        source['environmentProcedure'] = 'tools/generate-coastal-environment.py; Python standard library; regenerate/--check without recompressing the six locked photographic maps'
        source['runtimeBytes'] = sum(entry['bytes'] for entry in source['files'])
        path.write_text(json.dumps(source, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'check': check, 'file': record['file'], 'bytes': record['bytes'], 'sha256': record['deliverySha256']}))


if __name__ == '__main__':
    main()
