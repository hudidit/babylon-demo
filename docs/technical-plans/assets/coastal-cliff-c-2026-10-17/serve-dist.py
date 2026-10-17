"""Only serve an explicit production directory, including its /home/ alias and fault mode."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8154)
parser.add_argument('--root', default=str(Path(__file__).resolve().parents[4] / 'dist'))
parser.add_argument('--fault', action='store_true')
args = parser.parse_args()

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if args.fault and urlsplit(self.path).path.endswith(('coastal/rock-color.jpg', 'coastal-daylight.hdr')):
            self.send_error(404, 'Deliberate coastal fault')
            return
        super().do_GET()

    def translate_path(self, path):
        if urlsplit(path).path.startswith('/home/'):
            path = path[5:]
        return super().translate_path(path)

if not (Path(args.root) / 'release-manifest.json').is_file():
    raise SystemExit('Production manifest required')
ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=args.root)).serve_forever()
