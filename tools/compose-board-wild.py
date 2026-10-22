"""Copies the asset packs' sprites the raid board is dressed with (tactics/boardDress.ts) into
src/renderer/art/iso/kits/wild/, each trimmed to what it shows. A dev tool, run by hand with the packs cloned beside
this repo (../chronos-assets): `python3 tools/compose-board-wild.py`. Credited in CREDITS.md."""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACKS = os.path.join(HERE, '..', '..', 'chronos-assets', 'assets')
REPO = os.path.join(HERE, '..')
OUT = os.path.join(HERE, '..', 'src', 'renderer', 'art', 'iso', 'kits', 'wild')
FOREST = 'craftpix-net-505052-free-forest-objects-top-down-pixel-art/PNG/Assets'
UNDEAD = 'craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately'
ROCKS = 'craftpix-net-675652-free-rocks-pixel-art-asset-pack/PNG'
ROCKY = 'craftpix-net-639143-free-rocky-area-objects-pixel-art/PNG/Objects_separately'
FIELDS = 'craftpix-net-665131-free-fields-tileset-pixel-art-for-tower-defense/2 Objects'

# the piece's id: where it comes from in the packs
PIECES = {
    'grass_1': f'{FIELDS}/5 Grass/4.png',
    'grass_2': f'{FIELDS}/5 Grass/5.png',
    'grass_3': f'{FIELDS}/5 Grass/6.png',
    'tall_grass': f'{FOREST}/Willow3.png',
    'reeds_1': f'{FOREST}/Willow1.png',
    'reeds_2': f'{FOREST}/Willow2.png',
    'flowers_1': f'{FIELDS}/6 Flower/4.png',
    'flowers_2': f'{FIELDS}/6 Flower/6.png',
    'flowers_3': f'{FIELDS}/6 Flower/9.png',
    'flowers_4': f'{FIELDS}/6 Flower/12.png',
    'stump_1': f'{UNDEAD}/Broken_tree_shadow1_3.png',
    'stump_2': f'{UNDEAD}/Broken_tree_shadow1_4.png',
    'stump_3': f'{UNDEAD}/Broken_tree_shadow1_6.png',
    'branch': f'{UNDEAD}/Broken_tree_shadow1_1.png',
    'mushrooms_1': f'{FOREST}/White-red_mushroom3.png',
    'mushrooms_2': f'{FOREST}/Chanterelles3.png',
    'mushrooms_3': f'{FOREST}/Beige_green_mushroom3.png',
    'fern': f'{ROCKY}/Fern_tree3.png',
    'pebbles_1': f'{UNDEAD}/Rock_shadow1_4.png',
    'pebbles_2': f'{UNDEAD}/Rock_shadow1_5.png',
    'shrub_1': f'{UNDEAD}/Plant_shadow1_1.png',
    'shrub_2': f'{UNDEAD}/Plant_shadow1_3.png',
    'shrub_3': f'{UNDEAD}/Plant_shadow1_4.png',
    'thorns_1': f'{UNDEAD}/Thorn_plant_shadow1_1.png',
    'thorns_2': f'{UNDEAD}/Thorn_plant_shadow1_3.png',
    'bones_1': f'{UNDEAD}/Bones_shadow1_2.png',
    'bones_2': f'{UNDEAD}/Bones_shadow1_6.png',
    'bones_3': f'{UNDEAD}/Bones_shadow1_10.png',
    'skeleton': f'{ROCKY}/Dragon_bones_body_ground_shadow.png',
    'pillar_1': f'{UNDEAD}/Ruin_shadow1_3.png',
    'pillar_2': f'{UNDEAD}/Ruin_shadow1_4.png',
    'pillar_3': f'{UNDEAD}/Ruin_shadow1_5.png',
    'ruin_1': f'{UNDEAD}/Ruin_shadow1_1.png',
    'ruin_2': f'{UNDEAD}/Ruin_shadow1_2.png',
    'dune_1': f'{ROCKS}/desert_rocks/desert_rock1.png',
    'dune_2': f'{ROCKS}/desert_rocks/desert_rock2.png',
    'dune_3': f'{ROCKS}/desert_rocks/desert_rock4.png',
    'floe_1': f'{ROCKS}/ice_rock/ice_rock4.png',
    'floe_2': f'{ROCKS}/ice_rock/ice_rock5.png',
    'snow_rock': f'{ROCKS}/snowy_rocks1/snowy_rock3.png',
    'statue': f'{ROCKY}/Rock_statue_old_man_grass_shadow.png',
    # (the town's own windmill, already cut from the Summer top-down set: src/renderer/art/packs/)
    'mill': 'repo:src/renderer/art/packs/su_windmill.png',
}


def main():
    os.makedirs(OUT, exist_ok=True)
    index = []
    for pid, src in PIECES.items():
        im = Image.open(os.path.join(REPO, src[5:]) if src.startswith('repo:') else os.path.join(PACKS, src)).convert('RGBA')
        box = im.getbbox()
        if box:
            im = im.crop(box)
        im.save(os.path.join(OUT, pid + '.png'), optimize=True)
        index.append({'id': pid, 'w': im.width, 'h': im.height, 'src': src.split('/PNG/')[0].split('/2 Objects')[0].replace('repo:', '') + ': ' + os.path.basename(src)})
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
