"""Live browser preview for Highway Dash.

Runs the pygame game headlessly and streams it to your browser as MJPEG
video on port 8080; keyboard / touch input from the page drives the game.

Run:
    python web_server.py
Then open http://localhost:8080 (or the sandbox preview URL for port 8080).
"""

import io
import json
import os
import queue
import struct
import threading
import time
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame  # noqa: E402

from main import Game, PLAYING  # noqa: E402

PORT = int(os.environ.get("PORT", "8080"))

game = Game()  # single shared game session for all viewers

# ---- input plumbing between the HTTP thread and the game thread -----------
event_queue = queue.Queue()          # one-shot KEYDOWN events (e.g. SPACE)
held_lock = threading.Lock()
held = set()                         # pygame key constants currently held down

KEY_NAMES = {
    "left": pygame.K_LEFT,
    "right": pygame.K_RIGHT,
    "up": pygame.K_UP,
    "down": pygame.K_DOWN,
    "a": pygame.K_a,
    "d": pygame.K_d,
    "w": pygame.K_w,
    "s": pygame.K_s,
    "space": pygame.K_SPACE,
}


class HeldKeys:
    """Duck-types pygame.key.get_pressed() result for web input."""

    def __getitem__(self, key):
        with held_lock:
            return key in held


# ---- frame capture ----------------------------------------------------------
frame_lock = threading.Lock()
latest = {"data": b"", "ctype": "image/jpeg", "no": 0}

try:
    from PIL import Image
    _HAVE_PIL = True
except ImportError:
    _HAVE_PIL = False


def _png_encode(rgb, w, h):
    """Tiny stdlib PNG encoder (fallback when Pillow is missing)."""
    stride = w * 3
    raw = b"".join(b"\x00" + rgb[y * stride:(y + 1) * stride] for y in range(h))

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def game_loop():
    """Owns ALL pygame calls: logic, drawing, and frame encoding."""
    clock = pygame.time.Clock()
    while True:
        # Drain browser events on this (the pygame) thread.
        while True:
            try:
                pygame.event.post(event_queue.get_nowait())
            except queue.Empty:
                break

        game.handle_events()
        if game.state == PLAYING:
            game.update_playing(HeldKeys())
        else:
            game.road.update(2.0)
        game.draw()

        w, h = game.screen.get_size()
        rgb = pygame.image.tobytes(game.screen, "RGB")
        if _HAVE_PIL:
            buf = io.BytesIO()
            Image.frombytes("RGB", (w, h), rgb).save(buf, "JPEG", quality=82)
            data, ctype = buf.getvalue(), "image/jpeg"
        else:
            data, ctype = _png_encode(rgb, w, h), "image/png"

        with frame_lock:
            latest["data"] = data
            latest["ctype"] = ctype
            latest["no"] += 1
        clock.tick(30)


PAGE = b"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>Car Racer &mdash; Highway Dash (live)</title>
<style>
  body { margin:0; background:#14141c; color:#eee; font-family:system-ui,sans-serif;
         display:flex; flex-direction:column; align-items:center; gap:10px; padding:12px; }
  h1 { font-size:20px; margin:4px 0 0; color:#ffc83c; }
  #view { width:min(480px, 96vw); border:2px solid #333; border-radius:8px;
          background:#000; image-rendering:pixelated; touch-action:none; }
  #pad { display:grid; grid-template-columns:repeat(4, 72px); gap:8px; }
  #pad button { font-size:22px; padding:14px 0; border:0; border-radius:10px;
                background:#2a2a36; color:#eee; touch-action:none; user-select:none; }
  #pad button:active { background:#ffc83c; color:#14141c; }
  #start { padding:10px 34px; border:0; border-radius:10px; background:#ffc83c;
           color:#14141c; font-weight:700; font-size:16px; }
  .hint { font-size:12px; color:#9a9aa8; }
</style>
</head>
<body>
  <h1>&#127950;&#65039; Car Racer &mdash; Highway Dash</h1>
  <img id="view" src="/stream" alt="game video">
  <button id="start">START / RESTART (space)</button>
  <div id="pad">
    <button data-k="left">&#9664;</button>
    <button data-k="up">&#9650;</button>
    <button data-k="down">&#9660;</button>
    <button data-k="right">&#9654;</button>
  </div>
  <p class="hint">Keyboard: arrows / WASD to drive &middot; SPACE to start &middot;
     shared single game session</p>
<script>
const map = {ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right",
             D:"right", ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down",
             S:"down", " ":"space"};
function send(name, down){
  fetch("/key", {method:"POST", keepalive:true,
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name, down})});
}
addEventListener("keydown", e => { const n = map[e.key];
  if (n){ e.preventDefault(); if (!e.repeat) send(n, true); } });
addEventListener("keyup", e => { const n = map[e.key];
  if (n){ e.preventDefault(); send(n, false); } });
document.querySelectorAll("[data-k]").forEach(b => {
  const n = b.dataset.k;
  const on  = e => { e.preventDefault(); send(n, true);  };
  const off = e => { e.preventDefault(); send(n, false); };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointerleave", off);
  b.addEventListener("pointercancel", off);
});
document.getElementById("start").addEventListener("pointerdown", e => {
  e.preventDefault(); send("space", true); setTimeout(() => send("space", false), 80);
});
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(PAGE)))
            self.end_headers()
            self.wfile.write(PAGE)
        elif self.path.startswith("/frame"):
            with frame_lock:
                data, ctype = latest["data"], latest["ctype"]
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path.startswith("/stream"):
            self.send_response(200)
            self.send_header(
                "Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            last = -1
            try:
                while True:
                    with frame_lock:
                        data, ctype, no = (latest["data"], latest["ctype"],
                                           latest["no"])
                    if no != last and data:
                        self.wfile.write(
                            b"--frame\r\nContent-Type: " + ctype.encode()
                            + b"\r\nContent-Length: " + str(len(data)).encode()
                            + b"\r\n\r\n" + data + b"\r\n")
                        last = no
                    time.sleep(0.01)
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/key":
            self.send_error(404)
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            key = KEY_NAMES.get(body.get("name"))
            down = bool(body.get("down"))
            if key is not None:
                if key == pygame.K_SPACE:
                    if down:  # one-shot: start / restart
                        event_queue.put(pygame.event.Event(
                            pygame.KEYDOWN, key=pygame.K_SPACE))
                else:
                    with held_lock:
                        held.add(key) if down else held.discard(key)
        except (ValueError, KeyError):
            pass
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):  # keep the server log quiet
        pass


def main():
    threading.Thread(target=game_loop, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print(f"Car Racer live at http://0.0.0.0:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
