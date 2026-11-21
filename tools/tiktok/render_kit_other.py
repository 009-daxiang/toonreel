#!/usr/bin/env python3
"""YT688 — re-render the not-yet-published videos of the 9-drama kit (dramas 02–09)
with the burned end-card CTA. Drama 01 is already live on YouTube, so it's skipped."""
import os
import subprocess

import render_ep23_youtube as R

FF = R.FF
OUT = os.path.expanduser('~/Desktop/YT688_YouTube_EP1英文版')
CUE_LIMIT = 176.0

DRAMAS = [  # (sid, drama_folder, en_name, order)
    ('u05', '鲨口逃生', 'Shark-Escape', 2),
    ('u02', '一身腱子肉，乱世做谋臣', 'Muscle-Strategist', 3),
    ('u01', '东北异事之出马诡堂', 'Northeast-Spirit-Altar', 4),
    ('u04', '蚀骨罪', 'Bone-Deep-Sin', 5),
    ('u08', '永冬之下，冻土之上', 'The-Eternal-Winter', 6),
    ('u07', '退役归来，这个保镖不好惹', 'The-Retired-Bodyguard', 7),
    ('u09', '重生！丑小鸭逆袭成了万人迷', 'Reborn-Ugly-Duckling', 8),
    ('u03', '乌鸦掉进凤凰窝，我成了冥凤小公主', 'Crow-in-the-Phoenix-Nest', 9),
]

def render(sid, drama, en, order, ep):
    vtt = os.path.join(R.SUBT, sid, f'ep{ep}.en.vtt')
    src = os.path.join(R.SRC, drama, f'{drama}-第{ep}集.mp4')
    out = os.path.join(OUT, f'{order:02d}-{en}', f'{order:02d}-{en}-EP{ep}-FULL.mp4')
    if not os.path.exists(vtt):
        print(f'MISS {out}', flush=True)
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
    for s, e, text in cues:
        if cut and e > cut:
            continue
        if e - s < 0.5:
            continue
        text = text.replace('{', '').replace('}', '')
        ass += f'Dialogue: 0,{R.ts_ass(s)},{R.ts_ass(e)},Sub,,0,0,0,,{text}\n'
    ass_path = f'/tmp/kit_{sid}_ep{ep}.ass'
    open(ass_path, 'w').write(ass)
    vf = (f'scale={R.W}:{R.H}:force_original_aspect_ratio=increase,crop={R.W}:{R.H},'
          f"setsar=1,ass='{ass_path}'," + R.endcard_filter(use))
    cmd = [FF, '-hide_banner', '-loglevel', 'error', '-i', src, '-vf', vf]
    if cut:
        cmd += ['-t', str(cut)]
    cmd += ['-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', out]
    subprocess.run(cmd, check=True)
    print(f'{order:02d}-EP{ep}: {"cut@" + str(round(cut, 1)) if cut else "full"} '
          f'({os.path.getsize(out)//1024//1024}MB)', flush=True)

def main():
    for sid, drama, en, order in DRAMAS:
        for ep in (1, 2, 3):
            try:
                render(sid, drama, en, order, ep)
            except Exception as e:
                print(f'FAIL {order:02d}-EP{ep}: {e}', flush=True)
    print('ALL DONE', flush=True)

if __name__ == '__main__':
    main()
