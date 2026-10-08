// Town politics and law (data/politics.ts has the numbers and the story). `s.politics` (`PoliticsState`): the blocs'
// satisfaction, the laws in force, a vote, a trial or a revolt waiting on the player, a strike under way, and a log.
// `politicsHourly` (from sim.ts; off with the autopilot, so the tests' plainGame never sees it): at dawn each bloc's
// satisfaction drifts toward its target (`targetOf`: the laws it's for or against, the tax, how the town is doing by
// its lights, its members' spirits) and the laws do their daily work (`dailyLaws`); every few days the council meets
// (`council`: the unhappiest bloc puts a law forward, or its repeal, or a lower tax, and everyone votes by their bloc);
// in the small hours crime may come (`crime`: theft, assault, vandalism, now and then murder), and a culprit caught is
// tried; at noon an angry bloc may strike (its members gather at the seat and won't work: `striking`, the `protest`
// task in people.ts) and a town ruled badly may rise (`revolt`). The votes, trials and revolts are prompts the event box
// shows (`answerPolitics`, from answerPrompt).

import { BUILDING_BY_ID } from '../data/buildings';
import { CLASS_DEFS } from '../data/classes';
import { eventPicture } from '../data/eventScenes';
import { natureOf } from '../data/natures';
import { FOOD_VALUE } from '../data/people';
import {
  BLOC_DEFS, BLOCS, CAUGHT_BASE, CAUGHT_HARSH, CAUGHT_MOST, CAUGHT_PER_GUARD, COUNCIL_EVERY_DAYS, COUNCIL_FROM_DAY, COUNCIL_HOUR, COUNCIL_HOURS, COUNCIL_OPTIONS, COUNCIL_PEOPLE, CRIME_BASE, CRIME_HOUR, CRIME_PEOPLE, CRIME_PER_GUARD, CRIME_POOR, CRIME_UNHAPPY, CRIMES,
  CRIMINAL_NATURES, CURFEW_CRIME, FINE, GIVE_WAY, HARSH_CRIME, LAW_BY_ID, LAW_PULL, LAWS, MOOD_DIV, MOOD_LEAST, MOOD_MOST, MORALE_PULL, OVERRULE_COST, POOR_COINS, REVOLT_AT, REVOLT_BLOC_AT, REVOLT_GAP_DAYS, REVOLT_HOURS, REVOLT_OPTIONS, SAT_BASE, SAT_DRIFT, SAT_START,
  SENTENCE_OF, SENTENCE_PULL, SENTENCES, STEP_DOWN, STOCKS_MORALE, STRIKE_AT, STRIKE_EASE, STRIKE_GAP_DAYS, STRIKE_HOURS, TAX_PULL, TRIAL_HOURS, type BlocId, type CrimeKind, type LawId, type Sentence,
} from '../data/politics';
import type { TaxRate } from '../data/economy';
import { hashSeed, mixSeed, Rng } from '../rng';
import { totalStock } from './buildings';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { giveCoins } from './economy';
import { enemiesOf, isChild } from './social';
import { earn, notify, type GameState, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds, gainSkill } from './townsfolk';
import { seaTown } from './sea';
import { weatherAt } from './weather';
import { seatOf } from '../data/seats';
import { campXY } from './state';

export interface PoliticsState {
  sat: Record<BlocId, number>;
  laws: LawId[];
  lastCouncil?: number;
  vote?: { prompt: number; by: BlocId; law?: LawId; repeal?: boolean; tax?: TaxRate; for: number; against: number; passes: boolean };
  trial?: { prompt: number; who: number; crime: CrimeKind; what: string; options: Sentence[]; victim?: number };
  strike?: { bloc: BlocId; until: number };
  lastStrike?: Partial<Record<BlocId, number>>;
  revolt?: { prompt: number; bloc: BlocId };
  lastRevolt?: number;
  /** A day's crime and trial counts, for the menu. */
  crimes?: number;
  caught?: number;
  log: { day: number; kind: 'vote' | 'crime' | 'trial' | 'strike' | 'revolt' | 'law'; text: string }[];
}

