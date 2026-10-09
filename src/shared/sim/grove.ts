// The druids' living grove (the origins made deeper, the first; numbers in data/grove.ts). A druid town keeps the
// grove's favour (`s.grove`): every forest cell felled costs it (`noteFelled`, from regrow.ts `noteCleared`), every
// cell grown back gives it (`noteRegrown`), and each morning the druids tend the young woods. Pleased, the grove blesses
// the day's fields and foraging and sends a beast to guard the town now and then (they fight beside the town in every
// raid: `groveAllies`; struck down, lost: `groveRaidOver`); angered, it curses the fields, its thorns cut the
// woodcutters, the wolves come, and its guardians leave. At the turn of each season the circle keeps a rite (`RITES`):
// an offering laid on the stones for the grove's gift. Only in a druid town, with the autopilot on.

import {
  ANGRY_AT,
  BLESS_MULT,
  BLESSED_AT,
  CURSE_MULT,
  FAVOUR_DRIFT,
  FELL_ALLOWANCE,
  FELL_FAVOUR,
  FELL_MOST,
  GROVE_HOUR,
  GROVE_MOODS,
  GUARDIAN_AT,
  GUARDIAN_DAYS,
  GUARDIAN_KINDS,
  GUARDIAN_LEAVES_AT,
  GUARDIANS_MOST,
  REGROW_FAVOUR,
  RITE_HOUR,
  RITES,
  TEND_CELLS,
  TEND_FAVOUR,
  THORN_CHANCE,
  WOLVES_CHANCE,
  WOLVES_RAID,
} from '../data/grove';
import type { Material } from '../data/materials';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { minorWound } from './injuries';
import { addStock, maxHp, notify, type GameState, type Raid, type Raider } from './state';
import { raidBudget, startRaid } from './raids';
import { storages } from './buildings';
import { tellStory } from './telling';
import { calendar, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface Guardian {
  id: number;
  kind: string;
  name: string;
  beast: string;
  came: number;
}

export interface GroveState {
  favour: number;
  /** Cells felled and grown back since the last morning. */
  felled: number;
  regrown: number;
  guardians: Guardian[];
  lastGuardian: number;
  /** The last rite kept (its season and year), and the log. */
  rite: string;
  log: string[];
}

export const groveTown = (s: GameState) => s.origin === 'druid';

export function groveOf(s: GameState): GroveState | null {
  if (!groveTown(s)) return null;
  return (s.grove ??= { favour: 10, felled: 0, regrown: 0, guardians: [], lastGuardian: 0, rite: '', log: [] });
}

/** A forest cell felled (from regrow.ts). */
export function noteFelled(s: GameState): void {
  if (s.grove) s.grove.felled++;
}
/** A cell grown back (from regrow.ts). */
export function noteRegrown(s: GameState): void {
  if (s.grove) s.grove.regrown++;
}

const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n * 10) / 10));
const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:grove:${s.tick}:${salt}`));

function log(s: GameState, g: GroveState, text: string): void {
  g.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (g.log.length > 10) g.log.length = 10;
}

export const groveMood = (favour: number) => GROVE_MOODS.find(([at]) => favour >= at)?.[1] ?? 'The grove watches';

/** Hourly from sim.ts. */
export function groveHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const g = groveOf(s);
  if (!g) return;
  const cal = calendar(s.tick);
  if (cal.hour === GROVE_HOUR) groveMorning(s, g);
  if (cal.hour === RITE_HOUR && cal.dayOfSeason === 1) keepRite(s, g);
}

/** Each morning: the felling and the regrowth weighed, the young woods tended, and the grove's mood felt. */
export function groveMorning(s: GameState, g: GroveState): void {
  const tended = tendWoods(s);
  const before = g.favour;
  g.favour = clamp(g.favour + g.regrown * REGROW_FAVOUR - Math.min(FELL_MOST, Math.max(0, g.felled - FELL_ALLOWANCE) * FELL_FAVOUR) + tended * TEND_FAVOUR);
  g.favour = clamp(g.favour - Math.sign(g.favour) * Math.min(FAVOUR_DRIFT, Math.abs(g.favour)));
  if (g.felled > FELL_ALLOWANCE + 4 && g.favour < before) log(s, g, `${g.felled} trees felled yesterday. The grove felt every one.`);
  g.felled = 0;
  g.regrown = 0;
  const rng = roll(s, 'morning');
  const until = s.tick + TICKS_PER_DAY;
  if (g.favour >= BLESSED_AT) {
    (s.marks ??= []).push({ lever: 'crops', value: BLESS_MULT, until, text: 'The grove\'s blessing' }, { lever: 'forage', value: BLESS_MULT, until, text: 'The grove\'s blessing' });
    if (g.guardians.length < GUARDIANS_MOST && g.favour >= GUARDIAN_AT && s.tick - g.lastGuardian >= GUARDIAN_DAYS * TICKS_PER_DAY) sendGuardian(s, g, rng);
  } else if (g.favour <= ANGRY_AT) {
    (s.marks ??= []).push({ lever: 'crops', value: CURSE_MULT, until, text: 'The grove\'s anger' }, { lever: 'forage', value: CURSE_MULT, until, text: 'The grove\'s anger' });
    // its thorns find a woodcutter
    const cutter = s.people.find((p) => p.away === null && !p.downed && p.task?.type === 'gather');
    if (cutter && rng.chance(THORN_CHANCE)) {
      minorWound(s, cutter, Math.round(maxHp(cutter) * 0.15), rng);
      log(s, g, `Thorns lashed ${cutter.name} at the woods' edge.`);
      notify(s, `The angry grove's thorns lashed ${cutter.name}.`);
    }
    if (!s.raid && rng.chance(WOLVES_CHANCE) && RAID_KIND_BY_ID[WOLVES_RAID]) {
      startRaid(s, RAID_KIND_BY_ID[WOLVES_RAID], Math.max(12, Math.round(raidBudget(s) * 0.6)), rng);
      log(s, g, 'The grove loosed its wolves on the town.');
      notify(s, 'The grove is angry: wolves come howling out of the trees!', true);
    }
  }
  if (g.favour <= GUARDIAN_LEAVES_AT && g.guardians.length) {
    const left = g.guardians.pop()!;
    log(s, g, `${left.name} the ${left.beast} turned away into the trees, and did not come back.`);
    notify(s, `${left.name} the ${left.beast}, the grove's guardian, has left the town.`);
  }
}

