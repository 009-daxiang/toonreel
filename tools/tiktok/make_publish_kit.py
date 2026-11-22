#!/usr/bin/env python3
"""YT688 TikTok pipeline — step 7: publish kit.
Reads select/ + prep/ and generates:
  ~/Desktop/YT688_TikTok_v2/00_发布文案清单.txt   — captions + hashtags per file, posting plan
  ~/Desktop/YT688_TikTok_v2/00_片段清单.csv       — machine-readable manifest of every clip
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SEL = os.path.join(HERE, "select")
PREP = os.path.join(HERE, "prep")
OUT = os.path.expanduser("~/Desktop/YT688_TikTok_v2")

LANG_ORDER = ["EN", "TH", "VI", "ID", "MS", "FIL"]
LANG_NAME = {"EN": "English", "TH": "ไทย Thai", "VI": "Tiếng Việt",
             "ID": "Bahasa Indonesia", "MS": "Bahasa Melayu", "FIL": "Filipino"}

DRAMA_EN = {
    "鲨口逃生": "Shark Escape",
    "蚀骨罪": "Bone-Deep Sin",
    "退役归来，这个保镖不好惹": "The Retired Bodyguard",
    "重生！丑小鸭逆袭成了万人迷": "Reborn: Ugly Duckling",
    "一身腱子肉，乱世做谋臣": "Muscle Strategist",
    "摊牌了我真的有系统": "I Have a System",
    "东北异事之出马诡堂": "Northeast Spirit Altar",
    "永冬之下，冻土之上": "The Eternal Winter",
    "乌鸦掉进凤凰窝，我成了冥凤小公主": "Crow in the Phoenix Nest",
}

rows = []
for f in sorted(os.listdir(SEL)):
    if not f.endswith(".json"):
        continue
    drama = f[:-5]
    sel = json.load(open(os.path.join(SEL, f)))
    prep = json.load(open(os.path.join(PREP, f"{drama}.lines.json")))
    for k, clip in enumerate(prep):
        for lang in LANG_ORDER:
            fn = f"{drama.replace('，','')}-EP{clip['ep']}-c{k}-{lang}.mp4"
            rows.append({
                "file": fn, "folder": lang, "language": LANG_NAME[lang],
                "drama_zh": drama, "drama_en": DRAMA_EN.get(drama, ""),
                "episode": clip["ep"], "clip": k + 1,
                "start_sec": clip["start"], "end_sec": clip["end"],
                "dur_sec": clip["dur"],
                "hook": clip["hook"][lang.lower()],
                "caption": clip["caption"][lang.lower()],
            })

rows.sort(key=lambda r: (LANG_ORDER.index(r["folder"]), r["drama_zh"], r["clip"]))

with open(os.path.join(OUT, "00_片段清单.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

L = []
L.append("═══════════════════════════════════════════")
L.append("  YT688 TikTok 发布方案 v2（18 片段 × 6 语言 = 108 条）")
L.append("═══════════════════════════════════════════")
L.append("")
L.append("【准备：账号一次性设置】")
L.append("① 头像：~/Desktop/YT688_avatar.png；昵称建议：YT688 | Free Mini Dramas")
L.append("② bio：Watch FULL dramas FREE 👉 yt688.app （新号描述放不了链接，链接必须放 bio）")
L.append("③ 开通 TikTok Studio（创作者工具），绑定 GA4 实时报告观察点击效果")
L.append("④ 视频文件位置：桌面/YT688_TikTok_v2/{EN,TH,VI,ID,MS,FIL}/ 六个文件夹")
L.append("")
L.append("【发布节奏】")
L.append("· 每天 2 条：1 条英文 + 1 条当地语言（见下方日历）")
L.append("· 同语言间隔 ≥3 小时；同一部剧同一语言错开至少 2 天")
L.append("· 黄金时段（按目标市场当地时间）：ID/MS 12:00 与 19:00；TH 18:00-22:00；")
L.append("  VI 12:00 与 20:00；FIL 18:00-23:00；EN 早上 7-9 点（欧美）")
L.append("· 完整 54 天日历 = 下方清单按顺序发即可（先 EN+当地语交错，效果好的剧加发第二片段）")
L.append("")
L.append("【每条视频操作】")
L.append("① Studio → 上传视频 → 选文件（文件名里已含 剧名/集数/语言）")
L.append("② 描述文案 = 下面对应条目的 caption（直接复制粘贴）")
L.append("③ 封面：选画面冲击力最强的一帧（一般是对峙/落水/特写帧）")
L.append("④ 不需要再添加站内字幕（视频已烧录该语言字幕）；音乐保留原声即可")
L.append("⑤ 评论区置顶：Full & FREE at yt688.app（用对应语言写）")
L.append("")

# ---- 54 天日历 ----
L.append("【54 天发布日历（每天 2 条）】")
L.append("· 上 午 = 当天第一个文件；下 午/晚 = 第二个文件（间隔 ≥3 小时）")
L.append("· 结构：第 1-27 天发每部剧的片段①（6 语言），第 28-54 天发片段②")
L.append("· 语言对轮换：第 1 天 EN+TH，第 2 天 VI+ID，第 3 天 MS+FIL，第 4 天又从 EN+TH 起")
L.append("")
day = 0
by_key = {(r["drama_zh"], r["clip"]): r for r in rows}  # per lang one row each
dramas_sorted = list(dict.fromkeys(r["drama_zh"] for r in rows))
lang_pairs = [("EN", "TH"), ("VI", "ID"), ("MS", "FIL")]
for phase, clip_no in (("一", 1), ("二", 2)):
    for drama in dramas_sorted:
        for pair in lang_pairs:
            day += 1
            files = []
            for lang in pair:
                r = [x for x in rows if x["drama_zh"] == drama and x["clip"] == clip_no
                     and x["folder"] == lang]
                files.append(r[0]["file"] if r else "?")
            L.append(f"第 {day:>2} 天（阶段{phase}）：上午 {files[0]}   下午/晚 {files[1]}")
L.append("")
L.append("注：哪部剧的数据先爆（完播率/点赞率高），就把它的另一个片段和其余语言提前发。")
L.append("【数据复盘（每天 5 分钟）】")
L.append("· TikTok Analytics：完播率 >40% 或点赞率 >5% 的剧 = 爆款候选，加发它的另一个片段")
L.append("· GA4 实时报告：发完 30 分钟内看 yt688.app 有无新访问（生物页链接点击）")
L.append("· 连续 2 条 <200 播放 = 该语言/时段换时间重试；不要删除视频，设为私密即可")
L.append("")
L.append("【防限流注意】")
L.append("· 不要用同一个 TikTok 账号一小时内发多条；文案不要逐字重复（本清单已按剧差异化）")
L.append("· 同一视频文件不要二次上传（TikTok 查重）；引流水太多账号会被降权——保持正常刷/点赞行为")
L.append("")
cur_lang = None
for r in rows:
    if r["folder"] != cur_lang:
        cur_lang = r["folder"]
        L.append("")
        L.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        L.append(f"  文件夹 {cur_lang}／{r['language']}（{sum(1 for x in rows if x['folder']==cur_lang)} 条）")
        L.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    L.append("")
    L.append(f"▸ {r['file']}  ({r['drama_en']} · 第{r['episode']}集 {r['start_sec']:.0f}-{r['end_sec']:.0f}s · {r['dur_sec']:.0f}秒)")
    L.append(f"  钩子（视频内已烧录）：{r['hook']}")
    cap_lines = r["caption"].split("\n")
    L.append("  描述文案（复制到 TikTok）：")
    for cl in cap_lines:
        L.append(f"    {cl}")

open(os.path.join(OUT, "00_发布文案清单.txt"), "w").write("\n".join(L))
print(f"publish kit written: {len(rows)} rows")
