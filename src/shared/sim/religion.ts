// Religion and the gods made real (the DLC). On top of the gods' favour of sim/faith.ts: every townsperson follows
// one of the town's four gods (or none, or a rival cult: `creedOf`, picked by who they are), with a zeal that drifts
// toward their nature's, rises at the rites and after a miracle and falls when their god turns on the town; the
// doubting lapse, the godless find a god, and a god's greater wrath splits its followers (a schism). Each dawn
// (`dawn`) every god's favour moves by its followers, by being followed by nobody, by the idols raised to it, by what
// it loves and hates in the town (`actsInNature`: a full granary or hungry mouths, a happy town or a glum one, a raid
// won or lost, parties on the roads; the rope angers the hearth god at once, `deathSeen`), by its feast day kept or
// let pass (`FEAST_DAYS`), by the priest's dawn rite and by the rival cult.
// The priests are whoever holds a place of worship (data/operators.ts): they pray there at dawn (people.ts
// `officiate`), say the words at funerals, bless the defenders when raiders are sighted and every party that sets
// out, and once a temple stands lead the faithful on pilgrimage (`PILGRIM_DEST`). A god far gone sends an omen, then
// its greater wrath (`greatWrath`: a cursed harvest, a plague, beasts sent against the town, a great storm); a god well
// pleased may work a miracle (a dying townsperson spared, a raid scattered by a storm, a famine broken), and the town
// raises it an idol. A rival cult may rise among the doubting; the town answers it (root it out, let it be, hear it
// out), zealots denounce its members to the council (a heresy trial, sim/politics.ts) and its dark rites are cruel.
// Rolls come from the town's own side stream (`religion`), never its main one; off with the autopilot.

import { BUILDING_BY_ID } from '../data/buildings';
import { DOMAINS, DOMAIN_DEFS, FAITH_HOUR, FAVOUR_MOST, SIGN_SPENDS, WORSHIP, type Domain } from '../data/gods';
import { natureOf } from '../data/natures';
import { RAID_KIND_BY_ID } from '../data/raids';
import { FOOD_VALUE } from '../data/people';
import { MAX_EXPEDITIONS, type Destination } from '../data/expeditions';
import type { Material } from '../data/materials';
import {
  BLOOD_RITES, CONVERT_CHANCE, CULT_ALTAR, CULT_CHANCE, CULT_FAVOUR, CULT_NAMES, CULT_PEOPLE, CULT_RECRUIT, CULT_RITE_DAYS, CULT_RITE_MORALE,
  CURSED_ROTS, CURSE_SPARES_DAYS, DEMAND_MOST, DEMAND_PER_HEAD, DENOUNCE_CHANCE, DOUBTING, FAITH_LINES, FAMINE_AT, FAMINE_CHANCE, FAMINE_DAYS, FEAST_DAYS, FEAST_FOOD, FEAST_KEPT, FEAST_MISSED,
  FEAST_MORALE, FOLLOWER_FAVOUR, FUNERAL_RITES_EASE, FUNERAL_RITES_FAVOUR, GOD_IDOL, GREAT_WRATH_AT, GREAT_WRATH_CHANCE, GREAT_WRATH_PEOPLE, GREAT_WRATH_SPENDS, WRATH_GAP_DAYS, HERETICAL,
  HOLY_PLACES, IDOLS_MOST, IDOL_FAVOUR, LAPSE_CHANCE, LAPSE_UNDER, MIRACLE_AT, MIRACLE_CONVERTS, MIRACLE_GAP_DAYS, NATURE_ACTS, NONE_SHARE, OMENS,
  OMEN_AT, OMEN_GAP_DAYS, ORIGIN_CULT, PILGRIM_DEST, PILGRIM_EVERY_DAYS, PILGRIM_FAVOUR, PILGRIM_PARTY, PILGRIM_PEOPLE, PILGRIM_RELIC, PLAGUE_SHARE,
  PRIEST_HOURS, PRIEST_PER_LEVEL, PRIEST_RITE, RAID_BLESSING, RAID_BLESSING_PLEASED, ROAD_BLESSING, ROAD_BLESSING_HOURS, SCHISM_SHARE, SPARE_CHANCE,
  STORM_CHANCE, STORM_HURTS, STORM_KILLS, STORM_SCATTERS, STORM_STRIKES, UNFOLLOWED, UNSPARED, ZEALOT_AT, ZEALOUS, ZEAL_DRIFT, ZEAL_MIRACLE, ZEAL_RITE,
  ZEAL_START, ZEAL_WRATH, type Creed,
} from '../data/religion';
import { Rng, hashSeed } from '../rng';
import { alignPush, orderPush } from './alignment';
import { buildingCentre, buildingDoor, defOf, depositNear, totalStock } from './buildings';
import { sicken } from './doom';
import { rolesFor, sendExpedition, takeFromStorage } from './expeditions';
import { faithOf, godOf } from './faith';
import { setFire } from './fire';
import { killPerson } from './health';
import { holderOf } from './operators';
import { findSpot } from './planner';
import { politicsOf, trial } from './politics';
import { raidBudget, startRaid } from './raids';
import { isChild } from './social';
import { askWays } from './telling';
import { campXY, castSpellFx, foodDaysFor, maxHp, notify, tireless, type Building, type Expedition, type GameState, type Person, type Prompt, type Raid, type Task } from './state';
import { calendar, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export type MiracleKind = 'spared' | 'storm' | 'famine';
type LogKind = 'feast' | 'omen' | 'wrath' | 'miracle' | 'faith' | 'cult' | 'priest' | 'pilgrim';

export interface ReligionState {
  /** When each god last sent an omen (tick). */
  omens: Partial<Record<Domain, number>>;
  /** The miracles worked, newest last. */
  miracles: { tick: number; god: Domain; kind: MiracleKind; text: string }[];
  /** What happened in the town's faith, newest first (the Faith tab). */
  log: { tick: number; kind: LogKind; text: string }[];
  /** The idols raised to the gods that worked miracles: the building, and whose. */
  idols?: { building: number; god: Domain }[];
  /** The rival cult, while it lasts; and how many have risen and fallen. */
  cult?: { name: string; leader: number; founded: number; altar?: number; lastRite?: number; tolerated?: boolean };
  cults?: number;
  /** The raid the priest last blessed the defenders against (and the storm's miracle was tried on), the last party
   *  blessed on its way (by id), and a line for the raid's recap once it's over. */
  raidSeen?: number;
  tripSeen?: number;
  recapNote?: { tick: number; text: string };
  /** The funeral the priest last said the words at (its end tick), and the raid recap counted for the war god. */
  funeralSeen?: number;
  recapSeen?: number;
  /** The pilgrimage out (an expedition id), and the day the last set out. */
  pilgrimage?: number;
  lastPilgrimage?: number;
  /** The tick the last greater wrath (any god's) fell: the next waits `WRATH_GAP_DAYS`. */
  lastWrath?: number;
}

const LOG_KEPT = 16;
const MIRACLES_KEPT = 8;
const SIGNS_KEPT = 8;
const CULT_HOUR = 23;
const PILGRIM_HOUR = 9;
const clampF = (v: number) => Math.max(-FAVOUR_MOST, Math.min(FAVOUR_MOST, v));
const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const dayOf = (tick: number) => Math.floor(tick / TICKS_PER_DAY);
/** The side stream: a fresh roll for this tick and what it's about. */
const rngOf = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:religion:${s.tick}:${salt}`));
const on = (s: GameState) => s.autopilot !== false && !s.gameOver;
/** "Ada", "Ada and Bo", "Ada, Bo and Cy", "Ada, Bo, Cy and 2 more". */
const names = (list: string[]) => (list.length <= 1 ? list.join('') : list.length <= 3 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`);

