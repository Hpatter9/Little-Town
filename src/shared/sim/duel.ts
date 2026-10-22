// Duels (the founder as the player's character; data/duels.ts has the numbers). From a person's card the founder may
// challenge a rival (someone who hates them), a troublemaker (someone caught in a crime, or on strike) or, at the arena,
// the visiting champion who is posted to fight (`challenge`, command `duel`). The card shows the power levels first (sim/
// power.ts: Even, Risky, Deadly). The fight is the real one-on-one (`startBattle`/`stepBattle`, the arena's way), to
// yield (each side gives in under `DUEL_YIELD` of its health) or to the death (the one struck down dies). `s.duel`
// (`DuelState`) holds it; the fight screen can watch it (`duelTrip`). A win brings renown (`reputation`), the town's morale
// and a bloc's regard; a loss brings wounds, or death. Now and then a rival challenges the founder (`duelHourly`, autopilot
// only, its own side stream): a question that holds the game (`Prompt.waits`) until it is answered.

import { CHALLENGE_DEATH_SHARE, CHALLENGE_GAP_DAYS, CHALLENGE_HOUR, CHALLENGE_PER_DAY, DUEL_AWAY, DUEL_BLOC_WIN, DUEL_CHAMPION_PURSE, DUEL_DEATH, DUEL_FIT, DUEL_IDS, DUEL_LINGER, DUEL_MORALE_WIN, DUEL_RENOWN_LOSS, DUEL_RENOWN_WIN, DUEL_STAND_IN, DUEL_YIELD } from '../data/duels';
import { ENEMY } from '../data/social';
import { hashSeed, Rng } from '../rng';
import { arenaOf, refund, visitorFighter } from './arena';
import { personFighter, startBattle, stepBattle, unitFighter, type Fighter } from './combat';
import { addDeed, tally } from './deeds';
import { founderOf } from './founder';
import { killPerson, knockDown } from './health';
import { woundFor, woundPerson } from './injuries';
import { matchupOf, powerLine, powerOfFighter, powerOfPerson, type Matchup } from './power';
import { politicsOf, striking } from './politics';
import { isChild, opinion } from './social';
import { maxHp, notify, type Expedition, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendar } from './time';
import { gainSkill } from './townsfolk';

export type DuelTerms = 'yield' | 'death';
export type DuelWhy = 'rival' | 'trouble' | 'champion';

export interface DuelFoe {
  /** A townsperson's id; -1 the arena's visiting champion. */
  id: number;
  name: string;
  why: DuelWhy;
  /** The champion's make (the arena card's visitor), for a champion. */
  champion?: { kind: string; scale: number; from: string };
}

export interface DuelState {
  id: number;
  foe: DuelFoe;
  to: DuelTerms;
  /** The fight, shaped as a trip for the watched fight screen (snapshot.ts). */
  e: Expedition;
  started: number;
  ended?: number;
  outcome?: 'won' | 'lost';
  /** How it ended, in a line. */
  text?: string;
}

const roll = (s: GameState, what: string) => new Rng(hashSeed(`${s.seed}:duel:${what}:${s.tick}`));

/** A duel as a trip, for the watched fight (snapshot.ts); undefined when there's none by that id. */
export const duelTrip = (s: GameState, id: number | undefined): Expedition | undefined => (id !== undefined && s.duel?.id === id ? s.duel.e : undefined);

/** Why the founder may challenge this person: someone who hates them, or who has been caught in a crime or is on strike. */
export function whyChallenge(s: GameState, f: Person, p: Person): DuelWhy | null {
  if (p.id === f.id || isChild(p) || p.monster || p.hp <= 0) return null;
  if (opinion(s, f.id, p.id) <= ENEMY) return 'rival';
  const crimes = Object.entries(p.tally ?? {}).some(([k, n]) => k.startsWith('crime:') && n > 0);
  return crimes || striking(s, p) ? 'trouble' : null;
}

/** Can this person be fought just now? */
const ready = (p: Person) => p.away === null && !p.downed && p.hp > 0 && p.skirmish === undefined;

