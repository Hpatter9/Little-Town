// The build menu's groups: what a building is for, worked out from what it has (no list to keep up).

import type { BuildingDef } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { OPERATORS } from '../../shared/data/operators';
import { ITEMS } from '../../shared/data/items';

export const BUILD_KINDS = ['Homes', 'Food and farms', 'Workshops', 'Stores and trade', 'Defence', 'Faith and rest', 'Other'] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

/** The build menu's tabs: the kinds above, folded into four. */
export const BUILD_TABS = ['Homes and food', 'Work', 'Defence', 'Town'] as const;
export type BuildTab = (typeof BUILD_TABS)[number];
const TAB_OF_KIND: Record<BuildKind, BuildTab> = { Homes: 'Homes and food', 'Food and farms': 'Homes and food', Workshops: 'Work', 'Stores and trade': 'Work', Defence: 'Defence', 'Faith and rest': 'Town', Other: 'Town' };
export const tabOf = (def: BuildingDef): BuildTab => TAB_OF_KIND[kindOf(def)];

const STATIONS = new Set(ITEMS.map((i) => i.station as string));

export function kindOf(def: BuildingDef): BuildKind {
  if (def.housing) return 'Homes';
  if (CROPS[def.id] || def.layer === 'back') return 'Food and farms';
  if (def.defense || def.hp || def.warningMinutes || def.cells) return 'Defence';
  if (def.floor || def.storage || def.stalls) return 'Stores and trade';
  if (STATIONS.has(def.id) || OPERATORS[def.id]) return 'Workshops';
  if (def.morale || def.healing || def.arrivals) return 'Faith and rest';
  return 'Other';
}

/** One short line on why you'd build it, from what it gives the town. */
export function whyOf(def: BuildingDef): string {
  if (def.housing) return `Beds for ${def.housing}: a town with no bed to spare gets no newcomers.`;
  if (CROPS[def.id]) return 'Food: the town starves without fields.';
  if (def.defense) return 'Raiders are met here before they reach the homes.';
  if (def.warningMinutes) return 'Time to arm: raiders are seen coming.';
  if (def.cells) return 'Somewhere to hold the raiders taken alive.';
  if (def.storage) return 'Room for more goods before the stores overflow.';
  if (def.floor) return def.floor.venue === 'tavern' ? 'Travellers eat and drink here, and spend.' : 'Travellers buy here: coins for the treasury.';
  if (def.healing) return 'The hurt mend faster.';
  if (def.morale) return 'Lifts spirits: low spirits slow work and bring trouble.';
  if (def.arrivals) return 'More wanderers find the town.';
  if (STATIONS.has(def.id) || OPERATORS[def.id]) return 'Lets the town make more, and a townsperson takes the work.';
  return 'The town has learned to build it.';
}
