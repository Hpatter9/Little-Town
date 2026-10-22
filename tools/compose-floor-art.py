"""Cuts the tiles the hand-made maps' top-down views are drawn with (the dungeons' floors: renderer/delve/floorArt.ts)
from DawnLike (16px cells) into one sheet, src/renderer/art/floors/tiles.png, and its index tiles.json (each tile's
name: its cell in the sheet; a name ending '@1' is the second frame of an animated one). A dev tool, run by hand with the
packs cloned beside this repo (../chronos-assets): `python3 tools/compose-floor-art.py`. Credited in CREDITS.md."""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DL = os.path.join(HERE, '..', '..', 'chronos-assets', 'DawnLike')
OUT = os.path.join(HERE, '..', 'src', 'renderer', 'art', 'floors')
COLS = 16

# a wall block of DawnLike's Objects/Wall.png (7x3 cells, from x bx*112, y 48+by*48): where each of the sixteen pieces
# is (art/autotile.ts names: the arms each piece reaches out with)
WALL_PIECES = {
    'es': (0, 0), 'ew': (1, 0), 'sw': (2, 0), 'post': (3, 0), 'esw': (4, 0),
    'ns': (0, 1), 'nes': (3, 1), 'nesw': (4, 1), 'nsw': (5, 1),
    'ne': (0, 2), 'nw': (2, 2), 'new': (4, 2),
    # (the ends take the run they finish)
    'n': (0, 1), 's': (0, 1), 'e': (1, 0), 'w': (1, 0),
}
# each look's wall block, its floor and its rough floor (Objects/Floor.png blocks, the 3x3 box's middle cell)
LOOKS = {
    'crypt': {'wall': (0, 3), 'floor': (0, 2), 'rough': (0, 7)},
    'cave': {'wall': (0, 5), 'floor': (0, 5), 'rough': (2, 1)},
    'mine': {'wall': (1, 5), 'floor': (0, 6), 'rough': (2, 3)},
    'temple': {'wall': (1, 8), 'floor': (1, 4), 'rough': (2, 0)},
    'ice': {'wall': (0, 9), 'floor': (2, 4), 'rough': (0, 0)},
    'forge': {'wall': (2, 6), 'floor': (2, 2), 'rough': (0, 6)},
    'tower': {'wall': (0, 1), 'floor': (0, 1), 'rough': (1, 6)},
    'fey': {'wall': (2, 9), 'floor': (1, 1), 'rough': (0, 4)},
    'vault': {'wall': (1, 13), 'floor': (0, 0), 'rough': (2, 3)},
    'wreck': {'wall': (1, 0), 'floor': (0, 8), 'rough': (0, 9)},
}
# single cells: (sheet, column, row); a sheet ending in 0 has its second frame in the same sheet ending in 1
CELLS = {
    # the grounds every look shares
    'water': ('Objects/Pit0', 1, 9), 'water_edge': ('Objects/Pit0', 1, 8),
    'deep': ('Objects/Pit0', 1, 15), 'deep_edge': ('Objects/Pit0', 1, 14),
    'chasm': ('Objects/Pit0', 1, 1), 'chasm_edge': ('Objects/Pit0', 1, 0),
    'lava': ('Objects/Pit0', 1, 27), 'lava_edge': ('Objects/Pit0', 1, 26),
    'ice': ('Objects/Floor', 15, 22),
    'bridge': ('Objects/Floor', 1, 3 + 8 * 3 + 1),
    'door': ('Objects/Door0', 0, 0), 'door_iron': ('Objects/Door0', 2, 0), 'door_stone': ('Objects/Door0', 0, 1),
    'stairs': ('Objects/Tile', 5, 3),
    # the props (sim/delveFloors.ts FLOOR_PROPS)
    'torch': ('Objects/Decor0', 2, 8), 'brazier': ('Objects/Effect0', 1, 21), 'candles': ('Objects/Decor0', 3, 8),
    'chest': ('Items/Chest0', 0, 0), 'gold': ('Items/Money', 0, 0), 'coffin': ('Objects/Decor0', 6, 10),
    'bones': ('Objects/Decor0', 1, 12), 'skull': ('Objects/Decor0', 0, 12), 'statue': ('Objects/Decor0', 3, 20),
    'altar': ('Objects/Decor0', 0, 20), 'barrel': ('Items/Chest0', 0, 1), 'crate': ('Objects/Decor0', 3, 9),
    'table': ('Objects/Decor0', 4, 7), 'chair': ('Objects/Decor0', 0, 7), 'shelf': ('Objects/Decor0', 1, 4),
    'web': ('Objects/Decor0', 0, 19), 'crystal': ('Objects/Ore0', 5, 3), 'mushroom': ('Objects/Tree0', 3, 30),
    'rock': ('Objects/Ore0', 5, 6), 'grave': ('Objects/Decor0', 0, 17), 'cage': ('Objects/Decor0', 1, 21),
    'throne': ('Objects/Decor0', 6, 7), 'spikes': ('Objects/Trap0', 6, 3), 'darts': ('Objects/Trap0', 0, 3),
    'plate': ('Objects/Trap0', 5, 0), 'lever': ('Objects/Trap0', 2, 2), 'bed': ('Objects/Decor0', 0, 9),
    'campfire': ('Objects/Effect0', 0, 21), 'roots': ('Objects/Ground0', 3, 4), 'portcullis': ('Objects/Door0', 0, 2),
    'rubble': ('Objects/Ground0', 6, 5), 'lantern': ('Items/Light', 3, 0), 'blood_altar': ('Objects/Decor0', 1, 20),
    'banner': ('Objects/Decor0', 1, 1),
}
# the carpet: Decor0's red rug, a 3x3 box (x 0..2, y 14..16) laid by its neighbours
RUG = (0, 14)
ANIMATED = {'water', 'water_edge', 'deep', 'deep_edge', 'lava', 'lava_edge', 'brazier', 'campfire', 'candles', 'torch'}