export function religionOf(s: GameState): ReligionState {
  return (s.religion ??= { omens: {}, miracles: [], log: [] });
}

function log(s: GameState, kind: LogKind, text: string, key = true): void {
  const rel = religionOf(s);
  rel.log.unshift({ tick: s.tick, kind, text });
  if (rel.log.length > LOG_KEPT) rel.log.length = LOG_KEPT;
  notify(s, text, key);
}

/* ------------------------------------------------------------ who believes what */

/** The creed and zeal someone would come with, by who they are (pure: nothing is kept). A child takes a parent's. */
export function pickCreed(s: GameState, p: Person): { creed: Creed; zeal: number } {
  const parent = p.parents?.map((id) => s.people.find((q) => q.id === id)).find((q) => q?.creed && q.creed !== 'cult');
  if (parent?.creed) return { creed: parent.creed, zeal: clamp100((parent.zeal ?? 40) - 10) };
  const n = natureOf(p).id;
  const r = new Rng(hashSeed(`${s.seed}:religion:creed:${p.id}`));
  if (r.chance(NONE_SHARE[n] ?? 0.08)) return { creed: 'none', zeal: 0 };
  // (the god of what they're best at: the field, the hearth and the sickbed, the fight, else the sky's fortune)
  const k = p.skills;
  const lean: Record<Domain, number> = {
    harvest: k.farming.level + k.gathering.level * 0.6 + k.animals.level * 0.5,
    hearth: k.cooking.level + k.medicine.level + k.social.level * 0.4,
    war: k.melee.level + k.ranged.level,
    sky: k.research.level * 0.6 + k.crafting.level * 0.4 + 1.5,
  };
  const creed = r.chance(0.7) ? [...DOMAINS].sort((a, b) => lean[b] - lean[a] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b))[0] : r.pick(DOMAINS);
  return { creed, zeal: clamp100(ZEAL_START[n] + r.int(-10, 10)) };
}

/** Someone's creed, kept from the first dawn they're in town (sim only: views use `seenCreed`). */
export function creedOf(s: GameState, p: Person): Creed {
  if (!p.creed) {
    const c = pickCreed(s, p);
    p.creed = c.creed;
    p.zeal = c.zeal;
  }
  return p.creed;
}
/** Someone's creed as the menus see it (never changes the town). */
export const seenCreed = (s: GameState, p: Person): { creed: Creed; zeal: number } => (p.creed ? { creed: p.creed, zeal: p.zeal ?? 0 } : pickCreed(s, p));
const zealOf = (p: Person) => p.zeal ?? 0;
const godly = (c: Creed | undefined): c is Domain => !!c && c !== 'none' && c !== 'cult';
export const isZealot = (p: Pick<Person, 'id' | 'nature' | 'creed' | 'zeal'>) => godly(p.creed) && (p.zeal ?? 0) >= ZEALOT_AT && ZEALOUS.includes(natureOf(p).id);

/** Where someone stands, in a word (the People tab, the diary). */
export function standingOf(s: GameState, p: Person): 'zealot' | 'devout' | 'follower' | 'doubter' | 'none' | 'cult' {
  const c = seenCreed(s, p);
  if (c.creed === 'none' || c.creed === 'cult') return c.creed;
  if (c.zeal >= ZEALOT_AT && ZEALOUS.includes(natureOf(p).id)) return 'zealot';
  return c.zeal >= 55 ? 'devout' : c.zeal >= 25 ? 'follower' : 'doubter';
}
/** "Follows Ceres (a zealot)", "Follows no god", "Of the cult of the Pale Eye". */
export function creedLine(s: GameState, p: Person): string {
  const c = seenCreed(s, p).creed;
  if (c === 'none') return 'Follows no god';
  if (c === 'cult') return `Of the cult of ${s.religion?.cult?.name ?? 'a fallen cult'}`;
  const st = standingOf(s, p);
  return `Follows ${godOf(s, c)[0]}${st === 'zealot' ? ' (a zealot)' : st === 'devout' ? ' (devout)' : st === 'doubter' ? ' (doubting)' : ''}`;
}

/** A line for someone's diary today about their faith, or none (pure). */
export function faithDiaryLine(s: GameState, p: Person, roll: number): string | null {
  if (isChild(p) || roll >= 0.6 || s.autopilot === false) return null;
  const st = standingOf(s, p);
  const c = seenCreed(s, p).creed;
  const god = godly(c) ? godOf(s, c)[0] : '';
  const today = dayOf(s.tick);
  const miracle = s.religion?.miracles.at(-1);
  const wrath = !!god && (s.faith?.signs ?? []).some((g) => g.kind === 'wrath' && g.god === c && dayOf(g.tick) === today);
  let lines: readonly string[] = FAITH_LINES[st];
  if (wrath) lines = FAITH_LINES.wrath;
  else if (god && miracle && miracle.god === c && dayOf(miracle.tick) >= today - 1) lines = FAITH_LINES.miracle;
  return lines[Math.min(lines.length - 1, Math.floor((roll / 0.6) * lines.length))].replace(/\{god\}/g, god);
}

/* ------------------------------------------------------------ the priests */

/** The places of worship standing, the greatest first. */
const placesOf = (s: GameState) => s.buildings.filter((b) => b.status === 'done' && WORSHIP[b.def]).sort((a, b) => WORSHIP[b.def] - WORSHIP[a.def] || a.id - b.id);
/** The town's priests: those who hold a place of worship (at home and on their feet). */
export function priestsOf(s: GameState): { priest: Person; place: Building }[] {
  const out: { priest: Person; place: Building }[] = [];
  for (const b of placesOf(s)) {
    const p = holderOf(s, b);
    if (p) out.push({ priest: p, place: b });
  }
  return out;
}
const firstPriest = (s: GameState) => priestsOf(s)[0];

/** A priest's dawn duty (people.ts): at their place of worship for `PRIEST_HOURS` from the hour of the offering. */
export function priestDuty(s: GameState, p: Person): Task | null {
  if (s.autopilot === false || s.raid) return null;
  const h = calendar(s.tick).hour;
  if (h < FAITH_HOUR || h >= FAITH_HOUR + PRIEST_HOURS) return null;
  const b = s.buildings.find((q) => q.operator === p.id && q.status === 'done' && WORSHIP[q.def]);
  return b ? { type: 'officiate', building: b.id } : null;
}
/** Still at their dawn duty at this place? */
export function officiating(s: GameState, p: Person, building: number): boolean {
  const t = priestDuty(s, p);
  return t?.type === 'officiate' && t.building === building;
}
/** Where a priest stands at their altar: before its door, a little to one side by their id. */
export function altarSpot(b: Building, p: Person): { x: number; y: number } {
  const d = buildingDoor(b);
  return { x: d.x + ((p.id % 3) - 1) * 10, y: d.y + 14 };
}

