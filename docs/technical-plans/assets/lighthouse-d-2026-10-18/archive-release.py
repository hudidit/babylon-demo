"""Create a new deterministic full release archive, preserving any existing immutable baseline."""
from pathlib import Path
import gzip
import tarfile
import io
import hashlib
import json
import platform
import zlib

output = Path(__file__).resolve().parent
root = output.parents[3]
archive = root / 'artifacts/reuse-baselines/2026-10-18-lighthouse-coast-v1-dist.tar.gz'
if archive.exists():
    raise SystemExit('Archive already exists; verify it instead of overwriting')
archive.parent.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in (root / 'dist').rglob('*') if p.is_file())
with archive.open('xb') as raw:
    with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=9, mtime=0) as gz:
        with tarfile.open(mode='w', fileobj=gz, format=tarfile.USTAR_FORMAT) as tar:
            for file in files:
                assert not file.is_symlink()
                data = file.read_bytes()
                info = tarfile.TarInfo('dist/' + file.relative_to(root / 'dist').as_posix())
                info.size = len(data)
                info.mode = 0o644
                info.uid = info.gid = info.mtime = 0
                tar.addfile(info, io.BytesIO(data))
data = archive.read_bytes()
record = {'path': archive.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
          'storage': 'local binary; source tag and metadata pushed, no remote binary backup',
          'format': 'gzip(tar USTAR); dist/ prefix; sorted files; uid/gid/mtime=0; mode=0644; gzip level=9; empty filename; mtime=0',
          'pythonVersion': platform.python_version(), 'zlibVersion': zlib.ZLIB_VERSION, 'releaseFiles': len(files)}
(output / 'archive.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record))
