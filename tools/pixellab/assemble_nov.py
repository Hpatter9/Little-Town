"""Drops the November batch's finished art (batch_nov.py: pl/nov_state.json, pl/nov/<phase>/) into the game, kind by
kind, and checks it against the grid's rules first: a building whose picture doesn't fit its footprint is left out (and
said so), so the game keeps its stand-in. Run from the same work folder as batch_nov.py:

    python3 assemble_nov.py <repo>                 # everything finished so far
    python3 assemble_nov.py <repo> test            # the tests laid out for a look: pl/nov/test/contact.png
    python3 assemble_nov.py <repo> buildings sleep # some kinds: buildings pieces flame barrow looks sleep push god cards

Then `npm run typecheck` and `npm test` in the repo (test/gridRules.test.ts checks every piece and the waiting list),
and `npm run web` to look. What goes where (docs/notes/pixellab-plan.md):
  buildings  art/iso/buildings/<id>.png + its index.json, cut by tools/grid-recut.py (the stockade too)
  pieces     the heaps into art/iso/kits/settlers/ + its index.json; the corner pieces beside them (cut as posts)
  flame      art/iso/kits/settlers/flame.png (a strip of frames), art/iso/made.json `flame`
  barrow     art/iso/kits/settlers/barrow_<view>_<load>.png, art/iso/made.json `barrow`
  looks      art/iso/folk/settlers/<look>/ and <look>+<tool>/ (sheets, index.json, roles.json), art/iso/made.json `looks`;
             a look goes in only with all its moves done (before sleep and push: laying a look lays its folder afresh)
  sleep      art/iso/folk/settlers/<look>/sleep.png + its index.json, its colours labelled (tools/folk-roles.py)
  push       art/iso/folk/settlers/<look>/push.png + its index.json, the same
  god        the remade moves laid over the old in art/iso/creature/<kind>/, direction by direction
  cards      art/creatures/packs/pl_<kind>.png + packs.json"""
import sys
sys.dont_write_bytecode = True  # (no __pycache__ written into tools/)
import importlib.util
import json
import os
import re
import subprocess

from PIL import Image

import assemble_folk as af
import batch_nov as bn

REPO = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else bn.REPO
KINDS = sys.argv[2:] or ['buildings', 'pieces', 'flame', 'barrow', 'looks', 'sleep', 'push', 'god', 'cards']
ART = os.path.join(REPO, 'src', 'renderer', 'art')
ISO = os.path.join(ART, 'iso')
KIT = os.path.join(ISO, 'kits', 'settlers')
SHARED = os.path.join(ISO, 'buildings')
MADE = os.path.join(ISO, 'made.json')
state = json.load(open(bn.STATE)) if os.path.exists(bn.STATE) else {}

# tools/grid-recut.py's measuring (its name has a dash: loaded by path)
_spec = importlib.util.spec_from_file_location('grid_recut', os.path.join(REPO, 'tools', 'grid-recut.py'))
gr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gr)


def done(key):
    return state.get(key, {}).get('done')


def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im


def load_json(p, default):
    return json.load(open(p)) if os.path.exists(p) else default


def write_json(p, d):
    with open(p, 'w') as f:
        json.dump(d, f, indent=1)
        f.write('\n')


def upsert(index_path, pid, w, h):
    """A piece's entry in a kit's (or the shared) index.json, replaced if there."""
    idx = [p for p in load_json(index_path, []) if p['id'] != pid]
    idx.append({'id': pid, 'w': w, 'h': h})
    write_json(index_path, idx)


def made(field, value):
    m = load_json(MADE, {'flame': False, 'barrow': [], 'looks': []})
    if field in ('barrow', 'looks'):
        m[field] = sorted(set(m.get(field, [])) | {value})
    else:
        m[field] = value
    write_json(MADE, m)


def save_png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


# ------------------------------------------------------------------------------------------------ buildings