const LOG_KEPT = 14;
const rngOf = (s: GameState, salt: number) => new Rng(mixSeed(hashSeed(s.seed), 0x9071c, s.tick * 3 + salt));
const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function politicsOf(s: GameState): PoliticsState {
  return (s.politics ??= { sat: { guilds: SAT_START, devout: SAT_START, soldiers: SAT_START, commons: SAT_START }, laws: [], log: [] });
}
export const lawOn = (s: Pick<GameState, 'politics'>, id: LawId) => !!s.politics?.laws.includes(id);

function log(s: GameState, kind: PoliticsState['log'][number]['kind'], text: string, key = false): void {
  const pol = politicsOf(s);
  pol.log.unshift({ day: day(s), kind, text });
  if (pol.log.length > LOG_KEPT) pol.log.length = LOG_KEPT;
  notify(s, text, key);
}

/* ------------------------------------------------------------ who's who */

const FIGHTING = new Set(['tank', 'bruiser', 'striker', 'shooter']);

/** The bloc someone belongs to (never the founder: they rule). */
export function blocOf(s: GameState, p: Person): BlocId | null {
  if (p.id === s.mainId || isChild(p) || p.monster === 'undead') return null;
  if (p.guard || p.ambition === 'guard' || p.ambition === 'adventurer') return 'soldiers';
  const n = natureOf(p).id;
  if (n === 'pious' || p.ambition === 'scholar') return 'devout';
  if (p.ambition === 'crafter' || p.ambition === 'keeper' || p.ambition === 'wealthy' || s.buildings.some((b) => b.owner === p.id && b.shop)) return 'guilds';
  if (p.cls && FIGHTING.has(CLASS_DEFS[p.cls]?.role)) return 'soldiers';
  return 'commons';
}
const grownAtHome = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p));
export const membersOf = (s: GameState, b: BlocId) => grownAtHome(s).filter((p) => blocOf(s, p) === b);

/** What a bloc's satisfaction is drifting toward. */
export function targetOf(s: GameState, b: BlocId): number {
  const pol = politicsOf(s);
  let t = SAT_BASE;
  for (const l of pol.laws) t += (LAW_BY_ID[l].stance[b] ?? 0) * LAW_PULL;
  t += TAX_PULL[s.tax ?? 'fair']?.[b] ?? 0;
  const eaters = s.people.filter((p) => !p.monster).length || 1;
  const food = Object.entries(totalStock(s)).reduce((n, [m, k]) => n + (FOOD_VALUE[m as keyof typeof FOOD_VALUE] ? (k ?? 0) : 0), 0) / eaters;
  if (b === 'commons') {
    if (food < 2) t -= 15;
    const poor = grownAtHome(s).filter((p) => (p.coins ?? 0) < POOR_COINS).length / Math.max(1, grownAtHome(s).length);
    t -= Math.round(poor * 10);
  }
  if (b === 'soldiers') {
    const recent = (s.fallen ?? []).filter((f) => f.day >= day(s) - 5).length;
    t -= Math.min(20, recent * 4);
    if (s.people.some((p) => p.guard)) t += 5;
  }
  if (b === 'devout') {
    const f = s.faith?.favour;
    const avg = f ? Object.values(f).reduce((a, v) => a + v, 0) / Object.values(f).length : 0;
    if (avg > 30) t += 8;
    else if (avg < -30) t -= 10;
    if (!s.buildings.some((x) => x.status === 'done' && ['wayside_shrine', 'temple', 'cathedral'].includes(x.def))) t -= 8;
  }
  if (b === 'guilds') {
    const takings = s.buildings.reduce((n, x) => n + (x.shop?.takings?.yesterday ?? 0), 0);
    if (takings > 50) t += 6;
  }
  const ms = membersOf(s, b);
  if (ms.length) t += (ms.reduce((n, p) => n + p.morale, 0) / ms.length - 50) * MORALE_PULL;
  return clamp(t);
}

/** A member's mood line from their bloc (townsfolk.ts `mood`). */
export function blocMood(s: GameState, p: Person): { text: string; value: number } | null {
  const pol = s.politics;
  if (!pol) return null;
  const b = blocOf(s, p);
  if (!b) return null;
  const v = Math.max(MOOD_LEAST, Math.min(MOOD_MOST, Math.round((pol.sat[b] - 50) / MOOD_DIV)));
  if (!v) return null;
  return { text: v > 0 ? BLOC_DEFS[b].happy : BLOC_DEFS[b].angry, value: v };
}

/* ------------------------------------------------------------ the hour */

