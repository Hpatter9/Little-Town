// Crafting chains (the owner's ask: better things need more, and more kinds of, resources). Between a refined material
// (iron, lumber, leather, cloth, steel...) and the finished thing there's now a part: a blade blank, a haft, leather
// straps, steel plates. Parts are inventory items (they carry a quality, which goes on into what they're made into:
// sim/crafting.ts), made at the station that already works their material. `deepen` gives every item of the Medieval
// age and later its parts, more of them the later the age and the finer the piece, and the age's best pieces a rare
// input (silver, gems, heartwood, a thick pelt, pearls) that comes from the land's mines, from quests and from trade.
// The first age's things are left as they are: one or two steps. The plan: docs/plans/crafting-chains.md.

import { ERAS, type Era } from './eras';
import type { IconSheet, ItemDef, Station } from './items';
import type { Material } from './materials';
import { FAMILIES } from './weapons';

type Icon = ItemDef['icon'];
const ic = (sheet: IconSheet, x: number, y: number): Icon => ({ sheet, x, y });
const custom = (name: string): Icon => ({ sheet: 'Custom', x: 0, y: 0, name });

const part = (id: string, name: string, station: Station, cost: Partial<Record<Material, number>>, research: string[], yields: number, text: string, icon: Icon): ItemDef => ({
  id,
  name,
  slot: null,
  station,
  cost,
  seconds: 30,
  research,
  effects: {},
  description: `A part: ${text}`,
  icon,
  part: true,
  ...(yields > 1 ? { yields } : {}),
});

/** The parts, from a refined material each. */
export const PARTS: readonly ItemDef[] = [
  // metal
  part('iron_blade', 'Blade Blank', 'smithy', { iron: 2 }, ['iron_working'], 1, 'an iron blade or head, forged and ground, for a weapon or a tool.', ic('ShortWep', 0, 0)),
  part('iron_plate', 'Iron Plates', 'smithy', { iron: 3 }, ['armoring'], 1, 'iron beaten into plates, for plate armour and shields.', ic('Shield', 4, 0)),
  part('mail_rings', 'Mail Rings', 'smithy', { iron: 2 }, ['armoring'], 1, 'iron wire drawn and cut into rings, for mail.', ic('Armor', 0, 8)),
  part('iron_fittings', 'Iron Fittings', 'smithy', { iron: 1 }, ['iron_working'], 2, 'rivets, buckles and hinges.', ic('Rock', 3, 0)),
  part('steel_blade', 'Steel Blade', 'steelworks', { steel: 2 }, ['steelmaking'], 1, 'a steel blade or head, tempered.', ic('ShortWep', 0, 0)),
  part('steel_plate', 'Steel Plates', 'steelworks', { steel: 3 }, ['steelmaking'], 1, 'rolled steel plates, for armour and shields.', ic('Shield', 4, 0)),
  part('springs', 'Springs and Screws', 'steelworks', { steel: 1 }, ['steelmaking'], 2, 'small steel works: springs, screws and catches.', ic('Rock', 3, 0)),
  part('gun_barrel', 'Gun Barrel', 'gunsmith', { steel: 2 }, ['firearms'], 1, 'a bored and rifled steel barrel.', custom('rifle')),
  part('alloy_plate', 'Alloy Plates', 'alloy_foundry', { alloys: 2 }, ['advanced_alloys'], 1, 'light, hard plates of alloy.', ic('Shield', 4, 0)),
  // wood
  part('haft', 'Haft', 'workbench', { lumber: 1 }, ['carpentry'], 2, 'a shaped haft for a spear, an axe or a tool.', ic('LongWep', 4, 4)),
  part('bow_stave', 'Bow Stave', 'workbench', { lumber: 2 }, ['archery'], 1, 'a seasoned stave, shaped to bend.', ic('Ammo', 0, 1)),
  part('joinery', 'Joinery', 'sawmill', { lumber: 2 }, ['carpentry'], 1, 'boards planed and jointed, for furniture and carts.', custom('oak_shelves')),
  part('gunstock', 'Gunstock', 'sawmill', { lumber: 2 }, ['firearms'], 1, 'a stock carved for a gun.', custom('rifle')),
  // leather
  part('leather_strap', 'Leather Straps', 'tannery', { leather: 1 }, ['leatherworking'], 2, 'cut and stitched straps, for grips, packs and buckles.', custom('leather_satchel')),
  part('leather_panel', 'Leather Panels', 'tannery', { leather: 2 }, ['leatherworking'], 1, 'boiled and shaped leather, for light armour.', custom('leather_satchel')),
  // cloth, glass, plastic
  part('cloth_panel', 'Cloth Panels', 'loom', { cloth: 2 }, ['weaving'], 1, 'cut and quilted cloth, for robes, padding and hangings.', custom('dyed_cloth')),
  part('lens', 'Lens', 'glassworks', { glass: 1 }, ['glassblowing'], 2, 'ground glass, for scopes, goggles and fine glass.', custom('glassware')),
  part('moulded_parts', 'Moulded Parts', 'refinery', { plastic: 2 }, ['refining'], 1, 'plastic pressed into shells, grips and housings.', custom('plastic_toys')),
  // food (the better dishes only: the plain fare stays made from the raw food)
  part('pastry', 'Pastry', 'bakery', { flour: 2, milk: 1 }, ['baking', 'domestication'], 2, 'flour worked with milk into a rich dough, for pies and tarts.', custom('fruit_tart')),
  part('cheese_wheel', 'Cheese Wheel', 'campfire', { milk: 4 }, ['domestication'], 2, 'milk curdled, pressed and salted, cut for the table.', custom('cheese')),
  part('broth', 'Broth', 'campfire', { meat: 1, herbs: 1 }, ['hospitality'], 2, 'a stock simmered from bones and herbs, the base of a good stew.', custom('stew')),
  part('sausage', 'Cured Sausage', 'smokehouse', { meat: 2, herbs: 1 }, ['food_preservation'], 2, 'minced meat and herbs, stuffed and smoked to keep.', custom('roast_meat')),
  part('preserves', 'Preserves', 'kiln', { fruit: 3 }, ['pottery', 'orcharding'], 2, 'fruit boiled down and sealed in a clay jar.', custom('berry_bowl')),
];
export const PART_IDS: ReadonlySet<string> = new Set(PARTS.map((p) => p.id));

