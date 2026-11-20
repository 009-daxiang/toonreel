#!/usr/bin/env python3
"""Render 9 dramas' EP2+EP3 (full) with English subtitles burned in, for YouTube upload.
Same pipeline as render_ep1_youtube.py; output goes into the same Desktop folder.
Input : subtitles/{id}/ep{2,3}.en.vtt
        uploads/{drama}/{drama}-第N集.mp4
Output: ~/Desktop/YT688_YouTube_EP1英文版/{NN}-{EnName}-EP{N}-FULL.mp4
"""
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
SUBT = os.path.join(ROOT, 'subtitles')
SRC = os.path.join(ROOT, 'uploads')
FF = os.path.expanduser('~/bin/ffmpeg')
OUT = os.path.expanduser('~/Desktop/YT688_YouTube_EP1英文版')
W, H = 720, 1280

DRAMAS = [  # (show_id, drama_folder, en_name, upload_order)
    ('u06', '摊牌了我真的有系统', 'I-Have-a-System', 1),
    ('u05', '鲨口逃生', 'Shark-Escape', 2),
    ('u02', '一身腱子肉，乱世做谋臣', 'Muscle-Strategist', 3),
    ('u01', '东北异事之出马诡堂', 'Northeast-Spirit-Altar', 4),
    ('u04', '蚀骨罪', 'Bone-Deep-Sin', 5),
    ('u08', '永冬之下，冻土之上', 'The-Eternal-Winter', 6),
    ('u07', '退役归来，这个保镖不好惹', 'The-Retired-Bodyguard', 7),
    ('u09', '重生！丑小鸭逆袭成了万人迷', 'Reborn-Ugly-Duckling', 8),
    ('u03', '乌鸦掉进凤凰窝，我成了冥凤小公主', 'Crow-in-the-Phoenix-Nest', 9),
]

def parse_vtt(path):
    txt = open(path).read()
    cues = []
    for m in re.finditer(r'(\d{2}:\d{2}:\d{2}[.,]\d{3}) --> (\d{2}:\d{2}:\d{2}[.,]\d{3})\n(.*?)(?:\n\n|\n*$)', txt, re.S):
        s, e, text = m.group(1), m.group(2), m.group(3).strip().replace('\n', '\\N')
        def ts(v):
            h, mi, rest = v.split(':')
            return int(h) * 3600 + int(mi) * 60 + float(rest.replace(',', '.'))
        cues.append((ts(s), ts(e), text))
    return cues

def ts_ass(sec):
    h = int(sec // 3600); m = int(sec % 3600 // 60); s = sec % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def detect_band(src, t):
    """Sample a frame, find burned-sub band rows; reuse simple white-row scan."""
    import numpy as np
    from PIL import Image
    png = f'/tmp/ep23band_{os.getpid()}.png'
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', src,
                    '-frames:v', '1', '-vf',
                    f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1',
                    '-y', png], check=True)
    img = np.asarray(Image.open(png).convert('RGB'), dtype=np.uint8)
    os.remove(png)
    region = img[750:1270, 120:600]
    white = ((region > 215).all(axis=2)).sum(axis=1)
    rows = white > 45
    if not rows.any():
        return None
    ys = np.where(rows)[0] + 750
    bands, start = [], ys[0]
    for a, b in zip(ys, ys[1:]):
        if b - a > 40:
            bands.append((start, a)); start = b
    bands.append((start, ys[-1]))
    bands = [b for b in bands if 12 <= b[1] - b[0] <= 200]
    if not bands:
        return None
    return max(bands, key=lambda b: b[1] - b[0])

def margin_for(src, dur):
    """Sample several frames; if the burned zh band ever reaches the bottom zone,
    park EN subs at the upper safe position (510) — a single-frame sample
    defaulted to 170 and collided with zh subs that only appear later."""
    max_bot = None
    for t in (20, 40, 60, 80, 100):
        if t >= dur - 2:
            break
        try:
            band = detect_band(src, t)
        except Exception:
            continue  # frame extraction can fail near EOF; treat as no band
        if band is None:
            continue
        bot = band[1]
        if bot >= 1000:
            return 510
        max_bot = bot if max_bot is None else max(max_bot, bot)
    if max_bot is None:
        return 170
    return max(60, min(H - int(max_bot + 95), 1150))

ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Helvetica Neue,34,&H00FFFFFF,&H000000FF,&H00000000,&H50000000,-1,0,0,0,100,100,0,0,3,2.5,1,2,30,30,%d,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def render(sid, drama, en, order, ep):
    vtt = os.path.join(SUBT, sid, f'ep{ep}.en.vtt')
    src = os.path.join(SRC, drama, f'{drama}-第{ep}集.mp4')
    out = os.path.join(OUT, f'{order:02d}-{en}-EP{ep}-FULL.mp4')
    if os.path.exists(out):
        print(f'skip {out} (done)', flush=True)
        return
    if not os.path.exists(vtt):
        print(f'MISS {vtt}', flush=True)
        return
    cues = parse_vtt(vtt)
    dur = max((s for s, _, _ in cues), default=60) + 5
    margin = margin_for(src, dur)
    ass = ASS_HEAD % margin
    for s, e, text in cues:
        if e - s < 0.5:
            continue
        text = text.replace('{', '').replace('}', '')
        ass += f'Dialogue: 0,{ts_ass(s)},{ts_ass(e)},Sub,,0,0,0,,{text}\n'
    ass_path = f'/tmp/ep{ep}_{sid}.ass'
    open(ass_path, 'w').write(ass)
    vf = (f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},'
          f"setsar=1,ass='{ass_path}'")
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error',
                    '-i', src, '-vf', vf,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
                    '-y', out], check=True)
    size = os.path.getsize(out) // 1024 // 1024
    print(f'done {out} ({size}MB, margin={margin}, cues={len(cues)})', flush=True)

def main():
    os.makedirs(OUT, exist_ok=True)
    for sid, drama, en, order in DRAMAS:
        for ep in (2, 3):
            render(sid, drama, en, order, ep)
    print('ALL DONE', flush=True)

if __name__ == '__main__':
    main()
