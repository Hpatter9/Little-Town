// Where prisoners are kept, and where the hurt are nursed (the owner's ask: a prison with beds for taking prisoners;
// the same for healing). A raider is taken alive only while a cell stands free (`cellsOf` in sim/prisoners.ts); the
// prison line grows by upgrade (a stockade of stakes, a stone gaol, an iron-barred prison), each with more cells and
// fewer getting away. The healing buildings have sickbeds (`SICKBEDS`): the downed and the badly hurt are nursed in one
// while there's one free, and only those in a sickbed have the building's healing (sim/sickbeds.ts).

import type { BuildingDef } from './buildings';

export const PRISON_BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'stockade',
    name: 'Stockade',
    layer: 'mid',
    width: 3,
    cost: { wood: 18, stone: 4 },
    buildSeconds: 90,
    purpose: 'A pen of sharpened stakes for prisoners: 3 cells. A raider is taken alive only with a cell free.',
    cells: 3,
    escape: 1,
  },
  {
    id: 'gaol',
    name: 'Gaol',
    layer: 'mid',
    width: 4,
    cost: { stone: 20, lumber: 10, iron: 4 },
    buildSeconds: 200,
    purpose: 'Stone cells with barred doors: 8 prisoners, and half as many get away.',
    research: 'masonry',
    cells: 8,
    escape: 0.5,
  },
  {
    id: 'prison',
    name: 'Prison',
    layer: 'mid',
    width: 5,
    cost: { bricks: 30, steel: 6, lumber: 10 },
    buildSeconds: 320,
    purpose: 'A walled prison of iron-barred cells: 20 prisoners, and few ever get away.',
    research: 'sanitation',
    cells: 20,
    escape: 0.25,
  },
];

/** The prison line, each rebuilt as the next (merged into UPGRADES). */
export const PRISON_UPGRADES: Readonly<Record<string, string>> = { stockade: 'gaol', gaol: 'prison' };

/** Sickbeds in each healing building. */
export const SICKBEDS: Readonly<Record<string, number>> = { healers_hut: 2, infirmary: 4, hospital: 8, trauma_center: 12 };
/** The hurt go to a sickbed below this share of their health (or when struck down), and leave it at `MENDED`. */
export const SICK_AT = 0.5;
export const MENDED = 0.85;
/** In a sickbed they heal at the building's rate, at least this much faster than resting at home. */
export const SICKBED_REST = 1.25;
