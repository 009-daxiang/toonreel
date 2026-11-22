#!/usr/bin/env python3
"""YT688 TikTok clip pipeline — step 2: score dialogue windows & propose candidates.
Usage: python3 select_segments.py <drama> ...
Output: tools/tiktok/candidates/<drama>.json — top windows per episode with full text,
for manual (model) review before final clip selection."""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TRANS = os.path.join(HERE, "transcripts")
CAND = os.path.join(HERE, "candidates")
os.makedirs(CAND, exist_ok=True)

KW3 = ["滚", "跪下", "杀了", "打死", "你敢", "废物", "混蛋", "蠢货", "贱人", "不配",
       "做梦", "休想", "救命", "放开", "后悔", "求你", "求饶", "破产", "离婚", "退婚",
       "报复", "揭穿", "真面目", "算什么东西", "认错", "背叛", "毁容", "下毒", "绑"]
KW25 = ["大佬", "总裁", "少爷", "首富", "隐藏", "系统", "真实身份", "打脸", "千金",
        "继承", "未婚夫", "赘婿", "战神", "神医", "龙王", "身份", "现场", "证据"]
KW15 = ["鬼", "诡", "死人", "凶", "快跑", "小心", "危险", "血", "尸", "阴", "邪",
        "仙", "出马", "保镖", "绑架", "中毒", "凶手", "尸变", "棺", "坟"]
KW1 = ["不可能", "居然", "竟然", "敢", "凭什么", "我要", "马上", "立刻", "你们",
       "真", "完", "死", "别", "过来", "答应", " condition"]

def line_score(text):
    s = 0.3
    for k in KW3:
        if k in text:
            s += 3
    for k in KW25:
        if k in text:
            s += 2.5
    for k in KW15:
        if k in text:
            s += 1.5
    for k in KW1:
        if k in text:
            s += 1
    if text.endswith(("！", "？", "!")):
        s += 0.5
    return s

def windows(segs):
    """Consecutive-line windows with duration 28–45s; yield (i, j, dur, score)."""
    out = []
    n = len(segs)
    for i in range(n):
        score = 0.0
        for j in range(i, n):
            dur = segs[j]["end"] - segs[i]["start"]
            if dur > 46:
                break
            score += line_score(segs[j]["text"])
            if dur >= 27 and j > i:
                # 轻微惩罚：贴着片头（前5s）与片尾（最后4s）
                pen = 0
                if segs[i]["start"] < 4:
                    pen += 1.5
                out.append((i, j, dur, score - pen))
    return out

def top_for_episode(ep_data, per_ep=2):
    segs = ep_data["segments"]
    if len(segs) < 3:
        return []
    cands = sorted(windows(segs), key=lambda x: -x[3])
    picked = []  # (start_time, end_time)
    picked_idx = []  # (i, j)
    for i, j, dur, sc in cands:
        if any(not (segs[j]["end"] <= a or segs[i]["start"] >= b)
               for a, b in picked):
            continue
        picked.append((segs[i]["start"], segs[j]["end"]))
        picked_idx.append((i, j))
        if len(picked) >= per_ep:
            break
    res = []
    for i, j in picked_idx:
        res.append({
            "ep": ep_data["ep"], "start": segs[i]["start"], "end": segs[j]["end"],
            "dur": round(segs[j]["end"] - segs[i]["start"], 1),
            "score": round(sum(line_score(s["text"]) for s in segs[i:j + 1]), 1),
            "lines": [{"start": s["start"], "end": s["end"], "text": s["text"]}
                      for s in segs[i:j + 1]],
        })
    return res

def process(drama):
    drama_dir = os.path.join(TRANS, drama)
    out = []
    for f in sorted(os.listdir(drama_dir)):
        if not f.endswith(".json") or f == f"{drama}.sample.json":
            continue
        data = json.load(open(os.path.join(drama_dir, f)))
        out.extend(top_for_episode(data))
    out.sort(key=lambda x: -x["score"])
    json.dump(out, open(os.path.join(CAND, f"{drama}.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{drama}: {len(out)} candidates, top score {out[0]['score'] if out else '-'}")

if __name__ == "__main__":
    for d in sys.argv[1:]:
        process(d)
