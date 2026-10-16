"""Bake original, seamless painted-wall maps with only the Python standard library."""
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public/textures/study/painted_wall"
SIZE = 512
SEED = 20261016


def noise(x, y, period):
    value = ((x % period) * 374761393 + (y % period) * 668265263 + SEED) & 0xFFFFFFFF
    value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((value ^ (value >> 16)) & 0xFFFF) / 65535 - 0.5


def smooth_noise(x, y, cell):
    gx, gy = x // cell, y // cell
    tx, ty = (x % cell) / cell, (y % cell) / cell
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    period = SIZE // cell
    a = noise(gx, gy, period) * (1 - tx) + noise(gx + 1, gy, period) * tx
    b = noise(gx, gy + 1, period) * (1 - tx) + noise(gx + 1, gy + 1, period) * tx
    return a * (1 - ty) + b * ty


def png(pixels, channels):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    stride = SIZE * channels
    rows = b"".join(b"\0" + pixels[y * stride:(y + 1) * stride] for y in range(SIZE))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8,
            0 if channels == 1 else 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def build_maps():
    heights = [smooth_noise(x, y, 2) * 0.7 + smooth_noise(x, y, 8) * 0.3
               for y in range(SIZE) for x in range(SIZE)]
    color, normal, arm = bytearray(), bytearray(), bytearray()
    for y in range(SIZE):
        for x in range(SIZE):
            fine = heights[y * SIZE + x]
            broad = smooth_noise(x, y, 64)
            color.append(round(250 + fine * 5 + broad * 2))
            dx = (heights[y * SIZE + (x + 1) % SIZE] - heights[y * SIZE + (x - 1) % SIZE]) * 0.24
            dy = (heights[((y + 1) % SIZE) * SIZE + x] - heights[((y - 1) % SIZE) * SIZE + x]) * 0.24
            length = math.sqrt(dx * dx + dy * dy + 1)
            # Image rows run downward; OpenGL tangent +Y points toward decreasing rows.
            normal.extend((round(127.5 * (1 - dx / length)), round(127.5 * (1 + dy / length)),
                           round(127.5 * (1 + 1 / length))))
            arm.extend((255, round(232 + fine * 6), 0))
    return {"color.png": png(color, 1), "normal.png": png(normal, 3), "arm.png": png(arm, 3)}


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    records = {}
    for name, payload in build_maps().items():
        (DESTINATION / name).write_bytes(payload)
        records[name] = {"file": "textures/study/painted_wall/" + name, "bytes": len(payload),
                         "sha256": hashlib.sha256(payload).hexdigest()}
    source = {"source": "Original procedural maps authored in this project", "created": "2026-10-16",
              "license": "Project source terms (package.json: ISC); not a Poly Haven asset",
              "generator": "tools/generate-painted-wall.py", "seed": SEED, "size": [SIZE, SIZE],
              "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "generatedWith": {"python": sys.version.split()[0], "zlib": zlib.ZLIB_VERSION},
              "material": {"baseColor": "#e4dfd4", "normalStrength": 0.18, "worldUnitsPerTile": 6},
              "algorithm": "Periodic hashed value noise; cells 2/8 for fine height, 64 for subtle colour; wrap derivatives for OpenGL tangent normals",
              "channels": {"color": "sRGB grayscale multiplied by warm off-white material colour",
                           "normal": "Linear RGB tangent normal, OpenGL +Y",
                           "arm": "Linear RGB: AO=255, roughness=232 plus subtle grain, metalness=0"},
              "files": records}
    (DESTINATION / "source.json").write_text(json.dumps(source, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
