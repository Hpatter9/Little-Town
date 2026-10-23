"""Labels the colours of the isometric townsfolk's sheets (src/renderer/art/iso/folk) by what they paint: skin, hair,
the main cloth and a second cloth, so the game can recolour each person's hair, skin and dress to their own colours
(renderer/iso/folkTint.ts). Writes a roles.json beside each look's index.json: for each sheet, the colours of each
role, and the look's reference colour per role (what the art's own hair, skin and cloth are, on average).

Each pixel is judged by its colour (the look's boxes, `LOOKS`) and by where it is in its frame (hair and beards are at
the head, so a brown boot of the same colour is not hair). Where one colour paints two things (the same brown in the
hair and the boots), the fewer pixels are given a colour one step off (a single unit of blue), so in the sheet each
colour paints one thing only and the game's lookup is exact. That is the only change made to the art: invisible.

Each sheet has its own palette (even a look's armed copies share no exact colours), so every sheet is labelled. The
armed looks (`man_base+axe`) use their bare look's boxes and reference, so a person keeps their colours when they
pick up a tool. The peoples with colours of their own (orcs, liches...) are not labelled: drawn as the art has them.

A dev tool, run by hand after new folk art lands (new sheets, or new armed looks): `python3 tools/folk-roles.py`
labels every sheet not labelled yet (one in no roles.json) and leaves the rest as they are, so it is safe to run again
at any time. Name peoples or looks to do only those, e.g. `python3 tools/folk-roles.py knights` or
`python3 tools/folk-roles.py settlers/man_base` (a look's armed copies too). `--again` relabels everything named from
scratch: do that only on the art as PixelLab made it (`git checkout origin/main -- src/renderer/art/iso/folk` before
this tool first ran, about a quarter of an hour for all), since each labelling nudges some colours. A new look needs
its boxes in `LOOKS` first (check them with `--qa`). `--qa out.png [--only settlers]` draws the looks' still frames
with the roles painted flat (pink skin, yellow hair, orange hair across the face, blue cloth, cyan second cloth), to
check by eye; `--bare` does only the bare looks' still frames, quick, for tuning `LOOKS` (use it with `--again`, then
relabel in full)."""
import glob
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'src', 'renderer', 'art', 'iso', 'folk')
PEOPLES = ['settlers', 'druid', 'nomads', 'alchemists', 'knights']
ROLES = ['skin', 'hair', 'cloth', 'cloth2', 'brow']

# A box is (hue from, hue to, saturation from, to, lightness from, to); the hue wraps round when from > to. A role
# can have several boxes. `place` is where on the figure a role can be, from 0 (the top of the figure in its frame) to
# 1 (its feet): hair and beards at the head, a tunic above the belt and breeches below it, so a brown boot the colour
# of the hair is not hair. Above `crown` the hair box wins (the hair's light strands are skin-coloured); across the
# face, skin and hair are told apart by where each colour is mostly drawn (`classify`), and the hair across the face
# (brows, moustache, beard) is `brow`: the game paints it the hair's colour, toned a little towards the skin, so fair
# brows on a dark face don't read as a mask (`faceTop`: where the face can start, for a look whose lit hair is the
# colour of its face); on a `beard` look the lower face down to `beardTo` is beard, so hair.
# Cloth is never on the face.
SKIN = [(10, 34, 0.5, 1, 0.45, 0.92)]
HAIR = [(0, 45, 0.15, 1, 0.08, 0.75)]
DEFAULT = {'skin': SKIN, 'hair': HAIR, 'cloth': [], 'cloth2': [], 'crown': 0.07,
           'place': {'skin': (0, 1), 'hair': (0, 0.22), 'cloth': (0.15, 1), 'cloth2': (0.15, 1)}}
