#!/usr/bin/env python3
"""YT688 — multilanguage promo batch maker
Reads tools/promo_subs.json (per-episode hooks in 8 languages) and
generates TikTok-ready vertical clips for each language channel:
  ZH (bilingual) / EN / ID / TH / VI / MS / FIL
Output: ~/Desktop/YT688_TikTok/PROMO/<LANG>/<drama>-EP<ep>-<LANG>.mp4
"""
import json
import os
import subprocess
import sys

FF = os.path.expanduser("~/bin/ffmpeg")
FONT_CN = "/tmp/cnfont.ttc"                      # STHeiti (CJK + latin glyphs)
FONT_TH = "/System/Library/Fonts/Thonburi.ttc"   # Thai glyphs
SRC = "uploads"
OUT = os.path.expanduser("~/Desktop/YT688_TikTok/PROMO")
SUBS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "promo_subs.json")
SUBS = json.load(open(SUBS_PATH, encoding="utf-8")) if os.path.exists(SUBS_PATH) else {}

LANGS = ["zh", "en", "id", "th", "vi", "ms", "fil"]
BRAND = {
 "zh": "完整版 ▶ YT688 短剧", "en": "Full series ▶ YT688",
 "id": "Tonton full ▶ YT688", "th": "ดูเต็ม ▶ YT688",
 "vi": "Xem full ▶ YT688", "ms": "Tonton penuh ▶ YT688",
 "fil": "Full series ▶ YT688",
}

def font_file_for(lang):
    return "/System/Library/Fonts/Thonburi.ttc" if lang == "th" else FONT_CN

def font_for(lang):
    return "/System/Library/Fonts/Thonburi.ttc" if lang == "th" else FONT_CN

def text_png(text, size, color, stroke, out_png, font_file):
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(font_file, size)
    img = Image.new("RGBA", (720, size + 30), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    bbox = dr.textbbox((0, 0), text, font=f, stroke_width=stroke)
    tw = bbox[2] - bbox[0]
    x = max((720 - tw) // 2 - bbox[0], 4)
    y = (size + 30 - (bbox[3] - bbox[1])) // 2 - bbox[1]
    dr.text((x, y), text, font=f, fill=color, stroke_width=stroke, stroke_fill="black")
    img.save(out_png)
    return out_png

def cut_clip(src, start, dur, out):
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", str(start), "-t", str(dur),
                        "-i", src,
                        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1",
                        "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-y", out],
                       capture_output=True, text=True)
    return r.returncode == 0

def overlay_texts(clip, out, hook_png, brand_png, title_png):
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error",
                        "-i", clip, "-i", hook_png, "-i", brand_png, "-i", title_png,
                        "-filter_complex",
                        "[0:v][1:v]overlay=(W-w)/2:H*0.28[t];"
                        "[t][2:v]overlay=(W-w)/2:H*0.60[z];"
                        "[z][3:v]overlay=(W-w)/2:52[e]",
                        "-map", "[e]", "-map", "0:a?",
                        "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                        "-c:a", "copy", "-movflags", "+faststart", "-y", out],
                       capture_output=True, text=True)
    return r.returncode == 0

def main():
    os.makedirs(OUT, exist_ok=True)
    catalog = json.load(open("data/catalog.json", encoding="utf-8"))
    by_title = {s["title"]: s for s in catalog["shows"]}
    made, failed = 0, []
    for title, eps in SUBS.items():
        s = by_title.get(title)
        if not s:
            print(f"skip (not on site): {title}", flush=True)
            continue
        for job in eps:
            ep = job["ep"]
            for lang in LANGS:
                hook = job["hooks"][lang]
                brand = BRAND[lang]
                out_dir = os.path.join(OUT, lang.upper())
                os.makedirs(out_dir, exist_ok=True)
                out = os.path.join(out_dir, f"{title}-EP{ep:02d}-{lang.upper()}.mp4")
                if os.path.exists(out) and os.path.getsize(out) > 100000:
                    made += 1
                    continue
                ep_file = next((v for v in s["videos"] if f"第{ep}集" in v), None)
                if not ep_file:
                    failed.append(f"{title} EP{ep} file missing")
                    continue
                src_path = os.path.normpath(os.path.join(".", ep_file.lstrip("/")))
                if not cut_clip(src_path, 30, 30, "/tmp/promo_tmp.mp4"):
                    failed.append(f"{title} EP{ep} cut")
                    continue
                hook_png = text_png(hook, 46, (255, 221, 0), 5, f"/tmp/hook_{lang}.png", font_for(lang))
                brand_png = text_png(brand, 34, (255, 255, 255), 3, f"/tmp/brand_{lang}.png", font_for(lang))
                title_png = text_png(title, 30, (255, 255, 255), 3, f"/tmp/ptitle_{lang}.png", font_for(lang))
                ok = overlay_texts("/tmp/promo_tmp.mp4", out, title_png, hook_png, brand_png)
                if ok:
                    made += 1
                    print(f"done: {title} EP{ep} [{lang}]", flush=True)
                else:
                    failed.append(f"{title} EP{ep} overlay")
    print(f"\nTOTAL made: {made}, failed: {len(failed)}", flush=True)
    if failed:
        print("\n".join(failed), flush=True)

if __name__ == "__main__":
    main()
