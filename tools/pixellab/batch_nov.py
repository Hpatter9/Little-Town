"""The November PixelLab batch (docs/notes/pixellab-plan.md): the settlers' buildings with no picture that fits, lying
asleep, the wheelbarrow, six new settler looks (LOOKS), the small kit pieces (stockade, heaps, flame, corner pieces), the God creatures' weak spots and
the side-on beasts for the event cards. Resumable: what is done is kept in pl/nov_state.json, and every finished
picture in pl/nov/<phase>/. `assemble_nov.py <repo>` drops the finished art into the game.

Run from a work folder set up as the README says (the scripts beside it, `pl/` holding the state files and refs):

    DRY=1 python3 batch_nov.py               # every request and its estimated cost, phase by phase; sends nothing
    TEST_ONLY=1 python3 batch_nov.py         # the cheap test of each kind (phase `test`), then stops for a look
    python3 batch_nov.py                     # every phase in the plan's order (PHASES), skipping what is done
    python3 batch_nov.py sleep barrow        # some phases
    python3 batch_nov.py looks               # the six new settler looks (then their sleep and push in those phases)
    ONLY=kiln,smithy python3 batch_nov.py bld_medieval   # some items
    REDO=kiln python3 batch_nov.py bld_first   # make an item again (its old picture kept as kiln.old.png)
    BUDGET=2750 python3 batch_nov.py         # stop before the run's spend passes this (default 2750)
    SLOTS=6 python3 batch_nov.py sleep       # jobs at once (Tier 3 allows 10; default 4)

The spend is read from GET /balance before and after each job (pl/nov_spend.log, and `spent` per item in the state),
so the plan's estimates can be checked against what PixelLab really charged (an item's own `spent` only with SLOTS=1:
jobs at once share the balance). The run's first balance is kept as the state's `start`; BUDGET counts from it, with
the jobs still running counted at their estimates. No API key here: the environment's network settings add it."""
import sys
sys.dont_write_bytecode = True  # (no __pycache__ written into tools/)
import base64
import io
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw

DRY = bool(os.environ.get('DRY'))
TEST_ONLY = bool(os.environ.get('TEST_ONLY'))
ONLY = [x for x in os.environ.get('ONLY', '').split(',') if x]
# items to make again (a picture that came out wrong): their state cleared, the old picture kept as <key>.old.png
REDO = [x for x in os.environ.get('REDO', '').split(',') if x]
# (the plan's 2,476 and about a tenth more for pictures made again: docs/notes/pixellab-plan.md)
BUDGET = int(os.environ.get('BUDGET', '2750'))
SLOTS = int(os.environ.get('SLOTS', '4'))
HERE = os.path.dirname(os.path.abspath(__file__))
# the repo: REPO, else the one these scripts sit in (tools/pixellab/), else the cloud's clone
REPO = os.environ.get('REPO') or next((p for p in (os.path.join(HERE, '..', '..'), '/home/user/Little-Town') if os.path.isdir(os.path.join(p, 'src', 'renderer'))), '.')
ART = os.path.join(REPO, 'src', 'renderer', 'art', 'iso')
KIT = os.path.join(ART, 'kits', 'settlers')
STATE = 'pl/nov_state.json'
OUT = 'pl/nov'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']

# Costs seen (tools/pixellab/README.md): an edit 10; a create from a reference 2-12; a template move about 1 a direction;
# a v3 text move 3 a direction; a style-matched building 10-15 (more for a bigger canvas).
COST = {'edit': 10, 'create': 12, 'template': 1, 'v3': 3}


def style_cost(size):
    return 10 if size <= 160 else 11 if size <= 224 else 13 if size <= 288 else 15


# ------------------------------------------------------------------------------------------------ the kit's own scale

# px of the kit's art to half a cell (tools/grid-recut.py HC): a cell is 2 HC wide and 1 HC tall
SCALE = json.load(open(os.path.join(ART, 'kits', 'kits.json')))['settlers']['scale']
HC = 24 / (SCALE * 0.5)
# the biggest canvas asked of generate-with-style-v2 so far (pl_bldg.py's harbour); a bigger footprint's guide is drawn
# smaller and the picture baked up to its cells by tools/grid-recut.py
MAX_SIDE = int(os.environ.get('MAX_SIDE', '320'))


def kit(name):
    return Image.open(os.path.join(KIT, name + '.png')).convert('RGBA')


def canvas_for(w, h, tall=False):
    """A square canvas for a footprint w x h: its diamond and room above it for the walls and roof."""
    s = (w + h) * HC * 1.1 + 24
    if tall:
        s *= 1.4
    return int(min(MAX_SIDE, max(128, 16 * round(s / 16))))


def plinth_guide(w, h, size):
    """The footprint drawn as the kit draws its ground: a w x h diamond of the grass tile's grass on a slab of soil, its
    front corner low in the middle of the canvas. The first style picture: it gives the canvas its size, and the
    picture its ground (tools/grid-recut.py measures that plinth and bakes the picture to its cells)."""
    hc = min(HC, (size - 16) / (w + h))
    slab = max(6, round(hc / 3.5))
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # (the diamond's middle, across, is (h - w) hc / 2 right of its front corner: centred on the canvas)
    fx = size / 2 - (h - w) * hc / 2
    fy = size - slab - 6
    F = (fx, fy)
    L = (fx - w * hc, fy - w * hc / 2)
    R = (fx + h * hc, fy - h * hc / 2)
    B = (L[0] + h * hc, L[1] - h * hc / 2)
    tile = kit('grass_tile').crop((64, 30, 124, 60))
    grass = Image.new('RGBA', (size, size))
    for y in range(0, size, tile.height):
        for x in range(0, size, tile.width):
            grass.paste(tile, (x, y))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).polygon([L, F, R, B], fill=255)
    d = ImageDraw.Draw(im)
    # (the slab: the two front faces dropped `slab` px, soil brown, darker on the right)
    d.polygon([L, F, (F[0], F[1] + slab), (L[0], L[1] + slab)], fill=(92, 60, 32, 255))
    d.polygon([F, R, (R[0], R[1] + slab), (F[0], F[1] + slab)], fill=(66, 42, 24, 255))
    im.paste(grass, (0, 0), mask)
    d.line([L, F, R], fill=(58, 83, 28, 255), width=1)
    return im


# ------------------------------------------------------------------------------------------------ what to make

STYLE = 'isometric pixel art, the same palette, outline, shading and pixel size as the references'
GROUND = (', standing on a {w} by {h} grass plinth exactly like the first picture (its ground: {w} cells along the left '
          'front side, {h} along the right), seen in the same isometric view as the references; nothing reaching past '
          'the plinth\'s left, right or front edges, nothing in front of it; no text, no people')


def B(foot, desc, refs=('workshop', 'cottage'), tall=False, ids=None):
    return {'foot': foot, 'desc': desc, 'refs': refs, 'tall': tall, 'ids': ids}


