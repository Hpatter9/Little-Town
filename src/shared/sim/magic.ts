// Magic as a system of the town (data/magic.ts). The land's leylines (`leyOf`, from the seed; `leyAt` the power at a
// cell) feed a Mage Tower's mana, and the town's casters add a little each. Casters study the spells of the schools
// the town has learned (`studyHourly`: a spell at a time, faster at the Arcane Library or the tower and with the
// school's tome), and practise by casting the town's rites (`ritesHourly`: one an hour, the first that's wanted of
// `RITE_ORDER`, by the caster best at it). Every rite costs mana and stirs the wild magic (`flux`); it may miscast
// (`miscast`: a burn, madness, death, the spell running wild, a tear into another world). A mage whose madness passes
// `MAD_AT` is put to the town (a `ways` prompt, system 'magic'). Past `SURGE_AT` the wild magic surges (`surge`). Cursed
// charms bite whoever bears them until a ward-wright breaks them; a master mage makes an enchanted one, once. Only with
// the autopilot on; the rolls are its own side stream ('magic'), never the town's.

import {
  ARCANE_LIBRARY, BACKLASH, BLOOD_MANA, BLOOD_TAKES, BLOOD_WHEN, CASTER_MANA, CURSE_DRAIN, CURSE_MADNESS, CURSED, ENCHANT_HOURS, ENCHANT_WORK, ENCHANTED, FAVOURED, FLAVOURS,
  FLUX_LEY, FLUX_PER_MANA, FLUX_SETTLES, FOCI, FOCUS_STEADY, FORESIGHT_HOURS, LEY_BIOME, LEY_HALF, LEY_LINES, LEY_LORE, LEY_NEAR_CAMP, LOCK_DAYS, MAD_AT, MAD_FLUX, MAD_FORBIDDEN, MAD_MISCAST,
  MAD_SETTLES, MAD_TURNS, MAGE_TOWER, MANA_CAP, MANA_CAP_LIBRARY, MANA_CAP_TOWER, MASTER_SPELLS, MASTERY_HALF, MASTERY_MAX, MEND_MOST, MEND_SHARE, MISCAST_ODDS, OMEN_HOURS, POTENCY_PER_SPELL,
  PRACTICE_RITE, PRACTICE_SPELL, RITE_ORDER, RITES, SCHOOL_IDS, SCHOOL_SPELLS, SCHOOLS, SERVANT_FETCH, SERVANT_TURNS, SERVANT_UPKEEP, SERVANTS_MOST, STORM_BURN, STORM_HITS, STUDY_AHEAD,
  STUDY_INT, STUDY_LIBRARY, STUDY_PER_LEVEL, STUDY_TOME, STUDY_TOWER, SURGE_AT, SURGE_CURSE, SURGE_FIRES, SURGE_KILLS, SURGE_LEAVES, SURGE_PLAGUE, SURGE_R, SURGE_TEAR, SURGE_WOUNDS, TOWER_BASE,
  TOWER_MANA, TOWER_PEOPLE, WARD_MOST, WARD_SAP, WELL_POWER, WELL_R, type Flavour, type RiteId, type SchoolId,
} from '../data/magic';
import { ATTR_BASE } from '../data/attributes';
import { eraReached } from '../data/eras';
import { ITEM_BY_ID } from '../data/items';
import { levelOf } from '../data/levels';
import type { OriginId } from '../data/origins';
import { REALMS } from '../data/portals';
import { HOME_REGION, REGION_BY_ID, REGIONS } from '../data/regions';
import { SPELL_BY_ID, SPELLCASTERS, spellsKnown, type SpellDef } from '../data/spells';
import type { ClassId } from '../data/classes';
import { hashSeed, Rng } from '../rng';
import { alignPush, orderPush } from './alignment';
import { attributesOf } from './attributes';
import { blueprintCount, buildingCentre, buildSlots, depositNear, placeBlueprint, townRadius } from './buildings';
import { queueCraft, equip } from './crafting';
import { setFire } from './fire';
import { killPerson, stabilize } from './health';
import { woundPerson } from './injuries';
import { tearRift } from './portals';
import { isChild } from './social';
import { assignBeds } from './townsfolk';
import { campCell, castSpellFx, maxHp, notify, tireless, type Building, type GameState, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { CELL } from './land';
import { manaRest } from './mana';

/** A caster's own magic. */
export interface Arcana {
  /** Spells learned by study (data/spells.ts ids), beyond their calling's own. */
  spells: string[];
  /** The spell being studied, and the hours put in. */
  study?: { spell: string; hours: number };
  practice: number;
  madness: number;
  /** Locked in the tower until this tick (no rites, no study). */
  locked?: number;
  /** Their madness has been put to the town (and not yet settled). */
  asked?: boolean;
  /** Rites cast, miscasts suffered. */
  rites: number;
  miscasts: number;
  /** Their masterwork made (an enchanted charm). */
  master?: boolean;
}

/** The town's magic. */
export interface MagicState {
  mana: number;
  /** The wild magic, 0 to `SURGE_AT`. */
  flux: number;
  /** When each rite may be cast again. */
  ready: Partial<Record<RiteId, number>>;
  /** Tools enchanted until this tick. */
  enchanted?: number;
  /** Animated servants at work, and the hours of fetching each owes (a share: whole units are delivered). */
  servants: number;
  fetched?: number;
  /** Raids already warded, burned, foreseen (raid ids), and the next raid's omen told (its tick). */
  warded?: number;
  stormed?: number;
  foreseen?: number;
  omen?: number;
  /** Counts: rites, miscasts, surges, deaths by magic. */
  rites: number;
  miscasts: number;
  surges: number;
  deaths: number;
  /** One-of-a-kind charms found or made (ids), so none comes twice. */
  found: string[];
  /** What's happened, newest last. */
  log: string[];
}

const LOG_KEPT = 12;
const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:magic:${s.tick}${salt.length ? `:${salt.join(':')}` : ''}`));
const note = (m: MagicState, line: string) => {
  m.log.push(line);
  if (m.log.length > LOG_KEPT) m.log.splice(0, m.log.length - LOG_KEPT);
};
export const magicOf = (s: GameState): MagicState => (s.magic ??= { mana: 0, flux: 0, ready: {}, servants: 0, rites: 0, miscasts: 0, surges: 0, deaths: 0, found: [], log: [] });
export const flavourOf = (s: Pick<GameState, 'origin'>): Flavour => FLAVOURS[(s.origin ?? 'settlers') as OriginId] ?? FLAVOURS.settlers;
export const magicOpen = (s: Pick<GameState, 'research'>) => s.research.done.includes(LEY_LORE);
export const schoolKnown = (s: Pick<GameState, 'research'>, school: SchoolId) => s.research.done.includes(SCHOOLS[school].topic);
const done = (s: GameState, def: string) => s.buildings.filter((b) => b.def === def && b.status === 'done');

/* ------------------------------------------------------------ the leylines */

export interface Ley {
  /** Each line from end to end, in cells. */
  lines: [number, number, number, number][];
  /** Where lines cross on the land (cells). */
  wells: { x: number; y: number }[];
  /** The land's own strength (by its biome). */
  biome: number;
}

const leyCache = new Map<string, Ley>();
/** The land's leylines, from the seed (the same on every screen and after a reload). */
export function leyOf(s: Pick<GameState, 'seed' | 'land' | 'biome'>): Ley {
  const { w, h, camp } = s.land;
  const key = `${s.seed}:${w}:${h}:${camp.x}:${camp.y}:${s.biome ?? ''}`;
  const hit = leyCache.get(key);
  if (hit) return hit;
  const g = new Rng(hashSeed(`${s.seed}:magic-ley`));
  const lines: Ley['lines'] = [];
  const far = Math.max(w, h) * 2;
  for (let i = 0; i < LEY_LINES; i++) {
    const a = g.next() * Math.PI;
    const near = i === 0 ? LEY_NEAR_CAMP : Math.max(w, h) * 0.3;
    const px = camp.x + (g.next() * 2 - 1) * near;
    const py = camp.y + (g.next() * 2 - 1) * near;
    const dx = Math.cos(a), dy = Math.sin(a);
    lines.push([px - dx * far, py - dy * far, px + dx * far, py + dy * far]);
  }
  const wells: Ley['wells'] = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = cross(lines[i], lines[j]);
      if (p && p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) wells.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
  const ley = { lines, wells, biome: LEY_BIOME[s.biome ?? 'forest'] ?? 1 };
  if (leyCache.size > 20) leyCache.clear();
  leyCache.set(key, ley);
  return ley;
}

function cross(a: Ley['lines'][number], b: Ley['lines'][number]): { x: number; y: number } | null {
  const [x1, y1, x2, y2] = a;
  const [x3, y3, x4, y4] = b;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

const lineDist = ([x1, y1, x2, y2]: Ley['lines'][number], x: number, y: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
};

/** The leylines' power at a cell: about 1 on a line, more at a well, nothing far from them; times the land's. */
export function leyAt(s: Pick<GameState, 'seed' | 'land' | 'biome'>, x: number, y: number): number {
  const ley = leyOf(s);
  let n = 0;
  for (const l of ley.lines) n += Math.max(0, 1 - lineDist(l, x, y) / LEY_HALF);
  for (const w of ley.wells) n += WELL_POWER * Math.max(0, 1 - Math.hypot(w.x - x, w.y - y) / WELL_R);
  return Math.round(n * ley.biome * 100) / 100;
}
const leyOfBuilding = (s: GameState, b: Building) => {
  const c = buildingCentre(b);
  return leyAt(s, Math.floor(c.x / CELL), Math.floor(c.y / CELL));
};

/** An hour's mana back for everyone short of it who isn't in a fight: more on a leyline (sim/mana.ts). */
export function manaHourly(s: GameState): void {
  for (const p of s.people) {
    if (p.mana === undefined || p.away !== null || (s.raid?.phase === 'active' && !p.downed)) continue;
    manaRest(p, leyAt(s, Math.floor(p.x / CELL), Math.floor(p.y / CELL)));
  }
}

/* ------------------------------------------------------------ casters */

/** Whether a calling casts spells (data/spells.ts SPELLCASTERS). */
export const castsSpells = (cls: ClassId | null | undefined) => !!cls && SPELLCASTERS.has(cls);
/** The town's casters at home and fit to work magic. */
export function castersHere(s: GameState): Person[] {
  return s.people.filter((p) => castsSpells(p.cls) && p.away === null && !p.downed && !isChild(p) && !(p.arcana?.locked && p.arcana.locked > s.tick));
}
const arcanaOf = (p: Person): Arcana => (p.arcana ??= { spells: [], practice: 0, madness: 0, rites: 0, miscasts: 0 });
/** Practice made mastery: a share off every miscast. */
export const masteryOf = (p: Pick<Person, 'arcana'>) => Math.min(MASTERY_MAX, (p.arcana?.practice ?? 0) / ((p.arcana?.practice ?? 0) + MASTERY_HALF));
/** Every spell someone knows: their calling's, and those learned by study. */
export function allSpells(p: Pick<Person, 'cls' | 'level' | 'arcana'>): SpellDef[] {
  const own = spellsKnown(p.cls, levelOf(p));
  const learned = (p.arcana?.spells ?? []).map((id) => SPELL_BY_ID[id]).filter((d): d is SpellDef => !!d && !own.includes(d));
  return [...own, ...learned];
}
/** The spells studied (data/spells.ts), for the fight's kit (sim/actions.ts). */
export const learnedSpells = (p: { arcana?: Arcana }): SpellDef[] => (p.arcana?.spells ?? []).map((id) => SPELL_BY_ID[id]).filter((d): d is SpellDef => !!d);
/** How many of a school's spells someone knows. */
export const schoolSpells = (p: Pick<Person, 'cls' | 'level' | 'arcana'>, school: SchoolId) => {
  const known = new Set(allSpells(p).map((d) => d.id));
  return SCHOOL_SPELLS[school].filter((id) => known.has(id)).length;
};
/** A focus carried steadies the rites: a share off the miscast chance. */
const steadiness = (p: Person) => {
  const id = p.gear.charm;
  return id && (FOCI.includes(id) || ENCHANTED.includes(id) || CURSED.includes(id)) ? Math.min(0.5, (ITEM_BY_ID[id]?.effects.power ?? 0) * FOCUS_STEADY) : 0;
};

/** The next spell a caster would study: the most advanced of the town's schools they can reach and don't know. */
export function nextStudy(s: GameState, p: Person): string | null {
  const known = new Set(allSpells(p).map((d) => d.id));
  const shuns = flavourOf(s).shuns;
  const reach = levelOf(p) + STUDY_AHEAD;
  let best: SpellDef | null = null;
  for (const school of SCHOOL_IDS) {
    if (school === shuns || !schoolKnown(s, school)) continue;
    // (the Forbidden Arts tempt only those already marked by them: a witch, a necromancer, or the mad)
    if (school === 'forbidden' && !(p.cls === 'witch' || p.cls === 'necromancer' || (p.arcana?.madness ?? 0) >= 0.5 || flavourOf(s).favoured.includes('forbidden'))) continue;
    for (const id of SCHOOL_SPELLS[school]) {
      const d = SPELL_BY_ID[id];
      if (!d || known.has(id) || d.level > reach) continue;
      if (!best || d.level > best.level || (d.level === best.level && d.id < best.id)) best = d;
    }
  }
  return best?.id ?? null;
}
const schoolOfSpell = (id: string): SchoolId | undefined => SCHOOL_IDS.find((k) => SCHOOL_SPELLS[k].includes(id));

/** An hour of study for each caster at home: a spell learned when the hours are in. */
export function studyHourly(s: GameState): void {
  const library = done(s, ARCANE_LIBRARY).length > 0;
  const tower = done(s, MAGE_TOWER).length > 0;
  const fl = flavourOf(s);
  for (const p of castersHere(s)) {
    const a = arcanaOf(p);
    if (!a.study || !SPELL_BY_ID[a.study.spell] || allSpells(p).some((d) => d.id === a.study!.spell)) {
      const next = nextStudy(s, p);
      if (!next) {
        delete a.study;
        continue;
      }
      a.study = { spell: next, hours: 0 };
    }
    const school = schoolOfSpell(a.study.spell);
    const int = Math.max(0, attributesOf(p).int - ATTR_BASE);
    const rate = (library ? STUDY_LIBRARY : tower ? STUDY_TOWER : 1) * (school && (s.items[`tome_${school}`] ?? 0) > 0 ? STUDY_TOME : 1) * (1 + int * STUDY_INT) * (school && fl.favoured.includes(school) ? FAVOURED : 1);
    a.study.hours += rate;
    const need = SPELL_BY_ID[a.study.spell].level * STUDY_PER_LEVEL;
    if (a.study.hours >= need) {
      const d = SPELL_BY_ID[a.study.spell];
      a.spells.push(d.id);
      a.practice += PRACTICE_SPELL;
      delete a.study;
      notify(s, `${p.name} has learned ${d.name}${school ? ` (${SCHOOLS[school].name})` : ''}.`);
    }
  }
}

/* ------------------------------------------------------------ mana */

export function manaCap(s: GameState): number {
  return MANA_CAP + done(s, MAGE_TOWER).length * MANA_CAP_TOWER + done(s, ARCANE_LIBRARY).length * MANA_CAP_LIBRARY;
}

/** Mana gathered this hour: the towers by the ley under each, and each caster at home. */
export function manaPerHour(s: GameState): number {
  const fl = flavourOf(s);
  const hour = calendar(s.tick).hour;
  const night = hour >= 20 || hour < 5;
  let n = 0;
  for (const b of done(s, MAGE_TOWER)) n += TOWER_MANA * (TOWER_BASE + leyOfBuilding(s, b));
  n += castersHere(s).length * CASTER_MANA;
  // (the Leyheart's bearer: the tower drinks deeper while they live)
  if (s.people.some((p) => p.gear.charm === 'leyheart')) n *= 1.25;
  return n * fl.gather * (night && fl.night ? fl.night : 1);
}

/* ------------------------------------------------------------ the hour */

/** Each hour: mana gathered, study, the wild magic settling or surging, servants fed, curses and madness, one rite;
 *  and every tick of a raid's warning, the rites against it. */
export function magicHourly(s: GameState): void {
  // (spent mana comes back out of a fight, the autopilot or no: sim/mana.ts)
  if (s.tick % TICKS_PER_HOUR === 0) manaHourly(s);
  if (s.autopilot === false) return;
  // (a raid's warning is minutes long: the rites against it are looked to every tick while it lasts)
  if (s.raid?.phase === 'warning' && !s.raid.veil && s.magic && magicOpen(s)) raidRites(s, s.magic);
  if (s.tick % TICKS_PER_HOUR !== 0 || !magicOpen(s)) return;
  const m = magicOf(s);
  const g = roll(s);
  placeTower(s);
  // mana
  m.mana = Math.min(manaCap(s), m.mana + manaPerHour(s));
  // the wild magic: settles, and a tower on a strong line stirs it
  m.flux = Math.max(0, m.flux * (1 - FLUX_SETTLES) - 0.002);
  for (const b of done(s, MAGE_TOWER)) m.flux += FLUX_LEY * Math.max(0, leyOfBuilding(s, b) - 1);
  studyHourly(s);
  servantsHourly(s, m, g);
  cursesHourly(s, m);
  madnessHourly(s, m);
  focusCasters(s);
  wantTomes(s);
  masterworks(s, m);
  ritesHourly(s, m, g);
  if (m.flux >= SURGE_AT) surge(s, m, g);
}

/** The Mage Tower stands where the ley runs strongest near the town: the town lays it itself, once it knows how. */
function placeTower(s: GameState): void {
  if (!s.townBuilds) return; // (the founder orders the tower; the town picks the ley)
  // (looked to every six hours: the queue may be full, and the planner may lay one first)
  if (calendar(s.tick).hour % 6 !== 0 || s.buildings.some((b) => b.def === MAGE_TOWER)) return;
  // (never in the way of the town's homes and food: a few hands first, and a spare slot in the queue)
  if (s.people.filter((p) => !isChild(p)).length < TOWER_PEOPLE || blueprintCount(s) >= buildSlots(s) - 1) return;
  const c = campCell(s);
  const r = Math.min(30, townRadius(s) + 6);
  let best: { x: number; y: number; v: number } | null = null;
  for (let y = c.y - r; y <= c.y + r; y += 1)
    for (let x = c.x - r; x <= c.x + r; x += 1) {
      const v = leyAt(s, x + 1, y + 1) - Math.hypot(x - c.x, y - c.y) * 0.03;
      if (best && v <= best.v) continue;
      best = { x, y, v };
    }
  // the strongest spot first, then outward from it until one fits
  if (!best) return;
  for (let k = 0; k <= 8; k++)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -k; dx <= k; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
        const x = best.x + dx, y = best.y + dy;
        if (placeBlueprint(s, MAGE_TOWER, x, y).ok) {
          note(magicOf(s), `The Mage Tower was laid out on the leyline.`);
          return;
        }
      }
}

/** Foci go to the casters who have none (the best first). */
function focusCasters(s: GameState): void {
  for (const id of [...FOCI].reverse()) {
    if (!(s.items[id] > 0)) continue;
    const who = s.people.filter((p) => castsSpells(p.cls) && p.away === null && (!p.gear.charm || (FOCI.includes(p.gear.charm) && FOCI.indexOf(p.gear.charm) < FOCI.indexOf(id)))).sort((a, b) => levelOf(b) - levelOf(a) || a.id - b.id)[0];
    if (who) equip(s, who, 'charm', id);
  }
}

/** The library writes a tome for each school the town has learned (one of each). */
function wantTomes(s: GameState): void {
  if (!done(s, ARCANE_LIBRARY).length) return;
  for (const school of SCHOOL_IDS) {
    const id = `tome_${school}`;
    if (!schoolKnown(s, school) || (s.items[id] ?? 0) > 0 || s.crafting.some((o) => o.item === id)) continue;
    if (queueCraft(s, id).ok) return;
  }
  // a focus for a caster who has none, one order at a time
  if (!done(s, MAGE_TOWER).length || s.crafting.some((o) => FOCI.includes(o.item))) return;
  const bare = s.people.filter((p) => castsSpells(p.cls) && !p.gear.charm).length - FOCI.reduce((n, id) => n + (s.items[id] ?? 0), 0);
  if (bare <= 0) return;
  for (const id of [...FOCI].reverse()) if (queueCraft(s, id).ok) return;
}

/** A master mage (`MASTER_SPELLS` learned) makes their masterwork once: an enchanted charm the world has one of. */
function masterworks(s: GameState, m: MagicState): void {
  for (const p of castersHere(s)) {
    const a = p.arcana;
    if (!a || a.master || a.spells.length < MASTER_SPELLS) continue;
    const id = ENCHANTED.find((x) => !m.found.includes(x));
    a.master = true;
    if (!id) continue;
    m.found.push(id);
    s.items[id] = (s.items[id] ?? 0) + 1;
    note(m, `${p.name}'s masterwork: ${ITEM_BY_ID[id].name}.`);
    notify(s, `${p.name} has made their masterwork: ${ITEM_BY_ID[id].name}!`, true);
  }
}

