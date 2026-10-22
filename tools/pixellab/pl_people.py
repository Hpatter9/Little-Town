"""A small cast for one people on PixelLab: each look is a settler figure's south view edited into the people's dress
(so the style and size match), turned to 8 directions, then given walk, idle, attack and death from the templates.
Runs one job at a time beside the settler batch (which holds 9 of the 10 slots). State in pl/people_state.json.

    python3 pl_people.py orcs
"""
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

import pl

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
STATE = os.environ.get('STATE', 'pl/people_state.json')
MOVES = {'walk': 'walking', 'idle': 'breathing-idle', 'attack': 'cross-punch', 'death': 'falling-back-death'}
# (the casting peoples attack with a thrown spell; the rest with a punch: the mannequin has no weapon template)
CASTERS = {'lich', 'druid', 'fae', 'alchemists'}
# (base settler look, what the edit makes of it, the character's description)
CASTS = {
    'orcs': {
        'orc_brute': ('man_base', 'Turn this man into a hulking orc warrior: green skin, small tusks, a heavy brow, bald with a black topknot, a rough leather vest and iron-studded bracers, fur loincloth over trousers.',
                      'hulking green-skinned orc warrior with tusks, black topknot, leather vest, iron bracers'),
        'orc_woman': ('woman_base', 'Turn this woman into an orc woman: green skin, small tusks, long black braids, a ragged hide tunic with a bone necklace, wrapped leather boots.',
                      'green-skinned orc woman with small tusks, long black braids, hide tunic and bone necklace'),
        'orc_shaman': ('man_leather', 'Turn this man into an old orc shaman: grey-green skin, tusks, white war paint on the face, a cloak of furs and feathers, a skull charm on the belt, bare feet.',
                       'old grey-green orc shaman with tusks, white face paint, fur and feather cloak'),
    },
}