# The 68 settler buildings drawn with a borrowed picture made smaller (iso/gridRules.ts AWAITING_ART), by the age they
# open in, homes and work before the rest. `ids`: more buildings of the same footprint that share the picture.
BLD_FIRST = {
    'lean_to': B([2, 2], 'a lean-to shelter: a slanted roof of branches and bark on two forked poles against a low log wall, a bedroll and a little firepit under it', ('cottage', 'stockpile')),
    'healers_hut': B([2, 2], "a healer's hut: a small round wattle hut with a thatched roof, bundles of drying herbs hung by the door, a stone mortar and a water pot outside", ('cottage', 'well')),
    'workbench': B([2, 2], 'an open-air workbench: a heavy timber bench under a small thatched shelter on four posts, tools on it, a sawhorse and a chopping block beside it', ('workshop', 'stockpile')),
    'tanning_rack': B([2, 2], 'a tanning rack: two wooden frames with stretched animal hides laced to them, a tub of bark water and a scraping log beside them', ('workshop', 'stockpile')),
    'drying_rack': B([1, 2], 'a long drying rack: a wooden frame of poles hung with strips of meat and fish, a small smoky fire under one end', ('stockpile', 'campfire')),
    'smokehouse': B([2, 2], 'a smokehouse: a small squat log hut with a turf roof, smoke seeping from its gable, a stack of split wood beside it', ('cottage', 'workshop')),
    'kiln': B([2, 2], 'a pottery kiln: a round beehive kiln of clay and stone with a glowing fire mouth at the front, clay pots drying on a plank shelf beside it', ('workshop', 'well')),
    'basketry': B([2, 2], "a basket weaver's shelter: an open thatched roof on posts, baskets and hampers stacked under it, bundles of reeds leaning on a post", ('workshop', 'stockpile')),
    'bone_carver': B([2, 2], "a bone carver's hut: a small hide-roofed hut with antlers over the door, a stump workbench with bones, combs and flutes laid out", ('cottage', 'workshop')),
    'fireside_inn': B([3, 2], 'a small fireside inn: a long low timber hall with a thatched roof, a smoking chimney, a hanging sign with a tankard, a bench by the door', ('tavern', 'cottage')),
    'trading_post': B([3, 2], 'a trading post: a timber stall with an awning, furs, pots and sacks laid out on the counter, a hitching rail and crates beside it', ('market_stall', 'stockpile')),
    'graveyard': B([3, 2], 'a small graveyard: a patch of ground with rows of wooden grave markers and two small headstones, a low wattle fence round it, a yew bush', ('chapel', 'well')),
    'wayside_shrine': B([2, 2], 'a wayside shrine: a small wooden roofed shrine on a stone base with a carved figure inside, candles and flowers left before it', ('chapel', 'well')),
    'quarry': B([3, 2], 'a stone quarry: a cut face of grey rock with stepped ledges, blocks of stone stacked in front, a timber hoist and a pick left on a block', ('workshop', 'stockpile')),
    'monster_guild': B([3, 2], "a monster hunters' guild hall: a sturdy timber hall with a thatched roof, a great horned skull over the door, a notice board with bounties and crossed spears", ('tavern', 'longhouse')),
    'militia_post': B([1, 1], 'a militia post: a small roofed wooden stand on four posts with a rack of bows and a quiver, a straw target beside it', ('watchtower',), tall=True),
}
BLD_MEDIEVAL = {
    'smithy': B([3, 2], "a blacksmith's smithy: an open-fronted timber workshop with a tiled roof and a stone chimney, a glowing forge, an anvil on a stump in front, a rack of tools", ('workshop', 'tavern')),
    'sawmill': B([3, 2], 'a sawmill: an open timber shed with a big saw frame over a log, stacks of planks and logs beside it, sawdust on the ground', ('workshop', 'stockpile')),
    'bakery': B([3, 2], "a bakery: a timber and plaster house with a dome bread oven of brick at one end glowing, loaves on a shelf by the door, a flour sack", ('cottage', 'tavern')),
    'windmill': B([3, 2], 'a windmill: a stone and timber tower mill with four sails, the sails turned edge-on so they stay over the base, flour sacks at its door', ('granary', 'watchtower'), tall=True),
    'mine': B([3, 2], 'a mine entrance: a timber-framed tunnel mouth in a low rocky hill, a minecart on rails coming out, a heap of ore and a lantern on a post', ('workshop', 'stockpile'), ids=['coal_mine']),
    'tannery': B([3, 2], 'a tannery: a long open shed with vats of brown liquid sunk in the ground, hides hung on poles, a timber roof', ('workshop', 'stockpile')),
    'brewery': B([3, 2], 'a brewery: a timber brewhouse with a tiled roof, a big copper kettle seen through the open side, casks stacked by the door, a hop vine', ('tavern', 'granary')),
    'bloomery': B([2, 2], 'a bloomery: a tall clay and stone furnace with a glowing mouth, a leather bellows beside it, a heap of charcoal and iron ore', ('workshop', 'well')),
    'cooper': B([2, 2], "a cooper's workshop: a small timber workshop, barrels and staves stacked outside, a half-made cask with iron hoops on a stand", ('workshop', 'stockpile')),
    'loom': B([2, 2], "a weaver's loom house: a small timber workshop with an open side showing a big wooden loom, bolts of cloth on a shelf", ('workshop', 'cottage')),
    'tailor': B([2, 2], "a tailor's shop: a small plastered house with a striped awning, a dressmaker's dummy wearing a gown by the door, bolts of cloth", ('cottage', 'market_stall')),
    'dyeworks': B([2, 2], 'a dyeworks: an open shed with three round vats of red, blue and yellow dye, dyed cloth hung on a line to dry', ('workshop', 'stockpile')),
    'chandlery': B([2, 2], "a chandler's workshop: a small timber shop with bundles of candles hung under the eaves, a pot of tallow over a fire, a candle sign", ('cottage', 'workshop')),
    'jeweller': B([2, 2], "a jeweller's shop: a neat stone-built little shop with a slate roof, a barred window with glittering rings and necklaces, a gold ring sign", ('cottage', 'market_stall')),
    'apothecary': B([2, 2], "an apothecary's workshop: a small timber house with herbs drying in bunches, a bench of glass jars and a mortar outside, a green bottle sign", ('cottage', 'workshop')),
    'market': B([3, 2], 'a market square: three small stalls with striped awnings, baskets of produce, crates and a set of scales, cobbles underfoot', ('market_stall', 'well')),
    'weapon_store': B([3, 2], 'an arms shop: a timber shopfront with an awning, racks of swords, spears, bows and shields, a suit of mail on a stand by the door', ('market_stall', 'workshop'), ids=['armour_store']),
    'furniture_store': B([3, 2], 'a furniture shop: a timber shopfront with an awning, chairs, a table, a chest and a bed frame set out in front', ('market_stall', 'cottage')),
    'apothecary_shop': B([3, 2], "an apothecary's shop: a plastered shopfront with a bay window full of coloured bottles, shelves of jars, herbs hung over the door", ('market_stall', 'cottage')),
    'deep_shaft': B([2, 2], 'a deep mine shaft: a square stone-lined pit with a timber headframe and a winch with a rope and bucket over it, a lantern', ('well', 'watchtower'), tall=True),
    'arcane_library': B([3, 2], 'an arcane library: a stone hall with a pointed slate roof, tall arched windows glowing blue, a carved door, a star symbol on the gable', ('chapel', 'longhouse')),
    'arcane_academy': B([3, 3], 'an arcane academy: a square stone college with a slender round tower topped by a blue conical roof, glowing windows, a courtyard arch', ('chapel', 'watchtower'), tall=True),
    'resurrection_shrine': B([2, 2], 'a resurrection shrine: a small round white stone temple of pillars with a domed roof, a glowing golden light at its altar', ('chapel', 'well')),
    'phylactery': B([1, 2], 'a phylactery shrine: a dark stone plinth with a glowing green gem in an iron cage on top, candles round its foot', ('chapel', 'well')),
    'guard_tower': B([1, 1], 'a guard tower: a slender square timber tower on a stone base, a roofed lookout platform at the top with a bow rack', ('watchtower',), tall=True),
    'ballista': B([1, 1], 'a ballista: a great wooden crossbow on a turning mount, a bolt loaded, on a small square of planks', ('watchtower', 'stockpile')),
    'catapult': B([1, 1], 'a small catapult: a wooden throwing arm with a sling on a sturdy frame, a few round stones beside it', ('watchtower', 'stockpile')),
    'siege_workshop': B([4, 2], 'a siege workshop: a long open timber shed, a half-built battering ram with a roof on wheels inside, beams and ropes stacked outside', ('workshop', 'longhouse')),
}
BLD_LATE = {
    # (the Industrial age)
    'coal_mine': None,  # (shares the mine's picture)
    'glassworks': B([3, 2], 'a glassworks: a brick workshop with a tall conical brick chimney, a glowing furnace mouth, green glass bottles and panes stacked outside', ('workshop', 'granary'), tall=True),
    'gunsmith': B([3, 2], "a gunsmith's shop: a brick shopfront with a slate roof, muskets on a rack in the window, a powder keg and a crossed-muskets sign", ('workshop', 'market_stall')),
    'cannery': B([3, 2], 'a cannery: a brick workshop with a steam boiler and a short iron chimney, crates of tins stacked outside', ('workshop', 'granary')),
    'print_shop': B([3, 2], 'a print shop: a brick and timber shop with a big iron printing press seen through the window, stacks of paper and books, a quill sign', ('longhouse', 'cottage')),
    'bathhouse': B([3, 2], 'a bathhouse: a white plastered building with a domed roof, steam rising from a vent, columns at the door, a small pool', ('chapel', 'well')),
    'clockmaker': B([2, 2], "a clockmaker's shop: a narrow brick shop with a big clock face over the door, a bay window of clocks and pocket watches", ('cottage', 'market_stall'), tall=True),
    'cannon': B([1, 1], 'a cannon: a black iron cannon on a wooden carriage behind a low sandbag wall, a stack of cannonballs', ('watchtower', 'stockpile')),
    'gun_nest': B([1, 1], 'a gun nest: a ring of sandbags with a heavy machine gun on a tripod in it, an ammunition box', ('watchtower', 'stockpile')),
    'land_mine': B([1, 1], 'a buried land mine: a patch of dug earth with a round metal mine half showing, a small warning stake with a skull sign', ('stockpile',)),
    # (the Modern age)
    'cement_works': B([3, 2], 'a cement works: a concrete plant with a tall grey silo, a sloped conveyor belt and a heap of grey gravel', ('workshop', 'granary'), tall=True),
    'oil_derrick': B([2, 2], 'an oil derrick: a tall steel lattice tower over a pumpjack nodding on a concrete pad, a black oil barrel', ('watchtower', 'well'), tall=True),
    'radio_tower': B([1, 2], 'a radio tower: a tall red and white steel lattice mast with a small concrete hut at its foot, a blinking light on top', ('watchtower',), tall=True),
    'gun_turret': B([1, 1], 'an automatic gun turret: a grey armoured turret with twin gun barrels on a round concrete base', ('watchtower',)),
    'flame_turret': B([1, 1], 'a flame turret: a squat armoured turret with a flame nozzle and a fuel tank on the back, on a concrete base', ('watchtower',)),
    'mortar_pit': B([1, 1], 'a mortar pit: a round pit ringed with sandbags, a mortar tube pointing up in it, shells in a crate', ('watchtower', 'stockpile')),
    # (the Space age)
    'bio_lab': B([3, 2], 'a bio lab: a white rounded modern building with green glowing vats behind big windows, pipes and a small dome', ('workshop', 'chapel')),
    'deep_mine': B([3, 2], 'a deep mine: a steel headframe over a concrete shaft entrance, a big drill rig and glowing ore carts', ('workshop', 'watchtower'), tall=True),
    'nanoforge': B([3, 2], 'a nanoforge: a sleek dark metal factory block with glowing cyan seams, a sealed door and an exhaust stack', ('workshop', 'granary')),
    'battery_plant': B([3, 2], 'a battery plant: a white industrial building with rows of big green-glowing cylindrical cells outside and thick cables', ('workshop', 'granary')),
    'laser_turret': B([1, 1], 'a laser turret: a white armoured turret with a glowing red lens barrel on a round metal base', ('watchtower',)),
    'tesla_coil': B([1, 1], 'a tesla coil: a tall copper coil tower with a metal sphere on top crackling with blue sparks, on a concrete base', ('watchtower',), tall=True),
    'launch_site': B([8, 4], 'a rocket launch site: a long concrete pad with yellow markings, a white rocket standing on a steel launch gantry at one end, fuel tanks at the other', ('watchtower', 'granary'), tall=True),
}
del BLD_LATE['coal_mine']

