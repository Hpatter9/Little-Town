// Hand-made raid boards (the owner's ask: maps made by hand in the LDtk editor for the game's special places, the raid
// boards first). The boards are drawn in `maps/raid-boards.ldtk` (one level a board) and turned by
// `tools/ldtk-boards.mjs` into `data/raidBoards.ts`, which is what the game reads: the sim never parses LDtk. When the
// raiders come, a board that fits the town's land and the raid is picked from a side stream ('raidBoard', so the town's
// own stream is never drawn on) `HAND_BOARD_SHARE` of the time; otherwise, or when none fits, the board is cut from
// the land as it always was (tactics.ts `makeBoard`). The town's wall, its gate, towers and traps are laid on a
// hand-made board as on any other.
//
// The board's columns run from the raiders' edge (u 0) to the town's (u w-1), its rows across; the wall stands down
// column w-4 (tactics.ts `TOWN_ROWS`), its gate in the two middle rows.

import { RAID_BOARDS } from '../data/raidBoards';
import { RAID_KIND_BY_ID } from '../data/raids';
import type { Biome } from '../data/biomes';
import { Rng, hashSeed } from '../rng';
import type { Ground } from './land';
import type { GameState, Raid } from './state';

/** How often a raid that has a hand-made board to fit it is fought on one (the rest on the land's own). */
export const HAND_BOARD_SHARE = 0.75;

/** A tile's own look where its ground's doesn't say it (the iso view's kit tiles are tinted by it). */
export type TileLook = 'dirt' | 'field' | 'flag' | 'snow' | 'ice' | 'mud' | 'plank';

/** The grounds a board is drawn in: the char the data file writes, the LDtk value's identifier, the ground the rules
 *  see, its look, and its height where the Height layer leaves it empty. */
export const BOARD_GROUNDS: readonly { ch: string; id: string; g: Ground; h: number; look?: TileLook; road?: boolean }[] = [
  { ch: '.', id: 'grass', g: 'grass', h: 1 },
  { ch: ',', id: 'dirt', g: 'grass', h: 1, look: 'dirt' },
  { ch: 'F', id: 'field', g: 'fertile', h: 1, look: 'field' },
  { ch: 'f', id: 'forest', g: 'forest', h: 1 },
  { ch: 's', id: 'sand', g: 'sand', h: 1 },
  { ch: 'o', id: 'stone', g: 'rock', h: 1, look: 'flag' },
  { ch: '*', id: 'snow', g: 'grass', h: 1, look: 'snow' },
  // (ice and mud are slow going: two moves a tile, as a marsh)
  { ch: 'i', id: 'ice', g: 'marsh', h: 0, look: 'ice' },
  { ch: 'm', id: 'mud', g: 'marsh', h: 0, look: 'mud' },
  { ch: '~', id: 'shallows', g: 'shallows', h: 0 },
  { ch: 'W', id: 'water', g: 'water', h: 0 },
  { ch: '^', id: 'cliff', g: 'mountain', h: 6 },
  { ch: '=', id: 'road', g: 'grass', h: 1, road: true },
  { ch: '#', id: 'boardwalk', g: 'grass', h: 1, look: 'plank' },
];
export const GROUND_BY_CH: Readonly<Record<string, (typeof BOARD_GROUNDS)[number]>> = Object.fromEntries(BOARD_GROUNDS.map((x) => [x.ch, x]));

/** What stands on a tile: cover (stood in or behind), props (nobody crosses them), the town's deploy spots (its front
 *  and back lines) and the raiders' ways in. */
export const COVER_KINDS = ['tree', 'bush', 'log', 'fence', 'hay'] as const;
export const PROP_KINDS = ['rock', 'ruin', 'cart', 'barrels', 'crates', 'woodpile', 'well', 'ruins', 'boulder', 'statue', 'wagon', 'campfire', 'hut', 'mill'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];
export type PropKind = (typeof PROP_KINDS)[number];
export type BoardThing = CoverKind | PropKind | 'front' | 'back' | 'way1' | 'way2' | 'way3';

/** The iso kit's piece drawn for a prop or a low cover (the rest are drawn as the generated boards' are): the settlers'
 *  kit's, or `kit/piece` for another kit's (`wild/` is the packs' sprites the boards are dressed with). */