/** The founder's fighter, and the foe's (a person's own figures laid over a stand-in; the champion as the arena has them). */
function fightersOf(s: GameState, f: Person, foe: DuelFoe): { mine: Fighter; theirs: Fighter } | null {
  const mine = personFighter(f, 'fighter', 'front');
  if (foe.champion) return { mine, theirs: visitorFighter(foe.champion.kind, foe.champion.scale, foe.name) };
  const p = s.people.find((q) => q.id === foe.id);
  if (!p) return null;
  const pf = personFighter(p, 'fighter', 'front');
  const theirs: Fighter = { ...unitFighter(DUEL_STAND_IN, 'enemy', 0), name: p.name };
  for (const k of ['hp', 'maxHp', 'damage', 'accuracy', 'dodge', 'interval', 'armor', 'block', 'beastDamage', 'quirks', 'tough'] as const) (theirs as unknown as Record<string, unknown>)[k] = pf[k];
  theirs.ranged = false;
  return { mine, theirs };
}

export interface DuelChoice {
  id: number;
  name: string;
  why: DuelWhy;
  line: string;
  matchup: Matchup;
}

/** Who the founder may challenge, with the power levels first: "You 24 vs about 30: Risky". */
export function duelChoices(s: GameState): DuelChoice[] {
  const f = founderOf(s);
  if (!f) return [];
  const out: DuelChoice[] = [];
  const mine = powerOfPerson(f);
  for (const p of s.people) {
    const why = whyChallenge(s, f, p);
    if (!why || !ready(p)) continue;
    const theirs = powerOfPerson(p);
    out.push({ id: p.id, name: p.name, why, line: powerLine(mine, theirs, 'You'), matchup: matchupOf(mine, theirs) });
  }
  const c = arenaOf(s).card;
  if (c && s.arena) {
    const theirs = powerOfFighter(visitorFighter(c.visitor.kind, c.visitor.scale, c.visitor.name));
    out.push({ id: -1, name: c.visitor.name, why: 'champion', line: powerLine(mine, theirs, 'You'), matchup: matchupOf(mine, theirs) });
  }
  return out;
}

/** May the founder step out to fight just now? A word if not. */
export function duelBlock(s: GameState): string | null {
  const f = founderOf(s);
  if (!f) return 'There is no founder';
  if (s.duel && s.duel.ended === undefined) return 'A duel is already under way';
  if (s.raid) return 'The town is under attack';
  if (!ready(f) || s.muster) return `${f.name} can't fight just now`;
  if (f.hp < maxHp(f) * DUEL_FIT) return `${f.name} is too hurt to fight`;
  return null;
}

function begin(s: GameState, f: Person, foe: DuelFoe, to: DuelTerms): boolean {
  const pair = fightersOf(s, f, foe);
  if (!pair) return false;
  const rng = roll(s, `start:${foe.id}`);
  const id = DUEL_IDS + (s.duel ? (s.duel.id - DUEL_IDS + 1) % 1_000_000 : 1);
  const e: Expedition = {
    id, dest: `duel:${id}`, members: [f.id], phase: 'work', elapsed: 0, outTicks: 1, workTicks: 1, backTicks: 1, work: 0, loot: {}, supplies: {},
    recalled: false, roles: { [f.id]: 'fighter' as const }, stance: 'balanced', battle: null, prompt: null, rolled: { outEvent: true, backEvent: true, ambush: true }, waterskins: 0,
  };
  e.battle = startBattle([f], e.roles, {}, rng);
  pair.theirs.cooldown = rng.int(1, pair.theirs.interval);
  e.battle.fighters.push(pair.theirs);
  f.away = DUEL_AWAY;
  f.task = null;
  s.founderOrder = undefined;
  const p = s.people.find((q) => q.id === foe.id);
  if (p) {
    p.away = DUEL_AWAY;
    p.task = null;
  }
  s.duel = { id, foe, to, e, started: s.tick };
  s.watching = id;
  notify(s, `${f.name} faces ${foe.name} in a duel ${to === 'death' ? 'to the death' : 'to yield'}!`, true);
  return true;
}

