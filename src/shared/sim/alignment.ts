// Town alignment (data/alignment.ts): one score from -100 (wicked) to +100 (radiant). It moves with the player's answers
// to the choice events (each answer has a weight: data/eventAlign.ts), with what the town does on its own (sentences,
// laws, prisoners, sacrifices), and with who runs it (the leader's and the townsfolk's natures). It drifts back toward
// the people's home. Past the thresholds each end opens things: pilgrims and a holy order, or a thieves' guild, a dark
// bargain and foes who treat (data/alignEvents.ts), and raids that are smaller for fear or larger for the light's
// sake. Every choice event also gets a recommended answer, what the town itself would pick (`recommend`), which the
// town takes if nobody answers in time. Its own side stream ('align'); the bar only moves with the autopilot on.

import { Rng, hashSeed } from '../rng';
import {
  ALIGN_EVENT_WEIGHTS, ALIGN_MAX, DEED_ALIGN, DEEP_EVIL_AT, DEEP_GOOD_AT, DRIFT_PER_HOUR, EVIL_AT, GOOD_AT, LAW_ALIGN, NATURE_LEAN, PILGRIM_CHANCE_PER_DAY, POINTS_PER_WEIGHT, SENTENCE_ALIGN, THIEVES_TAKE_PER_DAY,
  ALIGN_EVENT_ORDER, ARC_DAYS, ARC_FROM, CHAOS_AT, LAW_ORDER, LIEUTENANT_DAYS, LIEUTENANT_LEVY, LIEUTENANT_RAID_MULT, LIEUTENANT_TAKES_EVERY, ORDER_AT, ORDER_LEAN, PACT_DAYS, PACT_LEVY, SENTENCE_ORDER,
  bandOf, enemyHaste, homeOf, orderBandName, orderHomeOf, raidAlignMult, titleOf,
} from '../data/alignment';
import { EVENT_ALIGN } from '../data/eventAlign';
import { EVENT_ORDER } from '../data/eventOrder';
import type { EventDef, EventEffect } from '../data/eventKit';
import { FOOD_VALUE } from '../data/people';
import { natureOf } from '../data/natures';
import { apply, startEvent } from './events';
import { foodPerHead } from './townsfolk';
import { notify, townFull, type GameState, type Prompt } from './state';
import { EVENT_BY_ID } from '../data/events';
import type { NatureId } from '../data/natures';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendar } from './time';

export interface AlignState {
  score: number;
  /** The swings the Chronicle tells: when, how far, and what caused it. */
  log: { day: number; delta: number; why: string; axis?: 'order' }[];
  /** What the watchers last saw (laws in force, the last sentence told, the fallen counted, prisoners held). */
  laws?: string[];
  sentence?: string;
  fallen?: number;
  prisoners?: number;
  band?: string;
  /** Pushes since the last hourly check, summed by cause, so many small ones are told as one. */
  pending?: Record<string, number>;
  /** The second axis, order (+) to chaos (-), and its own pushes. */
  order?: number;
  opending?: Record<string, number>;
  /** The score every ten days, for the falls and redemptions (`arcs`), and which have come. */
  samples?: { tick: number; score: number }[];
  arcs?: string[];
  /** Intrigue crimes counted so far (sim/intrigue.ts). */
  crimes?: number;
  oband?: string;
  /** The Enemy's terms were refused: the siege goes ahead. */
  pactRefused?: boolean;
  /** Tributes to the Great Enemy paid and refused, so far. */
  paid?: number;
  refused?: number;
  /** The Great Enemy's pact, while it stands (`offerPact`). */
  pact?: { kind: 'pact' | 'lieutenant'; until: number; taken?: number };
}

