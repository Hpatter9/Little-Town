// What the town makes of its hills and mountains (sim/relief.ts; the owner's ask: "the town either has to use it, mine
// it, build into it, tunnel through it, or go around it"). The quarry, set against a face of rock and worked without
// end, and what each land's rock holds besides its stone; the buildings that may be cut into a cliff where the town
// finds no flat ground (`intoRock` in data/buildings.ts); what hill ground does for fields, orchards and herds.
import type { BuildingDef } from './buildings';
import type { Biome } from './biomes';
import type { Material } from './materials';

export const QUARRY = 'quarry';
export const QUARRY_BUILDING: BuildingDef = {
  id: QUARRY,
  name: 'Quarry',
  layer: 'mid',
  width: 3,
  cost: { wood: 12, fiber: 4 },
  buildSeconds: 80,
  purpose: 'Cut into a face of rock: gatherers quarry stone here without end, and whatever else the rock of the land holds.',
  againstRock: true,
};

/** Besides its stone, what a load from a quarry holds in each land; and the lands whose rock gives a gem every
 *  `QUARRY_GEM_EVERY` loads. */
export const QUARRY_VEINS: Readonly<Record<Biome, Partial<Record<Material, number>>>> = {
  forest: { flint: 1 },
  desert: { copper_ore: 1 },
  tundra: { tin_ore: 1 },
  coast: { flint: 1 },
  swamp: { clay: 1 },
  jungle: { copper_ore: 1 },
  highlands: { iron_ore: 1 },
  ashlands: { sulphur: 1 },
  steppe: { flint: 1 },
  taiga: { tin_ore: 1 },
};
export const QUARRY_GEMS: ReadonlySet<Biome> = new Set(['highlands', 'ashlands', 'desert']);
export const QUARRY_GEM_EVERY = 6;

/** The most buildings a town cuts into a cliff when it has flat ground too (more when it has none). */
export const ROCK_FEW = 3;

/** What the hills do for the land's work: a field on the downs yields less (thin soil, a slope to plough), an orchard
 *  or a vineyard on them more (the sun on a slope, the cold air draining off); a herd grazed there more. By the share
 *  of the footprint on hill ground. */
export const HILL_FIELD = 0.9;
export const HILL_ORCHARD = 1.25;
export const HILL_GRAZING = 1.2;
/** The crops that like a slope. */
export const SLOPE_CROPS: ReadonlySet<string> = new Set(['orchard', 'vineyard']);
/** Up on the high ground a watchtower sees further, and a tower's shots carry further (a share more). */
export const HIGH_SIGHT = 1.25;
/** And the wind blows stronger there: a windmill grinds faster. */
export const HIGH_WIND = 1.25;
