// How the raid board is dressed in the iso look (the owner's ask: boards that look like places, like the town map):
// which way a wall or fence piece lies, the land's own trees, bushes and rocks from the iso kits, and the dressing
// (grass, reeds, stumps, drifts...) from the kits and the packs' sprites in `art/iso/kits/wild/`
// (tools/compose-board-wild.py). Pure: no Pixi, no page (tactics/tacticsView.ts draws it; the tests check it).

import type { Biome } from '../../shared/data/biomes';
import type { DecorKind } from '../../shared/sim/raidBoards';
import type { TacTile } from '../../shared/sim/tactics';

/** Which of a tile's four sides join a piece of the same run: n is -v, e +u, s +v, w -u. */
export interface Join {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

/** One piece drawn on a run's tile: `flip` mirrors the picture (a piece drawn lying along u, down-right on the screen,
 *  then lies along v, down-left, and the other way about); `half` draws only the half of the picture toward one
 *  neighbour ('a' the picture's left half, 'b' its right; mirrored, the left half falls on the right). */
export interface RunPart {
  flip: boolean;
  half?: 'a' | 'b';
}

/** The pieces a wall or fence tile is drawn with, by the neighbours it joins and the way its picture lies (`pic`: most
 *  kits' wall runs along u, their fences along v: iso/isoKits.ts `ALONG_Y`): a straight run lies along them, an end
 *  along the one it has, a corner or a tee is a half piece toward each, and a piece on its own lies along `lone`. */
export function runParts(j: Join, lone: 'u' | 'v', pic: 'u' | 'v' = 'u'): RunPart[] {
  const alongU = j.e || j.w;
  const alongV = j.n || j.s;
  if (!alongU && !alongV) return [{ flip: lone !== pic }];
  if (!alongV) return [{ flip: pic !== 'u' }];
  if (!alongU) return [{ flip: pic !== 'v' }];
  // (the picture's left half is toward the line's left end on the screen: -u along u, +v along v; mirrored, its right)
  const out: RunPart[] = [];
  for (const [side, axis, leftEnd] of [['w', 'u', true], ['e', 'u', false], ['n', 'v', false], ['s', 'v', true]] as const) {
    if (!j[side]) continue;
    const flip = axis !== pic;
    out.push({ flip, half: leftEnd !== flip ? 'a' : 'b' });
  }
  return out;
}

/** Whether a prop is a run (it joins its neighbours of the same piece): the fences and the fallen walls. */
export const isRunPiece = (piece: string): boolean => /fence|_run$/.test(piece);

/** A tile's run joins (the tiles beside it that `same` says carry the same run). */
export function joinOf(w: number, h: number, u: number, v: number, same: (u: number, v: number) => boolean): Join {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && same(x, y);
  return { n: at(u, v - 1), e: at(u + 1, v), s: at(u, v + 1), w: at(u - 1, v) };
}

/** A land's trees, bushes and rocks on the board, as `kit/piece` (the iso kits'): several of each, picked by the tile. */
export interface Flora {
  tree: string[];
  bush: string[];
  rock: string[];
}
export const FLORA: Record<Biome, Flora> = {
  forest: { tree: ['settlers/oak_tree', 'knights/oak_tree', 'druids/birch_tree', 'settlers/pine_tree', 'settlers/oak_tree'], bush: ['settlers/bush', 'druids/berry_bush', 'knights/bush'], rock: ['settlers/rocks', 'druids/mossy_rocks', 'dwarves/rocks_a'] },
  jungle: { tree: ['merfolk/palm_tree', 'merfolk/mangrove_tree', 'druids/great_oak', 'merfolk/palm_tree'], bush: ['druids/berry_bush', 'settlers/bush'], rock: ['druids/mossy_rocks', 'merfolk/sea_grass_rocks'] },
  taiga: { tree: ['settlers/pine_tree', 'moonpack/pine_tree', 'moonpack/small_pine', 'druids/birch_tree', 'knights/pine_tree'], bush: ['settlers/bush', 'moonpack/snowy_bush'], rock: ['moonpack/rocks_a', 'dwarves/rocks_b', 'settlers/rocks'] },
  steppe: { tree: ['nomads/acacia_tree', 'settlers/oak_tree', 'nomads/acacia_tree'], bush: ['nomads/dead_shrub', 'settlers/bush'], rock: ['nomads/red_rocks_small', 'settlers/rocks'] },
  highlands: { tree: ['settlers/pine_tree', 'druids/birch_tree', 'settlers/oak_tree', 'knights/pine_tree', 'dwarves/dead_pine'], bush: ['settlers/bush', 'knights/bush'], rock: ['dwarves/rocks_a', 'dwarves/rocks_b', 'settlers/rocks'] },
  desert: { tree: ['merfolk/palm_tree', 'nomads/acacia_tree'], bush: ['nomads/dead_shrub', 'nomads/tumbleweed'], rock: ['nomads/red_rocks', 'nomads/red_rocks_small'] },
  tundra: { tree: ['moonpack/snowy_pine', 'moonpack/snowy_pine', 'moonpack/bare_tree', 'moonpack/berry_pine'], bush: ['moonpack/snowy_bush'], rock: ['moonpack/rocks_a', 'moonpack/rocks_b', 'moonpack/rocks_c'] },
  coast: { tree: ['merfolk/palm_tree', 'settlers/pine_tree', 'settlers/oak_tree'], bush: ['settlers/bush', 'knights/bush'], rock: ['merfolk/sea_grass_rocks', 'settlers/rocks'] },
  swamp: { tree: ['merfolk/mangrove_tree', 'orcs/gnarled_tree', 'merfolk/mangrove_tree', 'liches/dead_oak'], bush: ['orcs/thorn_bush', 'druids/berry_bush'], rock: ['druids/mossy_rocks'] },
  ashlands: { tree: ['orcs/burnt_tree', 'bloodcourt/dead_oak', 'liches/dead_pine'], bush: ['orcs/thorn_bush', 'liches/thorn_bush'], rock: ['orcs/dark_rocks', 'orcs/dark_rocks_b'] },
};
/** In winter the green lands' trees and bushes stand in snow (the dry lands' don't). */
const WINTER: Flora = { tree: ['moonpack/snowy_pine', 'moonpack/bare_tree', 'moonpack/snowy_pine'], bush: ['moonpack/snowy_bush'], rock: ['moonpack/rocks_a', 'moonpack/rocks_c'] };
export function floraOf(biome: string, season: string): Flora {
  const own = FLORA[biome as Biome] ?? FLORA.forest;
  return season === 'winter' && biome !== 'desert' && biome !== 'ashlands' ? { ...WINTER, rock: own.rock } : own;
}

/** The dressing's pictures (`kit/piece`), how wide one is drawn (in tiles), and how many are strewn on the tile. A
 *  drift has none: the board paints it. */
export const DECOR_ART: Record<DecorKind, { pieces: string[]; wide: number; count?: number }> = {
  grass: { pieces: ['wild/grass_1', 'wild/grass_2', 'wild/grass_3'], wide: 0.14, count: 4 },
  tallgrass: { pieces: ['wild/tall_grass'], wide: 0.45 },
  reeds: { pieces: ['wild/reeds_1', 'wild/reeds_2'], wide: 0.55 },
  flowers: { pieces: ['wild/flowers_1', 'wild/flowers_2', 'wild/flowers_3', 'wild/flowers_4'], wide: 0.12, count: 5 },
  stump: { pieces: ['wild/stump_1', 'wild/stump_2', 'wild/stump_3'], wide: 0.34 },
  branch: { pieces: ['wild/branch'], wide: 0.55 },
  mushrooms: { pieces: ['wild/mushrooms_1', 'wild/mushrooms_2', 'wild/mushrooms_3'], wide: 0.24 },
  fern: { pieces: ['wild/fern'], wide: 0.4 },
  pebbles: { pieces: ['wild/pebbles_1', 'wild/pebbles_2'], wide: 0.24 },
  shrub: { pieces: ['wild/shrub_1', 'wild/shrub_2', 'wild/shrub_3'], wide: 0.42 },
  thorns: { pieces: ['wild/thorns_1', 'wild/thorns_2'], wide: 0.55 },
  bones: { pieces: ['wild/bones_1', 'wild/bones_2', 'wild/bones_3'], wide: 0.3 },
  skeleton: { pieces: ['wild/skeleton'], wide: 1.5 },
  pillar: { pieces: ['wild/pillar_1', 'wild/pillar_2', 'wild/pillar_3'], wide: 0.5 },
  dune: { pieces: ['wild/dune_1', 'wild/dune_2', 'wild/dune_3'], wide: 0.95 },
  drift: { pieces: [], wide: 0.8 },
  floe: { pieces: ['wild/floe_1', 'wild/floe_2'], wide: 0.6 },
  snowrock: { pieces: ['wild/snow_rock'], wide: 0.45 },
};
/** The tall ones are drawn smaller where someone could stand behind them (they never hide a fighter's body). */
export const DECOR_TALL: ReadonlySet<DecorKind> = new Set(['reeds', 'tallgrass', 'fern', 'thorns', 'shrub']);

/** A number in [0, 1) from a tile and a salt, the same every time (the board's looks never change between redraws). */
export function cellRoll(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const pickOf = <T>(list: readonly T[], x: number, y: number, salt: number): T => list[Math.floor(cellRoll(x, y, salt) * list.length) % list.length];

/** A generated board's dressing (the hand-made ones are dressed in LDtk): a little of the same strewn over its open
 *  ground by the land cell, so the two kinds of board look alike. None on a road, a wall, cover or a prop. */
export function generatedDecor(tile: TacTile, biome: string, wetBeside: boolean, treeBeside: boolean, season: string): DecorKind | undefined {
  if (tile.road || tile.block || tile.wall || tile.tree || tile.bush || tile.log || tile.trap !== undefined || tile.decor) return undefined;
  const r = cellRoll(tile.lx, tile.ly, 41);
  const k = cellRoll(tile.lx, tile.ly, 43);
  const cold = biome === 'tundra' || season === 'winter';
  const dry = biome === 'desert' || biome === 'ashlands';
  switch (tile.g) {
    case 'grass':
    case 'fertile':
    case 'forest':
      if (wetBeside && r < 0.45) return 'reeds';
      if (cold) return r < 0.12 ? 'drift' : r < 0.15 ? 'snowrock' : undefined;
      if (treeBeside && r < 0.18) return k < 0.5 ? 'stump' : k < 0.75 ? 'mushrooms' : 'fern';
      if (dry) return r < 0.08 ? (k < 0.7 ? 'shrub' : 'bones') : undefined;
      return r < 0.16 ? (k < 0.45 ? 'grass' : k < 0.75 ? 'flowers' : 'tallgrass') : r < 0.19 ? 'pebbles' : undefined;
    case 'marsh':
      return r < 0.3 ? (k < 0.7 ? 'reeds' : 'tallgrass') : undefined;
    case 'sand':
      return r < 0.1 ? (k < 0.5 ? 'dune' : k < 0.8 ? 'shrub' : 'bones') : undefined;
    case 'rock':
    case 'hill':
      return r < 0.12 ? (cold ? 'snowrock' : k < 0.7 ? 'pebbles' : 'shrub') : undefined;
    default:
      return undefined;
  }
}
