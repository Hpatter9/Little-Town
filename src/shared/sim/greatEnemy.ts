// The Great Enemy (data/greatEnemy.ts): one villain a town, with a name, a seat on the world map and a plan, and the
// long arc of the game. Chosen on the founding's second day to fit the land and the people (`chooseEnemy`; a
// descendant whose forebears' town it broke meets the same one again), it then plots: each morning its **plan** moves
// on by the paced day (sim/time.ts `paceDay`), faster for every outpost left standing and every tribute refused,
// slower for the counters the town holds (research topics, a god well pleased). Its stages, by the plan (`PLAN_AT`):
//  - omens: signs most nights, dreams the townsfolk write in their diaries, travellers gone missing, and a stranger
//    who comes to warn the town; the scouts may find its seat (`seatFound`).
//  - stirring: its blight creeps onto the town's land from the edge toward its seat, its agents slip in among the
//    visitors and do harm till caught, raids come bearing its mark (in place of one already due), the realm's powers
//    fall to it one by one, and its three lieutenants take outposts on the board (the parties and the Monster
//    Hunters' Guild go after them; each slain sets the plan back).
//  - the march: the living lieutenants lead hosts against the town (deadlier than ordinary raids, the lieutenant at
//    their head), and it demands tribute (paid, the plan slips back; refused, a host comes at once).
//  - the last siege: warned a day and a half ahead, then its whole host led by the Enemy itself, with its living
//    lieutenants. The Enemy struck down, the town has a lasting peace (a monument, a title, its relic, a legend);
//    the siege lost, the town burns and it comes again, and the second lost is the end of the town.
// The player strikes early only by an expedition to its seat (never chosen by the town's own parties): won while a
// lieutenant lives, the plan is set far back; won once they are all dead, the Enemy is slain at home.
// Only with the autopilot on; every roll is its own side stream (`enemy`).

import {
  AGENT_CAUGHT, AGENT_CAUGHT_PER_GUARD, CALAMITY_OMEN_SHARE, AGENT_DAILY, COUNTER_TOPICS, CREEP_MOST, CREEP_PER_DAY, CREEP_START, ENEMY_CHOSEN_DAY, ENEMY_HOUR, ENEMY_KINDS,
  FAITH_FAVOUR, FAITH_SLOW, FALL_EVERY_DAYS, GREAT_ENEMIES, GUILD_PURSE, HOST_EVERY_DAYS, HOST_MOST, HOST_SHARE, LIEUTENANT_SETBACK, MARK_CHANCE, MARK_SHARE,
  MISSING_DAILY, MONUMENT, OMEN_HOUR, OMEN_NIGHTLY, OUTPOST_DEST, OUTPOST_HASTE, PACE_LEAST, PACE_MOST, PEACE_DAYS, PEACE_MORALE, PLAN_AT, POWERS_FALL_MOST,
  PULL_OUTPOST, REFUSED_HASTE, SACK_SLAIN, HOST_CAP, HOST_PER_GROWN, SIEGE_CAP, SIEGE_PER_GROWN, HOST_HOURS, SIEGE_HOURS, SEAT_DEST, SEAT_FOUND_DAILY, SEAT_FOUND_PER_REGION, SEAT_FOUND_SCOUTING, SEAT_QUIET_DAYS, SEAT_SETBACK, SEAT_SPOTS,
  SIEGE_BURN, SIEGE_LIEUTENANT_SHARE, SIEGE_PER_LIEUTENANT, SIEGE_REGROUP, SIEGE_SHARE, SIEGE_SIZE, SIEGE_WARNING_HOURS, SIEGES_TO_FALL, STAGE_LABEL,
  STAGE_ORDER, TRIBUTE_COINS, TRIBUTE_EVERY_DAYS, TRIBUTE_HOURS, TRIBUTE_SETBACK, WARNING_DAILY, enemyFit, outpostSpot, type EnemyKind, type EnemyKindDef,
  type EnemyStage,
} from '../data/greatEnemy';
import { MAP_HOME } from '../data/worldMap';
import { CALAMITIES, ENEMY_CALAMITY, type CalamityKind } from '../data/calamity';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { RAID_KIND_BY_ID } from '../data/raids';
import { eventPicture } from '../data/eventScenes';
import type { Destination } from '../data/expeditions';
import { DANGER_PACE } from '../data/pace';
import { hashSeed, Rng } from '../rng';
import { connectRoad, placeBlueprint } from './buildings';
import { calamityDaily, calamityLifts, calamityOmens, calamityPace, calamitySync, stageOfEnemy } from './calamity';
import { queueScene } from './cutscenes';
import { declareWar, defOf, realm } from './factions';
import { setFire } from './fire';
import { killPerson } from './health';
import { inMap } from './land';
import { findSpot } from './planner';
import { raidBudget, scheduleNextRaid, startRaid } from './raids';
import { seaTown } from './sea';
import { isChild } from './social';
import { campCell, notify, type Building, type GameState, type Prompt, type Raid } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';

export interface GreatEnemyState {
  kind: EnemyKind;
  stage: EnemyStage;
  /** When it was chosen, and when each stage began (ticks). */
  chosen: number;
  began: Partial<Record<EnemyStage, number>>;
  /** Its plan: paced days of plotting (the stages come at `PLAN_AT`), and the morning's pace (for the menus). */
  plan: number;
  pace: number;
  /** When the scouts found its seat; whether the stranger has come to warn of it; when a party last struck it. */
  seatFound?: number;
  warned?: boolean;
  seatStruck?: number;
  /** Each lieutenant: when it was slain (null while it lives); whether its outposts are on the board yet; whether
   *  the guild has posted its purse on each. */
  slain: (number | null)[];
  outposts?: boolean;
  purses?: boolean[];
  /** Its blight creeping onto the town's land (a cell at the land's edge toward its seat, and how far it reaches). */
  creep?: { x: number; y: number; r: number };
  /** The powers of the realm fallen to it (ids), and when the last fell. */
  thralls?: string[];
  lastFall?: number;
  /** The last host it sent, the last tribute it demanded, and how the town answered them all. */
  lastHost?: number;
  lastTribute?: number;
  tributes?: number;
  refused?: number;
  /** The last siege: when it comes (warned), and the sieges lost. */
  siegeAt?: number;
  lost: number;
  /** The end: when it fell (and to whom: the town's title after), or when the town fell to it. */
  beaten?: number;
  slayer?: string;
  title?: string;
  fell?: number;
  /** The latest omen, and the dream the townsfolk had of it (the night's tick: sim/diary.ts reads it). */
  omen?: string;
  dream?: { text: string; tick: number };
  /** The town's forebears whose town it broke (a descendant's: simHost's `inheritEnemy`). */
  vengeance?: string;
  /** The arc so far, a line a turn of it (newest last): the Chronicle's telling. */
  log: { day: number; text: string }[];
}

