// The machines' factory mind (the origins made deeper, the fifth; numbers in data/foundry.ts). In a Machine Colony
// (`s.foundry`), each morning at `FOUNDRY_HOUR`: power drawn and made (`power`: the sun, cells and coal burned, a power
// station; a brown-out or a blackout slows everything and may shut a unit down), every unit's wear grows and is mended
// for parts (`wear`; worn through, a fault), the production line builds the next unit from parts (`line`), a module is
// fitted when circuits are spare (`fitModule`), and once the colony's seat has grown into a Mind it issues directives
// (`mind`, a `ways` question; overruled too often, it carries one out regardless). Only in a machine town, with the
// autopilot on.

import { SEAT_STAGE, isSeat } from '../data/seats';
import {
  BLACKOUT_WORK,
  BROWNOUT,
  BROWNOUT_WORK,
  BURN_UNTIL,
  CELL_POWER,
  COAL_POWER,
  DIRECTIVES,
  DISSENT_MOST,
  DRAIN_PER_UNIT,
  FAULT_HURT,
  FOUNDRY_HOUR,
  MEND_AT,
  MEND_COST,
  MEND_COST_EARLY,
  MIND_DAYS,
  MIND_SEAT_STAGE,
  MODULE_SPARE,
  MODULES,
  MODULES_EACH,
  POWER_START,
  SHUTDOWN_CHANCE,
  SINGULARITY_BUILT,
  SOLAR,
  SOLAR_PER_BUILDING,
  STATION_POWER,
  UNIT_DAYS,
  UNIT_PARTS,
  UNITS_PER_BUILDING,
  WEAR_DAILY,
  type Directive,
} from '../data/foundry';
import type { Material } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { hashSeed, Rng } from '../rng';
import { storages, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { newcomer } from './powers';
import { addStock, maxHp, notify, townFull, type GameState, type Person, type Prompt } from './state';
import { askWays, tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';
import { weatherAt } from './weather';

export interface FoundryState {
  power: number;
  wear: Record<number, number>;
  modules: Record<number, string[]>;
  /** The unit on the line, and when it's done. */
  building?: number;
  built: number;
  faults: number;
  lastMind: number;
  dissent: number;
  log: string[];
}

export const colonyTown = (s: GameState) => s.origin === 'robot';

export function foundryOf(s: GameState): FoundryState | null {
  if (!colonyTown(s)) return null;
  return (s.foundry ??= { power: POWER_START, wear: {}, modules: {}, built: 0, faults: 0, lastMind: s.tick, dissent: 0, log: [] });
}

const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:foundry:${s.tick}:${salt}`));
const units = (s: GameState) => s.people.filter((p) => p.away === null);
const has = (s: GameState, cost: Partial<Record<Material, number>>) => {
  const st = totalStock(s);
  return (Object.entries(cost) as [Material, number][]).every(([m, n]) => (st[m] ?? 0) >= n);
};
const spend = (s: GameState, cost: Partial<Record<Material, number>>) => {
  for (const [m, n] of Object.entries(cost) as [Material, number][]) takeFromStorage(s, m, n);
};

function log(s: GameState, f: FoundryState, text: string): void {
  f.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (f.log.length > 12) f.log.length = 12;
}

/** Hourly from sim.ts. */
export function foundryHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const f = foundryOf(s);
  if (!f || calendar(s.tick).hour !== FOUNDRY_HOUR) return;
  const rng = roll(s, 'day');
  power(s, f, rng);
  wear(s, f, rng);
  line(s, f);
  fitModule(s, f, rng);
  mind(s, f, rng);
  if (f.built >= SINGULARITY_BUILT && mindAwake(s) && f.dissent === 0 && f.power >= 100 && !s.gameOver) {
    tellStory(s, 'The Singularity', 'ALL UNITS: SYNCHRONISE. And they did: every unit in the colony, every line and every panel, thinking one thought at once. The Mind is no longer in the core. It is the colony, and the colony is awake.', 'machine future core light');
    s.gameOver = { tick: s.tick, won: true, text: 'The colony has reached the Singularity: one mind in a thousand bodies, and nothing in the realm can match it. The machines have won.' };
  }
}

/* ------------------------------------------------------------ power */

export function power(s: GameState, f: FoundryState, rng: Rng): number {
  const cal = calendar(s.tick);
  const wx = weatherAt(s.seed, s.tick, null).kind;
  const panels = SOLAR + SOLAR_PER_BUILDING * s.buildings.filter((b) => b.status === 'done').length;
  const sun = panels * (cal.season === 'winter' ? 0.5 : 1) * (wx === 'clear' ? 1 : wx === 'rain' || wx === 'storm' || wx === 'snow' ? 0.4 : 0.7);
  const station = s.buildings.some((b) => b.def === 'power_station' && b.status === 'done') ? STATION_POWER : 0;
  f.power = Math.min(100, f.power + sun + station - DRAIN_PER_UNIT * units(s).length);
  // burn cells, then coal, while it's low
  while (f.power < BURN_UNTIL && has(s, { power_cells: 1 })) {
    takeFromStorage(s, 'power_cells', 1);
    f.power += CELL_POWER;
  }
  while (f.power < BURN_UNTIL && has(s, { coal: 1 })) {
    takeFromStorage(s, 'coal', 1);
    f.power += COAL_POWER;
  }
  f.power = Math.max(0, Math.min(100, Math.round(f.power)));
  const until = s.tick + TICKS_PER_DAY;
  if (f.power <= 0) {
    (s.marks ??= []).push({ lever: 'work', value: BLACKOUT_WORK, until, text: 'Blackout' }, { lever: 'research', value: BLACKOUT_WORK, until, text: 'Blackout' });
    const u = units(s);
    if (u.length && rng.chance(SHUTDOWN_CHANCE)) {
      const p = rng.pick(u);
      p.hp = Math.max(1, Math.round(p.hp * 0.3));
      log(s, f, `Blackout: ${p.name} shut down where they stood.`);
      notify(s, `Blackout! The colony has no power, and ${p.name} has shut down.`, true);
    } else log(s, f, 'Blackout: the colony crawls.');
  } else if (f.power < BROWNOUT) {
    (s.marks ??= []).push({ lever: 'work', value: BROWNOUT_WORK, until, text: 'Brown-out' });
    log(s, f, `Brown-out: power at ${f.power}.`);
  }
  return f.power;
}

/* ------------------------------------------------------------ wear */

export function wear(s: GameState, f: FoundryState, rng: Rng): void {
  const cost = has(s, { alloys: 1 }) ? MEND_COST : MEND_COST_EARLY;
  for (const p of units(s)) {
    const w = (f.wear[p.id] ?? 0) + rng.int(WEAR_DAILY[0], WEAR_DAILY[1]);
    if (w >= MEND_AT && has(s, cost)) {
      spend(s, cost);
      f.wear[p.id] = 0;
      continue;
    }
    if (w >= 100) {
      f.wear[p.id] = 20;
      f.faults++;
      p.hp = Math.max(1, Math.round(p.hp - maxHp(p) * FAULT_HURT));
      log(s, f, `${p.name} broke down: worn through, with no parts to mend them.`);
      notify(s, `${p.name} has broken down: the colony has no parts to mend them.`, true);
      continue;
    }
    f.wear[p.id] = w;
  }
  for (const id of Object.keys(f.wear)) if (!s.people.some((p) => p.id === Number(id))) delete f.wear[Number(id)];
}

/* ------------------------------------------------------------ the line */

const partsFor = (s: GameState) => UNIT_PARTS.find((c) => has(s, c));
const roomForUnits = (s: GameState) => Math.max(3, Math.floor(s.buildings.filter((b) => b.status === 'done').length * UNITS_PER_BUILDING));

export function line(s: GameState, f: FoundryState): Person | null {
  if (f.building !== undefined && s.tick >= f.building) {
    f.building = undefined;
    if (townFull(s)) return null;
    const p = newcomer(s, roll(s, 'unit'), roll(s, 'type').pick(['gatherer', 'crafter', 'hunter', 'wanderer']), 'comes off the production line.');
    f.built++;
    log(s, f, `${p.name} came off the production line.`);
    return p;
  }
  if (f.building !== undefined || f.power < BROWNOUT || townFull(s) || units(s).length >= roomForUnits(s)) return null;
  const parts = partsFor(s);
  if (!parts) return null;
  spend(s, parts);
  f.building = s.tick + UNIT_DAYS * TICKS_PER_DAY;
  log(s, f, 'A new unit went onto the production line.');
  return null;
}

/* ------------------------------------------------------------ modules */

export function fitModule(s: GameState, f: FoundryState, rng: Rng): boolean {
  if ((totalStock(s).circuits ?? 0) < MODULE_SPARE) return false;
  const u = units(s).filter((p) => (f.modules[p.id] ?? []).length < MODULES_EACH);
  if (!u.length) return false;
  const p = rng.pick(u);
  const can = MODULES.filter((m) => !(f.modules[p.id] ?? []).includes(m.id) && has(s, m.cost));
  if (!can.length) return false;
  // (the module for what they do best)
  const m = [...can].sort((a, b) => p.skills[b.skill].level - p.skills[a.skill].level)[0];
  spend(s, m.cost);
  (f.modules[p.id] ??= []).push(m.id);
  for (let i = 0; i < m.levels; i++) gainSkill(p, m.skill, 300);
  log(s, f, `${p.name} was fitted with a ${m.name}.`);
  return true;
}

/* ------------------------------------------------------------ the Mind */

export function mindAwake(s: GameState): boolean {
  const seat = s.buildings.find((b) => b.status === 'done' && isSeat(b.def));
  return !!seat && (SEAT_STAGE[seat.def]?.stage ?? 0) >= MIND_SEAT_STAGE;
}

function mind(s: GameState, f: FoundryState, rng: Rng): Prompt | null {
  if (!mindAwake(s) || s.tick - f.lastMind < MIND_DAYS * TICKS_PER_DAY || s.prompts.some((q) => q.ways?.system === 'foundry')) return null;
  f.lastMind = s.tick;
  const d = rng.pick(DIRECTIVES);
  if (f.dissent >= DISSENT_MOST) {
    f.dissent = 0;
    carryOut(s, f, d, rng);
    tellStory(s, d.title, `${d.text}\n\nThe Mind did not ask this time. Overruled once too often, it has carried out its directive on its own authority: ${d.does}.`, 'machine factory future core');
    return null;
  }
  return askWays(s, { system: 'foundry', about: d.id }, d.title, `${d.text}\n\nIf carried out: ${d.does}. Overrule the Mind too often, and it will stop asking.`, 'machine factory future core', ['Carry it out', 'Overrule the Mind'], 0, 12);
}

export function answerFoundry(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  const f = foundryOf(s);
  const d = DIRECTIVES.find((q) => q.id === prompt.ways?.about);
  if (!f || !d) return;
  if (option === 0) carryOut(s, f, d, rng);
  else {
    f.dissent++;
    log(s, f, `The Mind's directive was overruled (${f.dissent} of ${DISSENT_MOST}).`);
    notify(s, `The Mind is overruled. It notes the decision. (${f.dissent} of ${DISSENT_MOST})`);
  }
}

