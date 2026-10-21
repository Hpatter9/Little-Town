// The arena (data/arena.ts has the numbers). `s.arena` (`ArenaState`). With an Arena standing, the town runs a fighting
// season (`arenaHourly`, autopilot on; its own side streams): on each of the first `SEASON_DAYS` days of every season
// but winter, a bout is posted at `CARD_HOUR` (`postCard`): one of the town's fighters (rested, fit, keen: never the
// founder), or every other day a grown beast of the ranch (sim/ranch.ts), against a visiting champion of a power the town
// knows (or a wanderer of the road), matched close (`MATCH_LEAST`..`MATCH_MOST` of the town's might). The book opens:
// townsfolk bet from their purses by their natures, and the player may bet from the treasury (the `arenaBet` command)
// until `BOUT_HOUR`, when the bout is fought (`startBout`) on the FF fight screen, watchable (`s.watching` the bout's id:
// `arenaTrip`). Each side yields under `YIELD` of its health; only one struck down outright may die. The bout's end
// (`endBout`): purses, the book settled, the gate's takings, renown for the venues and travellers drawn in, the ladder
// (`s.arena.ladder`), deeds and, at the season's end, its crown (`crown`). A knights' tournament's jousts count on the
// ladder too (`noteJousts`, from sim/chivalry.ts).

import {
  ARENA_AWAY, ARENA_DEATH, ARENA_PEOPLE, arenaDestination, BEAST_DEATH, BET_KEEP, BET_LEAN, BET_LEAST, BET_MOST, BET_SHARE, BOUT_HOUR, BOUT_IDS, BOUT_LINGER, BOUT_TRAVELLERS,
  CARD_HOUR, CHAMPION_NAMES, CROWN_PRIZE, EPITHETS, GATE_BASE, GATE_PER_PERSON, GATE_PER_SOCIAL, HOUSE_CUT, KO_POINTS, LOSER_PURSE, LOSS_POINTS, MATCH_LEAST, MATCH_MOST, PAYS_LEAST,
  PAYS_MOST, PURSE, RENOWN_FADE, RENOWN_LOSS, RENOWN_MOST, RENOWN_WIN, REST_DAYS, SEASON_DAYS, VISITOR_DEATH, WANDERERS, WIN_POINTS, YIELD,
} from '../data/arena';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES, natureOf } from '../data/enemies';
import { FACTION_DEFS } from '../data/factions';
import { RAID_KIND_BY_ID } from '../data/raids';
import { levelOf, xpToLevel } from '../data/levels';
import { natureOf as personNature } from '../data/natures';
import type { Material } from '../data/materials';
import { tierOf } from '../data/taming';
import { hashSeed, Rng } from '../rng';
import { isUnlocked, placeBlueprint, totalStock, unlockInfo } from './buildings';
import { matchupOf, powerOfFighter, powerOfPerson, type Matchup } from './power';
import { personFighter, startBattle, stepBattle, unitFighter, type Fighter } from './combat';
import { addDeed } from './deeds';
import { raidOf } from './factions';
import { killPerson, knockDown } from './health';
import { woundFor, woundPerson } from './injuries';
import { operatorOf } from './operators';
import { findSpot } from './planner';
import { beastMight, beastTier, grown, ranchOf, type RanchBeast } from './ranch';
import { isChild } from './social';
import { earn, maxHp, meet, notify, type Expedition, type FightResult, type GameState, type Person } from './state';
import { tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';

export interface Entrant {
  /** 'p<id>' a townsperson, 'b<id>' a ranch beast, 'v:<name>' a visitor. */
  key: string;
  name: string;
  side: 'town' | 'beast' | 'visitor';
  /** Their people or town, for a visitor; a beast's kind. */
  from?: string;
  wins: number;
  losses: number;
  points: number;
  kos: number;
}

export interface Bet {
  /** A person's id, or -1 the treasury. */
  who: number;
  name: string;
  on: 'town' | 'visitor';
  amount: number;
}

export interface ArenaCard {
  id: number;
  kind: 'champion' | 'beasts';
  /** When the bout is fought (tick). */
  at: number;
  town: { kind: 'person' | 'beast'; id: number; name: string; beast?: string };
  visitor: { name: string; kind: string; from: string; scale: number };
  /** The town's side's chance, as the book has it, and the odds each side pays. */
  odds: number;
  pays: { town: number; visitor: number };
  bets: Bet[];
  final?: boolean;
}

export interface ArenaBout {
  id: number;
  card: ArenaCard;
  e: Expedition;
  started: number;
  ended?: number;
  outcome?: 'won' | 'lost';
}

export interface BoutRecord {
  day: number;
  town: string;
  visitor: string;
  from: string;
  won: boolean;
  ko: boolean;
  died?: string;
  pot: number;
}

export interface ArenaState {
  /** The season under way ('<year>:<season>'), and how many have been held. */
  season: string | null;
  seasons: number;
  ladder: Entrant[];
  card: ArenaCard | null;
  bout: ArenaBout | null;
  past: BoutRecord[];
  champions: { season: string; name: string; side: Entrant['side']; from?: string }[];
  renown: number;
  next: number;
  /** When each townsperson or beast last fought ('p<id>' / 'b<id>'). */
  rested: Record<string, number>;
}

const PAST_KEPT = 10;
const CHAMPIONS_KEPT = 12;
const BEAST_REF = -800000;
const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const roll = (s: GameState, what: string) => new Rng(hashSeed(`${s.seed}:arena:${what}:${s.tick}`));

export const arenaOf = (s: GameState): ArenaState => (s.arena ??= { season: null, seasons: 0, ladder: [], card: null, bout: null, past: [], champions: [], renown: 0, next: 1, rested: {} });
export const arenaBuilt = (s: GameState) => s.buildings.some((b) => b.def === 'arena' && b.status === 'done');
/** The arena's renown, added to the venues' attractiveness (shop.ts). */
export const arenaRenown = (s: GameState) => Math.floor(s.arena?.renown ?? 0);

/** Whether today is a bout day of the season. */
export function seasonDay(tick: number): boolean {
  const c = calendar(tick);
  return c.season !== 'winter' && c.dayOfSeason <= SEASON_DAYS;
}
const seasonKey = (tick: number) => {
  const c = calendar(tick);
  return `${c.year}:${c.season}`;
};
const seasonName = (key: string) => {
  const [y, season] = key.split(':');
  return `the ${season} season of year ${y}`;
};

/** A bout shaped as a trip, for the watched fight (snapshot.ts); undefined when there's none by that id. */
export const arenaTrip = (s: GameState, id: number | undefined): Expedition | undefined => (id !== undefined && s.arena?.bout?.id === id ? s.arena.bout.e : undefined);

/* ------------------------------------------------------------ the hour and the tick */

export function arenaHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  const hour = calendar(s.tick).hour;
  if (hour === CARD_HOUR - 1) buildArena(s);
  const built = arenaBuilt(s);
  if (!s.arena && !built) return;
  const a = arenaOf(s);
  if (hour === 6 && !seasonDay(s.tick)) a.renown = Math.max(0, a.renown - RENOWN_FADE);
  if (!built) return;
  if (hour === CARD_HOUR && seasonDay(s.tick) && !a.card && !a.bout && !tourneyToday(s)) postCard(s);
  if (hour === BOUT_HOUR && a.card && !a.bout) startBout(s);
}

