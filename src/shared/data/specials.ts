// Special newcomers (the owner's ask: townsfolk who come with a secret: mysterious, incredibly powerful, diseased,
// cursed, wanted, or a raider sent ahead to undo the town's defences before his clan comes). Each comes to the gate
// like any wanderer, under a cover story; the truth is found out by a townsperson skilled enough to see it (`spot`),
// by the newcomer giving themselves away (`slip`, a daily chance), or too late, when the secret strikes on its own
// (`due`). Found out, the town chooses what to do (`options`, the first the default). The rules are in
// sim/specials.ts.

import type { Skill } from './skills';
import type { BackdropId } from './backdrops';

export type SpecialId = 'veiled' | 'plague' | 'cursed' | 'outlaw' | 'saboteur' | 'archmage' | 'heir';

export interface SpecialDef {
  id: SpecialId;
  /** Who they really are. */
  name: string;
  /** What the gate sees: the cover story (after "a wanderer, ..."). */
  cover: string;
  /** Their story while hidden, and once known ({name} is filled). */
  coverStory: string;
  truth: string;
  /** A townsperson with this much of the skill may see through them, a little likelier the more they have. */
  spot: { skill: Skill; level: number; how: string };
  /** The daily chance they give themselves away, and how. */
  slip: number;
  slipText: string;
  /** Game hours after joining when the secret strikes, if still hidden (a range: the town's seed picks). */
  due: [number, number];
  /** The town's answers once it knows (the first is the default). */
  options: string[];
  /** The picture on the full-screen box. */
  picture: BackdropId;
  /** The kind of newcomer they look like. */
  type: string;
}

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  veiled: {
    id: 'veiled',
    name: 'The Veiled Champion',
    cover: 'a hooded traveller who gives only a first name and keeps a long blade wrapped in sackcloth',
    coverStory: '{name} says little: a traveller, from nowhere in particular. They sit with their back to the wall, and their eyes go to every door.',
    truth: '{name} was the last Champion of a kingdom that burned. The one who burned it swore to finish what was started, and has never stopped looking.',
    spot: { skill: 'melee', level: 10, how: 'saw how they stood when a door banged: feet set, hand at the wrapped blade, as only the best are taught' },
    slip: 0.06,
    slipText: 'A drunk swung at {name} in the yard. He was on the ground before anyone saw them move, and the sackcloth had fallen from a blade of black steel.',
    due: [120, 216],
    options: ['Stand with them', 'Ask them to go, with thanks', 'Send word to their hunter'],
    picture: 'battle_ruins',
    type: 'wanderer',
  },
  plague: {
    id: 'plague',
    name: 'The Coughing Pilgrim',
    cover: 'a thin pilgrim with a dry cough, who swears it is only the dust of the road',
    coverStory: '{name} has walked from shrine to shrine for a year, and coughs into a grey sleeve.',
    truth: '{name} carries a fever from a town that is not there any more. It is in their blood and their breath, and it spreads.',
    spot: { skill: 'medicine', level: 3, how: 'saw the red spots at their collar, and the sweat on a cold morning' },
    slip: 0.22,
    slipText: '{name} coughed blood into the well bucket, and the whole yard saw it.',
    due: [30, 48],
    options: ['Keep them apart and nurse them', 'Send them on with food', 'Burn their things and drive them out'],
    picture: 'battle_graves',
    type: 'wanderer',
  },
  cursed: {
    id: 'cursed',
    name: 'The Knight of the Black Oath',
    cover: 'a knight in dented black armour who bows too low and never takes off their gauntlets',
    coverStory: '{name} rides alone, and asks only for a corner to sleep in and work to do. They fight like a storm.',
    truth: '{name} broke an oath sworn on a dead king\'s tomb. Ill luck walks a step behind them: beams fall, milk sours, tools snap, and fires start where no fire should be.',
    spot: { skill: 'research', level: 8, how: 'knew the sigil scratched inside their gauntlet from an old book: the mark of the Black Oath' },
    slip: 0.1,
    slipText: 'In the firelight {name}\'s shadow turned its head. {name} did not.',
    due: [144, 240],
    options: ['Break the curse (60 coins)', 'Keep them, curse and all', 'Send them away'],
    picture: 'moon_3',
    type: 'wanderer',
  },
  outlaw: {
    id: 'outlaw',
    name: 'Red Jack, the Highwayman',
    cover: 'a charming traveller with fine boots, a ready laugh and quick hands',
    coverStory: '{name} has a story for every night and a coin trick for every child. Nobody minds that they never say where they are from.',
    truth: '{name} is Red Jack, who robbed the king\'s tax wagon on the high road. There is a price on their head, and hunters who mean to collect it. And the treasury has been coming up a little short.',
    spot: { skill: 'social', level: 8, how: 'matched their face to a wanted poster pinned up at the last market' },
    slip: 0.08,
    slipText: 'A traveller unfolded a wanted poster at the fire: RED JACK, the highwayman. The face was {name}\'s.',
    due: [96, 168],
    options: ['Hand them to the hunters', 'Hide them', 'Let them slip away by night'],
    picture: 'forest_2',
    type: 'wanderer',
  },
  saboteur: {
    id: 'saboteur',
    name: 'The Turncoat Scout',
    cover: 'a bloodied hunter who says raiders burned their village, and begs for shelter',
    coverStory: '{name} lost everything to raiders, they say. They are grateful, and helpful, and very interested in the walls.',
    truth: '{name} is a raider, sent ahead to count the guards, cut the gate\'s bar and spring the traps, so that the clan walks in when it comes.',
    spot: { skill: 'social', level: 9, how: 'noticed they asked every guard when the watch changes, and wrote nothing down but remembered it all' },
    slip: 0.1,
    slipText: '{name} was seen on the wall at midnight, waving a torch slowly toward the dark hills. Something in the hills waved back.',
    due: [48, 96],
    options: ['Lock them up', 'Turn them against their clan', 'Drive them out'],
    picture: 'forest_5',
    type: 'hunter',
  },
  archmage: {
    id: 'archmage',
    name: 'The Exile in Grey',
    cover: 'an old scholar in a grey cloak, stained with ink, who flinches at thunder',
    coverStory: '{name} reads by the fire until the small hours and is kind to the children. Odd things happen near them: candles flaring, frost in summer.',
    truth: '{name} was Archmage of a great college, cast out for a working that went wrong. Their power is enormous, and it slips its leash.',
    spot: { skill: 'research', level: 10, how: 'saw them light a candle without a flint, by looking at it, and knew the college\'s seal on their ring' },
    slip: 0.08,
    slipText: 'Lightning came out of a clear sky and struck the ground at {name}\'s feet. They stood in the smoke, eyes white, and said: "I am sorry."',
    due: [168, 264],
    options: ['Give them a tower and a free hand', 'Ask them to bind their power', 'Ask them to leave'],
    picture: 'crystal_2',
    type: 'hermit',
  },
  heir: {
    id: 'heir',
    name: 'The Runaway Heir',
    cover: 'a young traveller with soft hands, a ring on a cord round their neck, and no idea how to light a fire',
    coverStory: '{name} is willing and clumsy, and blushes when anyone asks about their family.',
    truth: '{name} is heir to a throne, run from a marriage they did not want. The crown\'s riders are searching every town on the road.',
    spot: { skill: 'social', level: 6, how: 'knew the crest on the ring round their neck: the crown itself' },
    slip: 0.12,
    slipText: '{name} forgot themselves and told the cook, very kindly, that she might go.',
    due: [144, 240],
    options: ['Send word to the crown', 'Keep their secret', 'Let them choose'],
    picture: 'battle_hall',
    type: 'wanderer',
  },
};