export function politicsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  if (grownAtHome(s).length < 3) return;
  const pol = politicsOf(s);
  const hour = calendar(s.tick).hour;
  // (questions left unanswered: their defaults, by the generic expiry in roadEvents.ts; tidy up after)
  if (pol.vote && !s.prompts.some((q) => q.id === pol.vote!.prompt)) pol.vote = undefined;
  if (pol.trial && !s.prompts.some((q) => q.id === pol.trial!.prompt)) pol.trial = undefined;
  if (pol.revolt && !s.prompts.some((q) => q.id === pol.revolt!.prompt)) pol.revolt = undefined;
  if (pol.strike && s.tick >= pol.strike.until) {
    pol.sat[pol.strike.bloc] = clamp(pol.sat[pol.strike.bloc] + STRIKE_EASE);
    log(s, 'strike', `${BLOC_DEFS[pol.strike.bloc].name} end their strike and go back to work.`);
    pol.strike = undefined;
  }
  if (hour === 6) {
    for (const b of BLOCS) pol.sat[b] = clamp(pol.sat[b] + (targetOf(s, b) - pol.sat[b]) * SAT_DRIFT);
    dailyLaws(s, rngOf(s, 1));
  }
  if (hour === CRIME_HOUR) crime(s, rngOf(s, 2));
  if (hour === 12 && !s.raid) unrest(s, rngOf(s, 3));
  if (hour === COUNCIL_HOUR) council(s);
}

/* ------------------------------------------------------------ the laws at work */

function dailyLaws(s: GameState, rng: Rng): void {
  const pol = politicsOf(s);
  const grown = grownAtHome(s);
  if (pol.laws.includes('conscription')) for (const p of grown) gainSkill(p, 'melee', 6);
  if (pol.laws.includes('temple_tithe') && s.faith) {
    const give = Math.min(Math.floor((s.coins ?? 0) * 0.02) + 2, s.coins ?? 0);
    if (give > 0) {
      s.coins = (s.coins ?? 0) - give;
      earn(s, 'realm', -give);
      for (const k of Object.keys(s.faith.favour) as (keyof typeof s.faith.favour)[]) s.faith.favour[k] = Math.min(100, s.faith.favour[k] + 2);
    }
  }
  if (pol.laws.includes('market_charter')) {
    const fee = s.buildings.filter((b) => b.status === 'done' && b.shop).length * 4;
    if (fee) {
      s.coins = (s.coins ?? 0) + fee;
      earn(s, 'tax', fee);
    }
  }
  if (pol.laws.includes('poor_relief')) {
    for (const p of grown) {
      if ((p.coins ?? 0) >= POOR_COINS || (s.coins ?? 0) < 3) continue;
      s.coins = (s.coins ?? 0) - 3;
      earn(s, 'realm', -3);
      giveCoins(s, p, 3);
    }
  }
  if (pol.laws.includes('rest_day') && day(s) % 7 === 0) (s.marks ??= []).push({ lever: 'morale', value: 4, until: s.tick + TICKS_PER_DAY, text: 'A day of rest' });
  void rng;
}

/* ------------------------------------------------------------ the council */

/** What a bloc would put to the council: the law in force it hates most repealed, else a law it wants, else a lower
 *  tax. */
export function proposalOf(s: GameState, b: BlocId): { law?: LawId; repeal?: boolean; tax?: TaxRate } | null {
  const pol = politicsOf(s);
  const hated = pol.laws.find((l) => LAW_BY_ID[l].stance[b] === -1);
  if (hated) return { law: hated, repeal: true };
  const wanted = LAWS.find((l) => l.stance[b] === 1 && !pol.laws.includes(l.id));
  if (wanted) return { law: wanted.id };
  if ((s.tax ?? 'fair') !== 'low' && (TAX_PULL.low[b] ?? 0) > 0) return { tax: s.tax === 'heavy' ? 'fair' : 'low' };
  return null;
}
/** A bloc's stance on a proposal: +1 for, -1 against. */
function stanceOn(b: BlocId, prop: NonNullable<ReturnType<typeof proposalOf>>): number {
  if (prop.tax) return Math.sign(TAX_PULL.low[b] ?? 0) || 0;
  const st = LAW_BY_ID[prop.law!].stance[b] ?? 0;
  return prop.repeal ? -st : st;
}
const proposalName = (prop: NonNullable<ReturnType<typeof proposalOf>>) =>
  prop.tax ? `lowering the tax to ${prop.tax}` : prop.repeal ? `repealing ${LAW_BY_ID[prop.law!].name.toLowerCase()}` : `passing ${LAW_BY_ID[prop.law!].name.toLowerCase()}`;