/** Every tick: the bout under way fights a beat; over, it's settled; its result lingers a moment for the screen. */
export function arenaTick(s: GameState): void {
  const bout = s.arena?.bout;
  if (!bout) return;
  if (bout.ended !== undefined) {
    if (s.tick - bout.ended >= BOUT_LINGER) {
      s.arena!.bout = null;
      if (s.watching === bout.id) s.watching = undefined;
    }
    return;
  }
  const b = bout.e.battle;
  if (!b) return endBout(s, bout, 'lost', false);
  stepBattle(b, roll(s, `bout:${bout.id}`), { retreatAt: YIELD, mainId: null });
  const visitor = b.fighters.filter((f) => f.side === 'enemy');
  // (the visitor yields, too, short of being struck down)
  if (!b.outcome && visitor.every((f) => f.down || f.hp < f.maxHp * YIELD)) b.outcome = 'won';
  if (b.outcome) endBout(s, bout, b.outcome === 'won' ? 'won' : 'lost', b.outcome === 'won' ? visitor.every((f) => f.down) : b.fighters.filter((f) => f.side === 'party').every((f) => f.down));
}

function tourneyToday(s: GameState): boolean {
  const t = s.order?.lastTourney;
  return t !== undefined && t >= 0 && Math.floor(t / TICKS_PER_DAY) === Math.floor(s.tick / TICKS_PER_DAY);
}

