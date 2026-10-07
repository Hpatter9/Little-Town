// Class emblems (the owner's ask, after Baldur's Gate's class badges): every calling on the tree (data/paths.ts) has a
// badge of its own, drawn by renderer/art/emblems.ts: a shield in its base calling's colours, a glyph from the DawnLike
// item sheets (and the Magic Items pack), and its stage told by the rim and the device. Here are the colours and the
// glyphs; a node without a glyph of its own takes the nearest on its road.

import { lineage } from './paths';

export interface EmblemColours {
  /** The field, its shade, and a light for the chevron and the rim's glint. */
  fill: string;
  dark: string;
  light: string;
}
/** The eight base callings' colours. */
export const BASE_COLOURS: Record<string, EmblemColours> = {
  fighter: { fill: '#9b2f2a', dark: '#5c1814', light: '#e0705f' },
  guard: { fill: '#4a5a73', dark: '#263040', light: '#95a7c4' },
  scout: { fill: '#3f7a3a', dark: '#1f4420', light: '#86c56f' },
  rogue: { fill: '#4d3566', dark: '#281a38', light: '#9a78c2' },
  apprentice: { fill: '#2f5aa8', dark: '#182f5e', light: '#78a6ea' },
  acolyte: { fill: '#c99a3a', dark: '#7a5a16', light: '#f6dc8a' },
  wanderer: { fill: '#6b7f2f', dark: '#3a4716', light: '#b6cc62' },
  minstrel: { fill: '#b45a8a', dark: '#6a2f50', light: '#e59ac4' },
};

/** Glyph sheets (renderer/art/icons.ts SHEETS, 16px cells, 8 to a row but Magic's 9). */
export type GlyphSheet = 'ShortWep' | 'MedWep' | 'LongWep' | 'Wand' | 'Shield' | 'Hat' | 'Amulet' | 'Scroll' | 'Magic' | 'Tool' | 'Light' | 'Potion' | 'Ring' | 'Ammo' | 'Armor' | 'Book' | 'Music' | 'Money';
export type Glyph = [GlyphSheet, number];

/** Each node's composition: `behind` a pair of the cell crossed (one mirrored), `main` the device, `charge` a small
 *  thing in a corner. A node without one of them takes the nearest up its road (so a whole line shares its crossed
 *  pair); `null` leaves it out. Stage-3 roads add a gem, the ascended a crown. */