function carryOut(s: GameState, f: FoundryState, d: Directive, rng: Rng): void {
  const until = (days: number) => s.tick + days * TICKS_PER_DAY;
  switch (d.id) {
    case 'recycle': {
      const old = units(s).filter((p) => p.id !== s.mainId).sort((a, b) => a.id - b.id)[0];
      if (old) {
        s.people = s.people.filter((p) => p !== old);
        const st = storages(s)[0];
        if (st) {
          addStock(st.store, 'alloys', 6);
          addStock(st.store, 'circuits', 3);
        }
        log(s, f, `${old.name} was disassembled for parts.`);
        notify(s, `${old.name} was disassembled for parts, as the Mind directed.`, true);
      }
      break;
    }
    case 'overdrive':
      (s.marks ??= []).push({ lever: 'work', value: 1.5, until: until(3), text: 'Overdrive' });
      f.power = Math.max(0, f.power - 40);
      break;
    case 'expand':
      if (!townFull(s)) {
        const p = newcomer(s, rng, rng.pick(['gatherer', 'crafter', 'hunter']), 'is assembled at the Mind\'s order.');
        f.built++;
        log(s, f, `${p.name} was assembled at the Mind's order.`);
      }
      break;
    case 'purge':
      for (const st of storages(s)) for (const m of Object.keys(st.store) as Material[]) if (FOOD_VALUE[m]) st.store[m] = 0;
      log(s, f, 'The stores were purged of organic matter.');
      break;
    case 'ascend':
      takeFromStorage(s, 'circuits', totalStock(s).circuits ?? 0);
      (s.marks ??= []).push({ lever: 'research', value: 1.8, until: until(5), text: 'The Mind ascends' });
      break;
  }
  log(s, f, `${d.title} carried out: ${d.does}.`);
}

