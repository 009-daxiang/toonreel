#!/bin/bash
# 每日 9:00 由 launchd 拉起：防睡眠 + 跑转写（脚本自带 17:00 闸门）
caffeinate -i python3 /Users/daxiang/.zcode/workspace/default/toonreel/tools/tiktok/transcribe_all_eps.py >> /Users/daxiang/.zcode/workspace/default/toonreel/tools/tiktok/transcribe_window.log 2>&1