interface Compose {
  behind?: Glyph | null;
  main?: Glyph | null;
  charge?: Glyph | null;
}
const C: Record<string, Compose> = {
  // the Fighter's roads: crossed swords, then each road's own arms
  fighter: { behind: ['MedWep', 0], main: null },
  knight: { main: ['Shield', 2] },
  paladin: { main: ['Amulet', 4], charge: ['Shield', 3] },
  crusader: { main: ['LongWep', 48] },
  templar: { main: ['Shield', 4] },
  dragoon: { behind: ['LongWep', 6], main: ['Hat', 1] },
  wyvern_knight: { main: ['LongWep', 18] },
  lance_captain: { main: ['LongWep', 28], charge: ['Music', 40] },
  berserker: { behind: ['MedWep', 8], main: ['Hat', 5] },
  warlord: { main: ['Music', 40], charge: ['Hat', 26] },
  titan: { main: ['LongWep', 48] },
  warchief: { main: ['Hat', 5], charge: ['Music', 40] },
  blood_reaver: { main: ['Potion', 0], charge: ['ShortWep', 2] },
  blood_lord: { main: ['Amulet', 3] },
  gorefiend: { main: ['LongWep', 2] },
  // the Guard's roads: crossed spears
  guard: { behind: ['LongWep', 32], main: ['Shield', 0] },
  sentinel: { main: ['Shield', 5] },
  bulwark: { main: ['Shield', 4], charge: ['Armor', 56] },
  aegis: { main: ['Shield', 6] },
  colossus: { main: ['Armor', 56] },
  gatewarden: { main: ['Tool', 19], charge: ['Shield', 1] },
  ironwall: { main: ['Shield', 1] },
  shield_saint: { main: ['Shield', 3], charge: ['Amulet', 4] },
  spellsword: { behind: ['MedWep', 2], main: ['Wand', 2], charge: ['Potion', 10] },
  battlemage: { main: ['Wand', 26] },
  arcane_knight: { main: ['MedWep', 5] },
  stormblade: { main: ['Wand', 2] },
  rune_knight: { main: ['Scroll', 0], charge: ['Ring', 0] },
  runeguard: { main: ['Scroll', 8] },
  hexblade: { main: ['ShortWep', 9] },
  // the Scout's roads: crossed arrows
  scout: { behind: ['Ammo', 16], main: ['Ammo', 10] },
  archer: { main: ['Ammo', 8] },
  sharpshooter: { main: ['Ammo', 20], charge: ['Tool', 1] },
  hawkeye: { main: ['Ammo', 9] },
  deadeye: { main: ['Ammo', 21] },
  gunner: { behind: ['Ammo', 32], main: ['Ammo', 4] },
  musketeer: { main: ['Ammo', 33] },
  artillerist: { main: ['Ammo', 5] },
  ranger: { main: ['Ammo', 11], charge: ['Potion', 4] },
  hunter: { main: ['Ammo', 13], charge: ['Tool', 14] },
  beast_slayer: { main: ['Ammo', 19] },
  monster_hunter: { main: ['LongWep', 33] },
  beast_tamer: { behind: ['LongWep', 40], main: ['Tool', 14] },
  beastmaster: { main: ['LongWep', 42] },
  packleader: { main: ['Tool', 14], charge: ['Ammo', 11] },
  // the Rogue's roads: crossed daggers
  rogue: { behind: ['ShortWep', 0], main: null },
  assassin: { main: ['Potion', 5] },
  shadow: { main: ['Amulet', 7], charge: ['Potion', 8] },
  nightblade: { main: ['ShortWep', 7] },
  phantom: { main: ['Amulet', 7] },
  venomist: { main: ['Potion', 5], charge: ['Potion', 4] },
  toxicant: { main: ['Potion', 4] },
  widowmaker: { main: ['ShortWep', 2] },
  duelist: { behind: ['MedWep', 3], main: ['Ring', 2] },
  samurai: { behind: ['LongWep', 10], main: ['Hat', 1] },
  kensei: { main: ['LongWep', 11] },
  iaijutsu_master: { main: ['LongWep', 13] },
  blade_dancer: { behind: ['ShortWep', 5], main: ['Ring', 2] },
  mirage: { main: ['Amulet', 6] },
  whirling_dervish: { main: ['ShortWep', 4] },
  // the Apprentice's roads: crossed wands
  apprentice: { behind: ['Wand', 0], main: ['Magic', 28] },
  elementalist: { behind: ['Wand', 5], main: ['Wand', 48], charge: ['Light', 0] },
  archmage: { main: ['Magic', 29], charge: ['Ring', 5] },
  pyromancer: { main: ['Light', 0] },
  cryomancer: { main: ['Wand', 48] },
  chronomancer: { main: ['Tool', 1], charge: ['Ring', 0] },
  time_weaver: { main: ['Ring', 2] },
  fatespinner: { main: ['Ring', 0] },
  occultist: { behind: ['Wand', 45], main: ['Book', 63] },
  witch: { main: ['Hat', 17], charge: ['Potion', 8] },
  hexer: { main: ['Amulet', 11] },
  coven_mother: { main: ['Potion', 8] },
  necromancer: { main: ['Hat', 10], charge: ['Wand', 45] },
  deathcaller: { main: ['Hat', 10] },
  lich_adept: { main: ['Amulet', 17] },
  // the Acolyte's roads: crossed scrolls, crossed staves for the monks
  acolyte: { behind: ['Scroll', 0], main: ['Amulet', 0], charge: ['Book', 42] },
  priest: { main: ['Amulet', 4] },
  cleric: { main: ['Amulet', 4], charge: ['Light', 2] },
  high_priest: { main: ['Light', 2] },
  hierophant: { main: ['Light', 5] },
  inquisitor: { behind: ['MedWep', 0], main: ['Light', 0] },
  witch_hunter: { main: ['Light', 3] },
  exorcist: { main: ['Amulet', 17] },
  monk: { behind: ['ShortWep', 16], main: ['Music', 32] },
  master: { main: ['Music', 32], charge: ['ShortWep', 16] },
  grandmaster: { main: ['Magic', 10] },
  fist_of_light: { main: ['Amulet', 2] },
  shaman: { main: ['Music', 24], charge: ['Potion', 6] },
  witch_doctor: { main: ['Potion', 6] },
  spirit_chief: { main: ['Light', 6] },
  // the Wanderer's roads: crossed branches
  wanderer: { behind: ['Tool', 9], main: null, charge: ['Potion', 4] },
  druid: { behind: ['Magic', 19], main: ['Potion', 4] },
  archdruid: { main: ['Magic', 20], charge: ['Potion', 4] },
  green_sage: { main: ['Magic', 21] },
  stormcaller: { main: ['Wand', 26] },
  shapeshifter: { main: ['Tool', 14], charge: ['Tool', 14] },
  primal: { main: ['Tool', 14] },
  manyform: { main: ['Ring', 4] },
  summoner: { behind: ['Magic', 10], main: ['Magic', 15], charge: ['Ring', 4] },
  conjurer: { main: ['Magic', 24], charge: ['Potion', 2] },
  elementarch: { main: ['Magic', 13] },
  voidbinder: { main: ['Magic', 25] },
  beastcaller: { behind: ['LongWep', 40], main: ['Tool', 14], charge: ['Magic', 15] },
  drake_tamer: { main: ['LongWep', 41] },
  lord_of_hosts: { main: ['Music', 8] },
  // the Minstrel's roads: crossed flutes, crossed hammers for the tinkers
  minstrel: { behind: ['Music', 2], main: ['Music', 1] },
  bard: { main: ['Music', 1] },
  skald: { main: ['Music', 8], charge: ['Music', 40] },
  maestro: { main: ['Music', 24] },
  warsinger: { main: ['Music', 40] },
  dancer: { main: ['Ring', 2], charge: ['Music', 0] },
  muse: { main: ['Music', 25] },
  fire_dancer: { main: ['Music', 10] },
  tinker: { behind: ['ShortWep', 24], main: ['Tool', 3] },
  alchemist: { behind: ['Potion', 1], main: ['Potion', 27] },
  bombardier: { main: ['Potion', 36] },
  philosopher: { main: ['Potion', 27] },
  artificer: { main: ['ShortWep', 24], charge: ['Tool', 1] },
  machinist: { main: ['ShortWep', 25] },
  clockwork_sage: { main: ['Tool', 1] },
};
/** The gem a stage-3 road wears, and the crown of the ascended. */
export const GEM: Glyph = ['Money', 16];
export const CROWN: Glyph = ['Hat', 26];

