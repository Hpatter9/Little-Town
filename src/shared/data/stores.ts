// The town's specialty shops (the owner's ask): beside the general store (Trading Post → General Store → Emporium),
// a Furniture Maker, a Weapons Store, an Armour Store and an Apothecary Shop. Each is a venue of the `shop` kind with
// a `line`: its own customers come for that line only (furniture, weapons, armour, medicine), its keeper sets out its
// shelves and racks like any shopkeeper, its stock is on show inside, and a banner out front says what it sells.
// Once a specialty shop is open, the general store stops taking the customers it serves (sim/shop.ts).

import type { BuildingDef } from './buildings';

export type ShopLine = 'furniture' | 'weapons' | 'armour' | 'medicine';
export const SHOP_LINES: readonly ShopLine[] = ['furniture', 'weapons', 'armour', 'medicine'];

export interface LineDef {
  /** The shop's building id. */
  store: string;
  /** What a customer comes for, in words ("furniture"), and what the banner says. */
  label: string;
  banner: string;
  /** The keeper's title. */
  keeper: string;
  /** The banner's cloth and trim. */
  cloth: number;
  trim: number;
  /** The inside: walls, the wall's trim, the floor's two shades (sim-free: the panel draws them). */
  wall: string;
  wallTrim: string;
  floor: [string, string];
}

export const LINES: Readonly<Record<ShopLine, LineDef>> = {
  furniture: { store: 'furniture_store', label: 'furniture', banner: 'Furniture', keeper: 'Furniture Seller', cloth: 0x7a5230, trim: 0xe0c070, wall: '#d8c39a', wallTrim: '#9a7444', floor: ['#b08350', '#a0753f'] },
  weapons: { store: 'weapon_store', label: 'a weapon', banner: 'Weapons', keeper: 'Arms Dealer', cloth: 0x8a2020, trim: 0xd8d8d8, wall: '#6a3a32', wallTrim: '#3a2018', floor: ['#7a7a80', '#6c6c72'] },
  armour: { store: 'armour_store', label: 'armour', banner: 'Armour', keeper: 'Armourer', cloth: 0x2c4a7a, trim: 0xc0c8d0, wall: '#5a6470', wallTrim: '#30363e', floor: ['#8a8070', '#7c7262'] },
  medicine: { store: 'apothecary_shop', label: 'medicine', banner: 'Apothecary', keeper: 'Apothecary', cloth: 0x2e6a3a, trim: 0xf0e0a0, wall: '#4f6a48', wallTrim: '#2c3c28', floor: ['#5a4632', '#4e3c2a'] },
};

/** The specialty shops' buildings (merged into BUILDINGS). Each opens with a Medieval craft and is built once the
 *  town has its general store. */
export const STORE_BUILDINGS: readonly BuildingDef[] = [
  { id: 'furniture_store', name: 'Furniture Maker', layer: 'mid', width: 3, cost: { lumber: 14, stone: 6 }, buildSeconds: 120, research: 'carpentry', purpose: 'A shop of chairs, tables, chests and beds: travellers come for furniture, and buy what the town has made. Its own banner out front.', floor: { venue: 'shop', line: 'furniture', cols: 8, rows: 5, appeal: 0 } },
  { id: 'weapon_store', name: 'Weapons Store', layer: 'mid', width: 3, cost: { lumber: 12, stone: 10, iron: 4 }, buildSeconds: 140, research: 'iron_working', purpose: 'Blades, bows and spears on the racks: travellers come for a weapon, and the town sells what it has spare. Its own banner out front.', floor: { venue: 'shop', line: 'weapons', cols: 8, rows: 5, appeal: 0 } },
  { id: 'armour_store', name: 'Armour Store', layer: 'mid', width: 3, cost: { lumber: 12, stone: 10, leather: 4 }, buildSeconds: 140, research: 'armoring', purpose: 'Mail, helms and shields on stands: travellers come for armour, and the town sells what it has spare. Its own banner out front.', floor: { venue: 'shop', line: 'armour', cols: 8, rows: 5, appeal: 0 } },
  { id: 'apothecary_shop', name: 'Apothecary Shop', layer: 'mid', width: 3, cost: { lumber: 10, stone: 8, herbs: 6 }, buildSeconds: 120, research: 'physick', purpose: 'Jars of salve and bundles of herbs on the shelves: travellers come for medicine, and buy what the town has made. Its own banner out front.', floor: { venue: 'shop', line: 'medicine', cols: 8, rows: 5, appeal: 0 } },
];

/** Grown-ups a town needs before it opens a specialty shop (it has enough to do before then). */
export const STORE_PEOPLE = 6;
/** Of each line, how many pieces the town keeps in stock for its shop's customers. */
export const LINE_STOCK = 3;