/** The rare inputs: had from the land (mines, felling), from quests and delves, and from trade, never simply gathered. */
export const RARE_INPUTS: readonly Material[] = ['silver', 'gems', 'heartwood', 'thick_pelt', 'pearls'];
export const RARE_SET: ReadonlySet<Material> = new Set(RARE_INPUTS);

/* ------------------------------------------------------------ how deep an item goes */

/** The age a material belongs to (the rest are the first age's, or found: they don't set an item's age). */
const MATERIAL_AGE: Partial<Record<Material, Era>> = {
  iron: 'medieval', lumber: 'medieval', leather: 'medieval', cloth: 'medieval', bricks: 'medieval',
  steel: 'industrial', glass: 'industrial', coal: 'industrial',
  plastic: 'modern', concrete: 'modern', electronics: 'modern', fuel: 'modern',
  alloys: 'space', circuits: 'space', power_cells: 'space', rare_minerals: 'space',
};
/** An item's age: the latest of its materials'. */
export function ageOf(cost: Partial<Record<Material, number>>): Era {
  let at = 0;
  for (const m of Object.keys(cost) as Material[]) at = Math.max(at, ERAS.indexOf(MATERIAL_AGE[m] ?? 'neolithic'));
  return ERAS[at];
}

/** From this tier up a weapon is one of its age's fine pieces (two parts), and its best (a rare input too). */
const FINE: Record<Era, number> = { neolithic: 99, medieval: 6, industrial: 7, modern: 8, space: 10 };
const TOP: Record<Era, number> = { neolithic: 99, medieval: 7, industrial: 8, modern: 9, space: 10 };
/** Armour's finer piece of each age (data/armour.ts sets: a lesser and a finer) is its best. */
const ARMOUR_TOP: Record<Era, number> = { neolithic: 99, medieval: 6, industrial: 7, modern: 9, space: 10 };
/** Fewer materials than this and it stays simple (a bandage, a brooch): parts are for things of substance. */
const SIMPLE_BELOW = 3;
/** At most this many of one part in an item. */
const MAX_OF_A_PART = 2;

type Role = 'edge' | 'bow' | 'gun' | 'plate' | 'mail' | 'soft' | 'other';

function roleOf(def: ItemDef): Role {
  if (def.slot === 'weapon') {
    const p = def.family ? FAMILIES[def.family].parts : 'blade';
    return p === 'bow' || p === 'crossbow' ? 'bow' : p === 'gun' || p === 'energy' ? 'gun' : p === 'magic' ? 'other' : p === 'sling' ? 'soft' : 'edge';
  }
  if (def.slot === 'tool') return 'edge';
  if (def.weight === 'heavy' || def.weight === 'shield') return 'plate';
  if (def.weight === 'medium') return 'mail';
  if (def.weight === 'light' || def.weight === 'cloth') return 'soft';
  return 'other';
}