const LOG_KEPT = 60;
const clamp = (n: number) => Math.max(-ALIGN_MAX, Math.min(ALIGN_MAX, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

export const alignState = (s: GameState): AlignState => (s.align ??= { score: homeOf(s.origin), log: [] });
export const alignScore = (s: Pick<GameState, 'align'>): number => s.align?.score ?? 0;
export const orderScore = (s: Pick<GameState, 'align'>): number => s.align?.order ?? 0;

/** Push the second axis, order (+) to chaos (-). */
export function orderPush(s: GameState, delta: number, why: string): void {
  if (!delta) return;
  const a = alignState(s);
  a.order = r2(clamp((a.order ?? orderHomeOf(s.origin)) + delta));
  const p = (a.opending ??= {});
  p[why] = r2((p[why] ?? 0) + delta);
}

/** Push the bar by so many points for a cause. Told in the Chronicle once it adds up to a swing. */
export function alignPush(s: GameState, delta: number, why: string): void {
  if (!delta) return;
  const a = alignState(s);
  a.score = r2(clamp(a.score + delta));
  const p = (a.pending ??= {});
  p[why] = r2((p[why] ?? 0) + delta);
}

/** An answer's weight (-4..+4), 0 for one not yet weighed. */
export const weightOf = (eventId: string, option: number): number => (ALIGN_EVENT_WEIGHTS[eventId] ?? EVENT_ALIGN[eventId])?.[option] ?? 0;
/** The same for the second axis. */
export const orderWeightOf = (eventId: string, option: number): number => (ALIGN_EVENT_ORDER[eventId] ?? EVENT_ORDER[eventId])?.[option] ?? 0;

/** The player's (or the clock's) answer to a choice event moves the bar. */
export function alignAnswered(s: GameState, def: EventDef, option: number): void {
  if (s.autopilot === false) return;
  alignPush(s, weightOf(def.id, option) * POINTS_PER_WEIGHT, def.title);
  orderPush(s, orderWeightOf(def.id, option) * POINTS_PER_WEIGHT, def.title);
}

/* ------------------------------------------------------------ the recommendation */

/** What an answer's effects are worth to the town on the whole, roughly: coins in, lives and stores out. */
export function worth(s: GameState, effects: readonly EventEffect[], hungry: boolean): number {
  let v = 0;
  for (const e of effects) {
    if ('gain' in e) {
      for (const [m, n] of Object.entries(e.gain)) v += (n ?? 0) * (m in FOOD_VALUE && hungry ? 0.4 : 0.1);
    } else if ('coins' in e) v += e.coins * 0.05;
    else if ('take' in e) v -= e.share * (e.take === 'food' && hungry ? 30 : 15);
    else if ('mood' in e) v += (e.mood * Math.min(e.hours, 96)) / 48;
    else if ('mod' in e) v += ((e.mult - 1) * Math.min(e.hours, 120)) / 12;
    else if ('reputation' in e) v += e.reputation * 1.5;
    else if ('renown' in e) v += e.renown;
    else if ('join' in e) v += e.join * 3;
    else if ('leave' in e) v -= 4;
    else if ('kill' in e) v -= 12 * (e.chance ?? 1);
    else if ('wound' in e) v -= e.wound === 'all' ? 6 : 2;
    else if ('sick' in e) v -= e.sick * 0.5;
    else if ('sickShare' in e) v -= e.sickShare * 20;
    else if ('raid' in e) v -= e.raid <= 24 ? 6 : 3;
    else if ('calm' in e) v += Math.min(e.calm, 96) / 24;
    else if ('research' in e) v += e.research / 120;
    else if ('burn' in e) v -= 3 * e.burn;
    else if ('ruin' in e) v -= 3 * e.ruin;
    else if ('exodus' in e) v -= e.exodus * 25;
    else if ('learn' in e) v += 4 * e.learn;
    else if ('heal' in e) v += 5;
    else if ('herdLoss' in e) v -= 8;
    else if ('busy' in e) v -= 2;
    else if ('follow' in e) v -= 2;
    else if ('skill' in e) v += e.levels * 1.5;
    else if ('bond' in e) v += e.bond * 0.5;
    else if ('item' in e) v += 2 * e.count;
    else if ('horse' in e) v += 2 * e.horse;
    else if ('build' in e) v += 5;
    else if ('dread' in e) v -= 2 * e.dread;
    else if ('chance' in e) v += e.chance * worth(s, e.then, hungry) + (1 - e.chance) * worth(s, e.else ?? [], hungry);
    else if ('later' in e) v += 0.6 * worth(s, e.effects, hungry);
  }
  return v;
}

/** How kind the leader and the council lean, -0.6..0.6: the leader's nature counts most. */
export function leaderLean(s: GameState): number {
  const lead = s.people.find((p) => p.id === s.mainId);
  const grown = s.people.filter((p) => p.bornTick == null && p.id !== s.mainId);
  const folk = grown.length ? grown.reduce((n, p) => n + (NATURE_LEAN[natureOf(p).id] ?? 0), 0) / grown.length : 0;
  return (lead ? NATURE_LEAN[natureOf(lead).id] ?? 0 : 0) * 0.6 + folk * 0.4;
}

/** How much the leader and the folk lean to order, -0.6..0.6. */
export function leaderOrder(s: GameState): number {
  const lead = s.people.find((p) => p.id === s.mainId);
  const grown = s.people.filter((p) => p.bornTick == null && p.id !== s.mainId);
  const folk = grown.length ? grown.reduce((n, p) => n + (ORDER_LEAN[natureOf(p).id] ?? 0), 0) / grown.length : 0;
  return (lead ? ORDER_LEAN[natureOf(lead).id] ?? 0 : 0) * 0.6 + folk * 0.4;
}

export interface Recommendation {
  option: number;
  /** A short reason, said under the card: "the elders urge mercy". */
  why: string;
}

/** What the town itself would pick, given its alignment, its needs and its leader's nature, and why. Pure. */
export function recommend(s: GameState, def: EventDef): Recommendation {
  const lean = Math.max(-1, Math.min(1, alignScore(s) / 70 + leaderLean(s)));
  const orderLean = Math.max(-1, Math.min(1, orderScore(s) / 70 + leaderOrder(s)));
  const hungry = foodPerHead(s) < 2;
  let best = 0;
  let bestScore = -Infinity;
  let moral = 0;
  let material = 0;
  def.options.forEach((o, i) => {
    const m = weightOf(def.id, i) * lean * 6 + orderWeightOf(def.id, i) * orderLean * 2;
    const w = worth(s, o.effects, hungry);
    const total = m + w + (o.default ? 1.5 : 0);
    if (total > bestScore) {
      bestScore = total;
      best = i;
      moral = m;
      material = w;
    }
  });
  const w = weightOf(def.id, best);
  const dark = lean < -0.25;
  const light = lean > 0.25;
  let why: string;
  if (Math.abs(moral) > Math.abs(material) + 1 && w !== 0) {
    const lead = s.people.find((p) => p.id === s.mainId);
    const kindLeader = leaderLean(s) > 0.2;
    why = w > 0 ? (light ? (kindLeader && lead ? `${lead.name}'s kindness, and the elders, urge mercy` : 'the elders urge mercy') : 'it is the decent thing') : dark ? 'the town has grown hard, and would not flinch' : 'the town\'s stern ways';
  } else if (hungry && worth(s, def.options[best].effects, true) > worth(s, def.options[best].effects, false) + 0.5) {
    why = 'the stores are thin, and this feeds the town';
  } else if (def.options[best].effects.some((e) => 'kill' in e || 'sickShare' in e) === false && def.options.some((o, i) => i !== best && o.effects.some((e) => 'kill' in e))) {
    why = 'it costs the fewest lives';
  } else if (material > 1) why = 'it serves the town best';
  else why = def.options[best].default ? 'the town\'s usual way' : 'it risks least';
  return { option: best, why };
}

/* ------------------------------------------------------------ the hourly watch */

const home = (s: GameState) => homeOf(s.origin);

/** Chronicle lines for the year: the swings and what caused them. */
export function alignmentYearLines(s: GameState, sinceTick: number): string[] {
  const a = s.align;
  if (!a) return [];
  const since = calendar(sinceTick).day;
  const swings = a.log.filter((l) => l.day >= since);
  const lines: string[] = [];
  if (swings.length) {
    const big = [...swings].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 2);
    const g = swings.filter((l) => l.axis !== 'order');
    const o = swings.filter((l) => l.axis === 'order');
    if (g.length) lines.push(`The town grew ${g.reduce((n, l) => n + l.delta, 0) >= 0 ? 'kinder' : 'harder'} this year (now ${bandOf(a.score).name.toLowerCase()}), most of all for ${[...g].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 2).map((l) => `${l.why.toLowerCase()} (${l.delta > 0 ? '+' : ''}${Math.round(l.delta)})`).join(' and ')}.`);
    if (o.length) lines.push(`It grew ${o.reduce((n, l) => n + l.delta, 0) >= 0 ? 'more orderly' : 'more unruly'}, ${orderBandName(a.order ?? 0).toLowerCase()} now, chiefly for ${[...o].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0].why.toLowerCase()}.`);
    void big;
  }
  const title = townTitle(s);
  if (title) lines.push(`The town is called ${titledName(s)} now.`);
  if (a.pact) lines.push(a.pact.kind === 'lieutenant' ? 'The town serves the Enemy as its lieutenant.' : 'The town keeps its pact with the Enemy.');
  return lines;
}

/** Once an hour (autopilot only: not when it is false): drift, the watchers, the unlocks. */
export function alignmentHourly(s: GameState): void {
  if (s.autopilot === false || s.gameOver || s.tick % TICKS_PER_HOUR !== 0) return;
  const a = alignState(s);
  // (the slow drift pulls toward neutral, not toward the people's home, so choices and deeds decide the bar)
  a.score = r2(clamp(a.score + (0 - a.score) * DRIFT_PER_HOUR));
  a.order = r2(clamp((a.order ?? orderHomeOf(s.origin)) + (orderHomeOf(s.origin) - (a.order ?? orderHomeOf(s.origin))) * DRIFT_PER_HOUR));
  watch(s, a);
  // (who runs it: once a day the leader's and the folk's natures pull the bar)
  if (s.tick % TICKS_PER_DAY === 0) {
    const pull = leaderLean(s);
    if (Math.abs(pull) > 0.05) alignPush(s, pull * 1.2, pull > 0 ? 'A kindly hand at the head of the town' : 'A hard hand at the head of the town');
    const op = leaderOrder(s);
    if (Math.abs(op) > 0.05) orderPush(s, op * 1.2, op > 0 ? 'A firm hand at the head of the town' : 'A loose hand at the head of the town');
    const hungry = s.prisoners.filter((p) => p.hungry).length;
    if (hungry) alignPush(s, -0.4 * hungry, 'Prisoners left hungry');
    // charity in famine: a town that relieves the poor while the stores run low, and one that lets them starve
    if (foodPerHead(s) < 1) alignPush(s, s.politics?.laws.includes('poor_relief') ? 1 : -0.3, s.politics?.laws.includes('poor_relief') ? 'Charity in the hungry days' : 'The hungry left to themselves');
    // the ruling house's conduct (sim/dynasty.ts): a scandal in the ruling house stains the town; feuds make it lawless
    const rule = s.dynasty?.ruling;
    if (rule?.scandalUntil && rule.scandalUntil > s.tick) { alignPush(s, -0.5, 'Scandal in the ruling house'); orderPush(s, -0.3, 'Scandal in the ruling house'); }
    const feuds = (s.dynasty?.feuds ?? []).filter((f) => !f.ended).length;
    if (feuds) orderPush(s, -0.1 * Math.min(feuds, 4), 'Houses at feud');
    const rng = new Rng(hashSeed(`${s.seed}:align:${s.tick}`));
    pactUpkeep(s, a);
    marks(s);
    arcs(s, a, rng);
    unlocks(s, rng);
  }
  report(s, a);
}

/** Watch for what the town has done by itself since the last look. */
function watch(s: GameState, a: AlignState): void {
  // laws passed or repealed
  const laws: string[] = s.politics?.laws ?? [];
  if (a.laws) {
    for (const id of laws) if (!a.laws.includes(id)) { alignPush(s, LAW_ALIGN[id] ?? 0, `The law of ${id.replace('_', ' ')} passed`); orderPush(s, LAW_ORDER[id] ?? 0, `The law of ${id.replace('_', ' ')} passed`); }
    for (const id of a.laws) if (!laws.includes(id)) { alignPush(s, -(LAW_ALIGN[id] ?? 0), `The law of ${id.replace('_', ' ')} repealed`); orderPush(s, -(LAW_ORDER[id] ?? 0), `The law of ${id.replace('_', ' ')} repealed`); }
  }
  a.laws = [...laws];
  // sentences
  const last = s.politics?.log.find((l) => l.kind === 'trial');
  if (last && last.text !== a.sentence) {
    for (const [re, n] of SENTENCE_ALIGN) if (re.test(last.text)) { alignPush(s, n, n < 0 ? 'A harsh sentence' : 'Mercy at a trial'); break; }
    for (const [re, n] of SENTENCE_ORDER) if (re.test(last.text)) { orderPush(s, n, n > 0 ? 'The law was kept' : 'The law was bent'); break; }
    a.sentence = last.text;
  }
  // deaths by the town's own hand
  const fallen = s.fallen ?? [];
  if (a.fallen !== undefined && fallen.length > a.fallen) {
    for (const f of fallen.slice(a.fallen)) for (const [re, n] of DEED_ALIGN) if (re.test(f.cause)) alignPush(s, n, 'A sacrifice');
  }
  a.fallen = fallen.length;
  // raiders taken alive and held: mercy; let go: more (the release counts through the prisoner count falling with no escape,
  // which is told too softly to read, so it's the hunger above that bites)
  if (a.prisoners !== undefined && s.prisoners.length > a.prisoners) alignPush(s, 0.8 * (s.prisoners.length - a.prisoners), 'Mercy to captured raiders');
  a.prisoners = s.prisoners.length;
  // house intrigue (sim/intrigue.ts): every crime a house commits is a stain, and a lawless one
  const books = Object.values(s.intrigue?.books ?? {});
  const crimes = books.reduce((n, b) => n + b.crimes.length, 0);
  if (a.crimes !== undefined && crimes > a.crimes) {
    for (const c of books.flatMap((b) => b.crimes).slice(-(crimes - a.crimes))) {
      alignPush(s, CRIME_ALIGN[c.kind] ?? -2, 'A house\'s crimes');
      orderPush(s, -2, 'A house\'s crimes');
    }
  }
  a.crimes = crimes;
  // the Great Enemy's tribute (sim/greatEnemy.ts): paying is a coward's mercy to the town; refusing is defiance
  const ge = s.greatEnemy;
  if (ge) {
    const paid = ge.tributes ?? 0;
    const refused = ge.refused ?? 0;
    if (a.paid !== undefined && paid > a.paid) { alignPush(s, -2, 'Tribute paid to the Enemy'); orderPush(s, 1, 'Tribute paid to the Enemy'); }
    if (a.refused !== undefined && refused > a.refused) { alignPush(s, 2, 'The Enemy defied'); orderPush(s, -1, 'The Enemy defied'); }
    a.paid = paid;
    a.refused = refused;
  }
}

/** What a house's crime says about the town. */
const CRIME_ALIGN: Record<string, number> = { mafia: -3, murder: -6, bribery: -3, blackmail: -4, fear: -3, revenge: -4 };

/** Tell a swing once it's big enough, and a change of band. */
function report(s: GameState, a: AlignState): void {
  const pend = a.pending;
  if (pend) {
    const total = Object.values(pend).reduce((n, v) => n + v, 0);
    if (Math.abs(total) >= 2) {
      const top = Object.entries(pend).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
      a.log.push({ day: calendar(s.tick).day, delta: r2(total), why: top[0] });
      if (a.log.length > LOG_KEPT) a.log.splice(0, a.log.length - LOG_KEPT);
    }
    a.pending = undefined;
  }
  const op = a.opending;
  if (op) {
    const total = Object.values(op).reduce((n, v) => n + v, 0);
    if (Math.abs(total) >= 2) {
      const top = Object.entries(op).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
      a.log.push({ day: calendar(s.tick).day, delta: r2(total), why: top[0], axis: 'order' });
      if (a.log.length > LOG_KEPT) a.log.splice(0, a.log.length - LOG_KEPT);
    }
    a.opending = undefined;
  }
  const band = bandOf(a.score).name;
  if (a.band && a.band !== band) notify(s, `The town is now ${band.toLowerCase()}: ${bandOf(a.score).line}`, true);
  a.band = band;
  const ob = orderBandName(a.order ?? 0);
  if (a.oband && a.oband !== ob) notify(s, `The town has become ${ob.toLowerCase()}.`, true);
  a.oband = ob;
}

/** What each end opens, once a day. */
function unlocks(s: GameState, rng: Rng): void {
  const score = alignScore(s);
  const grown = s.people.filter((p) => p.bornTick == null && p.away === null);
  if (score >= GOOD_AT) {
    // the faithful come on pilgrimage, and the powers speak well of the town
    if (!townFull(s) && s.people.length < 80 && rng.chance(PILGRIM_CHANCE_PER_DAY)) {
      const out: string[] = [];
      apply(s, [{ join: 1, type: 'wanderer' }], rng, undefined, out);
      notify(s, 'A pilgrim, drawn by the town\'s name, asks to stay.', true);
    }
    if (rng.chance(0.2)) s.reputation += 1;
  } else if (score <= EVIL_AT) {
    // the Hand takes its cut for the treasury; the powers think less of the town
    s.coins = (s.coins ?? 0) + Math.max(1, Math.floor(grown.length * THIEVES_TAKE_PER_DAY * (score <= DEEP_EVIL_AT ? 1.5 : 1) * 0.5));
    if (rng.chance(0.2)) s.reputation -= 1;
  }
}

/* ------------------------------------------------------------ the town's name */

/** "the Merciful", "the Cruel": the title the town carries, or null near the middle. */
export const townTitle = (s: GameState): string | null => (s.align ? titleOf(s.align.score, s.align.order ?? orderHomeOf(s.origin)) : null);
/** The town's name with its title ("Ashford the Merciful"), as the Chronicle and the legends carry it. */
export function titledName(s: GameState, name: string | undefined = s.townName): string {
  const title = townTitle(s);
  return name ? (title ? `${name} ${title}` : name) : title ? `The town ${title}` : 'The town';
}

/* ------------------------------------------------------------ the Great Enemy (small hooks in greatEnemy.ts) */

/** greatEnemy.ts `paceToday`: a good town draws the Enemy's hate first, and its plan runs faster. */
export const alignEnemyPace = (s: GameState): number => (s.autopilot === false ? 0 : enemyHaste(alignScore(s)));
/** Whether a pact (or service as its lieutenant) stands: no siege, no tribute, no hosts. */
export const alignPacted = (s: GameState): boolean => !!s.align?.pact && s.align.pact.until > s.tick;

/** greatEnemy.ts `warnSiege`: a dark town may be offered a pact instead of a siege. True if the siege is held off (a pact
 *  stands, or the offer is put to the player and the siege waits on the answer). */
export function alignPact(s: GameState): boolean {
  if (s.autopilot === false) return false;
  if (alignPacted(s)) return true;
  if (alignScore(s) > EVIL_AT || s.align?.pactRefused) return false;
  if (s.prompts.some((q) => q.ways?.system === 'align' && q.ways.about === 'pact')) return true;
  const e = s.greatEnemy;
  if (!e) return false;
  const short = e.kind;
  const have = s.coins ?? 0;
  const score = alignScore(s);
  const options = [`Swear a pact (${Math.round(PACT_LEVY * 100)}% of the treasury a day, ${PACT_DAYS} days)`, `Serve as its lieutenant (${LIEUTENANT_DAYS} days, a heavier levy and hands taken for its host)`, 'Refuse, and face the siege'];
  // (what the town would do: the deepest dark serves; the merely hard swears; the poor and the proud refuse)
  const recommended = score <= DEEP_EVIL_AT ? 1 : have < 40 || leaderLean(s) > 0.15 ? 2 : 0;
  const why = recommended === 1 ? 'the town has long since chosen its side' : recommended === 0 ? 'a pact is cheaper than a siege' : have < 40 ? 'there is nothing to pay a pact with' : 'the leader will not kneel';
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'ways',
    expedition: null,
    ways: { system: 'align', about: 'pact' },
    title: 'The Enemy offers terms',
    text: `The Enemy's herald comes to the gate with a different offer: your name has reached it, and it would rather have servants than ruins. (${short})`,
    story: `The Enemy's herald comes to the gate with a different offer. The town's name has reached it, and it has the measure of a place that does what it must. It would rather have a pact than a siege: a levy, and the town left standing. Or it would make the town its lieutenant, with a heavier levy and hands taken for its host, and no raider of its own would dare approach.`,
    who: s.mainId,
    options,
    defaultOption: recommended,
    recommended,
    why,
    expiresTick: s.tick + 6 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, 'The Enemy offers terms instead of a siege.', true);
  return true;
}

