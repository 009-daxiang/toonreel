#!/usr/bin/env python3
"""
YT688 — bulk upload dramas from external drive to Cloudflare R2.
Run (by ZCode) after the user provides R2 credentials:

  python3 tools/upload_r2.py \
    --account <account_id> --key <access_key_id> --secret <secret_access_key> \
    --bucket yt688-videos --public https://pub-xxxx.r2.dev \
    --src "/Volumes/NEWSMY 1" [--only id1,id2,...]

Behavior:
  • walks the drive, uploads every drama's mp4 + cover.jpg
    to  uploads/<drama-name>/<file>  (UTF-8 keys)
  • 8 concurrent workers, 3 retries per file, resumes by skipping
    files already present in the bucket
  • after upload: rewrites data/catalog.json pointing videos at the
    public base URL and prints a summary
"""
import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.request

import boto3
from botocore.config import Config

EP_RE = re.compile(r"第(\d+)集")
p = argparse.ArgumentParser()
p.add_argument('--account', required=True)
p.add_argument('--key', required=True)
p.add_argument('--secret', required=True)
p.add_argument('--bucket', default='yt688-videos')
p.add_argument('--public', required=True, help='public base URL, e.g. https://pub-xxxx.r2.dev')
p.add_argument('--src', default='/Volumes/NEWSMY 1')
p.add_argument('--catalog', default='data/catalog.json')
p.add_argument('--workers', type=int, default=8)
p.add_argument('--only', default='', help='comma separated drama ids to upload (default: all)')
args = p.parse_args()

s3 = boto3.client('s3', endpoint_url=f'https://{args.account}.r2.cloudflarestorage.com',
                  aws_access_key_id=args.key, aws_secret_access_key=args.secret,
                  config=Config(retries={'max_attempts': 3}, connect_timeout=30, read_timeout=600))

# --- collect dramas from the drive ---
EP = re.compile(r'第(\d+)集')
dramas = []
for name in sorted(os.listdir(args.src)):
    d = os.path.join(args.src, name)
    if not os.path.isdir(d) or name.startswith(('$', 'System')):
        continue
    vids, cover = [], None
    for f in os.listdir(d):
        if f.startswith('.'):
            continue
        fp = os.path.join(d, f)
        if f.lower().endswith('.mp4') and os.path.getsize(fp) > 512 * 1024:
            vids.append(f)
        elif f.lower() in ('cover.jpg', 'cover.png'):
            cover = f
    if not vids:
        continue
    vids.sort(key=lambda f: int(EP.search(f).group(1)) if EP.search(f) else 9999)
    dramas.append({'name': name, 'vids': vids, 'cover': cover})

if args.only:
    keep = set(args.only.split(','))
    dramas = [d for d in dramas if d['name'] in keep]

total_files = sum(len(d['vids']) + (1 if d['cover'] else 0) for d in dramas)
total_gb = sum(sum(os.path.getsize(os.path.join(args.src, d['name'], f))
                   for f in d['vids']) / 1024**3 for d in dramas)
print(f"=== {len(dramas)} dramas, {total_files} files, {total_gb:.1f} GB to upload ===", flush=True)

# --- existing keys (resume support) ---
existing = set()
try:
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=args.bucket):
        for obj in page.get('Contents', []):
            existing.add(obj['Key'])
    print(f"bucket has {len(existing)} existing objects — skipped automatically", flush=True)
except Exception as e:
    print("list failed (fresh bucket?):", e, flush=True)

# --- upload workers ---
done, failed = 0, []
lock_print = __import__('threading').Lock()
t_start = time.time()

def upload(job):
    global done
    key, path = job
    for attempt in range(3):
        try:
            s3.upload_file(path, args.bucket, key,
                           Callback=lambda sent, total, k=key: None)
            with lock_print:
                done += 1
                gb = done and 0
                print(f"[{done}/{total_files}] {key}", flush=True)
            return True
        except Exception as e:
            if attempt == 2:
                with lock_print:
                    print(f"FAILED {key}: {e}", flush=True)
                return False
            time.sleep(5 * (attempt + 1))

jobs = []
for d in dramas:
    for f in d['vids']:
        key = f"uploads/{d['name']}/{f}"
        if key in existing:
            continue
        jobs.append((key, os.path.join(args.src, d['name'], f)))
    if d['cover']:
        key = f"uploads/{d['name']}/{d['cover']}"
        if key not in existing:
            jobs.append((key, os.path.join(args.src, d['name'], d['cover'])))

with concurrent.futures.ThreadPoolExecutor(args.workers) as ex:
    for r in ex.map(upload, jobs):
        if r is False:
            failed.append(True)

print(f"\nupload finished in {(time.time()-t_start)/60:.0f} min — failed: {len(failed)}", flush=True)

# --- rebuild catalog pointing at R2 ---
cat_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', args.catalog)
catalog = {'shows': []}
if os.path.exists(cat_path):
    try:
        catalog = json.load(open(cat_path, encoding='utf-8'))
    except Exception:
        pass

base = args.public.rstrip('/')
for i, d in enumerate(dramas):
    vids = [f"{base}/uploads/{d['name']}/{f}" for f in d['vids']]
    entry = {
        "id": f"r{i+1:03d}", "title": d['name'], "tagline": "", "desc": "",
        "genres": ["短剧"], "episodes": len(vids), "rating": 9.0,
        "status": "Completed", "badge": "", "year": 2026,
        "popularity": 500000 + i,
        "poster": f"{base}/uploads/{d['name']}/{d['cover']}" if d['cover'] else "",
        "videos": vids,
    }
    catalog['shows'] = [s for s in catalog['shows'] if s.get('title') != d['name']]
    catalog['shows'].append(entry)

catalog['shows'].sort(key=lambda s: -s.get('popularity', 0))
with open(cat_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=1)
print(f"catalog updated: {len(catalog['shows'])} shows total → commit & deploy", flush=True)
