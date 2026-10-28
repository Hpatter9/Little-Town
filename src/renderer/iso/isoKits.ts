// Which piece of a people's isometric building kit (art/iso/kits/: see its README.md) stands for each of the game's
// buildings and grounds. Pure (no Pixi, no page): the tests check every kit has what this asks of it.
//
// The kits' indexes are small and imported here; their PNGs are not (the web build would inline them all, megabytes):
// iso/isoView.ts loads each by URL (`kitUrl`), and the build copies the folder beside the strip (build.mjs).

import kitsJson from '../art/iso/kits/kits.json';
import settlers from '../art/iso/kits/settlers/index.json';
import knights from '../art/iso/kits/knights/index.json';
import dwarves from '../art/iso/kits/dwarves/index.json';
import bloodcourt from '../art/iso/kits/bloodcourt/index.json';
import liches from '../art/iso/kits/liches/index.json';
import druids from '../art/iso/kits/druids/index.json';
import fae from '../art/iso/kits/fae/index.json';
import machines from '../art/iso/kits/machines/index.json';
import moonpack from '../art/iso/kits/moonpack/index.json';
import orcs from '../art/iso/kits/orcs/index.json';
import merfolk from '../art/iso/kits/merfolk/index.json';
import nomads from '../art/iso/kits/nomads/index.json';
import shared from '../art/iso/buildings/index.json';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { HERDS } from '../../shared/data/livestock';
import type { Ground } from '../../shared/sim/land';
import { kitTileCells } from './isoMath';
import { BIOME_GROUND, mulTint } from './isoTown';
import type { Biome } from '../../shared/data/biomes';

/** The kits are drawn at this much of their `scale` (the view's cells are half the size the kits were made for:
 *  iso/isoMath.ts `ISO_TW`). */
export const ISO_ART = 0.5;

export interface KitPiece {
  id: string;
  w: number;
  h: number;
}
export interface Kit {
  name: string;
  /** Draw its pieces at this (times `ISO_ART`), so every people's cottage is the same size. */
  scale: number;
  pieces: Map<string, KitPiece>;
  /** Its ground tiles in order: the open ground, the bare ground, the path, the field. */
  tiles: [string, string, string, string];
  /** How many cells across one of its ground tiles covers (from its `scale_tile`). */
  tileCells: number;
}

const INDEXES: Record<string, readonly KitPiece[]> = { settlers, knights, dwarves, bloodcourt, liches, druids, fae, machines, moonpack, orcs, merfolk, nomads };
const SCALES = kitsJson as Record<string, { scale: number }>;
export const KIT_NAMES = Object.keys(INDEXES);

/** Each people (the snapshot's `origin.id`) to its kit; the alchemists have none yet and borrow the settlers'. */
const KIT_OF_ORIGIN: Record<string, string> = {
  settlers: 'settlers',
  lich: 'liches',
  druid: 'druids',
  vampire: 'bloodcourt',
  werewolf: 'moonpack',
  robot: 'machines',
  dwarves: 'dwarves',
  merfolk: 'merfolk',
  nomads: 'nomads',
  fae: 'fae',
  alchemists: 'settlers',
  knights: 'knights',
  orcs: 'orcs',
};
/** The kit for a town: its people's (a lich's town is a necropolis whatever its people: the snapshot's theme). */
export const kitNameFor = (origin: string, theme?: string): string => (theme === 'lich' ? 'liches' : (KIT_OF_ORIGIN[origin] ?? 'settlers'));

const made = new Map<string, Kit>();
export function kitOf(name: string): Kit {
  const had = made.get(name);
  if (had) return had;
  const list = INDEXES[name] ?? INDEXES.settlers;
  const pieces = new Map(list.map((p) => [p.id, { id: p.id, w: p.w, h: p.h }]));
  const tiles = list.filter((p) => p.id.endsWith('_tile') && p.id !== 'scale_tile').map((p) => p.id);
  const scale = SCALES[name]?.scale ?? 1;
  const kit: Kit = {
    name,
    scale,
    pieces,
    tiles: [tiles[0], tiles[1] ?? tiles[0], tiles[2] ?? tiles[0], tiles[3] ?? tiles[0]],
    tileCells: kitTileCells(pieces.get('scale_tile')?.w ?? 96, scale, ISO_ART),
  };
  made.set(name, kit);
  return kit;
}

/** The wall, gate and fence pieces drawn lying along y (up-right on the screen) where the rest of the kits' runs lie
 *  along x (down-right), measured from the pictures: drawn along x they're mirrored, and along y as they are. */
export const ALONG_Y: ReadonlySet<string> = new Set([
  'settlers/stone_wall_run',
  'settlers/stone_gate',
  'knights/stone_wall_run',
  'settlers/fence',
  'bloodcourt/iron_fence',
  'druids/wattle_fence',
  'druids/wattle_fence_b',
  'fae/twig_fence',
  'knights/iron_fence',
  'merfolk/net_fence',
  'moonpack/bone_fence',
  'nomads/rope_fence',
  'orcs/stake_fence',
]);
/** Whether a kit's piece lies along y (`ALONG_Y`). */
export const liesAlongY = (kit: string, piece: string): boolean => ALONG_Y.has(`${kit}/${piece}`);

