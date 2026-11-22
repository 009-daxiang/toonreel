#!/usr/bin/env python3
"""YT688 — generate the upload copy kit (titles/descriptions/tags) for
摊牌了我真的有系统 EP4..EP75 from the burned-in EN subtitle cues."""
import os
import re

import render_ep23_youtube as R

SID = 'u06'
EN = 'I-Have-a-System'
OUT_DIR = os.path.expanduser('~/Desktop/YT688引流_I-Have-a-System')
EPS = range(4, 76)
TAGS = ('short drama, mini drama, cdrama, chinese drama, english subtitles, '
        'I Have a System, system drama, short film, viral shorts, yt688')
PUNCH = re.compile(r'\b(system|kill|die|dead|marry|kneel|beg|truth|secret|secretly|'
                   r'revenge|prison|power|money|boss|general|mission|reward|betray)\b', re.I)

BAD_TAIL = re.compile(r'\b(of|to|and|the|a|an|is|was|that|in|on|for|with|about|by|if|but|so)$', re.I)

def pick_hook(cues):
    scored = []
    for s, e, t in cues:
        t = t.replace('\\N', ' ').strip()
        if len(t.split()) < 4:
            continue
        if BAD_TAIL.search(t.rstrip('.,!?…')):
            continue  # truncated-sounding lines make weak titles
        if len(PUNCH.findall(t)) == 0:
            continue
        score = 2 * len(PUNCH.findall(t)) + min(len(t) / 12, 2)
        hook = t.rstrip(' .,!?…')
        if hook.endswith('…'):
            continue
        scored.append((score, hook))
    if not scored:
        # fallback: any cue that at least doesn't end mid-phrase
        for s, e, t in cues:
            t = t.replace('\\N', ' ').strip().rstrip(' .,!?…')
            if len(t.split()) >= 5 and not BAD_TAIL.search(t):
                return t
        return None
    scored.sort(key=lambda x: -x[0])
    hook = scored[0][1]
    if len(hook) > 48:
        cut = hook[:48].rsplit(' ', 1)[0].rstrip(' .,!?…')
        if BAD_TAIL.search(cut):
            cut = cut.rsplit(' ', 1)[0]
        hook = cut + '...'
    return hook

def main():
    lines = []
    lines.append('═══════════════════════════════════════════════')
    lines.append('  YouTube 上传文案表 · I Have a SYSTEM · EP4–EP75（共 72 条）')
    lines.append('═══════════════════════════════════════════════')
    lines.append('')
    lines.append('【这批视频是什么】')
    lines.append('《I Have a SYSTEM》第 4–75 集（全剧 145 集的前半部），竖屏英文字幕，全部 ≤3 分钟 = Shorts。')
    lines.append('视频文件在「视频-烧录英字」文件夹；对应英文字幕 SRT 在「字幕SRT-英文」文件夹。')
    lines.append('')
    lines.append('【发布节奏（重要）】')
    lines.append('· 每天 2 条：中午 12–13 点 1 条 + 晚上 19–21 点 1 条（覆盖南亚/欧美双时段）')
    lines.append('· 严格按 EP4 → EP75 顺序发（观众在追剧情，乱序会掉粉）')
    lines.append('· 每天最多 3 条，绝不要一次性全发完（新号大量上传会触发刷量风控）')
    lines.append('· 发布后每条都置顶评论区固定文案（见下）')
    lines.append('· 每周回看一次 Studio 数据：把播放最高的 3 集记下来，以后优先给这些剧集附近加更')
    lines.append('')
    lines.append('【统一置顶评论】（每条视频发完就发）')
    lines.append('New episodes & the FINALE are on YT688 👉 https://yt688.app/drama/u06.html (works on any browser)')
    lines.append('')
    lines.append('【统一标签】（每条的「标签」框粘贴）')
    lines.append(TAGS)
    lines.append('')
    lines.append('【视频语言】每条都选 English；【受众】每条都选「否，不是为儿童设计的」；【类别】电影和动画')
    lines.append('')
    lines.append('═══════════ 逐条文案（按发布顺序）═══════════')
    for ep in EPS:
        vtt = os.path.join(R.SUBT, SID, f'ep{ep}.en.vtt')
        mp4 = os.path.join(OUT_DIR, '视频-烧录英字', f'{EN}-EP{ep:02d}-FULL.mp4')
        size = f'{os.path.getsize(mp4)//1024//1024}MB' if os.path.exists(mp4) else '未渲染'
        if not os.path.exists(vtt):
            lines.append(f'── EP{ep} · {size} ── 字幕缺失，跳过')
            continue
        cues = R.parse_vtt(vtt)
        hook = pick_hook(cues) or 'The system strikes again'
        dur = max((e for _, e, _ in cues), default=0)
        lines.append('')
        lines.append(f'── EP{ep} · {size} · 约{int(dur//60)}分{int(dur%60):02d}秒 ──')
        lines.append(f'文件：视频-烧录英字/{EN}-EP{ep:02d}-FULL.mp4')
        lines.append(f'【标题】I Have a SYSTEM — EP{ep} FULL | {hook}')
        lines.append('【说明】（整段复制）')
        lines.append(f'  EP{ep} FULL with English subtitles.')
        lines.append(f'  {hook}.')
        lines.append('  New episodes & the FINALE are ONLY on yt688 👉 https://yt688.app/drama/u06.html')
        lines.append('  #shorts #shortdrama #cdrama #minidrama')
    path = os.path.join(OUT_DIR, '上传文案表-EP4起.txt')
    open(path, 'w').write('\n'.join(lines) + '\n')
    print('written', path)

if __name__ == '__main__':
    main()
