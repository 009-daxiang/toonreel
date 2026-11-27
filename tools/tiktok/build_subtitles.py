#!/usr/bin/env python3
"""YT688 — build translated subtitle VTTs from whisper transcripts.
Source: tools/tiktok/transcripts/{drama}/ep{N:04d}.json (zh segments)
Output: subtitles/{show_id}/ep{N}.{lang}.vtt   (lang: en th vi id ms fil)
Translation: Google translate gtx endpoint (free), batched by newline, cached.
Rerun-safe: skips VTTs that already exist unless --force.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
TRANS = f'{ROOT}/tools/tiktok/transcripts'
OUT = f'{ROOT}/subtitles'
CACHE_PATH = f'{ROOT}/tools/tiktok/sub_cache.json'
LANGS = ['en', 'th', 'vi', 'id', 'ms', 'fil']
BATCH = 6
SLEEP = 0.12
MIN_CUE = 0.9
BAD_PAT = re.compile(r'^(字幕|订阅|点赞|关注|谢谢观看|请不|Thanks for|Subscribe|请订阅|\[音乐\]|\(音乐\))')

_cache = {}
if os.path.exists(CACHE_PATH):
    _cache = json.load(open(CACHE_PATH))

def gt_once(text, tl):
    """Translate one string; rotate endpoints, back off on 429."""
    q = urllib.parse.quote(text)
    urls = [
        (f'https://clients5.google.com/translate_a/t'
         f'?client=dict-chrome-ex&sl=zh-CN&tl={tl}&q={q}', 'chrome'),
        (f'https://translate.googleapis.com/translate_a/single'
         f'?client=gtx&sl=zh-CN&tl={tl}&dt=t&q={q}', 'gtx'),
    ]
    last_err = None
    for attempt in range(4):
        url, kind = urls[attempt % len(urls)]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.load(r)
            if kind == 'chrome':
                return data[0] if isinstance(data, list) and data and isinstance(data[0], str) else ''
            return ''.join(seg[0] for seg in data[0] if seg and seg[0])
        except Exception as e:
            last_err = e
            code = getattr(e, 'code', 0)
            if code == 429:
                time.sleep(min(60, 5 * (2 ** attempt)))
            else:
                time.sleep(1.5)
    raise last_err

def gt(text, tl):
    return gt_once(text, tl)

def translate_lines(lines, tl, key):
    """Translate zh lines -> target lang, cached, batched by newline.
    Raises on incomplete translation so callers skip writing half-translated VTTs."""
    if key in _cache and len(_cache[key]) == len(lines):
        return _cache[key]
    out = [None] * len(lines)
    for base in range(0, len(lines), BATCH):
        chunk = lines[base:base + BATCH]
        ck = key + f'#{base}'
        if ck in _cache and len(_cache[ck]) == len(chunk) and not any(p == '' for p in _cache[ck]):
            out[base:base + BATCH] = _cache[ck]
            continue
        joined = '\n'.join(chunk)
        try:
            res = gt(joined, tl)
            parts = [p.strip() for p in res.split('\n') if p.strip()]
        except Exception as e:
            print(f'    retry per-line after error: {e}', flush=True)
            parts = None
        if not parts or len(parts) != len(chunk):
            parts = []
            for l in chunk:
                time.sleep(SLEEP)
                try:
                    parts.append(gt(l, tl).strip())
                except Exception:
                    parts.append('')
        if any(p == '' for p in parts):
            raise RuntimeError(f'translate incomplete {key}#{base}')
        out[base:base + BATCH] = parts
        _cache[ck] = parts
        json.dump(_cache, open(CACHE_PATH, 'w'), ensure_ascii=False)
        time.sleep(SLEEP)
    _cache[key] = out
    json.dump(_cache, open(CACHE_PATH, 'w'), ensure_ascii=False)
    return out

def build_cues(segs):
    cues = []
    for s in segs:
        t = s['text'].strip()
        if not t or BAD_PAT.match(t):
            continue
        if cues and (s['end'] - s['start'] < MIN_CUE or len(t) < 3):
            cues[-1]['text'] += t
            cues[-1]['end'] = s['end']
        else:
            cues.append({'start': s['start'], 'end': s['end'], 'text': t})
    for i, c in enumerate(cues):
        if c['end'] - c['start'] < MIN_CUE:
            nxt = cues[i + 1]['start'] - 0.05 if i + 1 < len(cues) else c['start'] + MIN_CUE
            c['end'] = min(c['start'] + MIN_CUE, nxt)
    return [c for c in cues if c['text']]

def vtt_ts(sec):
    h = int(sec // 3600); m = int(sec % 3600 // 60); s = sec % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',')

def wrap(text, width=42):
    """Browsers auto-wrap cue text at viewport width; return as-is."""
    return text

def split_long_cues(cues, max_dur=8.0):
    """Split cues longer than max_dur at commas/notes, timing proportional to text length."""
    out = []
    for c in cues:
        if c['end'] - c['start'] <= max_dur:
            out.append(c)
            continue
        parts = [p for p in re.split(r'[，,；;、。]', c['text']) if p.strip()]
        if len(parts) < 2:
            out.append(c)
            continue
        dur = c['end'] - c['start']
        total = sum(len(p) for p in parts)
        t = c['start']
        for p in parts:
            d = dur * len(p) / total
            out.append({'start': t, 'end': t + d, 'text': p})
            t += d
    return out

def main():
    cat = json.load(open(f'{ROOT}/data/catalog.json'))
    id_by_title = {s['title']: s['id'] for s in cat['shows']}
    # local transcript folders keep original Chinese names even after a show
    # is rebranded for the international site (e.g. u06 -> I Have a SYSTEM)
    id_by_title.update({'摊牌了我真的有系统': 'u06'})
    # zh folder names live on in poster paths (/uploads/<zh>/cover.jpg)
    for s in cat['shows']:
        m = re.match(r'/uploads/([^/]+)/', s.get('poster', ''))
        if m:
            id_by_title.setdefault(m.group(1), s['id'])
    force = '--force' in sys.argv
    only_lang = None
    only_shows = None
    for a in sys.argv[1:]:
        if a.startswith('--lang='):
            only_lang = a.split('=')[1]
        elif a.startswith('--only='):
            only_shows = set(a.split('=')[1].split(','))
    langs = [only_lang] if only_lang else LANGS

    dramas = sorted(os.listdir(TRANS))
    total_files = 0
    for drama in dramas:
        ddir = os.path.join(TRANS, drama)
        if not os.path.isdir(ddir) or drama not in id_by_title:
            continue
        sid = id_by_title[drama]
        if only_shows and sid not in only_shows:
            continue
        os.makedirs(os.path.join(OUT, sid), exist_ok=True)
        for f in sorted(os.listdir(ddir)):
            if not re.match(r'ep\d{4}\.json$', f):
                continue
            ep = int(f[2:6])
            vtt_base = os.path.join(OUT, sid, f'ep{ep}')
            data = json.load(open(os.path.join(ddir, f)))
            cues = split_long_cues(build_cues(data['segments']))
            if not cues:
                print(f'{sid} ep{ep}: no cues, skip', flush=True)
                continue
            for lang in langs:
                out_path = f'{vtt_base}.{lang}.vtt'
                if os.path.exists(out_path) and not force:
                    continue
                zh_lines = [c['text'] for c in cues]
                try:
                    trs = translate_lines(zh_lines, lang, f'{sid}|ep{ep}|{lang}')
                except Exception as e:
                    print(f'{sid} ep{ep} {lang}: FAIL ({e}) — vtt left for rerun', flush=True)
                    continue
                body = ['WEBVTT', '']
                for i, (c, tr) in enumerate(zip(cues, trs), 1):
                    body.append(f'{i}')
                    body.append(f"{vtt_ts(c['start'])} --> {vtt_ts(c['end'])}")
                    body.append(wrap(tr.strip() or c['text']))
                    body.append('')
                open(out_path, 'w').write('\n'.join(body))
                total_files += 1
            print(f'{sid} ep{ep}: {len(cues)} cues done', flush=True)
    print(f'ALL DONE — {total_files} vtt files written', flush=True)

if __name__ == '__main__':
    main()