/* ------------------------------------------------------------ the day's reckoning */

/** Hourly from sim.ts: the priest at a funeral, the dawn's reckoning, a pilgrimage, the cult's night. */
export function religionHourly(s: GameState): void {
  if (!on(s) || s.tick === 0 || s.tick % TICKS_PER_HOUR !== 0) return;
  if (!s.people.some((p) => p.away === null)) return;
  const hour = calendar(s.tick).hour;
  funeralRites(s);
  if (hour === FAITH_HOUR) dawn(s);
  if (hour === PILGRIM_HOUR) pilgrimage(s);
  if (hour === CULT_HOUR) cultNight(s);
}

function dawn(s: GameState): void {
  const rel = religionOf(s);
  const f = faithOf(s);
  const rng = rngOf(s, 'dawn');
  for (const p of s.people) creedOf(s, p);
  const home = s.people.filter((p) => p.away === null);
  const grown = home.filter((p) => !isChild(p));
  // the zeal of each: the nature pulls it home, a rite kept this morning lifts it
  const rite = f.lastRite === dayOf(s.tick);
  for (const p of home) {
    if (!godly(p.creed)) continue;
    const want = ZEAL_START[natureOf(p).id];
    const z = zealOf(p);
    p.zeal = clamp100(z + Math.sign(want - z) * Math.min(Math.abs(want - z), ZEAL_DRIFT) + (rite ? ZEAL_RITE : 0));
  }
  // the doubting lapse, the godless find a god (the best pleased)
  const pleased = [...DOMAINS].sort((a, b) => f.favour[b] - f.favour[a])[0];
  for (const p of grown) {
    const n = natureOf(p).id;
    if (godly(p.creed) && zealOf(p) < LAPSE_UNDER && DOUBTING.includes(n) && rng.chance(LAPSE_CHANCE)) {
      log(s, 'faith', `${p.name} has lost faith in ${godOf(s, p.creed)[0]}.`, false);
      p.creed = 'none';
      p.zeal = 0;
    } else if (p.creed === 'none' && !DOUBTING.includes(n) && rng.chance(CONVERT_CHANCE)) {
      p.creed = pleased;
      p.zeal = 30;
      log(s, 'faith', `${p.name} has found faith in ${godOf(s, pleased)[0]}.`, false);
    }
  }
  // the gods' favour: followers, the unfollowed, idols, their own natures and the cult
  const follow: Record<Domain, number> = { harvest: 0, hearth: 0, war: 0, sky: 0 };
  for (const p of home) if (godly(p.creed)) follow[p.creed] += (FOLLOWER_FAVOUR * zealOf(p)) / 50;
  const cultists = home.filter((p) => p.creed === 'cult').length;
  const acts = actsInNature(s);
  const idols = (rel.idols ??= []).filter((i) => s.buildings.some((b) => b.id === i.building));
  rel.idols = idols;
  // (the gods' demands, and their jealousy of each other, start once there's somewhere to worship them: before that
  // sim/faith.ts's own neglect is enough for a camp)
  const worshipped = placesOf(s).length > 0;
  const demand = worshipped ? Math.min(DEMAND_MOST, home.length * DEMAND_PER_HEAD) : 0;
  for (const d of DOMAINS) {
    let v = f.favour[d] + follow[d] + acts[d] - demand - cultists * CULT_FAVOUR + idols.filter((i) => i.god === d).length * IDOL_FAVOUR;
    if (worshipped && !home.some((p) => p.creed === d)) v -= UNFOLLOWED;
    f.favour[d] = clampF(v);
  }
  priestRite(s);
  feastDay(s);
  // the wrathful: an omen first, then the worst (one a dawn)
  for (const d of [...DOMAINS].sort((a, b) => f.favour[a] - f.favour[b])) {
    const v = f.favour[d];
    if (v > OMEN_AT) break;
    const last = rel.omens[d];
    // (a camp too small, or a starving town for the harvest god, is spared the worst: its omens still come)
    const spared = home.length < GREAT_WRATH_PEOPLE || (d === 'harvest' && home.some((p) => p.starving));
    if (v <= GREAT_WRATH_AT && last !== undefined && !spared && wrathReady(s) && rng.chance(GREAT_WRATH_CHANCE)) {
      greatWrath(s, d, rng);
      break;
    }
    // (an omen warns of the greater wrath: a camp too small for it gets none)
    if (home.length >= GREAT_WRATH_PEOPLE && (last === undefined || s.tick - last >= OMEN_GAP_DAYS * TICKS_PER_DAY)) {
      rel.omens[d] = s.tick;
      log(s, 'omen', `An omen: ${rng.pick(OMENS[d])}. ${godOf(s, d)[0]} is angry with the town.`);
      castSpellFx(s, 'god:blight', holyPlace(s), [], 3);
    }
  }
  famineBroken(s, rng);
  cultDawn(s, rng);
}

/** What each god makes of the town today, in its own nature. */
export function actsInNature(s: GameState): Record<Domain, number> {
  const rel = religionOf(s);
  const out: Record<Domain, number> = { harvest: 0, hearth: 0, war: 0, sky: 0 };
  const home = s.people.filter((p) => p.away === null);
  // harvest: a full granary, or hungry mouths
  const starving = home.filter((p) => p.starving).length;
  out.harvest += (foodDays(s) >= NATURE_ACTS.harvestFullDays ? NATURE_ACTS.harvestFull : 0) + starving * NATURE_ACTS.harvestStarving;
  // hearth: the town's spirits
  const avg = home.length ? home.reduce((n, p) => n + p.morale, 0) / home.length : 50;
  out.hearth += avg >= 60 ? NATURE_ACTS.hearthHappy : avg <= 30 ? NATURE_ACTS.hearthGlum : 0;
  // war: the last raid, won or lost
  const recap = s.raidRecap;
  if (recap && recap.tick > (rel.recapSeen ?? -1)) {
    rel.recapSeen = recap.tick;
    out.war += recap.outcome === 'pillaged' ? NATURE_ACTS.warLost : NATURE_ACTS.warWon;
  }
  // sky: parties out on the roads
  out.sky += s.expeditions.length * NATURE_ACTS.skyTravel;
  return out;
}

function foodDays(s: GameState): number {
  const stock = totalStock(s);
  return foodDaysFor(s, Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0));
}

function holyPlace(s: GameState): { x: number; y: number } {
  const b = placesOf(s)[0] ?? s.buildings.find((q) => defOf(q).seat) ?? s.buildings[0];
  return b ? buildingCentre(b) : campXY(s);
}