def c(base, edit, desc): return (base, edit, desc)
M, W, L = 'man_base', 'woman_base', 'man_leather'
CASTS.update({
    'lich': {
        'lich_lord': c(M, 'Turn this man into a lich: a gaunt skeletal undead with a bare skull face, glowing blue eyes, tattered black and purple robes with a high collar, a bone crown.', 'skeletal undead lich in tattered black and purple robes, bone crown, glowing blue eyes'),
        'lich_ghoul': c(W, 'Turn this woman into a pale undead ghoul: grey-blue rotting skin, sunken eyes, stringy dark hair, a torn grey shroud dress, bare feet.', 'pale grey-blue undead ghoul woman in a torn grey shroud'),
        'lich_skeleton': c(L, 'Turn this man into an animated skeleton labourer: bare bones, an empty skull with faint blue eye glow, a ragged loincloth and a rusty belt.', 'animated skeleton labourer with a ragged loincloth, faint blue eye glow'),
    },
    'druid': {
        'druid_elder': c(M, 'Turn this man into an elder druid: long white beard, a crown of antlers and leaves, a flowing moss-green robe with a rope belt, bare feet.', 'elder druid with white beard, antler and leaf crown, moss-green robe'),
        'druid_woman': c(W, 'Turn this woman into a young druid: wild auburn hair woven with leaves and flowers, a leaf-patterned green tunic, a bark-brown shawl, wrapped sandals.', 'young druid woman with leaves in auburn hair, green leaf tunic, bark shawl'),
        'druid_warden': c(L, 'Turn this man into a forest warden druid: a wolf-hide hood over the head, green woad tattoos on bare arms, a leather and leaf jerkin, fur boots.', 'forest warden druid with wolf-hide hood, green woad tattoos, leaf jerkin'),
    },
    'vampire': {
        'vamp_lord': c(M, 'Turn this man into a vampire noble: deathly pale skin, slicked-back black hair, red eyes, a black velvet tailcoat with a high collar, a crimson waistcoat, black boots.', 'pale vampire noble with slicked black hair, red eyes, black velvet tailcoat and crimson waistcoat'),
        'vamp_lady': c(W, 'Turn this woman into a vampire lady: deathly pale skin, long black hair, red eyes and lips, an elegant crimson and black gown with lace sleeves.', 'pale vampire lady with long black hair in a crimson and black gown'),
        'vamp_thrall': c(L, 'Turn this man into a vampire thrall servant: pallid tired face, shaven head, a plain grey servant tunic with a dark red sash, a bite mark on the neck.', 'pallid servant thrall with shaven head, grey tunic and dark red sash'),
    },
    'werewolf': {
        'wolf_hunter': c(M, 'Turn this man into a werewolf clansman in human form: shaggy grey hair and beard, yellow wolf eyes, a grey wolf pelt worn over the shoulders with the head as a hood, bare chest with claw scars, hide trousers.', 'shaggy werewolf clansman with yellow eyes, grey wolf pelt hood, bare scarred chest'),
        'wolf_woman': c(W, 'Turn this woman into a werewolf huntress in human form: wild black hair, yellow wolf eyes, a black wolf pelt cloak, a hide tunic and fur wraps on the legs.', 'werewolf huntress with wild black hair, yellow eyes, black wolf pelt cloak'),
        'wolf_beast': c(L, 'Turn this man into a werewolf: a tall grey-furred wolf-headed beast standing upright, clawed hands, torn brown trousers.', 'upright grey-furred werewolf beast with a wolf head and claws, torn trousers'),
    },
    'robot': {
        'robot_worker': c(M, 'Turn this man into a brass clockwork automaton labourer: a riveted brass body, a round head with two glowing blue lens eyes, visible gears at the joints.', 'brass clockwork automaton labourer with riveted body and blue lens eyes'),
        'robot_guard': c(L, 'Turn this man into a heavy iron steam robot guard: dark iron plating, a boxy head with a red visor slit, a small smokestack on the back, piston arms.', 'heavy dark iron steam robot guard with red visor and piston arms'),
        'robot_android': c(W, 'Turn this woman into a slender silver clockwork android: polished silver and white plates, a smooth oval face with blue eyes, copper joints.', 'slender silver and white clockwork android with blue eyes and copper joints'),
    },
    'merfolk': {
        'mer_man': c(M, 'Turn this man into a sea-folk man walking on land: blue-green scaled skin, fin ridges on the forearms and ears, long sea-green hair, a kelp sash and a shell belt, bare feet.', 'blue-green scaled sea-folk man with fin ridges, long sea-green hair, kelp sash'),
        'mer_woman': c(W, 'Turn this woman into a sea-folk woman walking on land: pale aqua skin with scales on the shoulders, fin-shaped ears, long teal hair with pearls, a wrap of woven seaweed and shell jewellery.', 'aqua-skinned sea-folk woman with fin ears, teal hair with pearls, seaweed wrap'),
        'mer_fisher': c(L, 'Turn this man into a sea-folk fisher: grey-blue skin, gill slits on the neck, a bald head with a fin crest, a net slung over the shoulder, a sharkskin tunic.', 'grey-blue sea-folk fisher with gills and fin crest, sharkskin tunic, net on shoulder'),
    },
    'nomads': {
        'nomad_rider': c(M, 'Turn this man into a desert nomad: a sand-coloured head wrap and face veil, sun-dark skin, a long indigo robe with a red sash, leather boots.', 'desert nomad with sand head wrap and veil, long indigo robe and red sash'),
        'nomad_woman': c(W, 'Turn this woman into a nomad woman: a patterned saffron headscarf, sun-dark skin, layered colourful robes with coins sewn on, bangles, sandals.', 'nomad woman with saffron headscarf, layered colourful robes with coins'),
        'nomad_herder': c(L, 'Turn this man into a steppe herder: a fur-trimmed felt hat, a quilted brown coat tied with a sash, baggy trousers, felt boots.', 'steppe herder with fur-trimmed felt hat and quilted brown coat'),
    },
    'fae': {
        'fae_lord': c(M, 'Turn this man into a fae noble: pointed ears, pale lilac skin, silver hair, translucent dragonfly wings on the back, a doublet of green leaves and silver thread.', 'fae noble with pointed ears, lilac skin, silver hair, dragonfly wings, leaf doublet'),
        'fae_woman': c(W, 'Turn this woman into a fae: pointed ears, glowing pale skin, pink flowing hair, delicate butterfly wings on the back, a petal dress.', 'fae woman with pointed ears, pink hair, butterfly wings and a petal dress'),
        'fae_sprite': c(L, 'Turn this man into a mischievous fae sprite: small pointed ears, green-tinted skin, spiky moss hair, little moth wings, a tunic of bark and acorn caps.', 'mischievous green fae sprite with moth wings and a bark tunic'),
    },
    'alchemists': {
        'alch_master': c(M, 'Turn this man into a master alchemist: brass goggles pushed up on the forehead, a grey beard, a long purple coat with many pockets, a leather apron stained with chemicals, vials on the belt.', 'master alchemist with brass goggles, purple coat, stained apron, vials on belt'),
        'alch_woman': c(W, 'Turn this woman into an alchemist: hair tied up under a scarf, round spectacles, a teal blouse with rolled sleeves, a leather apron, a belt of glowing potion vials.', 'woman alchemist with round spectacles, teal blouse, apron and potion belt'),
        'alch_apprentice': c(L, 'Turn this man into an alchemist apprentice: a hooded brown cloak, a soot-smudged face, a yellow tunic with burn marks, a satchel of herbs.', 'young alchemist apprentice in a hooded brown cloak with a herb satchel'),
    },
    'knights': {
        'knight_sir': c(M, 'Turn this man into a knight: polished steel plate armour, a white surcoat with a red cross, a closed great helm, steel gauntlets.', 'knight in steel plate with white surcoat and red cross, great helm'),
        'knight_dame': c(W, 'Turn this woman into a lady knight: steel plate armour with a blue surcoat bearing a gold lion, no helmet, blonde hair in a braid.', 'lady knight in steel plate with blue surcoat and gold lion, blonde braid'),
        'knight_squire': c(L, 'Turn this man into a squire: a padded gambeson in red and white, a chainmail coif pushed back, leather boots.', 'young squire in a red and white padded gambeson and chainmail coif'),
    },
})