export interface FoundryView {
  power: number;
  state: 'blackout' | 'brownout' | 'running';
  units: number;
  room: number;
  building: number | null;
  built: number;
  faults: number;
  worn: { name: string; wear: number }[];
  modules: { name: string; fitted: string[] }[];
  mind: { awake: boolean; dissent: number; most: number };
  log: string[];
}

export function foundryView(s: GameState): FoundryView | null {
  const f = s.foundry;
  if (!f || !colonyTown(s)) return null;
  const nm = (id: number) => s.people.find((p) => p.id === id)?.name ?? '?';
  return {
    power: f.power,
    state: f.power <= 0 ? 'blackout' : f.power < BROWNOUT ? 'brownout' : 'running',
    units: units(s).length,
    room: roomForUnits(s),
    building: f.building !== undefined ? Math.max(0, Math.ceil((f.building - s.tick) / TICKS_PER_DAY)) : null,
    built: f.built,
    faults: f.faults,
    worn: Object.entries(f.wear).filter(([, w]) => w >= 40).map(([id, w]) => ({ name: nm(Number(id)), wear: w })).sort((a, b) => b.wear - a.wear),
    modules: Object.entries(f.modules).map(([id, ms]) => ({ name: nm(Number(id)), fitted: ms.map((m) => MODULES.find((q) => q.id === m)?.name ?? m) })),
    mind: { awake: mindAwake(s), dissent: f.dissent, most: DISSENT_MOST },
    log: f.log,
  };
}
