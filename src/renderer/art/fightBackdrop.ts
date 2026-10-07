// The scenery behind a watched fight (fight/fightView.ts): 25 scenes, each in four layers that scroll at their own pace
// as the party walks. Outdoors: the far layer (sky, sun or moon, clouds, smoke, mountains, dunes, a ruined city, the
// sea), the middle one (hills, the tree line, cliffs, tents, houses, ruins, derricks, fences) and the near one (the
// ground, its path or road or rails, water, grass and everything lying about). Inside a dungeon: the back wall (bricks,
// rock, carved stone, planks, metal, concrete, glowing basalt) with what hangs on it (torches, banners, chains,
// alcoves of skulls, portholes, pipes, furnaces, lava falls), then columns and the roof, then the floor and what's on
// it. A fourth, thin layer runs along the bottom edge. Everything repeats across the width, so the layers tile.
//
// Which scene: `sceneFor` (by the destination, whether the party is on the road or there, and the town's biome). On the
// road it's the land on the way; arrived at a dungeon (a cave, a keep, a crypt, a ship...) it's inside it.

import { INDOOR_SCENES, type SceneId } from '../../shared/data/scenes';
import { PAL } from './palette';
import { mixHex, noTone, paint, type Painter, type PixelArt } from './pixelArt';
import { makeSpriteSet, type SpriteSet } from './sprites';
import { hash, shade } from './terrain';

export const BACK_W = 320;
export const BACK_H = 320;
/** The row where the land meets the sky (or the wall meets the floor). */
export const BACK_HORIZON = 200;
const HZ = BACK_HORIZON;
/** The near edge's height: its own layer, kept along the bottom of the view whatever its height. */
export const FRONT_H = 40;

export interface Backdrop {
  far: PixelArt;
  mid: PixelArt;
  near: PixelArt;
  front: PixelArt;
  /** How fast each layer goes by as the party walks (the far ones slower), and whether it's indoors (no drifting sky). */
  pace: [number, number, number, number];
  indoor: boolean;
}

/* ------------------------------------------------------------ the scenes */

export { SCENES, sceneFor, type SceneId } from '../../shared/data/scenes';

type SpriteProp = 'flowers' | 'tuft' | 'bramble' | 'bush' | 'tallGrass' | 'pebbles' | 'fern' | 'mushroom' | 'stump' | 'twig' | 'reeds' | 'boulder' | 'log';
type DrawnProp =
  | 'rubble' | 'bones' | 'skull' | 'drift' | 'slag' | 'barrel' | 'crate' | 'sandbags' | 'shells' | 'glowrock' | 'scrap' | 'ash' | 'embers' | 'cactus'
  | 'tire' | 'campfire' | 'puddle' | 'driftwood' | 'glowshrooms' | 'coins' | 'coffin' | 'candles' | 'straw' | 'heather';
type Prop = SpriteProp | DrawnProp;
type Front = 'grass' | 'woods' | 'reeds' | 'rocks' | 'rubble' | 'snow' | 'sand' | 'dark' | 'crates' | 'ash';

type Mid =
  | ['rise', string?]
  | ['trees', 'pine' | 'broadleaf' | 'mixed' | 'bush', number, number]
  | ['dead', number]
  | ['cliffs', string]
  | ['rocks', number]
  | ['tents', number]
  | ['palisade']
  | ['houses', number, boolean]
  | ['columns', number]
  | ['derricks', number]
  | ['towers', number]
  | ['fence']
  | ['watchtower']
  | ['mill']
  | ['heaps', string, number]
  | ['cacti', number]
  | ['snowpines', number]
  | ['palms', number]
  | ['spires', number]
  | ['wreck']
  | ['dunes'];

interface Outdoor {
  sky: [string, string];
  sun: 'sun' | 'red' | 'moon' | 'none';
  clouds: number;
  stars?: boolean;
  planet?: boolean;
  smoke?: number;
  far: 'mountains' | 'crags' | 'dunes' | 'city' | 'sea' | 'alien' | 'none';
  /** The far land's own colour (else hazy rock), and snow on the peaks. */
  farTint?: string;
  snow?: boolean;
  hills: string | null;
  mid: Mid[];
  ground: [string, string, string];
  path: 'dirt' | 'cobbles' | 'road' | 'tracks' | 'trodden' | 'none';
  water?: 'river' | 'oil' | 'shore';
  ripples?: string;
  blades: string | null;
  props: Prop[];
  front: Front;
}

type Wall = 'bricks' | 'strata' | 'carved' | 'planks' | 'metal' | 'concrete' | 'lavarock';
type Decor = 'torches' | 'banners' | 'chains' | 'alcoves' | 'cobwebs' | 'roots' | 'windows' | 'portholes' | 'lanterns' | 'pipes' | 'lights' | 'furnaces' | 'gears' | 'lavafalls' | 'crystals' | 'signs';

interface Indoor {
  wall: Wall;
  wallA: string;
  wallB: string;
  decor: Decor[];
  columns: 'pillars' | 'cavecols' | 'ribs' | 'girders' | 'arches' | null;
  ceiling: 'stalactites' | 'beams' | 'pipes' | null;
  floor: 'flagstones' | 'stone' | 'planks' | 'grating' | 'concrete' | 'lava';
  floorA: string;
  floorB: string;
  props: Prop[];
  front: Front;
}

const GREEN: [string, string, string] = [PAL.grassLight, PAL.grass, PAL.grassDark];
const SAND: [string, string, string] = ['#ecd49a', '#d4b070', '#a88848'];

const OUT: Partial<Record<SceneId, Outdoor>> = {
  meadow: {
    sky: ['#3f73bc', '#bcd8ee'], sun: 'sun', clouds: 9, far: 'mountains', snow: true, hills: 'green',
    mid: [['rise'], ['trees', 'mixed', 22, 5], ['trees', 'bush', 14, 0]],
    ground: GREEN, path: 'dirt', blades: PAL.grass, props: ['flowers', 'tuft', 'bramble', 'bush', 'tallGrass', 'pebbles', 'flowers'], front: 'grass',
  },
  riverbank: {
    sky: ['#3a78c4', '#c4e0f0'], sun: 'sun', clouds: 8, far: 'mountains', snow: true, hills: 'green',
    mid: [['rise'], ['trees', 'broadleaf', 16, 5]],
    ground: GREEN, path: 'dirt', water: 'river', blades: PAL.grass, props: ['flowers', 'tuft', 'reeds', 'pebbles', 'tallGrass'], front: 'reeds',
  },
  pinewoods: {
    sky: ['#466e9e', '#b8cfd8'], sun: 'sun', clouds: 6, far: 'mountains', snow: true, hills: 'green',
    mid: [['rise'], ['trees', 'pine', 34, 9]],
    ground: [mixHex(PAL.grass, PAL.dirt, 0.3), mixHex(PAL.grassDark, PAL.dirtDark, 0.35), PAL.dirtDark], path: 'dirt', blades: mixHex(PAL.grass, PAL.dirtDark, 0.2),
    props: ['fern', 'tuft', 'mushroom', 'fern', 'twig', 'tuft', 'flowers', 'fern', 'stump'], front: 'woods',
  },
  quarry: {
    sky: ['#4f78b0', '#d8d4c8'], sun: 'sun', clouds: 7, far: 'mountains', snow: true, hills: null,
    mid: [['cliffs', PAL.rock], ['rocks', 7]],
    ground: [mixHex(PAL.rockLight, PAL.dirtLight, 0.4), mixHex(PAL.rock, PAL.dirt, 0.45), PAL.rockDark], path: 'tracks', blades: null,
    props: ['pebbles', 'tuft', 'pebbles', 'boulder', 'rubble', 'tuft'], front: 'rocks',
  },
  highlands: {
    sky: ['#5a76a0', '#c8d0d8'], sun: 'sun', clouds: 7, far: 'crags', snow: true, hills: '#8a9478',
    mid: [['rise', '#7a8460'], ['rocks', 9], ['trees', 'pine', 6, 2]],
    ground: ['#8a9468', '#6a7650', '#46503a'], path: 'dirt', blades: '#7a8458', props: ['heather', 'boulder', 'tuft', 'pebbles', 'heather', 'bones'], front: 'rocks',
  },
  ruins: {
    sky: ['#4a78b8', '#d0dce8'], sun: 'sun', clouds: 6, far: 'mountains', snow: false, hills: 'green',
    mid: [['rise'], ['trees', 'broadleaf', 8, 2], ['columns', 7]],
    ground: GREEN, path: 'cobbles', blades: PAL.grass, props: ['rubble', 'tuft', 'flowers', 'pebbles', 'bush', 'rubble'], front: 'rubble',
  },
  bandit_camp: {
    sky: ['#2e3466', '#e89a6a'], sun: 'red', clouds: 4, far: 'mountains', farTint: '#5a4a6a', hills: '#4a5a4a',
    mid: [['rise', '#3e5236'], ['trees', 'pine', 26, 4], ['tents', 5], ['palisade']],
    ground: [mixHex(PAL.grass, PAL.dirt, 0.5), mixHex(PAL.grassDark, PAL.dirt, 0.5), PAL.dirtDark], path: 'dirt', blades: PAL.grassDark,
    props: ['campfire', 'barrel', 'crate', 'twig', 'stump', 'tuft', 'bones'], front: 'woods',
  },
  burned_village: {
    sky: ['#4e4446', '#c89878'], sun: 'red', clouds: 0, smoke: 6, far: 'mountains', farTint: '#6a5a5a', hills: '#6a6050',
    mid: [['rise', '#5a5444'], ['dead', 5], ['houses', 5, true]],
    ground: ['#6e6a52', '#4e4a3a', '#2a2822'], path: 'dirt', blades: '#6a6646', props: ['ash', 'embers', 'rubble', 'bones', 'twig', 'ash'], front: 'ash',
  },
  coal_fields: {
    sky: ['#4a4a52', '#a8a098'], sun: 'none', clouds: 0, smoke: 5, far: 'mountains', farTint: '#4a4848', hills: '#4e4a44',
    mid: [['heaps', '#2a2826', 7], ['derricks', 2]],
    ground: ['#5e544a', '#3c3630', '#1e1a18'], path: 'tracks', blades: null, props: ['slag', 'pebbles', 'scrap', 'barrel', 'slag'], front: 'rocks',
  },
  mill_yard: {
    sky: ['#6a88b0', '#dcd4c4'], sun: 'sun', clouds: 6, far: 'mountains', hills: 'green',
    mid: [['rise'], ['trees', 'broadleaf', 10, 1], ['mill'], ['dead', 2]],
    ground: ['#86805e', '#625c44', '#3a3628'], path: 'cobbles', blades: '#6a7a48', props: ['crate', 'barrel', 'scrap', 'tuft', 'rubble'], front: 'rubble',
  },
  oil_fields: {
    sky: ['#5a4a6a', '#eab47e'], sun: 'red', clouds: 2, smoke: 3, far: 'dunes', farTint: '#b0885a', hills: null,
    mid: [['derricks', 6]],
    ground: ['#a08a62', '#7a6646', '#3a2e22'], path: 'road', water: 'oil', blades: null, props: ['barrel', 'scrap', 'pebbles', 'tire'], front: 'rocks',
  },
  ghost_city: {
    sky: ['#626876', '#bcbcb2'], sun: 'none', clouds: 3, smoke: 2, far: 'city', hills: null,
    mid: [['towers', 6], ['dead', 3]],
    ground: ['#72726a', '#52524c', '#2e2e2a'], path: 'road', blades: '#6a7050', props: ['rubble', 'scrap', 'tire', 'tuft', 'rubble'], front: 'rubble',
  },
  compound: {
    sky: ['#5a7aa0', '#ccd2d2'], sun: 'sun', clouds: 5, far: 'mountains', hills: '#7a8a6a',
    mid: [['rise', '#6a7a54'], ['watchtower'], ['fence']],
    ground: ['#8a7e60', '#6a5e46', '#3e3628'], path: 'road', blades: '#6a7448', props: ['sandbags', 'crate', 'barrel', 'tire', 'tuft'], front: 'crates',
  },
  crater: {
    sky: ['#140c26', '#6a3a7a'], sun: 'none', clouds: 0, stars: true, planet: true, far: 'alien', hills: null,
    mid: [['spires', 9], ['wreck']],
    ground: ['#6e5e80', '#4a3e5c', '#2a2236'], path: 'none', blades: null, props: ['glowrock', 'scrap', 'pebbles', 'glowrock'], front: 'rocks',
  },
  dunes: {
    sky: ['#3e80c8', '#f2e2bc'], sun: 'sun', clouds: 2, far: 'dunes', farTint: '#e0c088', hills: null,
    mid: [['dunes'], ['cacti', 6]],
    ground: SAND, path: 'none', ripples: '#c09858', blades: null, props: ['cactus', 'bones', 'pebbles', 'skull'], front: 'sand',
  },
  tundra: {
    sky: ['#7088aa', '#e2eaf2'], sun: 'sun', clouds: 7, far: 'mountains', snow: true, farTint: '#a8b8cc', hills: '#d4dee6',
    mid: [['snowpines', 18]],
    ground: ['#f0f4f8', '#d8e2ea', '#a8b8c8'], path: 'trodden', blades: null, props: ['drift', 'pebbles', 'twig', 'drift'], front: 'snow',
  },
  coast: {
    sky: ['#3a80c8', '#d2eaf6'], sun: 'sun', clouds: 6, far: 'sea', hills: null,
    mid: [['palms', 7], ['rocks', 3]],
    ground: SAND, path: 'none', water: 'shore', ripples: '#c8a868', blades: null, props: ['shells', 'driftwood', 'pebbles', 'tuft'], front: 'sand',
  },
  // the new lands (data/biomes.ts): the fens, the jungle, the ashlands and the steppe
  fen: {
    sky: ['#4a5a6a', '#b8c4c2'], sun: 'none', clouds: 10, far: 'mountains', farTint: '#56625e', hills: '#4e6a48',
    mid: [['rise', '#4a6440'], ['dead', 3], ['trees', 'bush', 18, 0]],
    ground: ['#5a7a46', '#46603a', '#2e4228'], path: 'trodden', water: 'river', ripples: '#5a7a6a', blades: '#587a48', props: ['reeds', 'tuft', 'bones', 'reeds', 'pebbles', 'tallGrass'], front: 'reeds',
  },
  jungle: {
    sky: ['#2f6aa8', '#b8dcc8'], sun: 'sun', clouds: 7, far: 'crags', farTint: '#3e6a4a', hills: '#2e6a38',
    mid: [['rise', '#2a5a30'], ['trees', 'broadleaf', 30, 9], ['trees', 'bush', 20, 0]],
    ground: ['#4f8a3c', '#3a6a2c', '#24461c'], path: 'trodden', blades: '#4a8a3a', props: ['flowers', 'bramble', 'bush', 'tallGrass', 'flowers', 'tuft', 'bramble'], front: 'woods',
  },
  ashland: {
    sky: ['#3a2026', '#c86a48'], sun: 'red', clouds: 2, smoke: 5, far: 'crags', farTint: '#4a3634', hills: '#4a3a34',
    mid: [['rise', '#3e3230'], ['dead', 6], ['spires', 3]],
    ground: ['#5a5050', '#3e3636', '#242020'], path: 'none', blades: null, props: ['ash', 'embers', 'glowrock', 'bones', 'rubble', 'ash', 'skull'], front: 'ash',
  },
  steppe: {
    sky: ['#4a86cc', '#e8e0b8'], sun: 'sun', clouds: 5, far: 'mountains', farTint: '#9a9a70', hills: '#9aa050',
    mid: [['rise', '#a8a858'], ['trees', 'bush', 10, 0], ['trees', 'broadleaf', 4, 2]],
    ground: ['#b8b060', '#9a9448', '#6e6a30'], path: 'tracks', blades: '#a8a450', props: ['tallGrass', 'tuft', 'pebbles', 'bones', 'tallGrass', 'tuft'], front: 'grass',
  },
};