PLAIN = (0, 45, 0.02, 0.4, 0.25, 0.88)  # (undyed linen and wool: greyish browns)
BLUE = (190, 245, 0.12, 1, 0.08, 0.92)
LOOKS = {
    'settlers/child_boy': {'cloth': [(28, 50, 0.2, 1, 0.6, 0.95)], 'cloth2': [(5, 30, 0.3, 0.8, 0.15, 0.6)],
                           'place': {'hair': (0, 0.3), 'cloth': (0.3, 0.7), 'cloth2': (0.62, 0.88)}},
    'settlers/child_girl': {'cloth': [(55, 130, 0.08, 1, 0.07, 0.62)], 'place': {'hair': (0, 0.45)}},
    'settlers/man_base': {'beard': True, 'cloth': [PLAIN], 'cloth2': [PLAIN], 'place': {'hair': (0, 0.3), 'cloth': (0.17, 0.53), 'cloth2': (0.53, 0.9)}},
    'settlers/woman_base': {'cloth': [PLAIN], 'cloth2': [PLAIN], 'place': {'hair': (0, 0.25), 'cloth': (0.2, 0.5), 'cloth2': (0.5, 0.9)}},
    # (his fair hair's lit strands are the colour of his face: the face starts at his brow)
    'settlers/man_leather': {'crown': 0.05, 'faceTop': 0.1, 'skin': [(10, 27.5, 0.5, 1, 0.45, 0.92)], 'cloth': [(0, 45, 0.1, 0.4, 0.4, 0.8)], 'cloth2': [(0, 360, 0, 0.12, 0.2, 0.7)],
                             'place': {'hair': (0, 0.22), 'cloth': (0.2, 0.55), 'cloth2': (0.55, 0.9)}},
    'settlers/woman_leather': {'cloth': [(0, 45, 0.1, 0.4, 0.4, 0.8)], 'cloth2': [(0, 30, 0.1, 0.4, 0.12, 0.5)],
                               'place': {'hair': (0, 0.3), 'cloth': (0.2, 0.55), 'cloth2': (0.55, 0.9)}},
    'settlers/dwarf_base': {'beard': True, 'beardTo': 0.45, 'hair': [(0, 24, 0.4, 1, 0.08, 0.6)], 'cloth': [PLAIN], 'cloth2': [PLAIN], 'place': {'hair': (0, 0.3), 'cloth': (0.3, 0.55), 'cloth2': (0.55, 0.9)}},
    'settlers/dwarf_apron': {'beard': True, 'beardTo': 0.45, 'hair': [(350, 18, 0.55, 1, 0.08, 0.6)], 'place': {'hair': (0, 0.3)}},
    # (the plate dwarf's face is a slit in his helm: his skin is tinted, his beard stays as drawn)
    'settlers/dwarf_plate': {'hair': []},
    'settlers/man_plate': {'beard': True, 'cloth': [BLUE], 'place': {'hair': (0, 0.3)}},
    # (the druids: leaf-green robes and hoods; the elder's white hair and the warden's wolf hood stay as drawn)
    'druid/child_boy': {'cloth': [(60, 160, 0.1, 1, 0.08, 0.75)], 'place': {'hair': (0, 0.25)}},
    'druid/child_girl': {'cloth': [(50, 110, 0.1, 1, 0.08, 0.7)], 'place': {'hair': (0, 0.45)}},
    'druid/man_elder': {'hair': [], 'cloth': [(60, 160, 0.1, 1, 0.08, 0.75)]},
    'druid/man_warden': {'hair': []},
    'druid/woman_druid': {'cloth': [(70, 160, 0.1, 1, 0.07, 0.75)], 'place': {'hair': (0, 0.3)}},
    # (the nomads: turbans, veils and headscarves, so no hair; their robes are dyed. The girl's and the woman's
    # headscarves are the colour of their skin, so their skin stays as drawn)
    'nomads/child_boy': {'hair': [], 'cloth': [(215, 275, 0.1, 1, 0.08, 0.8)]},
    'nomads/child_girl': {'hair': [], 'skin': []},
    'nomads/man_herder': {'hair': [], 'cloth': [(0, 40, 0.15, 0.7, 0.1, 0.7)], 'cloth2': [(20, 60, 0.05, 0.4, 0.1, 0.65)],
                          'place': {'cloth': (0.28, 0.62), 'cloth2': (0.62, 0.9)}},
    'nomads/man_rider': {'hair': [], 'cloth': [(215, 275, 0.1, 1, 0.08, 0.8)]},
    'nomads/woman_nomad': {'hair': [], 'skin': [], 'cloth': [(335, 360, 0.4, 1, 0.12, 0.6)], 'place': {'cloth': (0.3, 1)}},
    # (the alchemists: robes of purple and teal; the apprentice's hood hides the hair, and his brown robe is the
    # colour of his shadowed face, so it stays)
    'alchemists/man_master': {'beard': True, 'cloth': [(250, 330, 0.1, 1, 0.08, 0.6)], 'place': {'hair': (0, 0.35)}},
    'alchemists/man_apprentice': {'hair': []},
    'alchemists/woman_alchemist': {'cloth': [(165, 210, 0.2, 1, 0.1, 0.65)], 'place': {'hair': (0, 0.3)}},
    'alchemists/child_boy': {'skin': [(10, 30, 0.5, 1, 0.6, 0.92), (10, 22, 0.45, 1, 0.45, 0.6)], 'cloth': [(28, 50, 0.4, 1, 0.3, 0.68)],
                             'place': {'hair': (0, 0.28), 'cloth': (0.25, 0.68)}},
    'alchemists/child_girl': {'cloth': [(170, 210, 0.15, 1, 0.08, 0.6)], 'place': {'hair': (0, 0.45)}},
    # (the knights: the tabards and tunics in heraldic dyes; the knight's great helm hides all)
    # (the squire's fringe falls over his brow: the top of his face is hair)
    'knights/man_squire': {'cloth': [(345, 10, 0.4, 1, 0.15, 0.55)], 'faceTop': 0.11, 'place': {'skin': (0.11, 1), 'cloth': (0.2, 1)}},
    'knights/woman_knight': {'cloth': [(195, 240, 0.35, 1, 0.1, 0.5)], 'place': {'hair': (0, 0.3), 'cloth': (0.25, 1)}},
    'knights/child_boy': {'cloth': [(340, 10, 0.35, 1, 0.12, 0.5)], 'place': {'hair': (0, 0.28), 'cloth': (0.25, 1)}},
    'knights/child_girl': {'cloth': [(195, 235, 0.25, 1, 0.1, 0.5)], 'place': {'hair': (0, 0.45), 'cloth': (0.25, 1)}},
    'knights/man_knight': {'skin': [], 'hair': []},
    'settlers/woman_plate': {'hair': [(350, 14, 0.5, 1, 0.08, 0.7)], 'cloth': [BLUE], 'place': {'hair': (0, 0.5)}},
}