/** Hurry on the regrowth of a few felled cells: the druids plant and tend. */
function tendWoods(s: GameState): number {
  const due = s.land.regrow;
  if (!due) return 0;
  let n = 0;
  for (const [key, [was, at]] of Object.entries(due)) {
    if (n >= TEND_CELLS) break;
    if (at <= s.tick + TICKS_PER_HOUR) continue;
    due[Number(key)] = [was, Math.max(s.tick + TICKS_PER_HOUR, at - TICKS_PER_DAY)];
    n++;
  }
  return n;
}

function sendGuardian(s: GameState, g: GroveState, rng: Rng): void {
  const biome = s.biome ?? 'forest';
  const kinds = GUARDIAN_KINDS.filter((k) => !k.biomes || k.biomes.includes(biome));
  const k = rng.pick(kinds);
  const taken = new Set(g.guardians.map((q) => q.name));
  const name = rng.pick(k.names.filter((n) => !taken.has(n)).length ? k.names.filter((n) => !taken.has(n)) : k.names);
  const guardian: Guardian = { id: s.nextId++, kind: k.kind, name, beast: k.beast, came: s.tick };
  g.guardians.push(guardian);
  g.lastGuardian = s.tick;
  log(s, g, `${name}, a great ${k.beast}, came out of the trees and lay down by the fire. The grove has sent a guardian.`);
  tellStory(s, `${name} the ${k.beast}`, `At first light a great ${k.beast} walked out of the trees, bold as a townsperson, and lay down by the fire. The druids knew it at once: the grove is pleased, and has sent ${name} to guard the town. When raiders come, ${name} will be there.`, 'forest wild beast grove');
}