const IN: Partial<Record<SceneId, Indoor>> = {
  cave: {
    wall: 'strata', wallA: '#1e1924', wallB: '#40384a', decor: ['crystals'], columns: 'cavecols', ceiling: 'stalactites',
    floor: 'stone', floorA: '#4a4252', floorB: '#2e2836', props: ['glowshrooms', 'bones', 'rubble', 'puddle'], front: 'dark',
  },
  keep: {
    wall: 'bricks', wallA: '#46424e', wallB: '#625e6c', decor: ['windows', 'banners', 'torches', 'chains'], columns: 'pillars', ceiling: 'beams',
    floor: 'flagstones', floorA: '#5e5a66', floorB: '#3a3642', props: ['bones', 'rubble', 'straw', 'puddle', 'skull'], front: 'dark',
  },
  dragon_den: {
    wall: 'lavarock', wallA: '#1a1212', wallB: '#3e2a24', decor: ['lavafalls'], columns: 'cavecols', ceiling: 'stalactites',
    floor: 'lava', floorA: '#3a2a24', floorB: '#1e1614', props: ['coins', 'bones', 'coins', 'skull', 'rubble'], front: 'dark',
  },
  crypt: {
    wall: 'carved', wallA: '#5e5a4e', wallB: '#7a7464', decor: ['alcoves', 'cobwebs', 'roots', 'torches'], columns: 'arches', ceiling: null,
    floor: 'flagstones', floorA: '#6a645a', floorB: '#3e3a32', props: ['coffin', 'bones', 'skull', 'candles', 'rubble'], front: 'dark',
  },
  vault: {
    wall: 'metal', wallA: '#3e444c', wallB: '#5e666e', decor: ['pipes', 'lights', 'signs'], columns: 'girders', ceiling: 'pipes',
    floor: 'grating', floorA: '#5a6068', floorB: '#30343a', props: ['scrap', 'crate', 'puddle', 'scrap'], front: 'crates',
  },
  ship_hold: {
    wall: 'planks', wallA: '#5a3e28', wallB: '#86603e', decor: ['portholes', 'lanterns', 'chains'], columns: 'ribs', ceiling: 'beams',
    floor: 'planks', floorA: '#8a6442', floorB: '#4e3622', props: ['barrel', 'crate', 'coins', 'puddle', 'straw'], front: 'crates',
  },
  factory: {
    wall: 'bricks', wallA: '#6e3a2c', wallB: '#92543c', decor: ['furnaces', 'gears', 'pipes', 'chains'], columns: 'girders', ceiling: 'beams',
    floor: 'concrete', floorA: '#6a6660', floorB: '#3e3c38', props: ['scrap', 'crate', 'barrel', 'slag'], front: 'crates',
  },
  bunker: {
    wall: 'concrete', wallA: '#5e5e58', wallB: '#82827a', decor: ['lights', 'pipes', 'signs', 'lanterns'], columns: 'pillars', ceiling: 'pipes',
    floor: 'concrete', floorA: '#6a6a64', floorB: '#42423e', props: ['sandbags', 'crate', 'scrap', 'puddle', 'tire'], front: 'crates',
  },
};

/* ------------------------------------------------------------ making one */

const cache = new Map<string, Backdrop>();

export function fightBackdrop(scene: SceneId, seed: number): Backdrop {
  const key = `${scene}|${seed}`;
  let b = cache.get(key);
  if (!b) {
    const set = makeSpriteSet(0x5ee0 + seed, noTone);
    const inn = INDOOR_SCENES.has(scene) ? IN[scene] : undefined;
    const front = (f: Front) => paint(BACK_W, FRONT_H, noTone, (p) => foreground(p, f, seed, set), 1, { stuff: false, tile: true });
    if (inn)
      b = {
        far: layer((p) => wall(p, inn, seed), true),
        mid: layer((p) => indoorMid(p, inn, seed)),
        near: layer((p) => indoorFloor(p, inn, seed, set)),
        front: front(inn.front),
        pace: [0.7, 0.85, 1, 1.3],
        indoor: true,
      };
    else {
      const o = OUT[scene] ?? OUT.meadow!;
      b = {
        far: layer((p) => outdoorFar(p, o, seed), true),
        mid: layer((p) => outdoorMid(p, o, seed, set)),
        near: layer((p) => outdoorNear(p, o, seed, set)),
        front: front(o.front),
        pace: [0.12, 0.45, 1, 1.5],
        indoor: false,
      };
    }
    if (cache.size > 6) cache.clear();
    cache.set(key, b);
  }
  return b;
}

const layer = (draw: (p: Painter) => void, plain = false) => paint(BACK_W, BACK_H, noTone, draw, plain ? 0.5 : 1, { stuff: false, tile: true });

/* ------------------------------------------------------------ helpers that wrap round the width */

/** Smooth noise along x that repeats every BACK_W (cells across the width). */
function wave(seed: number, x: number, cells: number): number {
  const t = (((x % BACK_W) + BACK_W) % BACK_W) * (cells / BACK_W);
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(seed, i % cells) * (1 - u) + hash(seed, (i + 1) % cells) * u;
}
/** Rougher noise: a few waves on top of each other (0..1). */
const rough = (seed: number, x: number) => wave(seed, x, 4) * 0.5 + wave(seed + 1, x, 11) * 0.3 + wave(seed + 2, x, 29) * 0.2;
const mod = (x: number) => ((x % BACK_W) + BACK_W) % BACK_W;

/** Draw at x and again a width either side, so whatever crosses an edge carries on from the other. */
function wrap(x: number, w: number, draw: (x: number) => void): void {
  draw(x);
  if (x < 0) draw(x + BACK_W);
  if (x + w > BACK_W) draw(x - BACK_W);
}

/** A sprite stood with its feet at (x, y), scaled. */
function put(p: Painter, art: PixelArt, x: number, y: number, s: number, flip = false): void {
  const w = art.width * s;
  const h = art.height * s;
  const src = art.texture.source.resource as CanvasImageSource;
  wrap(Math.round(x - w / 2), w, (xx) => {
    if (!flip) p.ctx.drawImage(src, xx, Math.round(y - h), w, h);
    else {
      p.ctx.save();
      p.ctx.translate(xx + w, Math.round(y - h));
      p.ctx.scale(-1, 1);
      p.ctx.drawImage(src, 0, 0, w, h);
      p.ctx.restore();
    }
  });
}

function oval(p: Painter, cx: number, cy: number, rx: number, ry: number, c: string): void {
  wrap(cx - rx, rx * 2, (x) => p.ellipse(x + rx, cy, rx, ry, c));
}
function rect(p: Painter, x: number, y: number, w: number, h: number, c: string): void {
  wrap(x, w, (xx) => p.rect(xx, y, w, h, c));
}
function frect(p: Painter, x: number, y: number, w: number, h: number, c: string): void {
  wrap(x, w, (xx) => p.frect(xx, y, w, h, c));
}
function line(p: Painter, x0: number, y0: number, x1: number, y1: number, c: string, thick = 0.5): void {
  const lo = Math.min(x0, x1) - thick;
  wrap(lo, Math.abs(x1 - x0) + thick * 2, (xx) => {
    const d = xx - lo;
    for (let t = 0; t < thick; t += 0.5) p.fline(x0 + d + t, y0, x1 + d + t, y1, c);
  });
}
/** A soft glow: rings of thin light laid on each other. */
function glow(p: Painter, x: number, y: number, r: number, c: string, strength = 0.08): void {
  p.ctx.globalAlpha = strength;
  for (let k = r; k > 1; k -= Math.max(1, r / 6)) oval(p, x, y, k, k * 0.85, c);
  p.ctx.globalAlpha = 1;
}
function alpha(p: Painter, a: number, draw: () => void): void {
  p.ctx.globalAlpha = a;
  draw();
  p.ctx.globalAlpha = 1;
}

/** Scatter n things down the ground from a seed: depth t (0 at the horizon, 1 nearest), x, and a die. */
function scatter(seed: number, n: number, from: number, to: number, bias = 0.8): { x: number; y: number; t: number; d: number }[] {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = hash(seed, k, 1) ** bias;
    out.push({ x: Math.floor(hash(seed, k, 2) * BACK_W), y: Math.round(from + t * (to - from)), t, d: hash(seed, k, 3) });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** A mound, lit on its left: a heap, a dune, a drift. */
function mound(p: Painter, x: number, foot: number, w: number, h: number, c: string): void {
  for (let i = 0; i < h; i++) {
    const t = 1 - i / h;
    const half = Math.round((w / 2) * Math.sqrt(1 - t * t));
    if (half <= 0) continue;
    const y = foot - h + i;
    rect(p, x - half, y, half * 2, 1, c);
    rect(p, x - half, y, Math.max(1, Math.round(half * 0.6)), 1, shade(c, 0.12));
    rect(p, x + half - Math.max(1, Math.round(half * 0.3)), y, Math.max(1, Math.round(half * 0.3)), 1, shade(c, -0.15));
  }
}

/* ------------------------------------------------------------ outdoors: the far layer */

function skyBands(p: Painter, top: string, low: string): void {
  for (let y = 0; y < BACK_H; y++) {
    const t = Math.min(1, y / HZ);
    const band = Math.floor(t * 12) / 12;
    const next = Math.min(1, band + 1 / 12);
    const within = t * 12 - Math.floor(t * 12);
    for (let x = 0; x < BACK_W; x += 1) {
      // (an ordered dither: the next band's colour creeps in toward its edge, as the old games did)
      const bayer = [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
      p.px(x, y, mixHex(top, low, within > bayer + 0.25 ? next : band));
    }
  }
}

function outdoorFar(p: Painter, o: Outdoor, seed: number): void {
  const [top, low] = o.sky;
  skyBands(p, top, low);
  if (o.stars)
    for (let k = 0; k < 160; k++) {
      const x = Math.floor(hash(seed, k, 5) * BACK_W);
      const y = Math.floor(hash(seed, k, 6) ** 1.4 * (HZ - 30));
      const b = hash(seed, k, 7);
      p.fpx(x, y, b > 0.9 ? '#ffffff' : b > 0.5 ? '#c8c0e8' : '#8a80b0');
      if (b > 0.96) {
        p.fpx(x - 0.5, y, '#a8a0d0');
        p.fpx(x + 0.5, y, '#a8a0d0');
        p.fpx(x, y - 0.5, '#a8a0d0');
        p.fpx(x, y + 0.5, '#a8a0d0');
      }
    }
  if (o.planet) {
    const px = 60 + Math.floor(hash(seed, 8) * 200);
    glow(p, px, 70, 40, '#c8a0ff', 0.05);
    oval(p, px, 70, 22, 22, '#8a6aa8');
    oval(p, px - 4, 66, 18, 18, '#a888c0');
    oval(p, px - 8, 62, 10, 10, '#c4a8d8');
    for (let i = -40; i <= 40; i++) p.frect(mod(px + i), 70 + i * 0.18 - 0.5, 1, 1, Math.abs(i) < 22 && i > -2 ? '#e8d8f8' : '#c8b0e0');
  }
  const sx = 70 + Math.floor(hash(seed, 9) * 180);
  const sy = 120 + Math.floor(hash(seed, 10) * 30);
  if (o.sun === 'sun') {
    glow(p, sx, sy, 40, '#fff6d8', 0.07);
    oval(p, sx, sy, 6, 6, '#fffbe8');
    oval(p, sx, sy, 5, 5, '#ffffff');
  } else if (o.sun === 'red') {
    glow(p, sx, sy + 20, 60, '#ffb070', 0.08);
    oval(p, sx, sy + 20, 12, 12, '#f08850');
    oval(p, sx - 1, sy + 19, 10, 10, '#ffb070');
    // (bands of haze across it)
    for (let k = 0; k < 3; k++) rect(p, sx - 14, sy + 16 + k * 5, 28, 1, mixHex(low, '#f08850', 0.5));
  } else if (o.sun === 'moon') {
    glow(p, sx, sy - 40, 30, '#e8f0ff', 0.06);
    oval(p, sx, sy - 40, 7, 7, '#e8eef8');
    oval(p, sx + 2, sy - 42, 1.5, 1.5, '#c8d0dc');
    oval(p, sx - 2, sy - 38, 1, 1, '#c8d0dc');
  }
  for (let k = 0; k < o.clouds; k++) {
    const cx = Math.floor(hash(seed, k, 20) * BACK_W);
    const cy = 30 + Math.floor(hash(seed, k, 21) ** 0.7 * 120);
    const w = 14 + Math.floor(hash(seed, k, 22) * 26) * (cy > 110 ? 0.7 : 1);
    cloud(p, cx, cy, w, seed * 31 + k, mixHex(low, top, 0.15), o.smoke ? '#b8b0a8' : '#eef3f8');
  }
  if (o.clouds > 3 && !o.smoke)
    for (let k = 0; k < 4; k++) {
      const bx = Math.floor(hash(seed, k, 30) * BACK_W);
      const by = 60 + Math.floor(hash(seed, k, 31) * 70);
      p.fline(bx - 1.5, by - 1, bx, by, '#3a4250');
      p.fline(bx, by, bx + 1.5, by - 1, '#3a4250');
    }
  if (o.far === 'mountains') mountains(p, seed, o, top, low);
  else if (o.far === 'crags') crags(p, seed, o.farTint ?? mixHex(PAL.rock, low, 0.4), low, !!o.snow);
  else if (o.far === 'dunes') farDunes(p, seed, o.farTint ?? SAND[0], low);
  else if (o.far === 'city') city(p, seed, low);
  else if (o.far === 'sea') sea(p, seed, low);
  else if (o.far === 'alien') alien(p, seed, low);
  if (o.hills) {
    const hill = o.hills === 'green' ? mixHex(PAL.grassDark, low, 0.62) : mixHex(o.hills, low, 0.4);
    for (let x = 0; x < BACK_W; x++) p.rect(x, HZ - 2 - hillAt(seed, x), 1, hillAt(seed, x) + 2, hill);
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(hash(seed, k, 62) * BACK_W);
      oval(p, x, HZ - 2 - hillAt(seed, x), 2 + hash(seed, k, 63) * 3, 1.5 + hash(seed, k, 64), mixHex(hill, PAL.pineDark, 0.2));
    }
  }
  // smoke rising in columns, leaning with the wind
  for (let k = 0; k < (o.smoke ?? 0); k++) {
    const x0 = Math.floor(hash(seed, k, 40) * BACK_W);
    for (let i = 0; i < 26; i++) {
      const y = HZ - 6 - i * 5;
      const r = 3 + i * 0.9;
      alpha(p, 0.28 * (1 - i / 30), () => oval(p, x0 + i * i * 0.12 + Math.sin(i * 0.7 + k) * 2, y, r, r * 0.8, i < 3 ? '#3a3230' : '#5a524e'));
    }
  }
  alpha(p, 0.12, () => p.rect(0, HZ - 90, BACK_W, 90, low));
}

const hillAt = (seed: number, x: number) => Math.round(8 + 16 * (wave(seed + 60, x, 5) * 0.7 + wave(seed + 61, x, 13) * 0.3));

function cloud(p: Painter, cx: number, cy: number, w: number, seed: number, under: string, body: string): void {
  const puffs: [number, number, number][] = [];
  const n = 3 + Math.floor(w / 9);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const r = 3 + (1 - Math.abs(t - 0.5) * 2) * w * 0.22 + hash(seed, i) * 3;
    puffs.push([cx - w / 2 + t * w, cy - r * 0.55, r]);
  }
  for (const [x, y, r] of puffs) oval(p, x, y + 2, r, r * 0.75, mixHex(under, body, 0.6));
  for (const [x, y, r] of puffs) oval(p, x, y, r, r * 0.72, body);
  for (const [x, y, r] of puffs) oval(p, x - r * 0.25, y - r * 0.3, r * 0.55, r * 0.4, shade(body, 0.4));
  rect(p, cx - w / 2 - 3, cy, w + 6, 2, mixHex(under, body, 0.5));
}