state = json.load(open(STATE)) if os.path.exists(STATE) else {}


lock = threading.Lock()


def save():
    with lock:
        json.dump(state, open(STATE + '.tmp', 'w'), indent=1)
        os.replace(STATE + '.tmp', STATE)


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def job(path, body, tries=6):
    for t in range(tries):
        try:
            r = pl.call('POST', path, body)
        except ValueError:
            r = {'detail': 'empty answer'}
        if 'detail' in r and 'already has' in str(r['detail']):
            return {'animation_group_id': body.get('animation_group_id')}, []
        if 'detail' in r:
            log('  refused', str(r)[:160]); time.sleep(30 * (t + 1)); continue
        ids = r.get('background_job_ids') or [r.get('background_job_id')]
        res = [pl.wait(j, every=10, limit=1200) for j in ids]
        if all(x.get('status') == 'completed' for x in res):
            return r, res
        log('  failed', str(res[-1].get('last_response'))[:160]); time.sleep(30 * (t + 1))
    return None, None


def look(people, name, base, edit, desc):
    st = state.setdefault(name, {})
    if not st.get('edited'):
        south = Image.open(f'pl/chars/{base}/Idle/rotations/south.png').convert('RGBA')
        w, h = south.size
        r, res = job('/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': w, 'height': h}, 'no_background': True,
            'edit_images': [{'image': pl.b64(south), 'width': w, 'height': h}],
            'description': edit + ' Keep the same pose, size, proportions and pixel-art style; empty hands.'})
        if not r: log(name, 'edit GAVE UP'); return
        pl.unb64(res[0]['last_response']['images'][0]).save(f'pl/ref_{name}.png')
        st['edited'] = True; save(); log(name, 'edited')
    if not st.get('character_id'):
        r, res = job('/create-character-v3', {'description': desc + ', empty hands, no cape, medieval fantasy',
            'reference_image': pl.b64(Image.open(f'pl/ref_{name}.png')), 'n_directions': 8, 'view': 'low top-down',
            'template_id': 'mannequin', 'name': f'{people} {name}', 'no_background': True})
        if not r: log(name, 'rotate GAVE UP'); return
        st['character_id'] = r['character_id']; save(); log(name, 'made', r['character_id'])
    if os.environ.get('LOOKS_ONLY'): return
    only = os.environ.get('MOVES_ONLY')
    for move, tpl in MOVES.items():
        if only and move not in only.split(','): continue
        if move == 'attack' and people in CASTERS: tpl = 'fireball'
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
    # (several looks at once, one job each: SLOTS of PixelLab's ten)
    jobs = [(people, name, spec) for people in sys.argv[1:] for name, spec in CASTS[people].items()]
    with ThreadPoolExecutor(int(os.environ.get('SLOTS', '1'))) as ex:
        list(ex.map(lambda j: look(j[0], j[1], *j[2]), jobs))
    log('FINISHED', ' '.join(sys.argv[1:]))