/** roadEvents.ts `answerPrompt`: the answer to one of the alignment's own questions. Returns true if it was one. */
export function answerAlignPrompt(s: GameState, prompt: Prompt, option: number): boolean {
  if (prompt.ways?.system !== 'align') return false;
  const a = alignState(s);
  const e = s.greatEnemy;
  if (option === 0 || option === 1) {
    const lieutenant = option === 1;
    a.pact = { kind: lieutenant ? 'lieutenant' : 'pact', until: s.tick + (lieutenant ? LIEUTENANT_DAYS : PACT_DAYS) * TICKS_PER_DAY };
    alignPush(s, lieutenant ? -15 : -8, lieutenant ? 'Sworn as the Enemy\'s lieutenant' : 'A pact with the Enemy');
    orderPush(s, 4, 'A bargain kept');
    s.reputation -= lieutenant ? 3 : 1;
    notify(s, lieutenant ? 'The town kneels, and is made the Enemy\'s lieutenant. No siege will come while it serves.' : 'The pact is sworn. No siege will come while it is kept.', true);
    if (e) e.plan = Math.max(0, e.plan - 6);
  } else {
    alignPush(s, 3, 'The Enemy\'s terms refused');
    notify(s, 'The town refuses the Enemy\'s terms. The siege will come.', true);
    a.pactRefused = true; // (so the next warning of the siege goes ahead: `alignPact`)
  }
  return true;
}

