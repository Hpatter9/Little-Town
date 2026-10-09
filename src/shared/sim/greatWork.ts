// The alchemists' Great Work (the origins made deeper, the third; numbers in data/greatWork.ts). In an alchemists'
// town, at `WORK_HOUR` each morning, the best at Research (`alchemist`) runs an experiment: a transmutation of base
// matter in store (`TRANSMUTATIONS`), else a potion for the town (`POTIONS`, a lever's mark). It works on odds by their
// Research (better after Nigredo); a failure may explode (the alchemist hurt, the workshop sometimes alight), a potion
// may misfire (a sickness, a sour mood). Each success brings the Great Work on (`s.work.progress`); at each stage's mark,
// with its age reached and its offering in store, the stage is reached and told (`STAGES`): Albedo grows homunculi (the
// town works faster for each; now and then one runs off), Citrinitas mends every wound each week, Rubedo makes gold
// each week, and the Philosopher's Stone wins the game. Only in an alchemists' town, with the autopilot on.

import { ERAS } from '../data/eras';
import {
  BLAST_CHANCE,
  BLAST_HURT,
  FIRE_CHANCE,
  HOMUNCULI_MOST,
  HOMUNCULUS_DAYS,
  HOMUNCULUS_ESCAPE,
  HOMUNCULUS_NAMES,
  HOMUNCULUS_WORK,
  ODDS_BASE,
  ODDS_MOST,
  ODDS_PER_LEVEL,
  POTIONS,
  RUBEDO_COINS,
  STAGES,
  TRANSMUTATIONS,
  WEEKLY_DAY,
  WORK_HOUR,
} from '../data/greatWork';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, storages, totalStock } from './buildings';
import { apply } from './events';
import { takeFromStorage } from './expeditions';
import { setFire } from './fire';
import { minorWound } from './injuries';
import { isChild } from './social';
import { addStock, earn, maxHp, notify, type GameState, type Person } from './state';
import { tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface WorkState {
  progress: number;
  /** Stages reached (0 to 5). */
  stage: number;
  homunculi: string[];
  lastHomunculus: number;
  tried: number;
  worked: number;
  blasts: number;
  log: string[];
}

export const crucibleTown = (s: GameState) => s.origin === 'alchemists';

export function workOf(s: GameState): WorkState | null {
  if (!crucibleTown(s)) return null;
  return (s.work ??= { progress: 0, stage: 0, homunculi: [], lastHomunculus: 0, tried: 0, worked: 0, blasts: 0, log: [] });
}

const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:work:${s.tick}:${salt}`));
const name = (m: Material) => MATERIAL_NAMES[m].toLowerCase();
const eraAtLeast = (s: GameState, e: string) => ERAS.indexOf(s.era) >= ERAS.indexOf(e as never);

function log(s: GameState, w: WorkState, text: string): void {
  w.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (w.log.length > 10) w.log.length = 10;
}

/** The Crucible's best mind (the best at Research, grown and at home). */
export function alchemist(s: GameState): Person | null {
  return [...s.people].filter((p) => p.away === null && !p.downed && !isChild(p)).sort((a, b) => b.skills.research.level - a.skills.research.level || a.id - b.id)[0] ?? null;
}

export const oddsOf = (s: GameState, p: Person) => Math.min(ODDS_MOST, ODDS_BASE + p.skills.research.level * ODDS_PER_LEVEL + ((s.work?.stage ?? 0) >= 1 ? 0.1 : 0));

/** Hourly from sim.ts. */
export function workHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const w = workOf(s);
  if (!w) return;
  const cal = calendar(s.tick);
  if (cal.hour !== WORK_HOUR) return;
  homunculi(s, w);
  if (cal.day % WEEKLY_DAY === 0) weekly(s, w);
  experiment(s, w);
  advance(s, w);
}

/** The day's experiment: a transmutation of what's in store, else a potion. */
export function experiment(s: GameState, w: WorkState): { kind: 'transmute' | 'potion'; ok: boolean } | null {
  const p = alchemist(s);
  if (!p) return null;
  const rng = roll(s, 'experiment');
  const stock = totalStock(s);
  const tr = [...TRANSMUTATIONS].reverse().find((t) => eraAtLeast(s, t.era) && (stock[t.from] ?? 0) >= t.fromN * 2);
  const potion = POTIONS.filter((q) => (Object.entries(q.needs) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n));
  if (!tr && !potion.length) return null;
  w.tried++;
  const ok = rng.chance(oddsOf(s, p));
  if (tr && (!potion.length || rng.chance(0.6))) {
    takeFromStorage(s, tr.from, tr.fromN);
    if (ok) {
      const st = storages(s)[0];
      if (st) addStock(st.store, tr.to, tr.toN);
      w.worked++;
      w.progress += tr.progress;
      log(s, w, `${p.name} turned ${tr.fromN} ${name(tr.from)} into ${tr.toN} ${name(tr.to)}.`);
    } else failed(s, w, p, rng, `${p.name}'s transmutation of ${name(tr.from)} went wrong`);
    return { kind: 'transmute', ok };
  }
  const q = rng.pick(potion);
  for (const [m, n] of Object.entries(q.needs) as [Material, number][]) takeFromStorage(s, m, n);
  if (ok) {
    (s.marks ??= []).push({ lever: q.lever, value: q.mult, until: s.tick + q.hours * TICKS_PER_HOUR, text: q.name });
    w.worked++;
    w.progress += q.progress;
    log(s, w, `${p.name} brewed the ${q.name}, and the town drank it.`);
  } else {
    apply(s, q.misfire === 'sick' ? [{ sick: 1 }] : [{ mood: -4, hours: 24, text: `The ${q.name} went sour` }], rng, p.id);
    failed(s, w, p, rng, `The ${q.name} misfired`);
  }
  return { kind: 'potion', ok };
}

