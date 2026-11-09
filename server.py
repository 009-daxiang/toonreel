#!/usr/bin/env python3
# ============================================================
#  ToonReel — optional zero-dependency backend (Python variant)
#  Same endpoints as server.js (Node). Use EITHER one.
#
#    python3 server.py          (PORT env optional, default 3000)
#
#  Endpoints:
#    GET  /api/health            capability probe for admin.html
#    POST /api/upload            multipart video upload -> /uploads
#    GET  /api/catalog           read data/catalog.json
#    POST /api/catalog           publish catalog (admin "Publish")
#    POST /api/payments/checkout payment entry point (stub — see below)
#    POST /api/payments/webhook  provider callback receiver (stub)
#    Everything else is served statically (index/watch/admin pages).
#
#  Going live with Stripe: implement the two marked TODOs
#  (create a Checkout Session; credit coins in the webhook handler).
# ============================================================

import hashlib
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
UPLOAD_DIR = os.path.join(ROOT, "uploads")
CATALOG_FILE = os.path.join(DATA_DIR, "catalog.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
ANALYTICS_FILE = os.path.join(DATA_DIR, "analytics.jsonl")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Admin credentials for the management panel.
# Override with env vars:  ADMIN_USER=xx ADMIN_PASS=yy python3 server.py
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "toonreel2026")
SESSION_TOKENS = set()  # in-memory; restart invalidates sessions

MIME = {
    ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4",
    ".ico": "image/x-icon",
}


