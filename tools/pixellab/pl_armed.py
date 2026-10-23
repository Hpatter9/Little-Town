"""Axe and hammer looks for the peoples' own casts, like pl_batch.py's armed(): the tool edited into the look's south
view, turned to 8 directions, then a v3 text move (chop or hammer). Resumable through pl/armed_state.json.

    SLOTS=4 python3 pl_armed.py orcs:orc_brute:axe ...     # people:look:tool items
    python3 pl_armed.py all                                 # every cast look, both tools
"""
import json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import pl
from pl_people import CASTS
from pl_batch import WEAPONS, NO_FX

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
STATE = 'pl/armed_state.json'
state = json.load(open(STATE)) if os.path.exists(STATE) else {}
looks = {**json.load(open('pl/people_state.json')), **json.load(open('pl/people_looks_state.json'))}
lock = threading.Lock()
def save():
    with lock: json.dump(state, open(STATE + '.tmp', 'w'), indent=1); os.replace(STATE + '.tmp', STATE)
def log(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)
def job(path, body, tries=6):
    for t in range(tries):
        try: r = pl.call('POST', path, body)
        except ValueError: r = {'detail': 'empty answer'}
        if 'detail' in r and 'already has' in str(r['detail']): return {'animation_group_id': body.get('animation_group_id')}, []
        if 'detail' in r: log('  refused', str(r)[:160]); time.sleep(30 * (t + 1)); continue
        res = [pl.wait(j, every=10, limit=1200) for j in (r.get('background_job_ids') or [r.get('background_job_id')])]
        if all(x.get('status') == 'completed' for x in res):
            log('  usage', path.split('/')[-1], [x.get('usage') for x in res]); return r, res
        log('  failed', str(res[-1].get('last_response'))[:160]); time.sleep(30 * (t + 1))
    return None, None
def armed(people, look, tool):
    hold, move, action = WEAPONS[tool]
    key = f'{look}+{tool}'; st = state.setdefault(key, {})
    if not st.get('character_id'):
        if not st.get('edited'):
            south = Image.open(f'pl/chars/{people}_{look}/Idle/rotations/south.png').convert('RGBA'); w, h = south.size
            r, res = job('/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': w, 'height': h}, 'no_background': True,
                'edit_images': [{'image': pl.b64(south), 'width': w, 'height': h}],
                'description': f'The character {hold}; keep the body, clothes, face and hair exactly the same.'})
            if not r: log(key, 'edit GAVE UP'); return
            pl.unb64(res[0]['last_response']['images'][0]).save(f'pl/armed_{key}.png'); st['edited'] = True; save(); log(key, 'edited')
        if os.environ.get('EDIT_ONLY'): return
        r, res = job('/create-character-v3', {'description': f"{CASTS[people][look][2]}, {hold}",
            'reference_image': pl.b64(Image.open(f'pl/armed_{key}.png')), 'n_directions': 8, 'view': 'low top-down',
            'template_id': 'mannequin', 'name': f'{people} {key}', 'no_background': True})
        if not r: log(key, 'rotate GAVE UP'); return
        st['character_id'] = r['character_id']; save(); log(key, 'made', r['character_id'])
    m = st.setdefault(move, {'done': [], 'group': None})
    for d in DIRS:
        if d in m['done']: continue
        body = {'mode': 'v3', 'frame_count': 8, 'action_description': action + NO_FX, 'character_id': st['character_id'], 'animation_name': move, 'directions': [d]}
        if m['group']: body['animation_group_id'] = m['group']
        r, _ = job('/characters/animations', body)
        if not r: log(key, move, d, 'GAVE UP'); continue
        m['group'] = m['group'] or r.get('animation_group_id'); m['done'].append(d); save()
    log(key, move, 'done', len(m['done']))
if __name__ == '__main__':
    if sys.argv[1:] == ['all']:
        items = [(p, l, t) for p in CASTS for l in CASTS[p] for t in ('axe', 'hammer')]
    else:
        items = [tuple(a.split(':')) for a in sys.argv[1:]]
    with ThreadPoolExecutor(int(os.environ.get('SLOTS', '1'))) as ex: list(ex.map(lambda j: armed(*j), items))
    log('FINISHED')
