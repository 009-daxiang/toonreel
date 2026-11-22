#!/usr/bin/env python3
"""YT688 — transcribe EP1-EP10 of every catalog drama (4-language SEA subtitle push).
Skips transcripts that already exist. Same model/config as other pipeline steps."""
import json, os, time
from faster_whisper import WhisperModel

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
BASE = f'{ROOT}/uploads'
OUT = f'{ROOT}/tools/tiktok/transcripts'
cat = json.load(open(f'{ROOT}/data/catalog.json'))
ID_BY_TITLE = {s['title']: s['id'] for s in cat['shows']}
ALIAS = {'摊牌了我真的有系统': 'u06'}

MODEL = WhisperModel("small", device="cpu", compute_type="int8")

jobs = []
for s in cat['shows']:
    sid, title = s['id'], s['title']
    drama_dir = title if os.path.isdir(f'{BASE}/{title}') else next(
        (k for k, v in ALIAS.items() if v == sid), None)
    if not drama_dir or not os.path.isdir(f'{BASE}/{drama_dir}'):
        print(f'skip {sid}: source folder not found', flush=True)
        continue
    for ep in range(1, 11):
        out_json = os.path.join(OUT, drama_dir, f'ep{ep:04d}.json')
        if not os.path.exists(f'{BASE}/{drama_dir}/{drama_dir}-第{ep}集.mp4'):
            print(f'skip {drama_dir} ep{ep}: no source file', flush=True)
            continue
        if os.path.exists(out_json):
            continue
        jobs.append((drama_dir, ep, src := os.path.join(BASE, drama_dir, f'{drama_dir}-第{ep}集.mp4'), out_json))

print(f'待转写: {len(jobs)} 集', flush=True)
t0 = time.time()
for i, (drama, ep, src, out_json) in enumerate(jobs, 1):
    try:
        segs_iter, info = MODEL.transcribe(src, language='zh', beam_size=5,
                                           vad_filter=True, vad_parameters={'min_silence_duration_ms': 400})
        segs = [{'start': round(x.start, 2), 'end': round(x.end, 2), 'text': x.text.strip()}
                for x in segs_iter]
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump({'file': os.path.basename(src), 'ep': ep, 'duration': round(info.duration, 1),
                   'segments': segs}, open(out_json, 'w'), ensure_ascii=False)
        print(f'[{i}/{len(jobs)}] {drama} ep{ep}: {len(segs)} segs, {time.time()-t0:.0f}s elapsed', flush=True)
    except Exception as e:
        print(f'[{i}/{len(jobs)}] FAIL {drama} ep{ep}: {str(e)[:80]}', flush=True)
print(f'ALL DONE in {time.time()-t0:.0f}s', flush=True)