/** The town raises an arena once it's big enough. */
export function buildArena(s: GameState): void {
  const def = BUILDING_BY_ID.arena;
  if (!def || !isUnlocked(unlockInfo(s), def) || s.buildings.some((b) => b.def === 'arena')) return;
  if (s.people.filter((p) => !isChild(p)).length < ARENA_PEOPLE) return;
  const stock = totalStock(s);
  if (!Object.entries(def.cost).every(([m, n]) => (stock[m as Material] ?? 0) >= (n ?? 0) * 1.5)) return;
  const at = findSpot(s, def);
  if (at && placeBlueprint(s, def.id, at.x, at.y, false, false, !!at.wild).ok) notify(s, 'The town lays out an arena: a ring, and banks for a crowd.');
}

/* ------------------------------------------------------------ the card */

/** How strong a fighter is, for matching and the book. */
function might(f: Fighter): number {
  return f.maxHp * ((f.damage[0] + f.damage[1]) / 2) * Math.max(0.2, f.accuracy) / Math.max(1, f.interval);
}

function townFighters(s: GameState): Person[] {
  const a = arenaOf(s);
  return s.people
    .filter((p) => p.away === null && !p.downed && !isChild(p) && p.id !== s.mainId && p.skirmish === undefined && !p.sick && p.hp >= maxHp(p) * 0.8 && s.tick - (a.rested[`p${p.id}`] ?? -1e9) >= REST_DAYS * TICKS_PER_DAY)
    .sort((x, y) => keen(y) - keen(x) || x.id - y.id);
}
const keen = (p: Person) => levelOf(p) + (p.ambition === 'adventurer' || p.ambition === 'guard' ? 4 : 0) + (p.guard ? 2 : 0) + Math.max(p.skills.melee?.level ?? 0, p.skills.ranged?.level ?? 0) / 4;

function ranchFighters(s: GameState): RanchBeast[] {
  const a = arenaOf(s);
  return (s.ranch?.beasts ?? [])
    .filter((b) => grown(s, b) && b.sick === undefined && b.hp >= 0.8 && b.job !== 'ride' && s.tick - (a.rested[`b${b.id}`] ?? -1e9) >= REST_DAYS * TICKS_PER_DAY)
    .sort((x, y) => beastTier(y) * beastMight(y).damage - beastTier(x) * beastMight(x).damage || x.id - y.id);
}

export function beastFighter(b: RanchBeast): Fighter {
  const f = unitFighter(b.kind, 'party', BEAST_REF - b.id);
  const m = beastMight(b);
  f.name = b.name;
  f.maxHp = Math.round(f.maxHp * m.hp);
  f.hp = Math.max(1, Math.round(f.maxHp * b.hp));
  f.damage = [Math.round(f.damage[0] * m.damage), Math.round(f.damage[1] * m.damage)];
  f.interval = Math.max(1, Math.round(f.interval * m.speed));
  return f;
}

/** Power levels of the two sides on a card (sim/power.ts), and how the town's side matches the visitor. */
function cardPower(s: GameState, card: ArenaCard): { power: { town: number; visitor: number }; matchup: Matchup } {
  const p = card.town.kind === 'person' ? s.people.find((q) => q.id === card.town.id) : undefined;
  const b = card.town.kind === 'beast' ? (s.ranch?.beasts ?? []).find((q) => q.id === card.town.id) : undefined;
  const town = p ? powerOfPerson(p) : b ? powerOfFighter(beastFighter(b)) : 0;
  const visitor = powerOfFighter(visitorFighter(card.visitor.kind, card.visitor.scale, card.visitor.name));
  return { power: { town, visitor }, matchup: matchupOf(town, visitor) };
}

function visitorFighter(kind: string, scale: number, name: string): Fighter {
  const f = unitFighter(kind, 'enemy', 0);
  f.name = name;
  f.maxHp = Math.max(1, Math.round(f.maxHp * scale));
  f.hp = f.maxHp;
  f.damage = [Math.max(1, Math.round(f.damage[0] * scale)), Math.max(1, Math.round(f.damage[1] * scale))];
  return f;
}