/** The priest's dawn rite: the least pleased god soothed, the more so for a priest with a way with words. */
function priestRite(s: GameState): void {
  const pr = firstPriest(s);
  if (!pr) return;
  const f = faithOf(s);
  const d = [...DOMAINS].sort((a, b) => f.favour[a] - f.favour[b])[0];
  f.favour[d] = clampF(f.favour[d] + PRIEST_RITE + pr.priest.skills.social.level * PRIEST_PER_LEVEL);
  pr.priest.zeal = clamp100(zealOf(pr.priest) + 1);
}

/** The day of each god's feast in the season (1-based), and the days to the next one. */
export function feastIn(s: GameState, d: Domain): number {
  const c = calendar(s.tick);
  const day = FEAST_DAYS[DOMAINS.indexOf(d)];
  return day >= c.dayOfSeason ? day - c.dayOfSeason : day + DAYS_PER_SEASON - c.dayOfSeason;
}

/** A god's feast day: kept with a priest at home (food laid out, the town lifted, a cruel or a merciful rite by the
 *  people's ways), or let pass and the god slighted. */
function feastDay(s: GameState): void {
  const i = FEAST_DAYS.indexOf(calendar(s.tick).dayOfSeason);
  if (i < 0) return;
  const d = DOMAINS[i];
  const f = faithOf(s);
  const [name, title] = godOf(s, d);
  const pr = firstPriest(s);
  if (!pr) {
    if (!placesOf(s).length) return; // (a camp with no altar keeps no feasts, and no god expects it to)
    f.favour[d] = clampF(f.favour[d] + FEAST_MISSED);
    log(s, 'feast', `${name}'s feast day passes unkept: ${placesOf(s).length ? 'there is no priest to keep it' : 'there is nowhere to keep it'}. ${name} is slighted.`, false);
    return;
  }
  const home = s.people.filter((p) => p.away === null);
  const n = Math.max(1, Math.ceil(home.length * FEAST_FOOD));
  const stock = totalStock(s);
  const laid = DOMAIN_DEFS[d].offer.find((m) => m !== 'coins' && (stock[m as Material] ?? 0) >= n * 2) as Material | undefined;
  if (laid) takeFromStorage(s, laid, n);
  f.favour[d] = clampF(f.favour[d] + FEAST_KEPT + (laid ? 4 : 0));
  (s.marks ??= []).push({ lever: 'morale', value: FEAST_MORALE, until: s.tick + 14 * TICKS_PER_HOUR, text: `${name}'s feast day` });
  for (const p of home) if (p.creed === d) p.zeal = clamp100(zealOf(p) + 3);
  let how = '';
  if (d === 'war' && BLOOD_RITES.includes(s.origin ?? 'settlers')) {
    how = ' Blood is spilled on the altar, the old way.';
    alignPush(s, -2, 'A blood offering');
    orderPush(s, 1, 'A blood offering');
  } else if (d === 'hearth') {
    const poor = home.filter((p) => !isChild(p) && (p.coins ?? 0) < 10);
    if (poor.length && (s.coins ?? 0) >= poor.length * 3 + 20) {
      s.coins! -= poor.length * 3;
      for (const p of poor) p.coins = (p.coins ?? 0) + 3;
      how = ' Alms are given to the poor.';
      alignPush(s, 1, 'Alms on the feast day');
    }
  }
  castSpellFx(s, 'god:bless', buildingCentre(pr.place), [{ x: pr.priest.x, y: pr.priest.y, id: pr.priest.id }], 3);
  log(s, 'feast', `The town keeps the feast of ${name}, ${title}, ${pr.priest.name} at the altar${laid ? ` with ${laid} laid out` : ''}.${how}`);
}

/* ------------------------------------------------------------ wrath */

function signOf(s: GameState, d: Domain, kind: 'bless' | 'wrath', text: string): void {
  const f = faithOf(s);
  f.signs.push({ tick: s.tick, god: d, kind, text });
  if (f.signs.length > SIGNS_KEPT) f.signs.splice(0, f.signs.length - SIGNS_KEPT);
}

/** True when no greater wrath (of any god) has fallen in the last `WRATH_GAP_DAYS`: a town that angers one god is not
 *  struck by a plague, a cursed harvest and a storm in the same week. */
export const wrathReady = (s: GameState) => s.religion?.lastWrath === undefined || s.tick - s.religion.lastWrath >= WRATH_GAP_DAYS * TICKS_PER_DAY;

/** A god's greater wrath, after its omens: the worst it can do, in its own nature. Its followers falter, and some turn
 *  to a kinder god. */
export function greatWrath(s: GameState, d: Domain, rng: Rng): void {
  const [name, title] = godOf(s, d);
  const home = s.people.filter((p) => p.away === null);
  let text = '';
  if (d === 'harvest') {
    // a cursed harvest: a share of every food in store rots, and the fields sicken
    // (the plenty, not the last of it: `CURSE_SPARES_DAYS` of food are left)
    const stock = totalStock(s);
    const share = CURSED_ROTS * Math.max(0, 1 - CURSE_SPARES_DAYS / Math.max(1e-6, foodDays(s)));
    let lost = 0;
    for (const m of Object.keys(FOOD_VALUE) as Material[]) lost += takeFromStorage(s, m, Math.floor((stock[m] ?? 0) * share));
    (s.marks ??= []).push({ lever: 'crops', value: 0.5, until: s.tick + 3 * TICKS_PER_DAY, text: `${name}'s curse` });
    castSpellFx(s, 'god:blight', holyPlace(s), [], 4);
    text = `⚡ ${name}, ${title}, curses the harvest: ${lost} stores rot in the granary, and the fields sicken.`;
  } else if (d === 'hearth') {
    // a plague: a share of the town falls ill, and the frailest of them dies
    const can = home.filter((p) => !tireless(p) && !p.sick);
    const n = Math.min(can.length, Math.max(2, Math.ceil(home.length * PLAGUE_SHARE)));
    const sick: Person[] = [];
    for (let i = 0; i < n; i++) {
      const p = can.splice(rng.int(0, can.length - 1), 1)[0];
      sicken(s, p, rng);
      sick.push(p);
    }
    const frail = [...sick].sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b) || a.id - b.id)[0];
    text = `⚡ ${name}, ${title}, sends a plague: ${sick.length} fall ill${frail ? `, and ${frail.name} dies of it` : ''}.`;
    signOf(s, d, 'wrath', text);
    if (frail) killPerson(s, frail, `of ${name}'s plague`);
    return afterWrath(s, d, rng, text, false);
  } else if (d === 'war') {
    // beasts sent against the town (or, with a raid on already, the defenders' arms fail them)
    if (!s.raid) {
      startRaid(s, RAID_KIND_BY_ID.wolves, Math.max(2, raidBudget(s)), rng);
      text = `⚡ ${name}, ${title}, sends the wolves against the town!`;
    } else {
      (s.marks ??= []).push({ lever: 'fight', value: 0.7, until: s.tick + TICKS_PER_DAY, text: `${name}'s curse` });
      text = `⚡ ${name}, ${title}, curses the town's arms in the thick of the fight.`;
    }
  } else {
    // a great storm: lightning strikes the roofs and whoever is out of doors
    const struck: string[] = [];
    let dead: Person | undefined;
    for (let i = 0; i < STORM_STRIKES; i++) {
      const out = home.filter((p) => !p.downed && p.task?.type !== 'sleep' && p !== dead);
      if (out.length && rng.chance(0.5)) {
        const p = out[rng.int(0, out.length - 1)];
        castSpellFx(s, 'god:lightning', { x: p.x, y: p.y, id: p.id }, [{ x: p.x, y: p.y, id: p.id }], 2);
        if (!dead && rng.chance(STORM_KILLS)) dead = p;
        else {
          p.hp = Math.max(1, p.hp - maxHp(p) * 0.4);
          struck.push(p.name);
        }
        continue;
      }
      const roofs = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !b.room && !defOf(b).seat && b.fire === undefined);
      const b = roofs.length ? roofs[rng.int(0, roofs.length - 1)] : undefined;
      if (b) {
        castSpellFx(s, 'god:lightning', buildingCentre(b), [{ ...buildingCentre(b) }], 2);
        setFire(s, b, true);
        struck.push(`the ${defOf(b).name.toLowerCase()}`);
      }
    }
    text = `⚡ ${name}, ${title}, looses a great storm: lightning strikes ${struck.length ? struck.join(', ') : 'all round the town'}${dead ? `, and ${dead.name} is struck dead` : ''}.`;
    signOf(s, d, 'wrath', text);
    if (dead) killPerson(s, dead, `struck down by ${name}'s storm`);
    return afterWrath(s, d, rng, text, false);
  }
  signOf(s, d, 'wrath', text);
  afterWrath(s, d, rng, text, true);
}

