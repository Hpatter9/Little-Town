"""Iso kit pieces for the buildings still drawn as a cottage, in the settlers' kit style (generate-with-style-v2).
Resumable (pl/bldg/done.json). Usage: python3 pl_bldg.py [ids...]"""
import json, os, sys, time
from PIL import Image
import pl
K = '/home/user/Little-Town/src/renderer/art/iso/kits/settlers/'
OUT = 'pl/bldg'; os.makedirs(OUT, exist_ok=True)
REFS = ['chapel', 'tavern', 'well', 'market_stall']
P = {
 'village_green': (256, "a village green: a flat square patch of lush grass with a maypole hung with ribbons in the middle, a low wooden bench, flowers along the edge"),
 'quoits_pitch': (224, "a quoits pitch: a flat strip of packed earth with two wooden pegs at either end, a few iron rings on the ground, a small wooden bench beside it"),
 'sparring_yard': (256, "a sparring yard: a square of trodden sand fenced with low wooden rails, two straw training dummies on posts, a rack of wooden practice swords"),
 'drill_yard': (256, "a soldiers' drill yard: a square of packed earth with a low fence, a banner pole, a rack of spears and shields, a wooden marching post"),
 'archery_range': (256, "an archery range: a strip of grass with three round straw targets on wooden stands, a rack of bows and a quiver stand at one end, a low fence"),
 'pleasure_garden': (256, "a pleasure garden: neat hedges and flower beds round a small stone fountain, a gravel path, a wooden arbour with climbing roses"),
 'bandstand': (256, "a bandstand: a small round raised wooden pavilion with white posts and a pointed red roof, steps up to it, bunting"),
 'boatyard': (288, "a boatyard on the shore: a timber slipway with a half-built wooden boat on trestles, a small open shed, planks and rope coils"),
 'harbour': (320, "a small harbour: a stone quay with wooden bollards, a moored fishing boat, crates and barrels, a crane of timber"),
 'fishing_jetty': (256, "a fishing jetty: a wooden pier on posts reaching out over water, a small rowing boat tied to it, nets drying on a rack, a creel"),
 'statue': (224, "a stone statue of a hero holding a sword aloft on a square stone plinth with steps, a small flower bed round it"),
 'victory_monument': (256, "a victory monument: a tall stone obelisk on a stepped base with bronze laurel wreaths and banners"),
 'ward_stone': (192, "a ward stone: a tall standing stone carved with glowing blue runes, on a small round of flagstones"),
 'portal_arch': (256, "a magic portal arch: a standing ring of carved stone with a swirling violet glow inside it, on a stone dais with steps"),
 'ai_core': (256, "a futuristic AI core building: a white and steel dome with glowing cyan panels and cables, a server tower beside it"),
 'clone_vat': (224, "a clone vat: a tall glass cylinder of green glowing liquid on a steel base with pipes and a control panel"),
 'cryo_pod': (224, "a cryo pod station: two upright frosted glass pods on a steel platform with blue lights and hoses"),
 'drone_hub': (256, "a drone hub: a flat steel landing pad with a small control hut, yellow markings, two small quadcopter drones on it"),
 'shield_generator': (256, "a shield generator: a steel pylon with a glowing blue crystal on top casting a faint dome of light, on a round base"),
 'launch_site': (320, "a rocket launch site: a white rocket standing on a steel launch tower gantry, a concrete pad with yellow markings"),
 'mission_control': (288, "a mission control building: a low modern steel and glass block with a big satellite dish on the roof and antennas"),
}
done = json.load(open(f'{OUT}/done.json')) if os.path.exists(f'{OUT}/done.json') else {}
style = [Image.open(K + f'{n}.png').convert('RGBA') for n in REFS]
for name in (sys.argv[1:] or P):
    size, desc = P[name]
    if name in done: continue
    first = style[0]; c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c.alpha_composite(first, ((size - first.width) // 2, size - first.height))
    imgs = [c] + style[1:]
    for attempt in range(12):
        r = pl.call('POST', '/generate-with-style-v2', {'style_images': [{'image': pl.b64(i), 'width': i.width, 'height': i.height} for i in imgs],
            'description': desc + ', seen in the same isometric view as the references, standing on the ground',
            'style_description': 'isometric pixel art building, same palette, outline and shading as the references', 'no_background': True})
        if 'background_job_id' in r: break
        print(name, 'busy', str(r)[:120], flush=True); time.sleep(30)
    res = pl.wait(r['background_job_id'], every=8, limit=900)
    if res.get('status') != 'completed': print(name, 'FAILED', str(res.get('last_response'))[:200], flush=True); continue
    pl.unb64(res['last_response']['images'][0]).save(f'{OUT}/{name}.png')
    done[name] = res.get('usage') or True; json.dump(done, open(f'{OUT}/done.json', 'w'))
    print(name, 'ok', res.get('usage'), flush=True)
print('ALL DONE')