export function council(s: GameState): void {
  const pol = politicsOf(s);
  if (pol.vote || day(s) < COUNCIL_FROM_DAY || grownAtHome(s).length < COUNCIL_PEOPLE) return;
  if (pol.lastCouncil !== undefined && s.tick - pol.lastCouncil < COUNCIL_EVERY_DAYS * TICKS_PER_DAY - TICKS_PER_HOUR) return;
  pol.lastCouncil = s.tick;
  // (the unhappiest bloc with members and something to ask for)
  const order = BLOCS.filter((b) => membersOf(s, b).length).sort((a, b) => pol.sat[a] - pol.sat[b]);
  for (const b of order) {
    const prop = proposalOf(s, b);
    if (!prop) continue;
    callVote(s, b, prop);
    return;
  }
}

export function callVote(s: GameState, by: BlocId, prop: NonNullable<ReturnType<typeof proposalOf>>): void {
  const pol = politicsOf(s);
  let yes = 0;
  let no = 0;
  for (const p of grownAtHome(s)) {
    const b = blocOf(s, p);
    if (!b) continue;
    const st = stanceOn(b, prop);
    if (st > 0) yes++;
    else if (st < 0) no++;
  }
  const passes = yes > no;
  const name = proposalName(prop);
  const cal = calendar(s.tick);
  const what = prop.tax ? 'the tax' : LAW_BY_ID[prop.law!].does;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'council',
    expedition: null,
    title: `The council votes on ${name}`,
    text: `${BLOC_DEFS[by].name} called for ${name}. ${yes} for, ${no} against: it ${passes ? 'passes' : 'fails'}.`,
    options: [...COUNCIL_OPTIONS],
    defaultOption: 0,
    expiresTick: s.tick + COUNCIL_HOURS * TICKS_PER_HOUR,
    story: `The council meets by the fire as the light goes. ${BLOC_DEFS[by].name} have the floor, and they've come angry: they call for ${name}.${prop.tax ? '' : ` (${what})`}\n\nThe town votes: ${yes} for, ${no} against. It ${passes ? 'passes' : 'fails'}.\n\nYou may let the vote stand, or overrule it. Overruled, those who won will not forget it.`,
    picture: eventPicture(`council:${s.tick}`, 'town hall crowd council vote', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    politics: 'vote',
  };
  s.prompts.push(prompt);
  pol.vote = { prompt: prompt.id, by, ...prop, for: yes, against: no, passes };
}

function settleVote(s: GameState, overrule: boolean): void {
  const pol = politicsOf(s);
  const v = pol.vote;
  if (!v) return;
  pol.vote = undefined;
  const prop = { law: v.law, repeal: v.repeal, tax: v.tax };
  const passes = overrule ? !v.passes : v.passes;
  const name = proposalName(prop);
  if (overrule)
    for (const b of BLOCS) {
      const st = stanceOn(b, prop);
      if ((v.passes && st > 0) || (!v.passes && st < 0)) pol.sat[b] = clamp(pol.sat[b] - OVERRULE_COST);
    }
  if (passes) {
    if (prop.tax) s.tax = prop.tax;
    else if (prop.repeal) pol.laws = pol.laws.filter((l) => l !== prop.law);
    else if (prop.law && !pol.laws.includes(prop.law)) pol.laws.push(prop.law);
  }
  log(s, 'vote', `${overrule ? 'Overruled by the founder: ' : 'The council: '}${name} ${passes ? 'carried' : 'thrown out'} (${v.for} for, ${v.against} against).`, true);
}

/* ------------------------------------------------------------ crime */

