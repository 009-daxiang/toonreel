#!/usr/bin/env python3
"""Import all dramas from the external drive into the site:
1. copy mp4 + cover.jpg into uploads/<drama-name>/
2. build data/catalog.json (67 shows, episodes sorted by number)
"""
import json
import os
import re
import shutil
import sys
import time

SRC = "/Volumes/NEWSMY 1"
DST_UPLOADS = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
CATALOG = "/Users/daxiang/.zcode/workspace/default/toonreel/data/catalog.json"

EP_RE = re.compile(r"第(\d+)集")

def ep_number(fn):
    m = EP_RE.search(fn)
    return int(m.group(1)) if m else 9999

shows = []
copied = 0
copied_bytes = 0
t0 = time.time()

names = sorted(n for n in os.listdir(SRC)
               if os.path.isdir(os.path.join(SRC, n)) and not n.startswith(('$', 'System')))

for idx, name in enumerate(names, 1):
    src_dir = os.path.join(SRC, name)
    files = [f for f in os.listdir(src_dir) if not f.startswith('.')]
    vids = sorted((f for f in files if f.lower().endswith('.mp4') and os.path.getsize(os.path.join(src_dir, f)) > 512 * 1024),
                  key=ep_number)
    if not vids:
        continue
    cover = next((f for f in files if f.lower() in ('cover.jpg', 'cover.png')), None)

    dst_dir = os.path.join(DST_UPLOADS, name)
    os.makedirs(dst_dir, exist_ok=True)

    videos = []
    for f in vids:
        dst = os.path.join(dst_dir, f)
        if not os.path.exists(dst):
            shutil.copy2(os.path.join(src_dir, f), dst)
        copied += 1
        copied_bytes += os.path.getsize(dst)
        videos.append(f"/uploads/{name}/{f}")
    if cover and not os.path.exists(os.path.join(dst_dir, cover)):
        shutil.copy2(os.path.join(src_dir, cover), os.path.join(dst_dir, cover))

    shows.append({
        "id": f"s{idx:03d}",
        "title": name,
        "tagline": "",
        "desc": "",
        "genres": ["短剧"],
        "episodes": len(vids),
        "rating": 9.0,
        "status": "Completed",
        "badge": "",
        "year": 2026,
        "popularity": (len(shows) + 1) * 10000,
        "poster": f"/uploads/{name}/{cover}" if cover else "",
        "videos": videos
    })
    print(f"[{idx}/{len(names)}] {name} — {len(vids)} eps, "
          f"{copied_bytes/1024**3:.1f} GB copied total", flush=True)

os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
with open(CATALOG, "w", encoding="utf-8") as f:
    json.dump({"shows": shows}, f, ensure_ascii=False, indent=1)

mins = (time.time() - t0) / 60
print(f"\nDONE: {len(shows)} shows, {copied} files, "
      f"{copied_bytes/1024**3:.1f} GB in {mins:.0f} min")
PYEOF