/** The founder challenges someone (a person's id, or -1: the arena's champion). A word if it cannot be done. */
export function challenge(s: GameState, foeId: number, to: DuelTerms): { ok: true } | { ok: false; reason: string } {
  const block = duelBlock(s);
  if (block) return { ok: false, reason: block };
  const f = founderOf(s)!;
  let foe: DuelFoe;
  if (foeId === -1) {
    const a = s.arena;
    const c = a?.card;
    if (!a || !c) return { ok: false, reason: 'No champion is waiting' };
    foe = { id: -1, name: c.visitor.name, why: 'champion', champion: { kind: c.visitor.kind, scale: c.visitor.scale, from: c.visitor.from } };
    if (!begin(s, f, foe, to)) return { ok: false, reason: 'No champion is waiting' };
    // (the champion fights the founder in place of the town's fighter: the book is shut and the bets go back)
    for (const b of c.bets) refund(s, b);
    a.card = null;
    return { ok: true };
  }
  const p = s.people.find((q) => q.id === foeId);
  const why = p ? whyChallenge(s, f, p) : null;
  if (!p || !why) return { ok: false, reason: 'That is not someone you can challenge' };
  if (!ready(p)) return { ok: false, reason: `${p.name} is not free to fight just now` };
  return begin(s, f, { id: p.id, name: p.name, why }, to) ? { ok: true } : { ok: false, reason: 'That is not someone you can challenge' };
}

/** Every tick: the duel under way fights a beat; over, it's settled; its result lingers a moment for the screen. */
export function duelTick(s: GameState): void {
  const d = s.duel;
  if (!d) return;
  if (d.ended !== undefined) {
    if (s.tick - d.ended >= DUEL_LINGER) {
      if (s.watching === d.id) s.watching = undefined;
      s.duel = undefined;
    }
    return;
  }
  const b = d.e.battle;
  if (!b) return endDuel(s, d, 'lost');
  const yieldAt = d.to === 'yield' ? DUEL_YIELD : 0;
  stepBattle(b, roll(s, `fight:${d.id}`), { retreatAt: yieldAt, mainId: null });
  const foe = b.fighters.find((f) => f.side === 'enemy')!;
  const me = b.fighters.find((f) => f.side === 'party');
  if (!b.outcome && yieldAt > 0 && foe.hp < foe.maxHp * yieldAt) b.outcome = 'won';
  // (the founder gives in under the same mark, once the fight has begun)
  if (!b.outcome && yieldAt > 0 && me && me.hp < me.maxHp * yieldAt) b.outcome = 'lost';
  if (b.outcome) endDuel(s, d, b.outcome === 'won' ? 'won' : 'lost');
}

/** Write a fighter's end back to the person: health, wounds, a fall, a death. Returns whether they died. */
function settle(s: GameState, p: Person, f: Fighter | undefined, to: DuelTerms, won: boolean, by: string, rng: Rng): boolean {
  if (p.away === DUEL_AWAY) p.away = null;
  if (!f) return false;
  const was = p.hp;
  if (f.down) knockDown(s, p);
  else p.hp = Math.max(1, Math.min(maxHp(p), Math.round((f.hp * maxHp(p)) / Math.max(1, f.maxHp))));
  const harm = f.down ? Math.max(was, maxHp(p) * 0.5) : was - p.hp;
  if (harm > 0) woundPerson(s, p, harm, (sev) => woundFor(DUEL_STAND_IN, sev, rng), rng);
  if (f.attacks) gainSkill(p, f.ranged ? 'ranged' : 'melee', f.attacks * (won ? 10 : 6));
  if (f.down && (to === 'death' || rng.chance(DUEL_DEATH))) {
    killPerson(s, p, `fell in a duel with ${by}`);
    return true;
  }
  return false;
}