function failed(s: GameState, w: WorkState, p: Person, rng: Rng, what: string): void {
  if (!rng.chance(BLAST_CHANCE)) {
    log(s, w, `${what}.`);
    return;
  }
  w.blasts++;
  minorWound(s, p, Math.round(maxHp(p) * BLAST_HURT), rng);
  let fire = '';
  if (rng.chance(FIRE_CHANCE)) {
    const near = s.buildings.filter((b) => b.status === 'done').sort((a, b) => {
      const ca = buildingCentre(a);
      const cb = buildingCentre(b);
      return Math.hypot(ca.x - p.x, ca.y - p.y) - Math.hypot(cb.x - p.x, cb.y - p.y);
    });
    if (near[0] && setFire(s, near[0])) fire = ' and set the workshop alight';
  }
  log(s, w, `${what}: it exploded in ${p.name}'s face${fire}.`);
  notify(s, `BOOM. ${what}: it exploded in ${p.name}'s face${fire}.`, true);
}

/** The Great Work moves to its next stage when its mark is reached, its age come, and its offering in store. */
export function advance(s: GameState, w: WorkState): boolean {
  const next = STAGES[w.stage];
  if (!next || w.progress < next.at || !eraAtLeast(s, next.era)) return false;
  const stock = totalStock(s);
  if (!(Object.entries(next.offering) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n)) return false;
  for (const [m, n] of Object.entries(next.offering) as [Material, number][]) takeFromStorage(s, m, n);
  w.stage++;
  log(s, w, `The Great Work reached ${next.name}.`);
  (s.marks ??= []).push({ lever: 'morale', value: 6, until: s.tick + 2 * TICKS_PER_DAY, text: next.name });
  tellStory(s, next.name, `${next.story}\n\n${next.gift}`, 'alchemist laboratory potion flask');
  if (w.stage === STAGES.length && !s.gameOver) s.gameOver = { tick: s.tick, won: true, text: 'The Great Work is complete. The Crucible holds the Philosopher\'s Stone, and from it the Elixir of Life: the alchemists have done what every alchemist dreamed of, and their names will never die.' };
  return true;
}

/** Albedo and on: homunculi grown, and now and then one runs off. */
function homunculi(s: GameState, w: WorkState): void {
  if (w.stage < 2) return;
  const rng = roll(s, 'homunculus');
  if (w.homunculi.length < HOMUNCULI_MOST && s.tick - w.lastHomunculus >= HOMUNCULUS_DAYS * TICKS_PER_DAY) {
    const free = HOMUNCULUS_NAMES.filter((n) => !w.homunculi.includes(n));
    const n = rng.pick(free.length ? free : HOMUNCULUS_NAMES);
    w.homunculi.push(n);
    w.lastHomunculus = s.tick;
    log(s, w, `A homunculus was born in the flask: ${n}. It wants work.`);
    notify(s, `A new homunculus, ${n}, climbs out of its flask and asks for work.`);
  } else if (w.homunculi.length && rng.chance(HOMUNCULUS_ESCAPE / 7)) {
    const n = w.homunculi.splice(rng.int(0, w.homunculi.length - 1), 1)[0];
    log(s, w, `${n} the homunculus ran off into the night with a bag of the town's sulphur.`);
    notify(s, `${n} the homunculus has run away!`, true);
  }
  if (w.homunculi.length) (s.marks ??= []).push({ lever: 'work', value: 1 + HOMUNCULUS_WORK * w.homunculi.length, until: s.tick + TICKS_PER_DAY, text: 'The homunculi\'s help' });
}

/** The week's gifts of the later stages. */
function weekly(s: GameState, w: WorkState): void {
  if (w.stage >= 3) {
    for (const p of s.people) {
      p.hp = maxHp(p);
      if (p.wounds) p.wounds = [];
    }
    log(s, w, 'The week\'s elixir: every wound in town closed.');
  }
  if (w.stage >= 4) {
    s.coins = (s.coins ?? 0) + RUBEDO_COINS;
    earn(s, 'events', RUBEDO_COINS);
    log(s, w, `The athanor made gold of base matter: ${RUBEDO_COINS} coins to the treasury.`);
  }
}

export interface WorkView {
  stage: number;
  stageName: string;
  next: { name: string; at: number; offering: string; era: string; gift: string } | null;
  progress: number;
  alchemist: string | null;
  odds: number;
  homunculi: string[];
  tried: number;
  worked: number;
  blasts: number;
  log: string[];
}

export function workView(s: GameState): WorkView | null {
  const w = s.work;
  if (!w || !crucibleTown(s)) return null;
  const p = alchemist(s);
  const next = STAGES[w.stage];
  return {
    stage: w.stage,
    stageName: w.stage ? STAGES[w.stage - 1].name : 'The prima materia',
    next: next ? { name: next.name, at: next.at, offering: (Object.entries(next.offering) as [Material, number][]).map(([m, n]) => `${n} ${name(m)}`).join(', '), era: next.era, gift: next.gift } : null,
    progress: w.progress,
    alchemist: p?.name ?? null,
    odds: p ? Math.round(oddsOf(s, p) * 100) : 0,
    homunculi: w.homunculi,
    tried: w.tried,
    worked: w.worked,
    blasts: w.blasts,
    log: w.log,
  };
}