const LEGACY_AVATARS = Object.values(CALAMITIES).map((c) => c.avatar);

/** What a fallen town's legend keeps of its Enemy (simHost.ts puts it on the legend; a descendant meets it again). */
export interface EnemyLegend {
  kind: EnemyKind;
  name: string;
  fate: 'beaten' | 'won' | 'waiting';
}

const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:enemy:${salt.join(':')}`));
export const enemyDef = (e: Pick<GreatEnemyState, 'kind'>): EnemyKindDef => GREAT_ENEMIES[e.kind];
const at = (stage: EnemyStage) => STAGE_ORDER.indexOf(stage);
const past = (e: GreatEnemyState, stage: EnemyStage) => at(e.stage) >= at(stage);
const ended = (e: GreatEnemyState) => e.stage === 'peace' || e.stage === 'fallen';
const living = (e: GreatEnemyState) => enemyDef(e).lieutenants.map((l, i) => ({ l, i })).filter(({ i }) => e.slain[i] == null);
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const LOG_MOST = 24;
const grownAtHome = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p)).length;

function log(s: GameState, e: GreatEnemyState, text: string): void {
  e.log.push({ day: calendar(s.tick).day, text });
  if (e.log.length > LOG_MOST) e.log.splice(0, e.log.length - LOG_MOST);
}

/* ------------------------------------------------------------ the choosing */

/** Which Enemy fits this town: weighted by the land and the people, drawn from its own stream (`only`: an old save's
 *  Calamity, whose Enemy it must be: `bindCalamity`). */
export function enemyKindFor(s: GameState, only?: CalamityKind): EnemyKind {
  const shore = seaTown(s) || s.biome === 'coast';
  const weights = Object.fromEntries(ENEMY_KINDS.map((k) => [k, only && ENEMY_CALAMITY[k] !== only ? 0 : enemyFit(k, s.biome ?? 'forest', s.origin ?? 'settlers', shore)])) as Record<EnemyKind, number>;
  if (only && !Object.values(weights).some((w) => w > 0)) for (const k of ENEMY_KINDS) if (ENEMY_CALAMITY[k] === only) weights[k] = 1;
  return roll(s, 'kind').weighted(weights);
}

/** It is chosen (once): its kind (the forebears' Enemy, if one broke their town), its plan begun at nothing. */
export function chooseEnemy(s: GameState, kind?: EnemyKind): GreatEnemyState {
  const foretold = s.greatEnemy?.vengeance ? s.greatEnemy.kind : undefined;
  const k = kind ?? foretold ?? enemyKindFor(s);
  const e: GreatEnemyState = { kind: k, stage: 'dormant', chosen: s.tick, began: { dormant: s.tick }, plan: 0, pace: 1, slain: enemyDef({ kind: k }).lieutenants.map(() => null), lost: 0, log: [], ...(s.greatEnemy?.vengeance ? { vengeance: s.greatEnemy.vengeance } : {}) };
  s.greatEnemy = e;
  return e;
}

/** A descendant's town (from simHost's newGame): the Enemy that broke the forebears' town is this town's too, waiting. */
export function inheritEnemy(s: GameState, l: EnemyLegend | undefined, founder: string): void {
  if (!l || l.fate !== 'won' || !GREAT_ENEMIES[l.kind]) return;
  s.greatEnemy = { kind: l.kind, stage: 'dormant', chosen: -1, began: {}, plan: 0, pace: 1, slain: GREAT_ENEMIES[l.kind].lieutenants.map(() => null), lost: 0, log: [], vengeance: founder };
}

/** What the legend keeps of it, as the town ends. */
export function enemyLegend(s: GameState): EnemyLegend | undefined {
  const e = s.greatEnemy;
  if (!e || e.chosen < 0) return undefined;
  return { kind: e.kind, name: enemyDef(e).name, fate: e.stage === 'peace' ? 'beaten' : e.stage === 'fallen' ? 'won' : 'waiting' };
}

/* ------------------------------------------------------------ each hour */

/** Each hour: it's chosen on its day; each night an omen may come; each morning the plan moves and the stage's
 *  doings are done; the siege comes when warned. */
export function greatEnemyHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  const cal = calendar(s.tick);
  if (!s.greatEnemy || s.greatEnemy.chosen < 0) {
    if (cal.day >= ENEMY_CHOSEN_DAY && cal.hour === ENEMY_HOUR) chooseEnemy(s);
    return;
  }
  const e = s.greatEnemy;
  if (s.calamity && !s.calamity.driven) bindCalamity(s, e);
  if (ended(e)) return;
  if (e.siegeAt !== undefined && s.tick >= e.siegeAt && !s.raid) startSiege(s, e);
  if (cal.hour === OMEN_HOUR && past(e, 'omens') && roll(s, 'omen', cal.day).chance(OMEN_NIGHTLY)) omen(s, e);
  if (cal.hour === ENEMY_HOUR) enemyDaily(s, e, roll(s, 'day', cal.day));
}

/** How fast its plan moves today (1 a paced day, before the outposts and the counters). */
export function paceToday(s: GameState, e = s.greatEnemy): number {
  if (!e) return 1;
  const standing = e.outposts ? living(e).length : 0;
  let pace = 1 + OUTPOST_HASTE * standing;
  for (const [topic, slow] of Object.entries(COUNTER_TOPICS)) if (s.research.done.includes(topic)) pace -= slow;
  if (faithHolds(s)) pace -= FAITH_SLOW;
  pace += calamityPace(s); // (its nests and the wards against them: sim/calamity.ts)
  return Math.max(PACE_LEAST, Math.min(PACE_MOST, pace));
}

/** The town's faith counts against it: its gods' favour summed past `FAITH_FAVOUR`, with somewhere to worship. */
function faithHolds(s: GameState): boolean {
  const f = s.faith?.favour;
  if (!f) return false;
  const sum = Object.values(f).reduce((n, v) => n + v, 0);
  return sum >= FAITH_FAVOUR && s.buildings.some((b) => b.status === 'done' && ['wayside_shrine', 'temple', 'cathedral'].includes(b.def));
}

function enemyDaily(s: GameState, e: GreatEnemyState, g: Rng): void {
  e.pace = paceToday(s, e);
  if (e.siegeAt === undefined) e.plan += e.pace / DANGER_PACE;
  // the stages, by the plan (only ever forward)
  if (e.stage === 'dormant' && e.plan >= PLAN_AT.omens) setStage(s, e, 'omens');
  if (e.stage === 'omens' && e.plan >= PLAN_AT.stirring) setStage(s, e, 'stirring');
  if (e.stage === 'stirring' && e.plan >= PLAN_AT.march) setStage(s, e, 'march');
  if (e.stage === 'march' && e.plan >= PLAN_AT.siege && e.siegeAt === undefined) warnSiege(s, e);
  if (!past(e, 'omens')) return;
  if (g.chance(MISSING_DAILY)) missing(s, e, g);
  calamityDaily(s, e); // (its Calamity wakes and spreads with the plan: sim/calamity.ts)
  if (e.stage === 'omens') {
    if (!e.warned && g.chance(WARNING_DAILY)) warning(s, e);
    if (e.seatFound === undefined && g.chance(SEAT_FOUND_DAILY + (s.research.done.includes('scouting') ? SEAT_FOUND_SCOUTING : 0) + SEAT_FOUND_PER_REGION * (s.regions?.length ?? 0))) findSeat(s, e, 'The scouts');
  }
  if (!past(e, 'stirring')) return;
  if (e.creep) e.creep.r = Math.min(CREEP_MOST, e.creep.r + CREEP_PER_DAY);
  guildPurses(s, e);
  if (g.chance(AGENT_DAILY)) agent(s, e, g);
  if ((e.thralls?.length ?? 0) < POWERS_FALL_MOST && (e.lastFall === undefined || s.tick - e.lastFall >= FALL_EVERY_DAYS * TICKS_PER_DAY)) powerFalls(s, e, g);
  if (e.stage === 'stirring' && !s.raid && s.tick >= s.nextRaidTick - TICKS_PER_DAY && g.chance(MARK_CHANCE)) markedRaid(s, e, g);
  if (e.stage === 'march') {
    if (!s.raid && living(e).length && (e.lastHost === undefined || s.tick - e.lastHost >= HOST_EVERY_DAYS * TICKS_PER_DAY)) host(s, e, g);
    if (!s.prompts.some((p) => p.kind === 'enemy') && (e.lastTribute === undefined || s.tick - e.lastTribute >= TRIBUTE_EVERY_DAYS * TICKS_PER_DAY)) demand(s, e);
  }
}

/** It passes into a stage: told in the event box with a scene, in the news and the Chronicle. */
function setStage(s: GameState, e: GreatEnemyState, stage: EnemyStage): void {
  if (at(stage) <= at(e.stage)) return;
  e.stage = stage;
  e.began[stage] = s.tick;
  const d = enemyDef(e);
  if (stage === 'stirring') {
    if (e.seatFound === undefined) findSeat(s, e, 'The spreading blight');
    e.outposts = true;
    e.creep = creepSpot(s, e);
  }
  const more: Partial<Record<EnemyStage, string>> = {
    omens: `${e.vengeance ? `It is the same enemy that broke ${e.vengeance}'s town. ` : ''}Its goal: ${d.goal.charAt(0).toLowerCase()}${d.goal.slice(1)}`,
    stirring: `${CALAMITIES[ENEMY_CALAMITY[e.kind]].name.replace(/^the /, 'The ')} that woke ahead of it is its doing, and it will spread. Its lieutenants hold ${d.lieutenants.map((l) => l.outpost).join(', ')}. Every one slain sets it back; every outpost left standing hastens it.`,
    march: 'Its lieutenants will lead its hosts against the walls now, and it will want tribute.',
  };
  tell(s, e, `${capital(d.name)}: ${STAGE_LABEL[stage].toLowerCase()}`, `${d.stages[stage] ?? ''} ${more[stage] ?? ''}`.trim(), `enemy_${stage}`);
  log(s, e, d.stages[stage]?.split('. ')[0] ?? STAGE_LABEL[stage]);
}

/* ------------------------------------------------------------ the omens */

/** A sign in the night (a chill on everyone), and the dream they'll write of in the morning. */
function omen(s: GameState, e: GreatEnemyState): void {
  const d = enemyDef(e);
  const g = roll(s, 'omen-line', s.tick);
  const own = d.omens[g.int(0, d.omens.length - 1)];
  // (some nights the sign is its Calamity's, foretold: the grey mould, the red light; a side stream, so its own omens stay as they were)
  const cg = roll(s, 'omen-calamity', s.tick);
  const line = cg.chance(CALAMITY_OMEN_SHARE) ? cg.pick(calamityOmens(e.kind)) : own;
  e.omen = line;
  if (s.calamity) s.calamity.omen = line;
  e.dream = { text: d.dreams[g.int(0, d.dreams.length - 1)], tick: s.tick };
  notify(s, `An omen of ${d.short}: ${line}`, true);
  (s.marks ??= []).push({ lever: 'morale', value: -2, until: s.tick + 12 * TICKS_PER_HOUR, text: 'A bad omen' });
}

/** A traveller gone missing on the roads. */
function missing(s: GameState, e: GreatEnemyState, g: Rng): void {
  const d = enemyDef(e);
  notify(s, d.missing[g.int(0, d.missing.length - 1)], true);
  (s.marks ??= []).push({ lever: 'morale', value: -1, until: s.tick + TICKS_PER_DAY, text: 'Travellers go missing' });
}

/** A stranger comes to warn the town: the seat is known from it. */
function warning(s: GameState, e: GreatEnemyState): void {
  e.warned = true;
  const d = enemyDef(e);
  tell(s, e, 'A stranger\'s warning', `${d.warning} ${d.name} is gathering strength in ${d.seat}.`);
  log(s, e, `A stranger warned of ${d.short} in ${d.seat}`);
  if (e.seatFound === undefined) findSeat(s, e, 'The stranger\'s word');
}

/** The seat is found: it goes on the world map, and a party may strike it. */
function findSeat(s: GameState, e: GreatEnemyState, by: string): void {
  e.seatFound = s.tick;
  const d = enemyDef(e);
  notify(s, `${by} found ${d.seat}, the seat of ${d.name}, far off on the world map. A bold expedition might strike it there.`, true);
}

/* ------------------------------------------------------------ the stirring */

/** Where its blight creeps in: the cell at the edge of the town's land toward its seat. */
function creepSpot(s: GameState, e: GreatEnemyState): { x: number; y: number; r: number } {
  const camp = campCell(s);
  const seat = SEAT_SPOTS[e.kind];
  const dx = seat.x - MAP_HOME.x;
  const dy = seat.y - MAP_HOME.y;
  const len = Math.hypot(dx, dy) || 1;
  let x = camp.x;
  let y = camp.y;
  for (let k = 1; k < 400; k++) {
    const nx = Math.round(camp.x + (dx / len) * k);
    const ny = Math.round(camp.y + (dy / len) * k);
    if (!inMap(s.land, nx, ny) || nx < 1 || ny < 1 || nx >= s.land.w - 1 || ny >= s.land.h - 1) break;
    x = nx;
    y = ny;
  }
  return { x, y, r: CREEP_START };
}

/** The Monster Hunters' Guild posts a purse on each lieutenant (once each, while the guild hall stands). */
function guildPurses(s: GameState, e: GreatEnemyState): void {
  if (!e.outposts || !s.buildings.some((b) => b.def === 'monster_guild' && b.status === 'done')) return;
  const purses = (e.purses ??= e.slain.map(() => false));
  for (const { l, i } of living(e)) {
    if (purses[i]) continue;
    purses[i] = true;
    const id = OUTPOST_DEST(e.kind, i);
    (s.bounties ??= {})[id] = (s.bounties[id] ?? 0) + GUILD_PURSE;
    notify(s, `The Monster Hunters' Guild posts a purse of ${GUILD_PURSE} coins for ${l.name}, at ${l.outpost}.`, true);
  }
}

