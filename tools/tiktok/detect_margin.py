#!/usr/bin/env python3
"""Detect the burned-in Chinese subtitle band on source frames and compute
a safe MarginV for the translated subs, per clip.
Writes margin into prep/<drama>.lines.json (clip["margin"])."""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "prep")
SRC = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
FF = os.path.expanduser("~/bin/ffmpeg")
W, H = 720, 1280


def frame_band(png):
    """Return (top, bottom) of the burned-sub band in y 750..1270, or None."""
    img = np.asarray(Image.open(png).convert("RGB"), dtype=np.uint8)
    x0, x1 = 120, 600
    region = img[750:1270, x0:x1]
    # 硬字幕是纯白+黑描边：统计每行接近纯白的像素数
    white = ((region > 215).all(axis=2)).sum(axis=1)
    rows = white > 45
    if not rows.any():
        return None
    ys = np.where(rows)[0] + 750
    # 取最大连续段
    bands, start = [], ys[0]
    for a, b in zip(ys, ys[1:]):
        if b - a > 40:
            bands.append((start, a))
            start = b
    bands.append((start, ys[-1]))
    bands = [b for b in bands if 12 <= b[1] - b[0] <= 160]
    if not bands:
        return None
    top, bot = max(bands, key=lambda b: b[1] - b[0])
    return (int(top), int(bot))


def clip_margin(drama, ep, start, dur):
    bands = []
    for frac in (0.25, 0.5, 0.75):
        t = start + frac * dur
        png = f"/tmp/detect_{drama}_{ep}_{frac}.png"
        subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", str(t),
                        "-i", os.path.join(SRC, drama, f"{drama}-第{ep}集.mp4"),
                        "-frames:v", "1", "-vf",
                        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1",
                        "-y", png], check=True)
        b = frame_band(png)
        os.remove(png)
        if b:
            bands.append(b)
    if not bands:
        return None
    bands.sort(key=lambda b: b[0])
    top, bot = bands[len(bands) // 2]
    if bot < 1000:  # 中文字幕在中上部 → 译文放它下面
        target_bottom = min(bot + 95, 1140)
    else:           # 中文字幕贴底 → 译文放它上面、CTA 之下
        target_bottom = min(top - 40, 770)
    margin = max(60, H - target_bottom)
    return margin, (top, bot)


def process(drama):
    prep = json.load(open(os.path.join(PREP, f"{drama}.lines.json")))
    for k, clip in enumerate(prep):
        r = clip_margin(drama, clip["ep"], clip["start"], clip["dur"])
        if r:
            margin, band = r
            clip["margin"] = margin
            print(f"{drama} c{k} ep{clip['ep']}: band={band} -> marginV={margin}")
        else:
            clip["margin"] = 170
            print(f"{drama} c{k} ep{clip['ep']}: no band -> default 170")
    json.dump(prep, open(os.path.join(PREP, f"{drama}.lines.json"), "w"), ensure_ascii=False)


if __name__ == "__main__":
    for d in sys.argv[1:]:
        process(d)
