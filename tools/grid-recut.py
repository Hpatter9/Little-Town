"""Cuts the settlers' kit and the shared building pieces to the grid (docs/notes/grid-audit.md, the rules the owner
approved): each piece gets a copy in a `grid/` folder beside it (art/iso/kits/settlers/grid/, art/iso/buildings/grid/)
and its record in that folder's `grid.json`:

  anchor  [x, y] px in the copy: the front corner of its footprint, at the top of the grass (iso/isoView.ts puts it on
          the footprint's front corner)
  foot    [w, h] whole cells along x and along y (as drawn; mirrored it is [h, w])
  kind    'building', 'loose' (a tree, a rock, a prop: one cell, its foot on the cell's middle), 'seg' (one cell of a
          wall or fence lying along x), 'gate' (a gate's middle, lying along x)
  bake    how much the copy was scaled from the original, so it is drawn at the kit's own scale like everything else

Everything below the footprint's front edges (the slab of soil, a plinth running onto the cells in front) is cut off.
The originals are left as they were: the raid board and the menus still draw them. A dev tool, run by hand after
`node tools/grid-audit.mjs` (which writes out/grid-defs.json, the buildings' footprints):
`python3 tools/grid-recut.py`. A piece already in grid.json keeps its record (only its copy is cut again);
`--fresh` measures everything again."""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ISO = os.path.join(HERE, '..', 'src', 'renderer', 'art', 'iso')
KIT = os.path.join(ISO, 'kits', 'settlers')
SHARED = os.path.join(ISO, 'buildings')
FRESH = '--fresh' in sys.argv

ISO_TW = 48
ISO_ART = 0.5
SCALE = json.load(open(os.path.join(ISO, 'kits', 'kits.json')))['settlers']['scale']
# px of the kit's own art to half a cell (a cell is 2 HC wide and HC tall)
HC = (ISO_TW / 2) / (SCALE * ISO_ART)
SOLID = 24

# the kit's pieces by what they are, and how much each kind is baked (a tree's canopy at most a cell and a half wide, a
# rock heap or a bush within its cell, a prop as the view drew props, at 0.6 of the kit's size)
BUILDINGS = ['cottage', 'longhouse', 'stockpile', 'workshop', 'tavern', 'well', 'chapel', 'granary', 'watchtower', 'market_stall', 'campfire']
LOOSE = {'oak_tree': 0.73, 'pine_tree': 0.73, 'bush': 0.7, 'rocks': 0.58, 'barrels': 0.6, 'crates': 0.6, 'woodpile': 0.6, 'hay_bales': 0.6,
         'cart': 0.6, 'lamp_post': 0.6, 'signpost': 0.6}
# walls and fences: a cell cut from the middle of the kit's run (a fence's centred on a post, so each cell has one);
# gates: their middle, this many cells long
SEGS = {'stone_wall_seg': 'stone_wall_run', 'palisade_seg': 'palisade_run', 'fence_seg': 'fence'}
GATES = {'stone_gate_seg': ('stone_gate', 2), 'palisade_gate_seg': ('palisade_gate', 2)}
ON_POST = {'fence'}
# px taken out of the middle of a run's height (its tips and its foot kept): the palisade's stakes stood half again a
# person's height and hid the town behind; lowered, they stand about shoulder to head high (the owner's ask)
LOWER = {'palisade_run': 28, 'palisade_gate': 28}
# how much of a column's foot is kept under the band taken out (its ground and the stones at the stakes' feet)
LOWER_KEEP = 45
# the stone wall's corner: one of the stone gate's towers, a cell across, on the corner cell's middle
POSTS = {'stone_wall_post': 'stone_gate'}
# the kit's pieces drawn lying along y (iso/isoKits.ts ALONG_Y): mirrored first, so every cut lies along x
ALONG_Y = {'stone_wall_run', 'stone_gate', 'fence'}
# a gate's middle is cut this much wider than its cells, a quarter cell each side (rule 4's eaves)
GATE_EAVES = 0.25


def alpha_of(im):
    a = im.getchannel('A')
    w, h = im.size
    px = a.load()
    return lambda x, y: px[x, y], w, h