/** Who might come to fight: a champion of a power the town knows (or a wanderer), or a beast-keeper's beast. */
function pickVisitor(s: GameState, beasts: boolean, near: number, rng: Rng): { kind: string; from: string } | null {
  const powers = (s.factions ?? []).filter((f) => f.known && f.stance !== 'destroyed');
  if (beasts) {
    const pool = Object.values(ENEMIES).filter((d) => !d.boss && !d.kit && natureOf(d.id) === 'beast' && Math.abs(tierOf(d.hp) - near) <= 1.5);
    if (!pool.length) return null;
    const d = pool[rng.int(0, pool.length - 1)];
    const f = powers.length ? powers[rng.int(0, powers.length - 1)] : null;
    return { kind: d.id, from: f ? `a beast-keeper of ${FACTION_DEFS.find((x) => x.id === f.id)?.name ?? 'the realm'}` : 'a travelling menagerie' };
  }
  if (powers.length && rng.chance(0.8)) {
    const f = powers[rng.int(0, powers.length - 1)];
    const kind = RAID_KIND_BY_ID[raidOf(s, f)];
    const pool = Object.keys(kind?.enemies ?? {}).filter((k) => ENEMIES[k] && !ENEMIES[k].boss && !ENEMIES[k].kit && natureOf(k) !== 'beast');
    if (pool.length) return { kind: pool[rng.int(0, pool.length - 1)], from: FACTION_DEFS.find((x) => x.id === f.id)?.name ?? 'a far town' };
  }
  const pool = WANDERERS.filter((k) => ENEMIES[k] && !ENEMIES[k].boss && !ENEMIES[k].kit);
  return pool.length ? { kind: pool[rng.int(0, pool.length - 1)], from: 'the open road' } : null;
}

/** The day's bout is posted, and the book opens: the townsfolk place their bets. */
export function postCard(s: GameState): ArenaCard | null {
  const a = arenaOf(s);
  const key = seasonKey(s.tick);
  if (a.season !== key) {
    a.season = key;
    a.seasons++;
    a.ladder = [];
    notify(s, `The arena's season opens: ${seasonName(key)}. ${SEASON_DAYS} days of bouts, and a crown at the end.`, true);
  }
  const rng = roll(s, 'card');
  const d = calendar(s.tick).dayOfSeason;
  const beasts = ranchFighters(s);
  const people = townFighters(s);
  const beastDay = beasts.length > 0 && (d % 2 === 0 || !people.length);
  let town: ArenaCard['town'];
  let f: Fighter;
  if (beastDay) {
    const b = beasts[0];
    town = { kind: 'beast', id: b.id, name: b.name, beast: b.kind };
    f = beastFighter(b);
  } else if (people.length) {
    // (the keenest, but not always the same: one of the first three)
    const p = people[rng.int(0, Math.min(2, people.length - 1))];
    town = { kind: 'person', id: p.id, name: p.name };
    f = personFighter(p, 'fighter', 'front');
  } else return null;
  const v = pickVisitor(s, beastDay, beastDay ? beastTier({ kind: town.beast! }) : 0, rng);
  if (!v) return null;
  const base = unitFighter(v.kind, 'enemy', 0);
  const u = MATCH_LEAST + rng.next() * (MATCH_MOST - MATCH_LEAST);
  const scale = Math.max(0.3, Math.min(6, Math.sqrt((u * might(f)) / Math.max(0.01, might(base)))));
  const name = beastDay ? `${CHAMPION_NAMES[rng.int(0, CHAMPION_NAMES.length - 1)]}'s ${ENEMIES[v.kind].name.toLowerCase()}` : `${CHAMPION_NAMES[rng.int(0, CHAMPION_NAMES.length - 1)]} ${EPITHETS[rng.int(0, EPITHETS.length - 1)]}`;
  const odds = 1 / (1 + u ** 1.6);
  const pays = (p: number) => Math.round(Math.max(PAYS_LEAST, Math.min(PAYS_MOST, (1 / p) * (1 - HOUSE_CUT))) * 10) / 10;
  const card: ArenaCard = {
    id: BOUT_IDS + a.next++,
    kind: beastDay ? 'beasts' : 'champion',
    at: s.tick + (BOUT_HOUR - CARD_HOUR) * TICKS_PER_HOUR,
    town,
    visitor: { name, kind: v.kind, from: v.from, scale: Math.round(scale * 100) / 100 },
    odds: Math.round(odds * 100) / 100,
    pays: { town: pays(odds), visitor: pays(1 - odds) },
    bets: [],
    ...(d >= SEASON_DAYS ? { final: true } : {}),
  };
  a.card = card;
  townsfolkBet(s, card, rng);
  const pot = card.bets.reduce((n, b) => n + b.amount, 0);
  notify(s, `At the arena tonight: ${town.name}${town.beast ? ` the ${ENEMIES[town.beast].name.toLowerCase()}` : ''} against ${name} of ${v.from}. ${card.pays.town}:1 on the town, ${card.pays.visitor}:1 on the visitor${pot ? `; ${pot} coins already on it` : ''}.`);
  return card;
}