function mountains(p: Painter, seed: number, o: Outdoor, top: string, low: string): void {
  const haze = mixHex(o.farTint ?? PAL.rock, low, 0.55);
  const lit = mixHex(haze, '#ffffff', 0.18);
  const dim = mixHex(haze, top, 0.25);
  const peaks: number[] = [];
  for (let x = 0; x < BACK_W; x++) {
    const r = wave(seed + 40, x, 3) * 0.55 + wave(seed + 41, x, 7) * 0.3 + wave(seed + 42, x, 16) * 0.15;
    peaks[x] = Math.round(18 + 62 * r ** 1.6);
  }
  for (let x = 0; x < BACK_W; x++) {
    const h = peaks[x];
    // (which way the slope faces, over a few columns, so the faces come in broad planes)
    const slope = peaks[(x + 3) % BACK_W] - peaks[(x + BACK_W - 3) % BACK_W];
    const face = slope > 1 ? lit : slope < -1 ? dim : haze;
    const foot = HZ - 4;
    for (let y = foot - h; y < foot; y++) {
      const depth = (y - (foot - h)) / Math.max(1, h);
      let c = mixHex(face, low, depth * 0.45);
      if ((y + Math.round(wave(seed + 47, x, 13) * 6)) % 7 === 0 && depth > 0.15) c = shade(c, -0.06);
      p.px(x, y, c);
    }
    const snow = h - 48;
    if (o.snow && snow > 0) for (let y = 0; y < snow * 0.7 + wave(seed + 48, x, 40) * 3; y++) p.px(x, foot - h + y, slope >= 0 ? '#f4f8fc' : '#d0dcea');
  }
}

/** Sharp crags: spires and saw-teeth, lit on their left faces. */
function crags(p: Painter, seed: number, tint: string, low: string, snow: boolean): void {
  const tri = (x: number, period: number, off: number) => Math.abs((((x + off) / period) % 1) * 2 - 1);
  const hs: number[] = [];
  for (let x = 0; x < BACK_W; x++) hs[x] = Math.round(16 + 50 * (1 - tri(x, 64, seed % 64)) ** 2 + 22 * (1 - tri(x, 40, (seed * 7) % 40)) ** 3 + 8 * (1 - tri(x, 16, seed % 16)));
  for (let x = 0; x < BACK_W; x++) {
    const h = hs[x];
    const slope = hs[(x + 2) % BACK_W] - hs[(x + BACK_W - 2) % BACK_W];
    const face = slope > 0 ? mixHex(tint, '#ffffff', 0.2) : mixHex(tint, '#20202c', 0.15);
    for (let y = HZ - 4 - h; y < HZ - 4; y++) p.px(x, y, mixHex(face, low, ((y - (HZ - 4 - h)) / h) * 0.4));
    if (snow && h > 55) for (let y = 0; y < (h - 55) * 0.6; y++) p.px(x, HZ - 4 - h + y, slope > 0 ? '#f4f8fc' : '#c8d4e2');
  }
}

function farDunes(p: Painter, seed: number, tint: string, low: string): void {
  for (let row = 0; row < 2; row++) {
    const hs: number[] = [];
    for (let x = 0; x < BACK_W; x++) hs[x] = Math.round((row ? 10 : 22) + (row ? 16 : 26) * (wave(seed + 80 + row, x, 3 + row * 2) * 0.7 + wave(seed + 82 + row, x, 9) * 0.3));
    const c = mixHex(tint, low, row ? 0.3 : 0.55);
    for (let x = 0; x < BACK_W; x++) {
      const slope = hs[(x + 3) % BACK_W] - hs[(x + BACK_W - 3) % BACK_W];
      p.rect(x, HZ - 2 - hs[x], 1, hs[x] + 2, slope > 0 ? shade(c, 0.12) : slope < -1 ? shade(c, -0.1) : c);
      if (slope <= 0 && hash(seed, x, 83 + row) < 0.5) p.px(x, HZ - 2 - hs[x], shade(c, 0.2)); // (the lit crest)
    }
  }
}

/** A ruined city on the skyline: towers with broken tops, a few windows still lit. */
function city(p: Painter, seed: number, low: string): void {
  let x = 0;
  let k = 0;
  while (x < BACK_W) {
    const w = 10 + Math.floor(hash(seed, k, 90) * 14);
    const h = 30 + Math.floor(hash(seed, k, 91) ** 1.3 * 70);
    const far = hash(seed, k, 92) < 0.5;
    const c = mixHex(far ? '#6a7080' : '#525866', low, far ? 0.5 : 0.3);
    const ww = Math.min(w, BACK_W - x);
    for (let i = 0; i < ww; i++) {
      // (a broken top: steps down to one side)
      const broken = hash(seed, k, 93) < 0.6 ? Math.max(0, Math.round((i / w) * hash(seed, k, 94) * 20 + hash(seed, k * 30 + i, 95) * 3)) : 0;
      p.rect(x + i, HZ - 4 - h + broken, 1, h - broken + 4, i === 0 ? shade(c, 0.1) : c);
    }
    for (let wy = HZ - h + 4; wy < HZ - 8; wy += 4)
      for (let wx = x + 2; wx < x + ww - 2; wx += 3) {
        const lit = hash(seed, wx, wy) < 0.04;
        if (hash(seed, wx * 3, wy) < 0.7) p.rect(wx, wy, 1, 2, lit ? '#e8c870' : shade(c, -0.2));
      }
    if (hash(seed, k, 96) < 0.3) p.rect(x + Math.floor(w / 2), HZ - 4 - h - 8, 1, 8, c); // (an antenna)
    x += w + Math.floor(hash(seed, k, 97) * 3);
    k++;
  }
}

/** The sea out to the horizon, with a headland, a sail and the sparkle on it. */
function sea(p: Painter, seed: number, low: string): void {
  const top = HZ - 26;
  for (let y = top; y < HZ + 4; y++) p.rect(0, y, BACK_W, 1, mixHex(mixHex('#3a7ab8', low, 0.35), '#2a6aa8', (y - top) / 30));
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(hash(seed, k, 100) * BACK_W);
    const y = top + 1 + Math.floor(hash(seed, k, 101) ** 1.5 * 28);
    rect(p, x, y, 1 + Math.floor((y - top) / 8), 1, hash(seed, k, 102) < 0.5 ? '#c8e4f4' : '#6aa8d8');
  }
  const hx = Math.floor(hash(seed, 103) * BACK_W);
  for (let i = -40; i < 40; i++) {
    const h = Math.round(14 * Math.cos((i / 40) * (Math.PI / 2)) ** 0.7);
    if (h > 0) rect(p, hx + i, top - h, 1, h + 1, mixHex(PAL.grassDark, low, 0.5));
  }
  const sx = Math.floor(hash(seed, 104) * BACK_W);
  rect(p, sx - 4, top + 6, 9, 2, '#4a3a2a');
  for (let i = 0; i < 8; i++) rect(p, sx - Math.floor(i / 2), top + 5 - (8 - i), Math.max(1, Math.floor(i / 2) + 1), 1, '#f0ece0');
}

/** An alien range: tall glassy spires, glowing at their roots. */
function alien(p: Painter, seed: number, low: string): void {
  for (let x = 0; x < BACK_W; x++) {
    const h = Math.round(14 + 60 * Math.max(0, wave(seed + 110, x, 9) - 0.35) ** 1.5 * 2 + 10 * wave(seed + 111, x, 31));
    const slope = wave(seed + 110, x + 2, 9) - wave(seed + 110, x - 2, 9);
    const c = slope > 0 ? '#6a4a8a' : '#3e2a5a';
    for (let y = HZ - 4 - h; y < HZ - 4; y++) p.px(x, y, mixHex(c, low, ((y - (HZ - 4 - h)) / Math.max(1, h)) * 0.5));
  }
  for (let k = 0; k < 6; k++) glow(p, Math.floor(hash(seed, k, 112) * BACK_W), HZ - 8, 20, '#60f0d0', 0.05);
}

/* ------------------------------------------------------------ outdoors: the middle layer */

function outdoorMid(p: Painter, o: Outdoor, seed: number, set: SpriteSet): void {
  for (const m of o.mid) {
    switch (m[0]) {
      case 'rise': {
        const rise = m[1] ?? mixHex(PAL.grassDark, o.sky[1], 0.35);
        for (let x = 0; x < BACK_W; x++) {
          const h = Math.round(3 + 8 * rough(seed + 80, x));
          p.rect(x, HZ - h, 1, h + 4, rise);
          if (hash(seed, x, 81) < 0.3) p.px(x, HZ - h - 1, mixHex(rise, '#ffffff', 0.1));
        }
        break;
      }
      case 'trees': {
        const [, kind, n, big] = m;
        const list = kind === 'pine' ? set.pine : kind === 'broadleaf' ? set.broadleaf : kind === 'bush' ? set.bush : [...set.broadleaf, ...set.pine.slice(0, 2), ...set.bush];
        for (let k = 0; k < n; k++) {
          const art = list[Math.floor(hash(seed + n, k, 82) * list.length)];
          put(p, art, (k / n) * BACK_W + hash(seed + n, k, 83) * 10, HZ + 1 - Math.floor(hash(seed, k, 84) * 4), 0.5, hash(seed, k, 85) < 0.5);
        }
        alpha(p, 0.16, () => p.rect(0, HZ - 70, BACK_W, 72, o.sky[1]));
        for (let k = 0; k < big; k++) put(p, list[Math.floor(hash(seed + n, k, 86) * list.length)], hash(seed + n, k, 87) * BACK_W, HZ + 3, 0.75, hash(seed, k, 88) < 0.5);
        break;
      }
      case 'dead':
        for (let k = 0; k < m[1]; k++) deadTree(p, hash(seed, k, 120) * BACK_W, HZ + 3, 24 + hash(seed, k, 121) * 22, seed + k);
        break;
      case 'cliffs':
        cliffs(p, seed, set, m[1]);
        break;
      case 'rocks':
        for (let k = 0; k < m[1]; k++) put(p, (k % 3 ? set.boulder : set.outcrop)[k % 4], hash(seed, k, 100) * BACK_W, HZ + 4, k % 3 ? 0.5 : 0.75);
        break;
      case 'tents':
        for (let k = 0; k < m[1]; k++) tent(p, ((k + 0.5) / m[1]) * BACK_W + hash(seed, k, 130) * 20, HZ + 4, 18 + hash(seed, k, 131) * 10, 14 + hash(seed, k, 132) * 6, ['#a8845a', '#8a5a3a', '#7a7a5a', '#6a4a3a'][k % 4]);
        break;
      case 'palisade':
        palisade(p, seed);
        break;
      case 'houses':
        for (let k = 0; k < m[1]; k++) house(p, ((k + 0.3) / m[1]) * BACK_W + hash(seed, k, 140) * 20, HZ + 4, 22 + hash(seed, k, 141) * 12, 14 + hash(seed, k, 142) * 6, m[2], seed + k);
        break;
      case 'columns':
        for (let k = 0; k < m[1]; k++) column(p, ((k + 0.5) / m[1]) * BACK_W + hash(seed, k, 150) * 14, HZ + 4, 26 + hash(seed, k, 151) * 18, hash(seed, k, 152) < 0.55, seed + k);
        break;
      case 'derricks':
        for (let k = 0; k < m[1]; k++) {
          const x = ((k + 0.5) / m[1]) * BACK_W + hash(seed, k, 160) * 20;
          if (k % 2 && m[1] > 2) pumpjack(p, x, HZ + 4);
          else derrick(p, x, HZ + 4, 40 + hash(seed, k, 161) * 20);
        }
        break;
      case 'towers':
        for (let k = 0; k < m[1]; k++) ruinTower(p, ((k + 0.5) / m[1]) * BACK_W + hash(seed, k, 170) * 20, HZ + 4, 18 + hash(seed, k, 171) * 14, 34 + hash(seed, k, 172) * 40, seed + k);
        break;
      case 'fence':
        fence(p, HZ + 6);
        break;
      case 'watchtower':
        watchtower(p, hash(seed, 180) * BACK_W, HZ + 4);
        watchtower(p, hash(seed, 181) * BACK_W + BACK_W / 2, HZ + 4);
        break;
      case 'mill':
        mill(p, hash(seed, 185) * BACK_W, HZ + 4);
        break;
      case 'heaps':
        for (let k = 0; k < m[2]; k++) mound(p, hash(seed, k, 190) * BACK_W, HZ + 4, 30 + hash(seed, k, 191) * 40, 10 + hash(seed, k, 192) * 18, m[1]);
        break;
      case 'cacti':
        for (let k = 0; k < m[1]; k++) cactus(p, hash(seed, k, 200) * BACK_W, HZ + 4, 14 + hash(seed, k, 201) * 12, seed + k);
        break;
      case 'snowpines':
        for (let k = 0; k < m[1]; k++) snowPine(p, (k / m[1]) * BACK_W + hash(seed, k, 210) * 12, HZ + 3, 22 + hash(seed, k, 211) * 18);
        break;
      case 'palms':
        for (let k = 0; k < m[1]; k++) palm(p, ((k + 0.5) / m[1]) * BACK_W + hash(seed, k, 220) * 18, HZ + 4, 26 + hash(seed, k, 221) * 14, hash(seed, k, 222) < 0.5 ? -1 : 1);
        break;
      case 'spires':
        for (let k = 0; k < m[1]; k++) spire(p, hash(seed, k, 230) * BACK_W, HZ + 4, 16 + hash(seed, k, 231) * 30, k % 2 ? '#60e0d0' : '#b080f0');
        break;
      case 'wreck':
        wreck(p, hash(seed, 240) * BACK_W, HZ + 4);
        break;
      case 'dunes':
        for (let k = 0; k < 5; k++) mound(p, (k / 5) * BACK_W + hash(seed, k, 250) * 30, HZ + 4, 70 + hash(seed, k, 251) * 50, 8 + hash(seed, k, 252) * 8, SAND[0]);
        break;
    }
  }
}

