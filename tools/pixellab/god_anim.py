"""Animate the God creatures with the mannequin's template moves: one direction a job, resumable through
pl/creature_state.json. Usage: SLOTS=6 python3 god_anim.py wolf ape ..."""
import json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
import pl
MOVES = {'walk': 'walking', 'run': 'running-6-frames', 'idle': 'breathing-idle', 'pickup': 'picking-up',
         'throw': 'throw-object', 'push': 'pushing', 'pull': 'pull-heavy-object', 'eat': 'drinking',
         'punch': 'cross-punch', 'uppercut': 'surprise-uppercut', 'hit': 'taking-punch', 'death': 'falling-back-death',
         'getup': 'getting-up', 'miracle': 'fireball', 'joy': 'jumping-1', 'sad': 'sad-walk'}
DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
ST = 'pl/creature_state.json'
st = json.load(open(ST)); lock = threading.Lock()
def save():
    with lock: json.dump(st, open(ST + '.tmp', 'w'), indent=1); os.replace(ST + '.tmp', ST)
def log(*a):
    line = time.strftime('%H:%M:%S ') + ' '.join(map(str, a)); print(line, flush=True)
def job(body, tries=6):
    for t in range(tries):
        try: r = pl.call('POST', '/characters/animations', body)
        except ValueError: r = {'detail': 'empty answer'}
        if 'detail' in r and 'already has' in str(r['detail']): return {'animation_group_id': body.get('animation_group_id')}
        if 'detail' in r: log('  refused', str(r)[:160]); time.sleep(30 * (t + 1)); continue
        res = [pl.wait(j, every=10, limit=1200) for j in (r.get('background_job_ids') or [r.get('background_job_id')])]
        if all(x.get('status') == 'completed' for x in res): return r
        log('  failed', str(res[-1].get('last_response'))[:160]); time.sleep(30 * (t + 1))
    return None
def anim(kind, move):
    s = st[f'god_{kind}']; m = s.setdefault(move, {'done': [], 'group': None})
    for d in DIRS:
        if d in m['done']: continue
        body = {'mode': 'template', 'template_animation_id': MOVES[move], 'character_id': s['character_id'], 'animation_name': move, 'directions': [d]}
        if m['group']: body['animation_group_id'] = m['group']
        r = job(body)
        if not r: log(kind, move, d, 'GAVE UP'); continue
        m['group'] = m['group'] or r.get('animation_group_id'); m['done'].append(d); save()
    log(kind, move, 'done', len(m['done']))
if __name__ == '__main__':
    only = os.environ.get('MOVES_ONLY')
    jobs = [(k, mv) for k in sys.argv[1:] for mv in MOVES if not only or mv in only.split(',')]
    with ThreadPoolExecutor(int(os.environ.get('SLOTS', '1'))) as ex: list(ex.map(lambda j: anim(*j), jobs))
    log('FINISHED', ' '.join(sys.argv[1:]))