def sheet(name, cache={}):
    if name not in cache:
        cache[name] = Image.open(os.path.join(DL, name + '.png')).convert('RGBA')
    return cache[name]


def cell(name, c, r):
    return sheet(name).crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16))


def main():
    tiles = []
    for look, d in LOOKS.items():
        bx, by = d['wall']
        for piece, (c, r) in WALL_PIECES.items():
            tiles.append((f'wall:{look}:{piece}', sheet('Objects/Wall').crop((bx * 112 + c * 16, 48 + by * 48 + r * 16, bx * 112 + c * 16 + 16, 48 + by * 48 + r * 16 + 16))))
        for k in ('floor', 'rough'):
            fx, fy = d[k]
            tiles.append((f'{k}:{look}', cell('Objects/Floor', fx * 7 + 1, 3 + fy * 3 + 1)))
    for dy in range(3):
        for dx in range(3):
            tiles.append((f'rug:{dx}{dy}', cell('Objects/Decor0', RUG[0] + dx, RUG[1] + dy)))
    for name, (sh, c, r) in CELLS.items():
        tiles.append((name, cell(sh, c, r)))
        if name in ANIMATED and sh.endswith('0'):
            tiles.append((name + '@1', cell(sh[:-1] + '1', c, r)))
    rows = (len(tiles) + COLS - 1) // COLS
    out = Image.new('RGBA', (COLS * 16, rows * 16), (0, 0, 0, 0))
    index = {}
    for i, (name, im) in enumerate(tiles):
        out.alpha_composite(im, ((i % COLS) * 16, (i // COLS) * 16))
        index[name] = i
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, 'tiles.png'), optimize=True)
    with open(os.path.join(OUT, 'tiles.json'), 'w') as f:
        json.dump({'cols': COLS, 'tiles': index}, f, indent=0, sort_keys=True)
        f.write('\n')
    print(f'{len(tiles)} tiles, {out.size}')


main()