function deadTree(p: Painter, x: number, foot: number, h: number, seed: number): void {
  const c = '#2e2620';
  const branch = (bx: number, by: number, ang: number, len: number, depth: number, thick: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by - Math.sin(ang) * len;
    line(p, bx, by, ex, ey, c, thick);
    if (depth <= 0) return;
    branch(ex, ey, ang + 0.5 + hash(seed, depth, 1) * 0.3, len * 0.65, depth - 1, Math.max(0.5, thick - 0.5));
    branch(ex, ey, ang - 0.5 - hash(seed, depth, 2) * 0.3, len * 0.6, depth - 1, Math.max(0.5, thick - 0.5));
  };
  rect(p, x - 1, foot - h * 0.5, 2, h * 0.5, c);
  rect(p, x - 1, foot - h * 0.5, 1, h * 0.5, '#4a3e34');
  branch(x, foot - h * 0.5, Math.PI / 2 + 0.1, h * 0.35, 3, 1.5);
}

/** A quarry's worked face: rock in strata, cracks, ledges with grass on them, cut steps at the foot. */
function cliffs(p: Painter, seed: number, set: SpriteSet, rock: string): void {
  const tops: number[] = [];
  for (let x = 0; x < BACK_W; x++) tops[x] = Math.round(HZ - 22 - 34 * (wave(seed + 90, x, 4) * 0.7 + wave(seed + 89, x, 11) * 0.3) - (wave(seed + 91, x, 6) > 0.55 ? 8 : 0));
  for (let x = 0; x < BACK_W; x++) {
    for (let y = tops[x]; y < HZ + 3; y++) {
      const wob = Math.round(wave(seed + 92, x, 10) * 4);
      const band = Math.floor((y + wob) / 5) % 4;
      let c = [rock, shade(rock, 0.15), rock, mixHex(rock, PAL.dirtLight, 0.35)][band];
      if ((y + wob) % 5 === 0) c = shade(rock, -0.3);
      if (y === tops[x]) c = shade(rock, 0.35);
      if (y - tops[x] < 6 && tops[(x + 4) % BACK_W] - tops[(x + BACK_W - 4) % BACK_W] < -2) c = mixHex(c, '#ffffff', 0.1);
      p.px(x, y, c);
    }
    if (hash(seed, x, 93) < 0.4) p.px(x, tops[x] - 1, PAL.grassLight);
  }
  for (let k = 0; k < 18; k++) {
    let x = hash(seed, k, 94) * BACK_W;
    let y = tops[Math.floor(x)] + 3;
    const len = 6 + hash(seed, k, 95) * 20;
    for (let i = 0; i < len; i++) {
      p.fpx(mod(x), y, '#3a3634');
      x += hash(seed, k * 50 + i, 96) - 0.5;
      y += 0.5;
    }
  }
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(hash(seed, k, 97) * BACK_W);
    const w = 10 + Math.floor(hash(seed, k, 98) * 16);
    const h = 4 + Math.floor(hash(seed, k, 99) * 6);
    rect(p, x, HZ + 3 - h, w, h, shade(rock, 0.15));
    rect(p, x, HZ + 3 - h, w, 1, shade(rock, 0.35));
    rect(p, x + w - 1, HZ + 3 - h, 1, h, shade(rock, -0.3));
  }
  for (let k = 0; k < 3; k++) put(p, set.outcrop[k % set.outcrop.length], hash(seed, k, 101) * BACK_W, HZ + 4, 0.75);
}

function tent(p: Painter, x: number, foot: number, w: number, h: number, c: string): void {
  for (let i = 0; i < h; i++) {
    const half = Math.round((w / 2) * (i / h));
    rect(p, x - half, foot - h + i, half, 1, shade(c, 0.12));
    rect(p, x, foot - h + i, half, 1, shade(c, -0.12));
    if (i % 5 === 3) rect(p, x - half, foot - h + i, half * 2, 1, shade(c, -0.25)); // (a seam)
  }
  for (let i = 0; i < h * 0.55; i++) rect(p, x - Math.round(i * 0.35), foot - Math.round(h * 0.55) + i, Math.round(i * 0.7) + 1, 1, '#1e1610');
  rect(p, x, foot - h - 4, 1, 5, '#4a3424');
  line(p, x - w / 2, foot, x - w / 2 - 5, foot, '#3a2a1e');
  line(p, x, foot - h, x - w / 2 - 5, foot, '#8a7a5a');
}

function palisade(p: Painter, seed: number): void {
  const gate = Math.floor(hash(seed, 300) * BACK_W);
  for (let x = 0; x < BACK_W; x += 4) {
    if (mod(x - gate) < 20) continue;
    const h = 20 + Math.floor(hash(seed, x, 301) * 5);
    rect(p, x, HZ + 4 - h, 3, h, PAL.trunk);
    rect(p, x, HZ + 4 - h, 1, h, PAL.trunkLight);
    rect(p, x + 2, HZ + 4 - h, 1, h, PAL.trunkDark);
    rect(p, x + 1, HZ + 2 - h, 1, 2, PAL.trunk); // (sharpened)
  }
  for (let x = 0; x < BACK_W; x++) if (mod(x - gate) >= 20) p.rect(x, HZ - 8, 1, 2, PAL.trunkDark);
  // the gate's posts and a skull on one
  rect(p, gate - 2, HZ - 26, 3, 30, PAL.trunkDark);
  rect(p, gate + 20, HZ - 26, 3, 30, PAL.trunkDark);
  oval(p, gate, HZ - 28, 2, 2, '#e8e0cc');
  p.fpx(mod(gate - 1), HZ - 28, '#2a2018');
  p.fpx(mod(gate + 0.5), HZ - 28, '#2a2018');
}

function house(p: Painter, x: number, foot: number, w: number, h: number, burned: boolean, seed: number): void {
  const wall = burned ? '#4a3e34' : '#b8a07a';
  const left = Math.round(x - w / 2);
  for (let i = 0; i < h; i++) rect(p, left, foot - h + i, w, 1, burned ? mixHex(wall, '#1a1410', (i / h) * 0.5) : wall);
  // timber frame
  const beam = burned ? '#1e1814' : '#5a3a22';
  rect(p, left, foot - h, 1, h, beam);
  rect(p, left + w - 1, foot - h, 1, h, beam);
  rect(p, left, foot - h, w, 1, beam);
  rect(p, left, foot - Math.round(h / 2), w, 1, beam);
  rect(p, left + Math.round(w / 2), foot - h, 1, h, beam);
  // door and windows
  rect(p, left + Math.round(w / 2) + 2, foot - 7, 4, 7, burned ? '#0e0a08' : '#4a3020');
  for (const wx of [left + 3, left + w - 7]) rect(p, wx, foot - h + 3, 4, 3, burned ? '#0e0a08' : '#e8c870');
  // the roof: whole, or burned through with its rafters showing
  const rh = Math.round(h * 0.7);
  for (let i = 0; i < rh; i++) {
    const half = Math.round(((w + 4) / 2) * (i / rh));
    if (!burned) {
      rect(p, x - half, foot - h - rh + i, half, 1, '#8a5232');
      rect(p, x, foot - h - rh + i, half, 1, '#6a3a22');
    } else if (hash(seed, i, 1) < 0.5 || i > rh - 3) rect(p, x - half, foot - h - rh + i, Math.round(half * 0.7), 1, '#2a201a');
  }
  if (burned) {
    for (let k = 0; k < 4; k++) line(p, x - w / 2 + k * (w / 3), foot - h, x - w / 4 + k * (w / 6), foot - h - rh + 2, '#1a1410', 1);
    for (let k = 0; k < 5; k++) {
      const ex = left + hash(seed, k, 2) * w;
      const ey = foot - hash(seed, k, 3) * h;
      p.fpx(mod(ex), ey, k % 2 ? '#ff8a3a' : '#ffc060');
      glow(p, ex, ey, 4, '#ff8a3a', 0.12);
    }
  } else {
    rect(p, x + Math.round(w / 4), foot - h - rh, 3, Math.round(rh * 0.6), '#7a5a4a'); // (a chimney)
  }
}

function column(p: Painter, x: number, foot: number, h: number, broken: boolean, seed: number): void {
  const stone = '#c8c0aa';
  const w = 7;
  const left = Math.round(x - w / 2);
  rect(p, left - 2, foot - 3, w + 4, 3, shade(stone, -0.1));
  rect(p, left - 2, foot - 3, w + 4, 1, shade(stone, 0.15));
  const top = foot - 3 - h;
  for (let i = 0; i < w; i++) {
    for (let y = top; y < foot - 3; y++) {
      if (broken && y - top < Math.round(hash(seed, i, 4) * 6 + (i / w) * 6)) continue;
      p.px(mod(left + i), y, i === 0 ? shade(stone, 0.2) : i >= w - 2 ? shade(stone, -0.22) : i % 2 ? shade(stone, -0.06) : stone);
    }
  }
  if (!broken) {
    rect(p, left - 2, top - 3, w + 4, 3, stone);
    rect(p, left - 2, top - 3, w + 4, 1, shade(stone, 0.2));
  } else {
    // (its fallen drums beside it)
    rect(p, left + w + 3, foot - 4, 8, 4, shade(stone, -0.05));
    rect(p, left + w + 3, foot - 4, 8, 1, shade(stone, 0.15));
  }
  for (let k = 0; k < 3; k++) p.px(mod(left + Math.floor(hash(seed, k, 5) * w)), foot - 4 - Math.floor(hash(seed, k, 6) * 10), PAL.moss);
}

function derrick(p: Painter, x: number, foot: number, h: number): void {
  const c = '#3a3432';
  const w = h * 0.35;
  line(p, x - w / 2, foot, x - 1, foot - h, c, 1);
  line(p, x + w / 2, foot, x + 1, foot - h, c, 1);
  for (let i = 1; i < 6; i++) {
    const y = foot - (h * i) / 6;
    const half = (w / 2) * (1 - i / 6);
    line(p, x - half, y, x + half, y, c);
    const yn = foot - (h * (i - 1)) / 6;
    const hn = (w / 2) * (1 - (i - 1) / 6);
    line(p, x - hn, yn, x + half, y, '#5a4a40');
  }
  rect(p, x - 3, foot - h - 3, 6, 3, '#6a2a22');
}

function pumpjack(p: Painter, x: number, foot: number): void {
  rect(p, x - 10, foot - 2, 20, 2, '#3a3432');
  line(p, x - 2, foot - 2, x, foot - 12, '#3a3432', 1);
  line(p, x + 2, foot - 2, x, foot - 12, '#3a3432', 1);
  line(p, x - 12, foot - 10, x + 9, foot - 14, '#2a2422', 1.5);
  rect(p, x + 8, foot - 17, 4, 7, '#2a2422'); // (the horse's head)
  line(p, x + 11, foot - 10, x + 11, foot - 2, '#8a8a8a');
}

function ruinTower(p: Painter, x: number, foot: number, w: number, h: number, seed: number): void {
  const c = '#7a7a72';
  const left = Math.round(x - w / 2);
  for (let i = 0; i < w; i++) {
    const cut = Math.round(hash(seed, 1) < 0.5 ? (i / w) * 14 : ((w - i) / w) * 14) + Math.floor(hash(seed, i, 2) * 3);
    rect(p, left + i, foot - h + cut, 1, h - cut, i === 0 ? shade(c, 0.15) : i === w - 1 ? shade(c, -0.25) : c);
  }
  for (let wy = foot - h + 16; wy < foot - 6; wy += 6)
    for (let wx = left + 2; wx < left + w - 3; wx += 4) rect(p, wx, wy, 2, 3, hash(seed, wx, wy) < 0.1 ? '#3a2e24' : '#1e1e22');
  for (let k = 0; k < 3; k++) line(p, left + 3 + k * 5, foot - h + 12, left + 2 + k * 5 + (k - 1), foot - h + 6, '#6a4a3a');
}

function fence(p: Painter, foot: number): void {
  for (let x = 0; x < BACK_W; x += 20) {
    rect(p, x, foot - 22, 1, 22, '#5a5a5a');
    line(p, x, foot - 22, x + 3, foot - 25, '#5a5a5a');
  }
  alpha(p, 0.35, () => {
    for (let x = 0; x < BACK_W; x += 3) {
      line(p, x, foot - 20, x + 8, foot, '#8a8a8a');
      line(p, x + 8, foot - 20, x, foot, '#8a8a8a');
    }
  });
  for (let x = 0; x < BACK_W; x += 2) {
    p.fpx(x, foot - 24 + (x % 4 ? 0.5 : 0), '#6a6a6a');
    if (x % 6 === 0) p.fpx(x, foot - 25, '#9a9a9a');
  }
}

function watchtower(p: Painter, x: number, foot: number): void {
  const wood = PAL.trunk;
  line(p, x - 8, foot, x - 5, foot - 34, wood, 1);
  line(p, x + 8, foot, x + 5, foot - 34, wood, 1);
  line(p, x - 7, foot - 4, x + 6, foot - 18, PAL.trunkDark);
  line(p, x + 7, foot - 4, x - 6, foot - 18, PAL.trunkDark);
  rect(p, x - 8, foot - 36, 16, 3, PAL.trunkLight);
  rect(p, x - 7, foot - 44, 14, 8, wood);
  rect(p, x - 5, foot - 43, 10, 3, '#1a1410');
  for (let i = 0; i < 5; i++) rect(p, x - 9 + i, foot - 49 + i, 18 - i * 2, 1, '#5a4a3a');
  rect(p, x + 5, foot - 42, 3, 2, '#e8e0a0');
  alpha(p, 0.08, () => {
    for (let i = 0; i < 40; i++) rect(p, x + 7 + i, foot - 42 + i * 0.3, 1, 2 + i * 0.25, '#fff8c0');
  });
}