/** Daily: the Enemy's levy, the hands taken for its host, and the pact's end. */
function pactUpkeep(s: GameState, a: AlignState): void {
  const pact = a.pact;
  if (!pact) return;
  if (s.tick >= pact.until) {
    a.pact = undefined;
    a.pactRefused = undefined;
    notify(s, 'The Enemy\'s hold on the town lapses. It will want terms again, or a siege.', true);
    return;
  }
  const lieutenant = pact.kind === 'lieutenant';
  const levy = Math.floor((s.coins ?? 0) * (lieutenant ? LIEUTENANT_LEVY : PACT_LEVY));
  s.coins = (s.coins ?? 0) - levy;
  alignPush(s, lieutenant ? -0.5 : -0.2, 'Serving the Enemy');
  if (lieutenant && s.tick - (pact.taken ?? pact.until - LIEUTENANT_DAYS * TICKS_PER_DAY) >= LIEUTENANT_TAKES_EVERY * TICKS_PER_DAY) {
    pact.taken = s.tick;
    // (never the founder: the leader stays the leader)
    const pool = s.people.filter((p) => p.bornTick == null && p.id !== s.mainId && p.away === null);
    const gone = pool.length > 3 ? pool[Math.floor(new Rng(hashSeed(`${s.seed}:align-take:${s.tick}`)).next() * pool.length)] : undefined;
    if (gone) {
      s.people = s.people.filter((p) => p !== gone);
      notify(s, `${gone.name} is taken into the Enemy's host, as the terms say.`, true);
    }
  }
}