/* ------------------------------------------------------------ servants */

function servantsHourly(s: GameState, m: MagicState, g: Rng): void {
  if (!m.servants) return;
  const upkeep = m.servants * SERVANT_UPKEEP;
  if (m.mana >= upkeep) {
    m.mana -= upkeep;
    m.fetched = (m.fetched ?? 0) + m.servants * SERVANT_FETCH;
    if (m.fetched >= 2) {
      const n = Math.floor(m.fetched / 2);
      m.fetched -= n * 2;
      depositNear(s, campCell(s), { wood: n, stone: n });
    }
    return;
  }
  // starved: one turns on the town and is gone
  m.servants--;
  const fl = flavourOf(s);
  const here = s.people.filter((p) => p.away === null && !p.downed);
  const victim = here.length ? g.pick(here) : null;
  if (victim) {
    woundPerson(s, victim, maxHp(victim) * SERVANT_TURNS, 'bruise', g);
    victim.hp -= maxHp(victim) * SERVANT_TURNS;
    if (victim.hp <= 0 && s.people.includes(victim)) {
      killPerson(s, victim, `killed by a starving servant`);
      m.deaths++;
    }
  }
  const line = `Starved of ${fl.mana}, one of the ${fl.servants} turned${victim ? ` on ${victim.name}` : ''} and broke apart.`;
  note(m, line);
  notify(s, line, true);
}