function mill(p: Painter, x: number, foot: number): void {
  const left = Math.round(x - 20);
  for (let i = 0; i < 30; i++) for (let j = 0; j < 40; j += 6) rect(p, left + j + (i % 6 < 3 ? 0 : 3), foot - 30 + i, 5, 1, i % 3 === 0 ? '#5a2e22' : '#8a4a32');
  for (let i = 0; i < 14; i++) rect(p, left - 2 + i, foot - 44 + i, 44 - i * 2, 1, '#4a3a34');
  rect(p, left + 30, foot - 54, 5, 14, '#6a3a2a');
  for (const wx of [left + 6, left + 16, left + 26]) rect(p, wx, foot - 24, 4, 5, '#1e1a18');
  // the water wheel, with its spokes and paddles
  const cx = left + 46;
  const cy = foot - 14;
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    p.frect(mod(cx + Math.cos(t) * 13), cy + Math.sin(t) * 13, 1, 1, PAL.trunkDark);
    if (a % 4 === 0) {
      line(p, cx, cy, cx + Math.cos(t) * 13, cy + Math.sin(t) * 13, PAL.trunk);
      frect(p, cx + Math.cos(t) * 14 - 1, cy + Math.sin(t) * 14 - 1, 2, 2, PAL.trunkLight);
    }
  }
  oval(p, cx, cy, 2, 2, '#3a3a3a');
}

function cactus(p: Painter, x: number, foot: number, h: number, seed: number): void {
  const c = '#4a7a3a';
  const arm = (ax: number, ay: number, dir: number, len: number) => {
    rect(p, dir < 0 ? ax - 4 : ax, ay, 4, 2, c);
    const ux = dir < 0 ? ax - 4 : ax + 2;
    rect(p, ux, ay - len, 2, len + 2, c);
    rect(p, ux, ay - len, 1, len, '#6a9a4a');
  };
  rect(p, x - 1.5, foot - h, 3, h, c);
  rect(p, x - 1.5, foot - h, 1, h, '#6a9a4a');
  rect(p, x + 1, foot - h, 1, h, '#2e5a2a');
  arm(x - 1.5, foot - h * 0.55, -1, 5 + hash(seed, 1) * 3);
  if (hash(seed, 2) < 0.7) arm(x + 1.5, foot - h * 0.4, 1, 4 + hash(seed, 3) * 4);
  for (let i = 1; i < h; i += 2) p.fpx(mod(x - 2), foot - i, '#e8e0c0');
}

function snowPine(p: Painter, x: number, foot: number, h: number): void {
  rect(p, x - 1, foot - 4, 2, 4, PAL.trunkDark);
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const tb = foot - 3 - (t * h) / (tiers + 0.5);
    const th = h / tiers + 3;
    const wide = h * 0.32 * (1 - t * 0.18);
    for (let i = 0; i < th; i++) {
      const half = Math.round(((th - i) / th) * wide);
      const y = tb - i;
      rect(p, x - half, y, half * 2 + 1, 1, PAL.pineDark);
      rect(p, x - half, y, Math.max(1, Math.round(half * 0.6)), 1, PAL.pine);
      if (i > th - 3) rect(p, x - half, y, half * 2 + 1, 1, '#f4f8fc');
    }
    rect(p, x - Math.round(wide), tb, Math.round(wide * 2) + 1, 1, '#e8eef4');
  }
}

function palm(p: Painter, x: number, foot: number, h: number, lean: number): void {
  let tx = x;
  let ty = foot;
  for (let i = 0; i < h; i++) {
    tx = x + lean * (i / h) ** 2 * 8;
    ty = foot - i;
    frect(p, tx - 1, ty, 2.5, 1, i % 3 === 0 ? '#6a4a2a' : '#8a6a3a');
  }
  for (let f = 0; f < 7; f++) {
    const dir = f < 3.5 ? -1 : 1;
    const spread = ((f % 4) + 1) / 4;
    for (let i = 0; i < 12; i++) {
      const fx = tx + dir * i * (0.6 + spread * 0.5);
      const fy = ty - 2 + (i * i) / (8 + spread * 10) - spread * 2;
      frect(p, fx, fy, 1, 1, i < 3 ? '#2e6a2a' : '#4a8a3a');
      if (i % 2) frect(p, fx, fy + 1, 0.5, 1.5, '#3a7a32');
    }
  }
  oval(p, tx, ty + 1, 2, 1.5, '#5a3a1a');
}

function spire(p: Painter, x: number, foot: number, h: number, c: string): void {
  glow(p, x, foot - h * 0.4, h * 0.5, c, 0.05);
  for (let i = 0; i < h; i++) {
    const half = Math.max(0.5, ((h - i) / h) * 3.5);
    frect(p, x - half, foot - i, half, 1, mixHex(c, '#ffffff', 0.3));
    frect(p, x, foot - i, half, 1, mixHex(c, '#20103a', 0.4));
  }
}

function wreck(p: Painter, x: number, foot: number): void {
  for (let k = 0; k < 3; k++) {
    const px = x + k * 14 - 14;
    const py = foot - 4 - k * 3;
    for (let i = 0; i < 12; i++) frect(p, px + i, py - i * 0.4, 1, 6, i % 3 === 0 ? '#8a8a9a' : '#2a3a7a');
  }
  for (let i = 0; i < 9; i++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((i - 4.5) / 5) ** 2)) * 4);
    rect(p, x + 30 - half, foot - 18 + i, half * 2 + 1, 1, '#c8c8d0');
  }
  line(p, x + 30, foot - 14, x + 30, foot, '#6a6a7a', 1);
  glow(p, x + 4, foot - 6, 12, '#ff8a3a', 0.12);
}

/* ------------------------------------------------------------ outdoors: the ground */

function outdoorNear(p: Painter, o: Outdoor, seed: number, set: SpriteSet): void {
  const [farC, nearC, darkC] = o.ground;
  const H = BACK_H - HZ;
  for (let y = HZ; y < BACK_H; y++) p.rect(0, y, BACK_W, 1, mixHex(farC, nearC, ((y - HZ) / H) ** 0.6));
  for (const b of scatter(seed + 120, 90, HZ + 2, BACK_H, 0.9)) {
    const rx = 4 + b.t * 16 + b.d * 6;
    oval(p, b.x, b.y, rx, rx * (0.18 + b.t * 0.12), b.d < 0.5 ? mixHex(nearC, darkC, 0.35) : mixHex(nearC, '#ffffff', 0.08));
  }
  if (o.ripples)
    for (let k = 0; k < 120; k++) {
      const y = HZ + 3 + Math.floor(hash(seed, k, 260) ** 0.8 * (H - 4));
      const x = Math.floor(hash(seed, k, 261) * BACK_W);
      const w = 6 + ((y - HZ) / H) * 18;
      for (let i = 0; i < w; i++) p.fpx(mod(x + i), y + Math.sin(i / 3) * 0.6, i % 2 ? o.ripples : shade(o.ripples, 0.2));
    }
  if (o.water === 'river') river(p, seed, set);
  if (o.water === 'shore') shore(p, seed);
  if (o.water === 'oil')
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(hash(seed, k, 270) * BACK_W);
      const y = HZ + 8 + Math.floor(hash(seed, k, 271) * 80);
      oval(p, x, y, 10 + k * 2, 2 + k * 0.4, '#141010');
      rect(p, x - 5, y - 1, 4, 1, '#6a4aa0');
      rect(p, x - 1, y - 1, 3, 1, '#4a8a6a');
    }
  if (o.path === 'dirt') path(p, seed, PAL.dirtLight, PAL.dirt, PAL.grassDark);
  else if (o.path === 'trodden') path(p, seed, '#c8d2dc', '#b0bcc8', '#e8eef4');
  else if (o.path === 'cobbles') cobbles(p, seed);
  else if (o.path === 'road') road(p, seed);
  else if (o.path === 'tracks') tracks(p, seed);
  if (o.blades) {
    for (const b of scatter(seed + 130, 1400, HZ + 2, BACK_H, 0.75)) {
      if (o.water === 'river' && b.y > HZ + 3 && b.y < HZ + 26) continue;
      if (o.path !== 'none' && Math.abs(b.y - (HZ + 36)) < 6) continue;
      const len = 0.5 + b.t * 3 + b.d;
      const c = b.d < 0.3 ? shade(o.blades, -0.2) : b.d < 0.75 ? shade(o.blades, 0.12) : shade(o.blades, 0.25);
      p.fline(b.x, b.y, b.x + (b.d - 0.5) * 1.2, b.y - len, c);
    }
  }
  props(p, o.props, seed, set, 70);
}

function props(p: Painter, list: Prop[], seed: number, set: SpriteSet, n: number): void {
  const seen: Partial<Record<Prop, number>> = {};
  for (const b of scatter(seed + 140, n, HZ + 6, BACK_H - 24, 0.9)) {
    const kind = list[Math.floor(b.d * list.length)];
    // (a few of the big or bright things, not a field of them)
    if ((seen[kind] = (seen[kind] ?? 0) + 1) > (CAP[kind] ?? 99)) continue;
    if (Math.abs(b.y - (HZ + 36)) < 5 && kind !== 'puddle') continue; // (nothing in the middle of the path)
    prop(p, kind, b.x, b.y, b.t < 0.35 ? 0.5 : b.t < 0.75 ? 0.75 : 1, seed + b.x, set);
  }
}

const CAP: Partial<Record<Prop, number>> = { campfire: 2, candles: 4, coffin: 4, coins: 6, puddle: 5, glowrock: 8, cactus: 6, skull: 4, tire: 5 };

const SPRITE_PROPS: Record<SpriteProp, keyof SpriteSet> = {
  flowers: 'flowers', tuft: 'tuft', bramble: 'bramble', bush: 'bush', tallGrass: 'tallGrass', pebbles: 'pebbles', fern: 'fern', mushroom: 'mushroom',
  stump: 'stump', twig: 'twig', reeds: 'reeds', boulder: 'boulder', log: 'log',
};