def measure_base(im):
    """iso/gridAudit.ts measureBase: the plinth's front corner, its side corners (the slab's bottom) and the slab."""
    alpha, w, h = alpha_of(im)
    L = [-1] * h
    R = [-1] * h
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if alpha(x, y) < SOLID:
                continue
            if L[y] < 0:
                L[y] = x
            R[y] = x
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
    if y1 < 0:
        return None
    front = ((L[y1] + R[y1]) / 2, y1)

    def side(edge, out):
        best, at, still = edge[y1], y1, 0
        y = y1 - 1
        while y >= y0 and y1 - y < w:
            if edge[y] < 0:
                break
            reach = (edge[y] - best) * out
            if reach > 0:
                best, at, still = edge[y], y, 0
            else:
                if reach < -6:
                    break
                still += 1
                if still > 40:
                    break
            y -= 1
        slab = 0
        y = at - 1
        while y >= y0 and abs(edge[y] - best) <= 1:
            slab += 1
            y -= 1
        return (best, at), slab

    left, ls = side(L, -1)
    right, rs = side(R, 1)
    return {'box': (x0, y0, x1, y1), 'front': front, 'left': left, 'right': right, 'slab': round((ls + rs) / 2), 'L': L, 'R': R}


def foot_centre_offset(w, h):
    """A footprint's diamond's middle, from its front corner (px)."""
    return ((h - w) * HC / 2, -(w + h) * HC / 2 / 2 * 1)


def cut_below(im, anchor, w, h):
    """Clears every pixel below the footprint's front edges (and, past its side corners, below the corners' level)."""
    ax, ay = anchor
    px = im.load()
    W, H = im.size
    lx, ly = ax - w * HC, ay - w * HC / 2
    rx, ry = ax + h * HC, ay - h * HC / 2
    for y in range(H):
        cy = y + 0.5
        for x in range(W):
            cx = x + 0.5
            if cx < lx:
                edge = ly
            elif cx <= ax:
                edge = ay - (ax - cx) / 2
            elif cx <= rx:
                edge = ay - (cx - ax) / 2
            else:
                edge = ry
            if cy > edge + 0.5:
                px[x, y] = (0, 0, 0, 0)


def bake(im, f):
    if abs(f - 1) < 1e-6:
        return im
    return im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


def plinth_cells(b):
    """The plinth's top-face corners and its cells along x (a) and y (b)."""
    s = b['slab']
    L = (b['left'][0], b['left'][1] - s)
    R = (b['right'][0], b['right'][1] - s)
    F = (b['front'][0], b['front'][1] - s)
    return L, F, R, (F[0] - L[0]) / HC, (R[0] - F[0]) / HC


def cells(n):
    """A plinth's cells rounded down unless it is past the half by a little: 2.5 is 2 (its edge cut a quarter cell), 2.55 is 3."""
    return max(1, int(n + 0.45))


# pieces whose plinth is between sizes, given the larger: the campfire's ring of stones is a cell and a half across
FOOT = {'campfire': (2, 2)}


def building_record(im, foot=None):
    """Its footprint (`foot`: a shared piece's is its building's, turned to lie as its plinth does) and its anchor."""
    b = measure_base(im)
    L, F, R, a, bb = plinth_cells(b)
    if foot:
        w, h = foot if abs(foot[0] - a) + abs(foot[1] - bb) <= abs(foot[1] - a) + abs(foot[0] - bb) else (foot[1], foot[0])
    # (a plinth that isn't its building's shape at all, as the launch site's square pad for an 8x4 footprint: its own
    # cells, and the building waits for a picture of its own)
    if not foot or abs(w - a) > 0.75 or abs(h - bb) > 0.75:
        w, h = cells(a), cells(bb)
    # (the footprint's diamond laid over the plinth's: their middles together)
    mid = ((L[0] + R[0]) / 2, (L[1] + R[1]) / 2)
    off = foot_centre_offset(w, h)
    anchor = (round(mid[0] - off[0]), round(mid[1] - off[1]))
    return {'anchor': list(anchor), 'foot': [w, h], 'plinth': [round(a, 2), round(bb, 2)]}


def loose_record(im):
    """A tree, a rock, a prop: its foot is the middle of its lowest rows' spread; one cell, its middle there."""
    alpha, w, h = alpha_of(im)
    rows = []
    for y in range(h - 1, -1, -1):
        xs = [x for x in range(w) if alpha(x, y) >= SOLID]
        if xs:
            rows.append((y, xs[0], xs[-1]))
        if len(rows) >= max(4, round(HC * 0.6)):
            break
    y1 = rows[0][0]
    # (its base: the widest of its lowest rows; a diamond that wide has its middle a quarter of the width up)
    lo = min(r[1] for r in rows)
    hi = max(r[2] for r in rows)
    # (across, the middle of all it draws: a cart's handle or a tree's lean doesn't pull it off the cell's middle)
    box = im.getbbox()
    cx = (box[0] + box[2]) / 2
    spread = hi - lo + 1
    cy = y1 + 1 - min(spread / 4, HC / 2)
    return {'anchor': [round(cx), round(cy + HC / 2)], 'foot': [1, 1]}