def parse_multipart(body: bytes, content_type: str):
    """Minimal multipart/form-data parser -> (fields, files)."""
    m = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type or "", re.I)
    if not m:
        raise ValueError("no boundary")
    boundary = ("--" + (m.group(1) or m.group(2))).encode()
    fields, files = {}, []
    for part in body.split(boundary):
        part = part.strip(b"\r\n\x00-")
        head_end = part.find(b"\r\n\r\n")
        if head_end == -1 or len(part) == 0:
            continue
        head = part[:head_end].decode("utf-8", "replace")
        payload = part[head_end + 4:]
        name_m = re.search(r'name="([^"]*)"', head)
        if not name_m:
            continue
        file_m = re.search(r'filename="([^"]*)"', head)
        if file_m:
            files.append({"name": name_m.group(1), "filename": file_m.group(1) or "file.bin",
                          "data": payload})
        else:
            fields[name_m.group(1)] = payload.decode("utf-8", "replace")
    return fields, files


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---------- helpers ----------
    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self, limit=512 * 1024 * 1024) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            raise ValueError("body too large")
        return self.rfile.read(length)

    # ---------- user accounts ----------
    def _load_users(self):
        try:
            with open(USERS_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def api_register(self):
        try:
            data = json.loads(self._read_body(16 * 1024))
        except Exception:
            return self._send(400, {"error": "invalid json"})
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return self._send(400, {"error": "invalid email"})
        if len(password) < 6:
            return self._send(400, {"error": "password too short (min 6)"})
        users = self._load_users()
        if email in users:
            return self._send(409, {"error": "email already registered"})
        salt = os.urandom(8).hex()
        users[email] = {
            "salt": salt,
            "hash": hashlib.sha256((salt + password).encode()).hexdigest(),
            "created": time.strftime("%Y-%m-%d"),
            "visitor": data.get("visitor", ""),
        }
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=1, ensure_ascii=False)
        self._track_event("register", {"email": email})
        self._send(200, {"ok": True, "email": email})

    def api_user_login(self):
        try:
            data = json.loads(self._read_body(16 * 1024))
        except Exception:
            return self._send(400, {"error": "invalid json"})
        email = (data.get("email") or "").strip().lower()
        users = self._load_users()
        u = users.get(email)
        if not u or u["hash"] != hashlib.sha256((u["salt"] + (data.get("password") or "")).encode()).hexdigest():
            return self._send(401, {"error": "wrong email or password"})
        self._send(200, {"ok": True, "email": email})

    # ---------- analytics ----------
    def _visitor_id(self):
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0]
        day = time.strftime("%Y%m%d")
        return hashlib.sha256((ip + "|" + day).encode()).hexdigest()[:16]

    def _track_event(self, event, extra=None):
        rec = {"t": int(time.time()), "date": time.strftime("%Y-%m-%d"),
               "v": self._visitor_id(), "e": event, "lang": self.headers.get("X-Lang", "")}
        if extra:
            rec.update(extra)
        with open(ANALYTICS_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def api_track(self):
        try:
            data = json.loads(self._read_body(4 * 1024))
        except Exception:
            return self._send(204, "")
        event = data.get("e")
        allowed = {"visit", "play", "complete"}
        if event not in allowed:
            return self._send(400, {"error": "bad event"})
        extra = {k: data[k] for k in ("show", "ep", "page") if k in data}
        self._track_event(event, extra)
        self._send(204, "")

    def api_stats(self):
        if not self._authorized():
            return self._deny()
        today = time.strftime("%Y-%m-%d")
        days = {}
        plays = {}
        visitors = set()
        visitors_today = set()
        pv_today = 0
        registers = 0
        try:
            with open(ANALYTICS_FILE, encoding="utf-8") as f:
                for line in f:
                    try:
                        r = json.loads(line)
                    except Exception:
                        continue
                    d = r.get("date", "")
                    days[d] = days.get(d, 0) + 1
                    visitors.add(r.get("v"))
                    if r.get("e") == "visit":
                        pv_today += d == today
                    if d == today:
                        visitors_today.add(r.get("v"))
                    if r.get("e") == "play" and r.get("show"):
                        key = r["show"]
                        plays[key] = plays.get(key, 0) + 1
                    if r.get("e") == "register":
                        registers += 1
        except FileNotFoundError:
            pass
        trend = [{"date": d, "events": days[d]} for d in sorted(days)[-7:]]
        top = sorted(plays.items(), key=lambda kv: -kv[1])[:10]
        users = self._load_users()
        self._send(200, {
            "today": {"visitors": len(visitors_today), "pageviews": pv_today},
            "totals": {"visitors": len(visitors), "plays": sum(plays.values()), "registers": registers},
            "topShows": [{"show": k, "plays": v} for k, v in top],
            "trend": trend,
        })

    # ---------- admin auth ----------
    def api_login(self):
        try:
            data = json.loads(self._read_body(64 * 1024))
        except Exception:
            return self._send(400, {"error": "invalid json"})
        if data.get("user") == ADMIN_USER and data.get("pass") == ADMIN_PASS:
            token = os.urandom(24).hex()
            SESSION_TOKENS.add(token)
            self._send(200, {"ok": True, "token": token})
        else:
            self._send(401, {"error": "wrong username or password"})

    def _authorized(self) -> bool:
        auth = self.headers.get("Authorization") or ""
        return auth.replace("Bearer ", "") in SESSION_TOKENS

    def _deny(self):
        self._send(401, {"error": "unauthorized — log in at /admin.html"})

    # ---------- API ----------
    def api_health(self):
        self._send(200, {"ok": True, "api": True, "uploads": True, "auth": True})

    def api_app_info(self):
        """Package info for download.html. Conventions in /downloads:
        toonreel.apk (Android), toonreel.ipa (iOS), toonreel-mac.zip/dmg,
        toonreel-setup.exe or toonreel-win.zip (Windows)."""
        out = {"apk": None, "ipa": None, "mac": None, "win": None}
        patterns = {
            "apk": re.compile(r"\.apk$", re.I),
            "ipa": re.compile(r"\.ipa$", re.I),
            "mac": re.compile(r"-mac\.(zip|dmg)$", re.I),
            "win": re.compile(r"(-setup\.exe|-win\.(exe|zip))$", re.I),
        }
        try:
            for f in sorted(os.listdir(os.path.join(ROOT, "downloads"))):
                full = os.path.join(ROOT, "downloads", f)
                st = os.stat(full)
                vm = re.search(r"-(\d+\.\d+(?:\.\d+)?)\.(?:apk|zip|dmg|exe)$", f, re.I)
                for slot, pat in patterns.items():
                    if pat.search(f):
                        out[slot] = {"available": True, "file": f,
                                     "url": "/downloads/" + f, "size": st.st_size,
                                     "version": vm.group(1) if vm else None}
                        break
        except OSError:
            pass
        self._send(200, out)

    def api_upload(self):
        if not self._authorized():
            return self._deny()
        if int(self.headers.get("Content-Length") or 0) > 512 * 1024 * 1024:
            return self._send(413, {"error": "file too large (max 512MB)"})
        body = self._read_body()
        _, files = parse_multipart(body, self.headers.get("Content-Type", ""))
        file = next((f for f in files if f["name"] == "file"), files[0] if files else None)
        if not file:
            return self._send(400, {"error": "no file"})
        ext = os.path.splitext(file["filename"])[1].lower() or ".mp4"
        if ext not in (".mp4", ".webm", ".mov", ".m4v"):
            return self._send(400, {"error": f"unsupported file type {ext}"})
        name = format(int(time.time() * 1000), "x") + "-" + os.urandom(4).hex() + ext
        with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
            f.write(file["data"])
        self._send(200, {"ok": True, "url": f"/uploads/{name}"})

    def api_catalog_get(self):
        if os.path.exists(CATALOG_FILE):
            with open(CATALOG_FILE, "rb") as f:
                self._send(200, json.loads(f.read()))
        else:
            self._send(200, {"shows": []})

    def api_catalog_post(self):
        if not self._authorized():
            return self._deny()
        try:
            cat = json.loads(self._read_body(16 * 1024 * 1024))
        except Exception:
            return self._send(400, {"error": "invalid json"})
        if not isinstance(cat, dict) or not cat.get("shows"):
            return self._send(400, {"error": "catalog.shows must be a non-empty array"})
        with open(CATALOG_FILE, "w") as f:
            json.dump(cat, f, indent=2, ensure_ascii=False)
        self._send(200, {"ok": True, "shows": len(cat["shows"])})

    def api_checkout(self):
        # TODO (Stripe go-live):
        #   import stripe
        #   stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
        #   session = stripe.checkout.Session.create(
        #       mode="payment",
        #       line_items=[{"price": PRICE_IDS[package_id], "quantity": 1}],
        #       success_url=SITE_URL + "/watch.html?paid=1",
        #       cancel_url=SITE_URL,
        #       metadata={"packageId": package_id},
        #   )
        #   return self._send(200, {"url": session.url})
        body = self._read_body()
        try:
            data = json.loads(body)
        except Exception:
            data = {}
        print(f"[payments] checkout requested: package={data.get('packageId')} "
              f"provider={data.get('provider')}")
        self._send(200, {
            "error": "Payment provider not configured yet. Set provider='demo' on "
                     "the frontend, or implement /api/payments/checkout (see server.py)."
        })

    def api_webhook(self):
        raw = self._read_body(4 * 1024 * 1024)
        # TODO (Stripe go-live): verify signature, credit coins on
        # checkout.session.completed (see server.js for the same example).
        print("[payments] webhook received:", raw[:300])
        self._send(200, {"received": True})

    # ---------- static ----------
    def serve_static(self, path_only: str):
        p = path_only.split("?")[0]
        if p == "/":
            p = "/index.html"
        file = os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
        if not file.startswith(ROOT):
            return self._send(403, {"error": "forbidden"})
        if not os.path.isfile(file):
            return self._send(404, "404 Not Found", "text/plain")
        ctype = MIME.get(os.path.splitext(file)[1].lower(), "application/octet-stream")
        size = os.path.getsize(file)
        rng = self.headers.get("Range")
        if rng and ctype.startswith("video/"):
            m = re.search(r"bytes=(\d*)-(\d*)", rng)
            start = int(m.group(1)) if m and m.group(1) else 0
            end = int(m.group(2)) if m and m.group(2) else size - 1
            with open(file, "rb") as f:
                f.seek(start)
                data = f.read(end - start + 1)
            self.send_response(206)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        with open(file, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ---------- routing ----------
    def _route(self, method: str):
        path_only = self.path
        try:
            if path_only == "/api/login" and method == "POST":
                return self.api_login()
            if path_only == "/api/track" and method == "POST":
                return self.api_track()
            if path_only == "/api/register" and method == "POST":
                return self.api_register()
            if path_only == "/api/user/login" and method == "POST":
                return self.api_user_login()
            if path_only == "/api/stats" and method == "GET":
                return self.api_stats()
            if path_only == "/api/health" and method == "GET":
                return self.api_health()
            if path_only == "/api/app/info" and method == "GET":
                return self.api_app_info()
            if path_only == "/api/upload" and method == "POST":
                return self.api_upload()
            if path_only == "/api/catalog" and method == "GET":
                return self.api_catalog_get()
            if path_only == "/api/catalog" and method == "POST":
                return self.api_catalog_post()
            if path_only == "/api/payments/checkout" and method == "POST":
                return self.api_checkout()
            if path_only == "/api/payments/webhook" and method == "POST":
                return self.api_webhook()
            if path_only.startswith("/api/"):
                return self._send(404, {"error": "unknown endpoint"})
            if method == "GET":
                return self.serve_static(path_only)
            self._send(405, {"error": "method not allowed"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as err:  # noqa: BLE001
            print(f"[error] {method} {path_only}: {err}")
            try:
                self._send(500, {"error": str(err)})
            except Exception:
                pass

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def log_message(self, fmt, *args):  # quieter logs
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"\n  ToonReel server (Python) → http://localhost:{port}")
    print(f"  Admin:  http://localhost:{port}/admin.html  (API mode: instant publish & uploads)")
    print("  Payment stub: POST /api/payments/checkout  (implement for Stripe — see comments)\n")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