def config(look):
    own = LOOKS.get(look, {})
    cfg = {**DEFAULT, **own, 'place': {**DEFAULT['place'], **own.get('place', {})}}
    return cfg


def hsl_arrays(rgb):
    """Hue (degrees), saturation and lightness of an (n, 3) array of 0..255 colours, as colorsys.rgb_to_hls has them."""
    c = rgb.astype(np.float64) / 255
    mx, mn = c.max(axis=1), c.min(axis=1)
    l = (mx + mn) / 2
    d = mx - mn
    s = np.where(d == 0, 0, d / np.where(l <= 0.5, mx + mn + 1e-12, 2 - mx - mn + 1e-12))
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    dd = np.where(d == 0, 1, d)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4))
    h = np.where(d == 0, 0, h * 60) % 360
    return h, s, l


def in_boxes(h, s, l, boxes):
    m = np.zeros(h.shape, bool)
    for b in boxes:
        hue = (h >= b[0]) & (h <= b[1]) if b[0] <= b[1] else (h >= b[0]) | (h <= b[1])
        m |= hue & (s >= b[2]) & (s <= b[3]) & (l >= b[4]) & (l <= b[5])
    return m


def rel_map(alpha, fw, fh):
    """How far down its figure each pixel is (0 the top, 1 the feet). A frame lying down (a death, a fall) doesn't
    say where the head is: there every pixel reads 0.5, so its hair is judged by colour alone."""
    H, W = alpha.shape
    rel = np.full((H, W), 0.5)
    for y0 in range(0, H - fh + 1, fh):
        for x0 in range(0, W - fw + 1, fw):
            rows = np.nonzero(alpha[y0:y0 + fh, x0:x0 + fw].any(axis=1))[0]
            if len(rows) == 0:
                continue
            top, bot = rows[0], rows[-1]
            if bot - top <= fh * 0.35:
                continue
            rel[y0:y0 + fh, x0:x0 + fw] = ((np.arange(fh) - top) / max(1, bot - top))[:, None]
    return rel


