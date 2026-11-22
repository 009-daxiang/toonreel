#!/usr/bin/env python3
"""I Have a SYSTEM EP12-75 — blur-pad landscape->vertical render (720x1280, no HD upgrade).
Full picture preserved; subtitles sit inside the picture strip; end-card centered."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_ep23_youtube as R

SRC = '/Users/daxiang/.zcode/workspace/default/toonreel/uploads/摊牌了我真的有系统'
OUT = os.path.expanduser('~/Desktop/YT688引流_I-Have-a-System/视频-烧录英字')
W, H = R.W, R.H
SRC_W, SRC_H = 1924, 1080
STRIP_H = round(W / (SRC_W / SRC_H))          # ~404px
SUB_MV = H - (H - STRIP_H) // 2 - STRIP_H + 18

EPS = range(12, 76)
for ep in EPS:
    vtt = os.path.join(R.SUBT, 'u06', f'ep{ep}.en.vtt')
    src = os.path.join(SRC, f'摊牌了我真的有系统-第{ep}集.mp4')
    out = os.path.join(OUT, f'I-Have-a-System-EP{ep}-FULL.mp4')
    if not os.path.exists(vtt):
        print(f'MISS ep{ep}', flush=True); continue
    cues = R.parse_vtt(vtt)
    D = R.real_duration(src)
    ass = R.ASS_HEAD % SUB_MV
    for s, e, text in cues:
        if e - s < 0.5: continue
        text = text.replace('{', '').replace('}', '')
        ass += f'Dialogue: 0,{R.ts_ass(s)},{R.ts_ass(e)},Sub,,0,0,0,,{text}\n'
    ass_path = f'/tmp/ihas_ep{ep}.ass'
    open(ass_path, 'w').write(ass)
    fc = (f"[0:v]scale={W}:{STRIP_H}[vid];"
          f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=20:2[bg];"
          f"[bg][vid]overlay=(W-w)/2:(H-h)/2,"
          f"setsar=1,ass='{ass_path}'," + R.endcard_filter(D))
    subprocess.run([R.FF, '-hide_banner', '-loglevel', 'error', '-i', src,
                    '-filter_complex', fc,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', out], check=True)
    print(f'ep{ep}: {os.path.getsize(out)//1024//1024}MB strip={STRIP_H}px', flush=True)
print('ALL DONE', flush=True)
