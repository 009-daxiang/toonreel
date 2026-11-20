#!/usr/bin/env python3
"""YT688 — transcribe 摊牌了我真的有系统 EP4..EP75 (YouTube half-series funnel).
Same model/format as transcribe_sample.py; skips already-done episodes."""
import json
import os
import time

from faster_whisper import WhisperModel

BASE = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
DRAMA = "摊牌了我真的有系统"
OUT = "/Users/daxiang/.zcode/workspace/default/toonreel/tools/tiktok/transcripts"
EPS = range(4, 76)

MODEL = WhisperModel("small", device="cpu", compute_type="int8")

ddir = os.path.join(OUT, DRAMA)
os.makedirs(ddir, exist_ok=True)
t_all = time.time()
for ep in EPS:
    out_json = os.path.join(ddir, f"ep{ep:04d}.json")
    if os.path.exists(out_json):
        print(f"skip ep{ep} (done)", flush=True)
        continue
    src = os.path.join(BASE, DRAMA, f"{DRAMA}-第{ep}集.mp4")
    t0 = time.time()
    segments, info = MODEL.transcribe(
        src, language="zh", beam_size=5,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 400},
    )
    segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments]
    json.dump({"file": f"{DRAMA}-第{ep}集.mp4", "ep": ep, "duration": round(info.duration, 1),
               "segments": segs},
              open(out_json, "w"), ensure_ascii=False)
    print(f"ep{ep}: {len(segs)} segs, {info.duration:.0f}s media, {time.time()-t0:.0f}s wall", flush=True)
print(f"ALL DONE in {time.time()-t_all:.0f}s", flush=True)
