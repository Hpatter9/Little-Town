// The town's rank and its generations (the owner's ask: progress you can see at every timescale). A named rung the town
// holds, worked out each hour from what stands and who lives there (`tierOf`: people, buildings, a market, the wall
// closed, the seat's age, the day), called by the people's own names (data/tiers.ts TIER_NAMES): "Willowmere, a Market
// Town". It rises as the town grows and can fall after a disaster (`TIER_SLACK` keeps it from flickering at the edge).
// A change is told: a journal line (the news, the Chronicle) and a card (the renderer reads `rank.last` from the
// snapshot). The founder's remembered word comes from their nature (data/natures.ts), no draw. The generations are
// counted from the family record (sim/lineage.ts `lineGroups`): "The third generation now works the fields", "None who
// founded the town still live". Everything is off with the autopilot, and an older save starts it from where it stands,
// with no celebration for the rank it already holds. `s.rank` holds it.

import { article, NO_RING_EXTRA, generationWord, TIER_FALL_LINE, TIER_RISE_LINES, TIER_RULES, TIER_SLACK, tierNames } from '../data/tiers';
import { lineFor, NATURE_BY_ID, natureOf, type NatureId } from '../data/natures';
import { SEAT_STAGE } from '../data/seats';
import { isRingPiece, ringTown } from './ringWall';
import { lineGroups } from './lineage';
import { milestonesHourly, tell } from './milestones';
import { calendar, TICKS_PER_HOUR } from './time';
import type { GameState } from './state';

export interface RankChange {
  /** A key that is new with each change, for the card to be told once. */
  key: string;
  kind: 'rise' | 'fall';
  day: number;
  from: string;
  to: string;
  line: string;
  /** What the founder would say. */
  memory?: string;
}

export interface Rank {
  tier: number;
  /** The highest rung held so far (a rise past it is celebrated; a regained rung is only noted). */
  best: number;
  /** The day the town came to its rung. */
  since: number;
  /** The people who founded the town (those living in it when this was first looked at). */
  founders: number[];
  founder?: { name: string; nature: NatureId };
  /** The highest generation of grown folk counted so far (1 = the founders). */
  gen: number;
  last?: RankChange;
}

/** The rung's name for this town. */
export const tierName = (s: GameState, tier: number): string => tierNames(s.origin)[Math.max(0, Math.min(tier, TIER_RULES.length - 1))];
/** "a Market Town". */
export const tierPhrase = (s: GameState, tier: number): string => `${article(tierName(s, tier))} ${tierName(s, tier)}`;

const standing = (s: GameState): number => s.buildings.filter((b) => b.status === 'done' && !isRingPiece(b.def)).length;
const seatStage = (s: GameState): number => {
  let best = 0;
  for (const b of s.buildings) if (b.status === 'done') best = Math.max(best, SEAT_STAGE[b.def]?.stage ?? 0);
  return best;
};

/** Whether the town meets what a rung asks, in full (`share` 1) or with the slack it keeps a rung by. */
export function meetsTier(s: GameState, tier: number, share = 1): boolean {
  const r = TIER_RULES[tier];
  if (!r) return false;
  const day = calendar(s.tick).day;
  const walled = ringTown(s) ? !!s.ring?.done : false;
  const extra = r.wall && !ringTown(s) ? NO_RING_EXTRA : 0;
  if (s.people.length < Math.ceil(r.pop * share)) return false;
  if (standing(s) < Math.ceil((r.buildings + extra) * share)) return false;
  if (day < r.day) return false;
  if (r.market && !s.buildings.some((b) => b.def === 'market' && b.status === 'done')) return false;
  if (r.wall && ringTown(s) && !walled) return false;
  if (r.seat && seatStage(s) < r.seat) return false;
  return true;
}

/** The rung the town holds now, given the one it held: it rises to the highest it meets in full, and falls only when it
 *  no longer meets its own with the slack. */
