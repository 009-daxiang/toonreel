#!/bin/bash
# yt688 字幕部署：同步 VTT → VPS 重建清单 → 同步升 SUB_RELEASE → 线上验证
# 前提：/var/www/yt688 已 chown 给 yt688sshAdmin（一次性 sudo）
set -e
VPS="yt688sshAdmin@107.173.35.78"
SSH="ssh -p 5256 -o BatchMode=yes"
cd "$(dirname "$0")/.."

echo "== 1/4 同步字幕文件 =="
rsync -av --update -e "$SSH" subtitles/ "$VPS":/var/www/yt688/subtitles/ | tail -3

echo "== 2/4 重建字幕清单 =="
$SSH $VPS 'python3 - <<EOF
import json, os, re
root = "/var/www/yt688/subtitles"
index = {}
for sid in sorted(os.listdir(root)):
    d = os.path.join(root, sid)
    if not os.path.isdir(d):
        continue
    for f in os.listdir(d):
        m = re.match(r"ep(\d+)\.([a-z]{2,3})\.vtt$", f)
        if not m:
            continue
        ep = m.group(1).lstrip("0") or "0"
        index.setdefault(sid, {}).setdefault(ep, [])
        if m.group(2) not in index[sid][ep]:
            index[sid][ep].append(m.group(2))
out = {sid: {ep: sorted(langs) for ep, langs in sorted(eps.items(), key=lambda kv: int(kv[0]))}
       for sid, eps in index.items()}
json.dump(out, open("/var/www/yt688/data/subtitles.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("manifest:", len(out), "shows,", sum(len(e) for e in out.values()), "episodes")
EOF'

echo "== 3/4 升级 SUB_RELEASE =="
REL="$(date +%Y%m%d%H%M)cc1"
$SSH $VPS "REL=$REL python3 -" <<'PY'
import os, re
REL = os.environ["REL"]
for path, name in [("/var/www/yt688/sw.js", "subtitleRelease"),
                   ("/var/www/yt688/js/watch.js", "SUB_RELEASE")]:
    s = open(path).read()
    s2 = re.sub(rf"const {name} = '[^']*';", f"const {name} = '{REL}';", s)
    assert s2 != s, f"pattern not found in {path}"
    open(path, "w").write(s2)
    print(path, "->", REL)
PY

echo "== 4/4 线上验证 =="
sleep 2
curl -s -o /dev/null -w "subtitles.json  HTTP %{http_code}  %{size_download}B\n" "https://yt688.app/data/subtitles.json?v=$REL"
curl -s -o /dev/null -w "u02/ep4.en.vtt  HTTP %{http_code}\n" "https://yt688.app/subtitles/u02/ep4.en.vtt"
echo "部署完成"
