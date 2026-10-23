"""Children for each people on PixelLab: an adult of that people's south view edited into a child of the same dress
(so style, palette and canvas match), turned to 8 directions, then walk, idle and death from the templates.
State in pl/kids_state.json; resumable. EDIT_ONLY=1 stops after the edits (to check them first).

    SLOTS=4 python3 pl_kids.py settlers orcs ...
"""
import json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import pl

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
STATE = 'pl/kids_state.json'
MOVES = {'walk': 'walking', 'idle': 'breathing-idle', 'death': 'falling-back-death'}
KID = ('a young child about seven years old: a big round head about a third of the whole height, short arms and legs, '
       'a small chubby body, a round young face with big eyes, no beard, simple hair. The child stands on the same ground '
       'line, centred, much shorter than the adult. Same pixel-art style, palette and outline; empty hands.')
# (the adult whose south view is edited, what the child wears, the character's description)
def k(src, dress, desc): return (src, dress, desc)
KIDS = {
 'settlers': {'boy': k('man_base', 'a plain linen shirt and brown trousers, short tousled brown hair', 'a small village boy, linen shirt, brown trousers, tousled hair'),
              'girl': k('woman_base', 'a simple green dress with an apron, hair in two short plaits', 'a small village girl, green dress and apron, two plaits')},
 'orcs': {'boy': k('orcs_orc_brute', 'green skin, tiny tusks, a black topknot, a hide vest', 'a small green orc boy with tiny tusks, topknot, hide vest'),
          'girl': k('orcs_orc_woman', 'green skin, tiny tusks, short black braids, a hide tunic', 'a small green orc girl with tiny tusks, short braids, hide tunic')},
 'lich': {'boy': k('lich_lich_skeleton', 'a small skeleton child with faint blue eye glow, a ragged loincloth', 'a small skeleton child with blue eye glow, ragged loincloth'),
          'girl': k('lich_lich_ghoul', 'pale grey-blue skin, dark stringy hair, a small torn grey shroud', 'a small pale undead girl in a torn grey shroud')},
 'druid': {'boy': k('druid_druid_warden', 'a green hooded tunic of leaves, bare feet', 'a small druid boy in a green hooded leaf tunic, bare feet'),
           'girl': k('druid_druid_woman', 'a mossy green dress, a flower crown, bare feet', 'a small druid girl in a mossy green dress with a flower crown')},
 'vampire': {'boy': k('vampire_vamp_thrall', 'pale skin, black slicked hair, a dark red waistcoat and white shirt', 'a small pale vampire boy, dark red waistcoat, white shirt'),
             'girl': k('vampire_vamp_lady', 'pale skin, long black hair, a dark crimson dress', 'a small pale vampire girl in a dark crimson dress')},
 'werewolf': {'boy': k('werewolf_wolf_hunter', 'a fur-trimmed hide jerkin, shaggy dark hair, a wolf-tooth necklace', 'a small hunter boy in a fur-trimmed hide jerkin, wolf-tooth necklace'),
              'girl': k('werewolf_wolf_woman', 'a fur-trimmed hide dress, shaggy hair, a wolf-tooth necklace', 'a small huntress girl in a fur-trimmed hide dress')},
 'robot': {'boy': k('robot_robot_worker', 'a small round brass clockwork robot child with a little round head and blue eyes', 'a small round brass clockwork robot child'),
           'girl': k('robot_robot_android', 'a small silver and white clockwork android child with blue eyes', 'a small silver and white clockwork android child')},
 'merfolk': {'boy': k('merfolk_mer_man', 'blue-green scaled skin, little fin ears, sea-green hair, a kelp sash', 'a small blue-green sea-folk boy with fin ears and a kelp sash'),
             'girl': k('merfolk_mer_woman', 'aqua skin, little fin ears, teal hair with a pearl, a seaweed wrap', 'a small aqua sea-folk girl with fin ears, teal hair, seaweed wrap')},
 'nomads': {'boy': k('nomads_nomad_rider', 'a sand-coloured head wrap, an indigo robe with a red sash', 'a small nomad boy in a sand head wrap and indigo robe'),
            'girl': k('nomads_nomad_woman', 'a saffron headscarf, a colourful layered robe', 'a small nomad girl in a saffron headscarf and colourful robe')},
 'fae': {'boy': k('fae_fae_sprite', 'pointed ears, green-tinted skin, moss hair, little moth wings, a bark tunic', 'a small fae boy with moth wings and a bark tunic'),
         'girl': k('fae_fae_woman', 'pointed ears, pink hair, little butterfly wings, a petal dress', 'a small fae girl with butterfly wings and a petal dress')},
 'alchemists': {'boy': k('alchemists_alch_apprentice', 'a soot-smudged face, a yellow tunic, little round goggles on the forehead', 'a small alchemist boy in a yellow tunic with goggles on the forehead'),
                'girl': k('alchemists_alch_woman', 'round spectacles, a teal smock with rolled sleeves', 'a small alchemist girl with round spectacles and a teal smock')},
 'dwarves': {'boy': k('man_base', 'a stocky dwarf boy: broad little shoulders, a big round nose, rosy cheeks, thick ruddy brown hair, no beard, a brown wool tunic with a small leather apron, sturdy boots', 'a stocky little dwarf boy with ruddy hair, a wool tunic and a small leather apron'),
             'girl': k('woman_base', 'a stocky dwarf girl: broad little shoulders, a big round nose, rosy cheeks, thick copper hair in two heavy braids, a dark green wool dress with a small leather apron, sturdy boots', 'a stocky little dwarf girl with copper braids, a green wool dress and a small leather apron')},
 'knights': {'boy': k('knights_knight_squire', 'a red and white padded tunic, short blond hair', 'a small page boy in a red and white padded tunic'),
             'girl': k('knights_knight_dame', 'a blue tunic with a gold lion, a blonde braid', 'a small page girl in a blue tunic with a gold lion, blonde braid')},
}
state = json.load(open(STATE)) if os.path.exists(STATE) else {}
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
        if all(x.get('status') == 'completed' for x in res): return r, res
        log('  failed', str(res[-1].get('last_response'))[:160]); time.sleep(30 * (t + 1))
    return None, None