function prop(p: Painter, kind: Prop, x: number, y: number, s: number, seed: number, set?: SpriteSet): void {
  if (kind in SPRITE_PROPS) {
    if (!set) return;
    const list = set[SPRITE_PROPS[kind as SpriteProp]];
    put(p, list[Math.floor(hash(seed, 141) * list.length)], x, y, kind === 'boulder' ? s * 0.6 : s, hash(seed, 142) < 0.5);
    return;
  }
  const S = s * 1.4;
  switch (kind as DrawnProp) {
    case 'rubble':
      for (let k = 0; k < 4; k++) {
        const w = (1.5 + hash(seed, k, 1) * 2.5) * S;
        const bx = x + (hash(seed, k, 2) - 0.5) * 8 * S;
        const c = hash(seed, k, 3) < 0.5 ? '#9a8a7a' : '#8a5a4a';
        frect(p, bx, y - w * 0.6, w, w * 0.6, c);
        frect(p, bx, y - w * 0.6, w, 0.5, shade(c, 0.2));
      }
      break;
    case 'bones':
      line(p, x - 2 * S, y, x + 2 * S, y - 0.5, '#d8d0b8');
      p.fpx(mod(x - 2 * S), y - 0.5, '#e8e0c8');
      p.fpx(mod(x + 2 * S), y - 1, '#e8e0c8');
      line(p, x - S, y + 0.5, x + 1.5 * S, y - 1.5 * S, '#cac0a8');
      break;
    case 'skull':
      oval(p, x, y - 1.5 * S, 1.6 * S, 1.3 * S, '#e8e0c8');
      frect(p, x - 0.9 * S, y - 1.6 * S, 0.6 * S, 0.6 * S, '#2a2018');
      frect(p, x + 0.3 * S, y - 1.6 * S, 0.6 * S, 0.6 * S, '#2a2018');
      frect(p, x - 0.6 * S, y - 0.4 * S, 1.2 * S, 0.5 * S, '#d0c8b0');
      break;
    case 'drift':
      mound(p, x, y, 16 * S, 3 * S, '#f0f4f8');
      break;
    case 'slag':
      oval(p, x, y - S, 2.5 * S, 1.5 * S, '#1e1a18');
      p.fpx(mod(x - S), y - 2 * S, '#6a6a7a');
      break;
    case 'barrel':
      frect(p, x - 2.5 * S, y - 6 * S, 5 * S, 6 * S, '#7a4e2e');
      frect(p, x - 2.5 * S, y - 6 * S, 1.5 * S, 6 * S, '#9a6a40');
      for (const hy of [1.5, 4.5]) frect(p, x - 2.5 * S, y - hy * S, 5 * S, 0.5, '#2e2a26');
      frect(p, x - 2.5 * S, y - 6.5 * S, 5 * S, 1, '#5a3a22');
      break;
    case 'crate':
      frect(p, x - 3 * S, y - 6 * S, 6 * S, 6 * S, '#a07a4a');
      frect(p, x - 3 * S, y - 6 * S, 6 * S, 0.5, '#c09a62');
      line(p, x - 3 * S, y - 6 * S, x + 3 * S, y, '#6a4a2a');
      line(p, x - 3 * S, y, x + 3 * S, y - 6 * S, '#6a4a2a');
      frect(p, x + 2.5 * S, y - 6 * S, 0.5 * S, 6 * S, '#6a4a2a');
      break;
    case 'sandbags':
      for (const [dx, dy] of [[-3, 0], [0, 0], [3, 0], [-1.5, -2], [1.5, -2]] as const) {
        oval(p, x + dx * S, y - 1 * S + dy * S, 1.8 * S, 1.1 * S, '#b09a6a');
        p.fpx(mod(x + (dx - 0.8) * S), y - 1.6 * S + dy * S, '#d0ba8a');
      }
      break;
    case 'shells':
      for (let k = 0; k < 3; k++) oval(p, x + k * 3 * S, y - 0.5, 0.8 * S, 0.6 * S, k % 2 ? '#f0d8d0' : '#f8f0e8');
      break;
    case 'glowrock': {
      const c = hash(seed, 1) < 0.5 ? '#60f0d0' : '#c080ff';
      glow(p, x, y - 2 * S, 7 * S, c, 0.1);
      oval(p, x, y - S, 2.5 * S, 1.5 * S, '#3a2e4a');
      frect(p, x - 0.5, y - 4 * S, 1, 3 * S, c);
      frect(p, x + S, y - 3 * S, 1, 2 * S, mixHex(c, '#ffffff', 0.4));
      break;
    }
    case 'scrap':
      frect(p, x - 2 * S, y - S, 4 * S, S, '#7a7a82');
      frect(p, x - S, y - 2 * S, 2 * S, S, '#8a5a3a');
      line(p, x, y - S, x + 3 * S, y - 3 * S, '#5a5a62');
      break;
    case 'ash':
      oval(p, x, y, 6 * S, 1.2 * S, '#4a4640');
      oval(p, x - S, y, 3 * S, 0.6 * S, '#6a6660');
      break;
    case 'embers':
      for (let k = 0; k < 4; k++) {
        const ex = x + (hash(seed, k, 4) - 0.5) * 8 * S;
        p.fpx(mod(ex), y - hash(seed, k, 5) * 2, k % 2 ? '#ff7a2a' : '#ffc050');
      }
      glow(p, x, y, 6 * S, '#ff7a2a', 0.08);
      break;
    case 'cactus':
      oval(p, x, y - 1.5 * S, 1.6 * S, 1.8 * S, '#4a7a3a');
      p.fpx(mod(x - 0.5), y - 3.2 * S, '#e8608a');
      break;
    case 'tire':
      oval(p, x, y - 1.5 * S, 2.5 * S, 1.5 * S, '#1a1a1c');
      oval(p, x, y - 1.5 * S, 1.2 * S, 0.6 * S, '#4a4a48');
      break;
    case 'campfire':
      for (let k = 0; k < 6; k++) oval(p, x + Math.cos(k) * 3 * S, y - 0.5 + Math.sin(k) * S, 0.9 * S, 0.6 * S, '#7a7672');
      line(p, x - 2 * S, y, x + 2 * S, y - S, PAL.trunkDark, 1);
      glow(p, x, y - 3 * S, 18 * S, '#ffb050', 0.08);
      oval(p, x, y - 2 * S, 1.6 * S, 2.4 * S, PAL.flameRed);
      oval(p, x, y - 1.8 * S, 1 * S, 1.6 * S, PAL.flameOrange);
      oval(p, x, y - 1.5 * S, 0.5 * S, 0.9 * S, PAL.flameYellow);
      break;
    case 'puddle':
      oval(p, x, y, 5 * S, 1.2 * S, '#4a6a8a');
      frect(p, x - 2 * S, y - 0.5, 2 * S, 0.5, '#c8e0f0');
      break;
    case 'driftwood':
      line(p, x - 4 * S, y, x + 4 * S, y - S, '#9a8a72', 1);
      line(p, x + 2 * S, y - 0.5 * S, x + 4 * S, y - 2.5 * S, '#8a7a62');
      break;
    case 'glowshrooms': {
      const c = hash(seed, 1) < 0.5 ? '#7ae8c8' : '#c08ae8';
      frect(p, x, y - 2 * S, 0.5, 2 * S, '#d8d0c0');
      oval(p, x, y - 2 * S, 1.5 * S, 0.8 * S, c);
      glow(p, x, y - 2 * S, 5 * S, c, 0.1);
      break;
    }
    case 'coins':
      mound(p, x, y, 10 * S, 3 * S, '#d8a830');
      for (let k = 0; k < 5; k++) p.fpx(mod(x + (hash(seed, k, 6) - 0.5) * 8 * S), y - hash(seed, k, 7) * 3 * S, '#fff4a0');
      glow(p, x, y - S, 8 * S, '#ffe080', 0.06);
      break;
    case 'coffin':
      for (let i = 0; i < 4 * S; i++) frect(p, x - 5 * S + (i < S ? S - i : 0), y - 4 * S + i, 10 * S - (i < S ? 2 * (S - i) : 0), 1, i < 1 ? '#7a5a3a' : '#5a3e28');
      frect(p, x - 0.5, y - 4 * S, 1, 3 * S, '#b8a070');
      frect(p, x - 1.5 * S, y - 3 * S, 3 * S, 0.5, '#b8a070');
      break;
    case 'candles':
      for (let k = 0; k < 3; k++) {
        const cx = x + (k - 1) * 2 * S;
        const h = (2 + hash(seed, k, 8) * 2) * S;
        frect(p, cx, y - h, 0.8 * S, h, '#e8e0c8');
        frect(p, cx, y - h - S, 0.6 * S, S, '#ffd070');
      }
      glow(p, x, y - 3 * S, 10 * S, '#ffd070', 0.07);
      break;
    case 'straw':
      for (let k = 0; k < 8; k++) line(p, x + (hash(seed, k, 9) - 0.5) * 8 * S, y - hash(seed, k, 10) * S, x + (hash(seed, k, 11) - 0.5) * 8 * S, y, '#c8a850');
      break;
    case 'heather':
      for (let k = 0; k < 6; k++) {
        const hx = x + (hash(seed, k, 12) - 0.5) * 6 * S;
        frect(p, hx, y - 2 * S, 0.5, 2 * S, '#5a6a3a');
        frect(p, hx - 0.5, y - 2.5 * S, 1, S, k % 2 ? '#a06ab0' : '#c08ac8');
      }
      break;
  }
}

/** The path the party walks, along the middle of the ground. */
function path(p: Painter, seed: number, light: string, edge: string, verge: string): void {
  const mid = HZ + 36;
  for (let x = 0; x < BACK_W; x++) {
    const centre = mid + Math.round((wave(seed + 150, x, 3) - 0.5) * 8);
    const half = 6 + Math.round(wave(seed + 151, x, 9) * 3);
    for (let y = centre - half; y <= centre + half; y++) {
      const t = Math.abs(y - centre) / half;
      let c = mixHex(light, edge, t * 0.8);
      if (Math.abs(y - centre) === Math.round(half * 0.45)) c = shade(c, -0.12);
      p.px(x, y, c);
    }
    if (hash(seed, x, 152) < 0.6) p.px(x, centre - half, verge);
    if (hash(seed, x, 153) < 0.5) p.px(x, centre + half, shade(verge, 0.1));
  }
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(hash(seed, k, 154) * BACK_W);
    const y = mid - 5 + Math.floor(hash(seed, k, 155) * 10);
    p.fpx(x, y, PAL.pebble);
    p.fpx(x + 0.5, y + 0.5, shade(PAL.pebble, -0.3));
  }
}

function cobbles(p: Painter, seed: number): void {
  const mid = HZ + 36;
  for (let row = -4; row <= 4; row++) {
    const y = mid + row * 2;
    const w = 4;
    for (let x = (row & 1) * 2; x < BACK_W; x += w) {
      const c = mixHex('#8a8478', '#6a645a', hash(seed, x, row + 400));
      frect(p, x + 0.5, y + 0.5, w - 1, 1.5, c);
      frect(p, x + 0.5, y + 0.5, w - 1, 0.5, shade(c, 0.15));
    }
  }
  for (let x = 0; x < BACK_W; x++) {
    if (hash(seed, x, 401) < 0.5) p.px(x, mid - 10, PAL.grassDark);
    if (hash(seed, x, 402) < 0.5) p.px(x, mid + 10, PAL.grass);
  }
}

function road(p: Painter, seed: number): void {
  const mid = HZ + 36;
  for (let y = mid - 9; y <= mid + 9; y++) p.rect(0, y, BACK_W, 1, mixHex('#4a4a4c', '#3a3a3c', Math.abs(y - mid) / 9));
  for (let x = 0; x < BACK_W; x += 16) rect(p, x, mid, 8, 1, '#c8b860');
  // cracks and potholes
  for (let k = 0; k < 14; k++) {
    let x = hash(seed, k, 410) * BACK_W;
    let y = mid - 8 + hash(seed, k, 411) * 16;
    for (let i = 0; i < 10; i++) {
      p.fpx(mod(x), y, '#222224');
      x += 0.7;
      y += hash(seed, k * 20 + i, 412) - 0.5;
    }
  }
  for (let k = 0; k < 4; k++) oval(p, hash(seed, k, 413) * BACK_W, mid - 4 + hash(seed, k, 414) * 8, 3, 1, '#2a2a2c');
  for (let x = 0; x < BACK_W; x++) {
    p.px(x, mid - 10, '#6a6a64');
    p.px(x, mid + 10, '#5a5a54');
  }
}

function tracks(p: Painter, seed: number): void {
  const mid = HZ + 36;
  for (let x = 0; x < BACK_W; x += 5) {
    rect(p, x, mid - 3, 3, 7, '#5a4430');
    rect(p, x, mid - 3, 3, 1, '#6e5640');
  }
  for (let x = 0; x < BACK_W; x++) {
    p.px(x, mid - 2, '#8a8a92');
    p.px(x, mid + 2, '#8a8a92');
    if (hash(seed, x, 420) < 0.3) p.px(x, mid - 2, '#b0b0b8');
  }
  // a mine cart left on them
  const cx = Math.floor(hash(seed, 421) * BACK_W);
  rect(p, cx, mid - 10, 12, 7, '#5a5a5e');
  rect(p, cx, mid - 10, 12, 1, '#7a7a80');
  rect(p, cx + 1, mid - 12, 10, 2, '#1e1a18');
  oval(p, cx + 3, mid - 2, 1.5, 1.5, '#2a2a2a');
  oval(p, cx + 9, mid - 2, 1.5, 1.5, '#2a2a2a');
}

function river(p: Painter, seed: number, set: SpriteSet): void {
  const top = HZ + 8;
  for (let x = 0; x < BACK_W; x++) {
    const a = top + Math.round((wave(seed + 160, x, 5) - 0.5) * 4);
    const b = a + 12 + Math.round(wave(seed + 161, x, 7) * 4);
    p.rect(x, a - 2, 1, 2, PAL.mud);
    for (let y = a; y < b; y++) p.px(x, y, mixHex(PAL.waterDark, PAL.water, (y - a) / (b - a)));
    p.rect(x, b, 1, 2, mixHex(PAL.mud, PAL.dirt, 0.4));
    if (hash(seed, x, 162) < 0.12) p.rect(x, a + 2 + Math.floor(hash(seed, x, 163) * (b - a - 4)), 2, 1, PAL.waterLight);
  }
  for (let k = 0; k < 16; k++) put(p, set.reeds[k % set.reeds.length], hash(seed, k, 164) * BACK_W, top + (k % 2 ? 0 : 16), 0.5 + (k % 2) * 0.25);
}

function shore(p: Painter, seed: number): void {
  for (let x = 0; x < BACK_W; x++) {
    const wet = HZ + 4 + Math.round(wave(seed + 170, x, 6) * 6);
    for (let y = HZ; y < wet; y++) p.px(x, y, mixHex('#b89860', '#a88850', (y - HZ) / 10));
    p.px(x, wet, '#f4f8fc');
    if (hash(seed, x, 171) < 0.6) p.px(x, wet - 2, '#d8eaf4');
    p.px(x, HZ + 1 + Math.round(wave(seed + 172, x, 9) * 2), '#e8f4fa');
  }
}

/* ------------------------------------------------------------ the near edge */

function foreground(p: Painter, f: Front, seed: number, set: SpriteSet): void {
  const y = FRONT_H;
  const blades = (c: string) => {
    for (let x = 0; x < BACK_W; x += 0.5) {
      const h = 3 + hash(seed, Math.round(x * 2), 194) * 7;
      p.fline(x, y, x + (hash(seed, Math.round(x * 2), 195) - 0.5) * 2, y - h, hash(seed, Math.round(x * 2), 196) < 0.5 ? c : shade(c, -0.2));
    }
  };
  switch (f) {
    case 'dark':
      for (let x = 0; x < BACK_W; x++) {
        const h = Math.round(4 + 14 * rough(seed + 190, x) ** 2);
        p.rect(x, y - h, 1, h, '#141018');
        p.px(x, y - h, '#2e2836');
      }
      break;
    case 'rocks':
      for (let k = 0; k < 5; k++) put(p, set.boulder[k % set.boulder.length], hash(seed, k, 191) * BACK_W, y + 6, 1);
      break;
    case 'rubble':
      for (let k = 0; k < 14; k++) {
        const x = hash(seed, k, 197) * BACK_W;
        const w = 6 + hash(seed, k, 198) * 10;
        const h = 4 + hash(seed, k, 199) * 6;
        const c = hash(seed, k, 200) < 0.5 ? '#6a6660' : '#7a5446';
        rect(p, x, y - h, w, h + 2, c);
        rect(p, x, y - h, w, 1, shade(c, 0.2));
        rect(p, x + w - 1, y - h, 1, h, shade(c, -0.3));
      }
      break;
    case 'snow':
      for (let k = 0; k < 8; k++) mound(p, (k / 8) * BACK_W + hash(seed, k, 201) * 20, y + 2, 40 + hash(seed, k, 202) * 30, 6 + hash(seed, k, 203) * 6, '#f4f8fc');
      break;
    case 'sand':
      for (let k = 0; k < 6; k++) mound(p, (k / 6) * BACK_W + hash(seed, k, 204) * 30, y + 2, 60 + hash(seed, k, 205) * 40, 5 + hash(seed, k, 206) * 5, SAND[1]);
      for (let k = 0; k < 6; k++) put(p, set.tuft[k % set.tuft.length], hash(seed, k, 207) * BACK_W, y + 1, 1);
      break;
    case 'crates':
      for (let k = 0; k < 7; k++) prop(p, k % 2 ? 'barrel' : 'crate', (k / 7) * BACK_W + hash(seed, k, 208) * 20, y + 2, 2, seed + k, set);
      break;
    case 'ash':
      for (let k = 0; k < 10; k++) prop(p, k % 3 ? 'rubble' : 'embers', (k / 10) * BACK_W, y, 1.6, seed + k, set);
      blades('#3a362c');
      break;
    case 'reeds':
    case 'woods':
    case 'grass': {
      const list = f === 'woods' ? [...set.fern, ...set.bush] : f === 'reeds' ? [...set.reeds, ...set.tallGrass] : [...set.bush, ...set.tallGrass, ...set.bramble];
      for (let k = 0; k < 16; k++) put(p, list[Math.floor(hash(seed, k, 192) * list.length)], (k / 16) * BACK_W + hash(seed, k, 193) * 14, y + 3, 1.25, k % 2 === 0);
      blades(PAL.grassDark);
      break;
    }
  }
}

/* ------------------------------------------------------------ inside: the wall */

