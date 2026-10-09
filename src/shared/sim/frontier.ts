// The settlers' frontier (the origins made deeper, the sixth; numbers in data/frontier.ts). In a settlers' town
// (`s.frontier`), each morning at `FRONTIER_HOUR`: a people met (a stranger of theirs in town, or their caravan at the
// market) teaches the settlers its trick for good (`TRICKS`: a lever `TRICK_MULT` better, renewed each morning as a
// mark); every stranger who has settled among them teaches two others from their best skill (`teach`); and every
// `CLAIM_DAYS` the town stakes a claim at the edge of what it knows (`stakeClaim`: the land opened further, a first haul
// of what the ground holds, spirits lifted), which claim-jumpers may come for (outlaws on the land, `jump`). Only in a
// settlers' town, with the autopilot on.

import { TAMED_TRICKS, CLAIM_DAYS, CLAIM_HAUL, CLAIM_MORALE, CLAIM_NAMES, CLAIM_OPEN, CLAIMS_MOST, FRONTIER_HOUR, JUMP_CHANCE, TEACH_PUPILS, TEACH_XP, TRICK_MULT, TRICKS } from '../data/frontier';
import type { Material } from '../data/materials';
import { ORIGIN_DEFS, type OriginId } from '../data/origins';
import { SKILLS, SKILL_NAMES, type Skill } from '../data/skills';
import { hashSeed, Rng } from '../rng';
import { depositNear } from './buildings';
import { CELL, groundAt, inMap } from './land';
import { spawnRoamerAt } from './roamers';
import { isChild } from './social';
import { campXY, notify, type GameState, type Person } from './state';
import { tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';

export interface Claim {
  name: string;
  x: number;
  y: number;
  day: number;
}

export interface FrontierState {
  tricks: OriginId[];
  claims: Claim[];
  lastClaim: number;
  taught: number;
  jumped: number;
  log: string[];
}

export const frontierTown = (s: GameState) => (s.origin ?? 'settlers') === 'settlers';

export function frontierOf(s: GameState): FrontierState | null {
  if (!frontierTown(s)) return null;
  return (s.frontier ??= { tricks: [], claims: [], lastClaim: s.tick, taught: 0, jumped: 0, log: [] });
}

const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:frontier:${s.tick}:${salt}`));
function log(s: GameState, f: FrontierState, text: string): void {
  f.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (f.log.length > 12) f.log.length = 12;
}

/** Hourly from sim.ts. */
export function frontierHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const f = frontierOf(s);
  if (!f || calendar(s.tick).hour !== FRONTIER_HOUR) return;
  learnTricks(s, f);
  applyTricks(s, f);
  teach(s, f);
  if (s.tick - f.lastClaim >= CLAIM_DAYS * TICKS_PER_DAY && f.claims.length < CLAIMS_MOST) stakeClaim(s, f);
  jump(s, f);
  if (f.claims.length >= CLAIMS_MOST && f.tricks.length >= TAMED_TRICKS && !s.gameOver) {
    tellStory(s, 'The Frontier Tamed', `${CLAIMS_MOST} claims staked and worked, and something learned from every people the town has met. The wild edge of the map is a road now, with farms along it. Plain folk did this, with no magic but stubbornness.`, 'fields farms frontier settlers');
    s.gameOver = { tick: s.tick, won: true, text: 'The frontier is tamed: the land claimed and homesteaded, and the settlers have learned from every people they met. Plain folk have won.' };
  }
}

/** The peoples the town has met: strangers of theirs in town, their caravan at the market. */
export function learnTricks(s: GameState, f: FrontierState): OriginId[] {
  const met = new Set<OriginId>();
  for (const p of s.people) if (p.origin && p.origin !== 'settlers') met.add(p.origin);
  if (s.caravan?.faction) met.add(s.caravan.faction);
  const learned: OriginId[] = [];
  for (const o of met) {
    const t = TRICKS[o];
    if (!t || f.tricks.includes(o)) continue;
    f.tricks.push(o);
    learned.push(o);
    log(s, f, `Learned ${t.what} from ${ORIGIN_DEFS[o].name}.`);
    notify(s, `The settlers have picked up ${t.what} from ${ORIGIN_DEFS[o].name}.`, true);
  }
  return learned;
}

function applyTricks(s: GameState, f: FrontierState): void {
  const until = s.tick + TICKS_PER_DAY + TICKS_PER_HOUR;
  for (const o of f.tricks) {
    const t = TRICKS[o];
    if (t) (s.marks ??= []).push({ lever: t.lever, value: TRICK_MULT, until, text: `Learned from ${ORIGIN_DEFS[o].name}` });
  }
}

const bestSkill = (p: Person): Skill => [...SKILLS].sort((a, b) => p.skills[b].level - p.skills[a].level)[0];

/** Every stranger settled here teaches two others their best skill. */
export function teach(s: GameState, f: FrontierState): number {
  const rng = roll(s, 'teach');
  const home = s.people.filter((p) => p.away === null && !isChild(p));
  let n = 0;
  for (const t of home.filter((p) => p.origin && p.origin !== 'settlers')) {
    const sk = bestSkill(t);
    const pupils = home.filter((p) => p !== t && p.skills[sk].level < t.skills[sk].level);
    for (let i = 0; i < TEACH_PUPILS && pupils.length; i++) {
      const p = pupils.splice(rng.int(0, pupils.length - 1), 1)[0];
      gainSkill(p, sk, TEACH_XP);
      n++;
    }
    if (n && rng.chance(0.2)) log(s, f, `${t.name} has been teaching ${SKILL_NAMES[sk].toLowerCase()} the way it's done where they come from.`);
  }
  f.taught += n;
  return n;
}

