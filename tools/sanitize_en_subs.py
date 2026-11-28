#!/usr/bin/env python3
"""英文字幕就地消毒：剔除含中文/日文残留的单条字幕（cue），保留其余内容。
判定：该行 CJK 字符数 ≥2 且占该行比例 ≥0.5，或 CJK 字符数 ≥6。"""
import glob, os, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cjk = re.compile(r'[\u4e00-\u9fff\u3040-\u30ff]')
fixed_files = removed = 0

for f in glob.glob(os.path.join(root, 'subtitles', '*', 'ep*.en.vtt')):
    blocks = re.split(r'\n\n+', open(f, encoding='utf-8').read().strip())
    out, removed_in_file = [], 0
    for b in blocks:
        if b.startswith('WEBVTT'):
            out.append(b)
            continue
        lines = b.splitlines()
        text_lines = [l for l in lines[2:] if l.strip()]
        if not text_lines:
            out.append(b)
            continue
        bad = any(
            (len(cjk.findall(l)) >= 2 and len(cjk.findall(l)) / max(1, len(l.strip())) >= 0.5)
            or len(cjk.findall(l)) >= 6
            for l in text_lines
        )
        if bad:
            removed_in_file += 1
            continue
        out.append(b)
    if removed_in_file:
        open(f, 'w', encoding='utf-8').write('\n\n'.join(out) + '\n')
        fixed_files += 1
        removed += removed_in_file
        print('sanitize:', os.path.relpath(f, root), f'(-{removed_in_file} cues)', flush=True)
print(f'SANITIZE-DONE files={fixed_files} cues_removed={removed}', flush=True)