# The 47 drawn with a borrowed picture that fits, or with a yard round it (if the month allows: phase bld_yard).
BLD_YARD = {
    'hide_tent': B([3, 2], 'a large hide tent: a long tent of stitched hides over poles, its flap open, a firepit and a drying hide beside it', ('cottage', 'stockpile')),
    'hunters_lodge': B([3, 2], "a hunters' lodge: a timber lodge with antlers over the door, pelts hung on a rack, bows and spears leaning by the wall", ('cottage', 'longhouse')),
    'storytellers_circle': B([3, 2], "a storyteller's circle: log benches in a ring round a stone firepit, a carved story pole at the back", ('campfire', 'stockpile')),
    'lookout': B([2, 2], 'a lookout: a tall timber watch platform on four legs with a ladder and a horn hung at the top', ('watchtower',), tall=True),
    'spike_trap': B([1, 1], 'a spike trap: sharpened wooden stakes set in the ground, half hidden in grass', ('stockpile',)),
    'pit_trap': B([1, 1], 'a covered pit trap: a square of thin branches and leaves over a hole, one corner fallen in to show stakes below', ('stockpile',)),
    'caltrops': B([1, 1], 'iron caltrops strewn across a patch of packed earth', ('stockpile',)),
    'boiling_oil': B([1, 1], 'a cauldron of boiling oil on an iron frame over a fire, a long ladle hung from it', ('campfire', 'stockpile')),
    'elder_lodge': B([5, 3], "an elder lodge: a great long timber hall with a high thatched roof, carved totem posts at the door, smoke from a roof hole", ('longhouse', 'tavern')),
    'barracks': B([4, 3], 'barracks: a long timber and stone hall with a tiled roof, weapon racks and a training dummy by the door, a banner', ('longhouse', 'watchtower')),
    'trophy_hall': B([4, 3], 'a trophy hall: a fine timber hall with a carved gable, monster skulls and crossed weapons over the door, banners', ('longhouse', 'chapel')),
    'scriptorium': B([4, 3], 'a scriptorium: a stone hall with tall narrow windows and a slate roof, a bell cote, a lectern with an open book outside', ('chapel', 'longhouse')),
    'infirmary': B([4, 3], 'an infirmary: a whitewashed long hall with a red tiled roof, a herb garden in front and a cot by the door', ('longhouse', 'cottage')),
    'school': B([4, 3], 'a school house: a timber and plaster hall with a small bell tower, a slate board by the door', ('longhouse', 'chapel')),
    'general_store': B([4, 3], 'a general store: a two-storey timber shop with a wide porch, barrels, sacks and crates out front, a painted sign', ('market_stall', 'tavern')),
    'steelworks': B([4, 3], 'a steelworks: a big brick foundry with two tall chimneys and a blast furnace glowing orange, heaps of coal and ore', ('workshop', 'granary'), tall=True, ids=['alloy_foundry']),
    'factory': B([6, 4], 'a steam factory: a long red brick mill with rows of windows, a saw-tooth roof and two tall smoking chimneys', ('workshop', 'longhouse'), tall=True),
    'emporium': B([5, 3], 'a grand emporium: a two-storey stone shop with big glass display windows, a striped awning and a gilded sign', ('market_stall', 'tavern')),
    'rowhouse': B([4, 3], 'a row of three narrow brick terrace houses with chimneys and front steps', ('cottage', 'longhouse')),
    'hospital': B([5, 3], 'a hospital: a large white stone building with a red cross over the door, many windows and a central gable', ('longhouse', 'chapel')),
    'library': B([4, 3], 'a library: a neoclassical stone building with columns at the front, a pediment and tall windows', ('chapel', 'longhouse')),
    'power_station': B([6, 4], 'a power station: a big brick and concrete building with a tall chimney, cooling pipes and a transformer yard', ('workshop', 'granary'), tall=True),
    'refinery': B([4, 3], 'an oil refinery: steel distillation towers, round storage tanks and pipes on a concrete yard, a small flare stack', ('workshop', 'granary'), tall=True),
    'electronics_plant': B([4, 3], 'a modern factory: a long white and blue industrial block with a flat roof, roof vents and a loading dock', ('workshop', 'granary'), ids=['appliance_plant', 'chip_fab']),
    'garage': B([4, 3], 'a garage workshop: a steel-roofed shed with two big roller doors, a truck half inside, oil drums', ('workshop', 'stockpile'), ids=['robot_workshop']),
    'apartments': B([4, 3], 'an apartment block: a four-storey brick building with balconies and a flat roof', ('longhouse', 'cottage'), tall=True),
    'trauma_center': B([5, 3], 'a modern hospital: a white glass and concrete block with a red cross and a helipad on the roof', ('longhouse', 'chapel'), tall=True),
    'cinema': B([4, 3], 'a cinema: an art deco building with a lit marquee sign, posters by the doors', ('tavern', 'longhouse')),
    'university': B([6, 4], 'a university: a grand stone college with a clock tower, a quadrangle arch and ivy', ('chapel', 'longhouse'), tall=True),
    'habitat_dome': B([5, 3], 'a habitat dome: a big white geodesic dome with glowing windows and an airlock door', ('granary', 'chapel')),
    'fusion_reactor': B([5, 3], 'a fusion reactor: a round white reactor building with a glowing blue ring, pipes and radiator fins', ('granary', 'workshop'), tall=True),
    'town_hall': B([6, 4], 'a town hall: a grand stone civic building with a clock tower, columns and a flag', ('longhouse', 'chapel'), tall=True),
    'textile_mill': B([4, 3], 'a textile mill: a red brick mill with rows of windows, a chimney and bales of cotton at the door', ('workshop', 'longhouse'), tall=True),
    'pharmacy': B([3, 2], 'a pharmacy: a neat shopfront with a green cross sign, glass bottles in the window', ('market_stall', 'cottage')),
    'theatre': B([4, 3], 'a theatre: an ornate stone playhouse with a domed roof, a balcony and posters', ('tavern', 'chapel')),
    'bell_tower': B([2, 2], 'a bell tower: a square stone tower with an open belfry and a bronze bell under a pointed roof', ('watchtower', 'chapel'), tall=True),
    'airship_mast': B([3, 2], 'an airship mooring mast: a tall steel lattice tower with a mooring ring at the top and a ground winch house', ('watchtower',), tall=True),
    'gaol': B([4, 3], 'a gaol: a squat stone block with small barred windows, an iron-bound door and a high wall', ('longhouse', 'watchtower')),
    'prison': B([5, 3], 'a prison: a walled stone block of cells with barred windows and a corner watchtower', ('longhouse', 'watchtower'), tall=True),
    'temple': B([4, 3], 'a temple: a white stone temple with columns, a pediment and steps, a brazier at each side', ('chapel', 'longhouse')),
    'cathedral': B([6, 4], 'a cathedral: a great gothic stone church with two spires, a rose window and buttresses', ('chapel', 'watchtower'), tall=True),
    'arena': B([5, 4], 'an arena: an oval fighting ring of sand with tiers of timber benches round it and banners', ('longhouse', 'stockpile')),
    'mage_tower': B([2, 2], "a mage's tower: a slender stone tower with a conical purple roof and glowing windows, a crystal at the top", ('watchtower', 'chapel'), tall=True),
}

