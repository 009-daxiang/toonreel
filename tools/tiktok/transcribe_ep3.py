#!/usr/bin/env python3
"""YT688 — transcribe EP3 of all 9 published dramas (for YouTube 3-ep batch).
Same model/format as transcribe_sample.py; skips already-done episodes."""
import json
import os
import re
import time

from faster_whisper import WhisperModel

BASE = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcripts")

DRAMAS = [
    '摊牌了我真的有系统',
    '鲨口逃生',
    '一身腱子肉，乱世做谋臣',
    '东北异事之出马诡堂',
    '蚀骨罪',
    '永冬之下，冻土之上',
    '退役归来，这个保镖不好惹',
    '重生！丑小鸭逆袭成了万人迷',
    '乌鸦掉进凤凰窝，我成了冥凤小公主',
]

MODEL = WhisperModel("small", device="cpu", compute_type="int8")

for drama in DRAMAS:
    print(f"== {drama} ==", flush=True)
    out_json = os.path.join(OUT, drama, "ep0003.json")
    if os.path.exists(out_json):
        print("  skip ep3 (done)", flush=True)
        continue
    src = os.path.join(BASE, drama, f"{drama}-第3集.mp4")
    t0 = time.time()
    segments, info = MODEL.transcribe(
        src, language="zh", beam_size=5,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 400},
    )
    segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments]
    json.dump({"file": f"{drama}-第3集.mp4", "ep": 3, "duration": round(info.duration, 1),
               "segments": segs},
              open(out_json, "w"), ensure_ascii=False)
    print(f"  ep3: {len(segs)} segs in {time.time()-t0:.0f}s", flush=True)
print("ALL DONE", flush=True)