def seg_cut(src, cells, mirror):
    """A run's middle `cells` long (and the eaves), lying along x: its anchor the front corner of a footprint `cells`
    by 1 whose middle is the run's middle. The kits' runs are drawn shallower than the grid's 2:1 (their ground slopes
    about a quarter, not a half), so the cut is sheared upright to 2:1 (columns moved up or down, never tilted: posts and
    stakes stay upright), or cells laid end to end would step."""
    im = Image.open(src).convert('RGBA')
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    alpha, w, h = alpha_of(im)
    slab = measure_base(im)['slab']
    name = os.path.basename(src)[:-4]
    # (its foot: the lowest drawn row of each column; the slope fitted over the middle of the run)
    foot = {}
    for x in range(w):
        for y in range(h - 1, -1, -1):
            if alpha(x, y) >= SOLID:
                foot[x] = y
                break
    xs = [x for x in range(int(w * 0.2), int(w * 0.8)) if x in foot]
    mx = sum(xs) / len(xs)
    my = sum(foot[x] for x in xs) / len(xs)
    slope = sum((x - mx) * (foot[x] - my) for x in xs) / sum((x - mx) ** 2 for x in xs)
    mid = (min(foot) + max(foot)) / 2
    if name in ON_POST:
        mid = post_near(im, foot, mid)
    if name in LOWER:
        im = lowered(im, foot, LOWER[name])
    half = cells * HC / 2 + (GATE_EAVES * HC if cells > 1 else 1)
    x0, x1 = max(0, int(round(mid - half))), min(w, int(round(mid + half)))
    # (sheared to 2:1 about the middle column: the shift at its edges is how far the run falls short of a half)
    shear = 0.5 - slope
    pad = int(abs(shear) * half) + 2
    out = Image.new('RGBA', (x1 - x0, h + 2 * pad), (0, 0, 0, 0))
    for x in range(x0, x1):
        dy = round(shear * (x + 0.5 - mid)) + pad
        out.paste(im.crop((x, 0, x + 1, h)), (x - x0, dy))
    # (the ground's front edge at the middle column, over the slab: the run's ground is taken as 0.6 of a cell deep,
    # its middle 0.3 of a cell behind that edge, on the middle of the footprint)
    edge = my + slope * (mid - mx) - slab + pad
    off = foot_centre_offset(cells, 1)
    centre_y = edge - 0.3 * HC
    anchor = (round(mid - off[0] - x0), round(centre_y - off[1]))
    bbox = out.getbbox()
    top = bbox[1] if bbox else 0
    out = out.crop((0, top, out.width, bbox[3] if bbox else out.height))
    return out, [anchor[0], anchor[1] - top], [cells, 1], round(slope, 3)


def heights(im, foot):
    """Each column's drawn height (its foot to its top)."""
    alpha, w, h = alpha_of(im)
    out = {}
    for x, f in foot.items():
        top = next(y for y in range(h) if alpha(x, y) >= SOLID)
        out[x] = f - top
    return out


def post_near(im, foot, mid):
    """The middle of the post nearest a column: a run of columns taller than the rails beside them."""
    hs = heights(im, foot)
    tall = max(hs.values())
    cols = sorted(x for x, v in hs.items() if v >= tall - 6)
    runs, run = [], []
    for x in cols:
        if run and x != run[-1] + 1:
            runs.append(run)
            run = []
        run.append(x)
    runs.append(run)
    return min(((r[0] + r[-1]) / 2 for r in runs), key=lambda c: abs(c - mid))


def lowered(im, foot, cut):
    """A run with `cut` px taken out of each column's height above its foot (the foot and the tips kept)."""
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    w, h = im.size
    for x in range(w):
        col = im.crop((x, 0, x + 1, h))
        if x not in foot:
            continue
        keep_from = max(0, foot[x] - LOWER_KEEP)
        top_end = max(0, keep_from - cut)
        out.paste(col.crop((0, keep_from, 1, h)), (x, keep_from))
        if top_end > 0:
            out.paste(col.crop((0, 0, 1, top_end)), (x, cut))
    return out