def kid(people, sex, src, dress, desc):
    name = f'{people}_{sex}'; st = state.setdefault(name, {})
    if not st.get('edited'):
        # (every child but the first is edited from the settler girl, so all share a child's size and build)
        first = name == 'settlers_girl'
        south = Image.open(f'pl/chars/{src}/Idle/rotations/south.png' if first else 'pl/kid_base.png').convert('RGBA'); w, h = south.size
        r, res = job('/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': w, 'height': h}, 'no_background': True,
            'edit_images': [{'image': pl.b64(south), 'width': w, 'height': h}],
            'description': f'Turn this adult into {KID} The child wears {dress}.' if first else
              f'Turn this child into {"a boy" if sex == "boy" else "a girl"} of the same age, size, height, pose and build: {dress}. Keep the big head, short limbs, the same ground line and pixel-art style; empty hands.'})
        if not r: log(name, 'edit GAVE UP'); return
        pl.unb64(res[0]['last_response']['images'][0]).save(f'pl/ref_kid_{name}.png')
        st['edited'] = True; save(); log(name, 'edited')
    if os.environ.get('EDIT_ONLY'): return
    if not st.get('character_id'):
        r, res = job('/create-character-v3', {'description': desc + ', a young child, big head, short limbs, empty hands, medieval fantasy',
            'reference_image': pl.b64(Image.open(f'pl/ref_kid_{name}.png')), 'n_directions': 8, 'view': 'low top-down',
            'template_id': 'mannequin', 'name': f'{people} {sex}', 'no_background': True})
        if not r: log(name, 'rotate GAVE UP'); return
        st['character_id'] = r['character_id']; save(); log(name, 'made', r['character_id'])
    if os.environ.get('LOOKS_ONLY'): return
    for move, tpl in MOVES.items():
        m = st.setdefault(move, {'done': [], 'group': None})
        for d in DIRS:
            if d in m['done']: continue
            body = {'mode': 'template', 'template_animation_id': tpl, 'character_id': st['character_id'], 'animation_name': move, 'directions': [d]}
            if m['group']: body['animation_group_id'] = m['group']
            r, _ = job('/characters/animations', body)
            if not r: log(name, move, d, 'GAVE UP'); continue
            m['group'] = m['group'] or r.get('animation_group_id'); m['done'].append(d); save()
        log(name, move, 'done', len(m['done']))
if __name__ == '__main__':
    only = os.environ.get('SEX')
    jobs = [(p, s, *KIDS[p][s]) for p in sys.argv[1:] for s in KIDS[p] if not only or s == only]
    with ThreadPoolExecutor(int(os.environ.get('SLOTS', '1'))) as ex: list(ex.map(lambda j: kid(*j), jobs))
    log('FINISHED', ' '.join(sys.argv[1:]))
