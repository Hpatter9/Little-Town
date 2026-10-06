// Prisoners (DESIGN §7, §10): raiders struck down in a raid of people (not beasts) may be taken alive.
// They eat, might slip away, and can be won over in time (faster with a sociable warden: the town's best
// Social skill), when they join the town. Or they can simply be let go.

import { ENEMIES } from '../data/enemies';
import { BUILDING_BY_ID } from '../data/buildings';
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

/** The cells the town has to keep prisoners in: its prisons' (data/prisons.ts) and a blood farm's. */
export const cellsOf = (s: GameState): number =>
  s.buildings.reduce((t, b) => (b.status === 'done' ? t + (BUILDING_BY_ID[b.def]?.cells ?? 0) : t), 0) + farmCells(s);

/** How readily the prisoner in the `i`th cell gets away: the best cells are filled first (a blood farm's, then a
 *  prison's, a gaol's, a stockade's); one with no cell at all (a prison pulled down) twice as readily as from stakes. */
function escapeAt(s: GameState, i: number): number {
  const cells: number[] = [];
  for (let k = 0; k < farmCells(s); k++) cells.push(FARM_ESCAPE);
  for (const b of s.buildings) {
    const d = b.status === 'done' ? BUILDING_BY_ID[b.def] : undefined;
    if (d?.cells) for (let k = 0; k < d.cells; k++) cells.push(d.escape ?? 1);
  }
  cells.sort((a, b) => a - b);
  return i < cells.length ? cells[i] : NO_CELL_ESCAPE;
}
/** A prisoner with no cell gets away this many times as readily as from a stockade. */
const NO_CELL_ESCAPE = 2;

/** At the end of a raid: some of the fallen human raiders are taken prisoner, while a cell stands free for each. */
export function takePrisoners(s: GameState, raiders: Raider[], rng: Rng): number {
  let n = 0;
  let room = cellsOf(s) - s.prisoners.length;
  let turned = 0;
  for (const rd of raiders) {
    // (one run down as it limped away is taken alive for sure: sim/raiderWounds.ts)
    if (!rd.down || !isHuman(rd.kind) || (!rd.taken && !rng.chance(Math.min(1, CAPTURE_CHANCE * (rulesOf(s).captives ?? 1))))) continue;
    // (no cell free: there's nowhere to hold them, and they're left where they fell)
    if (room <= 0) {
      turned++;
      continue;
    }
    room--;
    const taken = [...s.people, ...s.prisoners].map((p) => p.name);
    const free = NAMES.filter((x) => !taken.includes(x));
    s.prisoners.push({ id: s.nextId++, enemy: rd.kind, name: rng.pick(free.length ? free : NAMES), conviction: 0, since: s.tick, hungry: false });
    n++;
  }
  if (n) notify(s, `${n === 1 ? 'One raider was' : `${n} raiders were`} taken prisoner. See Townsfolk.`, true);
  if (turned) notify(s, `${turned === 1 ? 'A raider could have been' : `${turned} raiders could have been`} taken alive, but there was no cell to hold ${turned === 1 ? 'them' : 'them'}${cellsOf(s) ? ': the cells are full' : ': the town has no stockade'}.`, true);
  return n;
}

/** Once an hour: prisoners eat once a day, might escape, and slowly come round. */
export function updatePrisoners(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !s.prisoners.length) return;
  const social = Math.max(1, ...s.people.filter((p) => p.away === null && p.bornTick == null).map((p) => p.skills.social.level));
  for (const pr of [...s.prisoners]) {
    if ((s.tick - pr.since) % TICKS_PER_DAY === 0) pr.hungry = !feed(s);
    // (in the blood farm's cells few get away, and nobody is won over: the Court keeps them for their blood)
    // (the better the cell, the fewer get away: data/prisons.ts)
    if (rng.chance((ESCAPE_PER_DAY * (pr.hungry ? 3 : 1) * escapeAt(s, s.prisoners.indexOf(pr))) / 24)) {
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