/** The turn of a season: the rite kept. */
export function keepRite(s: GameState, g: GroveState): void {
  const cal = calendar(s.tick);
  const key = `${cal.season}:${cal.year}`;
  if (g.rite === key) return;
  g.rite = key;
  const rite = RITES[cal.season];
  const stock = totalStock(s);
  const rich = (Object.entries(rite.offering) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n);
  if (rich) for (const [m, n] of Object.entries(rite.offering) as [Material, number][]) takeFromStorage(s, m, n);
  const k = rich ? 1 : 0.5;
  g.favour = clamp(g.favour + (rich ? rite.favour : -5));
  if (rite.mark) {
    const value = rite.mark.lever === 'morale' ? Math.round(rite.mark.value * k) : 1 + (rite.mark.value - 1) * k;
    (s.marks ??= []).push({ lever: rite.mark.lever, value, until: s.tick + rite.mark.hours * TICKS_PER_HOUR, text: rite.mark.text });
  }
  if (rite.gift) {
    const st = storages(s)[0];
    if (st) for (const [m, n] of Object.entries(rite.gift) as [Material, number][]) addStock(st.store, m, Math.round(n * k));
  }
  if (rite.heal)
    for (const p of s.people) {
      if (p.away !== null) continue;
      p.hp = Math.min(maxHp(p), p.hp + (maxHp(p) - p.hp) * rite.heal * k);
      for (const w of p.wounds ?? []) w.sev *= 1 - rite.heal * k;
    }
  log(s, g, `${rite.name} was kept${rich ? '' : ', poorly: there was too little to offer'}.`);
  tellStory(s, rite.name, rich ? rite.story : `${rite.story} But the offering was thin, and the grove gave only half what it might.`, 'grove forest ritual druid');
}

/** A raid: the guardians fight beside the town (from raids.ts startRaid). */
export function groveAllies(s: GameState, r: Raid, make: (kind: string) => Raider): number {
  const g = s.grove;
  if (!g || !groveTown(s)) return 0;
  for (const q of g.guardians) {
    const a = make(q.kind);
    a.guardian = q.id;
    r.raiders.push(a);
  }
  if (g.guardians.length) notify(s, `The grove's guardians come out of the trees to fight: ${g.guardians.map((q) => q.name).join(', ')}.`);
  return g.guardians.length;
}

/** A raid over: a guardian struck down is lost (from raids.ts endRaid). */
export function groveRaidOver(s: GameState, r: Raid): void {
  const g = s.grove;
  if (!g) return;
  for (const rd of r.raiders) {
    if (rd.guardian === undefined || !(rd.down || rd.hp <= 0)) continue;
    const q = g.guardians.find((x) => x.id === rd.guardian);
    if (!q) continue;
    g.guardians.splice(g.guardians.indexOf(q), 1);
    g.favour = clamp(g.favour - 5);
    log(s, g, `${q.name} the ${q.beast} fell defending the town.`);
    notify(s, `${q.name} the ${q.beast}, the grove's guardian, fell defending the town.`, true);
  }
}

export interface GroveView {
  favour: number;
  mood: string;
  blessed: boolean;
  angry: boolean;
  guardians: { name: string; beast: string; days: number }[];
  nextRite: { name: string; days: number };
  log: string[];
}

export function groveView(s: GameState): GroveView | null {
  const g = s.grove;
  if (!g || !groveTown(s)) return null;
  const cal = calendar(s.tick);
  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
  const next = seasons[(seasons.indexOf(cal.season) + 1) % 4];
  return {
    favour: Math.round(g.favour),
    mood: groveMood(g.favour),
    blessed: g.favour >= BLESSED_AT,
    angry: g.favour <= ANGRY_AT,
    guardians: g.guardians.map((q) => ({ name: q.name, beast: q.beast, days: Math.floor((s.tick - q.came) / TICKS_PER_DAY) })),
    nextRite: { name: RITES[next].name, days: DAYS_PER_SEASON - cal.dayOfSeason + 1 },
    log: g.log,
  };
}