function afterWrath(s: GameState, d: Domain, rng: Rng, text: string, say: boolean): void {
  const f = faithOf(s);
  religionOf(s).lastWrath = s.tick;
  f.favour[d] = clampF(f.favour[d] + GREAT_WRATH_SPENDS);
  if (say) log(s, 'wrath', text);
  else {
    const rel = religionOf(s);
    rel.log.unshift({ tick: s.tick, kind: 'wrath', text });
    if (rel.log.length > LOG_KEPT) rel.log.length = LOG_KEPT;
    notify(s, text, true);
  }
  // its followers falter; some turn to the best pleased god (a schism)
  const to = [...DOMAINS].filter((q) => q !== d).sort((a, b) => f.favour[b] - f.favour[a])[0];
  const turned: string[] = [];
  for (const p of s.people) {
    if (p.creed !== d) continue;
    p.zeal = clamp100(zealOf(p) - ZEAL_WRATH);
    if (!isZealot(p) && rng.chance(SCHISM_SHARE)) {
      p.creed = to;
      turned.push(p.name);
    }
  }
  if (turned.length) log(s, 'faith', `A schism: ${names(turned)} turn${turned.length === 1 ? 's' : ''} from ${godOf(s, d)[0]} to ${godOf(s, to)[0]}.`, false);
}

/* ------------------------------------------------------------ miracles */

const miracleReady = (s: GameState) => {
  const last = s.religion?.miracles.at(-1);
  return !last || s.tick - last.tick >= MIRACLE_GAP_DAYS * TICKS_PER_DAY;
};

/** A miracle worked: told in the news, kept in the annals of the faith, the doubting converted, an idol raised. */
function miracle(s: GameState, d: Domain, kind: MiracleKind, text: string): void {
  const rel = religionOf(s);
  const f = faithOf(s);
  rel.miracles.push({ tick: s.tick, god: d, kind, text });
  if (rel.miracles.length > MIRACLES_KEPT) rel.miracles.splice(0, rel.miracles.length - MIRACLES_KEPT);
  f.favour[d] = clampF(f.favour[d] - SIGN_SPENDS / 2);
  signOf(s, d, 'bless', text);
  log(s, 'miracle', text);
  const r = rngOf(s, `miracle:${kind}`);
  const seen: string[] = [];
  for (const p of s.people) {
    if (p.creed === d) p.zeal = clamp100(zealOf(p) + ZEAL_MIRACLE);
    else if ((p.creed === 'none' || p.creed === 'cult') && !isChild(p) && r.chance(MIRACLE_CONVERTS)) {
      p.creed = d;
      p.zeal = 50;
      seen.push(p.name);
    }
  }
  if (seen.length) log(s, 'faith', `After the miracle, ${names(seen)} turn${seen.length === 1 ? 's' : ''} to ${godOf(s, d)[0]}.`, false);
  raiseIdol(s, d);
}

/** The town carves an idol to the god of a miracle (overnight; a few at most). */
function raiseIdol(s: GameState, d: Domain): void {
  const rel = religionOf(s);
  const idols = (rel.idols ??= []).filter((i) => s.buildings.some((b) => b.id === i.building));
  rel.idols = idols;
  if (idols.length >= IDOLS_MOST) return;
  const def = BUILDING_BY_ID[GOD_IDOL];
  const at = findSpot(s, def);
  if (!at || at.wild) return;
  const b: Building = { id: s.nextId++, def: GOD_IDOL, tile: at.x, row: at.y, status: 'done', delivered: {}, progress: 1, store: {}, builtAt: s.tick };
  s.buildings.push(b);
  idols.push({ building: b.id, god: d });
}

/** From killPerson (sim/health.ts), before anyone in town dies: the rope angers the hearth god at once, and a hearth
 *  god well pleased may spare the dying (a miracle). True when they're spared. */
export function deathSeen(s: GameState, p: Person, cause: string): boolean {
  if (!on(s) || p.away !== null || !s.faith) return false;
  if (/hanged/.test(cause)) {
    s.faith.favour.hearth = clampF(s.faith.favour.hearth + NATURE_ACTS.hearthHanging);
    return false;
  }
  if (UNSPARED.test(cause) || s.faith.favour.hearth < MIRACLE_AT || !miracleReady(s)) return false;
  if (!rngOf(s, `spare:${p.id}`).chance(SPARE_CHANCE)) return false;
  const [name, title] = godOf(s, 'hearth');
  p.hp = Math.max(1, Math.round(maxHp(p) * 0.5));
  p.downed = null;
  p.sick = null;
  castSpellFx(s, 'god:bless', { x: p.x, y: p.y, id: p.id }, [{ x: p.x, y: p.y, id: p.id }], 4);
  miracle(s, 'hearth', 'spared', `✨ A miracle: ${p.name} lay dying ${cause}, and ${name}, ${title}, gave them back their breath.`);
  return true;
}

/** A famine broken: a harvest god not ill-disposed takes pity on a starving town, and food is found in the stores. */
function famineBroken(s: GameState, rng: Rng): void {
  const f = faithOf(s);
  const starving = s.people.filter((p) => p.away === null && p.starving).length;
  if (f.favour.harvest < FAMINE_AT || (!starving && foodDays(s) >= 1) || !miracleReady(s) || !rng.chance(FAMINE_CHANCE)) return;
  const eaters = s.people.filter((p) => p.away === null && !tireless(p)).length;
  const grain = Math.ceil((FAMINE_DAYS * Math.max(1, eaters)) / (FOOD_VALUE.grain ?? 1));
  depositNear(s, holyPlace(s), { grain });
  const [name, title] = godOf(s, 'harvest');
  miracle(s, 'harvest', 'famine', `✨ A miracle: the town was starving, and ${name}, ${title}, filled the empty granary with ${grain} grain overnight.`);
}

