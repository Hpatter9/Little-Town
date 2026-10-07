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
export type GlyphSheet = 'ShortWep' | 'MedWep' | 'LongWep' | 'Wand' | 'Shield' | 'Hat' | 'Amulet' | 'Scroll' | 'Magic' | 'Tool' | 'Light' | 'Potion' | 'Ring' | 'Ammo' | 'Armor' | 'Book' | 'Music';
export type Glyph = [GlyphSheet, number];

const G: Record<string, Glyph> = {
  // the Fighter's roads
  fighter: ['MedWep', 0], knight: ['Shield', 2], paladin: ['Amulet', 4], crusader: ['Shield', 3], templar: ['Shield', 4],
  dragoon: ['LongWep', 6], wyvern_knight: ['LongWep', 18], lance_captain: ['LongWep', 28],
  berserker: ['MedWep', 8], warlord: ['MedWep', 9], titan: ['LongWep', 48], warchief: ['Music', 40],
  blood_reaver: ['LongWep', 2], blood_lord: ['Amulet', 3], gorefiend: ['Potion', 0],
  // the Guard's roads
  guard: ['Shield', 0], sentinel: ['Shield', 5], bulwark: ['Shield', 4], aegis: ['Shield', 6], colossus: ['Armor', 56],
  gatewarden: ['Tool', 19], ironwall: ['Shield', 1], shield_saint: ['Shield', 3],
  spellsword: ['MedWep', 2], battlemage: ['MedWep', 4], arcane_knight: ['MedWep', 5], stormblade: ['Wand', 2],
  rune_knight: ['Scroll', 0], runeguard: ['Scroll', 8], hexblade: ['ShortWep', 9],
  // the Scout's roads
  scout: ['Ammo', 10], archer: ['Ammo', 8], sharpshooter: ['Ammo', 16], hawkeye: ['Ammo', 9], deadeye: ['Ammo', 20],
  gunner: ['Ammo', 32], musketeer: ['Ammo', 33], artillerist: ['Ammo', 4],
  ranger: ['Ammo', 11], hunter: ['Ammo', 13], beast_slayer: ['Ammo', 19], monster_hunter: ['LongWep', 33],
  beast_tamer: ['LongWep', 40], beastmaster: ['LongWep', 42], packleader: ['Tool', 14],
  // the Rogue's roads
  rogue: ['ShortWep', 0], assassin: ['ShortWep', 9], shadow: ['ShortWep', 1], nightblade: ['ShortWep', 7], phantom: ['Amulet', 7],
  venomist: ['Potion', 4], toxicant: ['Potion', 5], widowmaker: ['ShortWep', 2],
  duelist: ['MedWep', 3], samurai: ['LongWep', 10], kensei: ['LongWep', 11], iaijutsu_master: ['LongWep', 13],
  blade_dancer: ['ShortWep', 5], mirage: ['Amulet', 6], whirling_dervish: ['ShortWep', 4],
  // the Apprentice's roads
  apprentice: ['Wand', 0], elementalist: ['Wand', 5], archmage: ['Magic', 29], pyromancer: ['Light', 0], cryomancer: ['Wand', 48],
  chronomancer: ['Tool', 1], time_weaver: ['Ring', 2], fatespinner: ['Ring', 0],
  occultist: ['Book', 63], witch: ['Hat', 17], hexer: ['Amulet', 11], coven_mother: ['Potion', 8],
  necromancer: ['Wand', 45], deathcaller: ['Hat', 10], lich_adept: ['Amulet', 17],
  // the Acolyte's roads
  acolyte: ['Amulet', 0], priest: ['Book', 42], cleric: ['Amulet', 4], high_priest: ['Light', 2], hierophant: ['Light', 5],
  inquisitor: ['Light', 0], witch_hunter: ['Light', 3], exorcist: ['Amulet', 17],
  monk: ['Music', 32], master: ['ShortWep', 16], grandmaster: ['Magic', 10], fist_of_light: ['Amulet', 2],
  shaman: ['Music', 24], witch_doctor: ['Potion', 6], spirit_chief: ['Light', 6],
  // the Wanderer's roads
  wanderer: ['Tool', 9], druid: ['Magic', 19], archdruid: ['Magic', 20], green_sage: ['Magic', 21], stormcaller: ['Wand', 26],
  shapeshifter: ['Tool', 14], primal: ['Tool', 14], manyform: ['Ring', 4],
  summoner: ['Magic', 15], conjurer: ['Magic', 24], elementarch: ['Magic', 13], voidbinder: ['Magic', 25],
  beastcaller: ['LongWep', 40], drake_tamer: ['LongWep', 41], lord_of_hosts: ['Music', 8],
  // the Minstrel's roads
  minstrel: ['Music', 2], bard: ['Music', 1], skald: ['Music', 8], maestro: ['Music', 24], warsinger: ['Music', 40],
  dancer: ['Ring', 2], muse: ['Music', 25], fire_dancer: ['Music', 10],
  tinker: ['Tool', 3], alchemist: ['Potion', 1], bombardier: ['Potion', 36], philosopher: ['Potion', 27],
  artificer: ['ShortWep', 24], machinist: ['ShortWep', 25], clockwork_sage: ['Tool', 1],
};

export interface Emblem {
  colours: EmblemColours;
  glyph: Glyph;
  stage: number;
  base: string;
}
/** A node's emblem: its base calling's colours, the nearest glyph on its road, its stage. */
export function emblemOf(nodeId: string): Emblem | null {
  const line = lineage(nodeId);
  if (!line.length) return null;
  const base = line[0].id;
  let glyph: Glyph | undefined;
  for (let i = line.length - 1; i >= 0 && !glyph; i--) glyph = G[line[i].id];
  return { colours: BASE_COLOURS[base] ?? BASE_COLOURS.fighter, glyph: glyph ?? ['Shield', 0], stage: line[line.length - 1].stage, base };
}
export const GLYPHS = G;
