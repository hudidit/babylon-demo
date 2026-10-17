"""Negative-only HTTP fixture: same final dist, two intentional 404s; optional port argument."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import urlsplit
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path in ['/textures/coastal/rock-color.jpg', '/environment/coastal-daylight.hdr']:
            self.send_error(404, 'Intentional coastal failure-path test')
        else:
            super().do_GET()
if __name__ == '__main__':
    root = Path(__file__).resolve().parents[4] / 'dist'
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8149), partial(Handler, directory=str(root))).serve_forever()