def post_cut(src, mirror):
    """A tower cut from a gate as a one-cell corner piece: the first group of columns standing well over the wall, its
    foot on the middle of its cell, as a wall's seg is (0.3 of a cell behind its ground's front edge)."""
    im = Image.open(src).convert('RGBA')
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    alpha, w, h = alpha_of(im)
    slab = measure_base(im)['slab']
    foot = {}
    for x in range(w):
        for y in range(h - 1, -1, -1):
            if alpha(x, y) >= SOLID:
                foot[x] = y
                break
    hs = heights(im, foot)
    wall = sorted(hs.values())[len(hs) // 2]
    cols = [x for x in sorted(hs) if hs[x] > wall + 25]
    group = [cols[0]]
    for x in cols[1:]:
        if x != group[-1] + 1:
            break
        group.append(x)
    x0, x1 = group[0], group[-1] + 1
    cx = (x0 + x1) / 2
    edge = foot[int(cx)] - slab
    anchor = [round(cx - x0), round(edge - 0.3 * HC + HC / 2)]
    cut = im.crop((x0, 0, x1, h))
    cut_below(cut, anchor, 1, 1)
    bbox = cut.getbbox()
    cut = cut.crop((0, bbox[1], cut.width, bbox[3]))
    return cut, [anchor[0], anchor[1] - bbox[1]]


def main():
    out_kit = os.path.join(KIT, 'grid')
    out_shared = os.path.join(SHARED, 'grid')
    kit_rec_path = os.path.join(out_kit, 'grid.json')
    shared_rec_path = os.path.join(out_shared, 'grid.json')
    kit_rec = {} if FRESH or not os.path.exists(kit_rec_path) else json.load(open(kit_rec_path))
    shared_rec = {} if FRESH or not os.path.exists(shared_rec_path) else json.load(open(shared_rec_path))

    for pid in BUILDINGS:
        im = Image.open(os.path.join(KIT, pid + '.png')).convert('RGBA')
        rec = kit_rec.get(pid) or {**building_record(im, FOOT.get(pid)), 'kind': 'building', 'bake': 1}
        cut_below(im, rec['anchor'], *rec['foot'])
        save(im, os.path.join(out_kit, pid + '.png'))
        kit_rec[pid] = rec
    for pid, f in LOOSE.items():
        im = bake(Image.open(os.path.join(KIT, pid + '.png')).convert('RGBA'), f)
        rec = kit_rec.get(pid) or {**loose_record(im), 'kind': 'loose', 'bake': f}
        cut_below(im, rec['anchor'], *rec['foot'])
        save(im, os.path.join(out_kit, pid + '.png'))
        kit_rec[pid] = rec
    for pid, src in SEGS.items():
        cut, anchor, foot, slope = seg_cut(os.path.join(KIT, src + '.png'), 1, src in ALONG_Y)
        save(cut, os.path.join(out_kit, pid + '.png'))
        kit_rec[pid] = {'anchor': anchor, 'foot': foot, 'kind': 'seg', 'bake': 1, 'from': src, 'slope': slope}
    for pid, src in POSTS.items():
        cut, anchor = post_cut(os.path.join(KIT, src + '.png'), src in ALONG_Y)
        save(cut, os.path.join(out_kit, pid + '.png'))
        kit_rec[pid] = {'anchor': anchor, 'foot': [1, 1], 'kind': 'post', 'bake': 1, 'from': src}
    for pid, (src, cells) in GATES.items():
        cut, anchor, foot, slope = seg_cut(os.path.join(KIT, src + '.png'), cells, src in ALONG_Y)
        save(cut, os.path.join(out_kit, pid + '.png'))
        kit_rec[pid] = {'anchor': anchor, 'foot': foot, 'kind': 'gate', 'bake': 1, 'from': src, 'slope': slope}

    # the shared pieces: baked so their plinth is their footprint's size at the kit's scale (the ones laid on the ground
    # off the grid's angle, `ground`, are left to iso/isoMath.ts groundFit)
    defs = json.load(open(os.path.join(HERE, '..', 'out', 'grid-defs.json')))
    for p in json.load(open(os.path.join(SHARED, 'index.json'))):
        pid = p['id']
        if p.get('ground') or pid not in defs:
            continue
        im = Image.open(os.path.join(SHARED, pid + '.png')).convert('RGBA')
        if p.get('soil'):
            im = im.crop((0, 0, im.width, im.height - p['soil']))
        rec = shared_rec.get(pid)
        if rec:
            im = bake(im, rec['bake'])
        else:
            w, h = defs[pid]
            b = measure_base(im)
            L, F, R, a, bb = plinth_cells(b)
            f = ((w + h) * HC) / (R[0] - L[0])
            im = bake(im, f)
            rec = {**building_record(im, (w, h)), 'kind': 'building', 'bake': round(f, 4)}
        cut_below(im, rec['anchor'], *rec['foot'])
        save(im, os.path.join(out_shared, pid + '.png'))
        shared_rec[pid] = rec

    for path, rec in ((kit_rec_path, kit_rec), (shared_rec_path, shared_rec)):
        with open(path, 'w') as f:
            json.dump(dict(sorted(rec.items())), f, indent=1)
            f.write('\n')
    print(f'cut {len(kit_rec)} settlers pieces and {len(shared_rec)} shared pieces (a half-cell is {HC:.2f} px of the kit)')


if __name__ == '__main__':
    main()
