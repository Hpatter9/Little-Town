// The Fae Court's bargains (the origins made deeper, the second; sim/bargains.ts). Every few nights at moonrise the
// Court offers the town a bargain: a boon now, and a price that falls due some days later. The fair folk always
// collect; a price the town cannot pay is taken another way, and dearly. Refused, the Court sulks. Cold iron in the
// stores hurts them all. A Court that is pleased holds revels under the full moon.

import type { EventEffect } from './eventKit';
import type { Skill } from './skills';

/** The hour the Court comes (moonrise), the nights between its offers, and how long the town has to answer. */
export const COURT_HOUR = 21;
export const OFFER_DAYS: [number, number] = [3, 5];
export const ANSWER_HOURS = 10;
/** The Court's favour (−100..100): a bargain struck, a price paid, a refusal; and how far it drifts back each night. */
export const STRUCK_FAVOUR = 6;
export const PAID_FAVOUR = 8;
export const REFUSED_FAVOUR = -7;
export const FORFEIT_FAVOUR = -15;
export const COURT_DRIFT = 1;
/** A refused Court may play a trick (`PRANKS`) on this chance, more the less it likes the town. */
export const PRANK_CHANCE = 0.35;
/** Cold iron: more than this much iron, steel and iron ore in store hurts the fair folk (morale, `IRON_MORALE`) and
 *  cools the Court (`IRON_FAVOUR` a night). */
export const IRON_HARM = 25;
export const IRON_MORALE = -4;
export const IRON_FAVOUR = -2;
/** A pleased Court (`REVEL_AT`) holds revels under the full moon: everyone's spirits (`REVEL_MORALE`), and travellers
 *  drawn in (`REVEL_TRAVELLERS`). */
export const REVEL_AT = 30;
export const REVEL_MORALE = 8;
export const REVEL_TRAVELLERS = 1.4;

/** A price beyond the events' effects: years of someone's youth (days of their life spent), or one of the town
 *  taken by the Court for good (a child if the town has one). */
export type FaePrice = EventEffect | { youth: number; on: 'founder' | 'random' } | { taken: 'child' | 'random' } | { forget: Skill; levels: number };

export interface Bargain {
  id: string;
  title: string;
  /** The Court's offer, as the event box tells it. */
  offer: string;
  boon: EventEffect[];
  boonText: string;
  price: FaePrice[];
  priceText: string;
  /** Days until the price falls due. */
  due: number;
  /** Whether the town would take it, left to itself (the default answer). */
  wise: boolean;
  /** What's taken instead when the price can't be paid. */
  forfeit: string;
}

