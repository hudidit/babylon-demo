"""Rebuild short CC0 foley from verified, lossless originals; Python standard library only."""
from pathlib import Path
import hashlib
import io
import json
import platform
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/audio-source/study"
OUTPUT = ROOT / "public/audio/study"
# Separate motion from impacts: reversing or blocking never plays a baked-in closing impact.
CLIPS = [
    ("drawer-slide-1", "drawer_open", .08, .32, .52),
    ("drawer-slide-2", "drawer_close", .02, .30, .50),
    ("drawer-stop-1", "drawer_close", .345, .12, .60),
    ("drawer-stop-2", "drawer_open", .50, .16, .55),
    ("door-move-1", "door_creak_open", .11, .40, .48),
    ("door-move-2", "door_creak_close", .24, .58, .48),
    ("door-latch-1", "door_close", .275, .16, .62),
    ("door-latch-2", "door_close", .29, .17, .58),
    ("switch-1", "switch_on", .045, .12, .52),
    ("switch-2", "switch_off", .045, .17, .52),
    ("paper-1", "turn_page", .22, .20, .42),
    ("paper-2", "turn_page", .52, .29, .42),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    upstream = json.loads((SOURCE / "source.json").read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for clip, source, start, duration, peak in CLIPS:
        original = SOURCE / (source + ".wav")
        assert digest(original.read_bytes()) == upstream["files"][original.name], "Source changed"
        with wave.open(str(original)) as reader:
            assert reader.getnchannels() == 1 and reader.getsampwidth() == 2
            rate = reader.getframerate()
            reader.setpos(round(start * rate))
            raw = reader.readframes(round(duration * rate))
        samples = list(struct.unpack("<" + "h" * (len(raw) // 2), raw))
        # Remove DC, normalize with generous headroom, then preserve the transient with a 2ms edge.
        mean = sum(samples) / len(samples)
        centered = [value - mean for value in samples]
        scale = peak * 32767 / max(abs(value) for value in centered)
        fade_in, fade_out = round(.002 * rate), round(.012 * rate)
        result = [round(value * scale * min(1, i / fade_in, (len(samples) - 1 - i) / fade_out))
                  for i, value in enumerate(centered)]
        pcm = struct.pack("<" + "h" * len(result), *result)
        # Content-address the delivery names so a later edit cannot serve stale audio from HTTP cache.
        stream = io.BytesIO()
        with wave.open(stream, "wb") as writer:
            writer.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            writer.writeframes(pcm)
        data = stream.getvalue()
        file = f"{clip}.{digest(data)[:10]}.wav"
        (OUTPUT / file).write_bytes(data)
        records.append({"id": clip, "file": "audio/study/" + file,
                        "sourceFile": original.name, "sourceSha256": digest(original.read_bytes()),
                        "trimStartSeconds": start, "trimDurationSeconds": duration,
                        "processing": {"removeDC": True, "peakTarget": peak, "fadeInMs": 2, "fadeOutMs": 12},
                        "sampleRate": rate, "channels": 1, "bitDepth": 16, "frames": len(result),
                        "durationSeconds": len(result) / rate, "decodedBytes": len(result) * 4,
                        "peak": max(abs(value) for value in result) / 32768,
                        "bytes": len(data), "sha256": digest(data), "license": "CC0-1.0"})
    manifest = {"schemaVersion": 1, "title": upstream["title"], "author": upstream["author"],
                "page": upstream["page"], "download": upstream["download"],
                "license": upstream["license"], "licenseUrl": upstream["licenseUrl"],
                "verifiedOn": upstream["verifiedOn"], "archiveSha256": upstream["archiveSha256"],
                "generator": "tools/prepare-study-audio.py", "generatorSha256": digest(Path(__file__).read_bytes()),
                "tool": "Python standard-library wave/struct", "pythonVersion": platform.python_version(),
                "formatDecision": "Short mono PCM WAV fits 0.5 MiB; no lossy encode or runtime codec fallback required.",
                "files": records, "totalBytes": sum(row["bytes"] for row in records),
                "decodedBytes": sum(row["decodedBytes"] for row in records)}
    (OUTPUT / "source.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"files": len(records), "bytes": manifest["totalBytes"], "decodedBytes": manifest["decodedBytes"]}))


if __name__ == "__main__":
    main()
