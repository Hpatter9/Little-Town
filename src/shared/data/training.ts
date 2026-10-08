// Where troops are trained (the owner's ask: "units shouldn't be created unless there is the corresponding building to
// train them, like a barracks, an archery range"). Each kind of troop is trained at one of a few buildings
// (`TRAINED_AT`); the War tab's barracks refuse a kind with none standing (sim/conquest/squads.ts `canRaise`). The
// buildings are merged into BUILDINGS; the town raises them itself once it's `WAR_PEOPLE` strong (planner.ts).

import type { BuildingDef } from './buildings';
import type { TroopDef } from './troops';

/** Grown-ups before the town raises its training grounds. */
export const WAR_PEOPLE = 6;

export const TRAINING_BUILDINGS: readonly BuildingDef[] = [
  { id: 'drill_yard', name: 'Drill Yard', layer: 'mid', width: 3, depth: 2, cost: { wood: 14, hide: 2 }, buildSeconds: 90, purpose: 'Recruits drill here with club, spear and shield: militia, spearmen, skirmishers and the line.' },
  { id: 'archery_range', name: 'Archery Range', layer: 'mid', width: 3, depth: 1, cost: { wood: 12, fiber: 4 }, buildSeconds: 80, purpose: 'Butts and a mark to shoot at: slingers, archers, crossbowmen and every gun after them train here.' },
  { id: 'kennels', name: 'Kennels', layer: 'mid', width: 3, depth: 2, cost: { wood: 12, hide: 4 }, buildSeconds: 90, purpose: 'Where war hounds and the pack\'s wolves are bred and trained to the fight.', research: 'domestication' },
  { id: 'arcane_academy', name: 'Arcane Academy', layer: 'mid', width: 3, depth: 3, cost: { stone: 24, lumber: 12, herbs: 6 }, buildSeconds: 220, purpose: 'Battlemages and the alchemists\' bombardiers learn their fire here.', research: 'arcane_arts' },
  { id: 'siege_workshop', name: 'Siege Workshop', layer: 'mid', width: 4, depth: 2, cost: { lumber: 20, iron: 4 }, buildSeconds: 200, purpose: 'Rams and mantlets are built, and their crews trained, here.', research: 'siege_engines' },
];

/** Where a troop is trained: by its kind, or (magic from the back row) at the academy. */
export function trainedAt(t: Pick<TroopDef, 'kind' | 'magic'>): readonly string[] {
  if (t.magic) return ['arcane_academy'];
  switch (t.kind) {
    case 'ranged':
      return ['archery_range'];
    case 'horse':
      return ['stable'];
    case 'beast':
      return ['kennels'];
    case 'healer':
      return ['healers_hut', 'infirmary', 'hospital', 'trauma_center'];
    case 'siege':
      return ['siege_workshop'];
    case 'magic':
      return ['arcane_academy'];
    default:
      return ['drill_yard', 'barracks'];
  }
}