/** The raid budget's alignment factor: fear deters raiders, the light draws the dark, and a town in the Enemy's service is left alone. */
export function alignRaidMult(s: GameState): number {
  if (s.autopilot === false) return 1;
  return raidAlignMult(alignScore(s)) * (s.align?.pact?.kind === 'lieutenant' && alignPacted(s) ? LIEUTENANT_RAID_MULT : 1);
}

/* ------------------------------------------------------------ visitors, powers and traders */

/** townsfolk.ts `maybeArrive`: good towns draw more wanderers, dark ones fewer. */
export function alignArrivalMult(s: GameState): number {
  if (s.autopilot === false) return 1;
  const g = alignScore(s);
  return g >= DEEP_GOOD_AT ? 1.4 : g >= GOOD_AT ? 1.2 : g <= DEEP_EVIL_AT ? 0.7 : g <= EVIL_AT ? 0.85 : 1;
}
/** The nature a wanderer carries to a town: paladins and healers are drawn to a good one (kind, pious), cutthroats and exiles to
 *  a dark one (greedy, stern, proud); a side stream, so the town's own isn't touched. */
export function alignArrival(s: GameState, person: { id: number; nature?: NatureId | null }): void {
  if (s.autopilot === false) return;
  const g = alignScore(s);
  if (Math.abs(g) < GOOD_AT) return;
  const r = new Rng(hashSeed(`${s.seed}:align-arrival:${person.id}`));
  if (!r.chance(0.6)) return;
  person.nature = r.pick<NatureId>(g > 0 ? ['kind', 'pious', 'kind', 'cheerful'] : ['greedy', 'stern', 'proud', 'grumpy']);
}