export function crime(s: GameState, rng: Rng): void {
  const pol = politicsOf(s);
  const grown = grownAtHome(s);
  if (grown.length < CRIME_PEOPLE || pol.trial || s.raid) return;
  const poor = grown.filter((p) => (p.coins ?? 0) < POOR_COINS).length / grown.length;
  const unhappy = grown.filter((p) => p.morale < 40).length / grown.length;
  const guards = s.people.filter((p) => p.guard && p.away === null).length;
  let chance = CRIME_BASE * (1 + poor * CRIME_POOR + unhappy * CRIME_UNHAPPY) / (1 + guards * CRIME_PER_GUARD);
  if (lawOn(s, 'curfew')) chance *= CURFEW_CRIME;
  if (lawOn(s, 'harsh_law')) chance *= HARSH_CRIME;
  if (!rng.chance(chance)) return;
  // the culprit: the unhappy, the poor, the greedy and the grumpy first
  const pool = grown.filter((p) => p.id !== s.mainId && !p.guard && !p.downed && !p.monster);
  if (!pool.length) return;
  const weight = (p: Person) => 1 + (p.morale < 40 ? 2 : 0) + ((p.coins ?? 0) < POOR_COINS ? 1.5 : 0) + (CRIMINAL_NATURES.includes(natureOf(p).id) ? 2 : 0);
  const total = pool.reduce((n, p) => n + weight(p), 0);
  let r = rng.next() * total;
  const culprit = pool.find((p) => (r -= weight(p)) <= 0) ?? pool[0];
  let kind = rng.weighted({ ...CRIMES }) as CrimeKind;
  const enemies = enemiesOf(s, culprit).filter((e) => e.away === null && !e.downed);
  if (kind === 'murder' && !enemies.length) kind = 'assault';
  const others = grown.filter((p) => p !== culprit && !p.downed);
  let what = '';
  let victim: Person | undefined;
  if (kind === 'theft') {
    const marks = others.filter((p) => (p.coins ?? 0) > 10);
    victim = marks.length && rng.chance(0.6) ? marks[rng.int(0, marks.length - 1)] : undefined;
    const from = victim ? (victim.coins ?? 0) : s.coins ?? 0;
    const n = Math.min(from, rng.int(5, 20));
    if (n <= 0) return;
    if (victim) victim.coins = (victim.coins ?? 0) - n;
    else s.coins = (s.coins ?? 0) - n;
    culprit.coins = (culprit.coins ?? 0) + n;
    what = victim ? `stole ${n} coins from ${victim.name}` : `stole ${n} coins from the treasury`;
  } else if (kind === 'assault' || kind === 'murder') {
    victim = kind === 'murder' ? enemies[rng.int(0, enemies.length - 1)] : others[rng.int(0, Math.max(0, others.length - 1))];
    if (!victim) return;
    if (kind === 'murder') {
      killPerson(s, victim, `murdered by ${culprit.name}`);
      what = `murdered ${victim.name}`;
    } else {
      const hp = Math.round(victim.hp * 0.25);
      victim.hp = Math.max(1, victim.hp - hp);
      minorWound(s, victim, hp, rng);
      what = `beat ${victim.name} in the dark`;
    }
  } else {
    const can = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire');
    if (!can.length) return;
    const b = can[rng.int(0, can.length - 1)];
    if (b.hp !== undefined) b.hp = Math.max(1, b.hp * 0.7);
    what = `smashed up the ${(BUILDING_BY_ID[b.def]?.name ?? b.def).toLowerCase()}`;
  }
  pol.crimes = (pol.crimes ?? 0) + 1;
  const caught = Math.min(CAUGHT_MOST, CAUGHT_BASE + guards * CAUGHT_PER_GUARD + (lawOn(s, 'harsh_law') ? CAUGHT_HARSH : 0));
  if (!rng.chance(caught)) {
    log(s, 'crime', `In the night someone ${what}. Nobody saw who.`, kind === 'murder');
    return;
  }
  pol.caught = (pol.caught ?? 0) + 1;
  trial(s, culprit, kind, what, victim);
}