/* ------------------------------------------------------------ the priest's blessings (every tick, cheaply) */

/** Each tick from sim.ts: the priest blesses the defenders when raiders are sighted (and a sky god may scatter them
 *  with a storm), and every party setting out; the raid's recap gets the god's part once it's over. */
export function religionTick(s: GameState): void {
  if (s.autopilot === false) return;
  const r = s.raid;
  const rel = s.religion;
  if (r && r.phase === 'warning' && rel?.raidSeen !== r.id) blessRaid(s, r);
  if (!r && rel?.recapNote && s.raidRecap && s.raidRecap.tick >= rel.recapNote.tick) {
    s.raidRecap.story.push(rel.recapNote.text);
    rel.recapNote = undefined;
  }
  const last = s.expeditions.at(-1);
  if (last && last.id > (rel?.tripSeen ?? -1)) blessTrips(s);
}

function blessRaid(s: GameState, r: Raid): void {
  const rel = religionOf(s);
  rel.raidSeen = r.id;
  const f = faithOf(s);
  const pr = firstPriest(s);
  const notes: string[] = [];
  if (pr && f.favour.war > -10) {
    const [war] = godOf(s, 'war');
    const value = f.favour.war >= MIRACLE_AT ? RAID_BLESSING_PLEASED : RAID_BLESSING;
    (s.marks ??= []).push({ lever: 'fight', value, until: r.leavesTick, text: `Blessed by ${pr.priest.name}` });
    castSpellFx(s, 'god:bless', { x: pr.priest.x, y: pr.priest.y, id: pr.priest.id }, s.people.filter((p) => p.away === null && p.task?.type === 'defend').slice(0, 10).map((p) => ({ x: p.x, y: p.y, id: p.id })), 3);
    log(s, 'priest', `${pr.priest.name} blesses the defenders in ${war}'s name.`, false);
    notes.push(`${pr.priest.name} blessed the defenders in ${war}'s name before the fight.`);
  }
  // a storm sent by a sky god well pleased, before they reach the town
  const foes = r.raiders.filter((rd) => !rd.ally);
  if (f.favour.sky >= MIRACLE_AT && foes.length >= 2 && miracleReady(s) && rngOf(s, `storm:${r.id}`).chance(STORM_CHANCE)) {
    const n = Math.floor(foes.length * STORM_SCATTERS);
    const gone = new Set(foes.slice(foes.length - n));
    r.raiders = r.raiders.filter((rd) => !gone.has(rd));
    for (const rd of r.raiders) if (!rd.ally) rd.hp = Math.max(1, Math.round(rd.hp * (1 - STORM_HURTS)));
    const [name, title] = godOf(s, 'sky');
    castSpellFx(s, 'god:lightning', holyPlace(s), [], 4);
    miracle(s, 'sky', 'storm', `✨ A miracle: ${name}, ${title}, sends a storm on the raiders' road: ${n} of them are scattered and the rest come on battered.`);
    notes.push(`${name} sent a storm on their road: ${n} were scattered before they reached the town.`);
  }
  if (notes.length) rel.recapNote = { tick: s.tick, text: notes.join(' ') };
}

function blessTrips(s: GameState): void {
  const rel = religionOf(s);
  const seen = rel.tripSeen ?? -1;
  rel.tripSeen = Math.max(seen, ...s.expeditions.map((e) => e.id));
  const pr = firstPriest(s);
  if (!pr) return;
  for (const e of s.expeditions) {
    if (e.id <= seen || e.phase !== 'out' || e.members.includes(pr.priest.id)) continue;
    for (const id of e.members) {
      const p = s.people.find((q) => q.id === id);
      if (p && (!p.fun || p.fun.value < ROAD_BLESSING)) p.fun = { text: `Blessed for the road by ${pr.priest.name}`, value: ROAD_BLESSING, until: s.tick + ROAD_BLESSING_HOURS * TICKS_PER_HOUR };
    }
  }
}

/** The priest says the words at a funeral: the grieving's grief eased, the hearth god pleased. */
function funeralRites(s: GameState): void {
  const g = s.gathering;
  if (!g || (g.kind !== 'funeral' && g.kind !== 'great_funeral')) return;
  const rel = religionOf(s);
  if (rel.funeralSeen === g.until) return;
  const pr = firstPriest(s);
  if (!pr) return;
  rel.funeralSeen = g.until;
  for (const id of g.ids) {
    const p = s.people.find((q) => q.id === id);
    if (p?.grief) p.grief.value = Math.round(p.grief.value * FUNERAL_RITES_EASE);
  }
  const f = faithOf(s);
  f.favour.hearth = clampF(f.favour.hearth + FUNERAL_RITES_FAVOUR);
  log(s, 'priest', `${pr.priest.name} says the words over the dead, in ${godOf(s, 'hearth')[0]}'s name.`, false);
}

/* ------------------------------------------------------------ pilgrimage */

export const isPilgrimDest = (id: string) => id.startsWith(PILGRIM_DEST);
export const holyPlaceName = (s: GameState) => HOLY_PLACES[s.origin ?? 'settlers'] ?? 'the Old Shrine';

/** The pilgrims' road: to the people's holy place and back, with bandits on the way now and then. */
export function pilgrimDestination(s: GameState): Destination {
  return {
    id: `${PILGRIM_DEST}${s.origin ?? 'settlers'}`,
    name: `Pilgrimage to ${holyPlaceName(s)}`,
    type: 'gather',
    outSeconds: 260,
    workSeconds: 90,
    secondsPerUnit: 40,
    loot: { herbs: 1 },
    threats: 'Bandits on the pilgrim road, now and then',
    encounters: { arrival: 0, ambush: 0.15, groups: [{ enemies: { bandit: 2 }, weight: 1 }] },
    recommendedParty: PILGRIM_PARTY,
    scenery: 'woods',
    description: `The faithful walk to ${holyPlaceName(s)} to pray, and come home with the gods' favour.`,
  };
}

