#!/usr/bin/env python3
"""YT688 — 补齐转写为空的剧集：下载源视频 → faster-whisper 补转写 → 存 transcript JSON。
之后由 build_subtitles.py --lang=en 重建对应英文字幕。"""
import json, os, re, subprocess, sys, time, urllib.request

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
TRANS = f'{ROOT}/tools/tiktok/transcripts'
TMP = '/tmp/yt688_fix'
os.makedirs(TMP, exist_ok=True)

from faster_whisper import WhisperModel
MODEL = WhisperModel("small", device="cpu", compute_type="int8")

cat = json.load(open(f'{ROOT}/data/catalog.json'))
jobs = []
for s in cat['shows']:
    sid, eps = s['id'], s['episodes']
    m = re.match(r'/uploads/([^/]+)/', s.get('poster', ''))
    if not m:
        continue
    zh = m.group(1)
    d = f'{ROOT}/subtitles/{sid}'
    en = {int(f[2:-7]) for f in os.listdir(d) if f.endswith('.en.vtt')} if os.path.isdir(d) else set()
    for ep in range(1, eps + 1):
        if ep in en:
            continue
        tdir = os.path.join(TRANS, zh)
        tj = os.path.join(tdir, f'ep{ep:04d}.json')
        segs = 0
        if os.path.exists(tj):
            try:
                segs = len(json.load(open(tj)).get('segments', []))
            except Exception:
                segs = 0
        if segs == 0:  # 转写为空才需要补
            url = s['videos'][ep - 1] if ep - 1 < len(s['videos']) else None
            if url:
                jobs.append((sid, zh, ep, url, tj))

print(f'待补转写: {len(jobs)} 集', flush=True)
for sid, zh, ep, url, tj in jobs:
    src = os.path.join(TMP, f'{sid}_ep{ep}.mp4')
    if not os.path.exists(src):
        try:
            subprocess.run(['curl', '-sL', '-o', src, url], check=True, timeout=300)
        except Exception as e:
            print(f'{sid} ep{ep}: 下载失败 {e}', flush=True)
            continue
    if os.path.getsize(src) < 100_000:
        print(f'{sid} ep{ep}: 视频文件异常({os.path.getsize(src)}B), 跳过', flush=True)
        continue
    print(f'{sid} ep{ep}: 转写中…', flush=True)
    t0 = time.time()
    segments, info = MODEL.transcribe(src, language='zh', beam_size=5,
                                      vad_filter=True, vad_parameters={'min_silence_duration_ms': 400})
    segs = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()}
            for s in segments]
    os.makedirs(os.path.dirname(tj), exist_ok=True)
    json.dump({'file': os.path.basename(url), 'ep': ep, 'duration': round(info.duration, 1),
               'segments': segs}, open(tj, 'w'), ensure_ascii=False)
    os.remove(src)
    print(f'  {len(segs)} segs in {time.time()-t0:.0f}s', flush=True)
print('TRANSCRIBE-FIX-DONE', flush=True)
