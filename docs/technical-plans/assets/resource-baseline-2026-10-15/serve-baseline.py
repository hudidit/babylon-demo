"""Serve unchanged production output over the existing public directory for measurement."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--build", type=Path, required=True)
parser.add_argument("--public", type=Path, required=True)
parser.add_argument("--port", type=int, default=8091)
args = parser.parse_args()
roots = [args.build.resolve(), args.public.resolve()]


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).lstrip("/") or "index.html"
        for root in roots:
            candidate = (root / relative).resolve()
            if candidate.is_relative_to(root) and candidate.is_file():
                return str(candidate)
        return str(roots[0] / "__missing_baseline_file__")

    def do_GET(self):
        if urlsplit(self.path).path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(roots[0])))
print(f"Baseline server: http://127.0.0.1:{args.port}", flush=True)
server.serve_forever()
