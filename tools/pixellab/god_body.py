"""Edit a standing settler into an upright God creature, then make its 8-direction character. Resumable."""
import json, os, sys, time
from PIL import Image
import pl
KINDS = {
 'ape': ('a big upright ape standing on two legs in the same pose, shaggy dark brown fur, a broad leathery chest, long strong arms with big hands, a wise expressive ape face',
         'a god creature like in Black and White: a big upright ape, shaggy dark brown fur, leathery chest, long strong arms, wise ape face, no clothes'),
 'bear': ('a big upright brown bear standing on two legs in the same pose, thick brown fur, a round belly, big paws with claws, a friendly expressive bear head with round ears',
          'a god creature like in Black and White: a big upright brown bear standing on two legs, thick fur, round belly, big clawed paws, bear head, no clothes'),
 'bull': ('a big upright bull standing on two legs in the same pose, short tan and white hide, a huge muscled chest, hooves for feet, thick hands, a bull head with curved horns and a nose ring',
          'a god creature like in Black and White: a big upright bull standing on two legs, tan and white hide, muscled chest, hooves, bull head with curved horns, no clothes'),
 'golem': ('a big upright stone golem standing on two legs in the same pose, a body of grey mossy boulders, glowing amber cracks, big rock fists, a rough stone head with glowing eyes',
           'a god creature: a big upright stone golem, mossy grey boulders, glowing amber cracks, big rock fists, stone head with glowing eyes'),
}
ST = 'pl/creature_state.json'
st = json.load(open(ST))
def save(): json.dump(st, open(ST, 'w'), indent=1)
def bal(): return pl.call('GET', '/balance')['subscription']['generations']
def log(*a):
    line = time.strftime('%H:%M:%S ') + ' '.join(map(str, a)); print(line, flush=True)
    open('pl/spend.log', 'a').write(line + '\n')
south = Image.open('pl/chars/settlers_man_base/Idle/rotations/south.png').convert('RGBA'); w, h = south.size
for kind in sys.argv[1:]:
    edit, desc = KINDS[kind]; k = f'god_{kind}'; s = st.setdefault(k, {})
    if not os.path.exists(f'pl/ref_{k}.png'):
        b = bal()
        r = pl.call('POST', '/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': w, 'height': h}, 'no_background': True,
            'edit_images': [{'image': pl.b64(south), 'width': w, 'height': h}],
            'description': f'Turn this man into a god creature like in the game Black and White: {edit}. Keep the same standing pose, size, outline and pixel-art style; no clothes.'})
        if 'detail' in r: log(kind, 'edit refused', str(r)[:200]); continue
        res = pl.wait(r.get('background_job_id'), every=8)
        if res.get('status') != 'completed': log(kind, 'edit failed', str(res)[:200]); continue
        pl.unb64(res['last_response']['images'][0]).save(f'pl/ref_{k}.png'); log(kind, 'edited', b, '->', bal())
    if not s.get('character_id'):
        b = bal()
        r = pl.call('POST', '/create-character-v3', {'description': desc, 'reference_image': pl.b64(Image.open(f'pl/ref_{k}.png')),
            'n_directions': 8, 'view': 'low top-down', 'template_id': 'mannequin', 'name': f'god {kind}', 'no_background': True})
        if 'detail' in r: log(kind, 'create refused', str(r)[:200]); continue
        res = [pl.wait(j, every=10, limit=1200) for j in (r.get('background_job_ids') or [r.get('background_job_id')])]
        if not all(x.get('status') == 'completed' for x in res): log(kind, 'create failed'); continue
        s['character_id'] = r['character_id']; save(); log(kind, 'made', r['character_id'], b, '->', bal())