function townsfolkBet(s: GameState, card: ArenaCard, rng: Rng): void {
  for (const p of s.people) {
    if (p.away !== null || isChild(p) || p.id === card.town.id && card.town.kind === 'person') continue;
    const spare = (p.coins ?? 0) - BET_KEEP;
    if (spare < BET_LEAST) continue;
    const nature = personNature(p).id;
    if (!rng.chance(BET_LEAN[nature] ?? 0.2)) continue;
    const amount = Math.max(BET_LEAST, Math.min(BET_MOST, Math.floor(spare * BET_SHARE)));
    // (most back the town; the greedy back whoever the book favours)
    const on: Bet['on'] = nature === 'greedy' ? (card.odds >= 0.5 ? 'town' : 'visitor') : rng.chance(0.75) ? 'town' : 'visitor';
    p.coins = (p.coins ?? 0) - amount;
    card.bets.push({ who: p.id, name: p.name, on, amount });
  }
}

/** The treasury's bet (the player's): replaces any bet it has on the card; 0 takes it back. */
export function arenaBet(s: GameState, on: Bet['on'], amount: number): boolean {
  const card = s.arena?.card;
  if (!card || s.arena?.bout || !Number.isFinite(amount) || amount < 0) return false;
  const old = card.bets.find((b) => b.who === -1);
  const back = old?.amount ?? 0;
  if (amount > (s.coins ?? 0) + back) return false;
  if (old) {
    s.coins = (s.coins ?? 0) + back;
    earn(s, 'arena', back);
    card.bets = card.bets.filter((b) => b !== old);
  }
  if (amount > 0) {
    s.coins = (s.coins ?? 0) - amount;
    earn(s, 'arena', -amount);
    card.bets.push({ who: -1, name: 'The treasury', on, amount: Math.floor(amount) });
  }
  return true;
}

/* ------------------------------------------------------------ the bout */

/** The bout begins: the town's fighter steps into the ring (away from the map while it lasts). */
export function startBout(s: GameState): ArenaBout | null {
  const a = arenaOf(s);
  const card = a.card;
  if (!card) return null;
  const rng = roll(s, `start:${card.id}`);
  const p = card.town.kind === 'person' ? s.people.find((q) => q.id === card.town.id) : undefined;
  const beast = card.town.kind === 'beast' ? s.ranch?.beasts.find((b) => b.id === card.town.id) : undefined;
  const ready = p ? p.away === null && !p.downed && p.skirmish === undefined && !s.raid : !!beast && beast.sick === undefined && !s.raid;
  if (!ready) {
    // (no fighter, no bout: the bets go back)
    for (const b of card.bets) refund(s, b);
    a.card = null;
    notify(s, `Tonight's bout at the arena is called off: ${card.town.name} can't fight. The bets are handed back.`);
    return null;
  }
  const e: Expedition = {
    id: card.id,
    dest: `arena:${card.id}`,
    members: p ? [p.id] : [],
    phase: 'work',
    elapsed: 0,
    outTicks: 1,
    workTicks: 1,
    backTicks: 1,
    work: 0,
    loot: {},
    supplies: {},
    recalled: false,
    roles: p ? { [p.id]: 'fighter' as const } : {},
    stance: 'balanced',
    battle: null,
    prompt: null,
    rolled: { outEvent: true, backEvent: true, ambush: true },
    waterskins: 0,
  };
  e.battle = startBattle(p ? [p] : [], e.roles, {}, rng);
  if (beast) e.battle.fighters.push({ ...beastFighter(beast), cooldown: rng.int(1, 10) });
  const v = visitorFighter(card.visitor.kind, card.visitor.scale, card.visitor.name);
  v.cooldown = rng.int(1, v.interval);
  e.battle.fighters.push(v);
  meet(s, [card.visitor.kind]);
  if (p) {
    p.away = ARENA_AWAY;
    p.task = null;
  }
  a.rested[`${card.town.kind === 'person' ? 'p' : 'b'}${card.town.id}`] = s.tick;
  const bout: ArenaBout = { id: card.id, card, e, started: s.tick };
  a.bout = bout;
  a.card = null;
  (s.marks ??= []).push({ lever: 'travellers', value: BOUT_TRAVELLERS, until: s.tick + TICKS_PER_DAY / 2, text: 'A bout at the arena draws crowds' });
  notify(s, `The crowd roars: ${card.town.name} steps into the arena against ${card.visitor.name}!`, true);
  return bout;
}

