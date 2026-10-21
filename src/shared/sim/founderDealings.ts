// More ways to interact (step 5 of playing the founder). The founder can set terms for a visitor at the gate, take a
// child on as an apprentice, arrange a match for a grown child or court for themselves, host a feast or a festival, and
// haggle with a caravan at the market. Each is a command (sim/commands.ts). A match and a haggle are put to the player as
// a question that waits (`Prompt.deal`, `Prompt.waits`): the game is held until it is answered (`waitingOnFounder`).
// Not gated by the autopilot (they are the player's orders). Every roll is a side stream of its own.

import { MATERIAL_NAMES, type Material, type Stock } from '../data/materials';
import { FEAST_FOOD_DAYS, FEAST_HOURS } from '../data/ceremonies';
import { TREASURY_KEEP } from '../data/economy';
import { natureFit, natureOf } from '../data/natures';
import { PURSE_SCALE } from '../data/shop';
import { Rng, hashSeed } from '../rng';
import { buildingDoor } from './buildings';
import { eatFeast, foodDays, gather, here, tavernOf } from './ceremonies';
import { founderOf } from './founder';
import { bestSkill } from './lineage';
import { acceptVisitor, rejectVisitor } from './townsfolk';
import { adjust, brawl, chemistry, isChild, opinion } from './social';
import { canTrade, trade } from './trade';
import { campXY, earn, eatersOf, notify, tireless, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_HOUR } from './time';
import type { Skill } from '../data/skills';

/** What a visitor may be asked for entering (coins, scaled by the era), and the chance they take offence and go. */
export const VISITOR_FEE = 8;
const FEE_OFFENCE = 0.3;
/** What a favour from a newcomer is worth to the founder (opinion points). */
const FAVOUR_WARMTH = 30;
/** An apprentice a master takes at most. */
export const APPRENTICES_MOST = 2;
/** A feast and a festival: cost (coins, scaled by the era), the wait before the next (game hours), the extra renown,
 *  the mood they leave, and the chance of trouble. */
export const FEASTS = {
  feast: { cost: 10, wait: 48, renown: 1, hours: FEAST_HOURS, mood: [0, 0] as [number, number], trouble: 0.15 },
  festival: { cost: 35, wait: 120, renown: 3, hours: FEAST_HOURS + 2, mood: [6, 48] as [number, number], trouble: 0.3 },
} as const;
export type FeastGrade = keyof typeof FEASTS;
/** A hard bargain takes this share off what they ask, and risks the caravan's temper; a gift costs coins and earns goodwill. */
export const HARD_CUT = 0.8;
const INSULT_BASE = 0.4;
const INSULT_PER_SOCIAL = 0.02;
export const GIFT_COIN = 8;
const GIFT_GOODWILL = 2;

const side = (s: GameState, what: string, extra: number | string): Rng => new Rng(hashSeed(`${s.seed}:dealings:${what}:${s.tick}:${extra}`));
const levelOf = (p: Person, k: Skill): number => p.skills[k]?.level ?? 0;
const social = (p: Person): number => p.skills.social.level;
const scaled = (s: GameState, n: number): number => Math.round(n * PURSE_SCALE[s.era]);
const dealings = (s: GameState) => (s.dealings ??= {});

/** The founder is at home and able to act. */
const ready = (s: GameState): Person | null => {
  const f = founderOf(s);
  return f && f.away === null && !f.downed ? f : null;
};

/** Can the purse and then the treasury (above its keep) meet this? */
const canPay = (s: GameState, f: Person, n: number): boolean => Math.floor(f.coins ?? 0) + Math.max(0, Math.floor(s.coins ?? 0) - TREASURY_KEEP) >= n;
/** Pay from the founder's purse first, then the treasury's spare. */
function pay(s: GameState, f: Person, n: number): void {
  const own = Math.min(n, Math.floor(f.coins ?? 0));
  f.coins = (f.coins ?? 0) - own;
  const rest = n - own;
  if (rest > 0) {
    s.coins = (s.coins ?? 0) - rest;
    earn(s, 'events', -rest);
  }
}

/* ------------------------------------------------------------ the visitor at the gate */

/** The fee a visitor is asked for. */
export const visitorFee = (s: GameState): number => scaled(s, VISITOR_FEE);

/** Set terms for the wanderer at the gate: a fee to the treasury (they may take offence and go), or a favour owed
 *  (they come gladly and think well of the founder). */