# Lying asleep: the settlers' looks, the founder's two and the children. (look in the game, where its character id is)
SLEEPERS = {
    **{k: ('looks.json', k) for k in ['woman_base', 'woman_leather', 'woman_plate', 'man_base', 'man_leather', 'man_plate', 'dwarf_base', 'dwarf_apron', 'dwarf_plate']},
    'founder_hero': ('people_looks_state.json', 'founder_hero'),
    'founder_heroine': ('founder2_state.json', 'founder_heroine'),
    'child_boy': ('kids_state.json', 'settlers_boy'),
    'child_girl': ('kids_state.json', 'settlers_girl'),
    'child_dwarf_boy': ('kids_state.json', 'dwarves_boy'),
    'child_dwarf_girl': ('kids_state.json', 'dwarves_girl'),
}
NO_FX = ' Keep the same character and clothes throughout; no extra effects, no particles.'
SLEEP = ('sleeping: lies flat on the back on the ground the whole time, eyes closed, arms at the sides; only the chest '
         'slowly rises and falls with each breath, the head stirs a little; never sits up or stands; a seamless loop.' + NO_FX)
# The grown looks push the barrow (children never haul: map/haul.ts `hauls`): the mannequin's push template.
PUSHERS = [k for k in SLEEPERS if not k.startswith('child_')]

# The wheelbarrow: the view going away down-right (`se`) and up-right (`ne`) on screen, mirrored for the left (map/haul.ts
# `barrowPlace`), heaped with each kind of load the stockpile knows (map/workSeen.ts PileKind; barrels go as crates).
BARROW_VIEWS = {'se': 'its wheel to the lower right and its two handles to the upper left, pointing away from us down-right',
                'ne': 'its wheel to the upper right and its two handles to the lower left, pointing away from us up-right'}
BARROW_LOADS = {'logs': 'heaped with short split logs', 'stone': 'heaped with grey stones', 'sacks': 'piled with tied grain sacks',
                'crates': 'stacked with two small wooden crates'}


def P(foot, desc, refs, size=None):
    return {'foot': foot, 'desc': desc, 'refs': refs, 'size': size}