/** Stake a claim at the edge of what the town knows, and homestead it. */
export function stakeClaim(s: GameState, f: FrontierState): Claim | null {
  const rng = roll(s, 'claim');
  const c = s.land.camp;
  const r = s.land.open;
  for (let tries = 0; tries < 16; tries++) {
    const a = ((f.claims.length * 3 + tries) / 8) * Math.PI * 2 + rng.next() * 0.4;
    const x = Math.round(c.x + Math.cos(a) * r);
    const y = Math.round(c.y + Math.sin(a) * r);
    if (!inMap(s.land, x, y)) continue;
    const g = groundAt(s.land, x, y);
    if (g === 'water' || g === 'mountain') continue;
    const used = new Set(f.claims.map((q) => q.name));
    const name = rng.pick(CLAIM_NAMES.filter((n) => !used.has(n)).length ? CLAIM_NAMES.filter((n) => !used.has(n)) : CLAIM_NAMES);
    const claim: Claim = { name, x, y, day: calendar(s.tick).day };
    f.claims.push(claim);
    f.lastClaim = s.tick;
    s.land.open = Math.min(86, s.land.open + CLAIM_OPEN);
    s.land.version++;
    const haul = CLAIM_HAUL[g] ?? CLAIM_HAUL.grass;
    depositNear(s, campXY(s), { ...haul });
    (s.marks ??= []).push({ lever: 'morale', value: CLAIM_MORALE, until: s.tick + TICKS_PER_DAY, text: `Staked the ${name} claim` });
    const what = (Object.entries(haul) as [Material, number][]).map(([m, n]) => `${n} ${m.replace('_', ' ')}`).join(' and ');
    log(s, f, `Staked the ${name} claim, and brought home ${what}.`);
    if (f.claims.length === 1 || f.claims.length % 3 === 0)
      tellStory(s, `The ${name} claim`, `Stakes in the ground and a name burned into a plank: the ${name} claim. The town's known land reaches a little further now, and the first haul off it, ${what}, is already in the stores. ${f.claims.length > 1 ? `That makes ${f.claims.length} claims. ` : ''}Out here the land belongs to whoever works it.`, 'frontier fields settlers land', { quiet: true });
    notify(s, `The town has staked the ${name} claim.`);
    return claim;
  }
  return null;
}

/** Claim-jumpers: now and then outlaws come for a claim, and roam the land between it and the town. */
function jump(s: GameState, f: FrontierState): void {
  const rng = roll(s, 'jump');
  for (const cl of f.claims) {
    if (!rng.chance(JUMP_CHANCE)) continue;
    const at = { x: (cl.x + 0.5) * CELL, y: (cl.y + 0.5) * CELL };
    const camp = campXY(s);
    const home = { x: (at.x + camp.x) / 2, y: (at.y + camp.y) / 2 };
    if (spawnRoamerAt(s, { bandit: rng.int(2, 3) }, at, home, { name: 'claim-jumpers' }, 18)) {
      f.jumped++;
      log(s, f, `Claim-jumpers came for the ${cl.name} claim.`);
      notify(s, `Claim-jumpers are out at the ${cl.name} claim!`, true);
    }
    return;
  }
}

export interface FrontierView {
  tricks: { people: string; what: string }[];
  unmet: string[];
  claims: { name: string; day: number }[];
  nextClaimDays: number;
  taught: number;
  jumped: number;
  log: string[];
}

export function frontierView(s: GameState): FrontierView | null {
  const f = s.frontier;
  if (!f || !frontierTown(s)) return null;
  return {
    tricks: f.tricks.map((o) => ({ people: ORIGIN_DEFS[o].name, what: TRICKS[o]?.what ?? '' })),
    unmet: (Object.keys(TRICKS) as OriginId[]).filter((o) => !f.tricks.includes(o)).map((o) => ORIGIN_DEFS[o].name),
    claims: f.claims.map((c) => ({ name: c.name, day: c.day })),
    nextClaimDays: Math.max(0, Math.ceil((f.lastClaim + CLAIM_DAYS * TICKS_PER_DAY - s.tick) / TICKS_PER_DAY)),
    taught: f.taught,
    jumped: f.jumped,
    log: f.log,
  };
}