/** Its agent among the visitors: caught (more often with guards about), or does harm: a fire, a theft, a killing. */
function agent(s: GameState, e: GreatEnemyState, g: Rng): void {
  const d = enemyDef(e);
  const guards = s.people.filter((p) => p.guard && p.away === null).length;
  if (g.chance(AGENT_CAUGHT + AGENT_CAUGHT_PER_GUARD * guards)) {
    notify(s, `The watch unmasked ${d.agent} among the visitors: one of ${d.short}'s agents. They were driven out of the town.`, true);
    return;
  }
  const deed = g.int(0, 3);
  if (deed <= 1) {
    const b = g.pick(s.buildings.filter((q) => q.status === 'done' && q.def !== 'campfire' && !q.room && !BUILDING_BY_ID[q.def]?.seat && !BUILDING_BY_ID[q.def]?.never));
    if (b && setFire(s, b)) notify(s, `Fire! ${capital(d.agent)} was seen near ${BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? 'a building'} before it went up, and is gone. ${d.short}'s work.`, true);
  } else if (deed === 2 && (s.coins ?? 0) > 10) {
    const took = Math.max(5, Math.round((s.coins ?? 0) * 0.12));
    s.coins = (s.coins ?? 0) - took;
    notify(s, `${took} coins are gone from the treasury, and so is ${d.agent} who lodged in town last night.`, true);
  } else {
    const marks = s.people.filter((p) => p.away === null && p.id !== s.mainId && !isChild(p) && !p.undying && !p.downed);
    if (!marks.length) return;
    const p = g.pick(marks);
    killPerson(s, p, `murdered by an agent of ${d.short}`);
    notify(s, `${p.name} was found dead at dawn. ${capital(d.agent)} who lodged in town is gone: an agent of ${d.short}.`, true);
  }
}

