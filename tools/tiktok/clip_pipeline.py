#!/usr/bin/env python3
"""YT688 TikTok clip pipeline — steps 3–6.
Subcommands:
  prep   <drama>     : extract & split subtitle lines for chosen clips -> prep/<drama>.lines.json
  ass    <drama>     : build ASS per clip per language from prep + trans files
  render <drama>     : ffmpeg-render 6 language versions per clip + QC frames

Inputs you (the model) author:
  select/<drama>.json : {"clips":[{"ep":int,"start":float,"end":float,"hook":{lang:text},"caption":{lang:text}}]}
  trans/<drama>.json  : {"0":{"en":..,"th":..,"vi":..,"id":..,"ms":..,"fil":..}, ...} keyed by line index per clip order
Outputs:
  work/ass/<drama>-c<k>-<lang>.ass
  ~/Desktop/YT688_TikTok_v2/<LANG>/<drama>-EP<ep>-c<k>-<LANG>.mp4
  work/qc/<drama>-c<k>-<lang>-{a,b,c}.png
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TRANS_DIR = os.path.join(HERE, "transcripts")
SEL_DIR = os.path.join(HERE, "select")
PREP_DIR = os.path.join(HERE, "prep")
TRANS_TR_DIR = os.path.join(HERE, "trans")
ASS_DIR = os.path.join(HERE, "work", "ass")
QC_DIR = os.path.join(HERE, "work", "qc")
SRC = "/Users/daxiang/.zcode/workspace/default/toonreel/uploads"
OUT_BASE = os.path.expanduser("~/Desktop/YT688_TikTok_v2")
FF = os.path.expanduser("~/bin/ffmpeg")

LANGS = ["en", "th", "vi", "id", "ms", "fil"]
LANG_UPPER = {l: l.upper() for l in LANGS}

FONT = {"en": "Helvetica Neue", "id": "Helvetica Neue", "ms": "Helvetica Neue",
        "fil": "Helvetica Neue", "vi": "Arial Unicode MS", "th": "Thonburi UI"}
SIZE = {"en": 34, "id": 34, "ms": 34, "fil": 33, "vi": 32, "th": 36}

CTA = {
    "en": "Watch ALL episodes FREE ▶ YT688.app",
    "th": "ดูทุกตอนฟรี ▶ YT688.app",
    "vi": "Xem toàn bộ MIỄN PHÍ ▶ YT688.app",
    "id": "Tonton semua episode GRATIS ▶ YT688.app",
    "ms": "Tonton semua episod PERCUMA ▶ YT688.app",
    "fil": "Panuorin LAHAT — LIBRE ▶ YT688.app",
}


def load(d, kind):
    p = os.path.join(HERE, kind, f"{d}.json") if kind != "transcripts" else \
        os.path.join(TRANS_DIR, d)
    return p


def safe_name(d):
    return re.sub(r"[，,]", "", d)


# ---------- prep: rebase + split lines ----------
SPLIT_PUNCT = "。！？；!?;…"

def split_text(text, max_cjk=16):
    """Split a (mostly CJK) line into display lines <= max_cjk chars at punctuation."""
    parts, buf = [], ""
    for ch in text:
        buf += ch
        if ch in SPLIT_PUNCT or ch in "，,、" and len(buf) >= max_cjk:
            parts.append(buf)
            buf = ""
    if buf.strip():
        parts.append(buf)
    # merge tiny fragments into previous
    merged = []
    for p in parts:
        if merged and len(p) < 5:
            merged[-1] += p
        else:
            merged.append(p)
    # hard-split any still-oversized line
    out = []
    for p in merged:
        while len(p) > max_cjk + 4:
            cut = max_cjk
            for k in range(min(len(p) - 1, max_cjk), max_cjk // 2, -1):
                if p[k] in "，,、":
                    cut = k + 1
                    break
            out.append(p[:cut])
            p = p[cut:]
        if p.strip():
            out.append(p)
    return out


def prep(drama):
    sel = json.load(open(os.path.join(SEL_DIR, f"{drama}.json")))
    prep_out = []
    for k, clip in enumerate(sel["clips"]):
        tf = os.path.join(TRANS_DIR, drama, f"ep{clip['ep']:04d}.json")
        data = json.load(open(tf))
        lines = []
        for seg in data["segments"]:
            s, e, txt = seg["start"], seg["end"], seg["text"].strip()
            if not txt or e <= clip["start"] or s >= clip["end"]:
                continue
            pieces = split_text(txt)
            total = sum(len(p) for p in pieces)
            t = s
            for p in pieces:
                frac = len(p) / total
                d = (e - t) * frac
                lines.append({"start": round(max(t, clip["start"]) - clip["start"], 2),
                              "end": round(min(t + d, clip["end"]) - clip["start"], 2),
                              "zh": p})
                t += d
        prep_out.append({"ep": clip["ep"], "start": clip["start"], "end": clip["end"],
                         "dur": round(clip["end"] - clip["start"], 1),
                         "hook": clip["hook"], "caption": clip["caption"], "lines": lines})
    json.dump(prep_out, open(os.path.join(PREP_DIR, f"{drama}.lines.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"prep {drama}: {len(prep_out)} clips, "
          f"{sum(len(c['lines']) for c in prep_out)} lines total")


# ---------- ass ----------
def ts(sec):
    h = int(sec // 3600); m = int(sec % 3600 // 60); s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def ass_for_clip(drama, k, clip, tr, lang_only):
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
    events = []
    margin = clip.get("margin", 170)
    for lang in (lang_only,):
        fnt, size = FONT[lang], SIZE[lang]
        header += (
            f"Style: H_{lang},{fnt},46,&H0000D7FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,1,8,40,40,58,1\n"
            f"Style: S_{lang},{fnt},{size},&H00FFFFFF,&H000000FF,&H00000000,&H50000000,-1,0,0,0,100,100,0,0,3,2.5,0,2,30,30,{margin},1\n"
            f"Style: C_{lang},{fnt},31,&H0000D7FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,30,30,440,1\n")
    header += "\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    dur = clip["dur"]
    for lang in (lang_only,):
        hook = clip["hook"][lang].replace("\n", "\\N")
        events.append(f"Dialogue: 1,{ts(0)},{ts(dur)},H_{lang},,0,0,0,,{hook}\n")
        events.append(f"Dialogue: 1,{ts(0)},{ts(dur)},C_{lang},,0,0,0,,{CTA[lang]}\n")
        prev_end = 0.0
        for i, line in enumerate(clip["lines"]):
            txt = tr[str(i)][lang].strip()
            s = max(line["start"], prev_end + 0.04)
            e = max(line["end"], s + 0.9)
            e = min(e, dur)
            if s >= e:
                continue
            prev_end = e
            txt = txt.replace("\n", "\\N")
            events.append(f"Dialogue: 0,{ts(s)},{ts(e)},S_{lang},,0,0,0,,{txt}\n")
    return header + "".join(events)


def build_ass(drama):
    prep = json.load(open(os.path.join(PREP_DIR, f"{drama}.lines.json")))
    os.makedirs(ASS_DIR, exist_ok=True)
    sn = safe_name(drama)
    for k, clip in enumerate(prep):
        tr = json.load(open(os.path.join(TRANS_TR_DIR, f"{drama}.c{k}.json")))
        for lang in LANGS:
            p = os.path.join(ASS_DIR, f"{sn}-c{k}-{lang}.ass")
            open(p, "w").write(ass_for_clip(drama, k, clip, tr, lang))
    print(f"ass {drama}: {len(prep)*len(LANGS)} files")


# ---------- render ----------
def render(drama):
    prep = json.load(open(os.path.join(PREP_DIR, f"{drama}.lines.json")))
    os.makedirs(QC_DIR, exist_ok=True)
    sn = safe_name(drama)
    for k, clip in enumerate(prep):
        src = os.path.join(SRC, drama,
                           f"{drama}-第{clip['ep']}集.mp4")
        base = f"{sn}-EP{clip['ep']}-c{k}"
        for lang in LANGS:
            out_dir = os.path.join(OUT_BASE, LANG_UPPER[lang])
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, f"{base}-{LANG_UPPER[lang]}.mp4")
            ass_p = os.path.join(ASS_DIR, f"{sn}-c{k}-{lang}.ass")
            vf = (f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,"
                  f"setsar=1,ass='{ass_p}'")
            r = subprocess.run([FF, "-hide_banner", "-loglevel", "error",
                                "-ss", str(clip["start"]), "-t", str(clip["dur"]),
                                "-i", src, "-vf", vf,
                                "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                                "-c:a", "aac", "-b:a", "128k",
                                "-movflags", "+faststart", "-y", out])
            if r.returncode != 0:
                print(f"FAIL {out}", flush=True)
                continue
            # QC frames at 8% / 50% / 92% of clip
            for tag, frac in (("a", 0.08), ("b", 0.5), ("c", 0.92)):
                subprocess.run([FF, "-hide_banner", "-loglevel", "error",
                                "-ss", str(frac * clip["dur"]), "-i", out,
                                "-frames:v", "1", "-y",
                                os.path.join(QC_DIR, f"{base}-{lang}-{tag}.png")])
            print(f"done {out}", flush=True)


if __name__ == "__main__":
    cmd, drama = sys.argv[1], sys.argv[2]
    {"prep": prep, "ass": build_ass, "render": render}[cmd](drama)