def components(mask):
    """Each pixel's 4-connected piece of a mask, by its size (0 off the mask)."""
    H, W = mask.shape
    big = H * W + 1
    lab = np.where(mask, np.arange(H * W).reshape(H, W), big)
    while True:
        m = lab.copy()
        m[1:] = np.minimum(m[1:], lab[:-1])
        m[:-1] = np.minimum(m[:-1], lab[1:])
        m[:, 1:] = np.minimum(m[:, 1:], lab[:, :-1])
        m[:, :-1] = np.minimum(m[:, :-1], lab[:, 1:])
        m = np.where(mask, m, big)
        if np.array_equal(m, lab):
            break
        lab = m
    ids, inv, counts = np.unique(lab, return_inverse=True, return_counts=True)
    size = counts[inv].reshape(H, W)
    return np.where(mask, size, 0)


def grow(mask, r):
    """A mask grown by `r` steps up, down and across."""
    out = mask.copy()
    for _ in range(r):
        g = out.copy()
        g[1:] |= out[:-1]
        g[:-1] |= out[1:]
        g[:, 1:] |= out[:, :-1]
        g[:, :-1] |= out[:, 1:]
        out = g
    return out


def face_hull(sure, fw, fh, r=3):
    """The face: each frame's big piece of lit skin grown by `r` pixels (to take in its shaded edges), then in each
    row everything between its leftmost and rightmost pixel. And what is above the face (the hair), what is above or
    beside it down to the chin (hair, an ear), and its lower part (where a beard grows)."""
    H, W = sure.shape
    hull = np.zeros_like(sure)
    above = np.zeros_like(sure)
    beside = np.zeros_like(sure)
    chin = np.zeros_like(sure)
    cols = np.arange(fw)
    size = components(sure)
    for y0 in range(0, H - fh + 1, fh):
        for x0 in range(0, W - fw + 1, fw):
            # (the face is the frame's big piece of lit skin: a few lit strands in the hair are not)
            sz = size[y0:y0 + fh, x0:x0 + fw]
            if not sz.any():
                continue
            m = grow(sz >= max(10, sz.max() * 0.3), r)
            rows = m.any(axis=1)
            if not rows.any():
                continue
            left = np.where(rows, np.argmax(m, axis=1), fw)
            right = np.where(rows, fw - 1 - np.argmax(m[:, ::-1], axis=1), -1)
            hull[y0:y0 + fh, x0:x0 + fw] = (cols[None, :] >= left[:, None]) & (cols[None, :] <= right[:, None])
            top = np.argmax(rows)
            above[y0:y0 + top, x0:x0 + fw] = True
            # (the lower face, below the eyes, as wide as the face and a little more: where a beard grows)
            bottom = fh - 1 - np.argmax(rows[::-1])
            beside[y0:y0 + bottom + 1, x0:x0 + fw] = True
            mid = top + (bottom - top) * 5 // 8  # (below the eyes)
            lo, hi = left[rows].min(), right[rows].max()
            m = (hi - lo) // 4
            chin[y0 + mid:y0 + fh, x0 + max(0, lo - m):x0 + min(fw, hi + m + 1)] = True
    return hull, above & ~hull, beside & ~hull, chin


