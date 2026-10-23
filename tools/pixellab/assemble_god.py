"""Lay the God creatures' PixelLab sheets into art/iso/creature/<kind>/ like the folk's (assemble_folk.lay).
    python3 assemble_god.py <repo> wolf ape ..."""
import json, sys
import assemble_folk as af
af.NAMES.clear()
af.NAMES.update({'walking': 'walk', 'running': 'run', 'breathing_idle': 'idle', 'picking_up': 'pickup', 'throw_object': 'throw',
    'pushing': 'push', 'pull_heavy_object': 'pull', 'drinking': 'eat', 'cross_punch_attack': 'punch', 'uppercut': 'uppercut',
    'taking_a_punch': 'hit', 'falling_backward': 'death', 'getting_up': 'getup', 'casting_a_fireball': 'miracle'})
st = json.load(open('pl/creature_state.json'))
repo = sys.argv[1]
for kind in sys.argv[2:]:
    src = f'pl/chars/god_{kind}'
    if not af.fetch(st[f'god_{kind}']['character_id'], src): print(kind, 'FETCH FAILED'); continue
    meta = json.load(open(f'{src}/metadata.json'))['states'][0]['frames']['animations']
    for n in meta:  # the jump and sad walk's folder names, whatever PixelLab calls them
        b = n.split('-')[0]
        if b not in af.NAMES and 'jump' in b: af.NAMES[b] = 'joy'
        if b not in af.NAMES and 'sad' in b: af.NAMES[b] = 'sad'
    print(kind, af.lay(src, f'{repo}/src/renderer/art/iso/creature/{kind}', 'god', kind))
