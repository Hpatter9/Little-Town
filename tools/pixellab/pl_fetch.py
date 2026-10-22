"""Download each look's character zip (rotations and animations) into pl/chars/<look>/."""
import io
import json
import subprocess
import sys
import time
import zipfile

meta = json.load(open('pl/looks.json'))
names = sys.argv[1:] or list(meta)
for n in names:
    cid = meta[n]['character_id']
    for attempt in range(5):
        data = subprocess.run(['curl', '-sS', f'https://api.pixellab.ai/v2/characters/{cid}/zip'], capture_output=True, check=True).stdout
        if data[:2] == b'PK':
            zipfile.ZipFile(io.BytesIO(data)).extractall(f'pl/chars/{n}')
            print(n, 'ok')
            break
        print(n, 'retry', data[:160])
        time.sleep(5 * (attempt + 1))
