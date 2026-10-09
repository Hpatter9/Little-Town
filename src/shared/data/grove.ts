// The druids' living grove (the origins made deeper, the first; sim/grove.ts). A druid town lives by the grove's
// favour: felling the wild angers it, letting it grow back and keeping the rites pleases it. Pleased, it blesses the
// fields and the foraging and sends beasts to guard the town; angered, its thorns cut, its blight withers the crops, and
// the wolves come. Four rites mark the turning of the seasons.

import type { EnemyDef } from './enemies';
import type { Material } from './materials';
import type { Season } from '../sim/time';

/** The hour each morning the grove's favour moves, and the evening hour the rites are kept. */
export const GROVE_HOUR = 6;
export const RITE_HOUR = 19;
/** Favour (−100..100): each forest cell felled costs this, each cell grown back gives that; it drifts this far
 *  toward nothing each morning. */
export const FELL_FAVOUR = 1;
/** The grove forgives this many cells felled a day: what a town needs. */
export const FELL_ALLOWANCE = 6;
/** The most a day's felling costs (a great clearing, the ring wall's line: it bites, but slowly). */
export const FELL_MOST = 10;
export const REGROW_FAVOUR = 2;
export const FAVOUR_DRIFT = 2;
/** Each morning the druids tend the young woods: so many cleared cells are hurried on to grow back, for this favour. */
export const TEND_CELLS = 3;
export const TEND_FAVOUR = 1;
/** Pleased at or over this, the grove blesses the day's fields and foraging (a mark: `BLESS_MULT`); angered at or under
 *  that, it curses them (`CURSE_MULT`), its thorns may cut a woodcutter (`THORN_CHANCE`), and the wolves may come
 *  (`WOLVES_CHANCE` a morning). */
export const BLESSED_AT = 35;
export const ANGRY_AT = -35;
export const BLESS_MULT = 1.15;
export const CURSE_MULT = 0.85;
export const THORN_CHANCE = 0.35;
export const WOLVES_CHANCE = 0.2;
export const WOLVES_RAID = 'wolves';

/** The beasts the grove sends to guard a town it favours: one every `GUARDIAN_DAYS` at `GUARDIAN_AT` or more, up to
 *  `GUARDIANS_MOST`; they fight beside the town in every raid, and a guardian struck down there is lost. An angered
 *  grove calls one back each morning. */
export const GUARDIAN_AT = 25;
export const GUARDIAN_DAYS = 4;
export const GUARDIANS_MOST = 3;
export const GUARDIAN_LEAVES_AT = -20;

export interface GuardianKind {
  kind: string;
  beast: string;
  names: string[];
  /** Lands it comes from (any when left out). */
  biomes?: string[];
}
export const GUARDIAN_KINDS: readonly GuardianKind[] = [
  { kind: 'grove_wolf', beast: 'wolf', names: ['Greymane', 'Ashpaw', 'Silverback', 'Old Tooth', 'Moonshadow', 'Frostfang'] },
  { kind: 'grove_bear', beast: 'bear', names: ['Oakheart', 'Mossback', 'Old Grumble', 'Barkhide', 'Honeypaw'], biomes: ['forest', 'taiga', 'highlands', 'tundra', 'jungle'] },
  { kind: 'grove_boar', beast: 'boar', names: ['Tusker', 'Rootgrubber', 'Bristleback', 'Thornhide'], biomes: ['forest', 'swamp', 'jungle', 'steppe'] },
];

export const GROVE_ENEMIES: Record<string, EnemyDef> = {
  grove_wolf: { id: 'grove_wolf', name: 'Grove Wolf', hp: 70, damage: [6, 11], accuracy: 0.78, dodge: 0.16, interval: 1.0, ranged: false, loot: {}, sprite: { sheet: 'wolf', block: 3, scale: 1.1 } },
  grove_bear: { id: 'grove_bear', name: 'Grove Bear', hp: 160, damage: [11, 18], accuracy: 0.72, dodge: 0.05, interval: 1.6, ranged: false, loot: {}, sprite: { sheet: 'bear', block: 5, scale: 1.3 } },
  grove_boar: { id: 'grove_boar', name: 'Grove Boar', hp: 95, damage: [8, 13], accuracy: 0.66, dodge: 0.08, interval: 1.3, ranged: false, loot: {}, sprite: { sheet: 'boar', block: 0, scale: 1.2 } },
};

/** The four rites, one at the turn of each season: what's offered, and what the grove gives back. */
export interface Rite {
  name: string;
  /** What's laid on the stones (a rite kept without it is poor: half its gift, and the grove sulks). */
  offering: Partial<Record<Material, number>>;
  favour: number;
  /** A mark on a lever for some hours (crops, forage, work, morale). */
  mark?: { lever: 'crops' | 'forage' | 'work' | 'morale'; value: number; hours: number; text: string };
  /** Food the grove gives up (the autumn's). */
  gift?: Partial<Record<Material, number>>;
  /** Everyone's wounds eased (the winter's). */
  heal?: number;
  story: string;
}
export const RITES: Record<Season, Rite> = {
  spring: {
    name: 'The Greening',
    offering: { grain: 6, herbs: 3 },
    favour: 10,
    mark: { lever: 'crops', value: 1.25, hours: 72, text: 'The Greening' },
    story: 'At dusk the circle carried seed to the stones and pressed it into the wet earth with bare hands, singing the old words for rain and root. The grove listened. For three days the fields will grow as if summer had come early.',
  },
  summer: {
    name: 'The Midsummer Fire',
    offering: { wood: 10 },
    favour: 8,
    mark: { lever: 'morale', value: 8, hours: 48, text: 'The Midsummer Fire' },
    story: 'The great fire was built on the shortest night and everyone leapt it, the young ones twice. The grove watched from the dark with a thousand green eyes. Spirits will run high for days.',
  },
  autumn: {
    name: 'The Reaping',
    offering: { fruit: 4 },
    favour: 12,
    gift: { berries: 15, herbs: 6 },
    story: 'The first sheaf and the best of the fruit were laid on the stones, and the circle walked the woods\' edge giving thanks. The grove gave back: the bushes hung heavy and the herb beds came up thick overnight.',
  },
  winter: {
    name: 'The Long Night',
    offering: { herbs: 4 },
    favour: 6,
    heal: 0.5,
    story: 'On the longest night the circle sat with the sleeping trees and told the names of everyone who had died that year. The grove slept, but it heard. In the morning the hurt woke easier, their wounds half closed.',
  },
};

/** The grove's moods by favour, for the view. */
export const GROVE_MOODS: [number, string][] = [
  [60, 'The grove sings'],
  [35, 'The grove is pleased'],
  [10, 'The grove is at ease'],
  [-10, 'The grove watches'],
  [-35, 'The grove is uneasy'],
  [-60, 'The grove is angry'],
  [-101, 'The grove is wrathful'],
];
