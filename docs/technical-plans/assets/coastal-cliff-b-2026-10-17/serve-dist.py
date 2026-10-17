"""Local dist-only verification host; /home/ is an alias of the exact same dist."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if urlsplit(path).path.startswith('/home/'):
            path = path[5:]
        return super().translate_path(path)

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[4] / 'dist'
    if not (root / 'release-manifest.json').is_file():
        raise SystemExit('Build the production dist first')
    ThreadingHTTPServer(('127.0.0.1', 8148), partial(Handler, directory=str(root))).serve_forever()
