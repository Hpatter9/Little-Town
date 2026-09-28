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
}

export const CROPS: Readonly<Record<string, CropDef>> = {
  garden_plot: { material: 'grain', yield: 10, growHours: 18, sowSeconds: 25, harvestSeconds: 30 },
  herb_garden: { material: 'herbs', yield: 5, growHours: 14, sowSeconds: 20, harvestSeconds: 20 },
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
