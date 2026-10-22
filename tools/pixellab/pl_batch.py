"""Animate every settler look on PixelLab: the base look's moves, then an armed version per weapon
(the weapon edited into the south view, turned to 8 directions) with its own move. Up to SLOTS jobs
run at once; what is done is kept in pl/batch_state.json so a rerun picks up where it stopped.

    python3 pl_batch.py            # all looks
    python3 pl_batch.py man_base   # some looks
"""
import json
import os
import sys
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

import pl

SLOTS = 9
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
STATE = 'pl/batch_state.json'
LOG = 'pl/batch.log'

# Moves every look gets, from PixelLab's skeleton templates (1 generation a direction).
BASE = {
    'walk': 'walking',
    'run': 'running-6-frames',
    'idle': 'breathing-idle',
    'death': 'falling-back-death',
    'hurt': 'taking-punch',
    'cast_1h': 'fireball',
}
# The armed versions: what is edited into the hand, and the move drawn from text (2 a direction).
NO_FX = ' Keep the same character, clothes and weapon throughout; no extra effects, no particles, no flying debris.'
WEAPONS = {
    'axe': ("holds a woodcutter's axe in the right hand, the handle gripped low, the axe head hanging down by the side",
            'chop', 'chopping wood: lifts the axe already in hand up over the shoulder with both hands and swings it down onto a log in front, then recovers.'),
    'hammer': ("holds a smith's hammer in the right hand, hanging down by the side",
               'hammer', 'hammering: raises the hammer already in hand and strikes down on a work piece at waist height in front, twice.'),
    'sword': ('holds a one-handed arming sword in the right hand, pointing down by the side',
              'attack_1h', 'one-handed sword attack: steps forward and slashes the sword already in hand across in front, then returns to guard.'),
    'bow': ('holds a wooden longbow in the left hand, by the side',
            'attack_bow', 'archery: raises the bow already in hand, draws the string back to the cheek, looses an arrow forward and lowers the bow.'),
    'greatsword': ('holds a large two-handed greatsword in both hands, point resting down in front',
                   'attack_2h', 'two-handed attack: heaves the greatsword already in hand up overhead with both hands and swings it down hard in front, then recovers.'),
    'staff': ("holds a tall wooden mage's staff upright in the right hand",
              'cast_2h', 'spellcasting with both hands: grips the staff already in hand with both hands, raises it and thrusts it forward as a glow gathers at its tip, then lowers it.'),
}

lock = threading.Lock()
slots = threading.Semaphore(SLOTS)
state = json.load(open(STATE)) if os.path.exists(STATE) else {}


def log(*a):
    line = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    with lock:
        print(line, flush=True)
        open(LOG, 'a').write(line + '\n')


def save():
    with lock:
        json.dump(state, open(STATE + '.tmp', 'w'), indent=1)
        os.replace(STATE + '.tmp', STATE)


def job(post_path, body, tries=3):
    """POST a generation and wait for it, holding one of the slots. Returns the finished job."""
    for t in range(tries):
        with slots:
            try:
                r = pl.call('POST', post_path, body)
            except ValueError:
                r = {'detail': 'empty or cut-off answer'}
            if 'detail' in r and 'already has' in str(r['detail']):
                # (made by an earlier run that stopped while it was generating: it's there)
                return {'animation_group_id': body.get('animation_group_id')}, []
            if 'detail' in r:
                log('  refused', post_path, str(r)[:200])
                time.sleep(20 * (t + 1))
                continue
            ids = r.get('background_job_ids') or [r.get('background_job_id')]
            res = [pl.wait(j, every=10, limit=1200) for j in ids]
        if all(x.get('status') == 'completed' for x in res):
            return r, res
        log('  failed, retrying', post_path, str(res[-1].get('last_response'))[:160])
        time.sleep(15 * (t + 1))
    return None, None


def animate(look, cid, name, body_extra):
    """One move in all 8 directions, a direction per job, into one animation group."""
    key = f'{look}:{name}'
    st = state.setdefault(key, {'done': [], 'group': None})
    todo = [d for d in DIRS if d not in st['done']]
    if not todo:
        return
    # The first direction makes the group; the rest join it, all at once.
    def one(d):
        body = dict(body_extra, character_id=cid, animation_name=name, directions=[d])
        if st['group']:
            body['animation_group_id'] = st['group']
        r, res = job('/characters/animations', body)
        if r:
            with lock:
                st['group'] = st['group'] or r.get('animation_group_id')
                st['done'].append(d)
            save()
            log(look, name, d, 'ok')
        else:
            log(look, name, d, 'GAVE UP')
    if not st['group']:
        one(todo[0])
        todo = todo[1:]
    with ThreadPoolExecutor(len(todo) or 1) as ex:
        list(ex.map(one, todo))


def armed(look, meta, weapon):
    hold, move, action = WEAPONS[weapon]
    key = f'{look}+{weapon}'
    st = state.setdefault(key, {})
    if not st.get('character_id'):
        south = Image.open(f'pl/chars/{look}/Idle/rotations/south.png').convert('RGBA')
        w, h = south.size
        if not st.get('edited'):
            r, res = job('/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': w, 'height': h}, 'no_background': True,
                'edit_images': [{'image': pl.b64(south), 'width': w, 'height': h}],
                'description': f'The character {hold}; keep the body, clothes, face and hair exactly the same.'})
            if not r:
                log(key, 'edit GAVE UP'); return
            pl.unb64(res[0]['last_response']['images'][0]).save(f'pl/armed_{key}.png')
            st['edited'] = True; save()
        r, res = job('/create-character-v3', {'description': f"{meta['desc']}, {hold}",
            'reference_image': pl.b64(Image.open(f'pl/armed_{key}.png')), 'n_directions': 8, 'view': 'low top-down',
            'template_id': 'mannequin', 'name': f'settlers {key}', 'no_background': True})
        if not r:
            log(key, 'rotate GAVE UP'); return
        st['character_id'] = r['character_id']; save()
        log(key, 'made', r['character_id'])
    animate(key, st['character_id'], move, {'mode': 'v3', 'frame_count': 8, 'action_description': action + NO_FX})


def run_look(look, meta):
    try:
        cid = meta['character_id']
        for name, tpl in BASE.items():
            animate(look, cid, name, {'mode': 'template', 'template_animation_id': tpl})
        with ThreadPoolExecutor(len(WEAPONS)) as ex:
            list(ex.map(lambda w: armed(look, meta, w), WEAPONS))
        log(look, 'ALL DONE')
    except Exception:
        log(look, 'CRASH', traceback.format_exc()[-600:])


if __name__ == '__main__':
    looks = json.load(open('pl/looks.json'))
    want = sys.argv[1:] or [k for k in looks if '_axe' not in k]
    # The leather woman's walk was made in the first test.
    state.setdefault('woman_leather:walk', {'done': DIRS[:], 'group': 'ef43bb19-e8da-403c-9529-28901cb1f31b'})
    save()
    with ThreadPoolExecutor(len(want)) as ex:
        list(ex.map(lambda k: run_look(k, looks[k]), want))
    log('BATCH FINISHED')