/** A power of the realm falls to it: an ally of the town is razed, any other turns its banners on the town. */
function powerFalls(s: GameState, e: GreatEnemyState, g: Rng): void {
  const thralls = (e.thralls ??= []);
  const can = realm(s).filter((f) => f.stance !== 'destroyed' && !defOf(f).kin && !thralls.includes(f.id));
  if (!can.length) return;
  const f = g.pick(can);
  const d = enemyDef(e);
  thralls.push(f.id);
  e.lastFall = s.tick;
  f.known = true;
  if (f.stance === 'alliance') {
    f.stance = 'destroyed';
    f.since = s.tick;
    f.host = undefined;
    f.folk = 0;
    notify(s, `${defOf(f).name}, the town's allies, have been overrun by ${d.name}. ${capital(defOf(f).stronghold)} is in ruins.`, true);
    log(s, e, `${defOf(f).name} were razed by ${d.short}`);
  } else {
    declareWar(s, f, false);
    f.attitude = -100;
    notify(s, `${defOf(f).name} have bent the knee to ${d.name}, and march under its banner now.`, true);
    log(s, e, `${defOf(f).name} fell under ${d.short}'s banner`);
  }
}

/** A raid bearing its mark (in place of one already due). */
function markedRaid(s: GameState, e: GreatEnemyState, g: Rng): void {
  const d = enemyDef(e);
  const kind = RAID_KIND_BY_ID[d.army];
  const r = startRaid(s, kind, raidBudget(s) * MARK_SHARE, g);
  r.enemy = 'mark';
  scheduleNextRaid(s, g);
  notify(s, `Raiders bearing ${d.short}'s mark are coming!`, true);
}

/* ------------------------------------------------------------ the march */