function refund(s: GameState, b: Bet): void {
  if (b.who === -1) {
    s.coins = (s.coins ?? 0) + b.amount;
    earn(s, 'arena', b.amount);
    return;
  }
  const p = s.people.find((q) => q.id === b.who);
  if (p) p.coins = (p.coins ?? 0) + b.amount;
}

function entrant(a: ArenaState, key: string, name: string, side: Entrant['side'], from?: string): Entrant {
  let e = a.ladder.find((x) => x.key === key);
  if (!e) a.ladder.push((e = { key, name, side, wins: 0, losses: 0, points: 0, kos: 0, ...(from ? { from } : {}) }));
  e.name = name;
  return e;
}

/** The bout is over: the fighter's harm carried back, a death now and then, purses, the book, the gate, the ladder. */
export function endBout(s: GameState, bout: ArenaBout, outcome: 'won' | 'lost', ko: boolean): void {
  const a = arenaOf(s);
  const card = bout.card;
  const b = bout.e.battle;
  const rng = roll(s, `end:${bout.id}`);
  const won = outcome === 'won';
  const result: FightResult = { tick: s.tick, outcome: won ? 'won' : 'lost', members: [], loot: {}, coins: 0, foes: [card.visitor.name], boss: null };
  const ours = b?.fighters.find((f) => f.side === 'party');
  const theirs = b?.fighters.find((f) => f.side === 'enemy');
  let died: string | undefined;
  if (card.town.kind === 'person') {
    const p = s.people.find((q) => q.id === card.town.id);
    if (p) {
      if (p.away === ARENA_AWAY) p.away = null;
      const from = levelOf(p);
      const xpFrom = p.lvXp ?? 0;
      const was = p.hp;
      if (ours) {
        if (ours.down) knockDown(s, p);
        else p.hp = Math.max(1, Math.min(maxHp(p), Math.round((ours.hp * maxHp(p)) / Math.max(1, ours.maxHp))));
        const harm = ours.down ? Math.max(was, maxHp(p) * 0.5) : was - p.hp;
        if (harm > 0) woundPerson(s, p, harm, (sev) => woundFor(card.visitor.kind, sev, rng), rng);
        if (ours.attacks) gainSkill(p, ours.ranged ? 'ranged' : 'melee', ours.attacks * (won ? 10 : 6));
      }
      const to = levelOf(p);
      let xp = (p.lvXp ?? 0) - xpFrom;
      for (let l = from; l < to; l++) xp += xpToLevel(l);
      result.members.push({ id: p.id, name: p.name, xp: Math.round(xp), levelFrom: from, levelTo: to, down: !!ours?.down });
      p.coins = (p.coins ?? 0) + (won ? PURSE : LOSER_PURSE);
      result.coins = won ? PURSE : LOSER_PURSE;
      if (won) addDeed(p, 'bouts');
      if (ours?.down && rng.chance(ARENA_DEATH)) {
        died = p.name;
        killPerson(s, p, `fell in the arena, fighting ${card.visitor.name} of ${card.visitor.from}`);
      }
    }
  } else {
    const beast = s.ranch?.beasts.find((x) => x.id === card.town.id);
    if (beast && ours) {
      beast.hp = ours.down ? 0.2 : Math.max(0.2, ours.hp / Math.max(1, ours.maxHp));
      beast.xp += won ? 25 : 10;
      if (won) beast.wins++;
      else beast.losses++;
      if (won) {
        s.coins = (s.coins ?? 0) + PURSE;
        earn(s, 'arena', PURSE);
        result.coins = PURSE;
      }
      if (ours.down && rng.chance(BEAST_DEATH)) {
        died = beast.name;
        const r = ranchOf(s);
        r.beasts = r.beasts.filter((x) => x !== beast);
        r.died++;
        r.log.unshift(`Day ${day(s)}: ${beast.name} died in the arena.`);
      }
    }
  }
  if (theirs?.down && rng.chance(VISITOR_DEATH)) died = died ? `${died} and ${card.visitor.name}` : card.visitor.name;
  // the book
  const winner: Bet['on'] = won ? 'town' : 'visitor';
  const pot = card.bets.reduce((n, x) => n + x.amount, 0);
  for (const bet of card.bets) {
    if (bet.on !== winner) continue;
    const paid = Math.floor(bet.amount * card.pays[winner]);
    if (bet.who === -1) {
      s.coins = (s.coins ?? 0) + paid;
      earn(s, 'arena', paid);
      notify(s, `The treasury's bet comes in: ${paid} coins back on ${bet.amount}.`, true);
    } else {
      const p = s.people.find((q) => q.id === bet.who);
      if (p) p.coins = (p.coins ?? 0) + paid;
    }
  }
  // the gate, and the renown
  const keeper = operatorOf(s, 'arena');
  const grownUps = s.people.filter((p) => !isChild(p)).length;
  const gate = Math.round((GATE_BASE + grownUps * GATE_PER_PERSON) * (1 + (keeper?.skills.social?.level ?? 0) * GATE_PER_SOCIAL) * (1 + a.renown / 30));
  s.coins = (s.coins ?? 0) + gate;
  earn(s, 'arena', gate);
  a.renown = Math.min(RENOWN_MOST, a.renown + (won ? RENOWN_WIN : RENOWN_LOSS));
  // the ladder
  const tKey = card.town.kind === 'person' ? `p${card.town.id}` : `b${card.town.id}`;
  const t = entrant(a, tKey, card.town.name, card.town.kind === 'person' ? 'town' : 'beast', card.town.beast ? ENEMIES[card.town.beast]?.name : undefined);
  const v = entrant(a, `v:${card.visitor.name}`, card.visitor.name, 'visitor', card.visitor.from);
  const [w, l] = won ? [t, v] : [v, t];
  w.wins++;
  w.points += WIN_POINTS + (ko ? KO_POINTS : 0);
  if (ko) w.kos++;
  l.losses++;
  l.points += LOSS_POINTS;
  a.past.unshift({ day: day(s), town: card.town.name, visitor: card.visitor.name, from: card.visitor.from, won, ko, pot, ...(died ? { died } : {}) });
  if (a.past.length > PAST_KEPT) a.past.length = PAST_KEPT;
  notify(s, `At the arena, ${won ? `${card.town.name} beats ${card.visitor.name}` : `${card.visitor.name} of ${card.visitor.from} beats ${card.town.name}`}${ko ? ', struck down' : ''}${died ? `. ${died} did not get up again` : ''}. The gate took ${gate} coins.`, true);
  bout.outcome = outcome;
  bout.ended = s.tick;
  bout.e.result = result;
  bout.e.battle = null;
  if (card.final) crown(s);
}

