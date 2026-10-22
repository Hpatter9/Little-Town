"""A small PixelLab API client (https://api.pixellab.ai/v2). The key lives in the environment's
network secrets for api.pixellab.ai, so requests carry no token of their own here."""
import base64
import io
import json
import subprocess
import time

from PIL import Image

BASE = 'https://api.pixellab.ai/v2'


def call(method, path, body=None):
    cmd = ['curl', '-sS', '-X', method, BASE + path, '-H', 'Content-Type: application/json']
    if body is not None:
        cmd += ['--data-binary', '@-']
    data = json.dumps(body).encode() if body is not None else None
    # A status poll can come back empty or cut off now and then: polls are retried (a POST is not,
    # so a job is never started twice).
    for attempt in range(6):
        out = subprocess.run(cmd, input=data, capture_output=True).stdout
        try:
            return json.loads(out)
        except ValueError:
            if method != 'GET' or attempt == 5:
                raise
            time.sleep(3 * (attempt + 1))


def b64(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def unb64(d):
    if isinstance(d, dict):
        d = d.get('base64')
    return Image.open(io.BytesIO(base64.b64decode(d))).convert('RGBA')


def wait(job_id, every=8, limit=900):
    t0 = time.time()
    while True:
        r = call('GET', f'/background-jobs/{job_id}')
        if r.get('status') in ('completed', 'failed') or time.time() - t0 > limit:
            return r
        time.sleep(every)