/** A living lieutenant leads a host on the town. */
function host(s: GameState, e: GreatEnemyState, g: Rng): void {
  const d = enemyDef(e);
  const { l, i } = g.pick(living(e));
  const kind = RAID_KIND_BY_ID[d.army];
  const r = startRaid(s, kind, raidBudget(s) * HOST_SHARE, g, undefined, { most: Math.min(HOST_CAP, HOST_MOST + Math.floor(grownAtHome(s) / HOST_PER_GROWN)), siege: s.era === 'neolithic' ? 0 : 1, leader: l.id, host: `enemy:${e.kind}` });
  r.enemy = 'host';
  r.enemyLt = i;
  r.leavesTick = r.arrivesTick + HOST_HOURS * TICKS_PER_HOUR;
  e.lastHost = s.tick;
  scheduleNextRaid(s, g);
  notify(s, `${capital(l.name)} leads a host of ${d.short}'s against the town!`, true);
}

/** It demands tribute (a question in the event box: left unanswered, the town pays if it easily can). */
function demand(s: GameState, e: GreatEnemyState): void {
  const d = enemyDef(e);
  e.lastTribute = s.tick;
  const coins = tributeOf(e);
  const have = s.coins ?? 0;
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'enemy',
    expedition: null,
    title: `${capital(d.name)} demands tribute`,
    text: `${d.demand} It wants ${coins} coins. The treasury holds ${have}.`,
    story: `${d.demand} It wants ${coins} coins; the treasury holds ${have}. Paid, its plans slip back a little. Refused, a host will come at once.`,
    picture: eventPicture(`enemy:${e.kind}:tribute`, `${d.picture} herald`, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: [`Pay the tribute (${coins} coins)`, 'Refuse'],
    defaultOption: have >= coins * 2 ? 0 : 1,
    expiresTick: s.tick + TRIBUTE_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${capital(d.name)} demands ${coins} coins in tribute!`, true);
}

export const tributeOf = (e: GreatEnemyState) => Math.round(TRIBUTE_COINS * (1 + 0.5 * (e.tributes ?? 0)));

/** The answer to its demand. */
export function answerEnemy(s: GameState, prompt: Prompt, option: number): void {
  const e = s.greatEnemy;
  if (!e || e.stage !== 'march') return;
  const d = enemyDef(e);
  const coins = tributeOf(e);
  if ((prompt.options[option] ?? '').startsWith('Pay') && (s.coins ?? 0) >= coins) {
    s.coins = (s.coins ?? 0) - coins;
    e.tributes = (e.tributes ?? 0) + 1;
    e.plan = Math.max(0, e.plan - TRIBUTE_SETBACK);
    notify(s, `The town pays ${d.short} ${coins} coins. Its herald goes, and its plans slip back a little.`, true);
    log(s, e, `The town paid ${d.short} tribute`);
    return;
  }
  e.refused = (e.refused ?? 0) + 1;
  e.plan += REFUSED_HASTE;
  e.lastHost = undefined; // (a host comes at once)
  (s.marks ??= []).push({ lever: 'morale', value: 3, until: s.tick + TICKS_PER_DAY, text: `We defied ${d.short}` });
  notify(s, `The town will not pay. ${capital(d.short)}'s herald turns away without a word. A host will follow.`, true);
  log(s, e, `The town refused ${d.short} tribute`);
}

/* ------------------------------------------------------------ the lieutenants and the seat */

/** A lieutenant is slain (at its outpost, or leading a host): the plan is set back. */
export function slayLieutenant(s: GameState, i: number, where: string): void {
  const e = s.greatEnemy;
  if (!e || ended(e) || e.slain[i] != null) return;
  const d = enemyDef(e);
  const l = d.lieutenants[i];
  e.slain[i] = s.tick;
  e.plan = Math.max(0, e.plan - LIEUTENANT_SETBACK);
  (s.marks ??= []).push({ lever: 'morale', value: 6, until: s.tick + 2 * TICKS_PER_DAY, text: `${capital(l.name)} is slain` });
  notify(s, `${capital(l.name)}, ${d.short}'s lieutenant, is slain ${where}! ${capital(d.short)}'s plans are set back.`, true);
  log(s, e, `${capital(l.name)} was slain ${where}`);
  queueScene(s, 'enemy_lieutenant', { vars: { enemy: d.name, foe: l.name }, foes: { lt: l.id } });
}

export const isEnemyDest = (id: string) => id.startsWith('enemy:');
export const isEnemySeat = (id: string) => isEnemyDest(id) && id.endsWith(':seat');
const outpostIndex = (e: GreatEnemyState, id: string) => [0, 1, 2].find((i) => OUTPOST_DEST(e.kind, i) === id);

/** Whether its seat can be struck now: found, before the end, and not lately struck. */
export const seatOpen = (s: GameState) => {
  const e = s.greatEnemy;
  return !!e && e.seatFound !== undefined && !ended(e) && (e.seatStruck === undefined || s.tick - e.seatStruck >= SEAT_QUIET_DAYS * TICKS_PER_DAY);
};

const tripSeconds = (to: { x: number; y: number }) => Math.round(Math.hypot(to.x - MAP_HOME.x, to.y - MAP_HOME.y) * 2);

/** One of its places on the Expedition Board (`held`: a party already out keeps its place till it's home). */
export function enemyDestination(s: GameState, id: string, held = false): Destination | undefined {
  const e = s.greatEnemy;
  if (!e || !isEnemyDest(id) || !id.startsWith(`enemy:${e.kind}:`)) return undefined;
  const d = enemyDef(e);
  if (isEnemySeat(id)) {
    if (!held && !seatOpen(s)) return undefined;
    const alone = living(e).length === 0;
    const guard: Record<string, number> = alone ? { [d.boss]: 1, ...d.seatGuard } : Object.fromEntries(Object.entries(d.seatGuard).map(([k, n]) => [k, n * 2]));
    return {
      id,
      name: capital(d.seat),
      type: 'clear',
      outSeconds: tripSeconds(SEAT_SPOTS[e.kind]),
      workSeconds: 40,
      secondsPerUnit: 8,
      loot: { iron: 3, bone: 3 },
      threats: Object.entries(guard).map(([k, n]) => `${n} ${ENEMIES[k]?.name ?? k}`).join(', '),
      encounters: { arrival: 1, ambush: 0.3, groups: [{ enemies: guard, weight: 1 }] },
      recommendedParty: 6,
      scenery: d.scenery,
      description: alone
        ? `The seat of ${d.name}, its lieutenants all dead. ${capital(d.short)} waits there itself: slay it, and the town is free of it for good.`
        : `The seat of ${d.name}, its hosts gathered round it. A win here sets its plans far back (${SEAT_SETBACK} days), but its lieutenants still live, and it is a long way from home. Only the boldest go.`,
    };
  }
  const i = outpostIndex(e, id);
  if (i === undefined || !e.outposts || (!held && (e.slain[i] != null || ended(e)))) return undefined;
  const l = d.lieutenants[i];
  const guard = { [l.id]: 1, ...l.guard };
  return {
    id,
    name: capital(l.outpost),
    type: 'clear',
    outSeconds: tripSeconds(outpostSpot(e.kind, i)),
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: { iron: 2, bone: 2 },
    threats: Object.entries(guard).map(([k, n]) => `${n} ${ENEMIES[k]?.name ?? k}`).join(', '),
    encounters: { arrival: 1, ambush: 0.2, groups: [{ enemies: guard, weight: 1 }] },
    recommendedParty: 4,
    scenery: d.scenery,
    description: `${capital(l.name)}, a lieutenant of ${d.name}, holds ${l.outpost}. Slay it and ${d.short}'s plans are set back; leave it standing and they hasten.`,
  };
}

/** Its places on the board now. */
export function enemyDestinations(s: GameState): Destination[] {
  const e = s.greatEnemy;
  if (!e || ended(e)) return [];
  return [SEAT_DEST(e.kind), ...[0, 1, 2].map((i) => OUTPOST_DEST(e.kind, i))].map((id) => enemyDestination(s, id)).filter((d): d is Destination => !!d);
}

/** How much one of its places draws the town's own parties (its seat never: that's for the player to send). */
export function enemyPull(id: string): number {
  if (!isEnemyDest(id) || isEnemySeat(id)) return 0;
  return PULL_OUTPOST;
}

/** A party won at one of its places (from sim/expeditions.ts, as a place is cleared). */
export function enemyPlaceCleared(s: GameState, id: string): void {
  const e = s.greatEnemy;
  if (!e || ended(e) || !id.startsWith(`enemy:${e.kind}:`)) return;
  const d = enemyDef(e);
  if (isEnemySeat(id)) {
    if (!seatOpen(s)) return;
    e.seatStruck = s.tick;
    if (!living(e).length) return victory(s, e, null, `at ${d.seat}`);
    e.plan = Math.max(0, e.plan - SEAT_SETBACK);
    (s.marks ??= []).push({ lever: 'morale', value: 8, until: s.tick + 3 * TICKS_PER_DAY, text: `We struck at ${d.seat}` });
    notify(s, `The town's party struck at ${d.seat} itself and lived! ${capital(d.short)} reels; its plans are set far back.`, true);
    log(s, e, `A party struck at ${d.seat}`);
    return;
  }
  const i = outpostIndex(e, id);
  if (i !== undefined) slayLieutenant(s, i, `at ${d.lieutenants[i].outpost}`);
}

/* ------------------------------------------------------------ the last siege */

function warnSiege(s: GameState, e: GreatEnemyState): void {
  e.siegeAt = s.tick + SIEGE_WARNING_HOURS * TICKS_PER_HOUR;
  setStage(s, e, 'siege');
  notify(s, `${capital(enemyDef(e).name)} is coming with its whole host. It will be at the gate within a day and a half.`, true);
}

export function startSiege(s: GameState, e: GreatEnemyState): Raid {
  const d = enemyDef(e);
  const kind = RAID_KIND_BY_ID[d.army];
  const alive = living(e);
  const g = roll(s, 'siege', e.lost);
  const r = startRaid(s, kind, raidBudget(s) * SIEGE_SHARE * (1 + SIEGE_LIEUTENANT_SHARE * alive.length), g, undefined, {
    most: Math.min(SIEGE_CAP, SIEGE_SIZE + SIEGE_PER_LIEUTENANT * alive.length + Math.floor(grownAtHome(s) / SIEGE_PER_GROWN)),
    siege: s.era === 'neolithic' ? 0 : 2,
    leader: d.boss,
    host: `enemy:${e.kind}`,
  });
  // (its living lieutenants march with it)
  const lead = r.raiders.find((rd) => rd.kind === d.boss);
  if (lead)
    for (const { l } of alive) {
      const hp = Math.round(lead.maxHp * (ENEMIES[l.id].hp / ENEMIES[d.boss].hp));
      r.raiders.push({ ...lead, id: s.nextId++, kind: l.id, hp, maxHp: hp, x: lead.x + (lead.dir > 0 ? -18 : 18), carrying: {} });
    }
  r.enemy = 'siege';
  r.leavesTick = r.arrivesTick + SIEGE_HOURS * TICKS_PER_HOUR;
  e.siegeAt = undefined;
  notify(s, `The last siege: ${d.name} has come to the gate with all its host!`, true);
  return r;
}

/** A raid of its is over (from sim/raids.ts `endRaid`): lieutenants slain in it; the siege won or lost. */
export function greatEnemyRaidOver(s: GameState, r: Raid): void {
  const e = s.greatEnemy;
  if (!e || !r.enemy || ended(e)) return;
  const d = enemyDef(e);
  d.lieutenants.forEach((l, i) => {
    if (e.slain[i] == null && r.raiders.some((rd) => rd.kind === l.id && !rd.ally && rd.down)) slayLieutenant(s, i, r.enemy === 'siege' ? 'in the last siege' : 'before the walls');
  });
  if (r.enemy !== 'siege') return;
  const boss = r.raiders.find((rd) => (rd.kind === d.boss || LEGACY_AVATARS.includes(rd.kind)) && !rd.ally); // (an old save's siege was led by its Calamity's avatar)
  if (boss?.down) return victory(s, e, r, 'before the walls');
  e.lost++;
  const g = roll(s, 'sack', e.lost);
  const standing = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !b.room && !BUILDING_BY_ID[b.def]?.seat);
  for (let k = 0; k < SIEGE_BURN && standing.length; k++) setFire(s, standing.splice(g.int(0, standing.length - 1), 1)[0], true);
  // (the sack: its host goes through the streets before it draws off)
  const caught = s.people.filter((p) => p.away === null && p.id !== s.mainId && !p.undying);
  const slain = Math.round(caught.length * SACK_SLAIN);
  for (let k = 0; k < slain && caught.length; k++) killPerson(s, caught.splice(g.int(0, caught.length - 1), 1)[0], `cut down in the sack by ${d.short}'s host`);
  if (slain) notify(s, `${slain} of the town were cut down in the sack.`, true);
  if (e.lost >= SIEGES_TO_FALL) {
    e.stage = 'fallen';
    e.fell = s.tick;
    e.began.fallen = s.tick;
    log(s, e, `${capital(d.short)} broke the town`);
    queueScene(s, 'enemy_fallen', { vars: { enemy: d.name, seat: d.seat }, foes: { enemy: d.boss } });
    s.gameOver = { tick: s.tick, text: `${capital(d.name)} broke the town at its second siege. Its people are scattered, its houses burnt, and the land is ${d.short}'s. Somewhere a descendant remembers.` };
    return;
  }
  e.stage = 'march';
  e.plan = PLAN_AT.siege - SIEGE_REGROUP;
  e.lastHost = s.tick;
  tell(s, e, `${capital(d.short)} draws back`, `The town held, barely, but ${d.name} was not struck down. It draws back to gather its host, and the town burns behind it. It will come again, and a second siege lost will be the end.`, 'enemy_repelled');
  log(s, e, `The town held the last siege, but ${d.short} lived`);
}

