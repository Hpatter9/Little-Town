// What the field buildings grow (DESIGN §15: Garden Plot grows wild grain, Herb Garden grows herbs).
// A field is sown, grows on its own (not in winter), and is harvested; then it's sown again.

import type { Material } from './materials';

export interface CropDef {
  material: Material;
  /** Harvest at Farming 1 (better farmers get more). */
  yield: number;
  /** Game hours from sowing to ripe, in spring and summer. */
  growHours: number;
  /** Base seconds of work to sow, and to harvest. */
  sowSeconds: number;
  harvestSeconds: number;
  /** Grows indoors: no seasons, no weather. */
  indoor?: boolean;
  /** Hardy: grows through autumn at full speed (roots and cabbages). */
  hardy?: boolean;
  /** Trees: planted once, and this many game hours (growing seasons only) before the first crop; then they fruit
   *  again without being sown, and don't tire the soil. */
  establishHours?: number;
}

export const CROPS: Readonly<Record<string, CropDef>> = {
  garden_plot: { material: 'grain', yield: 10, growHours: 18, sowSeconds: 25, harvestSeconds: 30 },
  herb_garden: { material: 'herbs', yield: 5, growHours: 14, sowSeconds: 20, harvestSeconds: 20 },
  open_field: { material: 'grain', yield: 24, growHours: 18, sowSeconds: 40, harvestSeconds: 50 },
  estate_farm: { material: 'grain', yield: 34, growHours: 16, sowSeconds: 35, harvestSeconds: 40 },
  flax_field: { material: 'fiber', yield: 8, growHours: 20, sowSeconds: 25, harvestSeconds: 30 },
  vegetable_patch: { material: 'vegetables', yield: 9, growHours: 15, sowSeconds: 25, harvestSeconds: 25, hardy: true },
  orchard: { material: 'fruit', yield: 14, growHours: 30, sowSeconds: 60, harvestSeconds: 40, establishHours: 60 },
  hydroponics_bay: { material: 'grain', yield: 16, growHours: 12, sowSeconds: 20, harvestSeconds: 25, indoor: true },
};

/** Workplaces that yield without end (the Mine): a load per `seconds` of work, `workers` at a time. */
export interface WorkplaceDef {
  outputs: Partial<Record<Material, number>>;
  seconds: number;
  workers: number;
}

export const WORKPLACES: Readonly<Record<string, WorkplaceDef>> = {
  mine: { outputs: { iron_ore: 3, stone: 2 }, seconds: 40, workers: 2 },
  coal_mine: { outputs: { coal: 4, stone: 1 }, seconds: 40, workers: 3 },
  oil_derrick: { outputs: { oil: 4 }, seconds: 40, workers: 2 },
  deep_mine: { outputs: { rare_minerals: 2, stone: 2 }, seconds: 45, workers: 3 },
};

/** Growth speed by season. */
export const SEASON_GROWTH = { spring: 1, summer: 1.2, autumn: 0.6, winter: 0 } as const;
/** Extra harvest per Farming level above 1. */
export const YIELD_PER_LEVEL = 0.08;

/** The soil (a field's `soil`: 1 is good ground, and the harvest is multiplied by it). Each harvest of a sown crop
 *  tires it; it rests while fallow (and all winter), and muck from the town's pens mends it. A tired field is left to
 *  rest a while unless the town is going hungry. */
export const SOIL = { start: 1, min: 0.3, max: 1.2, drain: 0.1, restPerDay: 0.12, manurePerPen: 0.02, manureMax: 0.1, tired: 0.5 } as const;

/** Blight (checked once a day, for each outdoor field with a crop in the ground): the chance it strikes, more in the
 *  wet and where many fields grow the same crop (it spreads between them); trees take it better. */
export const BLIGHT = { chance: 0.012, wet: 1.8, perSame: 0.35, spread: 0.4, trees: 0.4 } as const;
