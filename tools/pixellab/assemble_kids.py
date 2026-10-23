"""Lay the children's PixelLab sheets into art/iso/folk/<people>/child_<boy|girl>/ like the adults' (assemble_folk.lay).
    python3 assemble_kids.py <repo> [people ...]"""
import json, sys
import assemble_folk as af
st = json.load(open('pl/kids_state.json'))
repo = sys.argv[1]
for name, s in sorted(st.items()):
    people, sex = name.rsplit('_', 1)
    if sys.argv[2:] and people not in sys.argv[2:]: continue
    if not s.get('character_id'): print(name, 'NOT MADE'); continue
    src = f'pl/chars/kid_{name}'
    if not af.fetch(s['character_id'], src): print(name, 'FETCH FAILED'); continue
    look = f'child_{sex}'
    print(name, af.lay(src, f'{repo}/src/renderer/art/iso/folk/{people}/{look}', people, look), flush=True)
