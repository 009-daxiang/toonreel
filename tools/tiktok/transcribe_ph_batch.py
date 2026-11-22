#!/usr/bin/env python3
"""Transcribe specific episode files for the PH launch batch."""
import json
import os
import sys
import time

import faster_whisper

ROOT = '/Users/daxiang/.zcode/workspace/default/toonreel'
TRANS = f'{ROOT}/tools/tiktok/transcripts'
VIDS = f'{ROOT}/tools/tiktok/source_videos'

JOBS = [  # (audio_path, out_transcripts_dir, out_name)
    (f'{VIDS}/doommadman-ep1.mp4', f'{TRANS}/末日疯子：尸潮之下', 'ep0001'),
    (f'{VIDS}/doommadman-ep2.mp4', f'{TRANS}/末日疯子：尸潮之下', 'ep0002'),
    (f'{VIDS}/doommadman-ep3.mp4', f'{TRANS}/末日疯子：尸潮之下', 'ep0003'),
    (f'{TRANS}/../source_videos/shark-ep3.mp4', f'{TRANS}/鲨口逃生', 'ep0003'),
]

MODEL = faster_whisper.WhisperModel('small', device='cpu', compute_type='int8')

for audio, outdir, name in JOBS:
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f'{name}.json')
    if os.path.exists(out):
        print(f'skip {name} (exists)', flush=True)
        continue
    t0 = time.time()
    segments, info = MODEL.transcribe(audio, language='zh', beam_size=5,
                                      vad_filter=True,
                                      vad_parameters={'min_silence_duration_ms': 400})
    segs = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()}
            for s in segments]
    json.dump({'file': os.path.basename(audio), 'ep': int(name[2:]),
               'duration': round(info.duration, 1), 'segments': segs},
              open(out, 'w'), ensure_ascii=False)
    print(f'{name}: {len(segs)} segs in {time.time()-t0:.0f}s', flush=True)

print('TRANSCRIBE DONE', flush=True)
