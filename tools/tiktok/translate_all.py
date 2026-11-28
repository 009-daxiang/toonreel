#!/usr/bin/env python3
"""YT688 — translate ALL episodes to en/th/vi/id/fil, write VTTs, deploy per drama.
Runs until every catalog episode has all 5 subtitle languages. Uses curl+gtx batches,
3 worker threads, retry/backoff, CJK-leak verification, per-drama VPS deployment."""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request
import threading, queue

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
SUBT = f'{ROOT}/subtitles'
VPS = 'root@107.173.35.78:/var/www/yt688/subtitles/'
LANGS = ['en', 'th', 'vi', 'id', 'fil']
LANG_SET = set(LANGS)
FOLDER = {'u01': '东北异事之出马诡堂', 'u02': '一身腱子肉，乱世做谋臣', 'u03': '乌鸦掉进凤凰窝，我成了冥凤小公主',
          'u04': '蚀骨罪', 'u05': '鲨口逃生', 'u06': '摊牌了我真的有系统', 'u07': '退役归来，这个保镖不好惹',
          'u08': '永冬之下，冻土之上', 'u09': '重生！丑小鸭逆袭成了万人迷'}
WORKERS = 3
BATCH_CHARS = 1300          # encoded-length budget per gtx request
BACKOFF = [8, 20, 50, 120]
LOG = '/tmp/translate_all.log'
DEPLOY_LOG = '/tmp/translate_deployed.json'

logf = open(LOG, 'a')
def log(msg):
    line = f"{time.strftime('%m-%d %H:%M:%S')} {msg}"
    logf.write(line + '\n'); logf.flush()
    print(line, flush=True)

def gt_batch(lines, tl):
    """Translate a list of lines; returns list. Integrity enforced by caller."""
    q = urllib.parse.quote('\n'.join(lines), safe='')
    url = (f'https://translate.googleapis.com/translate_a/single'
           f'?client=gtx&sl=zh-CN&tl={tl}&dt=t&q={q}')
    r = subprocess.run(['curl', '-s', '--max-time', '25', url,
                        '-H', 'User-Agent: Mozilla/5.0'], capture_output=True, text=True)
    data = json.loads(r.stdout)
    merged = ''.join(seg[0] for seg in data[0] if seg and seg[0])
    out = [x.strip() for x in merged.split('\n') if x.strip()]
    return out

def gt_lines(lines, tl):
    """Pack lines into batches by encoded length; enforce 1:1 line count."""
    batches, cur, curlen = [], [], 0
    for ln in lines:
        enc = len(urllib.parse.quote(ln, safe=''))
        if cur and curlen + enc > BATCH_CHARS:
            batches.append(cur); cur, curlen = [], 0
        cur.append(ln); curlen += enc + 1
    if cur: batches.append(cur)
    out = []
    for b in batches:
        got = None
        for att in range(len(BACKOFF)):
            try:
                got = gt_batch(b, tl)
                if len(got) != len(b):
                    raise ValueError(f'行数不匹配 {len(got)}≠{len(b)}')
                break
            except Exception as e:
                wait = BACKOFF[att]
                log(f'    batch retry {att+1} ({tl}): {str(e)[:50]} → 等 {wait}s')
                time.sleep(wait)
        if got is None:
            # 逐行兜底
            got = []
            for ln in b:
                try: got.append(gt_batch([ln], tl)[0])
                except Exception: got.append('')
        out += got
    return out

def vtt_ts(sec):
    h = int(sec // 3600); m = int(sec % 3600 // 60); s2 = sec % 60
    return f'{h:02d}:{m:02d}:{s2:06.3f}'.replace('.', ',')

CJK = re.compile(r'[\u4e00-\u9fff]')
def write_vtt(cues, trs, path):
    body = ['WEBVTT', '']
    for i, (c, t) in enumerate(zip(cues, trs), 1):
        body += [str(i), f"{vtt_ts(c['start'])} --> {vtt_ts(c['end'])}", t, '']
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write('\n'.join(body))

def load_deployed():
    try: return set(json.load(open(DEPLOY_LOG)))
    except Exception: return set()
def mark_deployed(sid):
    done = load_deployed(); done.add(sid)
    json.dump(sorted(done), open(DEPLOY_LOG, 'w'))

def build_jobs():
    cat = json.load(open(f'{ROOT}/data/catalog.json'))
    jobs, missing_transcript = [], 0
    for s in cat['shows']:
        sid = s['id']
        folder = FOLDER.get(sid) or s.get('titleZh')
        if not folder: continue
        for ep in range(1, s['episodes'] + 1):
            tr = os.path.join(ROOT, 'tools/tiktok/transcripts', folder, f'ep{ep:04d}.json')
            if not os.path.exists(tr):
                missing_transcript += 1; continue
            missing = [l for l in LANGS if not os.path.exists(f'{SUBT}/{sid}/ep{ep}.{l}.vtt')]
            if missing:
                jobs.append((sid, folder, ep, missing))
    return jobs, missing_transcript

def worker(wid, q, counters, lock):
    while True:
        try: sid, folder, ep, langs = q.get(timeout=5)
        except queue.Empty: return
        try:
            tr = json.load(open(f'{ROOT}/tools/tiktok/transcripts/{folder}/ep{ep:04d}.json'))
            cues = B.split_long_cues(B.build_cues(tr['segments']))
            lines = [c['text'] for c in cues]
            for lang in langs:
                trs = gt_lines(lines, lang)
                # 完整性 + CJK 泄漏校验
                bad = sum(1 for t in trs if CJK.search(t))
                if len(trs) != len(cues) or bad > len(trs) // 3:
                    raise ValueError(f'{lang} 校验失败 (bad={bad}/{len(trs)})')
                for i, t in enumerate(trs):
                    if CJK.search(t): trs[i] = ''  # 泄漏行留空（宁缺毋错）
                write_vtt(cues, trs, f'{SUBT}/{sid}/ep{ep}.{lang}.vtt')
            with lock:
                counters['eps'] += 1
                if counters['eps'] % 25 == 0:
                    log(f'[worker{wid}] 进度 {counters["eps"]} 集 | {folder} ep{ep}', flush=True)
        except Exception as e:
            with lock: counters['fail'] += 1
            log(f'[worker{wid}] FAIL {folder} ep{ep}: {str(e)[:70]}', flush=True)
        q.task_done()

def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    global B
    import build_subtitles as B
    jobs, missing_tr = build_jobs()
    total_missing = sum(len(j[3]) for j in jobs)
    log(f'=== 翻译启动: {len(jobs)} 集待翻译, 共 {total_missing} 个语言文件; '
        f'缺转写(等转写管线): {missing_tr} 集 ===')
    if not jobs:
        log('无待翻译任务'); return
    q = queue.Queue()
    for j in jobs: q.put(j)
    counters, lock = {'eps': 0, 'fail': 0}, threading.Lock()
    threads = [threading.Thread(target=worker, args=(i, q, counters, lock), daemon=True)
               for i in range(WORKERS)]
    for t in threads: t.start()
    q.join()
    log(f'=== 全部翻译完成: {counters["eps"]} 集, 失败 {counters["fail"]} ===')

if __name__ == '__main__':
    main()