export function trial(s: GameState, culprit: Person, crime: CrimeKind, what: string, victim?: Person): void {
  const pol = politicsOf(s);
  const options: Sentence[] = crime === 'murder' ? ['pardon', 'stocks', 'exile', 'hang'] : ['pardon', 'fine', 'stocks', 'exile'];
  const harsh = lawOn(s, 'harsh_law');
  const def: Sentence = crime === 'murder' ? (harsh ? 'hang' : 'exile') : crime === 'theft' ? (harsh ? 'stocks' : 'fine') : crime === 'assault' ? (harsh ? 'exile' : 'stocks') : 'fine';
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'trial',
    expedition: null,
    title: `The trial of ${culprit.name}`,
    text: `${culprit.name} ${what}, and was caught. The town waits for the sentence.`,
    options: options.map((o) => SENTENCES[SENTENCE_OF.indexOf(o)]),
    defaultOption: options.indexOf(def),
    expiresTick: s.tick + TRIAL_HOURS * TICKS_PER_HOUR,
    story: `In the night ${culprit.name} ${what}, and was caught at it. In the morning the whole town crowds in to see them judged.\n\n${culprit.name} is ${natureOf(culprit).name.toLowerCase()}, ${(culprit.coins ?? 0) < POOR_COINS ? 'poor' : 'not poor'}, and ${culprit.morale < 40 ? 'has been unhappy a long while' : 'had no great grievance anyone knew of'}. The devout ask for mercy; the soldiers for an example.${harsh ? ' The law of the town is harsh.' : ''}`,
    picture: eventPicture(`trial:${s.tick}`, 'crime law court justice crowd', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: culprit.id,
    politics: 'trial',
  };
  s.prompts.push(prompt);
  pol.trial = { prompt: prompt.id, who: culprit.id, crime, what, options, victim: victim?.id };
  log(s, 'crime', `${culprit.name} ${what}, and was caught. A trial is called.`, true);
}

function sentence(s: GameState, option: number, rng: Rng): void {
  const pol = politicsOf(s);
  const t = pol.trial;
  if (!t) return;
  pol.trial = undefined;
  const p = s.people.find((q) => q.id === t.who);
  const sen = t.options[option] ?? t.options[0];
  for (const [b, v] of Object.entries(SENTENCE_PULL[sen]) as [BlocId, number][]) pol.sat[b] = clamp(pol.sat[b] + v);
  if (!p) return;
  const bloc = blocOf(s, p);
  if (bloc && (sen === 'exile' || sen === 'hang')) pol.sat[bloc] = clamp(pol.sat[bloc] - 6);
  let out = '';
  if (sen === 'pardon') out = `${p.name} is pardoned, and walks free.`;
  else if (sen === 'fine') {
    const n = Math.min(FINE, p.coins ?? 0);
    p.coins = (p.coins ?? 0) - n;
    s.coins = (s.coins ?? 0) + n;
    earn(s, 'tax', n);
    out = `${p.name} is fined ${n} coins.`;
  } else if (sen === 'stocks') {
    p.sore = { until: s.tick + 2 * TICKS_PER_DAY, value: STOCKS_MORALE, text: 'Put in the stocks' };
    out = `${p.name} spends a day in the stocks, pelted with rotten turnips.`;
  } else if (sen === 'exile') {
    s.people = s.people.filter((q) => q !== p);
    assignBeds(s);
    out = `${p.name} is exiled, and walks out of the gate with what they can carry.`;
  } else {
    killPerson(s, p, 'hanged by the town');
    out = `${p.name} is hanged before the town.`;
  }
  log(s, 'trial', out, true);
  void rng;
}

/* ------------------------------------------------------------ strikes and revolt */

/** Someone on strike: they gather at the seat and won't work (people.ts `protest`). */
export const striking = (s: GameState, p: Person): boolean => {
  const st = s.politics?.strike;
  return !!st && s.tick < st.until && p.away === null && !p.downed && blocOf(s, p) === st.bloc;
};
/** Where the strikers gather: before the seat, else the fire. */
export function protestSpot(s: GameState, p: Person): { x: number; y: number } {
  const seat = seatOf(s.buildings);
  const at = seat ? { x: (seat.tile + BUILDING_BY_ID[seat.def].width / 2) * 32, y: (seat.row + 3.6) * 32 } : { ...campXY(s), y: campXY(s).y + 64 };
  return { x: at.x + ((p.id % 6) - 2.5) * 20, y: at.y + (Math.floor(p.id / 6) % 3) * 18 };
}