/** A building's own piece drawn for every people (art/iso/buildings/: a statue, a green, a jetty, the late machines),
 *  used where a people's kit has none of that name. `soil`: px of soil or water under the ground at its foot, cut off
 *  so it sits on the ground; `along_y`: its long side lies along y, as `ALONG_Y`. */
export interface SharedPiece extends KitPiece {
  soil?: number;
  along_y?: boolean;
}
export const SHARED_PIECES: ReadonlyMap<string, SharedPiece> = new Map((shared as SharedPiece[]).map((p) => [p.id, p]));
/** The shared piece a kit draws for this piece's name, if it has none of its own (a kit not among the peoples', the
 *  land's `wild/`, keeps its own). */
export const sharedPiece = (kit: string, piece: string): SharedPiece | undefined =>
  INDEXES[kit] && !INDEXES[kit].some((p) => p.id === piece) ? SHARED_PIECES.get(piece) : undefined;

/** Where a kit's piece is served (beside the strip page: build.mjs copies the folders), a shared piece from its own. */
export const kitUrl = (kit: string, piece: string): string => (sharedPiece(kit, piece) ? `iso/buildings/${piece}.png` : `iso/kits/${kit}/${piece}.png`);

/** The parts a building can be drawn as. */
export type Role = 'cottage' | 'longhouse' | 'stockpile' | 'workshop' | 'tavern' | 'well' | 'chapel' | 'granary' | 'watchtower' | 'trap' | 'hearth' | 'pen' | 'wall_run' | 'wall_corner' | 'gate' | 'market' | 'stockade';
/** A building drawn as ground, not a picture: a crop's field (the kit's field tile over its footprint). */
export type Drawn = { role: Role } | { field: true };

/** The game's buildings by name: anything not here is worked out by `roleOf`'s rules, and falls back to a cottage. */
const ROLES: Record<string, Role> = {
  stockpile: 'stockpile',
  campfire: 'hearth',
  longhouse: 'longhouse',
  elder_lodge: 'longhouse',
  town_hall: 'longhouse',
  trophy_hall: 'longhouse',
  barracks: 'longhouse',
  well: 'well',
  granary: 'granary',
  tavern: 'tavern',
  fireside_inn: 'tavern',
  brewery: 'tavern',
  grog_pit: 'tavern',
  market: 'market',
  trading_post: 'market',
  graveyard: 'chapel',
};

/** What a building of this kind is drawn as. */
export function roleOf(defId: string): Drawn {
  if (CROPS[defId] || HERDS[defId]) return { field: true };
  const named = ROLES[defId];
  if (named) return { role: named };
  const def = BUILDING_BY_ID[defId];
  if (/_gate$/.test(defId)) return { role: 'gate' };
  // (the prisoners' stockade: a square of the kit's wall round its footprint, its gate in front: iso/isoTown.ts `penSides`)
  if (defId === 'stockade') return { role: 'stockade' };
  if (/_(wall|grate)$/.test(defId) || defId === 'wagon_circle') return { role: 'wall_run' };
  if (/tower|lookout|perch|spire|mast/.test(defId)) return { role: 'watchtower' };
  // (the defences: a trap is a patch of rough ground, a turret or engine a small tower, not a cottage)
  if (/trap|snare|caltrops|boiling_oil|glamour_ring/.test(defId)) return { role: 'trap' };
  if (/turret|ballista|catapult|cannon|mortar|tesla|gun_nest|bastion|thrower|sprayer|arrow_wagon|militia_post|sentry_bot/.test(defId)) return { role: 'watchtower' };
  // (a gathering round a fire, and the pens for beasts: the kit's own fire or pen where it has one)
  if (/storyteller/.test(defId)) return { role: 'hearth' };
  if (/^(kennels|beast_ranch|creature_pen|stable)$/.test(defId)) return { role: 'pen' };
  // (the halls of learning, healing and show are halls)
  if (/^(school|scriptorium|library|university|arcane_academy|arcane_library|hospital|infirmary|trauma_center|theatre|cinema|bathhouse|gaol|prison|monster_guild|print_shop)$/.test(defId)) return { role: 'longhouse' };
  if (/shrine|temple|cathedral|chapel|altar|idol/.test(defId)) return { role: 'chapel' };
  if (/^seat_/.test(defId)) return { role: 'longhouse' };
  if (def?.floor?.venue === 'tavern') return { role: 'tavern' };
  if (def?.floor?.venue === 'shop') return { role: 'market' };
  if (def?.housing) return { role: def.housing >= 3 && def.width >= 4 ? 'longhouse' : 'cottage' };
  if (def?.storage) return { role: 'stockpile' };
  if (/smith|forge|mill|works|kiln|bench|rack|loom|tannery|bakery|foundry|plant|factory|workshop|mine|refinery|lab|press|carver|cooper|apothecary|chandlery|alembic|assembler|armourer|jeweller|tailor|basketry|smokehouse|cannery|fab|derrick|garage|station|reactor|cutter|pelt|bloomery|quarry/.test(defId))
    return { role: 'workshop' };
  return { role: 'cottage' };
}