/** The season's end: the top of the ladder takes the crown. */
export function crown(s: GameState): Entrant | null {
  const a = arenaOf(s);
  const top = [...a.ladder].sort((x, y) => y.points - x.points || y.wins - x.wins || x.losses - y.losses || x.key.localeCompare(y.key))[0];
  if (!top || !a.season) return null;
  a.champions.unshift({ season: a.season, name: top.name, side: top.side, ...(top.from ? { from: top.from } : {}) });
  if (a.champions.length > CHAMPIONS_KEPT) a.champions.length = CHAMPIONS_KEPT;
  const when = seasonName(a.season);
  if (top.side === 'town') {
    const p = s.people.find((q) => `p${q.id}` === top.key);
    if (p) {
      p.coins = (p.coins ?? 0) + CROWN_PRIZE;
      const title = 'Champion of the Arena';
      if (!(p.titles ??= []).includes(title)) p.titles.push(title);
      addDeed(p, 'bouts');
    }
    tellStory(s, 'Champion of the Arena', `The last bout of ${when} is fought, and the crowd carries ${top.name} round the ring on its shoulders: ${top.wins} won, ${top.losses} lost, ${top.points} points on the ladder. The crown is theirs, and ${CROWN_PRIZE} coins with it. The visiting champions go home with stories about this town.`, 'arena crowd champion victory', { who: p?.id });
  } else if (top.side === 'beast') {
    const b = s.ranch?.beasts.find((x) => `b${x.id}` === top.key);
    if (b) b.crowns = (b.crowns ?? 0) + 1;
    s.coins = (s.coins ?? 0) + CROWN_PRIZE;
    earn(s, 'arena', CROWN_PRIZE);
    tellStory(s, 'A Beast Takes the Crown', `${when[0].toUpperCase()}${when.slice(1)} ends with the crowd on its feet for ${top.name}, the ranch's ${top.from?.toLowerCase() ?? 'beast'}: ${top.wins} bouts won. The crown is hung on its pen, and the prize goes to the treasury.`, 'arena crowd beast victory');
  } else {
    tellStory(s, 'The Crown Leaves Town', `${top.name} of ${top.from} tops the ladder at the end of ${when}, and takes the arena's crown home. The town will be talking about it until next season, and training.`, 'arena crowd defeat');
  }
  notify(s, `${top.name} is Champion of the Arena for ${when}.`, true);
  return top;
}