export const SPECIAL_IDS = Object.keys(SPECIALS) as SpecialId[];

/** From which day a special may come to the gate, and the share of wanderers who are one. */
export const SPECIAL_FROM_DAY = 2;
export const SPECIAL_SHARE = 0.3;
/** The daily chance a skilled townsperson sees through one (their margin over the need adds `SPOT_PER_LEVEL`). */
export const SPOT_BASE = 0.3;
export const SPOT_PER_LEVEL = 0.06;
export const SPOT_MOST = 0.85;
/** The hour of the day the town's suspicions come to a head. */
export const SPOT_HOUR = 20;

/** The cursed knight's ill luck: its daily chance, and the harm. */
export const CURSE_DAILY = 0.4;
/** Breaking the curse. */
export const CURSE_PRICE = 60;
/** The highwayman's light fingers: coins a day from the treasury. */
export const THEFT_A_DAY: [number, number] = [3, 9];
/** The bounty on Red Jack, and what the crown pays for its heir. */
export const BOUNTY = 120;
export const HEIR_REWARD = 160;
/** A guard on watch the night the saboteur strikes catches them at it at this chance, more with their best fighting
 *  skill. */
export const CATCH_BASE = 0.25;
export const CATCH_PER_LEVEL = 0.05;
/** The archmage's surges: daily while untamed. */
export const SURGE_DAILY = 0.25;
