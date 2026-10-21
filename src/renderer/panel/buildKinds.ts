// The build menu's groups: what a building is for, worked out from what it has (no list to keep up).

import type { BuildingDef } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { OPERATORS } from '../../shared/data/operators';
import { ITEMS } from '../../shared/data/items';

export const BUILD_KINDS = ['Homes', 'Food and farms', 'Workshops', 'Stores and trade', 'Defence', 'Faith and rest', 'Other'] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

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