# Six new settler looks (docs/notes/nov-new-looks.md), so the townsfolk differ by more than their colours: each one an
# edit of a settler look's south view (`base`), turned to 8 facings (create-character-v3), the six template moves the
# settler looks have (LOOK_MOVES), then one tool: the tool edited into the turned look's south view, turned again, and
# its v3 text move (WEAPONS, as pl_batch.py and pl_armed.py did). They sleep and push in those phases like the rest.
# (look in the game: base look, the edit's prompt, the character's description, its tool). Hair, skin and the main
# cloth are recoloured per person in the game (iso/folkTint.ts), so the prompts set the shape: build, hat, hood, apron.
LOOKS = {
    'man_farmer': ('man_base', 'Turn this man into a farmer: a wide-brimmed woven straw hat, sandy-brown hair under it, a long loose undyed linen smock to the knees belted with a rope, rolled-up breeches, leather ankle boots; a lean, weathered build.',
                   'lean farmer in a wide-brimmed straw hat and a long undyed linen smock belted with rope, rolled breeches', 'axe'),
    'man_smith': ('man_leather', 'Turn this man into a blacksmith: broad-shouldered and stocky with thick forearms, short black hair and stubble, a heavy brown leather apron from chest to knees over a grey work shirt with the sleeves rolled up to the elbows, leather gauntlets tucked in the belt, sturdy boots.',
                  'stocky broad-shouldered blacksmith with short black hair, a heavy leather apron over a grey shirt with sleeves rolled up', 'hammer'),
    'woman_hunter': ('woman_leather', 'Turn this woman into a hunter: a hooded cloak of mottled green and brown wool, the hood up over her head with a few auburn strands showing, a leather quiver strap across the chest, a fitted brown tunic, leggings and soft boots; a slim, wiry build.',
                     'slim woman hunter in a hooded mottled green-brown cloak with the hood up, quiver strap, brown tunic and soft boots', 'axe'),
    'man_elder': ('man_base', 'Turn this man into an old village elder: a long grey beard and thinning grey hair, a slightly stooped back, a long plain brown wool robe with a rope belt, and a knotted wooden walking stick held in his left hand, its foot on the ground.',
                  'stooped old village elder with a long grey beard, thinning grey hair, a long brown wool robe and a knotted wooden walking stick', 'hammer'),
    'woman_elder': ('woman_base', 'Turn this woman into an old village woman: a wrinkled face, grey hair under a knotted linen headscarf, a knitted shawl round the shoulders, a long dark wool dress with an apron; a small, slightly bent build.',
                    'small old village woman with a linen headscarf over grey hair, a knitted shawl, long dark wool dress and apron', 'hammer'),
    'woman_maiden': ('woman_base', 'Turn this young woman into a village maiden: long golden hair in two thick braids over her shoulders, a bright red laced bodice dress with a full skirt to the ankles over a white linen blouse with puffed sleeves, soft shoes; a slender build.',
                     'slender young village woman with two long golden braids, a bright red laced bodice dress over a white blouse', 'axe'),
}
# The moves every look gets, as the settler looks have them (pl_batch.py BASE: the game's name, PixelLab's template).
LOOK_MOVES = {'walk': 'walking', 'idle': 'breathing-idle', 'run': 'running-6-frames', 'hurt': 'taking-punch', 'death': 'falling-back-death', 'cast_1h': 'fireball'}
# The tool edited into the hand, and its move from text (pl_batch.py WEAPONS): the game's move name, then the words.
TOOLS = {
    'axe': ("holds a woodcutter's axe in the right hand, the handle gripped low, the axe head hanging down by the side",
            'chop', 'chopping wood: lifts the axe already in hand up over the shoulder with both hands and swings it down onto a log in front, then recovers.'),
    'hammer': ("holds a smith's hammer in the right hand, hanging down by the side",
               'hammer', 'hammering: raises the hammer already in hand and strikes down on a work piece at waist height in front, twice.'),
}
# (the new looks sleep and push too, once the `looks` phase has made them: their characters are in the state, `look_<look>`)
SLEEPERS_NEW = PUSHERS_NEW = list(LOOKS)
TOOL_FX = ' Keep the same character, clothes and tool throughout; no extra effects, no particles, no flying debris.'
# (the settlers' sheets are each frame centred on a canvas this much wider each side than the figure's: assemble_folk.py PAD)
FOLK_PAD = 24


def base_south(look):
    """A settler look's south view as PixelLab turned it: the first frame of its rotations sheet, the padding taken off."""
    d = os.path.join(ART, 'folk', 'settlers', look)
    w, h = json.load(open(os.path.join(d, 'index.json')))['frame']
    im = Image.open(os.path.join(d, 'rotations.png')).convert('RGBA')
    return im.crop((FOLK_PAD, FOLK_PAD, w - FOLK_PAD, h - FOLK_PAD))


# Small kit pieces: kit-folder pieces (`kit`: loose heaps and corner posts, cut by tools/grid-recut.py) and the stockade
# (a shared building piece, 3x2).
PIECES = {
    'stockade': ('shared', P([3, 2], "a prisoners' stockade: a square pen walled with sharpened upright log stakes about head high, a stake gate in the middle of the front-left side, a single prisoner's post with a chain in the middle, bare trodden earth inside", ('palisade_gate', 'palisade_run'))),
    'grain_sacks': ('kit', P([1, 1], 'a small heap of tied burlap grain sacks, three or four, one leaning', ('hay_bales', 'crates'), 96)),
    'lumber_stack': ('kit', P([1, 1], 'a neat stack of sawn planks on two cross-beams', ('woodpile', 'crates'), 96)),
    'ore_pile': ('kit', P([1, 1], 'a small heap of dark iron ore lumps with rusty glints', ('rocks', 'barrels'), 96)),
    'stone_corner_tower': ('kit', P([1, 1], 'a square stone wall corner tower a little taller than the wall, crenellated top, matching the stone wall', ('stone_gate', 'stone_wall_run'), 160)),
    'palisade_corner_post': ('kit', P([1, 1], 'a palisade corner: a thick sharpened log post where two runs of the palisade meet, a little taller than the stakes', ('palisade_run', 'palisade_corner'), 128)),
    'fence_corner_post': ('kit', P([1, 1], 'a fence corner post: a sturdy square wooden post where two rail fences meet, with rail stubs both ways', ('fence',), 96)),
}
FLAME = 'a small bright torch flame, orange and yellow with a white heart, no torch, no stick, alone on a transparent background'
FLAME_FRAMES = ['the flame leaning a little left, its tip split in two', 'the flame tall and thin, its tip pointing straight up',
                'the flame leaning a little right, short and wide', 'the flame flaring up, a spark breaking off its tip',
                'the flame low and round, about to rise again']

# The God creatures' weak spots (docs/notes/god-creatures.md): moves made again, under a new name so the old stay
# until the new are seen (assemble_nov.py lays the new over the old, direction by direction).
GOD_FIX = [('wolf', 'death', 'falling-back-death', ['north']), ('bear', 'walk', 'walking', DIRS),
           ('golem', 'punch', 'cross-punch', DIRS), ('golem', 'miracle', 'fireball', DIRS)]
GOD_KEEP = (' Keep the creature exactly as broad and heavy as in its reference, the same colours and brightness; no '
            'slimming, no paler fur or stone.')

# Side-on beasts for the event cards (panel/eventScenes.ts): a reference picture, the character (east, the cards' side),
# then its moves as v3 text moves facing east (the cards mirror it for west). `style`: the packs' creature sheets drawn
# on the cards now, for the look.
CARD = {
    'wolf': {'size': 128, 'style': ['werewolf_black'], 'desc': 'a big grey wolf on all four legs seen exactly from the side, facing right, bushy tail, ears up',
             'moves': {'walk': 'walks forward on all fours at a steady lope, tail level.', 'attack': 'lunges forward and snaps its jaws, then steps back.',
                       'idle': 'stands on all fours, breathing, ears twitching, tail swaying a little.'}},
    'bear': {'size': 160, 'style': ['boar_king'], 'desc': 'a big brown bear on all four legs seen exactly from the side, facing right, a heavy hump on its shoulders',
             'moves': {'walk': 'lumbers forward on all fours, head low, shoulders rolling.', 'attack': 'rears up on its hind legs, swipes a paw down in front, drops back to all fours.',
                       'idle': 'stands on all fours, swaying its head and sniffing.'}},
    'dragon': {'size': 224, 'style': ['hk_demon_lord'], 'desc': 'a great red dragon seen exactly from the side, facing right, four legs, big bat wings, a long tail with a spade tip, horns',
               'moves': {'fly': 'flies forward, its big wings beating slowly up and down, legs tucked, tail streaming behind.', 'walk': 'walks forward on four legs, wings folded on its back, tail swinging.',
                         'attack': 'rears its head back and breathes a jet of fire forward from its jaws, wings half spread.'}},
}


# ------------------------------------------------------------------------------------------------ the jobs

