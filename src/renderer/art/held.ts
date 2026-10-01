// What someone visibly holds and wears: their weapon in a fight, the tool that fits the work otherwise,
// and armour drawn as LPC layers. Only items with an LPC layer to show are listed.

import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import type { FamilyId } from '../../shared/data/weapons';
import type { LpcWeapon } from './lpc/lpc';
import { gradeOf } from '../../shared/data/quality';

const LPC_OF: Record<string, LpcWeapon> = {
  spear: 'spear',
  fire_spear: 'spear',
  wooden_club: 'mace',
  flint_knife: 'dagger',
  stone_axe: 'axe',
  stone_hammer: 'mace',
  iron_axe: 'axe',
  iron_hammer: 'mace',
  iron_pick: 'mace',
  iron_sword: 'sword',
  steel_axe: 'axe',
  steel_pick: 'mace',
  bow: 'bow',
};

const AXES = new Set(['stone_axe', 'iron_axe', 'steel_axe', 'chainsaw', 'plasma_cutter']);
const HAMMERS = new Set(['stone_hammer', 'iron_hammer', 'iron_pick', 'steel_pick', 'power_drill', 'plasma_cutter']);

/** A weapon of the armoury (data/weapons.ts) is drawn as the nearest LPC weapon of its family. */
const BY_FAMILY: Partial<Record<FamilyId, LpcWeapon>> = { dg: 'dagger', cl: 'dagger', sw: 'sword', gs: 'sword', ax: 'axe', mc: 'mace', fl: 'mace', sp: 'spear', pl: 'spear', sc: 'spear', st: 'spear', bw: 'bow', lb: 'bow', cb: 'bow' };
const lpcOf = (id: string): LpcWeapon => LPC_OF[id] ?? BY_FAMILY[ITEM_BY_ID[id]?.family as FamilyId] ?? null;

export function heldWeapon(gear: Partial<Record<Slot, string>>, activity: string): LpcWeapon {
  const tool = gear.tool ?? '';
  switch (activity) {
    case 'fight':
      return (gear.weapon ? lpcOf(gear.weapon) : null) ?? LPC_OF[tool] ?? null;
    case 'chop':
      return AXES.has(tool) ? 'axe' : null;
    case 'mine':
    case 'build':
      return HAMMERS.has(tool) ? 'mace' : null;
    default:
      return null;
  }
}

/** Armour and what else is worn over the clothes: the LPC layer, and its colour if it isn't as drawn. */
const WORN: Record<string, [string, string?][]> = {
  hide_armor: [['torso_leathersh']],
  leather_armor: [['torso_leather']],
  chainmail: [['torso_chain'], ['head_chain']],
  steel_cuirass: [['torso_plate'], ['legs_metal']],
  kevlar_vest: [['torso_leather', '#5a6a4a']],
  powered_armor: [['torso_plate', '#7a8aa8'], ['torso_platearms', '#7a8aa8'], ['legs_metal', '#7a8aa8'], ['hands_gloves', '#5a6a88']],
  dragonscale_armor: [['torso_plate', '#b83a2a'], ['torso_platearms', '#b83a2a']],
  tank_plating: [['torso_plate', '#6a7a5a'], ['torso_platearms', '#6a7a5a']],
  bearskin_cloak: [['back_cape', '#5a3a22'], ['torso_leathersh', '#6a4a2a']],
  alpha_pelt: [['back_cape', '#c8c8c8'], ['torso_leathersh', '#a8a8a8']],
  hide_cap: [['head_hood', '#a88258']],
  leather_cap: [['head_cap', '#7a5a3a']],
  iron_helm: [['head_helm']],
  combat_helmet: [['head_helm', '#5a6a4a']],
  visor_helmet: [['head_helm', '#7a8aa8']],
  pirate_crown: [['head_gold']],
  rat_king_crown: [['head_gold', '#6a6a5a']],
  hunt_crown: [['head_tiara']],
  bow: [['back_quiver']],
  khan_bow: [['back_quiver']],
};
/** Armour of this grade and better is gilded; poor armour looks it. */
const GILDED = 5;
const GOLD = '#e8c060';

/** Armour layers for what someone wears (each 'layer' or 'layer:#tint'; see lpcCompose). */
export function wornLayers(gear: Partial<Record<Slot, string>>, quality: Partial<Record<Slot, number>> = {}): string[] {
  const out: string[] = [];
  for (const slot of ['body', 'head', 'weapon'] as const) {
    const q = gradeOf(quality[slot] ?? 1);
    for (const [layer, tint] of WORN[gear[slot] ?? ''] ?? []) {
      const metal = /plate|chain|helm|metal|gold/.test(layer) && slot !== 'weapon';
      const t = metal && q >= GILDED ? GOLD : q === 0 && slot !== 'weapon' ? '#7a7066' : tint;
      out.push(t ? `${layer}:${t}` : layer);
    }
  }
  return out;
}

