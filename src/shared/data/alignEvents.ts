// Events that only come to a town past an alignment threshold (sim/alignment.ts). Good towns draw pilgrims and a holy
// order; evil towns are courted by a thieves' guild, a dark bargain and foes who would rather treat. Their answers'
// alignment weights are in ALIGN_EVENT_WEIGHTS (the older events' are in eventAlign.ts).
import { calm, chance, coin, dflt, mod, mood, note, opt, rep, take, type EventDef } from './eventKit';
import { DEEP_EVIL_AT, DEEP_GOOD_AT, EVIL_AT, GOOD_AT } from './alignment';
import type { GameState } from '../sim/state';

const score = (s: GameState) => s.align?.score ?? 0;
const grown = (s: GameState, n: number) => s.people.filter((p) => p.bornTick == null).length >= n;

export const ALIGN_EVENTS: readonly EventDef[] = [
  {
    id: 'pilgrims_come', title: 'Pilgrims at the gate', weight: 3, when: (s) => score(s) >= GOOD_AT,
    text: 'A line of footsore pilgrims has come a long way on the strength of the town\'s name, and asks only for a roof and a crust.',
    options: [
      dflt('Take them in', take('food', 0.05), { join: 2 }, mood(2, 48, 'Pilgrims blessed the table')),
      opt('Feed them and bless the road', coin(-10), rep(1)),
      opt('Send them on; there is not enough to share', rep(-1), note('They go on, looking back.')),
    ],
  },
  {
    id: 'holy_order', title: 'A holy order offers its aid', weight: 3, when: (s) => score(s) >= DEEP_GOOD_AT && grown(s, 8),
    text: 'Riders in plain white surcoats have come to the gate. Their order tends the sick and guards the road, and has heard of this town\'s mercy.',
    options: [
      dflt('Welcome the order to stay', { join: 2 }, mod('guard', 1.2, 120, 'The order keeps watch'), { heal: 1 }),
      opt('Ask only for their healers', { heal: 1 }, coin(-15)),
      opt('Thank them, and keep the gate shut', rep(-1), note('The riders nod, and ride on.')),
    ],
  },
  {
    id: 'thieves_offer', title: 'The Hand makes an offer', weight: 3, when: (s) => score(s) <= EVIL_AT,
    text: 'A cloaked woman at the back of the tavern says she speaks for the Hand, the guild that does not exist. For a share, the town\'s coffers need never want.',
    options: [
      dflt('Let the Hand work here', coin(40), mood(-2, 48, 'Shadows in the lanes'), rep(-1)),
      opt('Take a smaller cut and a quieter hand', coin(15)),
      opt('Refuse, and have her watched out of town', rep(1), note('She is gone by morning.')),
    ],
  },
  {
    id: 'dark_bargain', title: 'A bargain in the dark', weight: 3, when: (s) => score(s) <= EVIL_AT && grown(s, 6),
    text: 'Something answers the town\'s reputation. It offers strength for a price that is not named, only hinted: a life, freely given or not.',
    options: [
      opt('Strike the bargain', mod('fight', 1.35, 120, 'The bargain\'s strength'), { kill: 'random', chance: 0.7, cause: 'given to the bargain' }, { dread: 1 }),
      dflt('Haggle for a lesser price', mod('fight', 1.15, 72, 'A cheaper strength'), chance(0.35, [{ kill: 'random', chance: 0.5, cause: 'given to the bargain' }])),
      opt('Turn it away', calm(48), note('The dark goes quiet.')),
    ],
  },
  {
    id: 'foes_treat', title: 'A raider chief asks to parley', weight: 3, when: (s) => score(s) <= DEEP_EVIL_AT,
    text: 'A raider chief has walked up to the wall alone, hands open. Your name has reached them. They would rather be paid in a share than in blood.',
    options: [
      dflt('Treat with them', calm(96), take('coins', 0.1)),
      opt('Make them swear to the town', calm(72), rep(-1), mood(-2, 24, 'Dealing with raiders')),
      opt('Cut them down at the wall', { raid: 12 }, mood(2, 24, 'We showed them')),
    ],
  },
];