def look_ids():
    """Character ids of the looks, from the state files in pl/ (copied from tools/pixellab/state/ as the README says),
    else straight from the repo's copy."""
    out = {}
    for look, (f, key) in SLEEPERS.items():
        p = f'pl/{f}' if os.path.exists(f'pl/{f}') else os.path.join(REPO, 'tools', 'pixellab', 'state', f)
        d = json.load(open(p))
        cid = d.get(key, {}).get('character_id')
        if not cid and f != 'people_looks_state.json':
            # (the founder's heroine is in both files; any copy will do)
            alt = os.path.join(REPO, 'tools', 'pixellab', 'state', 'people_looks_state.json')
            cid = json.load(open(alt)).get(key, {}).get('character_id')
        out[look] = cid
    return out


def creature_ids():
    p = 'pl/creature_state.json' if os.path.exists('pl/creature_state.json') else os.path.join(REPO, 'tools', 'pixellab', 'state', 'creature_state.json')
    d = json.load(open(p))
    return {k[4:]: v['character_id'] for k, v in d.items() if k.startswith('god_')}


def packs_frame(sheet):
    """The first walk frame of one of the cards' pack sheets (art/creatures/packs/), a style reference."""
    lay = json.load(open(os.path.join(REPO, 'src', 'renderer', 'art', 'creatures', 'packs.json')))[sheet]
    im = Image.open(os.path.join(REPO, 'src', 'renderer', 'art', 'creatures', 'packs', sheet + '.png')).convert('RGBA')
    return im.crop((0, 0, lay['w'], lay['h']))


def building_jobs(phase, table):
    out = []
    for key, b in table.items():
        w, h = b['foot']
        size = canvas_for(w, h, b['tall'])
        out.append({'phase': phase, 'key': key, 'kind': 'style', 'est': style_cost(size), 'size': size, 'foot': b['foot'],
                    'ids': [key] + (b['ids'] or []), 'refs': list(b['refs']), 'desc': b['desc'] + GROUND.format(w=w, h=h),
                    'where': 'shared'})
    return out


def jobs_for(phase):
    """Every job of a phase, in order. A job is a dict: phase, key, kind ('style', 'edit', 'char', 'anim'), est, and
    what its kind needs. `after`: a job key that must be done first (its output is this one's input)."""
    if phase == 'test':
        return [
            {**building_jobs('test', {'lean_to': BLD_FIRST['lean_to']})[0], 'key': 'test_lean_to'},
            {'phase': 'test', 'key': 'test_sleep', 'kind': 'anim', 'est': COST['v3'], 'look': 'man_base', 'name': 'sleep_test', 'dirs': ['south'], 'mode': 'v3', 'action': SLEEP, 'frames': 8},
            {'phase': 'test', 'key': 'test_push', 'kind': 'anim', 'est': COST['template'], 'look': 'man_base', 'name': 'push_test', 'dirs': ['south-east'], 'mode': 'template', 'template': 'pushing'},
            barrow_jobs('test')[0] | {'key': 'test_barrow_se_logs'},
            {**piece_jobs('test')[1], 'key': 'test_grain_sacks'},
            {**flame_jobs('test')[0], 'key': 'test_flame_0'},
            {**card_jobs('test')[0], 'key': 'test_card_wolf_ref'},
            {**look_jobs('test')[0], 'key': 'test_look_edit'},
            {'phase': 'test', 'key': 'test_god_wolf_death', 'kind': 'anim', 'est': COST['template'], 'creature': 'wolf', 'name': 'death_test', 'dirs': ['north'], 'mode': 'template', 'template': 'falling-back-death'},
        ]
    if phase == 'bld_first':
        return building_jobs(phase, BLD_FIRST)
    if phase == 'bld_medieval':
        return building_jobs(phase, BLD_MEDIEVAL)
    if phase == 'bld_late':
        return building_jobs(phase, BLD_LATE)
    if phase == 'bld_yard':
        return building_jobs(phase, BLD_YARD)
    if phase == 'looks':
        return look_jobs(phase)
    if phase == 'sleep':
        return ([{'phase': phase, 'key': f'sleep_{look}', 'kind': 'anim', 'est': COST['v3'] * 8, 'look': look, 'name': 'sleep', 'dirs': DIRS, 'mode': 'v3', 'action': SLEEP, 'frames': 8} for look in SLEEPERS]
                + [{'phase': phase, 'key': f'sleep_{look}', 'kind': 'anim', 'est': COST['v3'] * 8, 'newlook': f'look_{look}', 'after': f'look_{look}', 'name': 'sleep', 'dirs': DIRS, 'mode': 'v3', 'action': SLEEP, 'frames': 8} for look in SLEEPERS_NEW])
    if phase == 'barrow':
        return (barrow_jobs(phase) + [{'phase': phase, 'key': f'push_{look}', 'kind': 'anim', 'est': COST['template'] * 8, 'look': look, 'name': 'push', 'dirs': DIRS, 'mode': 'template', 'template': 'pushing'} for look in PUSHERS]
                + [{'phase': phase, 'key': f'push_{look}', 'kind': 'anim', 'est': COST['template'] * 8, 'newlook': f'look_{look}', 'after': f'look_{look}', 'name': 'push', 'dirs': DIRS, 'mode': 'template', 'template': 'pushing'} for look in PUSHERS_NEW])
    if phase == 'pieces':
        return piece_jobs(phase) + flame_jobs(phase)
    if phase == 'god':
        return [{'phase': phase, 'key': f'god_{c}_{m}', 'kind': 'anim', 'est': COST['template'] * len(ds), 'creature': c, 'name': f'{m}2', 'dirs': ds, 'mode': 'template', 'template': t} for c, m, t, ds in GOD_FIX]
    if phase == 'cards':
        return card_jobs(phase)
    raise SystemExit(f'no phase {phase}')


def look_jobs(phase):
    """The new looks (LOOKS), each a chain: the edit of its base look's south view, the character turned from it, its six
    moves; then its tool: edited into the character's own south view (`src_char`), turned, and its move. The first job
    alone in the test phase."""
    out = []
    for look, (base, edit, desc, tool) in LOOKS.items():
        hold, move, action = TOOLS[tool]
        k = f'look_{look}'
        # (the elder's stick is his: everyone else's hands are empty until the tool is edited in)
        hands = '' if look == 'man_elder' else ' empty hands;'
        out.append({'phase': phase, 'key': f'{k}_edit', 'kind': 'edit', 'est': COST['edit'], 'src_img': base,
                    'desc': edit + f' Keep the same pose, size, proportions and pixel-art style;{hands} medieval village.'})
        if phase == 'test':
            return out
        out.append({'phase': phase, 'key': k, 'kind': 'char', 'est': COST['create'], 'after': f'{k}_edit', 'src': f'{k}_edit',
                    'desc': desc + (',' + hands.rstrip(';') if hands else '') + ', medieval fantasy village', 'view': 'low top-down', 'n_dirs': 8, 'char_name': f'settlers {look}'})
        out += [{'phase': phase, 'key': f'{k}_{m}', 'kind': 'anim', 'est': COST['template'] * 8, 'after': k, 'newlook': k, 'name': m, 'dirs': DIRS,
                 'mode': 'template', 'template': t} for m, t in LOOK_MOVES.items()]
        stick = ', the walking stick still in the left hand' if look == 'man_elder' else ''
        out.append({'phase': phase, 'key': f'{k}_{tool}_edit', 'kind': 'edit', 'est': COST['edit'], 'after': k, 'src_char': k,
                    'desc': f'The character {hold}{stick}; keep the body, clothes, face and hair exactly the same.'})
        out.append({'phase': phase, 'key': f'{k}_{tool}', 'kind': 'char', 'est': COST['create'], 'after': f'{k}_{tool}_edit', 'src': f'{k}_{tool}_edit',
                    'desc': f'{desc}, {hold}{stick}', 'view': 'low top-down', 'n_dirs': 8, 'char_name': f'settlers {look}+{tool}'})
        out.append({'phase': phase, 'key': f'{k}_{tool}_{move}', 'kind': 'anim', 'est': COST['v3'] * 8, 'after': f'{k}_{tool}', 'newlook': f'{k}_{tool}',
                    'name': move, 'dirs': DIRS, 'mode': 'v3', 'action': action + TOOL_FX, 'frames': 8})
    return out


