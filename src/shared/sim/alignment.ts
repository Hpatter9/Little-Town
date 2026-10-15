// Town alignment (data/alignment.ts): one score from -100 (wicked) to +100 (radiant). It moves with the player's answers
// to the choice events (each answer has a weight: data/eventAlign.ts), with what the town does on its own (sentences,
// laws, prisoners, sacrifices), and with who runs it (the leader's and the townsfolk's natures). It drifts back toward
// the people's home. Past the thresholds each end opens things: pilgrims and a holy order, or a thieves' guild, a dark
// bargain and foes who treat (data/alignEvents.ts), and raids that are smaller for fear or larger for the light's
// sake. Every choice event also gets a recommended answer, what the town itself would pick (`recommend`), which the
// town takes if nobody answers in time. Its own side stream ('align'); the bar only moves with the autopilot on.

import { Rng, hashSeed } from '../rng';
import {
  ALIGN_EVENT_WEIGHTS, ALIGN_MAX, DEED_ALIGN, DEEP_EVIL_AT, DRIFT_PER_HOUR, EVIL_AT, GOOD_AT, LAW_ALIGN, NATURE_LEAN, PILGRIM_CHANCE_PER_DAY, POINTS_PER_WEIGHT, SENTENCE_ALIGN, THIEVES_TAKE_PER_DAY,
  bandOf, homeOf,
} from '../data/alignment';
import { EVENT_ALIGN } from '../data/eventAlign';
import type { EventDef, EventEffect } from '../data/eventKit';
import { FOOD_VALUE } from '../data/people';
import { natureOf } from '../data/natures';
import { apply } from './events';
import { foodPerHead } from './townsfolk';
import { notify, townFull, type GameState } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendar } from './time';

export interface AlignState {
  score: number;
  /** The swings the Chronicle tells: when, how far, and what caused it. */
  log: { day: number; delta: number; why: string }[];
  /** What the watchers last saw (laws in force, the last sentence told, the fallen counted, prisoners held). */
  laws?: string[];
  sentence?: string;
  fallen?: number;
  prisoners?: number;
  band?: string;
  /** Pushes since the last hourly check, summed by cause, so many small ones are told as one. */
  pending?: Record<string, number>;
}

const LOG_KEPT = 60;
const clamp = (n: number) => Math.max(-ALIGN_MAX, Math.min(ALIGN_MAX, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

export const alignState = (s: GameState): AlignState => (s.align ??= { score: homeOf(s.origin), log: [] });
export const alignScore = (s: Pick<GameState, 'align'>): number => s.align?.score ?? 0;

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

/** The player's (or the clock's) answer to a choice event moves the bar. */
export function alignAnswered(s: GameState, def: EventDef, option: number): void {
  if (s.autopilot === false) return;
  alignPush(s, weightOf(def.id, option) * POINTS_PER_WEIGHT, def.title);
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

export interface Recommendation {
  option: number;
  /** A short reason, said under the card: "the elders urge mercy". */
  why: string;
}

/** What the town itself would pick, given its alignment, its needs and its leader's nature, and why. Pure. */
export function recommend(s: GameState, def: EventDef): Recommendation {
  const lean = Math.max(-1, Math.min(1, alignScore(s) / 70 + leaderLean(s)));
  const hungry = foodPerHead(s) < 2;
  let best = 0;
  let bestScore = -Infinity;
  let moral = 0;
  let material = 0;
  def.options.forEach((o, i) => {
    const m = weightOf(def.id, i) * lean * 6;
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
    lines.push(`The town grew ${swings.reduce((n, l) => n + l.delta, 0) >= 0 ? 'kinder' : 'harder'} this year (now ${bandOf(a.score).name.toLowerCase()}), most of all for ${big.map((l) => `${l.why.toLowerCase()} (${l.delta > 0 ? '+' : ''}${Math.round(l.delta)})`).join(' and ')}.`);
  }
  return lines;
}

/** Once an hour (autopilot only: not when it is false): drift, the watchers, the unlocks. */
export function alignmentHourly(s: GameState): void {
  if (s.autopilot === false || s.gameOver || s.tick % TICKS_PER_HOUR !== 0) return;
  const a = alignState(s);
  a.score = r2(clamp(a.score + (home(s) - a.score) * DRIFT_PER_HOUR));
  watch(s, a);
  // (who runs it: once a day the leader's and the folk's natures pull the bar)
  if (s.tick % TICKS_PER_DAY === 0) {
    const pull = leaderLean(s);
    if (Math.abs(pull) > 0.05) alignPush(s, pull * 1.2, pull > 0 ? 'A kindly hand at the head of the town' : 'A hard hand at the head of the town');
    const hungry = s.prisoners.filter((p) => p.hungry).length;
    if (hungry) alignPush(s, -0.4 * hungry, 'Prisoners left hungry');
    unlocks(s, new Rng(hashSeed(`${s.seed}:align:${s.tick}`)));
  }
  report(s, a);
}

/** Watch for what the town has done by itself since the last look. */
function watch(s: GameState, a: AlignState): void {
  // laws passed or repealed
  const laws: string[] = s.politics?.laws ?? [];
  if (a.laws) {
    for (const id of laws) if (!a.laws.includes(id)) alignPush(s, LAW_ALIGN[id] ?? 0, `The law of ${id.replace('_', ' ')} passed`);
    for (const id of a.laws) if (!laws.includes(id)) alignPush(s, -(LAW_ALIGN[id] ?? 0), `The law of ${id.replace('_', ' ')} repealed`);
  }
  a.laws = [...laws];
  // sentences
  const last = s.politics?.log.find((l) => l.kind === 'trial');
  if (last && last.text !== a.sentence) {
    for (const [re, n] of SENTENCE_ALIGN) if (re.test(last.text)) { alignPush(s, n, n < 0 ? 'A harsh sentence' : 'Mercy at a trial'); break; }
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
}

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
  const band = bandOf(a.score).name;
  if (a.band && a.band !== band) notify(s, `The town is now ${band.toLowerCase()}: ${bandOf(a.score).line}`, true);
  a.band = band;
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

/** The bar for the menus and the look of the town: score, band and the cast (-1..1) the renderer tints by. */
export function alignView(s: GameState): { score: number; label: string; line: string; cast: number; home: number; swings: { day: number; delta: number; why: string }[] } {
  const score = alignScore(s);
  const b = bandOf(score);
  return { score: Math.round(score), label: b.name, line: b.line, cast: Math.max(-1, Math.min(1, score / 80)), home: home(s), swings: (s.align?.log ?? []).slice(-4).reverse() };
}
