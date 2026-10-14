"""Record byte counts and hashes; never modify application code or source assets."""
import argparse
import hashlib
import json
import platform
import re
import struct
import subprocess
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--build", type=Path, required=True)
args = parser.parse_args()
report = Path(__file__).resolve().parent
root = report.parents[3]


def git(*arguments):
    return subprocess.check_output(["git", *arguments], cwd=root, text=True).strip()


def describe(path, relative_to):
    data = path.read_bytes()
    return {"path": path.relative_to(relative_to).as_posix(), "bytes": len(data),
            "allocatedBytes": path.stat().st_blocks * 512,
            "sha256": hashlib.sha256(data).hexdigest()}


def dimensions(data):
    position = 2
    while position < len(data):
        if data[position] != 255:
            position += 1
            continue
        while data[position] == 255:
            position += 1
        marker = data[position]
        position += 1
        if marker in (0xd8, 0xd9, 1) or 0xd0 <= marker <= 0xd7:
            continue
        if marker == 0xda:
            break
        size = struct.unpack_from(">H", data, position)[0]
        if marker in (0xc0, 0xc1, 0xc2):
            _, height, width = struct.unpack_from(">BHH", data, position + 2)
            return [width, height]
        position += size
    raise ValueError("JPEG dimensions not found")


def model_details(path):
    data = path.read_bytes()
    json_size = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = data[28 + json_size:]
    images = []
    for image in document.get("images", []):
        view = document["bufferViews"][image["bufferView"]]
        offset = view.get("byteOffset", 0)
        content = binary[offset:offset + view["byteLength"]]
        images.append({"name": image.get("name"), "mimeType": image.get("mimeType"),
                       "bytes": len(content), "dimensions": dimensions(content),
                       "sha256": hashlib.sha256(content).hexdigest()})
    primitives = [p for mesh in document["meshes"] for p in mesh["primitives"]]
    return {"path": path.relative_to(root).as_posix(), "generator": document["asset"].get("generator"),
            "vertices": sum(document["accessors"][p["attributes"]["POSITION"]]["count"] for p in primitives),
            "triangles": sum(document["accessors"][p["indices"]]["count"] // 3 for p in primitives),
            "imageBytes": sum(image["bytes"] for image in images), "images": images,
            "otherBytes": len(data) - sum(image["bytes"] for image in images),
            "materials": len(document.get("materials", [])), "nodes": document.get("nodes"),
            "extensionsUsed": document.get("extensionsUsed", []),
            "externalUris": [item["uri"] for kind in ("images", "buffers")
                             for item in document.get(kind, []) if "uri" in item]}


asset_paths = [root / "public/models" / name for name in ("gothic_commode.glb", "wooden_bookshelf.glb")]
asset_paths += [root / "public/models/study" / name for name in ("sofa_03.glb", "modern_arm_chair_01.glb")]
asset_paths += sorted((root / "public/textures/study").rglob("*.jpg"))
asset_paths += [root / "public/textures/pictures/pic1.jpg", root / "public/environment/study-interior.hdr"]
sources = set()
pending = [root / "src/app.ts"]
while pending:
    path = pending.pop().resolve()
    if path in sources:
        continue
    sources.add(path)
    for reference in re.findall(r'(?:from\s*|import\s*\(?)\s*[\'\"](\.[^\'\"]+)', path.read_text()):
        target = (path.parent / reference).with_suffix(".ts").resolve()
        if target.is_file():
            pending.append(target)
sources.add(root / "public/index.html")
assets = [describe(p, root) for p in sorted(asset_paths)]
build_root = args.build.resolve()
build = [describe(p, build_root) for p in sorted(build_root.rglob("*")) if p.is_file()]
source_files = [describe(p, root) for p in sorted(sources)]
configuration = [describe(root / name, root) for name in
                 ("package.json", "package-lock.json", "tsconfig.json", "webpack.config.js")]
summary = {"assetCount": len(assets), "assetBytes": sum(p["bytes"] for p in assets),
           "sourceCount": len(source_files), "sourceBytes": sum(p["bytes"] for p in source_files),
           "buildFileCount": len(build), "buildBytes": sum(p["bytes"] for p in build),
           "mainJsBytes": next(p["bytes"] for p in build if p["path"] == "js/bundleName.js")}
summary["productionPlusAssetsBytes"] = summary["buildBytes"] + summary["assetBytes"]
document = {"capturedAtUtc": datetime.now(timezone.utc).isoformat(), "baselineCommit": git("rev-parse", "HEAD"),
            "planOriginalBaseline": "fd32f40f25f25cea679df2d30d85aaeb5a4c8a70",
            "runtime": {"node": subprocess.check_output(["node", "--version"], text=True).strip(),
                        "python": platform.python_version(), "os": platform.system(),
                        "osRelease": platform.release(), "architecture": platform.machine()},
            "buildCommand": "npm run build -- --mode production --output-path <temporary-build-directory>",
            "sourceChangesSinceOriginalPlan": git("diff", "--name-only", "fd32f40..HEAD", "--", "src", "public/index.html").splitlines(),
            "matchesOriginalAssetBytes": summary["assetBytes"] == 51450194,
            "summary": summary, "assets": assets, "sourceFiles": source_files,
            "configuration": configuration, "buildFiles": build,
            "targetModels": [model_details(root / name) for name in
                             ("public/models/gothic_commode.glb", "public/models/wooden_bookshelf.glb")]}
(report / "files.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(summary, ensure_ascii=False))