export const BARGAINS: readonly Bargain[] = [
  {
    id: 'plenty',
    title: 'A Summer\'s Plenty',
    offer: 'A lady in a gown of leaves sets a basket at the fire. "Food for your table, as much as it will hold. And in three days, a little of your founder\'s youth: a year, no more. What is a year, to you?"',
    boon: [{ gain: { berries: 30, fruit: 15, herbs: 8 } }],
    boonText: '30 berries, 15 fruit and 8 herbs',
    price: [{ youth: 20, on: 'founder' }],
    priceText: 'a year of the founder\'s youth',
    due: 3,
    wise: true,
    forfeit: 'the year, taken all the same',
  },
  {
    id: 'gold',
    title: 'Gold from Leaves',
    offer: 'A grinning thing with antlers rakes up the fallen leaves, and where it rakes they ring like coin. "Yours. All I ask, in four days, is a little of your best crafter\'s cunning. They will hardly miss it."',
    boon: [{ coins: 120 }],
    boonText: '120 coins',
    price: [{ forget: 'crafting', levels: 3 }],
    priceText: 'three levels of crafting from the town\'s best crafter',
    due: 4,
    wise: true,
    forfeit: 'their hands\' skill, and more',
  },
  {
    id: 'strength',
    title: 'A Champion\'s Strength',
    offer: 'A knight of the Court in armour of beetle-shell bows. "I will teach one of yours to fight as we fight. In five days, they will dance for us a while, and come home tired."',
    boon: [{ skill: 'melee', levels: 4, on: 'random' }],
    boonText: 'four levels of fighting for one of the town',
    price: [{ mood: -6, hours: 48, text: 'Danced half to death by the fair folk' }, { wound: 'random', hp: 12 }],
    priceText: 'a night\'s dancing that leaves someone hurt and the town weary',
    due: 5,
    wise: true,
    forfeit: 'the dancer, kept a while longer',
  },
  {
    id: 'healing',
    title: 'A Healing Draught',
    offer: 'A wren lands on the sickbed and sings, and the singing smells of honey. "All your hurts, mended. And in two days, all your laughter, for a little while."',
    boon: [{ heal: 1 }],
    boonText: 'every wound mended',
    price: [{ mood: -10, hours: 72, text: 'The fair folk have our laughter' }],
    priceText: 'the town\'s spirits, three days low',
    due: 2,
    wise: true,
    forfeit: 'the laughter, kept longer',
  },
  {
    id: 'harvest',
    title: 'A Fair Wind',
    offer: 'A wind that smells of summer comes through the fields though it is night. "We will bless your crops for four days. In five, we will take our share of the stores, as is only fair."',
    boon: [{ mod: 'crops', mult: 1.4, hours: 96, text: 'A fair wind from the Court' }],
    boonText: 'crops 40% better for four days',
    price: [{ take: 'stores', share: 0.15 }],
    priceText: 'a sixth of everything in store',
    due: 5,
    wise: true,
    forfeit: 'twice the share',
  },
  {
    id: 'swift',
    title: 'Swift Feet',
    offer: 'Bells, very small, all along the paths. "Your folk will work as if the day were twice as long. In four days, the Court will want a song from each of them, sung until dawn."',
    boon: [{ mod: 'work', mult: 1.25, hours: 72, text: 'Swift feet, by the Court\'s gift' }],
    boonText: 'everyone works a quarter faster for three days',
    price: [{ mood: -5, hours: 24, text: 'Sang till dawn for the fair folk' }, { mod: 'work', mult: 0.8, hours: 24, text: 'Weary from the fair folk\'s songs' }],
    priceText: 'a sleepless night and a slow day after',
    due: 4,
    wise: true,
    forfeit: 'two slow days',
  },
  {
    id: 'secret',
    title: 'A Secret Told',
    offer: 'An owl with a woman\'s face lands on the study\'s roof. "I know what your scholars are looking for. I will whisper it. In six days, I will take someone with me, to tell my secrets to."',
    boon: [{ learn: 1 }],
    boonText: 'a topic learned outright',
    price: [{ taken: 'random' }],
    priceText: 'one of the town, taken to the Court for good',
    due: 6,
    wise: false,
    forfeit: 'one of the town, taken',
  },
  {
    id: 'firstborn',
    title: 'The Old Bargain',
    offer: 'The Queen of the Court herself, tall as a birch, crowned with frost. "Ask anything. Riches, a champion, a harvest. I ask only the old price: a child of yours, to raise as our own."',
    boon: [{ coins: 200 }, { gain: { gems: 6, silver: 6 } }, { skill: 'melee', levels: 3, on: 'all' }],
    boonText: '200 coins, gems and silver, and every grown-up a better fighter',
    price: [{ taken: 'child' }],
    priceText: 'a child of the town, taken to be raised by the fair folk',
    due: 7,
    wise: false,
    forfeit: 'a child, or someone else in their place',
  },
];
export const BARGAIN_BY_ID: Readonly<Record<string, Bargain>> = Object.fromEntries(BARGAINS.map((b) => [b.id, b]));

/** The tricks of a sulking Court (events' effects). */
export const PRANKS: { text: string; effects: EventEffect[] }[] = [
  { text: 'The milk soured and the bread went to moss overnight.', effects: [{ take: 'food', share: 0.1 }] },
  { text: 'Every tool in town was found tied in knots of hair.', effects: [{ mod: 'work', mult: 0.85, hours: 24, text: 'Tools knotted by the fair folk' }] },
  { text: 'Someone woke with their hair braided into the bedframe, and a black eye.', effects: [{ wound: 'random', hp: 8 }] },
  { text: 'The purse in the treasury was full of leaves in the morning.', effects: [{ take: 'coins', share: 0.1 }] },
];

export const COURT_MOODS: [number, string][] = [
  [60, 'The Court adores the town'],
  [30, 'The Court is charmed'],
  [5, 'The Court is amused'],
  [-20, 'The Court is cool'],
  [-50, 'The Court is offended'],
  [-101, 'The Court is cruel'],
];
