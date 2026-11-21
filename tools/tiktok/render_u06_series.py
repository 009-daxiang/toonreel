#!/usr/bin/env python3
"""YT688 — render 摊牌了我真的有系统 EP4..EP75 with burned EN subs (Shorts-ready).
Episodes longer than 3 min are cut at a subtitle-cue boundary under 177s.
Also writes EN SRT files. Output on Desktop in a dedicated funnel folder."""
import os
import re
import subprocess

import render_ep23_youtube as R

FF = R.FF
SID, DRAMA, EN = 'u06', '摊牌了我真的有系统', 'I-Have-a-System'
OUT = os.path.expanduser('~/Desktop/YT688引流_I-Have-a-System')
VID = os.path.join(OUT, '视频-烧录英字')
SRT = os.path.join(OUT, '字幕SRT-英文')
EPS = range(4, 76)
CUE_LIMIT = 176.0   # cut boundary ceiling; final file stays < 177s

def vtt_to_srt(cues, path):
    def ts(sec):
        h = int(sec // 3600); m = int(sec % 3600 // 60); s = sec % 60
        return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    body = ['WEB-SRT']
    body = []
    for i, (s, e, t) in enumerate(cues, 1):
        t = t.replace('\\N', ' ')
        body += [str(i), f'{ts(s)} --> {ts(e)}', t, '']
    open(path, 'w').write('\n'.join(body))

def render_ep(ep):
    vtt = os.path.join(R.SUBT, SID, f'ep{ep}.en.vtt')
    if not os.path.exists(vtt):
        print(f'MISS ep{ep}: {vtt}', flush=True)
        return
    src = os.path.join(R.SRC, DRAMA, f'{DRAMA}-第{ep}集.mp4')
    out = os.path.join(VID, f'{EN}-EP{ep:02d}-FULL.mp4')
    if os.path.exists(out):
        print(f'skip ep{ep} (done)', flush=True)
        return
    cues = R.parse_vtt(vtt)
    est = max((e for _, e, _ in cues), default=60) + 5
    cut = None
    if est > 178:
        ends = [e for _, e, _ in cues if e <= CUE_LIMIT]
        cut = max(ends) if ends else CUE_LIMIT
    use = cut if cut else R.real_duration(src)
    margin = R.margin_for(src, min(use, 170))
    ass = R.ASS_HEAD % margin
    kept = 0
    for s, e, text in cues:
        if cut and e > cut:
            continue
        if e - s < 0.5:
            continue
        text = text.replace('{', '').replace('}', '')
        ass += f'Dialogue: 0,{R.ts_ass(s)},{R.ts_ass(e)},Sub,,0,0,0,,{text}\n'
        kept += 1
    ass_path = f'/tmp/u06_ep{ep}.ass'
    open(ass_path, 'w').write(ass)
    vf = (f'scale={R.W}:{R.H}:force_original_aspect_ratio=increase,crop={R.W}:{R.H},'
          f"setsar=1,ass='{ass_path}'," + R.endcard_filter(use))
    cmd = [FF, '-hide_banner', '-loglevel', 'error', '-i', src, '-vf', vf]
    if cut:
        cmd += ['-t', str(cut)]
    cmd += ['-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', out]
    subprocess.run(cmd, check=True)
    vtt_to_srt([c for c in cues if not (cut and c[1] > cut)],
               os.path.join(SRT, f'{EN}-EP{ep:02d}-EN.srt'))
    print(f'ep{ep}: {"cut@" + str(round(cut, 1)) + "s" if cut else "full"} '
          f'({os.path.getsize(out)//1024//1024}MB, margin={margin}, cues={kept})', flush=True)

def main():
    os.makedirs(VID, exist_ok=True)
    os.makedirs(SRT, exist_ok=True)
    for ep in EPS:
        try:
            render_ep(ep)
        except Exception as e:
            print(f'FAIL ep{ep}: {e}', flush=True)
    print('ALL DONE', flush=True)

if __name__ == '__main__':
    main()
