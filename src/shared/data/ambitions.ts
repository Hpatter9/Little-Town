// What each townsperson wants of their life (the owner's direction, PLAN.md step 3). Decided once they're grown, from
// their nature and what they're best at (`ambitionOf` in sim/ambition.ts, kept on `Person.ambition`), and it steers
// them: which post they take (`JOB_PULL`), whether they save to buy a business, whether they go adventuring, and
// whether, rich from the road, they settle down behind a counter.

import type { NatureId } from './natures';
import type { Skill } from './skills';

export type AmbitionId = 'farmer' | 'crafter' | 'keeper' | 'adventurer' | 'scholar' | 'guard' | 'homebody' | 'wealthy';

export interface AmbitionDef {
  id: AmbitionId;
  name: string;
  /** In their words (the inspect page). */
  line: string;
  /** The skill their kind of post asks for: a post of it counts this much more for them (`JOB_PULL`). */
  skill?: Skill;
}

export const AMBITIONS: Readonly<Record<AmbitionId, AmbitionDef>> = {
  farmer: { id: 'farmer', name: 'A life on the land', line: 'Wants a good field, a full barn, and nothing more.', skill: 'farming' },
  crafter: { id: 'crafter', name: 'A master craftsman', line: 'Wants to make the finest work in the land.', skill: 'crafting' },
  keeper: { id: 'keeper', name: 'A shop of their own', line: 'Dreams of a counter, a bell over the door, and a busy day.', skill: 'social' },
  adventurer: { id: 'adventurer', name: 'Fortune on the road', line: 'Wants to see what lies past the hills, and come home rich.', skill: 'melee' },
  scholar: { id: 'scholar', name: 'To know everything', line: 'Wants every book, and to write one.', skill: 'research' },
  guard: { id: 'guard', name: 'To keep the town safe', line: 'Wants to stand on the wall when the raiders come.', skill: 'melee' },
  homebody: { id: 'homebody', name: 'A quiet life', line: 'Wants a warm home, a full table, and friends close by.' },
  wealthy: { id: 'wealthy', name: 'To be rich', line: 'Wants money, and more of it, by whatever road.' },
};

/** How a nature leans (added to the pull of what they're best at). */
export const NATURE_AMBITION: Readonly<Partial<Record<NatureId, AmbitionId>>> = {
  greedy: 'wealthy', bold: 'adventurer', restless: 'adventurer', curious: 'scholar', dreamy: 'scholar', shy: 'homebody',
  kind: 'homebody', stern: 'guard', proud: 'keeper', jolly: 'keeper', cheerful: 'farmer', pious: 'farmer', gloomy: 'crafter',
};

/** A post that matches someone's ambition counts this many skill levels more when posts are handed out. */
export const JOB_PULL = 4;
/** An adventurer this rich after this many trips settles down to a shop of their own. */
export const RETIRE_COINS = 120;
export const RETIRE_TRIPS = 3;
/** A business is worth its building's makings and its plot, plus this many days of its takings (so a busy shop is
 *  dear), and a person sells theirs only for this much more again. */
export const BUSINESS_DAYS = 10;
export const PERSON_SELLS_AT = 1.5;
/** What a business owner keeps back before spending on it (times PURSE_SCALE). */
export const OWNER_KEEP = 30;