/** The part a material becomes in an item of this kind. */
function partFor(m: Material, role: Role): string | undefined {
  switch (m) {
    case 'iron':
      return role === 'edge' ? 'iron_blade' : role === 'plate' ? 'iron_plate' : role === 'mail' ? 'mail_rings' : 'iron_fittings';
    case 'steel':
      return role === 'edge' ? 'steel_blade' : role === 'plate' || role === 'mail' ? 'steel_plate' : role === 'gun' ? 'gun_barrel' : 'springs';
    case 'alloys':
      return 'alloy_plate';
    case 'lumber':
      return role === 'bow' ? 'bow_stave' : role === 'gun' ? 'gunstock' : role === 'edge' ? 'haft' : 'joinery';
    case 'leather':
      return role === 'soft' ? 'leather_panel' : 'leather_strap';
    case 'cloth':
      return 'cloth_panel';
    case 'glass':
      return 'lens';
    case 'plastic':
      return 'moulded_parts';
  }
  return undefined;
}

/** The small works every finer piece of an age takes when it has only one material worth a part. */
const FITTINGS: Record<Era, string | undefined> = { neolithic: undefined, medieval: 'iron_fittings', industrial: 'springs', modern: 'springs', space: 'alloy_plate' };

/** How fine a piece is for its age: 0 plain, 1 fine, 2 its age's best. */
function gradeOf(def: ItemDef, age: Era): 0 | 1 | 2 {
  if (def.weight && def.tier !== undefined) return def.tier >= ARMOUR_TOP[age] ? 2 : 0;
  if (def.tier !== undefined) return def.tier >= TOP[age] ? 2 : def.tier >= FINE[age] ? 1 : 0;
  if (def.ware) return def.ware.tier >= 4 ? 2 : def.ware.tier >= 3 ? 1 : 0;
  return 0;
}

/** The rare input an age's best piece of this kind takes. */
function rareFor(def: ItemDef, role: Role, age: Era, main: Material | undefined): Material {
  const early = age === 'medieval' || age === 'industrial';
  switch (role) {
    case 'edge':
    case 'plate':
    case 'mail':
      return early ? 'silver' : 'gems';
    case 'gun':
      return age === 'industrial' ? 'silver' : 'gems';
    case 'bow':
      return 'heartwood';
    case 'soft':
      return main === 'leather' ? 'thick_pelt' : main === 'cloth' ? 'pearls' : 'gems';
    default:
      return def.slot === 'weapon' && def.family && FAMILIES[def.family].parts === 'magic' ? 'gems' : def.weight === 'trinket' && age === 'medieval' ? 'silver' : 'gems';
  }
}

/**
 * Give an item its chain: its parts in place of the materials they're made of (as many as the cost had material
 * for, so the raw total stays about the same and the work grows by the parts' making), and the age's best pieces a
 * rare input on top. First-age things, simple things and things made of no refined material are left as they are.
 */
export function deepen(def: ItemDef): ItemDef {
  if (def.part || def.makes || def.boat || def.airship || def.fare || def.relic || def.unique || def.research.includes('__relic')) return def;
  const age = ageOf(def.cost);
  if (age === 'neolithic') return def;
  const total = Object.values(def.cost).reduce((n, k) => n + (k ?? 0), 0);
  if (total < SIMPLE_BELOW) return def;
  const role = roleOf(def);
  const grade = gradeOf(def, age);
  const depth = age === 'medieval' && grade === 0 ? 1 : 2;
  const cost: Partial<Record<Material, number>> = { ...def.cost };
  const items: Record<string, number> = { ...(def.items ?? {}) };
  const byPart = Object.fromEntries(PARTS.map((p) => [p.id, p]));
  let added = 0;
  // (its main materials first)
  const mats = (Object.entries(def.cost) as [Material, number][]).sort((a, b) => b[1] - a[1]);
  for (const [m, have] of mats) {
    if (added >= depth) break;
    const id = partFor(m, role);
    if (!id || items[id]) continue;
    const per = byPart[id].cost[m] ?? 1;
    if (have < per) continue; // (too little of it to be worth a part)
    const k = Math.min(MAX_OF_A_PART, Math.floor(have / per));
    items[id] = k;
    const left = have - k * per;
    if (left > 0) cost[m] = left;
    else delete cost[m];
    added++;
  }
  if (!added) return def;
  const fit = FITTINGS[age];
  if (added < depth && fit && !items[fit]) items[fit] = 1;
  if (grade === 2) {
    const r = rareFor(def, role, age, mats[0]?.[0]);
    cost[r] = (cost[r] ?? 0) + 1;
  }
  // (in place, so the tables an item comes from and ITEMS hold the same one)
  def.cost = cost;
  def.items = items;
  return def;
}

/** The parts an item takes (its item inputs that are parts). */
export const partsOf = (def: ItemDef): [string, number][] => Object.entries(def.items ?? {}).filter(([id]) => PART_IDS.has(id));
