"""Dev server for the game.

- Serves this folder with caching disabled, so the browser always loads the latest JavaScript.
- Hosts a tiny WebSocket relay at /ws for online battles: one player creates a room and gets
  a 4-letter code, the other joins with it, and the server forwards messages between them.

Usage: python3 serve.py [port]   (default port 8000)
"""
import base64
import hashlib
import http.server
import json
import os
import random
import string
import struct
import sys
import threading

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
ROOMS = {}  # room code -> list of WSClient
ROOMS_LOCK = threading.Lock()


class WSClient:
    """Minimal RFC 6455 text-frame WebSocket connection on top of the handler's streams."""

    def __init__(self, rfile, wfile):
        self.rfile, self.wfile = rfile, wfile
        self.write_lock = threading.Lock()
        self.room = None
        self.peer = None

    def _frame(self, opcode, data):
        header = bytearray([0x80 | opcode])
        n = len(data)
        if n < 126:
            header.append(n)
        elif n < 65536:
            header.append(126)
            header += struct.pack(">H", n)
        else:
            header.append(127)
            header += struct.pack(">Q", n)
        with self.write_lock:
            try:
                self.wfile.write(bytes(header) + data)
                self.wfile.flush()
            except OSError:
                pass

    def send(self, obj):
        self._frame(0x1, json.dumps(obj).encode())

    def send_raw(self, text):
        self._frame(0x1, text.encode())

    def recv(self):
        """Returns the next text message, or None when the connection closes."""
        while True:
            head = self.rfile.read(2)
            if len(head) < 2:
                return None
            opcode, length = head[0] & 0x0F, head[1] & 0x7F
            if length == 126:
                length = struct.unpack(">H", self.rfile.read(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self.rfile.read(8))[0]
            mask = self.rfile.read(4) if head[1] & 0x80 else b""
            data = bytearray(self.rfile.read(length))
            if mask:
                for i in range(length):
                    data[i] ^= mask[i % 4]
            if opcode == 0x8:
                return None
            if opcode == 0x9:
                self._frame(0xA, bytes(data))
                continue
            if opcode in (0x0, 0x1, 0x2):
                return data.decode("utf-8", "replace")


def new_code():
    while True:
        code = "".join(random.choice(string.ascii_uppercase) for _ in range(4))
        if code not in ROOMS:
            return code


def handle_message(client, text):
    try:
        msg = json.loads(text)
    except ValueError:
        return
    kind = msg.get("t")
    if kind == "create":
        with ROOMS_LOCK:
            code = new_code()
            ROOMS[code] = [client]
            client.room = code
        client.send({"t": "room", "code": code})
    elif kind == "join":
        code = str(msg.get("code", "")).upper().strip()
        with ROOMS_LOCK:
            room = ROOMS.get(code)
            ok = room is not None and len(room) == 1 and room[0] is not client
            if ok:
                host = room[0]
                room.append(client)
                client.room = code
                host.peer, client.peer = client, host
        if not ok:
            client.send({"t": "error", "msg": f"Room {code or '?'} not found or already full."})
            return
        host.send({"t": "start", "role": "host", "code": code})
        client.send({"t": "start", "role": "guest", "code": code})
    elif client.peer is not None:
        client.peer.send_raw(text)


def leave(client):
    with ROOMS_LOCK:
        room = ROOMS.pop(client.room, None) if client.room else None
    if client.peer is not None:
        client.peer.send({"t": "left"})
        client.peer.peer = None
        client.peer.room = None
    return room


class GameHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/ws") and self.headers.get("Upgrade", "").lower() == "websocket":
            self.serve_websocket()
        else:
            super().do_GET()

    def serve_websocket(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        self.close_connection = True
        client = WSClient(self.rfile, self.wfile)
        try:
            while True:
                text = client.recv()
                if text is None:
                    break
                handle_message(client, text)
        except OSError:
            pass
        finally:
            leave(client)

    def log_message(self, fmt, *args):
        if "/ws" not in (self.path or ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://localhost:{port} (caching disabled, online relay at /ws)")
    http.server.ThreadingHTTPServer(("", port), GameHandler).serve_forever()
