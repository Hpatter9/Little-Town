// Battle items a townsperson carries in their own pouch and uses in a fight (the owner's ask: "carry battle items in
// their own inventory too and use them in battle: potions, or special items to help with the fight"). Each is crafted
// at a station that exists already (the apothecary, the smithy, the kiln, the bone carver's, the pharmacy) under the
// research its station asks for, sits in the town's stores like any item, and the town hands it out to its fighters
// (sim/kit.ts `restockKits`) until it uses coin; then the townsfolk buy it at the shop (sim/wages.ts `buyKit`). In a fight `useKitItem` (sim/kit.ts) drinks, throws or lights it when it helps, once.

import { cleanse, grant, heal, hit, inflict, type Effect } from './effects';
import type { IconSheet, ItemDef, Station } from './items';
import type { Material } from './materials';

/** What a kit item does when used. */
export type KitUse =
  | 'heal' // drunk when hurt: a share of the fighter's full health
  | 'mana' // drunk when a caster has run dry: a share of the mana pool
  | 'cure' // clears poison, burning and bleeding
  | 'escape' // slipped away behind when badly hurt: unseen, and hard to hit
  | 'throw' // flung at the foes
  | 'buff'; // used at the start of a fight

export interface KitItem {
  id: string;
  name: string;
  use: KitUse;
  /** Heal and mana: the share of the pool restored. */
  amount?: number;
  /** What it does besides (a status, a burn, a blow): carried out by the action engine (sim/actions.ts). */
  effects: readonly Effect[];
  /** Which is chosen first when several would do (the stronger the higher). */
  rank: number;
  /** The recipe. */
  station: Station;
  cost: Partial<Record<Material, number>>;
  seconds: number;
  research: string[];
  text: string;
  icon: { sheet: IconSheet; x: number; y: number };
}

const P = 'Potion' as const;
export const KIT_ITEMS: readonly KitItem[] = [
  { id: 'healing_potion', name: 'Healing Potion', use: 'heal', amount: 0.4, effects: [], rank: 1, station: 'apothecary', cost: { herbs: 3 }, seconds: 50, research: ['physick'], text: 'Drunk in a fight when hurt: 40% of their health back.', icon: { sheet: P, x: 0, y: 0 } },
  { id: 'greater_healing_potion', name: 'Greater Healing Potion', use: 'heal', amount: 0.75, effects: [], rank: 2, station: 'apothecary', cost: { herbs: 5, glass: 1 }, seconds: 80, research: ['physick', 'glassblowing'], text: 'Drunk in a fight when badly hurt: 75% of their health back.', icon: { sheet: P, x: 2, y: 0 } },
  { id: 'mana_draught', name: 'Mana Draught', use: 'mana', amount: 0.6, effects: [], rank: 1, station: 'apothecary', cost: { herbs: 3, berries: 2 }, seconds: 60, research: ['physick', 'arcane_arts'], text: 'A caster who has run dry drinks it: 60% of their mana back.', icon: { sheet: P, x: 7, y: 0 } },
  { id: 'antidote', name: 'Antidote', use: 'cure', effects: [cleanse('self')], rank: 1, station: 'apothecary', cost: { herbs: 2 }, seconds: 40, research: ['physick'], text: 'Drunk when poisoned, burning or bleeding in a fight: it all stops.', icon: { sheet: P, x: 4, y: 0 } },
  { id: 'smoke_bomb', name: 'Smoke Bomb', use: 'escape', effects: [grant('invisible', 8, 'self')], rank: 1, station: 'kiln', cost: { clay: 1, herbs: 1, fiber: 1 }, seconds: 40, research: ['pottery', 'herbalism'], text: 'Dashed down when badly hurt: eight seconds unseen in the smoke, and no foe can pick them out.', icon: { sheet: P, x: 6, y: 2 } },
  { id: 'oil_flask', name: 'Oil Flask', use: 'throw', effects: [hit(1.1, 'fire', 'foe'), inflict('burn', 6, 'foe', 1, 0.6)], rank: 1, station: 'kiln', cost: { clay: 1, meat: 1 }, seconds: 40, research: ['pottery'], text: 'Flung at a foe: it bursts into fire and keeps burning.', icon: { sheet: P, x: 4, y: 2 } },
  { id: 'throwing_knife', name: 'Throwing Knife', use: 'throw', effects: [hit(1.3, 'physical', 'foe')], rank: 2, station: 'smithy', cost: { iron: 1 }, seconds: 45, research: ['iron_working'], text: 'Thrown at the weakest foe in reach: a sharp blow from range.', icon: { sheet: 'ShortWep', x: 0, y: 0 } },
  { id: 'whetstone', name: 'Whetstone', use: 'buff', effects: [grant('berserk', 30, 'self')], rank: 1, station: 'smithy', cost: { stone: 1, iron: 1 }, seconds: 40, research: ['iron_working'], text: 'Run down the edge before a fight: blows land harder for half a minute.', icon: { sheet: 'Rock', x: 0, y: 1 } },
  { id: 'ward_charm', name: 'Ward Charm', use: 'buff', effects: [grant('protect', 45, 'self')], rank: 2, station: 'bone_carver', cost: { bone: 2, fiber: 1 }, seconds: 50, research: ['bone_tools'], text: 'A carved charm, broken at the start of a fight: a ward that turns a third of every blow for 45 seconds.', icon: { sheet: 'Amulet', x: 0, y: 0 } },
  { id: 'combat_stim', name: 'Combat Stim', use: 'buff', amount: 0.3, effects: [grant('haste', 25, 'self')], rank: 3, station: 'pharmacy', cost: { plastic: 1, glass: 1, herbs: 1 }, seconds: 60, research: ['trauma_surgery'], text: 'A jab of stimulant at the start of a fight: acts faster for 25 seconds, and 30% of their health back.', icon: { sheet: P, x: 7, y: 4 } },
];

export const KIT_BY_ID: Record<string, KitItem> = Object.fromEntries(KIT_ITEMS.map((k) => [k.id, k]));

/** What an item looks like when used (its effects, or for a draught the mend or the glow it gives: data/actFx.ts). */
export const KIT_FX: Record<string, readonly Effect[]> = Object.fromEntries(KIT_ITEMS.map((k) => [k.id, k.effects.length ? k.effects : k.use === 'mana' ? [grant('focus', 6, 'self')] : [heal(1, 'self')]]));

/** The crafting recipes (merged into ITEMS: data/items.ts). */
export const KIT_RECIPES: readonly ItemDef[] = KIT_ITEMS.map((k) => ({
  id: k.id, name: k.name, slot: null, station: k.station, cost: k.cost, seconds: k.seconds, research: k.research, effects: {}, description: `${k.text} Carried in a pouch.`, icon: k.icon,
}));