/** Once a temple stands, now and then the priest leads the most zealous on pilgrimage. */
function pilgrimage(s: GameState): void {
  const rel = religionOf(s);
  if (rel.pilgrimage !== undefined && !s.expeditions.some((e) => e.id === rel.pilgrimage)) rel.pilgrimage = undefined;
  if (rel.pilgrimage !== undefined || s.raid || s.muster || s.expeditions.length >= MAX_EXPEDITIONS) return;
  if (!placesOf(s).some((b) => b.def !== 'wayside_shrine') || s.people.length < PILGRIM_PEOPLE) return;
  const day = dayOf(s.tick);
  if (rel.lastPilgrimage !== undefined && day - rel.lastPilgrimage < PILGRIM_EVERY_DAYS) return;
  const pr = firstPriest(s);
  const fit = (p: Person) => p.away === null && !p.downed && !isChild(p) && p.id !== s.mainId && !p.guard && p.hp >= maxHp(p) * 0.6 && godly(p.creed);
  if (!pr || !fit(pr.priest)) return;
  const others = s.people.filter((p) => p !== pr.priest && fit(p)).sort((a, b) => zealOf(b) - zealOf(a) || a.id - b.id).slice(0, PILGRIM_PARTY - 1);
  const members = [pr.priest, ...others];
  const dest = pilgrimDestination(s);
  rel.lastPilgrimage = day;
  if (!sendExpedition(s, dest.id, members.map((p) => p.id), rolesFor(members, dest)).ok) return;
  const e = s.expeditions[s.expeditions.length - 1];
  e.leader = pr.priest.id;
  rel.pilgrimage = e.id;
  rel.tripSeen = Math.max(rel.tripSeen ?? -1, e.id);
  log(s, 'pilgrim', `${pr.priest.name} leads ${others.length ? names(others.map((p) => p.name)) : 'nobody but themselves'} on pilgrimage to ${holyPlaceName(s)}.`);
}

/** The pilgrims home (from sim/expeditions.ts): every god pleased, their zeal lifted, perhaps a relic. */
export function pilgrimHome(s: GameState, e: Expedition, party: Person[]): void {
  if (!isPilgrimDest(e.dest)) return;
  const rel = religionOf(s);
  rel.pilgrimage = undefined;
  if (e.recalled || !party.length) return;
  const f = faithOf(s);
  for (const d of DOMAINS) f.favour[d] = clampF(f.favour[d] + PILGRIM_FAVOUR);
  for (const p of party) {
    p.zeal = clamp100(zealOf(p) + 20);
    p.fun = { text: `Home from ${holyPlaceName(s)}`, value: 8, until: s.tick + 2 * TICKS_PER_DAY };
  }
  const relic = rngOf(s, `relic:${e.id}`).chance(PILGRIM_RELIC);
  if (relic) s.items.phoenix_feather = (s.items.phoenix_feather ?? 0) + 1;
  log(s, 'pilgrim', `The pilgrims are home from ${holyPlaceName(s)}, and the gods are pleased.${relic ? ' They bring a holy relic: a Phoenix Feather.' : ''}`);
}

/* ------------------------------------------------------------ the rival cult */

const cultName = (s: GameState, r: Rng) => ORIGIN_CULT[s.origin ?? 'settlers'] ?? r.pick(CULT_NAMES);

function cultDawn(s: GameState, rng: Rng): void {
  const rel = religionOf(s);
  const f = faithOf(s);
  const grown = s.people.filter((p) => p.away === null && !isChild(p));
  const cult = rel.cult;
  if (!cult) {
    if (grown.length < CULT_PEOPLE) return;
    const sour = DOMAINS.filter((d) => f.favour[d] < 0).length;
    if (!rng.chance(CULT_CHANCE * (1 + sour / 2))) return;
    const pool = grown.filter((p) => p.id !== s.mainId && HERETICAL.includes(natureOf(p).id) && zealOf(p) < 40 && p.morale < 55 && !p.downed && !p.monster && !isZealot(p));
    if (!pool.length) return;
    return foundCult(s, pool.sort((a, b) => zealOf(a) - zealOf(b) || a.id - b.id)[0], rng);
  }
  const members = s.people.filter((p) => p.creed === 'cult');
  if (!members.length) return endCult(s, 'its last follower is gone');
  if (!members.some((p) => p.id === cult.leader)) cult.leader = members[0].id;
  // the cult draws the low in spirits and in faith
  for (const p of grown) {
    if (p.creed === 'cult' || p.id === s.mainId || isZealot(p) || zealOf(p) >= 40 || p.morale >= 50) continue;
    if (rng.chance(CULT_RECRUIT * (HERETICAL.includes(natureOf(p).id) ? 1.5 : 0.5))) {
      p.creed = 'cult';
      log(s, 'cult', `${p.name} has joined the cult of ${cult.name}.`, false);
    }
  }
  // the zealots denounce its members to the council
  const zealots = grown.filter(isZealot);
  const athome = members.filter((p) => p.away === null && !p.downed);
  if (zealots.length && athome.length && !politicsOf(s).trial && rng.chance(DENOUNCE_CHANCE * (cult.tolerated ? 0.5 : 1))) {
    const z = zealots[rng.int(0, zealots.length - 1)];
    const who = athome.find((p) => p.id === cult.leader) ?? athome[rng.int(0, athome.length - 1)];
    log(s, 'cult', `${z.name} denounces ${who.name} as a heretic of the cult of ${cult.name}.`, false);
    trial(s, who, 'heresy', `was denounced by ${z.name} as a heretic of the cult of ${cult.name}`);
  }
}

function foundCult(s: GameState, leader: Person, rng: Rng): void {
  const rel = religionOf(s);
  const name = cultName(s, rng);
  leader.creed = 'cult';
  rel.cult = { name, leader: leader.id, founded: s.tick };
  rel.cults = (rel.cults ?? 0) + 1;
  const def = BUILDING_BY_ID[CULT_ALTAR];
  const at = findSpot(s, def);
  if (at && !at.wild) {
    const b: Building = { id: s.nextId++, def: CULT_ALTAR, tile: at.x, row: at.y, status: 'done', delivered: {}, progress: 1, store: {}, builtAt: s.tick };
    s.buildings.push(b);
    rel.cult.altar = b.id;
  }
  const zealots = s.people.filter(isZealot).length;
  rel.log.unshift({ tick: s.tick, kind: 'cult', text: `${leader.name} has founded the cult of ${name}.` });
  if (rel.log.length > LOG_KEPT) rel.log.length = LOG_KEPT;
  askWays(
    s,
    { system: 'religion', about: 'cult', id: leader.id },
    `The cult of ${name}`,
    `${leader.name} has been meeting the doubting after dark, by an altar of black stone set up behind the houses. They call themselves the cult of ${name}, and say the town's gods are deaf, or worse. The gods' favour is already souring, and the devout${zealots ? `, ${zealots} zealot${zealots > 1 ? 's' : ''} among them,` : ''} want them stopped.`,
    'cult altar night torches secret ritual',
    ['Root it out (put its leader on trial)', 'Let them be', 'Hear them out'],
    zealots ? 0 : 1,
    12,
    leader.id,
  );
}

