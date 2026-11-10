#!/usr/bin/env python3
"""Complete push recovery: add any uncommitted drama folders (forced),
then push every unpushed commit one by one with retries.
Safe to rerun. Token via GH_TOKEN env var."""
import subprocess, os, sys, time, re

TOKEN = os.environ.get('GH_TOKEN')
if not TOKEN:
    print('set GH_TOKEN env var first', flush=True)
    sys.exit(1)
ENV = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
REMOTE = f'https://{TOKEN}@github.com/009-daxiang/toonreel.git'

def run(cmd, timeout=None):
    return subprocess.run(cmd, env=ENV, capture_output=True, text=True, timeout=timeout)

def list_remote_commits():
    run(['git', 'fetch', REMOTE, 'main:refs/remotes/origin/main'], timeout=180)
    log = run(['git', 'log', 'origin/main..main', '--reverse', '--format=%H %s'])
    return [line.split(' ', 1) for line in (log.stdout or '').strip().splitlines() if line]

def push_sha(sha):
    return run(['git', 'push', REMOTE, f'{sha}:refs/heads/main'], timeout=900)

# ---- 1) commit any drama folders not yet in git ----
st = run(['git', 'status', '--porcelain', 'uploads/'])
unstaged_dirs = set()
for line in (st.stdout or '').splitlines():
    if line.startswith('??') and 'uploads/' in line:
        parts = line.strip('"').split('/')
        if len(parts) > 1 and parts[0] == 'uploads':
            unstaged_dirs.add(parts[1])
if unstaged_dirs:
    print('committing new drama folders:', unstaged_dirs, flush=True)
    for d in unstaged_dirs:
        run(['git', 'add', '-f', f'uploads/{d}'])
    run(['git', '-c', 'user.name=toonreel-bot', '-c', 'user.email=deploy@toonreel.app',
         'commit', '-q', '-m', 'Publish additional dramas'])

# ---- 2) push every unpushed commit, one at a time ----
deadline = time.time() + 2 * 3600
while time.time() < deadline:
    todo = list_remote_commits()
    if not todo:
        print('ALL COMMITS PUSHED — repo is up to date', flush=True)
        sys.exit(0)
    sha, msg = todo[0]
    print(f'pushing: {msg[:50]} ({sha[:7]})', flush=True)
    r = push_sha(sha)
    if r.returncode == 0:
        print('  OK', flush=True)
        continue
    print(f'  FAIL: {r.stderr.strip()[-90:]}', flush=True)
    print('  cooling down 180s, will retry...', flush=True)
    time.sleep(180)

print('TIMEBOX REACHED — rerun to continue', flush=True)
sys.exit(1)