/* ------------------------------------------------------------ curses and madness */

function cursesHourly(s: GameState, m: MagicState): void {
  for (const p of s.people) {
    const id = p.gear.charm;
    if (!id || !CURSED.includes(id) || p.away !== null) continue;
    arcanaOf(p).madness += CURSE_MADNESS;
    if (tireless(p)) continue;
    p.hp = Math.max(1, p.hp - maxHp(p) * CURSE_DRAIN);
  }
  void m;
}

function madnessHourly(s: GameState, m: MagicState): void {
  for (const p of s.people) {
    const a = p.arcana;
    if (!a) continue;
    if (castsSpells(p.cls) && m.flux > 0.6) a.madness += MAD_FLUX;
    a.madness = Math.max(0, a.madness - MAD_SETTLES);
    if (a.madness >= MAD_AT && !a.asked && p.away === null) askMadness(s, p);
  }
}

/** A mage gone mad is put to the town. */
export function askMadness(s: GameState, p: Person): void {
  const a = arcanaOf(p);
  a.asked = true;
  const main = p.id === s.mainId;
  const options = ['Lock them in the tower', 'Let them work on', ...(main ? [] : ['Send them away'])];
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'ways',
    ways: { system: 'magic', about: 'mad', id: p.id },
    expedition: null,
    title: `${p.name} hears voices`,
    text: `${p.name} has not slept in days. They talk to the leylines, and the leylines answer. What is to be done?`,
    story: `${p.name} has been at the tower too long. Their hands shake; their eyes don't. They talk to the leylines, and the leylines answer. Locked away they may come back to themselves. Let be, they may yet be brilliant, or they may turn on someone. Sent away, the town loses a mage, and keeps its sleep.`,
    options,
    defaultOption: 0,
    recommended: 0,
    why: 'Rest heals most minds.',
    who: p.id,
    expiresTick: s.tick + 12 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${p.name} has been driven mad by magic!`, true);
}

/** The answer to a mad mage (heritage.ts answerWays, system 'magic'). */
export function answerMagic(s: GameState, prompt: Prompt, option: number): void {
  const p = s.people.find((q) => q.id === prompt.ways?.id);
  if (!p) return;
  const a = arcanaOf(p);
  const m = magicOf(s);
  a.asked = false;
  const choice = prompt.options[option] ?? '';
  if (choice.startsWith('Lock')) {
    a.locked = s.tick + LOCK_DAYS * TICKS_PER_DAY;
    a.madness = 0.4;
    delete a.study;
    note(m, `${p.name} was locked in the tower to rest.`);
    orderPush(s, 0.5, 'a mad mage locked away');
    notify(s, `${p.name} is locked in the tower for ${LOCK_DAYS} days.`);
    return;
  }
  if (choice.startsWith('Send')) {
    s.people = s.people.filter((q) => q !== p);
    assignBeds(s);
    note(m, `${p.name} was sent away, mad.`);
    alignPush(s, -1, 'a mad mage cast out');
    notify(s, `${p.name} walked out of the town, talking to the leylines.`, true);
    return;
  }
  // let them work on
  a.madness = 0.8;
  const g = roll(s, 'mad', p.id);
  const others = s.people.filter((q) => q !== p && q.away === null && q.id !== s.mainId && !q.downed);
  if (others.length && g.chance(MAD_TURNS)) {
    const victim = g.pick(others);
    note(m, `${p.name}, mad, turned their magic on ${victim.name}.`);
    notify(s, `${p.name}'s madness broke loose: ${victim.name} is dead.`, true);
    castSpellFx(s, 'magic:mad', { x: p.x, y: p.y, id: p.id }, [{ x: victim.x, y: victim.y, id: victim.id }]);
    killPerson(s, victim, `killed by ${p.name}'s mad magic`);
    m.deaths++;
    alignPush(s, -2, 'a mad mage');
    return;
  }
  note(m, `${p.name} worked on through the madness.`);
}