def barrow_jobs(phase):
    out = []
    for v, vd in BARROW_VIEWS.items():
        for load, ld in BARROW_LOADS.items():
            out.append({'phase': phase, 'key': f'barrow_{v}_{load}', 'kind': 'style', 'est': style_cost(112), 'size': 112, 'foot': None,
                        'refs': ['cart', 'crates', 'woodpile'], 'where': 'kit',
                        'desc': f'a wooden wheelbarrow with one iron-rimmed wheel at the front, {vd}, {ld}, standing alone on the ground, '
                                'seen in the same isometric view as the references, about half a cell long; no person'})
    return out


def piece_jobs(phase):
    out = []
    for key, (where, p) in PIECES.items():
        w, h = p['foot']
        size = p['size'] or canvas_for(w, h)
        out.append({'phase': phase, 'key': key, 'kind': 'style', 'est': style_cost(size), 'size': size, 'foot': p['foot'], 'ids': [key],
                    'refs': list(p['refs']), 'where': where,
                    'desc': p['desc'] + (GROUND.format(w=w, h=h) if where == 'shared' else ', standing on one cell of ground, seen in the same isometric view as the references; no text, no people')})
    return out


def flame_jobs(phase):
    first = {'phase': phase, 'key': 'flame_0', 'kind': 'style', 'est': style_cost(64), 'size': 64, 'foot': None, 'refs': ['campfire', 'lamp_post'],
             'where': 'fx', 'desc': FLAME + ', drawn in the same pixel-art style as the references, filling the lower middle of the picture'}
    if phase == 'test':
        return [first]
    return [first] + [{'phase': phase, 'key': f'flame_{i + 1}', 'kind': 'edit', 'est': COST['edit'], 'after': 'flame_0', 'src': 'flame_0',
                       'desc': f'The next frame of this flickering flame: {d}. Keep the same size, colours and pixel style; the base stays where it is.'}
                      for i, d in enumerate(FLAME_FRAMES)]


def card_jobs(phase):
    out = []
    for kind, c in CARD.items():
        ref = {'phase': phase, 'key': f'card_{kind}_ref', 'kind': 'style', 'est': style_cost(c['size']), 'size': c['size'], 'foot': None,
               'pack_refs': c['style'], 'refs': [], 'where': 'card',
               'desc': c['desc'] + ', side view pixel art in the same style, outline and shading as the references, standing on nothing, transparent background'}
        if phase == 'test':
            return [ref]
        char = {'phase': phase, 'key': f'card_{kind}', 'kind': 'char', 'est': COST['create'], 'after': ref['key'], 'src': ref['key'],
                'desc': c['desc'], 'view': 'side', 'n_dirs': 4}
        out += [ref, char] + [{'phase': phase, 'key': f'card_{kind}_{m}', 'kind': 'anim', 'est': COST['v3'], 'after': char['key'], 'card': kind,
                               'name': m, 'dirs': ['east'], 'mode': 'v3', 'action': a + NO_FX, 'frames': 8} for m, a in c['moves'].items()]
    return out


# The run's order, the most visible first (docs/notes/pixellab-plan.md). bld_yard is the month's spare: run it by name.
PHASES = ['test', 'bld_first', 'looks', 'sleep', 'barrow', 'pieces', 'bld_medieval', 'god', 'cards', 'bld_late']
OPTIONAL = ['bld_yard']

# ------------------------------------------------------------------------------------------------ sending

lock = threading.Lock()
state = json.load(open(STATE)) if os.path.exists(STATE) else {}


def save():
    with lock:
        os.makedirs('pl', exist_ok=True)
        json.dump(state, open(STATE + '.tmp', 'w'), indent=1)
        os.replace(STATE + '.tmp', STATE)


def log(*a):
    line = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    with lock:
        print(line, flush=True)
        if not DRY:
            os.makedirs('pl', exist_ok=True)
            open('pl/nov_spend.log', 'a').write(line + '\n')