/** The duel is over: wounds, a death perhaps, and what the town makes of it. */
export function endDuel(s: GameState, d: DuelState, outcome: 'won' | 'lost'): void {
  const rng = roll(s, `end:${d.id}`);
  const b = d.e.battle;
  const f = founderOf(s);
  const won = outcome === 'won';
  const foeP = s.people.find((q) => q.id === d.foe.id);
  const mine = b?.fighters.find((x) => x.side === 'party');
  const theirs = b?.fighters.find((x) => x.side === 'enemy');
  d.outcome = outcome;
  d.ended = s.tick;
  const wording = d.to === 'death' ? 'to the death' : 'to yield';
  let text = '';
  if (f) {
    const fDied = settle(s, f, mine, d.to, won, d.foe.name, rng);
    const foeDied = foeP ? settle(s, foeP, theirs, d.to, !won, f.name, rng) : !!theirs?.down && d.to === 'death';
    if (won) {
      s.reputation += DUEL_RENOWN_WIN;
      tally(f, 'duels');
      addDeed(f, 'bouts');
      for (const p of s.people) if (p.away === null && !isChild(p)) p.morale = Math.min(100, p.morale + DUEL_MORALE_WIN);
      if (s.politics) {
        const pol = politicsOf(s);
        const bloc = d.foe.why === 'trouble' ? 'commons' : 'soldiers';
        pol.sat[bloc] = Math.min(100, pol.sat[bloc] + DUEL_BLOC_WIN);
      }
      if (d.foe.champion) {
        f.coins = (f.coins ?? 0) + DUEL_CHAMPION_PURSE;
      }
      text = foeDied ? `${f.name} killed ${d.foe.name} in a duel. The town talks of little else.` : `${d.foe.name} yields. ${f.name} wins the duel and the town's respect.`;
    } else {
      s.reputation = Math.max(0, s.reputation - DUEL_RENOWN_LOSS);
      text = fDied ? `${f.name} fell to ${d.foe.name} in a duel ${wording}.` : `${f.name} yields to ${d.foe.name}, hurt and shamed.`;
    }
  }
  d.text = text;
  notify(s, text || 'The duel is over.', true);
}

/* ------------------------------------------------------------ a rival's challenge */

/** A rival challenges the founder, now and then: a question that holds the game until it is answered. */
export function duelHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  if (calendar(s.tick).hour !== CHALLENGE_HOUR) return;
  const f = founderOf(s);
  if (!f || duelBlock(s) || s.prompts.some((q) => q.kind === 'duel')) return;
  const last = s.duelChallenged;
  if (last !== undefined && s.tick - last < CHALLENGE_GAP_DAYS * TICKS_PER_DAY) return;
  const rng = new Rng(hashSeed(`${s.seed}:duelChallenge:${s.tick}`));
  const rivals = s.people.filter((p) => ready(p) && whyChallenge(s, f, p) === 'rival' && opinion(s, p.id, f.id) <= ENEMY);
  if (!rivals.length || !rng.chance(CHALLENGE_PER_DAY)) return;
  const rival = rivals[rng.int(0, rivals.length - 1)];
  const to: DuelTerms = rng.chance(CHALLENGE_DEATH_SHARE) ? 'death' : 'yield';
  s.duelChallenged = s.tick;
  const line = powerLine(powerOfPerson(f), powerOfPerson(rival), 'You');
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'duel',
    expedition: null,
    title: `${rival.name} challenges you`,
    text: `${rival.name} stands in the square and calls you out, for a duel ${to === 'death' ? 'to the death' : 'to yield'}. ${line}.`,
    options: [`Accept: fight ${to === 'death' ? 'to the death' : 'to yield'}`, 'Refuse, and be talked about'],
    defaultOption: 1,
    expiresTick: Number.MAX_SAFE_INTEGER,
    waits: true,
    who: rival.id,
    duel: { foe: rival.id, to },
  };
  s.prompts.push(prompt);
  notify(s, `${rival.name} challenges ${f.name} to a duel.`, true);
}

/** The challenge answered: accepted, the duel is fought; refused, the founder loses face. */
export function answerDuel(s: GameState, prompt: Prompt, option: number): void {
  const d = prompt.duel;
  if (!d) return;
  if (option === 0) {
    const r = challenge(s, d.foe, d.to);
    if (!r.ok) notify(s, `${r.reason}.`);
    return;
  }
  s.reputation = Math.max(0, s.reputation - DUEL_RENOWN_LOSS);
  const f = founderOf(s);
  const rival = s.people.find((p) => p.id === d.foe);
  if (f) f.morale = Math.max(0, f.morale - 4);
  notify(s, `${f?.name ?? 'The founder'} turns ${rival?.name ?? 'the challenger'} down, and the town murmurs.`);
}
