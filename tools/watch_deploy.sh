#!/bin/bash
# yt688 字幕部署看护：等权限 → 首次部署 → 等生成完 → 最终部署
SSH="ssh -p 5256 -o BatchMode=yes -o ConnectTimeout=8 yt688sshAdmin@107.173.35.78"
REPO=/Users/daxiang/.zcode/workspace/default/toonreel
cd "$REPO"
echo "[watcher] 等待 VPS 写权限（每30秒检测一次）..."
n=0
until $SSH 'touch /var/www/yt688/subtitles/.wtest 2>/dev/null && rm -f /var/www/yt688/subtitles/.wtest' 2>/dev/null; do
  sleep 30
  n=$((n+1))
  if [ $n -gt 1440 ]; then echo "[watcher] 等待超12小时，退出"; exit 1; fi
done
echo "[watcher] 写权限OK，首次部署 $(date '+%m-%d %H:%M')"
bash tools/deploy_subs.sh
echo "[watcher] 等待字幕生成完成..."
sleep 60   # 等当前批次落盘，避免误判刚启动的进程
while pgrep -f "build_subtitles.py" > /dev/null; do sleep 120; done
echo "[watcher] 生成结束，最终全量部署 $(date '+%m-%d %H:%M')"
bash tools/deploy_subs.sh
echo "[watcher] 全部完成"