export function founderVisitor(s: GameState, terms: 'fee' | 'favour'): void {
  const f = ready(s);
  const v = s.visitor;
  if (!f || !v || v.leavingTo !== null) return;
  const name = v.person.name;
  if (terms === 'fee') {
    const offended = side(s, 'visitor', v.person.id).chance(Math.max(0.05, FEE_OFFENCE - social(f) * INSULT_PER_SOCIAL));
    if (offended) {
      rejectVisitor(s);
      notify(s, `${name} takes offence at the price and goes on their way.`, true);
      return;
    }
    const fee = visitorFee(s);
    s.coins = (s.coins ?? 0) + fee;
    earn(s, 'events', fee);
    acceptVisitor(s);
    notify(s, `${name} pays ${fee} coins to the treasury and stays.`);
    return;
  }
  acceptVisitor(s);
  adjust(s, f.id, v.person.id, FAVOUR_WARMTH);
  notify(s, `${name} stays, and owes ${f.name} a favour.`);
}

/* ------------------------------------------------------------ apprentices */

/** Grown-ups who could take an apprentice: at home, able, skilled enough, with a place free. */
export function mastersOf(s: GameState): Person[] {
  return s.people
    .filter((p) => !isChild(p) && !p.monster && p.away === null && !p.downed && levelOf(p, bestSkill(p)) >= 2 && s.people.filter((c) => c.master === p.id).length < APPRENTICES_MOST)
    .sort((a, b) => levelOf(b, bestSkill(b)) - levelOf(a, bestSkill(a)) || a.id - b.id);
}

/** Apprentice a child to a master, for the master's best trade. */
export function founderApprentice(s: GameState, child: number, master: number): void {
  if (!ready(s)) return;
  const c = s.people.find((p) => p.id === child);
  const m = mastersOf(s).find((p) => p.id === master);
  if (!c || !m || !isChild(c) || c.master === m.id) return;
  const trade = bestSkill(m);
  c.master = m.id;
  c.trade = trade;
  notify(s, `${c.name} is apprenticed to ${m.id === s.mainId ? 'you' : m.name} to learn ${trade}.`, true);
}

/* ------------------------------------------------------------ matches and courting */

const kin = (a: Person, b: Person): boolean => !!(a.parents?.includes(b.id) || b.parents?.includes(a.id) || a.parents?.some((x) => b.parents?.includes(x)));
const single = (p: Person): boolean => !isChild(p) && (p.partner ?? null) === null && !tireless(p) && !p.monster && p.away === null && !p.downed;

/** How well two would suit: their ease with each other, their natures and their chemistry. */
const suit = (s: GameState, a: Person, b: Person): number => opinion(s, a.id, b.id) / 100 + natureFit(natureOf(a), natureOf(b)) + chemistry(s, a.id, b.id) * 0.5;

/** Who might be put to this person: single grown-ups who aren't kin, the best matches first (at most 3). */
export function candidatesFor(s: GameState, p: Person): Person[] {
  return s.people
    .filter((q) => q.id !== p.id && single(q) && !kin(p, q))
    .sort((a, b) => suit(s, p, b) - suit(s, p, a) || a.id - b.id)
    .slice(0, 3);
}

/** Who the founder may find a match for: themselves when unwed, and their grown children without a partner. */
export function matchable(s: GameState): Person[] {
  const f = founderOf(s);
  if (!f) return [];
  const now = s.tick;
  return s.people.filter((p) => (p.id === f.id || p.parents?.includes(f.id)) && single(p) && (dealings(s).cool?.[p.id] ?? 0) <= now && !s.prompts.some((q) => q.deal?.kind === 'match' && q.deal.person === p.id) && candidatesFor(s, p).length > 0);
}

/** Put a match to the player: the candidates and their natures. It waits as long as it takes. */
export function founderMatch(s: GameState, person: number): void {
  const f = ready(s);
  const p = matchable(s).find((q) => q.id === person);
  if (!f || !p) return;
  const picks = candidatesFor(s, p);
  const self = p.id === f.id;
  const lines = picks.map((q) => `${q.name}, ${natureOf(q).name.toLowerCase()}`);
  s.prompts.push({
    id: s.nextId++,
    kind: 'deal',
    expedition: null,
    title: self ? 'Courting' : `A match for ${p.name}`,
    text: `${self ? 'Whom will you court' : `Whom will ${p.name}, ${natureOf(p).name.toLowerCase()}, be matched with`}? ${lines.join('; ')}. They may refuse.`,
    options: [...picks.map((q) => `${q.name} (${natureOf(q).name.toLowerCase()})`), 'Let it be'],
    defaultOption: picks.length,
    expiresTick: Number.MAX_SAFE_INTEGER,
    waits: true,
    deal: { kind: 'match', person: p.id, picks: picks.map((q) => q.id) },
  });
}

