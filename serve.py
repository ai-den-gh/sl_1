"""Dev server for the game: serves this folder with caching disabled,
so the browser always loads the latest JavaScript after an edit.

Usage: python3 serve.py [port]   (default port 8000)
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://localhost:{port} (caching disabled)")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
