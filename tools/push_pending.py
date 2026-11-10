#!/usr/bin/env python3
"""Push pending drama commits to GitHub, one commit at a time,
with long retry window. Safe to rerun — resumes where it stopped."""
import subprocess, os, sys, time

TOKEN = os.environ.get("GH_TOKEN") or input("GitHub token: ")
ENV = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
REMOTE = f'https://{TOKEN}@github.com/009-daxiang/toonreel.git'

def run(cmd, timeout=None):
    return subprocess.run(cmd, env=ENV, capture_output=True, text=True, timeout=timeout)

run(['git', 'fetch', 'origin', 'main'], timeout=120)
log = run(['git', 'log', 'origin/main..main', '--reverse', '--format=%H %s'])
todo = [line.split(' ', 1) for line in (log.stdout or '').strip().splitlines() if line]
print(f'{len(todo)} unpushed commits:', [t[1][:40] for t in todo], flush=True)

deadline = time.time() + 2 * 3600
i = 0
while i < len(todo) and time.time() < deadline:
    sha, msg = todo[i]
    print(f'pushing commit {i+1}/{len(todo)}: {msg[:44]}', flush=True)
    r = run(['git', 'push', REMOTE, f'{sha}:refs/heads/main'], timeout=900)
    if r.returncode == 0:
        print('  OK pushed', flush=True)
        i += 1
        continue
    print(f'  FAIL {r.stderr.strip()[-100:]}', flush=True)
    print('  cooling down 180s...', flush=True)
    time.sleep(180)

if i >= len(todo):
    print('ALL COMMITS PUSHED', flush=True)
else:
    print(f'PAUSED at {i}/{len(todo)} — rerun to resume', flush=True)
    sys.exit(1)
