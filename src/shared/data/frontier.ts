// The settlers' frontier (the origins made deeper, the sixth; sim/frontier.ts). Plain folk with no magic of their own,
// the settlers are the ones who learn: a trick from every people they meet and trade with, a trade from every stranger
// who settles among them, and the land itself, claimed a stretch at a time and homesteaded.

import type { Lever } from './eventKit';
import type { Material } from './materials';
import type { OriginId } from './origins';

/** The hour of the day's frontier reckoning. */
export const FRONTIER_HOUR = 8;

/** What each people teaches the settlers once met (a stranger of theirs in town, or a caravan of theirs traded with):
 *  a lever made `TRICK_MULT` better for good. */
export const TRICK_MULT = 1.05;
export const TRICKS: Partial<Record<OriginId, { lever: Lever; what: string }>> = {
  lich: { lever: 'research', what: 'the liches\' patience with old books' },
  druid: { lever: 'crops', what: 'the druids\' way with seed and soil' },
  vampire: { lever: 'prices', what: 'the Court\'s eye for what a stranger will pay' },
  werewolf: { lever: 'forage', what: 'the pack\'s nose for the wild' },
  robot: { lever: 'craft', what: 'the machines\' exactness' },
  dwarves: { lever: 'build', what: 'the hold\'s stonecraft' },
  merfolk: { lever: 'travellers', what: 'the merfolk\'s welcome' },
  nomads: { lever: 'work', what: 'the horde\'s long days in the saddle' },
  fae: { lever: 'prices', what: 'the fair folk\'s silver tongue' },
  alchemists: { lever: 'research', what: 'the alchemists\' method' },
  knights: { lever: 'fight', what: 'the Order\'s drill' },
};

/** A stranger in town teaches: each morning `TEACH_PUPILS` others learn from their best skill. */
export const TEACH_PUPILS = 2;
export const TEACH_XP = 40;

/** Land claims: every `CLAIM_DAYS` the town stakes a claim at the edge of what it knows (the land opened `CLAIM_OPEN`
 *  further), and homesteads it: a first haul of what the claim holds (`CLAIM_HAUL` by the ground), a lift to spirits. At
 *  most `CLAIMS_MOST`. Claim-jumpers may come for a claim (`JUMP_CHANCE` a claim, a day): a band of outlaws on the land. */
export const CLAIM_DAYS = 4;
export const CLAIM_OPEN = 3;
export const CLAIMS_MOST = 10;
export const CLAIM_MORALE = 4;
export const CLAIM_HAUL: Record<string, Partial<Record<Material, number>>> = {
  forest: { wood: 20, herbs: 4 },
  rock: { stone: 20, flint: 4 },
  hill: { stone: 10, wood: 8 },
  marsh: { fiber: 12, herbs: 6 },
  fertile: { grain: 10, berries: 10 },
  grass: { fiber: 8, berries: 8 },
  sand: { clay: 10, stone: 6 },
};
export const JUMP_CHANCE = 0.06;
export const CLAIM_NAMES = ['Pine Hollow', 'Stony Ford', 'Hope\'s End', 'Cold Spring', 'Long Meadow', 'Crow\'s Rest', 'Fortune Hill', 'Bitter Creek', 'Sunny Bank', 'Last Chance', 'Elm Bottom', 'Two Rocks', 'Widow\'s Patch', 'Lucky Strike'];