/* ------------------------------------------------------------ everyday clothes */

/** Dyes, once the town can weave: each origin wears its own colours. */
const DYES: Record<string, string[]> = {
  town: ['#8a3a2a', '#3a5a8a', '#5a7a3a', '#8a6a2a', '#6a4a7a', '#a88c68', '#4a6a6a', '#9a5a3a'],
  lich: ['#4a4852', '#5a5862', '#3a3a44', '#6a6872', '#4a5a4a', '#5a4a5a'],
  druid: ['#4a7a34', '#6a8a3a', '#7a5a3a', '#3a5a2a', '#8a7a4a', '#5a6a3a'],
  vampire: ['#1a1418', '#6a1020', '#2a1a2a', '#8a1a2a', '#3a2a3a', '#4a0a14'],
  werewolf: ['#6a5438', '#4e3c28', '#7a6a58', '#5a4a3a', '#3a3028', '#8a7a68'],
  robot: ['#6a7684', '#8a96a4', '#4a5460', '#5a6a7a', '#7a8694'],
  dwarves: ['#7a4a2a', '#5a5048', '#8a6a3a', '#4a3a2a', '#6a2a1a', '#3a4a5a'],
  merfolk: ['#3a8a84', '#2a6a8a', '#4a9a94', '#5a7a9a', '#3a5a6a', '#8ac0c0'],
  nomads: ['#b83a2a', '#3a6ac8', '#e8a030', '#c85030', '#2a8a6a', '#8a2a6a', '#e0c040', '#4a3aa8'],
  fae: ['#d890d0', '#90c0e8', '#b0e090', '#e8b0a0', '#a890e8', '#f0e0a0'],
  alchemists: ['#5a3a7a', '#3a7a5a', '#7a5a2a', '#4a4a6a', '#8a4a5a', '#3a6a7a'],
  knights: ['#3050a0', '#a03030', '#e8e0c8', '#2a2a3a', '#c8a040', '#5a5a64'],
};
const HIDES = ['#8a6a48', '#7a5a3a', '#9c7c54', '#6c5040', '#8c7458', '#5a4838', '#a88c68', '#b89c74'];

/** A number that's the same for someone every time (their id, stirred). */
const roll = (id: number, salt: number) => {
  const v = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const pick = <T,>(list: readonly T[], id: number, salt: number): T => list[Math.floor(roll(id, salt) * list.length)];

export interface WardrobeOf {
  id: number;
  gender: 'm' | 'f';
  typeName: string;
  gear: Partial<Record<Slot, string>>;
  coins: number | null;
  child: boolean;
  founder: boolean;
}

/**
 * What someone wears day to day, beyond their armour: their clothes' colour, and the cut of them, from what they do,
 * what they can afford, and a roll of their own. Hides until the town can weave; then its origin's dyes.
 */
export function wardrobe(w: WardrobeOf, theme: string, weave: boolean): { outfit: string; wear: string[] } {
  const dyes = weave ? (DYES[theme] ?? DYES.town) : HIDES;
  const outfit = pick(dyes, w.id, 1);
  const second = pick(dyes, w.id, 2);
  const wear: string[] = [];
  const job = w.typeName.toLowerCase();
  if (w.child) return { outfit, wear };
  const wealthy = (w.coins ?? 0) >= 40;
  // the cut of their clothes
  if (job === 'elder' || (job === 'scholar' && roll(w.id, 3) < 0.7)) wear.push(`torso_robe:${outfit}`, `legs_robeskirt:${outfit}`);
  else if (w.gender === 'f' && roll(w.id, 4) < 0.3) wear.push(`torso_dress:${outfit}`);
  else if (wealthy && weave) wear.push(`torso_pirate:${outfit}`, 'feet_boots');
  else if (job === 'hunter') wear.push(`torso_sleeveless:${outfit}`, 'feet_boots');
  else if (job === 'crafter') wear.push(`torso_jacket:${outfit}`, `hands_gloves:${'#6a4a2a'}`);
  // a sash or a belt, and something on their head (some of them)
  if (weave && roll(w.id, 5) < 0.4) wear.push(`belt_cloth:${second}`);
  if (!w.gear.head) {
    const hat = roll(w.id, 6);
    if (hat < 0.18) wear.push(`head_bandana:${second}`);
    else if (hat < 0.26) wear.push(`head_cap:${second}`);
  }
  // the founder wears a cape in the town's colours
  if (w.founder) wear.push(`back_cape:${weave ? second : '#6a4a2a'}`);
  return { outfit, wear };
}
