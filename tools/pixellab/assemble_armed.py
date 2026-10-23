"""Lay the peoples' axe and hammer looks (pl_armed.py) into art/iso/folk/<people>/<look>+<tool>/, one move each.
    python3 assemble_armed.py <repo>"""
import json, sys
import assemble_folk as af
from pl_people import CASTS
st = json.load(open('pl/armed_state.json'))
people_of = {l: p for p in CASTS for l in CASTS[p]}
repo = sys.argv[1]
for key, s in sorted(st.items()):
    look, tool = key.split('+')
    move = af.MOVE[tool]
    if len(s.get(move, {}).get('done', [])) < 8: print(key, 'NOT DONE'); continue
    people = people_of[look]; src = f'pl/chars/{people}_{look}+{tool}'
    if not af.fetch(s['character_id'], src): print(key, 'FETCH FAILED'); continue
    name = af.RENAME.get(look, look) + '+' + tool
    print(key, af.lay(src, f'{repo}/src/renderer/art/iso/folk/{people}/{name}', people, name, move), flush=True)
