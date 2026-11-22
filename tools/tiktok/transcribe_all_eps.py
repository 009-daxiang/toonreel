#!/usr/bin/env python3
"""YT688 — transcribe EVERY episode of every catalog drama (5-language subtitle push).
Source resolution order: local uploads/ (original 9) -> NEWSMY drive (47 new dramas).
Skips existing transcripts. Drive must stay mounted for the duration."""
import json, os, time, datetime
from faster_whisper import WhisperModel

# 工作时段：默认每天 9:00-17:00（launchd 每日 9 点拉起本脚本）
# 临时加班用环境变量覆盖：TRANSCRIBE_START=20 TRANSCRIBE_END=23
START_HOUR = int(os.environ.get('TRANSCRIBE_START', '9'))
END_HOUR = int(os.environ.get('TRANSCRIBE_END', '17'))

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
BASE = f'{ROOT}/uploads'
DRIVE = '/Volumes/NEWSMY 1'
OUT = f'{ROOT}/tools/tiktok/transcripts'

cat = json.load(open(f'{ROOT}/data/catalog.json'))
# 英文标题 -> 服务器/硬盘上的中文文件夹名
FOLDER = {'u01': '东北异事之出马诡堂', 'u02': '一身腱子肉，乱世做谋臣', 'u03': '乌鸦掉进凤凰窝，我成了冥凤小公主',
          'u04': '蚀骨罪', 'u05': '鲨口逃生', 'u06': '摊牌了我真的有系统', 'u07': '退役归来，这个保镖不好惹',
          'u08': '永冬之下，冻土之上', 'u09': '重生！丑小鸭逆袭成了万人迷'}

MODEL = WhisperModel("small", device="cpu", compute_type="int8")

jobs = []
for s in cat['shows']:
    sid, folder = s['id'], FOLDER.get(s['id'], s.get('titleZh'))
    if not folder:
        print(f"skip {sid}: no folder mapping", flush=True)
        continue
    for ep in range(1, s['episodes'] + 1):
        out_json = os.path.join(OUT, folder, f'ep{ep:04d}.json')
        if os.path.exists(out_json):
            continue
        fname = f'{folder}-第{ep}集.mp4'
        src_local = os.path.join(BASE, folder, fname)
        src_drive = os.path.join(DRIVE, folder, fname)
        src = src_local if os.path.exists(src_local) else (src_drive if os.path.exists(src_drive) else None)
        if not src:
            continue  # file missing everywhere; reported in summary
        jobs.append((sid, folder, ep, src, out_json))

print(f'待转写: {len(jobs)} 集', flush=True)
t0 = time.time()
fails = 0
for i, (sid, folder, ep, src, out_json) in enumerate(jobs, 1):
    hour = datetime.datetime.now().hour
    if hour < START_HOUR or hour >= END_HOUR:
        print(f'[{i}/{len(jobs)}] 已到下班时间({END_HOUR}:00)，自动暂停。'
              f'本时段完成 {i-1} 集，明日 9:00 自动续跑。', flush=True)
        break
    try:
        segs_iter, info = MODEL.transcribe(src, language='zh', beam_size=5,
                                           vad_filter=True, vad_parameters={'min_silence_duration_ms': 400})
        segs = [{'start': round(x.start, 2), 'end': round(x.end, 2), 'text': x.text.strip()}
                for x in segs_iter]
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump({'file': os.path.basename(src), 'ep': ep, 'duration': round(info.duration, 1),
                   'segments': segs}, open(out_json, 'w'), ensure_ascii=False)
        if i % 20 == 0 or i == len(jobs):
            print(f'[{i}/{len(jobs)}] {folder} ep{ep}: {len(segs)} segs | {time.time()-t0:.0f}s elapsed', flush=True)
    except Exception as e:
        fails += 1
        print(f'[{i}/{len(jobs)}] FAIL {folder} ep{ep}: {str(e)[:70]}', flush=True)
print(f'ALL DONE: {len(jobs)} 集, 失败 {fails}, 总耗时 {(time.time()-t0)/3600:.1f}h', flush=True)
