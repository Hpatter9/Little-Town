// The alchemists' Great Work (the origins made deeper, the third; sim/greatWork.ts). Every morning the Crucible's
// best mind runs an experiment: a transmutation (base matter into better), or a potion brewed for the town. Some go
// wrong, and some go wrong loudly. Each that works brings the Great Work on, through the five stages of the old texts,
// each opened by its offering, to the Philosopher's Stone: the Elixir of Life, and the game won.

import type { Material } from './materials';
import type { Era } from './eras';

/** The hour of the day's experiment. */
export const WORK_HOUR = 10;
/** An experiment's odds: this, and this more for each level of Research the alchemist has, at most `ODDS_MOST`. */
export const ODDS_BASE = 0.5;
export const ODDS_PER_LEVEL = 0.015;
export const ODDS_MOST = 0.9;
/** A failed experiment explodes this often: the alchemist hurt (`BLAST_HURT` of their health), and now and then the
 *  workshop alight (`FIRE_CHANCE`). */
export const BLAST_CHANCE = 0.45;
export const BLAST_HURT = 0.25;
export const FIRE_CHANCE = 0.15;

export interface Transmutation {
  id: string;
  from: Material;
  fromN: number;
  to: Material;
  toN: number;
  /** From this age on. */
  era: Era;
  /** Great Work progress for a success. */
  progress: number;
}
/** What may be made of what (the best the town can manage, with the base matter in store). */
export const TRANSMUTATIONS: readonly Transmutation[] = [
  { id: 'clay_copper', from: 'clay', fromN: 8, to: 'copper', toN: 2, era: 'neolithic', progress: 1 },
  { id: 'stone_tin', from: 'stone', fromN: 10, to: 'tin_ore', toN: 3, era: 'neolithic', progress: 1 },
  { id: 'copper_silver', from: 'copper', fromN: 4, to: 'silver', toN: 2, era: 'medieval', progress: 2 },
  { id: 'iron_silver', from: 'iron', fromN: 4, to: 'silver', toN: 2, era: 'medieval', progress: 2 },
  { id: 'silver_gold', from: 'silver', fromN: 3, to: 'gold', toN: 2, era: 'medieval', progress: 3 },
  { id: 'coal_gems', from: 'coal', fromN: 8, to: 'gems', toN: 1, era: 'industrial', progress: 3 },
];

export interface Potion {
  id: string;
  name: string;
  /** The herbs (and more) it takes. */
  needs: Partial<Record<Material, number>>;
  lever: 'work' | 'fight' | 'research' | 'build' | 'crops';
  mult: number;
  hours: number;
  /** What goes wrong when it does: a sickness, or a sour mood. */
  misfire: 'sick' | 'mood';
  progress: number;
}
export const POTIONS: readonly Potion[] = [
  { id: 'vigour', name: 'Draught of Vigour', needs: { herbs: 4, berries: 4 }, lever: 'work', mult: 1.2, hours: 24, misfire: 'mood', progress: 1 },
  { id: 'wrath', name: 'Philtre of Wrath', needs: { herbs: 4, sulphur: 1 }, lever: 'fight', mult: 1.25, hours: 36, misfire: 'sick', progress: 1 },
  { id: 'insight', name: 'Tincture of Insight', needs: { herbs: 6 }, lever: 'research', mult: 1.3, hours: 24, misfire: 'mood', progress: 1 },
  { id: 'growth', name: 'Elixir of Growth', needs: { herbs: 3, bone: 3 }, lever: 'crops', mult: 1.3, hours: 48, misfire: 'sick', progress: 1 },
];

export interface Stage {
  name: string;
  /** Progress to reach it, and what's offered to the athanor when it's reached. */
  at: number;
  offering: Partial<Record<Material, number>>;
  /** The age it needs. */
  era: Era;
  story: string;
  /** What it opens. */
  gift: string;
}
/** The five stages of the Great Work. The fourth makes gold of nothing each week; the fifth is the Stone. */
export const STAGES: readonly Stage[] = [
  {
    name: 'Nigredo, the Blackening',
    at: 8,
    offering: { herbs: 6, bone: 4 },
    era: 'neolithic',
    story: 'In the athanor the matter rotted to a black as deep as a well, and the Crucible\'s eldest wept to see it: the first stage, the death before the rebirth. From now on their transmutations come easier.',
    gift: 'Transmutations are likelier to work.',
  },
  {
    name: 'Albedo, the Whitening',
    at: 22,
    offering: { silver: 3, herbs: 8 },
    era: 'medieval',
    story: 'Washed and washed again, the black matter turned white as moonlight. In the flask beside it something small stirred and opened its eyes: the first homunculus, asking in a tiny voice what it should do.',
    gift: 'Homunculi are grown: small helpers who make the whole town work faster.',
  },
  {
    name: 'Citrinitas, the Yellowing',
    at: 42,
    offering: { gold: 3, sulphur: 4 },
    era: 'medieval',
    story: 'The white matter caught the light and turned the yellow of dawn, and its smell filled the town with something like hope. The alchemists brewed the first true elixir from it, and every hurt in town closed overnight.',
    gift: 'Each week an elixir mends every wound in town.',
  },
  {
    name: 'Rubedo, the Reddening',
    at: 70,
    offering: { gold: 6, gems: 3 },
    era: 'industrial',
    story: 'Red at last, the red of a heart: the matter of the Great Work is all but finished. A drop of it on lead and the lead was gold. The treasury will never be empty again, though the old texts warn what greed does to an alchemist.',
    gift: 'Each week the athanor makes gold of base matter: coins for the treasury.',
  },
  {
    name: 'The Philosopher\'s Stone',
    at: 110,
    offering: { gold: 10, gems: 6, silver: 6 },
    era: 'industrial',
    story: 'It is done. In the athanor lies a stone no bigger than a plum, red as a coal and heavy as a mountain, and from it the Crucible draws the Elixir of Life. Death has no claim on this town now. Every alchemist who ever lived searched for this, and it was found here.',
    gift: 'The Elixir of Life: the Great Work is complete, and the game is won.',
  },
];

/** Homunculi (from Albedo): one grown every `HOMUNCULUS_DAYS`, up to `HOMUNCULI_MOST`; each makes the town work
 *  `HOMUNCULUS_WORK` faster. Now and then one runs off (`HOMUNCULUS_ESCAPE` a week). */
export const HOMUNCULUS_DAYS = 5;
export const HOMUNCULI_MOST = 4;
export const HOMUNCULUS_WORK = 0.05;
export const HOMUNCULUS_ESCAPE = 0.15;
export const HOMUNCULUS_NAMES = ['Pip', 'Wort', 'Flask', 'Tincture', 'Ember', 'Glim', 'Mote', 'Quill', 'Soot', 'Bramble'];
/** Citrinitas and on: each week (the day of the week `WEEKLY_DAY`) every wound mended; Rubedo and on: `RUBEDO_COINS`. */
export const WEEKLY_DAY = 7;
export const RUBEDO_COINS = 150;