/* ------------------------------------------------------------ the rites */

/** The caster best at a rite: of those at home who may, the most practised in its school. */
function riteCaster(s: GameState, school: SchoolId): Person | null {
  if (flavourOf(s).shuns === school || !schoolKnown(s, school)) return null;
  const ok = castersHere(s).filter((p) => school !== 'forbidden' || p.cls === 'witch' || p.cls === 'necromancer' || schoolSpells(p, 'forbidden') > 0);
  ok.sort((a, b) => schoolSpells(b, school) + masteryOf(b) * 5 + levelOf(b) * 0.1 - (schoolSpells(a, school) + masteryOf(a) * 5 + levelOf(a) * 0.1) || a.id - b.id);
  return ok[0] ?? null;
}

/** How strong a rite is in a caster's hands: by the spells of its school they know, their people's knack. */
export function potency(s: GameState, p: Person, school: SchoolId): number {
  return (1 + POTENCY_PER_SPELL * schoolSpells(p, school)) * (flavourOf(s).favoured.includes(school) ? FAVOURED : 1);
}

/** The chance a rite goes wrong in someone's hands, with the wild magic as it is. */
export function miscastChance(s: GameState, p: Person, rite: RiteId): number {
  const m = magicOf(s);
  return RITES[rite].danger * (1 + 2 * m.flux) * (1 - masteryOf(p)) * (1 - steadiness(p)) * (1 + (p.arcana?.madness ?? 0));
}