def b64(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def shown(body):
    """A request's body for the dry run: pictures as their sizes."""
    def walk(v):
        if isinstance(v, dict):
            if v.get('type') == 'base64':
                im = Image.open(io.BytesIO(base64.b64decode(v['base64'])))
                return f'<png {im.width}x{im.height}>'
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        return v
    return json.dumps(walk(body))


def balance():
    import pl
    return pl.call('GET', '/balance')['subscription']['generations']


def out_path(job, key=None):
    return f"{OUT}/{job['phase']}/{key or job['key']}.png"


def done_png(key):
    """A finished picture of a job by its key, in whatever phase it was made."""
    for ph in PHASES + OPTIONAL:
        p = f'{OUT}/{ph}/{key}.png'
        if os.path.exists(p):
            return p
    return None


def style_body(job):
    size = job['size']
    if job.get('foot'):
        first = plinth_guide(*job['foot'], size)
    else:
        first = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    refs = [kit(r) for r in job['refs']] + [packs_frame(s) for s in job.get('pack_refs', [])]
    if not job.get('foot') and refs:
        # (the first reference on the canvas, scaled to fit: the canvas's size and the look in one)
        r = refs[0]
        k = min(1, (size * 0.9) / max(r.size))
        r = r.resize((max(1, round(r.width * k)), max(1, round(r.height * k))), Image.NEAREST)
        first.alpha_composite(r, ((size - r.width) // 2, size - r.height))
        refs = refs[1:]
    imgs = [first] + refs
    return {'style_images': [{'image': b64(i), 'width': i.width, 'height': i.height} for i in imgs], 'description': job['desc'],
            'style_description': STYLE, 'no_background': True}


def request(job, cid=None, src=None):
    """The method, path and body of a job (`cid`: its character; `src`: its input picture's path)."""
    k = job['kind']
    if k == 'style':
        return 'POST', '/generate-with-style-v2', style_body(job)
    if k == 'edit':
        im = Image.open(src).convert('RGBA') if src else base_south(job['src_img']) if job.get('src_img') else Image.new('RGBA', (64, 64))
        return 'POST', '/edit-images-v2', {'method': 'edit_with_text', 'image_size': {'width': im.width, 'height': im.height}, 'no_background': True,
                                          'edit_images': [{'image': b64(im), 'width': im.width, 'height': im.height}], 'description': job['desc']}
    if k == 'char':
        im = Image.open(src).convert('RGBA') if src else Image.new('RGBA', (128, 128))
        return 'POST', '/create-character-v3', {'description': job['desc'], 'reference_image': b64(im), 'n_directions': job['n_dirs'], 'view': job['view'],
                                               'template_id': 'mannequin', 'name': job.get('char_name') or f"card {job['key']}", 'no_background': True}
    if k == 'anim':
        body = {'character_id': cid or '<character id>', 'animation_name': job['name'], 'directions': ['<one direction a job>']}
        if job['mode'] == 'template':
            body.update(mode='template', template_animation_id=job['template'])
        else:
            body.update(mode='v3', frame_count=job['frames'], action_description=job['action'])
        return 'POST', '/characters/animations', body
    raise ValueError(k)


def anim_names(cid):
    """The moves a character has so far (its zip's metadata), so the one a job adds can be told from the rest:
    assemble_nov.py takes the names in a job's `names_after` and not in its `names_before`."""
    import subprocess
    import zipfile
    for a in range(4):
        d = subprocess.run(['curl', '-sS', f'https://api.pixellab.ai/v2/characters/{cid}/zip'], capture_output=True).stdout
        if d[:2] == b'PK':
            meta = json.loads(zipfile.ZipFile(io.BytesIO(d)).read('metadata.json'))
            return sorted(meta['states'][0]['frames']['animations'])
        time.sleep(5 * (a + 1))
    return None


def character_of(job):
    if job.get('look'):
        return look_ids().get(job['look'])
    if job.get('creature'):
        return creature_ids().get(job['creature'])
    if job.get('card'):
        return state.get(f"card_{job['card']}", {}).get('character_id')
    if job.get('newlook'):
        return state.get(job['newlook'], {}).get('character_id')
    return None


def south_of(cid, dest):
    """A character's own south view (from its zip), saved at `dest`: the picture a tool is edited into."""
    import subprocess
    import zipfile
    for a in range(4):
        d = subprocess.run(['curl', '-sS', f'https://api.pixellab.ai/v2/characters/{cid}/zip'], capture_output=True).stdout
        if d[:2] == b'PK':
            z = zipfile.ZipFile(io.BytesIO(d))
            meta = json.loads(z.read('metadata.json'))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            Image.open(io.BytesIO(z.read(meta['states'][0]['frames']['rotations']['south']))).convert('RGBA').save(dest)
            return dest
        time.sleep(5 * (a + 1))
    return None


slots = threading.Semaphore(SLOTS)


def send(path, body, tries=4):
    """POST a generation and wait for it, holding a slot. The finished jobs, or None."""
    import pl
    for t in range(tries):
        with slots:
            try:
                r = pl.call('POST', path, body)
            except ValueError:
                r = {'detail': 'empty or cut-off answer'}
            if 'detail' in r and 'already has' in str(r['detail']):
                return {'animation_group_id': body.get('animation_group_id')}, []
            if 'detail' in r:
                log('  refused', path, str(r)[:200])
                time.sleep(20 * (t + 1))
                continue
            ids = r.get('background_job_ids') or [r.get('background_job_id')]
            res = [pl.wait(j, every=10, limit=1200) for j in ids]
        if all(x.get('status') == 'completed' for x in res):
            return r, res
        log('  failed, retrying', path, str(res[-1].get('last_response'))[:160])
        time.sleep(15 * (t + 1))
    return None, None


inflight = {}


def spent():
    """What the run has cost so far: the balance at its start less the balance now."""
    return state['start'] - balance()


def run(job):
    key = job['key']
    st = state.setdefault(key, {})
    if st.get('done'):
        return
    if job.get('after') and not state.get(job['after'], {}).get('done'):
        log(key, 'waits for', job['after'])
        return
    # (the spend so far, and what the jobs still running are expected to cost)
    with lock:
        now = spent()
        if now + sum(inflight.values()) + job['est'] > BUDGET:
            log(key, f"SKIPPED: the run's spend would pass BUDGET {BUDGET} (spent {now})")
            return
        inflight[key] = job['est']
    try:
        work(job, st)
    finally:
        with lock:
            inflight.pop(key, None)


def work(job, st):
    import pl
    key = job['key']
    before = balance()
    k = job['kind']
    if k in ('style', 'edit', 'char'):
        src = done_png(job['src']) if job.get('src') else None
        if job.get('src_char'):
            cid = state.get(job['src_char'], {}).get('character_id')
            src = cid and south_of(cid, f"{OUT}/{job['phase']}/{key}_src.png")
            if not src:
                log(key, 'no south view of', job['src_char'])
                return
        method, path, body = request(job, src=src)
        r, res = send(path, body)
        if not r:
            log(key, 'GAVE UP')
            return
        if k == 'char':
            st['character_id'] = r['character_id']
        else:
            os.makedirs(f"{OUT}/{job['phase']}", exist_ok=True)
            pl.unb64(res[0]['last_response']['images'][0]).save(out_path(job))
    else:
        cid = character_of(job)
        if not cid:
            log(key, 'no character id: is its state file in pl/?')
            return
        if 'names_before' not in st:
            st['names_before'] = anim_names(cid)
            save()
        for d in job['dirs']:
            if d in st.get('dirs', []):
                continue
            _, _, body = request(job, cid=cid)
            body['directions'] = [d]
            if st.get('group'):
                body['animation_group_id'] = st['group']
            r, _ = send('/characters/animations', body)
            if not r:
                log(key, d, 'GAVE UP')
                continue
            st['group'] = st.get('group') or r.get('animation_group_id')
            st.setdefault('dirs', []).append(d)
            st['character_id'] = cid
            save()
        if len(st.get('dirs', [])) < len(job['dirs']):
            return
        st['names_after'] = anim_names(cid)
    after = balance()
    # (a job's own cost is only its balance's drop when it ran alone: SLOTS=1)
    if SLOTS == 1:
        st['spent'] = st.get('spent', 0) + (before - after)
    st['done'] = True
    save()
    log(key, 'ok', f"est {job['est']}" + (f", spent {before - after}" if SLOTS == 1 else '') + f", run total {state['start'] - after}, balance {after}")


def main():
    phases = sys.argv[1:] or (['test'] if TEST_ONLY else PHASES)
    if DRY:
        total = 0
        for ph in phases:
            jobs = [j for j in jobs_for(ph) if not ONLY or j['key'] in ONLY]
            sub = sum(j['est'] for j in jobs)
            total += sub
            print(f'== {ph}: {len(jobs)} jobs, about {sub} generations')
            for j in jobs:
                method, path, body = request(j, cid=character_of(j) if j['kind'] == 'anim' else None)
                n = len(j.get('dirs', [])) or 1
                print(f"  {j['key']}  ~{j['est']}  {method} {path}" + (f'  x{n} directions' if j['kind'] == 'anim' else ''))
                print(f'    {shown(body)[:600]}')
        print(f'== in all: about {total} generations' + ('' if sys.argv[1:] else f" (the optional {', '.join(OPTIONAL)}: about {sum(j['est'] for ph in OPTIONAL for j in jobs_for(ph))} more)"))
        return
    if 'start' not in state:
        state['start'] = balance()
        save()
    for key in REDO:
        state.pop(key, None)
        old = done_png(key)
        if old:
            os.replace(old, old[:-4] + '.old.png')
    save()
    log('balance at the run\'s start', state['start'], 'now', balance(), 'spent so far', spent(), 'budget', BUDGET)
    for ph in phases:
        jobs = [j for j in jobs_for(ph) if not ONLY or j['key'] in ONLY]
        log('==', ph, len(jobs), 'jobs')
        # (in waves: the jobs whose input is done, at once; then the ones that waited on them, and so on. A job whose
        # input failed is left, said so, for the next run)
        pending = jobs
        while pending:
            ready = [j for j in pending if not j.get('after') or state.get(j['after'], {}).get('done')]
            if not ready:
                for j in pending:
                    run(j)
                break
            with ThreadPoolExecutor(SLOTS) as ex:
                list(ex.map(run, ready))
            pending = [j for j in pending if j not in ready]
        if ph == 'test':
            log('TESTS DONE: look at pl/nov/test/ and the test moves (assemble_nov.py <repo> test lays them out) before the rest')
            break
    log('FINISHED', ' '.join(phases), 'run total', spent())


if __name__ == '__main__':
    main()
