#!/usr/bin/env python3
"""Check that every topic has a nonempty MP3; no external dependencies."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
missing = []
for topic in json.loads((root / 'topics.json').read_text()):
    path = root / 'assets/audio' / f"{topic['id']}.mp3"
    if not path.is_file() or path.stat().st_size < 1000:
        missing.append(topic['id'])
if missing:
    raise SystemExit(f'{len(missing)} missing/empty clips: ' + ', '.join(missing))
print('All 300 topic recordings are present.')