/** The Enemy is slain: the lasting peace, its relic, a monument, a title for the town and its slayer. */
function victory(s: GameState, e: GreatEnemyState, r: Raid | null, where: string): void {
  const d = enemyDef(e);
  e.stage = 'peace';
  e.beaten = s.tick;
  e.began.peace = s.tick;
  e.siegeAt = undefined;
  calamityLifts(s);
  e.creep = undefined;
  // who struck hardest (the siege's tally) or the party's best, else the town's best fighter
  const tally = r?.tally ? Object.entries(r.tally).filter(([id]) => Number(id) >= 0).sort((a, b) => b[1].dealt - a[1].dealt)[0] : undefined;
  const slayer = (tally && s.people.find((p) => p.id === Number(tally[0]))) ?? s.people.slice().sort((a, b) => b.skills.melee.level + b.skills.ranged.level - (a.skills.melee.level + a.skills.ranged.level) || a.id - b.id)[0];
  e.title = `the Bane of ${d.short.replace(/^the /, '')}`;
  if (slayer) {
    e.slayer = slayer.name;
    (slayer.titles ??= []).push(`${capital(d.short.replace(/^the /i, ''))}'s Bane`);
  }
  s.items[d.trophy] = (s.items[d.trophy] ?? 0) + 1;
  for (const id of e.thralls ?? []) {
    const f = (s.factions ?? []).find((q) => q.id === id);
    if (f && f.stance !== 'destroyed') {
      f.stance = 'neutral';
      f.since = s.tick;
      f.host = undefined;
      f.attitude = 10;
    }
  }
  (s.marks ??= []).push({ lever: 'morale', value: PEACE_MORALE, until: s.tick + PEACE_DAYS * TICKS_PER_DAY, text: `${capital(d.name)} is dead!` });
  // (the monument stands at once on open ground, the town raising it in its joy; over the wild it waits on the builders)
  const spot = findSpot(s, BUILDING_BY_ID[MONUMENT]);
  if (spot?.wild) placeBlueprint(s, MONUMENT, spot.x, spot.y, false, false, true);
  else if (spot) {
    const b: Building = { id: s.nextId++, def: MONUMENT, tile: spot.x, row: spot.y, status: 'done', delivered: {}, progress: 1, store: {} };
    s.buildings.push(b);
    connectRoad(s, b);
  }
  log(s, e, `${capital(d.name)} fell ${where}${slayer ? `, ${slayer.name} at the front` : ''}`);
  tell(s, e, `${capital(d.name)} is dead`, `${capital(d.name)} fell ${where}. Its host breaks and scatters, its blight fades from the land, and the powers that knelt to it are free. The town will be called ${e.title}${slayer ? `, and ${slayer.name} will be remembered for the blow` : ''}. A long peace begins.`, 'enemy_victory');
}