function answerMatch(s: GameState, prompt: Prompt, option: number): void {
  const d = prompt.deal;
  if (d?.kind !== 'match') return;
  const a = s.people.find((p) => p.id === d.person);
  const b = s.people.find((p) => p.id === d.picks[option]);
  if (!a || !b) return;
  if (!single(a) || !single(b)) {
    notify(s, 'The match comes to nothing: one of them is no longer free.');
    return;
  }
  const f = founderOf(s);
  const chance = Math.min(0.9, Math.max(0.1, 0.3 + opinion(s, a.id, b.id) / 150 + natureFit(natureOf(a), natureOf(b)) * 0.4 + chemistry(s, a.id, b.id) * 0.2 + (f ? social(f) * 0.01 : 0)));
  if (side(s, 'match', a.id * 7919 + b.id).chance(chance)) {
    a.partner = b.id;
    b.partner = a.id;
    adjust(s, a.id, b.id, 20);
    notify(s, `${a.name} and ${b.name} agree to the match and are a couple.`, true);
    return;
  }
  adjust(s, a.id, b.id, -8);
  (dealings(s).cool ??= {})[a.id] = s.tick + 72 * TICKS_PER_HOUR;
  notify(s, `${b.name} refuses ${a.id === s.mainId ? 'your courting' : `the match with ${a.name}`}.`, true);
}

/* ------------------------------------------------------------ feasts and festivals */

/** Hours until the founder may host again (0: now). */
export function feastWait(s: GameState, grade: FeastGrade): number {
  const last = dealings(s).feastAt;
  return last == null ? 0 : Math.max(0, Math.ceil((last + FEASTS[grade].wait * TICKS_PER_HOUR - s.tick) / TICKS_PER_HOUR));
}
export const feastCost = (s: GameState, grade: FeastGrade): number => scaled(s, FEASTS[grade].cost);

/** Host a feast or a festival: paid from the purse (then the treasury), food eaten, the town gathers, renown and mood rise,
 *  and now and then there is trouble. */
export function founderFeast(s: GameState, grade: FeastGrade): void {
  const f = ready(s);
  const def = FEASTS[grade];
  if (!f || !def || s.gathering || s.raid) return;
  if (feastWait(s, grade) > 0) return void notify(s, `Too soon for another ${grade}: wait ${feastWait(s, grade)} hours.`);
  const cost = feastCost(s, grade);
  if (!canPay(s, f, cost)) return void notify(s, `Not enough coins for a ${grade} (${cost}).`);
  const guests = here(s).filter((p) => !p.guard);
  const mouths = guests.filter((p) => !tireless(p)).length;
  const heads = grade === 'festival' ? mouths * 2 : mouths;
  if (mouths && foodDays(s) - (0.5 * heads) / Math.max(1, eatersOf(s)) < FEAST_FOOD_DAYS) return void notify(s, `The stores can't spare a ${grade}.`);
  pay(s, f, cost);
  eatFeast(s, heads);
  const tavern = tavernOf(s);
  const door = tavern ? buildingDoor(tavern) : null;
  const at = door ? { x: door.x, y: door.y + Math.min(120, 34 + guests.length * 5) * 0.7 + 24 } : campXY(s);
  dealings(s).feastAt = s.tick;
  s.lastFeast = s.tick;
  gather(s, 'feast', [f.id, ...guests.filter((p) => p.id !== f.id).map((p) => p.id)], def.hours, `At ${f.name}'s ${grade}`, at);
  s.reputation += def.renown;
  if (def.mood[0]) (s.marks ??= []).push({ lever: 'morale', value: def.mood[0], until: s.tick + def.mood[1] * TICKS_PER_HOUR, text: `${f.name}'s ${grade}` });
  notify(s, `${f.name} hosts a ${grade} for the town. It cost ${cost} coins.`, true);
  trouble(s, grade, guests);
}

/** Trouble at a feast: a brawl between the two who like each other least, or a theft from the treasury. */
function trouble(s: GameState, grade: FeastGrade, guests: Person[]): void {
  const rng = side(s, 'trouble', grade);
  if (!rng.chance(FEASTS[grade].trouble)) return;
  const pair = guests
    .flatMap((a, i) => guests.slice(i + 1).map((b) => [a, b] as const))
    .sort((x, y) => opinion(s, x[0].id, x[1].id) - opinion(s, y[0].id, y[1].id) || x[0].id - y[0].id)[0];
  if (pair && rng.chance(0.5)) return brawl(s, pair[0], pair[1]);
  const lost = Math.min(Math.floor(s.coins ?? 0), scaled(s, rng.int(4, 12)));
  if (lost <= 0) return;
  s.coins = (s.coins ?? 0) - lost;
  earn(s, 'events', -lost);
  notify(s, `A thief slips away from the feast with ${lost} coins.`, true);
}

/* ------------------------------------------------------------ haggling with a caravan */

/** The goodwill the town's caravans bear it: it eases every price a little (sim/trade.ts `makeOffers`). */
export const goodwillOf = (s: GameState): number => s.dealings?.goodwill ?? 0;

const wordsOf = (st: Stock): string =>
  (Object.entries(st) as [Material, number][])
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