/** A knights' tournament's jousts count on the ladder (from sim/chivalry.ts `tourney`), and fill the arena's gate. */
export function noteJousts(s: GameState, jousts: { p: Person; won: boolean }[]): void {
  if (!arenaBuilt(s) || !jousts.length) return;
  const a = arenaOf(s);
  if (a.season !== seasonKey(s.tick)) {
    a.season = seasonKey(s.tick);
    a.seasons++;
    a.ladder = [];
  }
  for (const { p, won } of jousts) {
    const e = entrant(a, `p${p.id}`, p.name, 'town');
    if (won) {
      e.wins++;
      e.points += WIN_POINTS;
      addDeed(p, 'bouts');
    } else e.losses++;
  }
  const gate = Math.round(GATE_BASE * 2 * (1 + a.renown / 30));
  s.coins = (s.coins ?? 0) + gate;
  earn(s, 'arena', gate);
  a.renown = Math.min(RENOWN_MOST, a.renown + RENOWN_WIN);
}

/* ------------------------------------------------------------ the menu */

export interface ArenaView {
  built: boolean;
  inSeason: boolean;
  season: string | null;
  seasons: number;
  renown: number;
  master: string | null;
  card: (Omit<ArenaCard, 'bets'> & { hoursLeft: number; bets: number; pot: number; treasury: { on: Bet['on']; amount: number } | null; backers: { town: number; visitor: number }; power: { town: number; visitor: number }; matchup: Matchup }) | null;
  bout: { id: number; town: string; visitor: string; from: string; over: boolean; won: boolean | null } | null;
  ladder: (Entrant & { rank: number })[];
  past: BoutRecord[];
  champions: ArenaState['champions'];
  /** Days until the next season's bouts, when out of season. */
  nextSeason: number | null;
}

export function arenaView(s: GameState): ArenaView | null {
  const a = s.arena;
  const built = arenaBuilt(s);
  if (!a && !built) return null;
  const st: ArenaState = a ?? { season: null, seasons: 0, ladder: [], card: null, bout: null, past: [], champions: [], renown: 0, next: 1, rested: {} };
  const card = st.card;
  let next: number | null = null;
  if (!seasonDay(s.tick)) for (let d = 1; d <= 40 && next === null; d++) if (seasonDay(s.tick + d * TICKS_PER_DAY)) next = d;
  const ranked = [...st.ladder].sort((x, y) => y.points - x.points || y.wins - x.wins || x.losses - y.losses || x.key.localeCompare(y.key));
  const master = operatorOf(s, 'arena');
  return {
    built,
    inSeason: seasonDay(s.tick),
    season: st.season ? seasonName(st.season) : null,
    seasons: st.seasons,
    renown: Math.floor(st.renown),
    master: master?.name ?? null,
    card: card
      ? {
          ...card,
          hoursLeft: Math.max(0, Math.ceil((card.at - s.tick) / TICKS_PER_HOUR)),
          bets: card.bets.length,
          pot: card.bets.reduce((n, b) => n + b.amount, 0),
          treasury: ((b) => (b ? { on: b.on, amount: b.amount } : null))(card.bets.find((b) => b.who === -1)),
          backers: { town: card.bets.filter((b) => b.on === 'town').length, visitor: card.bets.filter((b) => b.on === 'visitor').length },
          ...cardPower(s, card),
        }
      : null,
    bout: st.bout ? { id: st.bout.id, town: st.bout.card.town.name, visitor: st.bout.card.visitor.name, from: st.bout.card.visitor.from, over: st.bout.ended !== undefined, won: st.bout.outcome ? st.bout.outcome === 'won' : null } : null,
    ladder: ranked.map((e, i) => ({ ...e, rank: i + 1 })),
    past: st.past,
    champions: st.champions,
    nextSeason: next,
  };
}

export { arenaDestination };
