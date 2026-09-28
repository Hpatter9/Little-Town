// Building operators (DESIGN §7): a named role for some buildings, filled by a townsperson whose skill
// sets how well the building works. Numbers are starting points for tuning.

import type { Skill } from './skills';

export interface OperatorRole {
  title: string;
  skill: Skill;
  /** What the operator's skill does, for display. */
  effect: string;
}

export const OPERATORS: Readonly<Record<string, OperatorRole>> = {
  tavern: { title: 'Barkeep', skill: 'social', effect: 'The tavern lifts morale more' },
  market: { title: 'Merchant', skill: 'social', effect: 'Better prices from caravans' },
  infirmary: { title: 'Healer', skill: 'medicine', effect: 'Wounds heal faster still' },
  watchtower: { title: 'Guard Captain', skill: 'melee', effect: 'Defenders hit harder and more often' },
};

/** Tavern morale: base, plus this per Barkeep Social level. */
export const TAVERN_BASE = 4;
export const TAVERN_PER_LEVEL = 0.6;
/** Merchant: caravan prices improve by this per Social level (on both buying and selling). */
export const MERCHANT_PER_LEVEL = 0.02;
/** Healer: extra healing per Medicine level (on top of the infirmary's). */
export const HEALER_PER_LEVEL = 0.1;
/** Guard Captain: defenders' accuracy per level of the captain's best fighting skill. */
export const CAPTAIN_PER_LEVEL = 0.01;