interface Want {
  rite: RiteId;
  /** What it does (told in the news), cast. */
  cast: (p: Person, k: number) => string | null;
}

/** The rites the town wants now, in order (`RITE_ORDER`). */
function wanted(s: GameState, m: MagicState): Want[] {
  const raid = s.raid;
  const out: Want[] = [];
  for (const id of RITE_ORDER) {
    switch (id) {
      case 'ward':
        if (raid && raid.phase === 'warning' && m.warded !== raid.id && raid.raiders.some((r) => !r.ally && r.hp > 0)) out.push({ rite: id, cast: (_p, k) => ward(s, m, k) });
        break;
      case 'firestorm':
        if (raid && raid.phase === 'warning' && m.stormed !== raid.id && raid.raiders.some((r) => !r.ally && r.hp > 0)) out.push({ rite: id, cast: (_p, k) => firestorm(s, m, k) });
        break;
      case 'foresight':
        if (raid && raid.phase === 'warning' && m.foreseen !== raid.id) out.push({ rite: id, cast: () => foresee(s, m) });
        else if (!raid && s.nextRaidTick - s.tick <= OMEN_HOURS * TICKS_PER_HOUR && s.nextRaidTick > s.tick && m.omen !== s.nextRaidTick) out.push({ rite: id, cast: () => omen(s, m) });
        break;
      case 'mending':
        if (hurt(s).length) out.push({ rite: id, cast: (_p, k) => mend(s, k) });
        break;
      case 'uncurse':
        if (s.people.some((p) => p.gear.charm && CURSED.includes(p.gear.charm))) out.push({ rite: id, cast: () => uncurse(s, m) });
        break;
      case 'rain':
        if ((s.doom?.kind === 'drought' && s.doom.phase === 'active') || s.disaster?.kind === 'wildfire') out.push({ rite: id, cast: () => rain(s) });
        break;
      case 'blood_rite':
        // (a hamlet has no blood to spare: a prisoner, or a town of a few grown-ups)
        if (m.mana < manaCap(s) * BLOOD_WHEN && (s.prisoners.length > 0 || s.people.filter((q) => !isChild(q)).length >= TOWER_PEOPLE)) out.push({ rite: id, cast: (p) => bloodRite(s, m, p) });
        break;
      case 'scrying':
        if (unmapped(s)) out.push({ rite: id, cast: () => scry(s) });
        break;
      case 'animate':
        if (m.servants < SERVANTS_MOST + done(s, MAGE_TOWER).length && m.mana >= manaCap(s) * 0.5) out.push({ rite: id, cast: () => animate(s, m) });
        break;
      case 'enchant':
        if (!(m.enchanted && m.enchanted > s.tick) && m.mana >= manaCap(s) * 0.4) out.push({ rite: id, cast: () => enchant(s, m) });
        break;
    }
  }
  return out;
}