export interface Emblem {
  colours: EmblemColours;
  /** The crossed pair behind, the device, the corner charge; a stage-3 road's gem and an ascended form's crown. */
  behind: Glyph | null;
  main: Glyph | null;
  charge: Glyph | null;
  gem: boolean;
  crown: boolean;
  /** The device of the one before (an ascended form keeps its road's), for telling what it is. */
  glyph: Glyph;
  stage: number;
  base: string;
}
/** A node's emblem: its base calling's colours and its composition, each part the nearest set on its road. */
export function emblemOf(nodeId: string): Emblem | null {
  const line = lineage(nodeId);
  if (!line.length) return null;
  const base = line[0].id;
  const part = (k: keyof Compose): Glyph | null => {
    for (let i = line.length - 1; i >= 0; i--) {
      const c = C[line[i].id];
      if (c && c[k] !== undefined) return c[k] ?? null;
    }
    return null;
  };
  const stage = line[line.length - 1].stage;
  const main = part('main');
  const behind = part('behind');
  return { colours: BASE_COLOURS[base] ?? BASE_COLOURS.fighter, behind, main, charge: part('charge'), gem: stage >= 3, crown: stage >= 4, glyph: main ?? behind ?? ['Shield', 0], stage, base };
}
export const COMPOSITIONS = C;
