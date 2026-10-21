// The iso town's small rules, pure (no Pixi, no page) so the tests can check them: which wall piece a wall cell is,
// which scenery stands on a wild cell, which prop stands beside a building, and how a land's biome tints its ground.
// iso/isoView.ts draws what these say.

import type { Biome } from '../../shared/data/biomes';
import type { Ground } from '../../shared/sim/land';
import type { Role } from './isoKits';

/** A cell's hash in 0..1, the same every run (the sim's rule: nothing here may vary between runs). */
export function cellHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(salt + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Which of a wall cell's four neighbours are wall too (e is +x, s is +y: on the screen e is down-right, s down-left). */
export interface WallMask {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}
export const wallMaskAt = (isWall: (x: number, y: number) => boolean, x: number, y: number): WallMask => ({ n: isWall(x, y - 1), e: isWall(x + 1, y), s: isWall(x, y + 1), w: isWall(x - 1, y) });

/** A wall cell's piece: a run (the kit's run lies along x, down-right; flipped it lies along y, down-left) or a corner
 *  (the kit's corner joins the neighbours at -x and -y, its point at the front; flipped for one joined at +x). A
 *  tee or a cross takes the corner too: the kits have no more pieces than these. */
export function wallShape(m: WallMask): { part: 'run' | 'corner'; flip: boolean } {
  const x = m.e || m.w;
  const y = m.n || m.s;
  if (x && y) return { part: 'corner', flip: m.e && !m.w };
  return { part: 'run', flip: y };
}

/** A gate lies along its long side: the kit's gate lies along x, so a gate taller than wide is flipped. */
export const gateFlip = (f: { w: number; h: number }): boolean => f.h > f.w;

/** Of a kit's wall pieces, the one made of what the wall is (a `stone_wall` takes the `stone_` run, a palisade the
 *  `palisade_` one), else the first. */
export function wallPieceFor(ids: readonly string[], part: 'run' | 'corner' | 'gate', defId: string): string | undefined {
  const mine = ids.filter((i) => (part === 'run' ? i.endsWith('_run') : part === 'corner' ? i.endsWith('_corner') : i.endsWith('_gate') || i === 'gatehouse'));
  const stuff = defId.split('_')[0];
  return mine.find((i) => i.startsWith(stuff)) ?? mine[0];
}

const TREE = /tree|oak|pine|acacia|shrub/;
const DEAD = /dead|burnt|gnarled|bare/;
const BUSH = /bush|shrub/;
/** Pieces that are not scenery whatever their name says (a `tree_gate`, a `pine_floor_tile`). */
const NOT_SCENERY = /_(gate|tile|run|corner|roof|floor)$|^gate/;
const ROCK = /rock|boulder/;

/** The scenery on a wild cell, from the kit's pieces (`ids`), or none: woods get trees (the odd bush), stone rocks,
 *  marsh and hills a bush now and then. A dry or cold land prefers a kit's dead or pine trees. */
export function sceneryFor(ids: readonly string[], g: Ground, biome: Biome | undefined, h: number, h2: number): string | null {
  const pick = (re: RegExp, prefer?: RegExp): string | undefined => {
    const all = ids.filter((i) => re.test(i) && !NOT_SCENERY.test(i));
    const pref = prefer ? all.filter((i) => prefer.test(i)) : [];
    const from = pref.length ? pref : all;
    return from.length ? from[Math.floor(h2 * from.length) % from.length] : undefined;
  };
  const dry = biome === 'desert' || biome === 'ashlands';
  const cold = biome === 'tundra' || biome === 'taiga';
  switch (g) {
    case 'forest':
      if (h < 0.1) return pick(BUSH) ?? pick(TREE) ?? null;
      return pick(TREE, dry ? DEAD : cold ? /pine/ : undefined) ?? pick(BUSH) ?? null;
    case 'rock':
      return h < 0.85 ? (pick(ROCK) ?? null) : null;
    case 'mountain':
      return h < 0.25 ? (pick(ROCK) ?? null) : null;
    case 'hill':
      return h < 0.3 ? (pick(ROCK) ?? null) : h < 0.55 ? (pick(BUSH) ?? null) : null;
    case 'marsh':
      return h < 0.4 ? (pick(BUSH) ?? null) : null;
    default:
      return null;
  }
}

/** The props a kind of building keeps beside it, in the order they are tried (a kit piece's name matches the regex). */
const PROPS: Partial<Record<Role, RegExp[]>> = {
  workshop: [/barrel/, /crate|ore_pile|ore_cart/, /woodpile|anvil/],
  stockpile: [/crate/, /barrel/, /cart/, /woodpile/],
  tavern: [/barrel/, /lamp|lantern|torch|brazier/],
  market: [/crate/, /cart/, /barrel/],
  granary: [/hay|meat_pile/, /cart/],
  cottage: [/woodpile/, /lamp|lantern|torch/, /barrel/],
  longhouse: [/lamp|lantern|torch|brazier/, /woodpile/],
  chapel: [/lamp|lantern|torch|brazier/],
  watchtower: [/barrel/],
};
const PROP_SHARE: Partial<Record<Role, number>> = { cottage: 0.5, longhouse: 0.6, chapel: 0.5, watchtower: 0.4 };

/** A prop for a building, picked from its id so it is the same every run: the kit's piece, and the spot in cells
 *  beside the footprint (the front-right or the front-left face), or none. */
export function propFor(ids: readonly string[], role: Role, id: number, f: { x: number; y: number; w: number; h: number }): { piece: string; x: number; y: number } | null {
  const want = PROPS[role];
  if (!want) return null;
  if (cellHash(id, 3, 11) >= (PROP_SHARE[role] ?? 0.85)) return null;
  const found = want.map((re) => ids.find((i) => re.test(i) && !i.endsWith('_tile'))).filter((i): i is string => !!i);
  if (!found.length) return null;
  const piece = found[Math.floor(cellHash(id, 5, 13) * found.length) % found.length];
  const along = 0.25 + cellHash(id, 7, 17) * 0.5;
  return cellHash(id, 9, 19) < 0.5 ? { piece, x: f.x + f.w + 0.45, y: f.y + f.h * along } : { piece, x: f.x + f.w * along, y: f.y + f.h + 0.45 };
}

/** A tint over a tint (each channel multiplied). */
export const mulTint = (a: number, b: number): number => {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** How a land's biome sets its open ground: the tile (0 open, 1 bare) and a tint on it. A land with no entry is the
 *  kit's own look (forest, coast). */
export const BIOME_GROUND: Partial<Record<Biome, { tile: 0 | 1; tint: number }>> = {
  desert: { tile: 1, tint: 0xf2dc9c },
  tundra: { tile: 1, tint: 0xe4ecf6 },
  taiga: { tile: 0, tint: 0xd4e2ee },
  swamp: { tile: 0, tint: 0x8aa078 },
  jungle: { tile: 0, tint: 0x78d070 },
  highlands: { tile: 0, tint: 0xc4bca8 },
  ashlands: { tile: 1, tint: 0x6e5e5c },
  steppe: { tile: 0, tint: 0xe0d888 },
};