/* ------------------------------------------------------------ telling */

function tell(s: GameState, e: GreatEnemyState, title: string, story: string, scene?: string): void {
  const d = enemyDef(e);
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: story.split('. ')[0] + '.',
    story,
    picture: eventPicture(`enemy:${e.kind}:${e.stage}`, d.picture, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: ['We will stand'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  if (scene) queueScene(s, scene, { fallback: prompt, vars: { enemy: d.name, short: d.short, seat: d.seat }, foes: { enemy: d.boss, lt: d.lieutenants[0].id } });
  else s.prompts.push(prompt);
  notify(s, `${title}.`, true);
}

/* ------------------------------------------------------------ the view */

export interface GreatEnemyView {
  kind: EnemyKind;
  name: string;
  short: string;
  seat: string;
  goal: string;
  way: string;
  stage: EnemyStage;
  stageName: string;
  /** The plan (paced days), where the next stage comes, the pace, and about how many game days off it is. */
  plan: number;
  nextAt: number | null;
  nextName: string | null;
  pace: number;
  daysToNext: number | null;
  /** In words: what comes next. */
  next: string;
  omen: string | null;
  seatKnown: boolean;
  seatOpen: boolean;
  /** Where it sits on the world map, and how far its shadow reaches there (map px). */
  seatAt: { x: number; y: number };
  spread: number;
  colour: string;
  lieutenants: { name: string; outpost: string; slain: boolean; dest: string | null; at: { x: number; y: number } }[];
  thralls: string[];
  /** Its blight on the town's land (a cell and reach), for the minimap. */
  creep: { x: number; y: number; r: number } | null;
  siegeIn: number | null;
  lost: number;
  title: string | null;
  slayer: string | null;
  vengeance: string | null;
  log: { day: number; text: string }[];
  /** Its places on the Expedition Board now (the seat once found, the outposts while their lieutenants live). */
  dests: Destination[];
}

export function greatEnemyView(s: GameState): GreatEnemyView | null {
  const e = s.greatEnemy;
  if (!e || e.chosen < 0) return null;
  const d = enemyDef(e);
  const order: (keyof typeof PLAN_AT)[] = ['omens', 'stirring', 'march', 'siege'];
  const nextStage = order.find((k) => at(k) > at(e.stage));
  const nextAt = nextStage && !ended(e) ? PLAN_AT[nextStage] : null;
  const daysToNext = nextAt !== null ? Math.max(0, Math.ceil(((nextAt - e.plan) * DANGER_PACE) / Math.max(0.1, e.pace))) : null;
  const next = ended(e)
    ? e.stage === 'peace'
      ? `Slain. The town is ${e.title}.`
      : 'It broke the town.'
    : e.siegeAt !== undefined
      ? 'The last siege is coming.'
      : nextStage
        ? `${STAGE_LABEL[nextStage]} in about ${daysToNext} days.`
        : 'The last siege.';
  const progress = Math.min(1, e.plan / PLAN_AT.siege);
  return {
    kind: e.kind,
    name: capital(d.name),
    short: d.short,
    seat: d.seat,
    goal: d.goal,
    way: d.way,
    stage: e.stage,
    stageName: STAGE_LABEL[e.stage],
    plan: Math.round(e.plan * 10) / 10,
    nextAt,
    nextName: nextStage ? STAGE_LABEL[nextStage] : null,
    pace: Math.round(e.pace * 100) / 100,
    daysToNext,
    next,
    omen: e.omen ?? null,
    seatKnown: e.seatFound !== undefined,
    seatOpen: seatOpen(s),
    seatAt: SEAT_SPOTS[e.kind],
    spread: past(e, 'stirring') && !ended(e) ? Math.round(30 + 200 * progress) : e.stage === 'fallen' ? 260 : 0,
    colour: d.colour,
    lieutenants: d.lieutenants.map((l, i) => ({ name: capital(l.name), outpost: capital(l.outpost), slain: e.slain[i] != null, dest: e.outposts && e.slain[i] == null && !ended(e) ? OUTPOST_DEST(e.kind, i) : null, at: outpostSpot(e.kind, i) })),
    thralls: (e.thralls ?? []).map((id) => { const f = (s.factions ?? []).find((q) => q.id === id); return f ? defOf(f).name : id; }),
    creep: e.creep ?? null,
    siegeIn: e.siegeAt !== undefined ? Math.max(0, Math.ceil((e.siegeAt - s.tick) / TICKS_PER_HOUR)) : null,
    lost: e.lost,
    title: e.title ?? null,
    slayer: e.slayer ?? null,
    vengeance: e.vengeance ?? null,
    log: e.log.slice(-8),
    dests: enemyDestinations(s),
  };
}

/* ------------------------------------------------------------ previews and tests */

/** Bring the Enemy straight to a stage (a preview's `__enemy` in mobileBridge.ts, and the tests): chosen if it isn't
 *  (of `kind`), its plan set to the stage's, each stage passed through on the way; the siege comes within the hour. */
export function forceEnemy(s: GameState, to: Exclude<EnemyStage, 'dormant' | 'peace' | 'fallen'> = 'siege', kind?: EnemyKind): GreatEnemyState {
  const e = s.greatEnemy && s.greatEnemy.chosen >= 0 && (!kind || s.greatEnemy.kind === kind) ? s.greatEnemy : chooseEnemy(s, kind);
  e.plan = Math.max(e.plan, PLAN_AT[to]);
  for (const stage of ['omens', 'stirring', 'march'] as const) if (at(stage) <= at(to)) setStage(s, e, stage);
  if (to === 'siege' && e.siegeAt === undefined) {
    warnSiege(s, e);
    e.siegeAt = s.tick;
  }
  calamitySync(s, e);
  return e;
}

/* ------------------------------------------------------------ an old save's Calamity */

/** A save from when the Calamity ran its own clock and siege (it has no `driven`): its dread becomes the Enemy's plan,
 *  its stage the Enemy's stage (passed quietly, nothing told twice), its sieges lost the Enemy's, and a siege or an army
 *  already on the land is the Enemy's. Once only; the Enemy is chosen first if the save is from before there was one
 *  (of the kind that brings that Calamity). */
export function bindCalamity(s: GameState, e0?: GreatEnemyState): void {
  const c = s.calamity;
  if (!c || c.driven) return;
  c.driven = true;
  let e = e0;
  if (!e) e = s.greatEnemy && s.greatEnemy.chosen >= 0 ? s.greatEnemy : chooseEnemy(s, enemyKindFor(s, c.kind));
  if (c.beaten !== undefined || ended(e)) return; // (the game is already won, or lost)
  c.kind = ENEMY_CALAMITY[e.kind]; // (the Enemy's, if it was drawn first and brings another)
  const lost = Math.min(SIEGES_TO_FALL - 1, c.lost ?? 0);
  e.lost = Math.max(e.lost, lost);
  const sieging = c.siegeAt !== undefined || s.raid?.calamity === 'siege';
  e.plan = Math.max(e.plan, sieging ? PLAN_AT.siege : (c.dread * PLAN_AT.siege) / 100);
  if (sieging && e.siegeAt === undefined) e.siegeAt = c.siegeAt ?? s.tick;
  // (the stages it has reached, quietly)
  const to = e.siegeAt !== undefined || sieging ? 'siege' : e.plan >= PLAN_AT.march ? 'march' : e.plan >= PLAN_AT.stirring ? 'stirring' : e.plan >= PLAN_AT.omens ? 'omens' : 'dormant';
  for (const stage of STAGE_ORDER) {
    if (at(stage) > at(to) || at(stage) <= at(e.stage) || at(stage) > at('siege')) continue;
    e.stage = stage;
    e.began[stage] = s.tick;
    if (stage === 'stirring') {
      e.outposts = true;
      e.creep ??= creepSpot(s, e);
      if (e.seatFound === undefined) e.seatFound = s.tick;
    }
  }
  if (s.raid?.calamity) {
    s.raid.enemy = s.raid.calamity === 'siege' ? 'siege' : 'mark';
    s.raid.calamity = undefined;
  }
  c.siegeAt = undefined;
  c.dread = Math.min(100, Math.round(((e.plan * 100) / PLAN_AT.siege) * 10) / 10);
  c.stage = Math.max(c.stage, stageOfEnemy(e)) as typeof c.stage;
  log(s, e, `${capital(CALAMITIES[c.kind].name)} is ${enemyDef(e).short}'s doing: the two are one story now`);
}
