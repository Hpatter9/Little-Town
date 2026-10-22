"""Download each finished look (bare and armed) from PixelLab and lay it out for the game:
art/iso/folk/<people>/<look>/{rotations.png, <anim>.png, index.json}, quantised to 256 colours. A sheet has a row per
direction (in DIRS order) and a column per frame; rotations.png is one row, a frame per direction.

    python3 assemble_folk.py settlers <repo>
"""
import io, re, json, os, shutil, subprocess, sys, time, zipfile
from PIL import Image

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
# PixelLab's folder names for the template moves
NAMES = {'walking': 'walk', 'running': 'run', 'breathing_idle': 'idle', 'falling_backward': 'death',
         'taking_a_punch': 'hurt', 'casting_a_fireball': 'cast_1h', 'cross_punch': 'attack_1h', 'cross_punch_attack': 'attack_1h'}
# The game's names for the peoples' looks: `man_`/`woman_` first, so folkRules.pickLook matches them to the person
RENAME = {
    'orc_brute': 'man_brute', 'orc_woman': 'woman_orc', 'orc_shaman': 'man_shaman',
    'lich_lord': 'man_lord', 'lich_ghoul': 'woman_ghoul', 'lich_skeleton': 'man_skeleton',
    'druid_elder': 'man_elder', 'druid_woman': 'woman_druid', 'druid_warden': 'man_warden',
    'vamp_lord': 'man_lord', 'vamp_lady': 'woman_lady', 'vamp_thrall': 'man_thrall',
    'wolf_hunter': 'man_hunter', 'wolf_woman': 'woman_huntress', 'wolf_beast': 'man_beast',
    'robot_worker': 'man_worker', 'robot_guard': 'man_guard', 'robot_android': 'woman_android',
    'mer_man': 'man_mer', 'mer_woman': 'woman_mer', 'mer_fisher': 'man_fisher',
    'nomad_rider': 'man_rider', 'nomad_woman': 'woman_nomad', 'nomad_herder': 'man_herder',
    'fae_lord': 'man_fae', 'fae_woman': 'woman_fae', 'fae_sprite': 'man_sprite',
    'alch_master': 'man_master', 'alch_woman': 'woman_alchemist', 'alch_apprentice': 'man_apprentice',
    'knight_sir': 'man_knight', 'knight_dame': 'woman_knight', 'knight_squire': 'man_squire',
}
# Which looks belong to which people (the cast script's CASTS keys)
PREFIX = {'orcs': 'orc_', 'lich': 'lich_', 'druid': 'druid_', 'vampire': 'vamp_', 'werewolf': 'wolf_', 'robot': 'robot_',
          'merfolk': 'mer_', 'nomads': 'nomad_', 'fae': 'fae_', 'alchemists': 'alch_', 'knights': 'knight_'}
MOVE = {'axe': 'chop', 'hammer': 'hammer', 'sword': 'attack_1h', 'bow': 'attack_bow', 'greatsword': 'attack_2h', 'staff': 'cast_2h'}


def fetch(cid, dest):
    for a in range(6):
        d = subprocess.run(['curl', '-sS', f'https://api.pixellab.ai/v2/characters/{cid}/zip'], capture_output=True).stdout
        if d[:2] == b'PK':
            shutil.rmtree(dest, ignore_errors=True)
            zipfile.ZipFile(io.BytesIO(d)).extractall(dest); return True
        time.sleep(5 * (a + 1))
    return False


# Every frame sits centred on one canvas PAD px wider each side than the turned figure: PixelLab draws the text-made
# moves (an axe's swing) on a canvas up to that much bigger, centred, and one size for all a look's frames (and its armed
# looks') keeps the feet still when the game swaps between them.
PAD = 24


def sheet(rows, out, size):
    """Frames (lists of paths, a list a row) centred on `size` canvases and packed into one palette PNG (the alpha kept
    in the palette)."""
    ims = [[Image.open(f).convert('RGBA') for f in r] for r in rows]
    w, h = size
    s = Image.new('RGBA', (w * max(len(r) for r in ims), h * len(ims)), (0, 0, 0, 0))
    for y, r in enumerate(ims):
        for x, im in enumerate(r):
            assert im.width <= w and im.height <= h and (w - im.width) % 2 == 0, (out, im.size, size)
            s.alpha_composite(im, (x * w + (w - im.width) // 2, y * h + (h - im.height) // 2))
    s.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)


def lay(src, out, people, look, only=None):
    """Write one character's rotations and complete animations to `out`. `only` renames the single move kept."""
    meta = json.load(open(f'{src}/metadata.json'))['states'][0]
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    w, h = Image.open(f"{src}/{meta['frames']['rotations']['south']}").size
    w, h = w + 2 * PAD, h + 2 * PAD
    sheet([[f"{src}/{meta['frames']['rotations'][d]}" for d in DIRS]], f'{out}/rotations.png', (w, h))
    anims = {}
    for name, by_dir in meta['frames']['animations'].items():
        # (a direction made twice comes as 'east-305fd992': keep the first)
        by_dir = {k: v for k, v in sorted(by_dir.items(), reverse=True) for k in [re.sub(r'-[0-9a-f]{8}$', '', k)]}
        if len(by_dir) < 8: continue  # (a half-made duplicate group)
        key = only or NAMES.get(name.split('-')[0])
        if not key or key in anims: continue
        n = min(len(f) for f in by_dir.values())
        sheet([[f'{src}/{f}' for f in by_dir[d][:n]] for d in DIRS], f'{out}/{key}.png', (w, h))
        anims[key] = {'frames': n}
    json.dump({'look': look, 'people': people, 'frame': [w, h], 'directions': DIRS, 'animations': anims}, open(f'{out}/index.json', 'w'), indent=1)
    return anims


if __name__ == '__main__':
    people, repo = sys.argv[1], sys.argv[2]
    root = f'{repo}/src/renderer/art/iso/folk/{people}'
    if people == 'settlers':
        looks = {k: v['character_id'] for k, v in json.load(open('pl/looks.json')).items() if '_axe' not in k}
        st = json.load(open('pl/batch_state.json'))
        for k, v in st.items():
            if '+' in k and ':' not in k and v.get('character_id'): looks[k] = v['character_id']
    else:
        st = {**json.load(open('pl/people_state.json')), **json.load(open('pl/people_looks_state.json'))}
        looks = {k: v['character_id'] for k, v in st.items() if v.get('character_id') and k.startswith(PREFIX[people])}
    for look, cid in sorted(looks.items()):
        src = f'pl/chars/{people}_{look}'
        if not fetch(cid, src): print(look, 'FETCH FAILED'); continue
        weapon = look.split('+')[1] if '+' in look else None
        name = RENAME.get(look, look)
        a = lay(src, f'{root}/{name}', people, name, MOVE.get(weapon))
        print(look, a, flush=True)