const RAID_RITES: readonly RiteId[] = ['ward', 'firestorm', 'foresight'];
/** A raid on its way: each rite against it once, as the town can afford them (beside the hour's one rite). */
function raidRites(s: GameState, m: MagicState): void {
  const raid = s.raid!;
  if (m.warded === raid.id && m.stormed === raid.id && m.foreseen === raid.id) return;
  for (const w of wanted(s, m)) {
    if (!RAID_RITES.includes(w.rite)) continue;
    const def = RITES[w.rite];
    if ((m.ready[w.rite] ?? 0) > s.tick || m.mana < def.mana) continue;
    const p = riteCaster(s, def.school);
    if (p) castRite(s, m, p, w, roll(s, 'raid', w.rite));
  }
}

/** One rite an hour: the first wanted that the town can afford and has a caster for. */
function ritesHourly(s: GameState, m: MagicState, g: Rng): void {
  for (const w of wanted(s, m)) {
    const def = RITES[w.rite];
    if ((m.ready[w.rite] ?? 0) > s.tick || m.mana < def.mana) continue;
    const p = riteCaster(s, def.school);
    if (!p) continue;
    castRite(s, m, p, w, g);
    return;
  }
}

/** A rite cast: mana spent, the wild magic stirred, practice gained; it may miscast. */
export function castRite(s: GameState, m: MagicState, p: Person, w: Want, g: Rng): void {
  const def = RITES[w.rite];
  const a = arcanaOf(p);
  m.mana -= def.mana;
  m.flux += Math.max(def.mana, 15) * FLUX_PER_MANA;
  m.ready[w.rite] = s.tick + def.cooldown * TICKS_PER_HOUR;
  m.rites++;
  a.rites++;
  a.practice += PRACTICE_RITE;
  if (def.school === 'forbidden') a.madness += MAD_FORBIDDEN;
  if (def.align) alignPush(s, def.align * (def.align < 0 ? (flavourOf(s).bloodGuilt ?? 1) : 1), `magic: ${def.name.toLowerCase()}`);
  if (def.order) orderPush(s, def.order, `magic: ${def.name.toLowerCase()}`);
  const chance = miscastChance(s, p, w.rite);
  castSpellFx(s, `magic:${w.rite}`, { x: p.x, y: p.y, id: p.id }, [], 3);
  if (g.chance(chance)) {
    miscast(s, m, p, def.name.replace(/^The /, ''), g);
    return;
  }
  const told = w.cast(p, potency(s, p, def.school));
  const said = told && told.charAt(0).toUpperCase() + told.slice(1);
  if (said) {
    note(m, `${p.name}: ${def.name}. ${said}`);
    notify(s, `${def.name}: ${said}`);
  }
}

/** A rite gone wrong. */
export function miscast(s: GameState, m: MagicState, p: Person, name: string, g: Rng): void {
  const a = arcanaOf(p);
  a.miscasts++;
  m.miscasts++;
  const [burn, mad, die, wild] = MISCAST_ODDS;
  const r = g.next();
  let line: string;
  if (r < burn) {
    woundPerson(s, p, maxHp(p) * BACKLASH, 'burn', g);
    p.hp = Math.max(1, p.hp - maxHp(p) * BACKLASH);
    line = `${p.name}'s ${name} went wrong, and the backlash burned them.`;
  } else if (r < burn + mad) {
    a.madness += MAD_MISCAST;
    line = `${p.name}'s ${name} went wrong; something looked back at them through it.`;
  } else if (r < burn + mad + die && p.id !== s.mainId) {
    line = `${p.name}'s ${name} went wrong, and tore them apart.`;
    note(m, line);
    notify(s, line, true);
    castSpellFx(s, 'magic:miscast', { x: p.x, y: p.y, id: p.id }, [{ x: p.x, y: p.y }]);
    killPerson(s, p, 'torn apart by a miscast');
    m.deaths++;
    return;
  } else if (r < burn + mad + die + wild) {
    m.flux += 0.35;
    line = `${p.name}'s ${name} ran wild: the air over the tower crackles.`;
  } else {
    line = `${p.name}'s ${name} tore the world open.`;
    if (!rift(s)) m.flux = SURGE_AT;
  }
  note(m, line);
  notify(s, line, true);
}

/** A tear into another world (sim/portals.ts), if one isn't already open. */
function rift(s: GameState): boolean {
  if ((s.portals ?? []).some((p) => p.rift)) return false;
  const open = new Set((s.portals ?? []).map((p) => p.realm));
  const realm = REALMS.find((r) => !open.has(r));
  return !!realm && !!tearRift(s, realm);
}

/* ------------------------------------------------------------ what each rite does */

function ward(s: GameState, m: MagicState, k: number): string {
  const raid = s.raid!;
  m.warded = raid.id;
  const sap = Math.min(WARD_MOST, WARD_SAP * k);
  for (const r of raid.raiders) if (!r.ally && r.hp > 0) r.hp = Math.max(1, Math.round(r.hp - r.maxHp * sap));
  return `the town is warded: the raiders come on weakened (${Math.round(sap * 100)}%).`;
}

function firestorm(s: GameState, m: MagicState, k: number): string {
  const raid = s.raid!;
  m.stormed = raid.id;
  const g = roll(s, 'storm');
  const foes = raid.raiders.filter((r) => !r.ally && r.hp > 0);
  let burned = 0;
  // (it scorches, it doesn't win the fight: whoever it touches still comes on, a raid must still be fought)
  for (let i = 0; i < STORM_HITS && foes.length; i++) {
    const r = foes.splice(g.int(0, foes.length - 1), 1)[0];
    r.hp = Math.max(1, Math.round(r.hp - r.maxHp * STORM_BURN * k));
    burned++;
  }
  return `fire fell on the raiders on the road: ${burned} of them came on burned.`;
}

