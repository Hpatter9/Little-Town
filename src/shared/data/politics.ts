// Town politics and law (the owner's pick of the content updates, the fifth). The town's grown-ups fall into four
// blocs by who they are (the guilds, the devout, the soldiers, the commons: `blocOf` in sim/politics.ts), each with
// its own satisfaction, which follows the laws in force, the tax, how the town is doing by its lights and its
// members' spirits. Every few days the council meets: the unhappiest bloc puts a law forward (or its repeal, or a
// lower tax) and the town votes; the player may let the vote stand or overrule it, at a price. Crime comes with
// poverty and unhappiness and goes down with guards, a curfew and harsh law; a culprit caught is tried, and the player
// gives the sentence. A bloc pushed too far strikes; a town ruled badly enough rises against its founder.

import type { NatureId } from './natures';

export type BlocId = 'guilds' | 'devout' | 'soldiers' | 'commons';
export const BLOCS: readonly BlocId[] = ['guilds', 'devout', 'soldiers', 'commons'];

export interface BlocDef {
  id: BlocId;
  name: string;
  /** Who they are, in a line. */
  who: string;
  /** A member's mood line when the bloc is content, and when it's angry. */
  happy: string;
  angry: string;
  colour: string;
}

export const BLOC_DEFS: Readonly<Record<BlocId, BlocDef>> = {
  guilds: { id: 'guilds', name: 'The guilds', who: 'Crafters, shopkeepers and those out to get rich: they want trade free and taxes light.', happy: 'The guilds are content', angry: 'The guilds are aggrieved', colour: '#d8a840' },
  devout: { id: 'devout', name: 'The devout', who: 'The pious and the learned: they want the gods honoured and mercy shown.', happy: 'The faithful are at peace', angry: 'The faithful are troubled', colour: '#a890e0' },
  soldiers: { id: 'soldiers', name: 'The soldiers', who: 'Guards, adventurers and the fighting callings: they want the town strong and crime punished.', happy: 'The soldiers are proud', angry: 'The soldiers are restless', colour: '#d06048' },
  commons: { id: 'commons', name: 'The commons', who: 'Farmers, labourers and the poor: they want bread, fair taxes and to be left alone.', happy: 'The commons are content', angry: 'The commons are angry', colour: '#70a858' },
};

export type LawId = 'curfew' | 'conscription' | 'temple_tithe' | 'market_charter' | 'poor_relief' | 'harsh_law' | 'rest_day';

export interface LawDef {
  id: LawId;
  name: string;
  /** What it does, for the menu. */
  does: string;
  /** How each bloc feels about it: +1 for, -1 against (0 or left out: no view). */
  stance: Partial<Record<BlocId, 1 | -1>>;
}

export const LAWS: readonly LawDef[] = [
  { id: 'curfew', name: 'A curfew', does: 'Nobody abroad after dark: crime halved, and no evenings at the tavern.', stance: { soldiers: 1, devout: 1, commons: -1, guilds: -1 } },
  { id: 'conscription', name: 'Conscription', does: 'Every grown-up drills with arms: a little fighting skill for all each day.', stance: { soldiers: 1, commons: -1, guilds: -1 } },
  { id: 'temple_tithe', name: 'The temple tithe', does: 'The treasury gives the gods a share each day: their favour rises.', stance: { devout: 1, guilds: -1 } },
  { id: 'market_charter', name: 'A market charter', does: 'The shops pay the treasury a fee for the right to trade, and trade freely.', stance: { guilds: 1, commons: -1 } },
  { id: 'poor_relief', name: 'Poor relief', does: 'The treasury gives the poorest a few coins each day.', stance: { commons: 1, devout: 1, guilds: -1 } },
  { id: 'harsh_law', name: 'Harsh law', does: 'Crime punished hard: less of it, and heavier sentences.', stance: { soldiers: 1, guilds: 1, devout: -1, commons: -1 } },
  { id: 'rest_day', name: 'A day of rest', does: 'Every seventh day the town rests: spirits lift.', stance: { devout: 1, commons: 1, guilds: -1 } },
];
export const LAW_BY_ID: Readonly<Record<LawId, LawDef>> = Object.fromEntries(LAWS.map((l) => [l.id, l])) as Record<LawId, LawDef>;