def breaks(im, rec):
    """test/gridRules.test.ts `breaks`: px drawn below the footprint's front edges, and px past its sides (eaves a
    quarter cell)."""
    ax, ay = rec['anchor']
    w, h = rec['foot']
    HC = gr.HC
    lx, rx = ax - w * HC, ax + h * HC
    side = 0.5 * HC
    a = im.getchannel('A').load()
    below = wide = 0
    for y in range(im.height):
        for x in range(im.width):
            if a[x, y] < 24:
                continue
            cx, cy = x + 0.5, y + 0.5
            edge = ay - (w * HC) / 2 if cx < lx else ay - (ax - cx) / 2 if cx <= ax else ay - (cx - ax) / 2 if cx <= rx else ay - (h * HC) / 2
            if cy > edge + 1.5:
                below += 1
            if cx < lx - side or cx > rx + side:
                wide += 1
    return below, wide


def clip_sides(path, rec):
    """Clears what reaches past the footprint's sides by more than its eaves, when it is a few stray px (a twig, a
    sail's tip); returns how many were cleared, or None when it is more than that (the picture doesn't fit)."""
    im = Image.open(path).convert('RGBA')
    ax, _ = rec['anchor']
    w, h = rec['foot']
    lx, rx = ax - w * gr.HC - 0.5 * gr.HC, ax + h * gr.HC + 0.5 * gr.HC
    px = im.load()
    out = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] >= 24 and (x + 0.5 < lx or x + 0.5 > rx)]
    solid = sum(1 for y in range(im.height) for x in range(im.width) if px[x, y][3] >= 24)
    if len(out) > 0.02 * max(1, solid):
        return None
    for x, y in out:
        px[x, y] = (0, 0, 0, 0)
    save_png(im, path)
    return len(out)


def building_jobs():
    """The finished building pictures: (job, picture), every phase's, the stockade's too."""
    out = []
    for ph in ['bld_first', 'bld_medieval', 'bld_late', 'bld_yard']:
        for j in bn.jobs_for(ph):
            if done(j['key']) and os.path.exists(bn.out_path(j)):
                out.append((j, bn.out_path(j)))
    for j in bn.piece_jobs('pieces'):
        if j['where'] == 'shared' and done(j['key']) and os.path.exists(bn.out_path(j)):
            out.append((j, bn.out_path(j)))
    return out


