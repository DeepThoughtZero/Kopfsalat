#!/usr/bin/env python3
"""Generate portable Dylan voice clips with the local Qwen3-TTS service."""
import argparse
import fcntl
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint', default='http://127.0.0.1:8880/v1/audio/speech')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    topics = json.loads((ROOT / 'topics.json').read_text())
    output = ROOT / 'assets/audio'
    output.mkdir(parents=True, exist_ok=True)
    failed = []
    for index, topic in enumerate(topics[:args.limit], 1):
        target = output / f"{topic['id']}.mp3"
        if target.exists() and target.stat().st_size > 1000 and not args.force:
            continue
        text = topic['text'].strip()
        if text.endswith('...'):
            text = 'Ergänze den Satz: ' + text[:-3].rstrip() + '.'
        if not text.endswith(('.', '?', '!')):
            text += '.'
        payload = json.dumps(dict(model='qwen3-tts', input=text, voice='dylan',
            language='german', response_format='mp3', speed=1.0,
            instruct='Speak in German, clearly and naturally, like a cheerful game host. Speak quickly and fluently.')).encode()
        for attempt in range(3):
            try:
                request = urllib.request.Request(args.endpoint, data=payload, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(request, timeout=240) as response:
                    audio = response.read()
                with tempfile.NamedTemporaryFile(suffix='.mp3') as raw:
                    raw.write(audio)
                    raw.flush()
                    temp = target.with_suffix('.tmp.mp3')
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw.name,
                        '-map_metadata', '-1', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '24000',
                        '-b:a', '64k', str(temp)], check=True)
                    if temp.stat().st_size < 1000:
                        raise ValueError('Audio file is empty')
                    temp.replace(target)
                print(f"{index}/{len(topics)} {topic['id']}", flush=True)
                break
            except Exception as error:
                print(f"Retry {attempt + 1}: {topic['id']}: {error}", flush=True)
                time.sleep(2)
        else:
            failed.append(topic['id'])
    if failed:
        raise SystemExit('Failed: ' + ', '.join(failed))
    print('Audio generation complete.', flush=True)

if __name__ == '__main__':
    # One writer at a time, including after an interrupted terminal session.
    with (ROOT / '.audio-generation.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('An audio generation process is already running.')
        main()