function wall(p: Painter, s: Indoor, seed: number): void {
  const { wallA: a, wallB: b } = s;
  const bottom = HZ + 10;
  switch (s.wall) {
    case 'strata':
    case 'lavarock':
      for (let y = 0; y < bottom; y++)
        for (let x = 0; x < BACK_W; x++) {
          const bend = wave(seed + 70, x, 5) * 18 + wave(seed + 71, x, 17) * 5;
          const stratum = Math.floor((y + bend) / 11);
          const lump = wave(seed + 72 + stratum, x, 14 + (stratum % 3) * 4);
          const within = ((y + bend) % 11) / 11;
          let c = mixHex(a, b, lump * 0.75 + (y / HZ) * 0.2);
          if (within < 0.12) c = mixHex(c, '#ffffff', 0.1);
          if (within > 0.88) c = s.wall === 'lavarock' && wave(seed + 73 + stratum, x, 12) > 0.7 ? '#ff7a2a' : shade(a, -0.4);
          p.px(x, y, c);
        }
      for (let k = 0; k < 22; k++) {
        let x = hash(seed, k, 76) * BACK_W;
        let y = hash(seed, k, 77) * (HZ - 40);
        const hot = s.wall === 'lavarock';
        for (let i = 0; i < 26; i++) {
          p.fpx(mod(x), y, hot ? (i % 3 ? '#ff8a3a' : '#ffd070') : '#0e0b12');
          x += (hash(seed, k * 40 + i, 78) - 0.5) * 1.6;
          y += 0.6;
        }
        if (hot) glow(p, x, y - 8, 10, '#ff7a2a', 0.06);
      }
      break;
    case 'bricks':
      p.rect(0, 0, BACK_W, bottom, shade(a, -0.35));
      for (let r = 0; r * 6 < bottom; r++)
        for (let bx = r % 2 ? -8 : 0; bx < BACK_W; bx += 16) {
          const c = mixHex(a, b, hash(seed, bx + 500, r));
          if (hash(seed, bx + 501, r) < 0.03) continue; // (a brick fallen out)
          rect(p, bx + 1, r * 6 + 1, 15, 5, c);
          rect(p, bx + 1, r * 6 + 1, 15, 1, shade(c, 0.12));
          if (hash(seed, bx + 502, r) < 0.08) rect(p, bx + 3, r * 6 + 5, 4, 1, PAL.moss);
        }
      break;
    case 'carved':
      p.rect(0, 0, BACK_W, bottom, shade(a, -0.4));
      for (let r = 0; r * 16 < bottom; r++)
        for (let bx = r % 2 ? -16 : 0; bx < BACK_W; bx += 32) {
          const c = mixHex(a, b, hash(seed, bx + 510, r));
          const y = r * 16;
          rect(p, bx + 1, y + 1, 31, 15, c);
          rect(p, bx + 1, y + 1, 31, 1, shade(c, 0.18));
          rect(p, bx + 1, y + 1, 1, 15, shade(c, 0.1));
          rect(p, bx + 1, y + 15, 31, 1, shade(c, -0.2));
          if (hash(seed, bx + 511, r) < 0.25) {
            // (an old carving: runes worn smooth)
            for (let k = 0; k < 4; k++) rect(p, bx + 8 + k * 5, y + 6, 1, 4, shade(c, -0.25));
            rect(p, bx + 8, y + 10, 16, 1, shade(c, -0.25));
          }
        }
      break;
    case 'planks':
      for (let r = 0; r * 7 < bottom; r++) {
        const c = mixHex(a, b, hash(seed, r, 520));
        p.rect(0, r * 7, BACK_W, 7, c);
        p.rect(0, r * 7, BACK_W, 1, shade(c, -0.35));
        for (let x = 0; x < BACK_W; x++) if (wave(seed + 521 + r, x, 40) > 0.62) p.px(x, r * 7 + 3, shade(c, -0.1)); // (grain)
        for (let k = 0; k < 2; k++) {
          const jx = Math.floor(hash(seed, r, 522 + k) * BACK_W);
          rect(p, jx, r * 7, 1, 7, shade(c, -0.4));
          p.fpx(mod(jx - 1), r * 7 + 2, '#2a2420');
          p.fpx(mod(jx + 1.5), r * 7 + 2, '#2a2420');
        }
      }
      break;
    case 'metal':
      p.rect(0, 0, BACK_W, bottom, shade(a, -0.3));
      for (let r = 0; r * 20 < bottom; r++)
        for (let bx = 0; bx < BACK_W; bx += 40) {
          const c = mixHex(a, b, hash(seed, bx + 530, r) * 0.6);
          const y = r * 20;
          rect(p, bx + 1, y + 1, 39, 19, c);
          rect(p, bx + 1, y + 1, 39, 1, shade(c, 0.2));
          for (const [rx, ry] of [[3, 3], [37, 3], [3, 17], [37, 17]] as const) {
            p.fpx(bx + rx, y + ry, shade(c, 0.35));
            p.fpx(bx + rx + 0.5, y + ry + 0.5, shade(c, -0.4));
          }
          if (hash(seed, bx + 531, r) < 0.3) for (let i = 0; i < 8; i++) p.fpx(bx + 10 + i * 2, y + 8 + hash(seed, i, bx) * 4, shade(c, -0.15));
        }
      for (let y = HZ - 8; y < HZ; y++) for (let x = 0; x < BACK_W; x++) p.px(x, y, (x + y) % 8 < 4 ? '#d8b830' : '#1e1e20');
      break;
    case 'concrete':
      for (let r = 0; r * 40 < bottom; r++)
        for (let bx = 0; bx < BACK_W; bx += 64) {
          const c = mixHex(a, b, hash(seed, bx + 540, r) * 0.5);
          rect(p, bx, r * 40, 64, 40, c);
          rect(p, bx, r * 40, 64, 1, shade(c, -0.25));
          rect(p, bx, r * 40, 1, 40, shade(c, -0.25));
          for (const [tx, ty] of [[16, 10], [48, 10], [16, 30], [48, 30]] as const) oval(p, bx + tx, r * 40 + ty, 1, 1, shade(c, -0.3));
          // (stains run down from the joints)
          alpha(p, 0.2, () => {
            for (let k = 0; k < 3; k++) rect(p, bx + 6 + hash(seed, bx + k, r) * 50, r * 40 + 1, 2, 10 + hash(seed, bx + k + 9, r) * 20, shade(c, -0.4));
          });
        }
      break;
  }
  for (const d of s.decor) decor(p, d, seed, s);
  // gloom up toward the roof, and the foot of the wall in shadow
  for (let y = 0; y < HZ; y++) alpha(p, (1 - y / HZ) ** 1.6 * 0.55, () => p.rect(0, y, BACK_W, 1, '#08060c'));
  alpha(p, 0.4, () => p.rect(0, HZ - 4, BACK_W, bottom - HZ + 4, '#08060c'));
}

function torch(p: Painter, x: number, y: number): void {
  glow(p, x, y - 3, 26, '#ffb050', 0.06);
  rect(p, x - 2, y + 2, 4, 1, '#2a2622');
  rect(p, x - 0.5, y - 2, 1.5, 5, PAL.trunk);
  oval(p, x, y - 4, 1.6, 2.6, PAL.flameRed);
  oval(p, x, y - 4, 1, 1.8, PAL.flameOrange);
  frect(p, x - 0.5, y - 4, 1, 1, PAL.flameYellow);
}

function decor(p: Painter, d: Decor, seed: number, s: Indoor): void {
  const n = (k: number) => Math.floor(hash(seed, k, 600 + d.length) * BACK_W);
  switch (d) {
    case 'torches':
      for (let k = 0; k < 5; k++) torch(p, (k / 5) * BACK_W + 20, HZ - 30);
      break;
    case 'banners':
      for (let k = 0; k < 3; k++) {
        const x = (k / 3) * BACK_W + 52;
        const c = ['#8a1e2a', '#2a3a7a', '#1e5a3a'][(seed + k) % 3];
        const top = HZ - 62;
        rect(p, x - 9, top - 2, 18, 2, '#3a2a1e');
        for (let i = 0; i < 36; i++) {
          rect(p, x - 7, top + i, 7, 1, shade(c, 0.1));
          rect(p, x, top + i, 7, 1, shade(c, -0.12));
          // (a swallowtail cut in its foot)
          if (i > 30) rect(p, x - (i - 30), top + i, (i - 30) * 2, 1, shade(s.wallA, -0.35));
        }
        oval(p, x, top + 16, 4, 5, '#d8b040');
        oval(p, x, top + 16, 2, 3, c);
        rect(p, x - 7, top + 2, 14, 1, '#d8b040');
      }
      break;
    case 'chains':
      for (let k = 0; k < 4; k++) {
        const x = n(k);
        const len = 30 + hash(seed, k, 610) * 60;
        for (let i = 0; i < len; i += 2) frect(p, x - (i % 4 ? 0.5 : 0), i, i % 4 ? 1.5 : 0.5, 2, i % 4 ? '#5a5a62' : '#8a8a92');
        oval(p, x, len + 2, 2, 2, '#4a4a52');
        oval(p, x, len + 2, 1, 1, shade(s.wallA, -0.2));
      }
      break;
    case 'windows':
      for (let k = 0; k < 2; k++) {
        const x = (k / 2) * BACK_W + 100;
        const y = HZ - 56;
        rect(p, x - 6, y, 12, 22, '#0e1428');
        oval(p, x, y, 6, 5, '#0e1428');
        oval(p, x + 2, y + 3, 1.5, 1.5, '#e8eef8');
        for (let i = -4; i <= 4; i += 4) rect(p, x + i, y - 4, 1, 26, '#4a4a52');
        alpha(p, 0.07, () => {
          for (let i = 0; i < 60; i++) rect(p, x - 6 + i * 0.45, y + 22 + i, 12, 1, '#c8d8ff');
        });
      }
      break;
    case 'alcoves':
      for (let k = 0; k < 5; k++) {
        const x = (k / 5) * BACK_W + 32;
        for (const y of [HZ - 14, HZ - 40]) {
          rect(p, x - 8, y - 10, 16, 12, '#141210');
          oval(p, x, y - 10, 8, 4, '#141210');
          for (let j = 0; j < 3; j++) {
            const sx = x - 5 + j * 5;
            oval(p, sx, y - 2, 2, 1.8, '#d8d0b8');
            p.fpx(mod(sx - 1), y - 2.5, '#141210');
            p.fpx(mod(sx + 0.5), y - 2.5, '#141210');
          }
          if (k % 2) prop(p, 'candles', x + 6, y + 2, 0.5, seed + k);
        }
      }
      break;
    case 'cobwebs':
      for (let k = 0; k < 6; k++) {
        const x = n(k);
        const y = HZ - 40 - hash(seed, k, 620) * 120;
        alpha(p, 0.45, () => {
          for (let a = 0; a < 8; a++) line(p, x, y, x + Math.cos((a / 8) * Math.PI * 2) * 12, y + Math.sin((a / 8) * Math.PI * 2) * 10, '#c8c8c0');
          for (let r = 3; r < 12; r += 3)
            for (let a = 0; a < 32; a++) p.fpx(mod(x + Math.cos((a / 32) * Math.PI * 2) * r), y + Math.sin((a / 32) * Math.PI * 2) * r * 0.85, '#d8d8d0');
        });
      }
      break;
    case 'roots':
      for (let k = 0; k < 8; k++) {
        let x = n(k);
        const len = 40 + hash(seed, k, 630) * 80;
        for (let i = 0; i < len; i++) {
          frect(p, x, i, i < len * 0.3 ? 1.5 : 1, 1, i % 5 ? '#4a3626' : '#5e4632');
          x += Math.sin(i / 7 + k) * 0.4;
        }
      }
      break;
    case 'portholes':
      for (let k = 0; k < 4; k++) {
        const x = (k / 4) * BACK_W + 40;
        const y = HZ - 36;
        oval(p, x, y, 8, 8, '#b08a40');
        oval(p, x, y, 6, 6, '#2a5a6a');
        oval(p, x, y + 2, 6, 3, '#1e4a5a');
        oval(p, x - 2, y - 2, 2, 1.5, '#a8e0e8');
        for (let a = 0; a < 6; a++) p.fpx(mod(x + Math.cos(a) * 7), y + Math.sin(a) * 7, '#e0c070');
        alpha(p, 0.06, () => {
          for (let i = 0; i < 60; i++) rect(p, x - 6 + i * 0.3, y + 6 + i, 12, 1, '#c8f0f8');
        });
      }
      break;
    case 'lanterns':
      for (let k = 0; k < 4; k++) {
        const x = (k / 4) * BACK_W + 80;
        const y = HZ - 44;
        line(p, x, 0, x, y - 4, '#2a2420');
        glow(p, x, y, 24, '#ffd080', 0.06);
        rect(p, x - 2, y - 4, 4, 1, '#2a2420');
        rect(p, x - 2, y - 3, 4, 5, '#ffd070');
        rect(p, x - 2, y - 3, 1, 5, '#3a3028');
        rect(p, x + 1, y - 3, 1, 5, '#3a3028');
        rect(p, x - 2, y + 2, 4, 1, '#2a2420');
      }
      break;
    case 'pipes':
      for (const y of [HZ - 14, HZ - 50]) {
        p.rect(0, y, BACK_W, 4, '#6a6e74');
        p.rect(0, y, BACK_W, 1, '#9aa0a8');
        p.rect(0, y + 3, BACK_W, 1, '#3a3e44');
        for (let x = 0; x < BACK_W; x += 40) {
          rect(p, x, y - 1, 2, 6, '#4a4e54');
          if (x % 80 === 0) {
            oval(p, x + 20, y - 4, 3, 3, '#a03a2a');
            oval(p, x + 20, y - 4, 1, 1, '#4a1e18');
          }
        }
      }
      for (let k = 0; k < 3; k++) {
        const x = n(k);
        rect(p, x, HZ - 50, 3, 36, '#5a5e64');
        rect(p, x, HZ - 50, 1, 36, '#8a9098');
      }
      break;
    case 'lights':
      for (let k = 0; k < 4; k++) {
        const x = (k / 4) * BACK_W + 30;
        const y = HZ - 30;
        rect(p, x - 8, y - 8, 16, 12, '#1e2226');
        rect(p, x - 6, y - 6, 8, 5, '#1a4a2a');
        for (let i = 0; i < 3; i++) frect(p, x - 5, y - 5 + i * 1.5, 2 + hash(seed, k, i) * 5, 0.5, '#5ae08a');
        for (let i = 0; i < 3; i++) {
          const c = ['#ff4a3a', '#5ae07a', '#f0c040'][(k + i) % 3];
          oval(p, x + 5, y - 5 + i * 3, 0.8, 0.8, c);
          glow(p, x + 5, y - 5 + i * 3, 3, c, 0.12);
        }
        // and a caged lamp above
        glow(p, x + 20, HZ - 52, 30, '#f0f0c0', 0.05);
        rect(p, x + 17, HZ - 54, 6, 4, '#e8e8c0');
        for (let i = 0; i < 3; i++) frect(p, x + 17 + i * 2.5, HZ - 55, 0.5, 6, '#3a3a3a');
      }
      break;
    case 'signs':
      for (let k = 0; k < 2; k++) {
        const x = n(k + 7);
        const y = HZ - 20;
        for (let i = 0; i < 8; i++) rect(p, x - i / 2, y - 8 + i, i + 1, 1, '#e8c030');
        rect(p, x, y - 5, 1, 3, '#1e1e20');
        p.fpx(mod(x), y - 1, '#1e1e20');
      }
      break;
    case 'furnaces':
      for (let k = 0; k < 3; k++) {
        const x = (k / 3) * BACK_W + 50;
        glow(p, x, HZ - 6, 40, '#ff8a3a', 0.07);
        rect(p, x - 14, HZ - 34, 28, 34, '#4a2a22');
        rect(p, x - 14, HZ - 34, 28, 1, '#6a3a2a');
        for (let i = 0; i < 16; i++) {
          const half = Math.round(9 * Math.sqrt(Math.max(0, 1 - ((16 - i) / 16) ** 2)));
          rect(p, x - half, HZ - 20 + i, half * 2, 1, mixHex('#ffd070', '#c83a1a', i / 16));
        }
        for (let i = 0; i < 6; i++) rect(p, x - 10 + i * 4, HZ - 6, 2, 6, '#2a1a14');
        rect(p, x - 6, HZ - 60, 12, 26, '#3a2620');
      }
      break;
    case 'gears':
      for (let k = 0; k < 3; k++) {
        const x = n(k + 3);
        const y = HZ - 44 + hash(seed, k, 640) * 12;
        const r = 9 + hash(seed, k, 641) * 8;
        for (let a = 0; a < 16; a++) {
          const t = (a / 16) * Math.PI * 2;
          frect(p, x + Math.cos(t) * r - 1, y + Math.sin(t) * r - 1, 2.5, 2.5, '#7a6a52');
        }
        oval(p, x, y, r, r, '#6a5a44');
        oval(p, x, y, r * 0.65, r * 0.65, shade(s.wallA, -0.2));
        for (let a = 0; a < 4; a++) line(p, x, y, x + Math.cos(a * 1.57) * r * 0.7, y + Math.sin(a * 1.57) * r * 0.7, '#6a5a44', 1);
        oval(p, x, y, 2, 2, '#9a8a6a');
      }
      break;
    case 'lavafalls':
      for (let k = 0; k < 3; k++) {
        const x = n(k + 11);
        glow(p, x, HZ - 40, 36, '#ff6a1a', 0.07);
        for (let y = 20; y < HZ + 6; y++) {
          const w = 3 + Math.sin(y / 6 + k) * 1;
          frect(p, x - w / 2, y, w, 1, y % 4 ? '#ff7a2a' : '#ffb040');
          frect(p, x - 0.5, y, 1, 1, '#ffe080');
        }
        oval(p, x, HZ + 6, 10, 2, '#ff8a2a');
      }
      break;
    case 'crystals':
      for (let k = 0; k < 10; k++) {
        const cx = Math.floor(hash(seed, k, 73) * BACK_W);
        const cy = HZ - 8 - Math.floor(hash(seed, k, 74) ** 1.5 * (HZ - 30));
        const c = ['#7ad8e8', '#b07ae8', '#7ae8a0'][k % 3];
        glow(p, cx, cy - 3, 10, c, 0.06);
        for (let j = 0; j < 3; j++) {
          const x = cx + (j - 1) * 3;
          const h = 4 + Math.floor(hash(seed, k * 3 + j, 75) * 6);
          for (let i = 0; i < h; i++) {
            const w = Math.max(1, Math.round((1 - i / h) * 2.5));
            rect(p, x + (j - 1) * Math.floor(i / 4), cy - i, w, 1, i >= h - 1 ? '#ffffff' : i % 3 === 0 ? mixHex(c, '#ffffff', 0.35) : c);
          }
        }
      }
      break;
  }
}