export function unrest(s: GameState, rng: Rng): void {
  const pol = politicsOf(s);
  // (a revolt: the town overall, or a bloc very low that has struck already)
  const grown = grownAtHome(s).filter((p) => blocOf(s, p));
  if (!pol.revolt && grown.length >= COUNCIL_PEOPLE && (pol.lastRevolt === undefined || s.tick - pol.lastRevolt > REVOLT_GAP_DAYS * TICKS_PER_DAY)) {
    const overall = grown.reduce((n, p) => n + pol.sat[blocOf(s, p)!], 0) / grown.length;
    const angry = BLOCS.find((b) => pol.sat[b] < REVOLT_BLOC_AT && pol.lastStrike?.[b] !== undefined && membersOf(s, b).length >= 2);
    if (overall < REVOLT_AT || angry) {
      const bloc = angry ?? [...BLOCS].filter((b) => membersOf(s, b).length).sort((a, b) => pol.sat[a] - pol.sat[b])[0];
      if (bloc) return revolt(s, bloc);
    }
  }
  if (pol.strike) return;
  for (const b of BLOCS) {
    if (pol.sat[b] >= STRIKE_AT || membersOf(s, b).length < 2) continue;
    const last = pol.lastStrike?.[b];
    if (last !== undefined && s.tick - last < STRIKE_GAP_DAYS * TICKS_PER_DAY) continue;
    if (!rng.chance(0.6)) continue;
    pol.strike = { bloc: b, until: s.tick + STRIKE_HOURS * TICKS_PER_HOUR };
    (pol.lastStrike ??= {})[b] = s.tick;
    log(s, 'strike', `${BLOC_DEFS[b].name} down tools and gather before the seat: they'll not work until they're heard!`, true);
    return;
  }
}

function revolt(s: GameState, bloc: BlocId): void {
  const pol = politicsOf(s);
  const founder = s.people.find((p) => p.id === s.mainId);
  const cal = calendar(s.tick);
  const can = (s.people.filter((p) => p.guard).length > 0 || membersOf(s, 'soldiers').length > 0) && pol.sat.soldiers > 40;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'revolt',
    expedition: null,
    title: 'The town rises!',
    text: `${BLOC_DEFS[bloc].name} lead the town against ${founder?.name ?? 'its founder'}.`,
    options: [...REVOLT_OPTIONS],
    defaultOption: can ? 1 : 0,
    expiresTick: s.tick + REVOLT_HOURS * TICKS_PER_HOUR,
    story: `It starts with shouting in the square and ends with torches. ${BLOC_DEFS[bloc].name} have had enough, and half the town has come with them: they want ${founder?.name ?? 'the founder'} to answer for how the town is ruled.\n\nYou can give way (repeal what they hate, lower the tax), put it down (the soldiers and the guards against the crowd: there will be blood), or step down and let the town choose another to lead it.`,
    picture: eventPicture(`revolt:${s.tick}`, 'fire riot crowd torches night town', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: founder?.id,
    politics: 'revolt',
  };
  s.prompts.push(prompt);
  pol.revolt = { prompt: prompt.id, bloc };
  pol.lastRevolt = s.tick;
  log(s, 'revolt', `${BLOC_DEFS[bloc].name} lead the town in revolt against ${founder?.name ?? 'the founder'}!`, true);
}

