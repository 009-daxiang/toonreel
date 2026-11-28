#!/usr/bin/env python3
"""扫描并删除含中文/日文残留的英文字幕文件（en.vtt）。
删除后由 build_subtitles.py 重跑自动补齐。阈值：≥15% 台词行含CJK 或 ≥2 行污染。"""
import glob, os, re, sys

cjk = re.compile(r'[\u4e00-\u9fff\u3040-\u30ff]')
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
purged = 0
for f in glob.glob(os.path.join(root, 'subtitles', '*', 'ep*.en.vtt')):
    lines = [l for l in open(f, encoding='utf-8').read().splitlines()
             if l.strip() and '-->' not in l and not l.strip().isdigit() and l.strip() != 'WEBVTT']
    if not lines:
        continue
    bad = sum(1 for l in lines if len(cjk.findall(l)) >= 2)
    if bad / len(lines) > 0.15 or bad >= 2:
        os.remove(f)
        purged += 1
        print('purge:', os.path.relpath(f, root), flush=True)
print(f'CJK-SWEEP-DONE purged={purged}', flush=True)