/** A bloc's satisfaction starts here and drifts this share of the way to its target each day. */
export const SAT_START = 60;
export const SAT_DRIFT = 0.25;
export const SAT_BASE = 55;
/** A law it's for or against, in force; the tax by level and bloc. */
export const LAW_PULL = 12;
export const TAX_PULL: Readonly<Record<string, Partial<Record<BlocId, number>>>> = {
  low: { commons: 8, guilds: 6, soldiers: -2 },
  fair: {},
  heavy: { commons: -18, guilds: -12, devout: -6, soldiers: -4 },
};
/** Members' spirits count this much (a point of morale over 50). */
export const MORALE_PULL = 0.3;
/** A member's mood from their bloc: its satisfaction over 50, divided by this (rounded), up to these. */
export const MOOD_DIV = 8;
export const MOOD_MOST = 5;
export const MOOD_LEAST = -7;

/** The council meets from this day, with this many grown-ups, every this many days, at this hour; overruling it
 *  costs the side that won this much. */
export const COUNCIL_FROM_DAY = 5;
export const COUNCIL_PEOPLE = 5;
export const COUNCIL_EVERY_DAYS = 4;
export const COUNCIL_HOUR = 17;
export const COUNCIL_HOURS = 8;
export const OVERRULE_COST = 15;
export const COUNCIL_OPTIONS = ['Let the vote stand', 'Overrule it'] as const;

/** Crime: each night at this hour, a chance (a town of at least this many grown-ups), more with the poor and the
 *  unhappy, less with guards, a curfew, harsh law. A culprit is caught by this chance, more a guard. */
export const CRIME_HOUR = 2;
export const CRIME_PEOPLE = 4;
export const CRIME_BASE = 0.1;
export const CRIME_POOR = 0.6;
export const CRIME_UNHAPPY = 0.6;
export const CRIME_PER_GUARD = 0.3;
export const CURFEW_CRIME = 0.5;
export const HARSH_CRIME = 0.6;
export const CAUGHT_BASE = 0.35;
export const CAUGHT_PER_GUARD = 0.15;
export const CAUGHT_HARSH = 0.1;
export const CAUGHT_MOST = 0.9;
/** The poor: under this many coins. */
export const POOR_COINS = 8;
/** The crimes and their weights; a murder needs an enemy. */
export const CRIMES = { theft: 6, assault: 3, vandalism: 2, murder: 1 } as const;
export type CrimeKind = keyof typeof CRIMES;
/** The natures more given to crime. */
export const CRIMINAL_NATURES: readonly NatureId[] = ['greedy', 'grumpy', 'restless', 'proud'];
export const TRIAL_HOURS = 8;
export const FINE = 12;
export const STOCKS_MORALE = -12;
/** Sentences: the options, and how each bloc takes each. */
export const SENTENCES = ['Pardon them', `Fine them (${FINE} coins)`, 'Put them in the stocks', 'Exile them', 'Hang them'] as const;
export type Sentence = 'pardon' | 'fine' | 'stocks' | 'exile' | 'hang';
export const SENTENCE_OF: readonly Sentence[] = ['pardon', 'fine', 'stocks', 'exile', 'hang'];
export const SENTENCE_PULL: Readonly<Record<Sentence, Partial<Record<BlocId, number>>>> = {
  pardon: { devout: 5, soldiers: -6 },
  fine: { guilds: 2 },
  stocks: {},
  exile: { soldiers: 4, devout: -4 },
  hang: { soldiers: 6, devout: -10, commons: -4 },
};

/** A bloc this unhappy strikes (its members stop work and gather at the seat) for this long, no oftener than every
 *  this many days; the strike lets off this much steam. */
export const STRIKE_AT = 25;
export const STRIKE_HOURS = 10;
export const STRIKE_GAP_DAYS = 3;
export const STRIKE_EASE = 6;
/** The town rises when the members' satisfaction overall falls this low, or a bloc this low has struck already; no
 *  oftener than every this many days. */
export const REVOLT_AT = 24;
export const REVOLT_BLOC_AT = 12;
export const REVOLT_GAP_DAYS = 10;
export const REVOLT_HOURS = 6;
export const REVOLT_OPTIONS = ['Give way to them', 'Put it down', 'Step down'] as const;
export const GIVE_WAY = 20;
export const STEP_DOWN = 25;