def buildings():
    jobs = building_jobs()
    if not jobs:
        print('buildings: none finished')
        return
    grid_path = os.path.join(SHARED, 'grid', 'grid.json')
    # (the footprints, for tools/grid-recut.py)
    subprocess.run(['node', 'tools/grid-audit.mjs'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    defs = json.load(open(os.path.join(REPO, 'out', 'grid-defs.json')))
    placed = []
    grid = load_json(grid_path, {})
    for j, src in jobs:
        im = trim(Image.open(src).convert('RGBA'))
        for pid in j['ids']:
            im.save(os.path.join(SHARED, pid + '.png'))
            upsert(os.path.join(SHARED, 'index.json'), pid, im.width, im.height)
            grid.pop(pid, None)
            placed.append(pid)
    write_json(grid_path, dict(sorted(grid.items())))
    subprocess.run(['python3', 'tools/grid-recut.py'], cwd=REPO, check=True)
    grid = load_json(grid_path, {})
    bad = []
    for pid in placed:
        rec = grid.get(pid)
        want = defs.get(pid)
        why = None
        if not rec:
            why = 'not cut'
        elif want and sorted(rec['foot']) != sorted(want):
            why = f"its plinth came out {rec['foot']}, its footprint is {want}"
        else:
            path = os.path.join(SHARED, 'grid', pid + '.png')
            below, wide = breaks(Image.open(path).convert('RGBA'), rec)
            if wide and clip_sides(path, rec) is None:
                why = f'{wide} px past its sides'
            elif below:
                why = f'{below} px below its front edges'
        if why:
            bad.append((pid, why))
    for pid, why in bad:
        # (left out: the game keeps its stand-in; the picture stays in pl/nov/ to be made again: REDO=<key>)
        print(f'  {pid}: LEFT OUT, {why}')
        grid.pop(pid, None)
        for p in (os.path.join(SHARED, pid + '.png'), os.path.join(SHARED, 'grid', pid + '.png')):
            if os.path.exists(p):
                os.remove(p)
        write_json(os.path.join(SHARED, 'index.json'), [p for p in load_json(os.path.join(SHARED, 'index.json'), []) if p['id'] != pid])
    write_json(grid_path, dict(sorted(grid.items())))
    print(f'buildings: {len(placed) - len(bad)} in, {len(bad)} left out')


# ------------------------------------------------------------------------------------------------ kit pieces

def bake_to_cell(im):
    """A one-cell piece baked so its plinth spans one cell, as the kit's are."""
    b = gr.measure_base(im)
    L, F, R, a, bb = gr.plinth_cells(b)
    f = (2 * gr.HC) / max(1, R[0] - L[0])
    return gr.bake(im, f)


def pieces():
    n = 0
    for j in bn.piece_jobs('pieces'):
        if j['where'] != 'kit' or not done(j['key']):
            continue
        im = trim(Image.open(bn.out_path(j)).convert('RGBA'))
        pid = j['key']
        if pid.endswith(('_tower', '_post')):
            # (a corner piece: its plinth a cell, cut as a post by tools/grid-recut.py MADE_POSTS; not a kit piece of
            # its own, so no part of the kit is drawn with it by mistake)
            im = trim(bake_to_cell(im))
            im.save(os.path.join(KIT, pid + '.png'))
        else:
            # (a heap: as wide as the piece it stands beside in the kit, cut as a loose piece, MADE_LOOSE)
            ref = Image.open(os.path.join(KIT, j['refs'][0] + '.png'))
            k = ref.width / im.width
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            im.save(os.path.join(KIT, pid + '.png'))
            upsert(os.path.join(KIT, 'index.json'), pid, im.width, im.height)
        n += 1
    if n:
        subprocess.run(['python3', 'tools/grid-recut.py'], cwd=REPO, check=True)
    print(f'pieces: {n} in')


# the flame's height on the map, px (a torch's head is about 5 px across)
FLAME_PX = 12


def flame():
    keys = [j['key'] for j in bn.flame_jobs('pieces')]
    got = [bn.done_png(k) for k in keys if done(k)]
    got = [g for g in got if g]
    if len(got) < 2:
        print('flame: not finished')
        return
    ims = [Image.open(g).convert('RGBA') for g in got]
    # (one box round every frame, so the flame's foot stays put)
    boxes = [i.getbbox() for i in ims]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    k = FLAME_PX / (box[3] - box[1])
    side = max(FLAME_PX, round((box[2] - box[0]) * k))
    strip = Image.new('RGBA', (side * len(ims), side), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        f = im.crop(box)
        f = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
        strip.alpha_composite(f, (i * side + (side - f.width) // 2, side - f.height))
    save_png(strip, os.path.join(KIT, 'flame.png'))
    made('flame', True)
    print(f'flame: {len(ims)} frames')


# the barrow's length in the kit's px (a cell is 2 HC, about 72, wide): about half a cell and a bit
BARROW_W = 52


def barrow():
    n = 0
    for j in bn.barrow_jobs('barrow'):
        if not done(j['key']):
            continue
        im = trim(Image.open(bn.out_path(j)).convert('RGBA'))
        k = BARROW_W / im.width
        im = im.resize((BARROW_W, max(1, round(im.height * k))), Image.LANCZOS)
        save_png(im, os.path.join(KIT, j['key'] + '.png'))
        made('barrow', j['key'][len('barrow_'):])
        n += 1
    print(f'barrow: {n} views and loads')


# ------------------------------------------------------------------------------------------------ moves

# characters fetched this run (a zip is fetched once a run, fresh: moves may have been added since the last)
fetched = set()


def new_move(st, cid, base=None):
    """The move a job added: in its character's zip after it (`names_after`), not before it (`names_before`), and, if
    `base` is given, of that template (its folder name's start). Returns (folder, src) or (None, None). NO_FETCH=1
    uses the zips already in pl/chars/."""
    src = f"pl/chars/nov_{cid[:8]}"
    if cid not in fetched and not os.environ.get('NO_FETCH'):
        if not af.fetch(cid, src):
            return None, None
        fetched.add(cid)
    if not os.path.exists(f'{src}/metadata.json'):
        return None, None
    meta = json.load(open(f'{src}/metadata.json'))['states'][0]
    before = set(st.get('names_before') or [])
    after = st.get('names_after')
    names = [n for n in meta['frames']['animations'] if n not in before and (after is None or n in after)]
    if base:
        names = [n for n in names if n.split('-')[0].startswith(base)]
    return (names[-1] if names else None), src


def frames_by_dir(meta, name):
    by_dir = meta['frames']['animations'][name]
    # (a direction made twice comes as 'east-305fd992': the first kept)
    return {k: v for k, v in sorted(by_dir.items(), reverse=True) for k in [re.sub(r'-[0-9a-f]{8}$', '', k)]}


def lying(path):
    """A frame where the figure lies down: wider than tall."""
    box = Image.open(path).getbbox()
    return bool(box) and (box[2] - box[0]) >= 1.1 * (box[3] - box[1])


def lay_move(look_dir, src, name, game, keep=None, fallback=None):
    """One move into a look's folder: its sheet (`game`.png, a row a direction in the look's order, centred on the
    look's frame) and its entry in the look's index.json. `keep(path)`: which frames to keep (sleep: the lying ones);
    `fallback(dir)`: a still frame (an Image) for a direction with too few. Returns the frames a direction."""
    ix = json.load(open(f'{look_dir}/index.json'))
    meta = json.load(open(f'{src}/metadata.json'))['states'][0]
    by_dir = frames_by_dir(meta, name)
    w, h = ix['frame']
    rows = []
    for d in ix['directions']:
        fs = [f'{src}/{f}' for f in by_dir.get(d, [])]
        if keep:
            fs = [f for f in fs if keep(f)]
        rows.append(fs)
    n = max(len(r) for r in rows)
    if n < 2:
        return 0
    tmp = f'{src}/_still'
    os.makedirs(tmp, exist_ok=True)
    for i, (d, r) in enumerate(zip(ix['directions'], rows)):
        if len(r) < 2 and fallback:
            still = fallback(d)
            p = f'{tmp}/{d}.png'
            still.save(p)
            rows[i] = [p] * n
        else:
            # (a shorter row loops round to fill)
            rows[i] = [r[k % len(r)] for k in range(n)] if r else []
    if not all(rows):
        return 0
    af.sheet(rows, f'{look_dir}/{game}.png', (w, h))
    ix['animations'][game] = {'frames': n}
    write_json(f'{look_dir}/index.json', ix)
    return n


def held_death(look_dir):
    """A direction's last death frame, cut from the look's death sheet: the still a sleeping row falls back to."""
    ix = json.load(open(f'{look_dir}/index.json'))
    sheet = Image.open(f'{look_dir}/death.png').convert('RGBA')
    w, h = ix['frame']
    n = ix['animations']['death']['frames']

    def still(d):
        r = ix['directions'].index(d)
        return sheet.crop(((n - 1) * w, r * h, n * w, (r + 1) * h)).crop((af.PAD, af.PAD, w - af.PAD, h - af.PAD))
    return still


def new_looks():
    """The new looks (batch_nov.py LOOKS) with all their moves done: look -> (its character, its tool, the tool's
    character)."""
    out = {}
    for look, (_, _, _, tool) in bn.LOOKS.items():
        k = f'look_{look}'
        keys = [k] + [f'{k}_{m}' for m in bn.LOOK_MOVES] + [f'{k}_{tool}', f'{k}_{tool}_{bn.TOOLS[tool][1]}']
        if all(done(x) for x in keys):
            out[look] = (state[k]['character_id'], tool, state[f'{k}_{tool}']['character_id'])
    return out


def looks():
    """The new looks into art/iso/folk/settlers/, as assemble_folk.py lays the settler looks: the bare look's rotations and
    six moves, its tool look's one move; their colours labelled (tools/folk-roles.py); then made.json `looks`, which
    puts them in the game (iso/folkRules.ts FITTED_LOOKS)."""
    root = os.path.join(ISO, 'folk', 'settlers')
    n = 0
    for look, (cid, tool, tool_cid) in new_looks().items():
        src, tsrc = f'pl/chars/nov_{cid[:8]}', f'pl/chars/nov_{tool_cid[:8]}'
        if not (af.fetch(cid, src) and af.fetch(tool_cid, tsrc)):
            print(f'  {look}: FETCH FAILED')
            continue
        fetched.update({cid, tool_cid})
        anims = af.lay(src, os.path.join(root, look), 'settlers', look)
        missing = [m for m in bn.LOOK_MOVES if m not in anims]
        if missing:
            print(f'  {look}: LEFT OUT, no {missing} in its zip')
            continue
        tanims = af.lay(tsrc, os.path.join(root, f'{look}+{tool}'), 'settlers', f'{look}+{tool}', af.MOVE[tool])
        subprocess.run(['python3', 'tools/folk-roles.py', f'settlers/{look}'], cwd=REPO, check=True)
        made('looks', look)
        print(f'  {look}: {sorted(anims)}, {tool} {sorted(tanims)}')
        n += 1
    print(f'looks: {n} in' + ('' if n else ' (none finished)'))


def folk_moves(prefix, game, keep_lying):
    looks = {**bn.look_ids(), **{k: v[0] for k, v in new_looks().items()}}
    n = 0
    done_looks = []
    # (the new looks' too, once `looks` has laid them)
    every = [*bn.SLEEPERS, *bn.SLEEPERS_NEW] if game == 'sleep' else [*bn.PUSHERS, *bn.PUSHERS_NEW]
    for look in every:
        st = state.get(f'{prefix}_{look}', {})
        look_dir = os.path.join(ISO, 'folk', 'settlers', look)
        if not st.get('done') or look not in looks or not os.path.exists(f'{look_dir}/index.json'):
            continue
        name, src = new_move(st, looks[look], None if game == 'sleep' else 'push')
        if not name:
            print(f'  {look}: its {game} not found in the zip')
            continue
        got = lay_move(look_dir, src, name, game, keep=lying if keep_lying else None, fallback=held_death(look_dir) if keep_lying else None)
        print(f'  {look}: {game} {got} frames' if got else f'  {look}: {game} LEFT OUT (too few frames)')
        n += bool(got)
        if got:
            done_looks.append(f'settlers/{look}')
    # (the new sheets' colours labelled, so each person's own hair, skin and dress tint them: tools/folk-roles.py
    # labels only the sheets not labelled yet)
    if done_looks:
        subprocess.run(['python3', 'tools/folk-roles.py', *done_looks], cwd=REPO, check=True)
    print(f'{game}: {n} looks')


# PixelLab's folder names for the God creatures' remade moves (assemble_god.py)
GOD_BASE = {'death': 'falling', 'walk': 'walking', 'punch': 'cross_punch', 'miracle': 'casting'}


def god():
    ids = bn.creature_ids()
    for c, m, _, ds in bn.GOD_FIX:
        st = state.get(f'god_{c}_{m}', {})
        if not st.get('done'):
            continue
        name, src = new_move(st, ids[c], GOD_BASE[m])
        if not name:
            print(f'  {c} {m}: not found in the zip')
            continue
        out = os.path.join(ISO, 'creature', c)
        ix = json.load(open(f'{out}/index.json'))
        w, h = ix['frame']
        by_dir = frames_by_dir(json.load(open(f'{src}/metadata.json'))['states'][0], name)
        sheet = Image.open(f'{out}/{m}.png').convert('RGBA')
        n = ix['animations'][m]['frames']
        for d in ds:
            fs = by_dir.get(d, [])[:n]
            if not fs:
                continue
            r = ix['directions'].index(d)
            sheet.paste((0, 0, 0, 0), (0, r * h, sheet.width, (r + 1) * h))
            for i in range(n):
                f = Image.open(f'{src}/{fs[i % len(fs)]}').convert('RGBA')
                sheet.alpha_composite(f, (i * w + (w - f.width) // 2, r * h + (h - f.height) // 2))
        save_png(sheet, f'{out}/{m}.png')
        print(f'  {c} {m}: {len(ds)} directions laid over')


# ------------------------------------------------------------------------------------------------ the cards

# the rows each card beast's sheet gets (the scene player plays walk, attack and idle), from its moves
CARD_ROWS = {'wolf': {'walk': 'walk', 'attack': 'attack', 'idle': 'idle'}, 'bear': {'walk': 'walk', 'attack': 'attack', 'idle': 'idle'},
             # (the dragon is in the air on the cards: its fly is its walk and its idle; its ground walk kept as `stride`)
             'dragon': {'walk': 'fly', 'attack': 'attack', 'idle': 'fly', 'stride': 'walk'}}


def cards():
    packs_json = os.path.join(ART, 'creatures', 'packs.json')
    for kind, rows in CARD_ROWS.items():
        cid = state.get(f'card_{kind}', {}).get('character_id')
        moves = {m: state.get(f'card_{kind}_{m}', {}) for m in set(rows.values())}
        if not cid or not all(v.get('done') for v in moves.values()):
            continue
        frames = {}
        for m, st in moves.items():
            # (each move is the one its job added: before it, not after the next)
            name, src = new_move(st, cid)
            if not name:
                break
            meta = json.load(open(f'{src}/metadata.json'))['states'][0]
            fs = frames_by_dir(meta, name).get('east', [])
            frames[m] = [Image.open(f'{src}/{f}').convert('RGBA') for f in fs]
        if len(frames) < len(moves):
            print(f'  {kind}: a move not found')
            continue
        ims = [i for fs in frames.values() for i in fs]
        boxes = [i.getbbox() for i in ims if i.getbbox()]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        w, h = box[2] - box[0], box[3] - box[1]
        per = max(len(frames[m]) for m in rows.values())
        sheet = Image.new('RGBA', (w * per, h * len(rows)), (0, 0, 0, 0))
        for r, (row, m) in enumerate(rows.items()):
            for i, im in enumerate(frames[m]):
                sheet.alpha_composite(im.crop(box), (i * w, r * h))
        save_png(sheet, os.path.join(ART, 'creatures', 'packs', f'pl_{kind}.png'))
        lay = load_json(packs_json, {})
        first = frames[rows['walk']][0].crop(box).getbbox()
        lay[f'pl_{kind}'] = {'w': w, 'h': h, 'perRow': per, 'rows': list(rows), 'counts': {row: len(frames[m]) for row, m in rows.items()},
                             'figure': first[3] - first[1], 'facesRight': True}
        write_json(packs_json, lay)
        print(f'  {kind}: pl_{kind} {w}x{h}, rows {list(rows)}')


# ------------------------------------------------------------------------------------------------ the tests

def test():
    """The test pictures side by side (pl/nov/test/contact.png), and the test moves' frames below them."""
    ims = []
    for j in bn.jobs_for('test'):
        p = bn.out_path(j)
        if os.path.exists(p):
            ims.append(Image.open(p).convert('RGBA'))
        elif j['kind'] == 'anim' and done(j['key']):
            st = state[j['key']]
            cid = st['character_id']
            name, src = new_move(st, cid)
            if not name:
                continue
            by_dir = frames_by_dir(json.load(open(f'{src}/metadata.json'))['states'][0], name)
            for d, fs in by_dir.items():
                row = [Image.open(f'{src}/{f}').convert('RGBA') for f in fs]
                strip = Image.new('RGBA', (sum(i.width for i in row), max(i.height for i in row)))
                x = 0
                for i in row:
                    strip.alpha_composite(i, (x, 0))
                    x += i.width
                ims.append(strip)
    if not ims:
        print('test: nothing finished')
        return
    W = max(sum(i.width for i in ims[:5]), max(i.width for i in ims))
    rows, row, x = [], [], 0
    for i in ims:
        if row and x + i.width > W:
            rows.append(row)
            row, x = [], 0
        row.append(i)
        x += i.width
    rows.append(row)
    H = sum(max(i.height for i in r) for r in rows)
    sheet = Image.new('RGBA', (W, H), (60, 70, 60, 255))
    y = 0
    for r in rows:
        x = 0
        for i in r:
            sheet.alpha_composite(i, (x, y))
            x += i.width
        y += max(i.height for i in r)
    sheet.save(f'{bn.OUT}/test/contact.png')
    print(f'test: {len(ims)} pictures in {bn.OUT}/test/contact.png')


if __name__ == '__main__':
    for k in KINDS:
        {'buildings': buildings, 'pieces': pieces, 'flame': flame, 'barrow': barrow, 'looks': looks, 'sleep': lambda: folk_moves('sleep', 'sleep', True),
         'push': lambda: folk_moves('push', 'push', False), 'god': god, 'cards': cards, 'test': test}[k]()
    print('Now in the repo: npm run typecheck && npm test, then npm run web and look at both phone sizes.')