/** Each part's pieces to look for in a kit, in order (the kits name some of theirs their own way). */
const ROLE_PIECES: Record<Role, (ids: string[]) => string | undefined> = {
  cottage: () => 'cottage',
  longhouse: (ids) => ids.find((i) => i === 'longhouse' || i === 'great_hall'),
  stockpile: (ids) => ids.find((i) => i === 'stockpile'),
  workshop: (ids) => ids.find((i) => i === 'workshop' || i === 'forge'),
  tavern: (ids) => ids.find((i) => i === 'tavern' || i === 'ale_hall'),
  well: (ids) => ids.find((i) => i === 'well'),
  chapel: (ids) => ids.find((i) => i === 'chapel' || i === 'shrine'),
  granary: (ids) => ids.find((i) => i === 'granary'),
  watchtower: (ids) => ids.find((i) => /tower|platform/.test(i)),
  hearth: (ids) => ids.find((i) => /campfire|bonfire|brazier|stone_circle|fairy_ring/.test(i)) ?? ids.find((i) => /_fire$/.test(i)),
  pen: (ids) => ids.find((i) => /(^|_)(pen|corral|stable)$/.test(i)),
  trap: (ids) => ids.find((i) => /spike|stake|thorn|bramble/.test(i) && !/_(run|corner|gate|tile)$|fence/.test(i)) ?? ids.find((i) => /rocks/.test(i)) ?? ids.find((i) => /rubble|boulder|scrap_heap/.test(i)),
  wall_run: (ids) => ids.find((i) => i.endsWith('_run')),
  stockade: (ids) => ids.find((i) => i.endsWith('_gate')) ?? ids.find((i) => i.endsWith('_run')),
  wall_corner: (ids) => ids.find((i) => i.endsWith('_corner')),
  gate: (ids) => ids.find((i) => i.endsWith('_gate') || i === 'gatehouse'),
  market: (ids) => ids.find((i) => i === 'market_stall' || i.endsWith('_stall')) ?? ids.find((i) => i === 'workshop'),
};

/** The piece of a kit a building is drawn with: a piece named as the building itself if the kit has one (the knights'
 *  `barracks`, the dwarves' `quarry`), else the shared piece of its name (`SHARED_PIECES`), else its part's, else the
 *  cottage. */
export function pieceFor(kit: Kit, defId: string): string {
  if (kit.pieces.has(defId) && !defId.endsWith('_tile')) return defId;
  if (SHARED_PIECES.has(defId)) return defId;
  const d = roleOf(defId);
  if ('field' in d) return kit.tiles[3];
  const ids = [...kit.pieces.keys()];
  return ROLE_PIECES[d.role](ids) ?? 'cottage';
}

/** Walls and gates are fitted to their footprint (a run of the kit's is drawn for a wider stretch than one cell). */
export const fitted = (defId: string): boolean => {
  const d = roleOf(defId);
  return 'role' in d && (d.role === 'wall_run' || d.role === 'wall_corner' || d.role === 'gate' || d.role === 'stockade');
};

/** Which of a kit's ground tiles a cell is drawn with (0 open, 1 bare, 2 path, 3 field), and a tint for the grounds
 *  the kits have no tile of (water, for now, is the bare tile tinted blue). */
export function groundTile(g: Ground, road: boolean, field: boolean, biome?: Biome): { tile: 0 | 1 | 2 | 3; tint: number } {
  const t = baseTile(g, road, field);
  const b = biome && BIOME_GROUND[biome];
  // (the biome sets the open ground's look: snow, sand, swamp; water, stone and paths keep theirs)
  if (!b || road || field || t.tile > 1 || g === 'water' || g === 'shallows' || g === 'rock' || g === 'mountain') return t;
  return { tile: t.tile === 1 && g !== 'sand' ? 1 : b.tile, tint: mulTint(t.tint, b.tint) };
}

function baseTile(g: Ground, road: boolean, field: boolean): { tile: 0 | 1 | 2 | 3; tint: number } {
  if (field) return { tile: 3, tint: 0xffffff };
  if (road) return { tile: 2, tint: 0xffffff };
  switch (g) {
    case 'water':
      return { tile: 1, tint: 0x4f7fc0 };
    case 'shallows':
      return { tile: 1, tint: 0x8fb4d8 };
    case 'rock':
    case 'mountain':
      return { tile: 1, tint: 0xb8b8b8 };
    case 'sand':
      return { tile: 1, tint: 0xf0e0b0 };
    case 'marsh':
      return { tile: 1, tint: 0xa0b890 };
    case 'forest':
      return { tile: 0, tint: 0xb8d0a8 };
    default:
      return { tile: 0, tint: 0xffffff };
  }
}