function endRevolt(s: GameState, option: number, rng: Rng): void {
  const pol = politicsOf(s);
  const r = pol.revolt;
  if (!r) return;
  pol.revolt = undefined;
  const choice = REVOLT_OPTIONS[option] ?? REVOLT_OPTIONS[0];
  if (choice === REVOLT_OPTIONS[0]) {
    const hated = (b: BlocId) => pol.laws.filter((l) => LAW_BY_ID[l].stance[b] === -1);
    pol.laws = pol.laws.filter((l) => !hated(r.bloc).includes(l));
    s.tax = 'low';
    for (const b of BLOCS) pol.sat[b] = clamp(pol.sat[b] + (b === r.bloc ? GIVE_WAY * 1.5 : GIVE_WAY / 2));
    log(s, 'revolt', `The founder gives way: what ${BLOC_DEFS[r.bloc].name.toLowerCase()} hated is struck down, and the tax lowered. The crowd goes home.`, true);
    return;
  }
  if (choice === REVOLT_OPTIONS[1]) {
    const rebels = membersOf(s, r.bloc).filter((p) => !p.guard);
    const loyal = s.people.filter((p) => p.away === null && (p.guard || blocOf(s, p) === 'soldiers') && blocOf(s, p) !== r.bloc);
    const hurt: string[] = [];
    for (const p of [...rebels.slice(0, 3), ...loyal.slice(0, 2)]) {
      const hp = Math.round(p.hp * rng.range(0.2, 0.5));
      p.hp = Math.max(1, p.hp - hp);
      minorWound(s, p, hp, rng);
      hurt.push(p.name);
    }
    const dead: string[] = [];
    for (const p of [...rebels.slice(0, 2), ...loyal.slice(0, 1)]) if (rng.chance(0.25)) {
      dead.push(p.name);
      killPerson(s, p, 'killed when the revolt was put down');
    }
    const leader = rebels.filter((p) => s.people.includes(p)).sort((a, b) => b.skills.social.level - a.skills.social.level)[0];
    if (leader) {
      s.people = s.people.filter((q) => q !== leader);
      assignBeds(s);
    }
    pol.sat[r.bloc] = clamp(pol.sat[r.bloc] + 10);
    pol.sat.soldiers = clamp(pol.sat.soldiers + 8);
    for (const b of BLOCS) if (b !== r.bloc && b !== 'soldiers') pol.sat[b] = clamp(pol.sat[b] - 5);
    log(s, 'revolt', `The revolt is put down. ${hurt.length ? `${hurt.join(', ')} hurt` : 'Nobody hurt'}${dead.length ? `; ${dead.join(', ')} killed` : ''}${leader ? `; ${leader.name}, its ringleader, exiled` : ''}.`, true);
    return;
  }
  // step down: the bloc's most persuasive leads now
  const next = membersOf(s, r.bloc).sort((a, b) => b.skills.social.level - a.skills.social.level)[0] ?? grownAtHome(s).filter((p) => p.id !== s.mainId)[0];
  const old = s.people.find((p) => p.id === s.mainId);
  if (next) {
    s.mainId = next.id;
    for (const b of BLOCS) pol.sat[b] = clamp(pol.sat[b] + STEP_DOWN);
    log(s, 'revolt', `${old?.name ?? 'The founder'} steps down. ${next.name} of ${BLOC_DEFS[r.bloc].name.toLowerCase()} leads the town now.`, true);
  }
}

/** A political question answered (from roadEvents.ts `answerPrompt`). */
export function answerPolitics(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  if (prompt.politics === 'vote') return settleVote(s, option === 1);
  if (prompt.politics === 'trial') return sentence(s, option, rng);
  if (prompt.politics === 'revolt') return endRevolt(s, option, rng);
}

/* ------------------------------------------------------------ seen */

export interface PoliticsView {
  blocs: { id: BlocId; name: string; who: string; colour: string; sat: number; target: number; members: string[]; wants: string | null; striking: boolean }[];
  laws: { id: LawId; name: string; does: string; on: boolean; for: string[]; against: string[] }[];
  log: PoliticsState['log'];
  crimes: number;
  caught: number;
  strike: { bloc: string; hours: number } | null;
  tax: TaxRate;
}

export function politicsView(s: GameState): PoliticsView | null {
  const pol = s.politics;
  if (!pol) return null;
  return {
    blocs: BLOCS.map((b) => {
      const prop = proposalOf(s, b);
      return {
        id: b,
        name: BLOC_DEFS[b].name,
        who: BLOC_DEFS[b].who,
        colour: BLOC_DEFS[b].colour,
        sat: Math.round(pol.sat[b]),
        target: Math.round(targetOf(s, b)),
        members: membersOf(s, b).map((p) => p.name),
        wants: prop ? proposalName(prop) : null,
        striking: pol.strike?.bloc === b && s.tick < pol.strike.until,
      };
    }),
    laws: LAWS.map((l) => ({
      id: l.id,
      name: l.name,
      does: l.does,
      on: pol.laws.includes(l.id),
      for: BLOCS.filter((b) => l.stance[b] === 1).map((b) => BLOC_DEFS[b].name),
      against: BLOCS.filter((b) => l.stance[b] === -1).map((b) => BLOC_DEFS[b].name),
    })),
    log: pol.log.slice(0, 10),
    crimes: pol.crimes ?? 0,
    caught: pol.caught ?? 0,
    strike: pol.strike && s.tick < pol.strike.until ? { bloc: BLOC_DEFS[pol.strike.bloc].name, hours: Math.ceil((pol.strike.until - s.tick) / TICKS_PER_HOUR) } : null,
    tax: s.tax ?? 'fair',
  };
}