def classify(a, fw, fh, cfg):
    """Each pixel's role: an (H, W) array of ROLES indexes, -1 for none (left as drawn) or transparent."""
    alpha = a[:, :, 3] > 0
    rel = rel_map(alpha, fw, fh)
    H, W = alpha.shape
    h, s, l = (x.reshape(H, W) for x in hsl_arrays(a[:, :, :3].reshape(-1, 3)))
    role = np.full((H, W), -1)
    free = alpha & (l >= 0.06)  # (the outline stays)
    places = {name: (rel >= lo) & (rel <= hi) for name, (lo, hi) in cfg['place'].items()}
    piece = cfg.get('piece', 10)

    def take(m, i):
        nonlocal free
        m = m & free  # (a pixel already given a role keeps it)
        role[m] = i
        free &= ~m

    skin_box = in_boxes(h, s, l, cfg['skin']) if cfg.get('skin') else np.zeros((H, W), bool)
    hair_box = in_boxes(h, s, l, cfg['hair']) if cfg.get('hair') else np.zeros((H, W), bool)
    head = places['hair']
    # (the crown is hair: its light strands are the colour of skin)
    take(free & hair_box & head & (rel < cfg['crown']), 1)
    # the face: across it (every row between its outermost lit skin) a warm colour is the face's own unless the hair
    # above the face is drawn in it too, so shaded cheeks keep with the skin and a beard and brows with the hair,
    # whatever the hair and skin are dyed
    face = np.zeros((H, W), bool)
    if cfg.get('skin') and cfg.get('hair'):
        key = (a[:, :, 0].astype(np.int64) << 16) | (a[:, :, 1].astype(np.int64) << 8) | a[:, :, 2]
        least = cfg.get('crownCount', 2)

        # (lit skin, but not in a colour drawn more in the crown's hair than as lit skin: a blond fringe's light
        # strands aren't the face)
        keys, inv = np.unique(key, return_inverse=True)
        inv = inv.reshape(key.shape)
        lit = free & skin_box & head & (s >= 0.5) & (l >= 0.55) & (rel >= cfg.get('faceTop', 0))
        n_crown = np.bincount(inv[role == 1], minlength=len(keys))
        n_lit = np.bincount(inv[lit], minlength=len(keys))
        sure_skin = lit & ~((n_crown >= least) & (n_crown >= n_lit))[inv]
        face, above, beside, chin = face_hull(sure_skin, fw, fh, cfg.get('faceGrow', 3))
        face &= head & alpha
        # (a colour drawn more in the hair above the face than across the face is hair: the fringe, beard and brows
        # too; any other is the face's own, the shading the face shares with the hair included)
        in_hair = (role == 1) | (above & free & hair_box & head)
        n_hair = np.bincount(inv[in_hair], minlength=len(keys))
        ask = free & face & (skin_box | hair_box)
        if cfg.get('beard'):
            # (a bearded look: in the lower face and below it, a colour the hair is drawn in that isn't lit skin is the
            # beard, and follows the hair)
            beard = free & chin & (rel <= cfg.get('beardTo', 0.32)) & hair_box & ~((s >= 0.5) & (l >= 0.55))
            take(beard & (n_hair >= least)[inv], 1)
            ask &= free
        n_face = np.bincount(inv[ask], minlength=len(keys))
        hairy = ((n_hair >= least) & (n_hair * cfg.get('hairShare', 1.0) >= n_face))[inv]
        # (the darkest tones across the face are its lines, the eyes' sockets and the beard's shadows: left as drawn,
        # or fair brows ring the eyes like a mask)
        free &= ~(ask & (l < cfg.get('faceLines', 0.22)))
        ask &= free
        take(ask & hairy, 4)
        take(ask & ~hairy & places['skin'], 0)
        take(ask & ~hairy & hair_box, 1)
        # (and round the face, down to the chin, a hair colour is hair: a fringe over the brow, the hair at the temples,
        # lit strands the colour of skin)
        take(free & head & beside & (hair_box | skin_box), 1)
    # the rest of the skin (the neck, arms, hands), in pieces: a fleck of skin colour on leather is a highlight
    m = free & skin_box & places['skin']
    take(m & (components(m) >= piece), 0)
    # the rest of the hair (the back of the head, a braid, the beard below the face)
    take(free & hair_box & head, 1)
    # the cloth, never on the face
    for i, name in ((2, 'cloth'), (3, 'cloth2')):
        if cfg.get(name):
            m = free & ~face & in_boxes(h, s, l, cfg[name]) & places[name]
            take(m & (components(m) >= piece), i)
    return role