export const THING_PIECE: Partial<Record<BoardThing, string>> = {
  fence: 'fence',
  hay: 'hay_bales',
  ruin: 'stone_wall_run',
  cart: 'cart',
  barrels: 'barrels',
  crates: 'crates',
  woodpile: 'woodpile',
  well: 'well',
  ruins: 'wild/ruin_1',
  boulder: 'dwarves/boulders',
  statue: 'wild/statue',
  wagon: 'nomads/covered_wagon',
  campfire: 'campfire',
  hut: 'cottage',
  mill: 'wild/mill',
};

/** What a hand-made board is dressed with that has no bearing on the fight (the owner's ask: boards that look like
 *  places): nobody is slowed, stopped or hidden by it, and it's drawn low enough not to hide anyone standing there. */
export const DECOR_KINDS = ['grass', 'tallgrass', 'reeds', 'flowers', 'stump', 'branch', 'mushrooms', 'fern', 'pebbles', 'shrub', 'thorns', 'bones', 'skeleton', 'pillar', 'dune', 'drift', 'floe', 'snowrock'] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export interface RaidBoardDef {
  /** The LDtk level's identifier. */
  id: string;
  name: string;
  biomes: Biome[];
  /** Only these raid kinds (none: any), and never these. */
  raidKinds: string[];
  notRaidKinds: string[];
  w: number;
  h: number;
  /** A row a string, a char a tile (`BOARD_GROUNDS`). */
  ground: string[];
  /** A row a string: a digit the tile's height in steps, '.' its ground's own. */
  height: string[];
  /** [u, v, what]. */
  things: [number, number, BoardThing][];
  /** [u, v, what]: the dressing (none of it in the rules). */
  decor: [number, number, DecorKind][];
}

/** The boards a raid may be fought on: the town's land among the board's, the raid's kind allowed, the size the raid
 *  wants (a big raid's board is bigger: tactics.ts `BIG_W`). A chase is run over open ground, and a raid from the sea
 *  comes ashore where it lands: neither has one; nor has a town with the autopilot off (the tests' single mechanics). */
export function boardsFor(s: GameState, r: Raid, w: number, h: number): RaidBoardDef[] {
  if (!s.autopilot || r.chase || RAID_KIND_BY_ID[r.kind]?.fromSea) return [];
  const biome = s.biome ?? 'forest';
  return RAID_BOARDS.filter((b) => b.w === w && b.h === h && b.biomes.includes(biome) && (!b.raidKinds.length || b.raidKinds.includes(r.kind)) && !b.notRaidKinds.includes(r.kind));
}

/** For previews only (the `__raidBoard(id)` console hook, shared/simHost.ts): every raid's board this one, whatever
 *  the land and the dice ('land': always the land's own). Never set in play. */
export const boardPreview: { id?: string } = {};

/** The hand-made board this raid is fought on, or null for the land's own (`HAND_BOARD_SHARE` of the raids that have
 *  one to fit; the pick is the 'raidBoard' side stream's, by the town's seed and the tick the battle starts). */
export function pickBoard(s: GameState, r: Raid, w: number, h: number): RaidBoardDef | null {
  if (boardPreview.id === 'land') return null;
  const shown = boardPreview.id && !r.chase ? RAID_BOARDS.find((b) => b.id === boardPreview.id && b.w === w && b.h === h) : undefined;
  if (shown) return shown;
  const fit = boardsFor(s, r, w, h);
  if (!fit.length) return null;
  const rng = new Rng(hashSeed(`${s.seed}:raidBoard:${s.tick}`));
  if (rng.next() >= HAND_BOARD_SHARE) return null;
  return fit[rng.int(0, fit.length - 1)];
}

/** A board's ground and height at a tile. */
export function boardGround(b: RaidBoardDef, u: number, v: number): { g: Ground; h: number; look?: TileLook; road?: boolean } {
  const gr = GROUND_BY_CH[b.ground[v][u]] ?? BOARD_GROUNDS[0];
  const hc = b.height[v][u];
  return { g: gr.g, h: hc === '.' ? gr.h : Number(hc), look: gr.look, road: gr.road };
}