export function tierOf(s: GameState, held: number): number {
  let top = 0;
  for (let k = 1; k < TIER_RULES.length; k++) {
    if (!meetsTier(s, k)) break;
    top = k;
  }
  if (top >= held) return top;
  for (let k = held; k >= 1; k--) if (meetsTier(s, k, TIER_SLACK)) return Math.max(k, top);
  return top;
}

/** The highest generation among the grown folk alive (1: those who came, or founded). */
export function generationNow(s: GameState): number {
  if (!Object.values(s.kin ?? {}).some((r) => r.parents.length > 0)) return 1;
  let top = 1;
  for (const g of lineGroups(s)) for (const p of s.people) if (p.type !== 'child' && g.gen.has(p.id)) top = Math.max(top, g.gen.get(p.id)! + 1);
  return top;
}

const founderAlive = (s: GameState, r: Rank): boolean => r.founders.some((id) => s.people.some((p) => p.id === id));

/** What the first founder would say, from their nature: a living one says it, the dead one is remembered saying it. */
function founderMemory(s: GameState, r: Rank, kind: 'rise' | 'fall', tier: number): string | undefined {
  const f = r.founder;
  if (!f) return undefined;
  const live = s.people.some((p) => p.id === s.mainId);
  const say = lineFor(NATURE_BY_ID[f.nature] ?? natureOf({ id: s.mainId }), kind === 'rise' ? 'work' : 'mourn', tier);
  return live ? `${f.name} says: “${say}”` : `${f.name}, who founded us, would have said: “${say}”`;
}

/** Hourly (from sim.ts): look for the firsts, the rung and the generation. */
export function tiersHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  const day = calendar(s.tick).day;
  let r = s.rank;
  if (!r) {
    const main = s.people.find((p) => p.id === s.mainId);
    r = s.rank = {
      tier: 0, best: 0, since: day, gen: 1,
      founders: s.people.filter((p) => !(p.parents?.length)).map((p) => p.id),
      founder: main ? { name: main.name, nature: natureOf(main).id } : undefined,
    };
    r.tier = r.best = tierOf(s, 0); // (an older save starts where it stands, uncelebrated)
  }
  milestonesHourly(s, r.founders);
  const was = r.tier;
  const now = tierOf(s, was);
  if (now !== was) {
    r.tier = now;
    r.since = day;
    const rise = now > was;
    const fresh = rise && now > r.best;
    r.best = Math.max(r.best, now);
    const line = rise ? TIER_RISE_LINES[now] : TIER_FALL_LINE;
    const memory = founderMemory(s, r, rise ? 'rise' : 'fall', now);
    tell(s, rise ? `The town is ${tierPhrase(s, now)} now. ${line}` : `The town has fallen to ${tierPhrase(s, now)}. ${line}`, true);
    if (memory && (fresh || !rise)) tell(s, memory);
    if (fresh || !rise) r.last = { key: `t:${r.since}:${now}`, kind: rise ? 'rise' : 'fall', day, from: tierName(s, was), to: tierName(s, now), line, memory };
  }
  const gen = generationNow(s);
  if (gen > r.gen) {
    r.gen = gen;
    if (gen >= 2) tell(s, `The ${generationWord(gen)} generation now works the fields.`, true);
  }
}

/** The Chronicle's generation lines, from the state. */
export function generationLines(s: GameState): string[] {
  const r = s.rank;
  if (!r) return [];
  const word = generationWord(r.gen);
  const out = [`The ${word} generation lives in the town.`];
  if (r.founders.length && !founderAlive(s, r)) out.push('None who founded the town still live.');
  else if (r.founders.length) {
    const live = r.founders.filter((id) => s.people.some((p) => p.id === id)).length;
    out.push(live === r.founders.length ? (live === 1 ? 'The one who founded the town still lives.' : `All ${live} who founded the town still live.`) : `${live} of the ${r.founders.length} who founded the town still live.`);
  }
  return out;
}