def settle(a, roles):
    """Make each colour paint one role: where a colour has pixels of two roles, the fewer get a colour one step off.
    Returns the new pixels and {hex: role name}."""
    a = a.copy()
    alpha = a[:, :, 3] > 0
    rgb = a[:, :, :3].astype(np.int64)
    key = (rgb[:, :, 0] << 16) | (rgb[:, :, 1] << 8) | rgb[:, :, 2]
    used = set(np.unique(key[alpha]).tolist())
    # (each colour's pixels by role: most colours paint one thing, and only the rest need looking at)
    pair = key[alpha] * 8 + (roles[alpha] + 1)
    pairs, counts = np.unique(pair, return_counts=True)
    by = {}
    for p, n in zip(pairs.tolist(), counts.tolist()):
        by.setdefault(p // 8, []).append((n, p % 8 - 1))
    lut = {}
    for k in sorted(by):
        order = sorted(by[k], reverse=True)
        lut[k] = order[0][1]
        if len(order) == 1:
            continue
        here = alpha & (key == k)
        for _, r in order[1:]:
            if len(used) >= 255:
                continue  # (the palette is full: the fewer pixels take the many's role)
            # (a free colour a unit or two of blue away)
            for step in (1, -1, 2, -2, 3, -3, 4, -4):
                b = (k & 255) + step
                nk = (k & ~255) | b
                if 0 <= b <= 255 and nk not in used:
                    break
            else:
                continue  # (no room: the fewer pixels take the many's role)
            used.add(nk)
            lut[nk] = r
            m = here & (roles == r)
            a[:, :, 2][m] = nk & 255
    names = {'%06x' % k: ROLES[r] for k, r in lut.items() if r >= 0}
    return a, names


def reference(a, names):
    """The look's own colour per role (pixel-weighted mean hue, saturation, lightness), from its still frames."""
    alpha = a[:, :, 3] > 0
    rgb = a[:, :, :3][alpha]
    hexes = ['%02x%02x%02x' % tuple(p) for p in rgb.tolist()]
    h, s, l = hsl_arrays(rgb)
    ref = {}
    for role in ROLES:
        m = np.array([names.get(x) == role for x in hexes], bool)
        if not m.any():
            continue
        hr = np.radians(h[m])
        hue = (math.degrees(math.atan2(np.sin(hr).sum(), np.cos(hr).sum())) + 360) % 360
        ref[role] = [round(hue, 1), round(float(s[m].mean()), 3), round(float(l[m].mean()), 3)]
    return ref


def looks(bare_only=False):
    for people in PEOPLES:
        for d in sorted(glob.glob(os.path.join(ROOT, people, '*'))):
            if bare_only and '+' in d:
                continue
            if os.path.exists(os.path.join(d, 'index.json')):
                yield people, os.path.basename(d), d


def save_png(path, a):
    """Back to a palette PNG, as the art was (the sheets stay well under 256 colours); plain RGBA if one doesn't."""
    flat = a.reshape(-1, 4)
    flat = np.where(flat[:, 3:4] == 0, 0, flat)  # (every clear pixel the one clear colour)
    colours, idx = np.unique(flat, axis=0, return_inverse=True)
    if len(colours) > 256:
        Image.fromarray(a, 'RGBA').save(path, optimize=True)
        return
    im = Image.fromarray(idx.reshape(a.shape[:2]).astype(np.uint8), 'P')
    im.putpalette(colours[:, :3].astype(np.uint8).flatten().tolist())
    im.save(path, optimize=True, transparency=bytes(colours[:, 3].astype(np.uint8).tolist()))


def run(bare_only=False, which=(), again=False, write=True):
    """Label the sheets not labelled yet (all of them, `again`), and write each look's roles.json."""
    refs = {}
    for people, name, d in looks(bare_only):
        if which and not any(f'{people}/{name}'.startswith(w) for w in which):
            continue
        bare = name.split('+')[0]
        cfg = config(f'{people}/{bare}')
        fw, fh = json.load(open(os.path.join(d, 'index.json')))['frame']
        path = os.path.join(d, 'roles.json')
        # (a sheet labelled already keeps its labels: labelling it again would nudge its colours again)
        roles = json.load(open(path)) if os.path.exists(path) and not again else {'ref': {}, 'sheets': {}}
        done = 0
        for png in sorted(glob.glob(os.path.join(d, '*.png'))):
            sheet = os.path.basename(png)[:-4]
            if (bare_only and sheet != 'rotations') or sheet in roles['sheets']:
                continue
            a = np.asarray(Image.open(png).convert('RGBA'))
            out, names = settle(a, classify(a, fw, fh, cfg))
            if write and not np.array_equal(out, a):
                save_png(png, out)
            by = {}
            for hx, role in sorted(names.items()):
                by.setdefault(role, []).append(hx)
            roles['sheets'][sheet] = by
            done += 1
            if sheet == 'rotations' and name == bare:
                refs[f'{people}/{bare}'] = reference(out, names)
        if not done:
            continue
        # (an armed look takes its bare look's reference, so the same tint makes the same colours)
        ref = refs.get(f'{people}/{bare}')
        if ref is None:
            ref = json.load(open(os.path.join(ROOT, people, bare, 'roles.json')))['ref'] if name != bare else roles['ref']
        roles['ref'] = ref
        if write:
            with open(path, 'w') as f:
                json.dump(roles, f, separators=(',', ':'))
        print(f'{people}/{name}: {done} sheets labelled')


PAINT = [(255, 120, 170), (255, 230, 0), (40, 110, 255), (0, 220, 220), (255, 150, 0)]


def draw_qa(path, only=None):
    tiles = []
    for people, name, d in looks(True):
        if only and people != only:
            continue
        cfg = config(f'{people}/{name}')
        fw, fh = json.load(open(os.path.join(d, 'index.json')))['frame']
        a = np.asarray(Image.open(os.path.join(d, 'rotations.png')).convert('RGBA'))
        roles = classify(a, fw, fh, cfg)
        flat = a.copy()
        g = (a[:, :, :3].astype(int).sum(axis=2) // 6).astype(np.uint8)
        for c in range(3):
            flat[:, :, c] = g
        for i, col in enumerate(PAINT):
            flat[roles == i, :3] = col
        tile = Image.new('RGBA', (fw * 4, fh), (90, 110, 80, 255))
        for i, (src, col) in enumerate([(a, 0), (flat, 0), (a, 4), (flat, 4)]):
            tile.alpha_composite(Image.fromarray(np.ascontiguousarray(src[:, col * fw:(col + 1) * fw]), 'RGBA'), (i * fw, 0))
        tiles.append(tile.resize((tile.size[0] * 2, tile.size[1] * 2), Image.NEAREST))
    cols = 2
    tw = max(t.size[0] for t in tiles)
    th = max(t.size[1] for t in tiles)
    sheet = Image.new('RGBA', (tw * cols, th * ((len(tiles) + cols - 1) // cols)), (90, 110, 80, 255))
    for i, t in enumerate(tiles):
        sheet.alpha_composite(t, ((i % cols) * tw, (i // cols) * th))
    sheet.save(path)


if __name__ == '__main__':
    if '--qa' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
        draw_qa(sys.argv[sys.argv.index('--qa') + 1], only)
    else:
        run('--bare' in sys.argv, [w for w in sys.argv[1:] if not w.startswith('--')], '--again' in sys.argv)