/* ------------------------------------------------------------ inside: columns and the roof */

function indoorMid(p: Painter, s: Indoor, seed: number): void {
  const lit = shade(s.wallB, 0.15);
  const mid = s.wallA;
  const dark = shade(s.wallA, -0.45);
  switch (s.columns) {
    case 'cavecols':
      for (let k = 0; k < 5; k++) {
        const x = Math.floor(hash(seed, k, 110) * BACK_W);
        const w = 12 + Math.floor(hash(seed, k, 111) * 12);
        for (let y = 0; y < HZ + 6; y++) {
          const waist = Math.abs(y - HZ * 0.55) / (HZ * 0.55);
          const ww = Math.round(w * (0.55 + 0.6 * waist ** 2) + Math.sin(y / 9 + k) * 1.5);
          rect(p, x - ww / 2, y, ww, 1, mixHex(mid, dark, 0.2));
          rect(p, x - ww / 2, y, 2, 1, lit);
          rect(p, x + ww / 2 - 3, y, 3, 1, dark);
        }
      }
      break;
    case 'pillars':
    case 'arches': {
      const step = 80;
      for (let x = 40; x < BACK_W + 40; x += step) {
        const w = 14;
        for (let y = 0; y < HZ + 4; y++) {
          rect(p, x - w / 2, y, w, 1, y % 12 === 0 ? shade(mid, -0.2) : mid);
          rect(p, x - w / 2, y, 2, 1, lit);
          rect(p, x + w / 2 - 3, y, 3, 1, dark);
        }
        rect(p, x - w / 2 - 2, HZ - 2, w + 4, 6, mid);
        rect(p, x - w / 2 - 2, HZ - 2, w + 4, 1, lit);
        rect(p, x - w / 2 - 2, HZ - 54, w + 4, 4, mid);
        rect(p, x - w / 2 - 2, HZ - 54, w + 4, 1, lit);
        if (s.columns === 'arches') {
          // (an arch from this pillar's head to the next)
          for (let a = 0; a <= 60; a++) {
            const t = (a / 60) * Math.PI;
            const ax = x + step / 2 - Math.cos(t) * (step / 2);
            const ay = HZ - 54 - Math.sin(t) * 26;
            frect(p, ax - 1, ay - 3, 3, 4, a % 6 ? mid : shade(mid, -0.2));
            frect(p, ax - 1, ay - 3, 3, 1, lit);
          }
        }
      }
      break;
    }
    case 'ribs':
      for (let x = 20; x < BACK_W; x += 40) {
        for (let y = 20; y < HZ + 4; y++) {
          const bow = Math.max(0, (60 - y) / 60) ** 2 * 10;
          rect(p, x - 2 + bow, y, 5, 1, '#5a3a22');
          rect(p, x - 2 + bow, y, 1, 1, '#7a5432');
          rect(p, x + 2 + bow, y, 1, 1, '#3a2414');
        }
      }
      break;
    case 'girders':
      for (let x = 32; x < BACK_W; x += 64) {
        rect(p, x - 4, 0, 8, HZ + 4, '#4a4e56');
        rect(p, x - 4, 0, 1, HZ + 4, '#7a808a');
        rect(p, x + 3, 0, 1, HZ + 4, '#2a2e34');
        rect(p, x - 1, 0, 2, HZ + 4, '#3a3e46');
        for (let y = 6; y < HZ; y += 14) {
          p.fpx(mod(x - 3), y, '#9aa0a8');
          p.fpx(mod(x + 2.5), y, '#9aa0a8');
        }
        line(p, x + 4, HZ - 60, x + 28, HZ - 100, '#4a4e56', 1.5);
        line(p, x + 4, HZ - 100, x + 28, HZ - 60, '#3e424a', 1);
      }
      break;
  }
  switch (s.ceiling) {
    case 'stalactites': {
      const spike = (x: number, from: number, len: number, w: number, down: boolean) => {
        for (let i = 0; i < len; i++) {
          const ww = Math.max(1, Math.round(w * (1 - i / len) ** 0.8));
          const y = down ? from + i : from - i;
          rect(p, x - ww / 2, y, ww, 1, mid);
          if (ww > 2) rect(p, x - ww / 2, y, 1, 1, lit);
          rect(p, x + ww / 2 - 1, y, 1, 1, dark);
        }
      };
      for (let k = 0; k < 22; k++) {
        const x = Math.floor(hash(seed, k, 112) * BACK_W);
        const len = 14 + Math.floor(hash(seed, k, 113) ** 1.8 * (HZ - 50));
        spike(x, 0, len, 4 + Math.floor(hash(seed, k, 114) * 8), true);
        p.px(x, len + 1, '#8ad0f0');
      }
      for (let k = 0; k < 12; k++) spike(Math.floor(hash(seed, k, 115) * BACK_W), HZ + 5, 8 + Math.floor(hash(seed, k, 116) * 22), 5 + Math.floor(hash(seed, k, 117) * 7), false);
      break;
    }
    case 'beams':
      for (const y of [8, 40]) {
        p.rect(0, y, BACK_W, 6, '#4a3020');
        p.rect(0, y, BACK_W, 1, '#6a4a30');
        p.rect(0, y + 5, BACK_W, 1, '#2a1a10');
      }
      for (let x = 10; x < BACK_W; x += 40) line(p, x, 46, x + 14, 62, '#4a3020', 1.5);
      break;
    case 'pipes':
      for (const [y, c] of [[6, '#6a6e74'], [14, '#7a5a3a'], [22, '#5a6a5a']] as const) {
        p.rect(0, y, BACK_W, 5, c);
        p.rect(0, y, BACK_W, 1, shade(c, 0.3));
        p.rect(0, y + 4, BACK_W, 1, shade(c, -0.35));
        for (let x = 0; x < BACK_W; x += 32) rect(p, x, y - 1, 2, 7, shade(c, -0.25));
      }
      break;
  }
}

/* ------------------------------------------------------------ inside: the floor */

function indoorFloor(p: Painter, s: Indoor, seed: number, set: SpriteSet): void {
  const { floorA: a, floorB: b } = s;
  const H = BACK_H - HZ;
  for (let y = HZ; y < BACK_H; y++) p.rect(0, y, BACK_W, 1, mixHex(shade(a, -0.15), b, ((y - HZ) / H) ** 0.7));
  if (s.floor === 'flagstones' || s.floor === 'grating' || s.floor === 'lava') {
    // rows of stones (or plates), deeper and wider as they come nearer
    let y = HZ;
    let r = 0;
    while (y < BACK_H) {
      const h = 3 + Math.floor((y - HZ) / 10);
      const count = Math.max(4, Math.round(BACK_W / (10 + (y - HZ) / 2.5)));
      const w = BACK_W / count;
      for (let i = 0; i < count; i++) {
        const x = i * w + (r % 2 ? w / 2 : 0);
        const c = mixHex(a, b, 0.3 + hash(seed, i, r + 700) * 0.4 + ((y - HZ) / H) * 0.3);
        frect(p, x + 0.5, y + 0.5, w - 1, h - 1, c);
        frect(p, x + 0.5, y + 0.5, w - 1, 0.5, shade(c, 0.15));
        if (s.floor === 'grating' && h > 4) for (let gx = 1.5; gx < w - 1; gx += 1.5) for (let gy = 1.5; gy < h - 1; gy += 1.5) p.fpx(mod(x + gx), y + gy, shade(c, -0.35));
        if (s.floor === 'lava') {
          if (hash(seed, i, r + 701) < 0.3) frect(p, x + w * 0.2, y, w * 0.6, 0.5, hash(seed, i, r + 704) < 0.5 ? '#ff7a2a' : '#a8341a');
          if (hash(seed, i, r + 702) < 0.2) glow(p, x + w / 2, y, 6, '#ff6a1a', 0.07);
        } else if (hash(seed, i, r + 703) < 0.12) line(p, x + 2, y + 1, x + w * 0.6, y + h - 1, shade(c, -0.3));
      }
      y += h;
      r++;
    }
    if (s.floor === 'lava')
      for (let k = 0; k < 4; k++) {
        const x = Math.floor(hash(seed, k, 710) * BACK_W);
        const yy = HZ + 14 + Math.floor(hash(seed, k, 711) * 80);
        glow(p, x, yy, 22, '#ff6a1a', 0.08);
        oval(p, x, yy, 12 + k * 2, 3 + k * 0.4, '#c8401a');
        oval(p, x, yy, 9 + k * 2, 2 + k * 0.4, '#ff8a2a');
        oval(p, x - 2, yy, 4, 1, '#ffd070');
      }
  } else if (s.floor === 'planks') {
    let y = HZ;
    let r = 0;
    while (y < BACK_H) {
      const h = 2 + Math.floor((y - HZ) / 14);
      const c = mixHex(a, b, hash(seed, r, 720) * 0.5 + ((y - HZ) / H) * 0.4);
      p.rect(0, y, BACK_W, h, c);
      p.rect(0, y, BACK_W, 1, shade(c, -0.35));
      for (let k = 0; k < 3; k++) {
        const jx = Math.floor(hash(seed, r, 721 + k) * BACK_W);
        rect(p, jx, y, 1, h, shade(c, -0.4));
        if (h > 3) {
          p.fpx(mod(jx - 1), y + 1, '#2a2420');
          p.fpx(mod(jx + 1.5), y + 1, '#2a2420');
        }
      }
      y += h;
      r++;
    }
  } else if (s.floor === 'concrete') {
    for (let k = 0; k < 20; k++) {
      let x = hash(seed, k, 730) * BACK_W;
      let y = HZ + 4 + hash(seed, k, 731) * (H - 8);
      for (let i = 0; i < 14; i++) {
        p.fpx(mod(x), y, shade(b, -0.4));
        x += 0.8;
        y += hash(seed, k * 30 + i, 732) - 0.5;
      }
    }
    for (let x = 0; x < BACK_W; x += 12) rect(p, x, HZ + 50, 7, 1, '#c8a830');
    for (let k = 0; k < 6; k++) alpha(p, 0.3, () => oval(p, hash(seed, k, 733) * BACK_W, HZ + 10 + hash(seed, k, 734) * 90, 10 + k * 2, 2 + k * 0.4, shade(b, -0.3)));
  } else {
    // rough stone: blotches and cracks
    for (const bl of scatter(seed + 120, 90, HZ + 2, BACK_H, 0.9)) {
      const rx = 4 + bl.t * 16 + bl.d * 6;
      oval(p, bl.x, bl.y, rx, rx * (0.18 + bl.t * 0.12), bl.d < 0.5 ? shade(b, -0.3) : shade(a, 0.05));
    }
    for (let k = 0; k < 24; k++) {
      let x = hash(seed, k, 180) * BACK_W;
      let y = HZ + 4 + hash(seed, k, 181) * (H - 8);
      for (let i = 0; i < 14; i++) {
        p.fpx(mod(x), y, '#141018');
        x += 0.8;
        y += hash(seed, k * 30 + i, 182) - 0.5;
      }
    }
  }
  props(p, s.props, seed, set, 36);
}
