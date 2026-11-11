#!/usr/bin/env python3
"""YT688 — multilanguage TikTok clip maker
1. ffmpeg cuts a vertical segment from a drama episode (no text)
2. Pillow renders text PNGs (hook + brand) with per-language fonts
3. ffmpeg overlays the text PNGs onto the clip

Usage:
  python3 tools/make_clip_multilang.py <ep> <start_sec> <dur_sec> <lang> <hook_text>
Languages: zh zht en id th vi ms fil
Output: ~/Desktop/YT688_TikTok/<LANG>/<drama>-EP<n>-<LANG>.mp4
"""
import os
import subprocess
import sys

FF = os.path.expanduser("~/bin/ffmpeg")
FONT_CN = "/tmp/cnfont.ttc"          # STHeiti (CJK + latin)
FONT_TH = "/System/Library/Fonts/Thonburi.ttc"  # Thai glyphs
SRC_DIR = "/Volumes/NEWSMY/摊牌了我真的有系统"
OUT_BASE = os.path.expanduser("~/Desktop/YT688_TikTok")
DRAMA = "摊牌了我真的有系统"

COPY = {
 'zh': ('点击播放', '完整版 ▶ YT688 短剧'),
 'zht': ('點擊播放', '完整版 ▶ YT688 短劇'),
 'en': ('Tap to play', 'Full series ▶ YT688'),
 'id': ('Ketuk untuk play', 'Tonton full ▶ YT688'),
 'th': ('แตะเพื่อเล่น', 'ดูเต็ม ▶ YT688'),
 'vi': ('Chạm để phát', 'Xem full ▶ YT688'),
 'ms': ('Ketuk untuk main', 'Tonton penuh ▶ YT688'),
 'fil': ('Pindutin para mag-play', 'Full series ▶ YT688'),
}

def lang_font(lang):
    return FONT_TH if lang == 'th' else FONT_CN

def esc(t):
    return t.replace(':', '\\:').replace("'", "\\'").replace('%', '\\%')

def main():
    ep = str(sys.argv[1])
    start = str(sys.argv[2])
    dur = str(sys.argv[3])
    lang = str(sys.argv[4])
    hook = str(sys.argv[5])
    tap, brand = COPY[lang]

    src = os.path.join(SRC_DIR, f"{DRAMA}-第{ep}集.mp4")
    out_dir = os.path.join(OUT_BASE, lang.upper())
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{DRAMA}-EP{ep}-{lang.upper()}.mp4")

    # 1) cut vertical segment (no text)
    tmp = f"/tmp/clip_raw_{ep}_{lang}.mp4"
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-ss', start, '-t', dur,
                    '-i', src,
                    '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
                    '-y', tmp], check=True)

    # 2) render hook + brand text PNGs (Pillow — full unicode control)
    from PIL import Image, ImageDraw, ImageFont
    W, H = 720, 1280
    font_path = FONT_TH if lang == 'th' else FONT_CN

    def text_png(text, size, color, stroke, out_png):
        f = ImageFont.truetype(font_path, size)
        img = Image.new('RGBA', (W, size + 30), (0, 0, 0, 0))
        dr = ImageDraw.Draw(img)
        bbox = dr.textbbox((0, 0), text, font=f, stroke_width=stroke)
        tw = bbox[2] - bbox[0]
        x = max((W - tw) // 2 - bbox[0], 4)
        y = (size + 30 - (bbox[3] - bbox[1])) // 2 - bbox[1]
        dr.text((x, y), text, font=f, fill=color, stroke_width=stroke, stroke_fill='black')
        img.save(out_png)
        return out_png

    hook_png = text_png(hook, 44, (255, 221, 0), 5, '/tmp/hook.png')
    brand_png = text_png(brand, 34, (255, 255, 255), 3, '/tmp/brand.png')

    # 3) overlay text PNGs onto the clip
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error',
                    '-i', tmp,
                    '-i', hook_png,
                    '-i', brand_png,
                    '-filter_complex',
                    f"[0:v][1:v]overlay=(W-w)/2:60[a];[a][2:v]overlay=(W-w)/2:H*0.76[b]",
                    '-map', '[b]', '-map', '0:a?',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
                    '-y', out], check=True)
    os.remove(tmp)
    print(f"done: {out}")

if __name__ == '__main__':
    main()