/** The town's answer about the cult (from sim/heritage.ts `answerWays`). */
export function answerReligion(s: GameState, prompt: Prompt, option: number): void {
  const rel = religionOf(s);
  const cult = rel.cult;
  if (prompt.ways?.about !== 'cult' || !cult) return;
  const leader = s.people.find((p) => p.id === cult.leader && p.away === null);
  if (option === 0) {
    orderPush(s, 2, 'The cult rooted out');
    for (const p of s.people) if (isZealot(p)) p.zeal = clamp100(zealOf(p) + 5);
    if (leader && !politicsOf(s).trial) trial(s, leader, 'heresy', `leads the cult of ${cult.name}`);
    else log(s, 'cult', `The town hunts for the cult of ${cult.name}, but its leader is not to be found.`, false);
  } else if (option === 1) {
    cult.tolerated = true;
    orderPush(s, -1, 'A cult let be');
    log(s, 'cult', `The town lets the cult of ${cult.name} be. The devout mutter.`, false);
  } else {
    const f = faithOf(s);
    for (const d of DOMAINS) f.favour[d] = clampF(f.favour[d] - 8);
    const r = rngOf(s, 'hear');
    const won = s.people.filter((p) => !isChild(p) && p.creed !== 'cult' && !isZealot(p) && zealOf(p) < 35 && p.id !== s.mainId).slice(0, 3).filter(() => r.chance(0.6));
    for (const p of won) p.creed = 'cult';
    cult.tolerated = true;
    alignPush(s, -1, 'The cult heard');
    orderPush(s, -3, 'The cult heard');
    log(s, 'cult', `The town hears the cult of ${cult.name} out${won.length ? `, and ${names(won.map((p) => p.name))} join${won.length === 1 ? 's' : ''} it` : ''}. The gods are angered.`);
  }
}

/** The cult's night: every few days its dark rite at the altar (cruel; sometimes a sacrifice). */
function cultNight(s: GameState): void {
  const rel = religionOf(s);
  const cult = rel.cult;
  if (!cult) return;
  const day = dayOf(s.tick);
  if (cult.lastRite !== undefined && day - cult.lastRite < CULT_RITE_DAYS) return;
  const members = s.people.filter((p) => p.creed === 'cult' && p.away === null && !p.downed);
  if (members.length < 2) return;
  cult.lastRite = day;
  const rng = rngOf(s, 'cult');
  const f = faithOf(s);
  for (const d of DOMAINS) f.favour[d] = clampF(f.favour[d] - 3);
  for (const p of members) p.fun = { text: `The rite of ${cult.name}`, value: CULT_RITE_MORALE, until: s.tick + TICKS_PER_DAY };
  alignPush(s, -3, 'The cult\'s dark rite');
  orderPush(s, -2, 'The cult\'s dark rite');
  const altar = s.buildings.find((b) => b.id === cult.altar);
  if (altar) castSpellFx(s, 'god:blight', buildingCentre(altar), members.slice(0, 6).map((p) => ({ x: p.x, y: p.y, id: p.id })), 4);
  // a sacrifice, once the cult is strong enough to dare it
  const victims = s.people.filter((p) => p.away === null && !isChild(p) && p.creed !== 'cult' && p.id !== s.mainId && !p.downed);
  if (members.length >= 3 && victims.length && rng.chance(0.2)) {
    const v = victims[rng.int(0, victims.length - 1)];
    log(s, 'cult', `Horror: the cult of ${cult.name} has sacrificed ${v.name} on its altar in the night.`);
    killPerson(s, v, `sacrificed by the cult of ${cult.name}`);
    alignPush(s, -6, 'A sacrifice');
    for (const d of DOMAINS) f.favour[d] = clampF(f.favour[d] - 5);
    const leader = s.people.find((p) => p.id === cult.leader && p.away === null);
    if (leader && !politicsOf(s).trial) trial(s, leader, 'murder', `led the cult of ${cult.name} as it sacrificed ${v.name}`);
    return;
  }
  log(s, 'cult', `Torches by the black altar after dark: the cult of ${cult.name} keeps its rite.`, false);
}

function endCult(s: GameState, why: string): void {
  const rel = religionOf(s);
  const cult = rel.cult;
  if (!cult) return;
  s.buildings = s.buildings.filter((b) => b.id !== cult.altar);
  for (const p of s.people) if (p.creed === 'cult') p.creed = 'none';
  rel.cult = undefined;
  log(s, 'cult', `The cult of ${cult.name} is no more: ${why}. Its altar is pulled down.`);
}

/* ------------------------------------------------------------ seen */

/** The year's chronicle (sim/annals.ts): its miracles, and a cult risen. */
export function religionYearLines(s: GameState, sinceTick: number): string[] {
  const rel = s.religion;
  if (!rel) return [];
  const out: string[] = [];
  const miracles = rel.miracles.filter((m) => m.tick >= sinceTick);
  if (miracles.length) out.push(`${miracles.length === 1 ? 'A miracle was' : `${miracles.length} miracles were`} seen this year: ${miracles.map((m) => m.text.replace(/^\W*A miracle: /, '').replace(/\.$/, '')).slice(0, 2).join('; ')}.`);
  if (rel.cult && rel.cult.founded >= sinceTick) out.push(`The cult of ${rel.cult.name} rose in the town.`);
  return out;
}

export interface ReligionView {
  on: boolean;
  priests: { id: number; name: string; place: string }[];
  /** How many follow each god (at home or away), how many none, the zealots. */
  followers: Record<Domain, number>;
  none: number;
  zealots: number;
  feasts: Record<Domain, number>;
  cult: { name: string; members: number; leader: string; tolerated: boolean } | null;
  miracles: { day: number; text: string }[];
  log: { day: number; kind: string; text: string }[];
  pilgrimage: string | null;
  nextPilgrimage: number | null;
  idols: number;
}

export function religionView(s: GameState): ReligionView {
  const rel = s.religion;
  const followers: Record<Domain, number> = { harvest: 0, hearth: 0, war: 0, sky: 0 };
  let none = 0;
  let zealots = 0;
  let cult = 0;
  for (const p of s.people) {
    if (isChild(p)) continue;
    const c = seenCreed(s, p);
    if (c.creed === 'none') none++;
    else if (c.creed === 'cult') cult++;
    else {
      followers[c.creed]++;
      if (c.zeal >= ZEALOT_AT && ZEALOUS.includes(natureOf(p).id)) zealots++;
    }
  }
  const temple = placesOf(s).some((b) => b.def !== 'wayside_shrine');
  const day = dayOf(s.tick);
  return {
    on: s.autopilot !== false,
    priests: priestsOf(s).map((q) => ({ id: q.priest.id, name: q.priest.name, place: defOf(q.place).name })),
    followers,
    none,
    zealots,
    feasts: Object.fromEntries(DOMAINS.map((d) => [d, feastIn(s, d)])) as Record<Domain, number>,
    cult: rel?.cult ? { name: rel.cult.name, members: cult, leader: s.people.find((p) => p.id === rel.cult!.leader)?.name ?? 'nobody', tolerated: !!rel.cult.tolerated } : null,
    miracles: [...(rel?.miracles ?? [])].reverse().map((m) => ({ day: calendar(m.tick).day, text: m.text })),
    log: (rel?.log ?? []).slice(0, 10).map((e) => ({ day: calendar(e.tick).day, kind: e.kind, text: e.text })),
    pilgrimage: rel?.pilgrimage !== undefined ? holyPlaceName(s) : null,
    nextPilgrimage: temple ? Math.max(0, (rel?.lastPilgrimage ?? -PILGRIM_EVERY_DAYS) + PILGRIM_EVERY_DAYS - day) : null,
    idols: (rel?.idols ?? []).length,
  };
}
