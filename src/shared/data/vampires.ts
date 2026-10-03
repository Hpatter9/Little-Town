// The Blood Court's blood (the owner's request: blood as a resource, a blood farm, tithes, prisoners kept and bled).
// Blood is a material (data/materials.ts). It comes of the thralls' tithe each dusk, of the pens' beasts, and of
// prisoners kept in the blood farm's cells (sim/vampires.ts); the vampires drink from the store before they bite
// anyone, and the surplus is brewed into blood wine for the shop (data/items.ts). The Court's thralls take the
// fallen alive more often than others (`captives` in its rules: sim/prisoners.ts).
import type { BuildingDef } from './buildings';

/** The dusk hour the tithe is taken, what each living grown thrall gives, and what a beast and a prisoner give a day. */
export const TITHE_HOUR = 19;
export const TITHE_PER_THRALL = 0.5;
export const BLOOD_PER_HEAD = 0.25;
export const BLOOD_PER_PRISONER = 1;
/** A vampire's feeding drinks this much from the store. */
export const BLOOD_PER_FEED = 1;
/** How many prisoners a blood farm's cells hold (bled daily, and hard to escape from). */
export const FARM_CELLS = 4;
/** Escapes from the cells are this much rarer. */
export const FARM_ESCAPE = 0.25;

/** The blood farm: cells for the Court's prisoners (theirs alone, from the Medieval age). */
export const BLOOD_FARM: BuildingDef = {
  id: 'blood_farm',
  name: 'Blood Farm',
  layer: 'mid',
  width: 3,
  cost: { stone: 16, iron: 6, lumber: 8 },
  buildSeconds: 180,
  purpose: `Cells where the Court's prisoners are kept and bled: ${FARM_CELLS} to a farm, a measure of blood each a day, and few get away.`,
  origin: 'vampire',
  era: 'medieval',
};
