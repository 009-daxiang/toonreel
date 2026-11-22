#!/bin/bash
# 看门狗：转写进程不在且仍有剩余集数时，自动复活（含 caffeinate）
if pgrep -f "transcribe_all_eps.py" >/dev/null; then exit 0; fi
REMAIN=$(python3 - << 'PY'
import json, os
ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
cat = json.load(open(f'{ROOT}/data/catalog.json'))
FOLDER = {'u01':'东北异事之出马诡堂','u02':'一身腱子肉，乱世做谋臣','u03':'乌鸦掉进凤凰窝，我成了冥凤小公主',
'u04':'蚀骨罪','u05':'鲨口逃生','u06':'摊牌了我真的有系统','u07':'退役归来，这个保镖不好惹',
'u08':'永冬之下，冻土之上','u09':'重生！丑小鸭逆袭成了万人迷'}
remain = 0
for s in cat['shows']:
    d = FOLDER.get(s['id']) or s.get('titleZh')
    if not d: continue
    for ep in range(1, s['episodes'] + 1):
        if not os.path.exists(f'{ROOT}/tools/tiktok/transcripts/{d}/ep{ep:04d}.json'):
            remain += 1
print(remain)
PY
)
if [ "$REMAIN" = "0" ] || [ -z "$REMAIN" ]; then exit 0; fi
pgrep caffeinate >/dev/null || nohup caffeinate -i -t 345600 >/dev/null 2>&1 &
cd /Users/daxiang/.zcode/workspace/default/toonreel/tools/tiktok
TRANSCRIBE_START=0 TRANSCRIBE_END=24 nohup python3 transcribe_all_eps.py >> /tmp/transcribe_continuous.log 2>&1 &
echo "$(date '+%F %T') watchdog: 复活转写（剩余 $REMAIN 集）" >> /tmp/transcribe_watchdog.log
