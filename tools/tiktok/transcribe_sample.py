#!/usr/bin/env python3
"""YT688 TikTok clip pipeline — step 1: transcribe sampled episodes.
Usage: python3 transcribe_sample.py <drama_folder_name> [<drama2> ...]
Rerun-safe: skips episodes whose transcript JSON already exists."""
import json
import os
import re
import sys
import time

from faster_whisper import WhisperModel

BASE = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcripts")

MODEL = WhisperModel("small", device="cpu", compute_type="int8")

def transcribe(drama):
    sample_file = os.path.join(OUT, f"{drama}.sample.json")
    eps = json.load(open(sample_file))
    drama_out = os.path.join(OUT, drama)
    os.makedirs(drama_out, exist_ok=True)
    for f in eps:
        ep = re.search(r"第(\d+)集", f).group(1)
        out_json = os.path.join(drama_out, f"ep{int(ep):04d}.json")
        if os.path.exists(out_json):
            print(f"  skip ep{ep} (done)", flush=True)
            continue
        src = os.path.join(BASE, drama, f)
        t0 = time.time()
        segments, info = MODEL.transcribe(
            src, language="zh", beam_size=5,
            vad_filter=True, vad_parameters={"min_silence_duration_ms": 400},
        )
        segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
                for s in segments]
        json.dump({"file": f, "ep": int(ep), "duration": round(info.duration, 1),
                   "segments": segs},
                  open(out_json, "w"), ensure_ascii=False)
        print(f"  ep{ep}: {len(segs)} segs in {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    for drama in sys.argv[1:]:
        print(f"== {drama} ==", flush=True)
        transcribe(drama)
    print("ALL DONE", flush=True)