function foresee(s: GameState, m: MagicState): string {
  const raid = s.raid!;
  m.foreseen = raid.id;
  raid.arrivesTick += FORESIGHT_HOURS * TICKS_PER_HOUR;
  raid.leavesTick += FORESIGHT_HOURS * TICKS_PER_HOUR;
  return `the raiders were seen far off: the town has ${FORESIGHT_HOURS} hours more to ready itself.`;
}

function omen(s: GameState, m: MagicState): string {
  m.omen = s.nextRaidTick;
  const hours = Math.max(1, Math.round((s.nextRaidTick - s.tick) / TICKS_PER_HOUR));
  return `the scryers see raiders coming, in about ${hours} hours.`;
}

const hurt = (s: GameState) => s.people.filter((p) => p.away === null && !tireless(p) && (p.downed || p.sick || p.hp < maxHp(p) * 0.6));

function mend(s: GameState, k: number): string {
  const who = hurt(s).sort((a, b) => (b.downed ? 1 : 0) - (a.downed ? 1 : 0) || a.hp / maxHp(a) - b.hp / maxHp(b)).slice(0, MEND_MOST);
  for (const p of who) {
    if (p.downed) stabilize(p);
    p.hp = Math.min(maxHp(p), p.hp + maxHp(p) * MEND_SHARE * k);
    if (p.sick && !p.sick.treated) {
      p.sick.until = s.tick + Math.max(0, p.sick.until - s.tick) / 2;
      p.sick.treated = true;
    }
  }
  return `${who.map((p) => p.name).join(', ')} mended.`;
}

function uncurse(s: GameState, m: MagicState): string {
  const p = s.people.find((q) => q.gear.charm && CURSED.includes(q.gear.charm))!;
  const id = p.gear.charm!;
  equip(s, p, 'charm', null);
  s.items[id] = Math.max(0, (s.items[id] ?? 0) - 1);
  void m;
  return `${ITEM_BY_ID[id].name} was broken, and ${p.name} is free of it.`;
}

function rain(s: GameState): string {
  if (s.doom?.kind === 'drought' && s.doom.phase === 'active') {
    s.doom.untilTick = Math.min(s.doom.untilTick, s.tick + TICKS_PER_HOUR);
    return 'clouds gathered over the tower, and the drought broke.';
  }
  if (s.disaster?.kind === 'wildfire') {
    s.disaster.until = Math.min(s.disaster.until, s.tick + TICKS_PER_HOUR);
    return 'rain came down on the wildfire.';
  }
  return 'it rained.';
}

/** A region of the world map the town hasn't mapped yet, its age reached (the nearest home first). */
function unmapped(s: GameState): string | null {
  const home = REGION_BY_ID[HOME_REGION];
  const known = new Set(s.regions ?? []);
  const r = REGIONS.filter((q) => q.id !== HOME_REGION && !known.has(q.id) && eraReached(s.era, q.era)).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0];
  return r?.id ?? null;
}

function scry(s: GameState): string {
  const id = unmapped(s)!;
  (s.regions ??= []).push(id);
  return `${REGION_BY_ID[id].name} was seen in the scrying glass, and is on the map.`;
}

function animate(s: GameState, m: MagicState): string {
  m.servants++;
  return `${flavourOf(s).servants} stir and set to fetching wood and stone (${m.servants} now).`;
}

function enchant(s: GameState, m: MagicState): string {
  m.enchanted = s.tick + ENCHANT_HOURS * TICKS_PER_HOUR;
  return `the town's tools glow: all work goes ${Math.round((ENCHANT_WORK - 1) * 100)}% faster for a day.`;
}

function bloodRite(s: GameState, m: MagicState, p: Person): string {
  const g = roll(s, 'blood');
  const prisoner = s.prisoners[0];
  let line: string;
  if (prisoner) {
    s.prisoners = s.prisoners.filter((q) => q !== prisoner);
    line = `${prisoner.name}, a prisoner, was bled dry for it.`;
  } else {
    const pool = s.people.filter((q) => q !== p && q.away === null && !q.downed && !tireless(q) && !isChild(q) && q.id !== s.mainId);
    if (!pool.length) return 'there was nobody to bleed.';
    const v = g.pick(pool);
    v.hp -= maxHp(v) * BLOOD_TAKES;
    if (v.hp <= 0) {
      killPerson(s, v, 'bled dry in a blood rite');
      m.deaths++;
      line = `${v.name} bled for it, and did not get up.`;
    } else line = `${v.name} bled for it.`;
  }
  m.mana = Math.min(manaCap(s), m.mana + BLOOD_MANA);
  // (blood leaves something behind)
  if (g.chance(0.15)) leaveCurse(s, m);
  return line;
}

/** A cursed charm left in the stores (one the world has one of). */
function leaveCurse(s: GameState, m: MagicState): void {
  const id = CURSED.find((x) => !m.found.includes(x));
  if (!id) return;
  m.found.push(id);
  s.items[id] = (s.items[id] ?? 0) + 1;
  note(m, `${ITEM_BY_ID[id].name} was found where the magic had been.`);
  notify(s, `Something was left behind: ${ITEM_BY_ID[id].name}.`, true);
}

/* ------------------------------------------------------------ the surge */

