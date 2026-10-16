// The ranks a town holds (sim/tiers.ts) and the firsts it keeps (sim/milestones.ts): the names, the thresholds and the
// lines. The owner's ask: progress you can see at every timescale, without a chore.

import type { OriginId } from './origins';

/** The seven rungs, Camp to City. A people may call them by its own names (`TIER_NAMES`). */
export const TIER_COUNT = 7;
export type TierNames = readonly [string, string, string, string, string, string, string];

export const DEFAULT_TIERS: TierNames = ['Camp', 'Hamlet', 'Village', 'Market Town', 'Walled Town', 'Town', 'City'];

/** Peoples with a ladder of their own (the rest use the default). */
export const TIER_NAMES: Partial<Record<OriginId, TierNames>> = {
  dwarves: ['Delving', 'Burrow', 'Hold', 'Market Hold', 'Fortress Hold', 'Great Hold', 'Deep Kingdom'],
  vampire: ['Coven', 'Brood House', 'Manor', 'Night Market', 'Walled Court', 'Dark Court', 'Dominion'],
  nomads: ['Band', 'Clan', 'Tribe', 'Trading Tribe', 'Great Camp', 'Nation', 'Wandering Realm'],
  knights: ['Outpost', 'Garrison', 'Manor', 'Market Town', 'Walled Town', 'Fief', 'Kingdom'],
  orcs: ['War Camp', 'Warren', 'Clan Hold', 'Market Hold', 'Palisade Hold', 'Horde Seat', 'Warlord’s Realm'],
  lich: ['Barrow', 'Charnel Hamlet', 'Necropolis Ward', 'Bone Market', 'Walled Necropolis', 'Necropolis', 'Dead City'],
  robot: ['Outpost', 'Node', 'Cluster', 'Exchange', 'Fenced Cluster', 'Hub', 'Megacity'],
};

export const tierNames = (origin: OriginId | undefined): TierNames => (origin && TIER_NAMES[origin]) || DEFAULT_TIERS;

/** What a rung asks of the town: people living here, buildings standing (not walls or fields), the day, and a few things
 *  that must stand: a market, the wall closed all round (a hold or a camp without a ring: more buildings instead), the
 *  seat at a stage (its age). Index = the rung. */
export interface TierRule {
  pop: number;
  buildings: number;
  day: number;
  market?: true;
  wall?: true;
  seat?: number;
}
export const TIER_RULES: readonly TierRule[] = [
  { pop: 0, buildings: 0, day: 0 },
  { pop: 6, buildings: 4, day: 3 },
  { pop: 10, buildings: 9, day: 8 },
  { pop: 16, buildings: 15, day: 15, market: true },
  { pop: 24, buildings: 22, day: 30, market: true, wall: true },
  { pop: 36, buildings: 35, day: 60, market: true, wall: true, seat: 2 },
  { pop: 60, buildings: 55, day: 120, market: true, wall: true, seat: 3 },
];
/** Without a ring (a hold, a castle, a camp on the move) the wall rung asks this many more buildings instead. */
export const NO_RING_EXTRA = 8;
/** A town keeps its rung while it has this share of what the rung asks (so one death does not drop it). */
export const TIER_SLACK = 0.8;

/** What each rise is told as: a line in the game's voice. */
export const TIER_RISE_LINES: readonly string[] = [
  '',
  'A few roofs and a cookfire: the place has a name now.',
  'Smoke from a dozen chimneys. Travellers can find us from the road.',
  'The market draws strangers and coin; people start to say we are going somewhere.',
  'A wall all round: now the night is shorter.',
  'Too many hearths to count. Children are born who have never seen the empty valley.',
  'A true city, with streets whose names nobody remembers choosing.',
];
export const TIER_FALL_LINE = 'We are fewer than we were. The place is smaller for it, but it stands.';

/** The rank a town is when none has been reckoned. */
export const article = (name: string): string => (/^[aeiou]/i.test(name) ? 'an' : 'a');

/* ---------------------------------------------------------------- the firsts */

export type MilestoneId =
  | 'wall' | 'child' | 'death' | 'wedding' | 'harvest' | 'caravan' | 'raidWon' | 'raidLost' | 'mythic' | 'unique'
  | 'day100' | 'generation' | 'village';

export interface MilestoneDef {
  id: MilestoneId;
  title: string;
  line: string;
  /** A stat icon name (renderer/ui/icon.ts). */
  icon: string;
}

export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'wall', title: 'The wall is closed', line: 'Stone meets stone at the last gap. Inside, the town breathes out.', icon: 'defence' },
  { id: 'child', title: 'A child is born', line: 'The first cry in a place that was only grown-ups. It will not be quiet again.', icon: 'people' },
  { id: 'death', title: 'The first death', line: 'We have a grave now, and so a place that is truly ours.', icon: 'skull' },
  { id: 'wedding', title: 'The first wedding', line: 'Two hands joined before the whole town, and a feast to follow.', icon: 'good' },
  { id: 'harvest', title: 'The first harvest home', line: 'The grain is in and the winter is not so long for it.', icon: 'food' },
  { id: 'caravan', title: 'The first caravan', line: 'Strangers with wagons came to buy and sell. We are on someone’s map.', icon: 'coins' },
  { id: 'raidWon', title: 'The first raid driven off', line: 'They came for us and went home with less. We shall remember it.', icon: 'attack' },
  { id: 'raidLost', title: 'The first raid lost', line: 'They took what they came for. The town is hurt, and wiser.', icon: 'loss' },
  { id: 'mythic', title: 'A mythic calling', line: 'One of ours has been touched by something older than the town.', icon: 'xp' },
  { id: 'unique', title: 'A treasure of legend', line: 'A blade with a name has come into our hands.', icon: 'attack' },
  { id: 'day100', title: 'A hundred days', line: 'A hundred sunrises over our roofs, and we are still here.', icon: 'day' },
  { id: 'generation', title: 'The founders are gone', line: 'None who founded the town still live. The town belongs to those born here.', icon: 'age' },
  { id: 'village', title: 'A daughter village', line: 'Some of us have gone out to start a home of their own, and carry ours with them.', icon: 'building' },
];
export const MILESTONE_BY_ID: Readonly<Record<MilestoneId, MilestoneDef>> = Object.fromEntries(MILESTONES.map((m) => [m.id, m])) as Record<MilestoneId, MilestoneDef>;

/** The day the town is reckoned a hundred days old. */
export const HUNDRED_DAYS = 100;

/** The generations, by name. */
export const GENERATION_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
export const generationWord = (n: number): string => GENERATION_WORDS[n - 1] ?? `${n}th`;
