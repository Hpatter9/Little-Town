// The armoury's other half: about a hundred pieces of armour, era by era, in four weights (classes wear what their
// calling allows: data/classes.ts). Cloth turns little but feeds a caster's spells; light leathers turn some and help
// a wearer dodge; medium mail turns more; heavy plate turns the most but slows the wearer's blows. Then shields (a
// buckler, a heater, a tower), and rings and amulets. Like the weapons, the tier sets how good a piece is, and a
// crafted piece can be +1 to +5 on top of its grade (quality.ts).

import type { Era } from './eras';
import type { IconSheet, ItemDef, ItemEffects, Slot, Station } from './items';
import type { Material } from './materials';

export type ArmourWeight = 'cloth' | 'light' | 'medium' | 'heavy' | 'shield' | 'trinket';
export const WEIGHT_NAMES: Record<ArmourWeight, string> = { cloth: 'Cloth', light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield', trinket: 'Trinket' };

/** Body armour's share of blows turned, by weight, at a tier (1 to 10); a helm turns HEAD_SHARE of that. */
const TURN: Record<'cloth' | 'light' | 'medium' | 'heavy', number> = { cloth: 0.35, light: 0.6, medium: 0.8, heavy: 1 };
export const bodyArmor = (tier: number) => 0.16 + 0.05 * tier;
const HEAD_SHARE = 0.4;

type Icon = [IconSheet, number, number];
const A = (x: number, y: number): Icon => ['Armor', x, y];
const H = (x: number, y: number): Icon => ['Hat', x, y];
const SH = (x: number): Icon => ['Shield', x, 0];
const R = (x: number, y: number): Icon => ['Ring', x, y];
const AM = (x: number, y: number): Icon => ['Amulet', x, y];

/** One era's pieces: two of each weight for body and head (a lesser and a finer), three shields, two trinkets. */
interface EraSet {
  era: Era;
  tiers: [number, number];
  research: Record<ArmourWeight, string[]>;
  body: Record<'cloth' | 'light' | 'medium' | 'heavy', [string, string]>;
  head: Record<'cloth' | 'light' | 'medium' | 'heavy', [string, string]>;
  shields: [string, string, string];
  trinkets: [string, string];
}

const SETS: EraSet[] = [
  {
    era: 'neolithic',
    tiers: [1, 3],
    research: { cloth: ['cordage'], light: ['tanning'], medium: ['tanning', 'stoneworking'], heavy: ['woodcutting', 'cordage'], shield: ['woodcutting'], trinket: ['oral_tradition'] },
    body: { cloth: ['Woven Smock', 'Shaman Robe'], light: ['Hide Vest', 'Furred Jerkin'], medium: ['Bone Scale Coat', 'Antler Mail'], heavy: ['Plank Armour', 'Stone-Plate Coat'] },
    head: { cloth: ['Reed Hat', 'Feathered Headdress'], light: ['Fur Hood', 'Wolf-Head Hood'], medium: ['Bone Cap', 'Antler Helm'], heavy: ['Wooden Helm', 'Skull Helm'] },
    shields: ['Hide Buckler', 'Bark Shield', 'Log Shield'],
    trinkets: ['Shell Ring', 'Tooth Necklace'],
  },
  {
    era: 'medieval',
    tiers: [4, 6],
    research: { cloth: ['weaving'], light: ['leatherworking'], medium: ['armoring'], heavy: ['armoring', 'fortification'], shield: ['armoring'], trinket: ['guilds'] },
    body: { cloth: ['Linen Robe', 'Embroidered Robe'], light: ['Studded Leather', 'Brigandine'], medium: ['Ring Mail', 'Scale Hauberk'], heavy: ['Plate Harness', 'Full Plate'] },
    head: { cloth: ['Wool Cowl', "Wizard's Hat"], light: ['Leather Hood', 'Studded Coif'], medium: ['Mail Coif', 'Nasal Helm'], heavy: ['Great Helm', 'Visored Bascinet'] },
    shields: ['Iron Buckler', 'Heater Shield', 'Tower Shield'],
    trinkets: ['Silver Ring', 'Saint\'s Amulet'],
  },
  {
    era: 'industrial',
    tiers: [6, 7],
    research: { cloth: ['weaving', 'steam_power'], light: ['leatherworking', 'railways'], medium: ['steelmaking'], heavy: ['steelmaking', 'steam_power'], shield: ['steelmaking'], trinket: ['glassblowing'] },
    body: { cloth: ['Frock Coat', 'Alchemist Coat'], light: ['Duster', 'Oilskin Coat'], medium: ['Steel Brigandine', 'Riveted Mail'], heavy: ['Boiler Plate', 'Steam Cuirass'] },
    head: { cloth: ['Top Hat', 'Goggled Cap'], light: ['Leather Aviator Cap', 'Bowler'], medium: ['Steel Pot Helm', 'Pith Helmet'], heavy: ['Diver\'s Helm', 'Riveted Helm'] },
    shields: ['Steel Buckler', 'Riot Shield', 'Boiler Door'],
    trinkets: ['Brass Ring', 'Pocket Watch'],
  },
  {
    era: 'modern',
    tiers: [7, 9],
    research: { cloth: ['refining'], light: ['refining', 'motor_transport'], medium: ['rifles'], heavy: ['rifles', 'concrete'], shield: ['refining'], trinket: ['electronics'] },
    body: { cloth: ['Field Jacket', 'Lab Coat'], light: ['Biker Leathers', 'Padded Vest'], medium: ['Flak Jacket', 'Ceramic Vest'], heavy: ['Bomb Suit', 'Heavy Plate Carrier'] },
    head: { cloth: ['Beret', 'Headset'], light: ['Motorcycle Helmet', 'Balaclava'], medium: ['Kevlar Helmet', 'Tactical Helmet'], heavy: ['Blast Helmet', 'Full-Face Helmet'] },
    shields: ['Polymer Buckler', 'Ballistic Shield', 'Breach Shield'],
    trinkets: ['Signet Ring', 'Dog Tags'],
  },
  {
    era: 'space',
    tiers: [9, 10],
    research: { cloth: ['microchips'], light: ['advanced_alloys'], medium: ['advanced_alloys', 'robotics'], heavy: ['robotics', 'energy_shields'], shield: ['energy_shields'], trinket: ['power_storage'] },
    body: { cloth: ['Smart-Weave Robe', 'Psionic Mantle'], light: ['Stealth Suit', 'Nanofibre Suit'], medium: ['Composite Armour', 'Alloy Mesh Suit'], heavy: ['Exo-Plate', 'Siege Exoskeleton'] },
    head: { cloth: ['Neural Circlet', 'Focus Crown'], light: ['Stealth Cowl', 'Sensor Hood'], medium: ['Alloy Helm', 'HUD Helmet'], heavy: ['Sealed Exo-Helm', 'Siege Helm'] },
    shields: ['Deflector Buckler', 'Hard-Light Shield', 'Bulwark Projector'],
    trinkets: ['Nano Ring', 'Quantum Pendant'],
  },
];

/** Icons for each weight, lesser and finer (the DawnLike armour, hat, shield, ring and amulet sheets). */
const BODY_ICON: Record<'cloth' | 'light' | 'medium' | 'heavy', Icon[]> = {
  cloth: [A(0, 7), A(3, 7), A(4, 7), A(2, 7), A(7, 7), A(5, 7), A(6, 7), A(1, 7), A(4, 7), A(3, 7)],
  light: [A(1, 0), A(0, 6), A(1, 6), A(4, 0), A(0, 0), A(3, 0), A(6, 0), A(2, 0), A(5, 6), A(7, 0)],
  medium: [A(0, 8), A(1, 8), A(2, 8), A(3, 8), A(4, 8), A(2, 6), A(3, 6), A(4, 6), A(5, 0), A(5, 8)],
  heavy: [A(1, 1), A(0, 1), A(2, 1), A(3, 1), A(6, 6), A(5, 6), A(7, 6), A(6, 0), A(7, 0), A(1, 1)],
};
const HEAD_ICON: Record<'cloth' | 'light' | 'medium' | 'heavy', Icon[]> = {
  cloth: [H(1, 2), H(2, 2), H(0, 3), H(1, 2), H(2, 2)],
  light: [H(0, 1), H(0, 2), H(0, 1), H(0, 2), H(0, 1)],
  medium: [H(1, 1), H(3, 0), H(1, 1), H(2, 1), H(3, 0)],
  heavy: [H(2, 0), H(4, 0), H(5, 0), H(1, 0), H(2, 0)],
};
const SHIELD_ICON: Icon[][] = [
  [SH(0), SH(1), SH(5)],
  [SH(0), SH(2), SH(4)],
  [SH(5), SH(3), SH(6)],
  [SH(1), SH(4), SH(6)],
  [SH(2), SH(6), SH(4)],
];
const TRINKET_ICON: Icon[][] = [
  [R(0, 0), AM(0, 0)],
  [R(1, 0), AM(4, 0)],
  [R(2, 0), AM(6, 1)],
  [R(3, 4), AM(4, 1)],
  [R(4, 4), AM(1, 2)],
];

/** What each weight is made of, by era. */
const STUFF: Record<Era, Record<'cloth' | 'light' | 'medium' | 'heavy' | 'shield' | 'trinket', Material[]>> = {
  neolithic: { cloth: ['fiber'], light: ['hide'], medium: ['bone', 'hide'], heavy: ['wood', 'stone'], shield: ['wood', 'hide'], trinket: ['bone'] },
  medieval: { cloth: ['cloth'], light: ['leather'], medium: ['iron', 'leather'], heavy: ['iron'], shield: ['lumber', 'iron'], trinket: ['iron', 'herbs'] },
  industrial: { cloth: ['cloth'], light: ['leather', 'cloth'], medium: ['steel', 'leather'], heavy: ['steel'], shield: ['steel'], trinket: ['glass', 'steel'] },
  modern: { cloth: ['cloth', 'plastic'], light: ['leather', 'plastic'], medium: ['plastic', 'steel'], heavy: ['steel', 'concrete'], shield: ['plastic', 'steel'], trinket: ['electronics'] },
  space: { cloth: ['circuits', 'cloth'], light: ['alloys', 'plastic'], medium: ['alloys'], heavy: ['alloys', 'circuits'], shield: ['alloys', 'power_cells'], trinket: ['rare_minerals', 'circuits'] },
};

function station(weight: ArmourWeight, era: Era): Station {
  const soft = weight === 'cloth' || weight === 'light';
  switch (era) {
    case 'neolithic':
      return weight === 'light' ? 'tanning_rack' : 'workbench';
    case 'medieval':
      return weight === 'cloth' ? 'loom' : weight === 'light' ? 'tannery' : weight === 'trinket' ? 'workbench' : 'smithy';
    case 'industrial':
      return weight === 'cloth' ? 'loom' : weight === 'light' ? 'tannery' : weight === 'trinket' ? 'glassworks' : 'smithy';
    case 'modern':
      return soft ? 'loom' : weight === 'trinket' ? 'electronics_plant' : 'smithy';
    case 'space':
      return weight === 'trinket' || weight === 'cloth' ? 'chip_fab' : 'alloy_foundry';
  }
}

const idOf = (name: string) => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function piece(name: string, slot: Slot, weight: ArmourWeight, tier: number, era: Era, research: string[], effects: ItemEffects, icon: Icon, note: string): ItemDef {
  const stuff = STUFF[era][weight];
  const n = Math.max(1, Math.round(1 + tier / 2.5)) + (slot === 'body' ? 2 : 0);
  const cost: Partial<Record<Material, number>> = {};
  stuff.forEach((m, i) => (cost[m] = Math.max(1, i === 0 ? n : Math.ceil(n / 2))));
  return {
    id: idOf(name),
    name,
    slot,
    station: station(weight, era),
    cost,
    seconds: 40 + tier * 14 + (slot === 'body' ? 30 : 0),
    research,
    effects,
    weight,
    tier,
    description: `${WEIGHT_NAMES[weight]}${weight === 'shield' || weight === 'trinket' ? '' : ' armour'}, tier ${tier}: ${note}.`,
    icon: { sheet: icon[0], x: icon[1], y: icon[2] },
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function build(): ItemDef[] {
  const out: ItemDef[] = [];
  SETS.forEach((set, e) => {
    for (const w of ['cloth', 'light', 'medium', 'heavy'] as const) {
      [0, 1].forEach((k) => {
        const tier = set.tiers[k];
        const armor = Math.round(bodyArmor(tier) * TURN[w] * 100) / 100;
        // (each weight's own: spell power for cloth, a dodge for light, plate slows the arm)
        const own: ItemEffects = w === 'cloth' ? { power: Math.round(0.04 * tier * 100) / 100 } : w === 'light' ? { dodge: Math.round((0.01 + 0.008 * tier) * 100) / 100 } : w === 'heavy' ? { speed: 1.08 } : {};
        const ownWords = w === 'cloth' ? `, +${pct(own.power!)} spell power` : w === 'light' ? `, ${pct(own.dodge!)} to dodge` : w === 'heavy' ? ', a little slower to strike' : '';
        out.push(piece(set.body[w][k], 'body', w, tier, set.era, set.research[w], { armor, ...own }, BODY_ICON[w][e * 2 + k], `turns ${pct(armor)} of each blow${ownWords}`));
        const helm = Math.round(armor * HEAD_SHARE * 100) / 100;
        const headOwn: ItemEffects = w === 'cloth' ? { power: Math.round(own.power! * 50) / 100 } : w === 'light' ? { dodge: Math.round(own.dodge! * 50) / 100 } : {};
        out.push(piece(set.head[w][k], 'head', w, tier, set.era, set.research[w], { armor: helm, ...headOwn }, HEAD_ICON[w][e], `turns ${pct(helm)}${w === 'cloth' ? `, +${pct(headOwn.power!)} spell power` : ''}`));
      });
    }
    // shields: a buckler (light, quick), a heater, a tower (blocks most, slows)
    set.shields.forEach((name, k) => {
      const tier = set.tiers[1];
      const block = Math.round((0.08 + 0.015 * tier + k * 0.06) * 100) / 100;
      const fx: ItemEffects = k === 0 ? { block, dodge: 0.03 } : k === 1 ? { block, armor: 0.03 } : { block, armor: 0.06, speed: 1.1 };
      out.push(piece(name, 'offhand', 'shield', tier, set.era, set.research.shield, fx, SHIELD_ICON[e][k], `blocks ${pct(block)} of blows${k === 2 ? ', heavy' : ''}`));
    });
    // a ring (for the arm) and an amulet (for the heart)
    const tier = set.tiers[1];
    out.push(piece(set.trinkets[0], 'charm', 'trinket', tier, set.era, set.research.trinket, { accuracy: Math.round((0.02 + 0.006 * tier) * 100) / 100, power: Math.round(0.02 * tier * 100) / 100 }, TRINKET_ICON[e][0], 'steadier aim and a little spell power'));
    out.push(piece(set.trinkets[1], 'charm', 'trinket', tier, set.era, set.research.trinket, { morale: 3 + tier, armor: Math.round(0.01 * tier * 100) / 100 }, TRINKET_ICON[e][1], 'a braver heart, a little protection'));
  });
  return out;
}

export const ARMOUR: readonly ItemDef[] = build();
