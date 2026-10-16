// Events that only come to a town past an alignment threshold (sim/alignment.ts). Good towns draw pilgrims and a holy
// order; evil towns are courted by a thieves' guild, a dark bargain and foes who would rather treat. Their answers'
// alignment weights are in ALIGN_EVENT_WEIGHTS (the older events' are in eventAlign.ts).
import { calm, chance, coin, dflt, follow, mod, mood, note, opt, rep, take, type EventDef } from './eventKit';
import { DEEP_EVIL_AT, DEEP_GOOD_AT, EVIL_AT, GOOD_AT } from './alignment';
import type { GameState } from '../sim/state';

const score = (s: GameState) => s.align?.score ?? 0;
const grown = (s: GameState, n: number) => s.people.filter((p) => p.bornTick == null).length >= n;

export const ALIGN_EVENTS: readonly EventDef[] = [
  {
    id: 'pilgrims_come', scene: 'refugees', title: 'Pilgrims at the gate', weight: 3, when: (s) => score(s) >= GOOD_AT,
    text: 'A line of footsore pilgrims has come a long way on the strength of the town\'s name, and asks only for a roof and a crust.',
    options: [
      dflt('Take them in', take('food', 0.05), { join: 2 }, mood(2, 48, 'Pilgrims blessed the table')),
      opt('Feed them and bless the road', coin(-10), rep(1)),
      opt('Send them on; there is not enough to share', rep(-1), note('They go on, looking back.')),
    ],
  },
  {
    id: 'holy_order', scene: 'gate', title: 'A holy order offers its aid', weight: 3, when: (s) => score(s) >= DEEP_GOOD_AT && grown(s, 8),
    text: 'Riders in plain white surcoats have come to the gate. Their order tends the sick and guards the road, and has heard of this town\'s mercy.',
    options: [
      dflt('Welcome the order to stay', { join: 2 }, mod('guard', 1.2, 120, 'The order keeps watch'), { heal: 1 }),
      opt('Ask only for their healers', { heal: 1 }, coin(-15)),
      opt('Thank them, and keep the gate shut', rep(-1), note('The riders nod, and ride on.')),
    ],
  },
  {
    id: 'thieves_offer', scene: 'shady', title: 'The Hand makes an offer', weight: 3, when: (s) => score(s) <= EVIL_AT,
    text: 'A cloaked woman at the back of the tavern says she speaks for the Hand, the guild that does not exist. For a share, the town\'s coffers need never want.',
    options: [
      dflt('Let the Hand work here', coin(40), mood(-2, 48, 'Shadows in the lanes'), rep(-1)),
      opt('Take a smaller cut and a quieter hand', coin(15)),
      opt('Refuse, and have her watched out of town', rep(1), note('She is gone by morning.')),
    ],
  },
  {
    id: 'dark_bargain', scene: 'cult', title: 'A bargain in the dark', weight: 3, when: (s) => score(s) <= EVIL_AT && grown(s, 6),
    text: 'Something answers the town\'s reputation. It offers strength for a price that is not named, only hinted: a life, freely given or not.',
    options: [
      opt('Strike the bargain', mod('fight', 1.35, 120, 'The bargain\'s strength'), { kill: 'random', chance: 0.7, cause: 'given to the bargain' }, { dread: 1 }),
      dflt('Haggle for a lesser price', mod('fight', 1.15, 72, 'A cheaper strength'), chance(0.35, [{ kill: 'random', chance: 0.5, cause: 'given to the bargain' }])),
      opt('Turn it away', calm(48), note('The dark goes quiet.')),
    ],
  },
  {
    id: 'foes_treat', scene: 'envoy', title: 'A raider chief asks to parley', weight: 3, when: (s) => score(s) <= DEEP_EVIL_AT,
    text: 'A raider chief has walked up to the wall alone, hands open. Your name has reached them. They would rather be paid in a share than in blood.',
    options: [
      dflt('Treat with them', calm(96), take('coins', 0.1)),
      opt('Make them swear to the town', calm(72), rep(-1), mood(-2, 24, 'Dealing with raiders')),
      opt('Cut them down at the wall', { raid: 12 }, mood(2, 24, 'We showed them')),
    ],
  },
  // (never by chance: a town that swings hard from one end to the other, once each way: sim/alignment.ts `arcs`)
  {
    id: 'fall_reckoning', scene: 'council', title: 'How far we have fallen', when: () => false,
    text: 'Not long ago this was a town people spoke well of. Now travellers cross the road to avoid it, and the elders cannot meet each other\'s eyes.',
    options: [
      opt('Embrace what we have become', mod('fight', 1.2, 120, 'The town has made its peace with the dark'), follow('fall_exodus'), { reputation: -2 }),
      dflt('Say nothing, and hope it passes', take('coins', 0.1), mood(-3, 48, 'A town that looks away')),
      opt('Call a day of reckoning, and make amends', coin(-30), rep(2), mood(2, 48, 'The day of reckoning')),
    ],
  },
  {
    id: 'fall_exodus', scene: 'leaving', title: 'The kind ones leave', when: () => false,
    text: 'Those who stayed for the town\'s old good name are packing their carts. They do not argue. That is the worst of it.',
    options: [
      opt('Let them go', { exodus: 0.12 }, rep(-1)),
      dflt('Pay them to stay, and keep quiet', coin(-40), mood(-2, 48, 'Bought silence')),
      opt('Make an example of the first to leave', { kill: 'random', chance: 0.5, cause: 'made an example of' }, mod('work', 1.1, 72, 'Fear keeps them at it')),
    ],
  },
  {
    id: 'redemption_penance', scene: 'gate', title: 'The long road back', when: () => false,
    text: 'The town was feared once. Now the old victims\' children come to the gate, not with spears but to see whether the stories of change are true.',
    options: [
      dflt('Do public penance and open the stores', coin(-40), take('food', 0.1), rep(3), mood(4, 72, 'The town made amends')),
      opt('Offer a plain apology and a seat at the council', rep(2), mood(2, 48, 'Old enemies at the council'), follow('redemption_shadow')),
      opt('Tell them the past is past', rep(-1), follow('redemption_shadow')),
    ],
  },
  {
    id: 'redemption_shadow', scene: 'envoy', title: 'Old friends come calling', when: () => false,
    text: 'Those who profited from the town\'s old ways have heard of its change, and they are not pleased. Some of them have swords.',
    options: [
      dflt('Stand against them', { raid: 12 }, mod('fight', 1.15, 72, 'Standing for the new way'), rep(1)),
      opt('Buy them off, one last time', coin(-60), calm(72)),
      opt('Join them, and forget all this', rep(-3), coin(30), mood(-4, 72, 'The old ways again')),
    ],
  },
];