/** Go to the caravan and haggle over one deal: the question waits for the player. */
export function founderHaggle(s: GameState, offer: number): void {
  const f = ready(s);
  const o = s.caravan?.offers.find((q) => q.id === offer);
  if (!f || !o || s.prompts.some((q) => q.deal?.kind === 'haggle') || !canTrade(s, offer).ok) return;
  const gift = scaled(s, GIFT_COIN);
  const risk = Math.round(Math.max(0.05, INSULT_BASE - social(f) * INSULT_PER_SOCIAL) * 100);
  s.prompts.push({
    id: s.nextId++,
    kind: 'deal',
    expedition: null,
    title: 'Haggling with the caravan',
    text: `They offer ${o.horse ? 'a horse' : wordsOf(o.gives)} for ${wordsOf(o.wants)}. A hard bargain takes a fifth off, but there is a ${risk} in 100 chance they leave insulted. A gift of ${gift} coins wins their goodwill for the caravans to come.`,
    options: ['A fair trade', 'A hard bargain', `A gift for goodwill (${gift} coins)`, 'Walk away'],
    defaultOption: 3,
    expiresTick: Number.MAX_SAFE_INTEGER,
    waits: true,
    deal: { kind: 'haggle', offer },
  });
}

function answerHaggle(s: GameState, prompt: Prompt, option: number): void {
  const d = prompt.deal;
  const f = founderOf(s);
  const c = s.caravan;
  const o = c?.offers.find((q) => d?.kind === 'haggle' && q.id === d.offer);
  if (!c || !o || !f || option === 3) return;
  const rng = side(s, 'haggle', o.id);
  if (option === 1) {
    if (rng.chance(Math.max(0.05, INSULT_BASE - social(f) * INSULT_PER_SOCIAL))) {
      c.leavesTick = s.tick;
      dealings(s).goodwill = Math.max(0, goodwillOf(s) - 1);
      notify(s, 'The merchants take offence at the haggling, pack up and leave.', true);
      return;
    }
    for (const m of Object.keys(o.wants) as Material[]) o.wants[m] = Math.max(1, Math.ceil((o.wants[m] ?? 0) * HARD_CUT));
  } else if (option === 2) {
    const gift = scaled(s, GIFT_COIN);
    if (canPay(s, f, gift)) {
      pay(s, f, gift);
      dealings(s).goodwill = goodwillOf(s) + GIFT_GOODWILL;
      notify(s, `${f.name} gives the merchants a gift of ${gift} coins. They will speak well of the town.`);
    }
  }
  const done = trade(s, o.id, rng);
  if (!done.ok) notify(s, `The deal falls through: ${done.reason ?? 'it cannot be done'}.`);
}

/* ------------------------------------------------------------ the held question */

/** Does the question still stand? A match whose people are gone or paired, or a haggle whose caravan has left, is dropped. */
export function dealStands(s: GameState, p: Prompt): boolean {
  const d = p.deal;
  if (d?.kind === 'match') return d.picks.some((id) => s.people.some((q) => q.id === id && single(q))) && s.people.some((q) => q.id === d.person && single(q));
  if (d?.kind === 'haggle') return !!s.caravan?.offers.some((o) => o.id === d.offer && !o.done);
  return false;
}

/** An answer to a match or a haggle (from roadEvents.ts `answerPrompt`). */
export function answerDeal(s: GameState, prompt: Prompt, option: number): void {
  if (prompt.deal?.kind === 'match') answerMatch(s, prompt, option);
  else answerHaggle(s, prompt, option);
}

/** What the founder's card shows. */
export interface DealingsView {
  visitor: { name: string; fee: number } | null;
  children: { id: number; name: string; master: string | null; trade: string | null }[];
  masters: { id: number; name: string; trade: string; level: number }[];
  matches: { id: number; name: string; self: boolean }[];
  feasts: { grade: FeastGrade; cost: number; wait: number }[];
}
export function dealingsView(s: GameState): DealingsView {
  const v = s.visitor && s.visitor.leavingTo === null ? s.visitor : null;
  return {
    visitor: v ? { name: v.person.name, fee: visitorFee(s) } : null,
    children: s.people.filter((p) => isChild(p)).map((p) => ({ id: p.id, name: p.name, master: s.people.find((q) => q.id === p.master)?.name ?? null, trade: p.trade ?? null })),
    masters: mastersOf(s).slice(0, 4).map((p) => ({ id: p.id, name: p.name, trade: bestSkill(p), level: levelOf(p, bestSkill(p)) })),
    matches: matchable(s).map((p) => ({ id: p.id, name: p.name, self: p.id === s.mainId })),
    feasts: (Object.keys(FEASTS) as FeastGrade[]).map((g) => ({ grade: g, cost: feastCost(s, g), wait: feastWait(s, g) })),
  };
}
