// Which doors are dressed for the season, and with what (map/seasonDecor.ts draws them). Pure, so it is tested.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import type { Building } from '../../shared/sim/state';

/** Whether a building is dressed for the season: a home or a venue, finished, not a castle's room. */
export function dressed(b: Building, def = BUILDING_BY_ID[b.def]): boolean {
  return b.status === 'done' && !b.room && !!def && (!!def.housing || !!def.floor);
}

/** What a door gets in a season, by the building's id: nothing on every third door. */
export function decorFor(season: string, id: number): ('plant' | 'gourds' | 'sheaf' | 'lantern' | 'wreath')[] {
  if (id % 3 === 2) return [];
  if (season === 'winter') return id % 2 ? ['lantern', 'wreath'] : ['wreath'];
  if (season === 'autumn') return id % 2 ? ['gourds', 'sheaf'] : ['gourds'];
  return ['plant'];
}