/** Daily: what the powers and traders make of the town, and what its order or chaos does. A day-long mark each, renewed. */
function marks(s: GameState): void {
  const g = alignScore(s);
  const o = orderScore(s);
  const until = s.tick + TICKS_PER_DAY + TICKS_PER_HOUR;
  const mark = (lever: string, value: number, text: string) => (s.marks ??= []).push({ lever, value, until, text });
  if (g >= GOOD_AT) { mark('prices', 1.05, 'Traders deal fairly with a good town'); mark('travellers', 1.15, 'A good name draws travellers'); }
  else if (g <= EVIL_AT) { mark('prices', 0.95, 'Traders are wary of a dark town'); mark('travellers', 0.85, 'A dark name keeps travellers away'); }
  if (o >= ORDER_AT) { mark('work', 1.03, 'An orderly town'); mark('guard', 1.05, 'An orderly watch'); }
  else if (o <= CHAOS_AT) { mark('work', 0.97, 'An unruly town'); mark('fight', 1.05, 'Brawlers in the ranks'); mark('travellers', 1.1, 'Anything goes here'); }
}

/* ------------------------------------------------------------ falls and redemptions */

/** Every ten days the score is sampled; a swing from one end to the other inside ARC_DAYS is a fall or a redemption, once each. */
function arcs(s: GameState, a: AlignState, rng: Rng): void {
  const samples = (a.samples ??= []);
  if (s.tick % (10 * TICKS_PER_DAY) === 0) {
    samples.push({ tick: s.tick, score: a.score });
    if (samples.length > 8) samples.shift();
  }
  if (s.event || s.prompts.some((q) => q.kind === 'event')) return;
  const recent = samples.filter((x) => s.tick - x.tick <= ARC_DAYS * TICKS_PER_DAY);
  const done = (a.arcs ??= []);
  const fire = (id: string) => {
    done.push(id);
    notify(s, id === 'fall_reckoning' ? 'The town has fallen far from what it was.' : 'The town has come a long way back.', true);
    startEventFor(s, id, rng);
  };
  if (!done.includes('fall_reckoning') && a.score <= EVIL_AT && recent.some((x) => x.score >= ARC_FROM)) fire('fall_reckoning');
  else if (!done.includes('redemption_penance') && a.score >= GOOD_AT && recent.some((x) => x.score <= -ARC_FROM)) fire('redemption_penance');
}

function startEventFor(s: GameState, id: string, rng: Rng): void {
  const def = EVENT_BY_ID[id];
  if (def) startEvent(s, def, rng);
}

/** The bars for the menus and the look of the town: both scores, their labels, and the cast (-1..1) the renderer tints by. */
export function alignView(s: GameState): {
  score: number; label: string; line: string; cast: number; home: number; order: number; orderLabel: string; orderHome: number; title: string | null; pact: string | null; swings: { day: number; delta: number; why: string; axis?: 'order' }[];
} {
  const score = alignScore(s);
  const b = bandOf(score);
  const order = s.align?.order ?? orderHomeOf(s.origin);
  return {
    score: Math.round(score), label: b.name, line: b.line, cast: Math.max(-1, Math.min(1, score / 80)), home: home(s),
    order: Math.round(order), orderLabel: orderBandName(order), orderHome: orderHomeOf(s.origin), title: townTitle(s),
    pact: s.align?.pact && s.align.pact.until > s.tick ? (s.align.pact.kind === 'lieutenant' ? 'In the Enemy\'s service' : 'Bound by a pact') : null,
    swings: (s.align?.log ?? []).slice(-4).reverse(),
  };
}
