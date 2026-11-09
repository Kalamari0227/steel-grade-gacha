from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import re

review = Path(__file__).resolve().parent
public = review.parent / "public"

class Preview(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        name = urlsplit(path).path.lstrip("/")
        if name in ("", "index.html", "preview.mjs"):
            return str(review / (name or "index.html"))
        if name in ("prototype.css", "reveal.mjs", "ui.mjs", "data.json") or re.fullmatch(r"art/[0-9a-f]{64}\.(?:png|webp|jpg)", name) or re.fullmatch(r"audio/draw\.(?:latch|seal|reveal|result|rare-tuning)\.wav", name):
            return str(public / name)
        return str(review / ".unavailable")

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8781), partial(Preview, directory=str(review))).serve_forever()
