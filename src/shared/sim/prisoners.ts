// Prisoners (DESIGN §7, §10): raiders struck down in a raid of people (not beasts) may be taken alive.
// They eat, might slip away, and can be won over in time (faster with a sociable warden: the town's best
// Social skill), when they join the town. Or they can simply be let go.

import { ENEMIES } from '../data/enemies';
import { FOOD_VALUE, NAMES } from '../data/people';
import type { Material } from '../data/materials';
import type { Rng } from '../rng';
import { storages } from './buildings';
import { townFull, addStock, makePerson, notify, type GameState, type Prisoner, type Raider } from './state';
import { campXY } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds } from './townsfolk';
import { rulesOf } from '../data/origins';
import { FARM_ESCAPE } from '../data/vampires';
import { bloodTown, farmCells } from './vampires';

/** Chance a fallen human raider is taken alive. */
export const CAPTURE_CHANCE = 0.4;
/** Winning a prisoner over, per game day: base plus per level of the best Social skill in town. */
const CONVERT_BASE = 0.12;
const CONVERT_PER_SOCIAL = 0.02;
/** Chance per game day a prisoner slips away (higher when hungry). */
const ESCAPE_PER_DAY = 0.06;

export const isHuman = (kind: string) => !!ENEMIES[kind] && 'people' in ENEMIES[kind].sprite && ENEMIES[kind].sprite.people !== 'zombie';

/** At the end of a raid: some of the fallen human raiders are taken prisoner. */
export function takePrisoners(s: GameState, raiders: Raider[], rng: Rng): number {
  let n = 0;
  for (const rd of raiders) {
    if (!rd.down || !isHuman(rd.kind) || !rng.chance(Math.min(1, CAPTURE_CHANCE * (rulesOf(s).captives ?? 1)))) continue;
    const taken = [...s.people, ...s.prisoners].map((p) => p.name);
    const free = NAMES.filter((x) => !taken.includes(x));
    s.prisoners.push({ id: s.nextId++, enemy: rd.kind, name: rng.pick(free.length ? free : NAMES), conviction: 0, since: s.tick, hungry: false });
    n++;
  }
  if (n) notify(s, `${n === 1 ? 'One raider was' : `${n} raiders were`} taken prisoner. See Townsfolk.`, true);
  return n;
}

/** Once an hour: prisoners eat once a day, might escape, and slowly come round. */
export function updatePrisoners(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !s.prisoners.length) return;
  const social = Math.max(1, ...s.people.filter((p) => p.away === null && p.bornTick == null).map((p) => p.skills.social.level));
  for (const pr of [...s.prisoners]) {
    if ((s.tick - pr.since) % TICKS_PER_DAY === 0) pr.hungry = !feed(s);
    // (in the blood farm's cells few get away, and nobody is won over: the Court keeps them for their blood)
    const celled = bloodTown(s) && s.prisoners.indexOf(pr) < farmCells(s);
    if (rng.chance((ESCAPE_PER_DAY * (pr.hungry ? 3 : 1) * (celled ? FARM_ESCAPE : 1)) / 24)) {
      s.prisoners = s.prisoners.filter((q) => q !== pr);
      notify(s, `${pr.name} the prisoner escaped in the night.`, true);
      continue;
    }
    if (bloodTown(s)) continue;
    pr.conviction += ((CONVERT_BASE + social * CONVERT_PER_SOCIAL) * (pr.hungry ? 0.3 : 1)) / 24;
    if (pr.conviction >= 1 && !townFull(s)) convert(s, pr, rng);
  }
}

/** A prisoner's daily ration. Returns false if there was nothing to give. */
function feed(s: GameState): boolean {
  for (const st of storages(s)) {
    for (const m of Object.keys(FOOD_VALUE) as Material[]) {
      if ((st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        return true;
      }
    }
  }
  return false;
}

function convert(s: GameState, pr: Prisoner, rng: Rng): void {
  s.prisoners = s.prisoners.filter((q) => q !== pr);
  const p = makePerson(rng, s.nextId++, 'hunter', campXY(s), s.people.map((q) => q.name));
  p.name = pr.name;
  s.people.push(p);
  assignBeds(s);
  notify(s, `${pr.name}, once a raider, has come round and joined the town.`, true);
}

/** Let a prisoner go (the town's reputation for mercy grows a little). */
export function releasePrisoner(s: GameState, id: number): void {
  const pr = s.prisoners.find((q) => q.id === id);
  if (!pr) return;
  s.prisoners = s.prisoners.filter((q) => q !== pr);
  s.reputation += 1;
  notify(s, `${pr.name} was set free.`);
}