/** The wild magic surges: fire, the hurt and the dead near the tower, maybe a plague, a tear, a cursed thing. */
export function surge(s: GameState, m: MagicState, g: Rng): void {
  m.surges++;
  m.flux = SURGE_LEAVES;
  const tower = done(s, MAGE_TOWER)[0];
  const at = tower ? buildingCentre(tower) : { x: campCell(s).x * CELL, y: campCell(s).y * CELL };
  const lines: string[] = ['The wild magic surged!'];
  // fire
  const near = (x: number, y: number) => Math.hypot(x - at.x, y - at.y) <= SURGE_R * CELL;
  const burnable = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && near(buildingCentre(b).x, buildingCentre(b).y));
  const fires = Math.min(burnable.length, g.int(SURGE_FIRES[0], SURGE_FIRES[1]));
  for (let i = 0; i < fires; i++) setFire(s, burnable.splice(g.int(0, burnable.length - 1), 1)[0], true);
  if (fires) lines.push(`${fires} building${fires > 1 ? 's' : ''} caught fire.`);
  // the hurt and the dead
  let dead = 0;
  for (const p of [...s.people]) {
    if (p.away !== null || !near(p.x, p.y)) continue;
    if (p.id !== s.mainId && g.chance(SURGE_KILLS)) {
      killPerson(s, p, 'killed in a wild-magic surge');
      dead++;
      m.deaths++;
      continue;
    }
    if (g.chance(SURGE_WOUNDS)) {
      woundPerson(s, p, maxHp(p) * 0.3, 'burn', g);
      p.hp = Math.max(1, p.hp - maxHp(p) * 0.3);
    }
  }
  if (dead) lines.push(`${dead} died in it.`);
  // a magical plague
  if (!s.doom && g.chance(SURGE_PLAGUE)) {
    const pool = s.people.filter((p) => p.away === null && !tireless(p) && !p.sick);
    const n = Math.min(pool.length, g.int(2, 4));
    if (n) {
      s.doom = { kind: 'plague', phase: 'active', untilTick: s.tick + 3 * TICKS_PER_DAY };
      for (let i = 0; i < n; i++) {
        const p = pool.splice(g.int(0, pool.length - 1), 1)[0];
        p.sick = { until: s.tick + g.int(24, 60) * TICKS_PER_HOUR };
      }
      lines.push(`A grey pox came out of it: ${n} have fallen sick.`);
    }
  }
  if (g.chance(SURGE_TEAR) && rift(s)) lines.push('The world tore open.');
  if (g.chance(SURGE_CURSE)) leaveCurse(s, m);
  castSpellFx(s, 'magic:surge', { x: at.x, y: at.y }, [{ x: at.x, y: at.y }], 4);
  for (const l of lines) note(m, l);
  notify(s, lines.join(' '), true);
}

/* ------------------------------------------------------------ the rest of the town reads */

/* ------------------------------------------------------------ seen */

export interface MagicView {
  mana: number;
  cap: number;
  perHour: number;
  name: string;
  flux: number;
  servants: number;
  servantName: string;
  enchanted: boolean;
  schools: { id: SchoolId; name: string; text: string; known: boolean; shunned: boolean }[];
  casters: { id: number; name: string; spells: number; studying: string | null; progress: number; madness: number; locked: boolean; mastery: number }[];
  rites: { name: string; school: string; mana: number; readyHours: number }[];
  counts: { rites: number; miscasts: number; surges: number; deaths: number };
  log: string[];
  /** The leylines (cells), for the map's glow at night. */
  ley: { lines: [number, number, number, number][]; wells: { x: number; y: number }[] };
  towers: { x: number; y: number; ley: number }[];
}

export function magicView(s: GameState): MagicView | null {
  if (!magicOpen(s)) return null;
  const m = magicOf(s);
  const fl = flavourOf(s);
  const ley = leyOf(s);
  return {
    mana: Math.floor(m.mana),
    cap: manaCap(s),
    perHour: Math.round(manaPerHour(s) * 10) / 10,
    name: fl.mana,
    flux: Math.round(Math.min(1, m.flux / SURGE_AT) * 100) / 100,
    servants: m.servants,
    servantName: fl.servants,
    enchanted: !!m.enchanted && m.enchanted > s.tick,
    schools: SCHOOL_IDS.map((id) => ({ id, name: SCHOOLS[id].name, text: SCHOOLS[id].text, known: schoolKnown(s, id), shunned: fl.shuns === id })),
    casters: s.people
      .filter((p) => castsSpells(p.cls))
      .map((p) => ({
        id: p.id,
        name: p.name,
        spells: allSpells(p).length,
        studying: p.arcana?.study ? (SPELL_BY_ID[p.arcana.study.spell]?.name ?? null) : null,
        progress: p.arcana?.study ? Math.min(1, p.arcana.study.hours / (SPELL_BY_ID[p.arcana.study.spell]?.level ?? 1) / STUDY_PER_LEVEL) : 0,
        madness: Math.round(Math.min(1, p.arcana?.madness ?? 0) * 100) / 100,
        locked: !!p.arcana?.locked && p.arcana.locked > s.tick,
        mastery: Math.round(masteryOf(p) * 100) / 100,
      })),
    rites: RITE_ORDER.filter((id) => schoolKnown(s, RITES[id].school) && fl.shuns !== RITES[id].school).map((id) => ({ name: RITES[id].name, school: SCHOOLS[RITES[id].school].name, mana: RITES[id].mana, readyHours: Math.max(0, Math.ceil(((m.ready[id] ?? 0) - s.tick) / TICKS_PER_HOUR)) })),
    counts: { rites: m.rites, miscasts: m.miscasts, surges: m.surges, deaths: m.deaths },
    log: m.log.slice(-6).reverse(),
    ley: { lines: ley.lines, wells: ley.wells },
    towers: done(s, MAGE_TOWER).map((b) => ({ x: b.tile, y: b.row, ley: leyOfBuilding(s, b) })),
  };
}

/** A person's magic for their card: every spell they know, what they study, their madness. */
export function arcanaView(p: Person): { spells: { name: string; level: number; school: string | null; learned: boolean }[]; studying: string | null; progress: number; madness: number; mastery: number; rites: number; miscasts: number } | null {
  if (!castsSpells(p.cls)) return null;
  const learned = new Set(p.arcana?.spells ?? []);
  return {
    spells: allSpells(p)
      .sort((a, b) => a.level - b.level)
      .map((d) => ({ name: d.name, level: d.level, school: schoolOfSpell(d.id) ? SCHOOLS[schoolOfSpell(d.id)!].name : null, learned: learned.has(d.id) })),
    studying: p.arcana?.study ? (SPELL_BY_ID[p.arcana.study.spell]?.name ?? null) : null,
    progress: p.arcana?.study ? Math.min(1, p.arcana.study.hours / ((SPELL_BY_ID[p.arcana.study.spell]?.level ?? 1) * STUDY_PER_LEVEL)) : 0,
    madness: Math.round(Math.min(1, p.arcana?.madness ?? 0) * 100) / 100,
    mastery: Math.round(masteryOf(p) * 100) / 100,
    rites: p.arcana?.rites ?? 0,
    miscasts: p.arcana?.miscasts ?? 0,
  };
}
