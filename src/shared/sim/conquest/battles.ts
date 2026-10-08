// Battles for a province (data/troops.ts: the board, the beats, the fates), in the manner of Symphony of War: each
// squad a piece on a BOARD_W x BOARD_H grid, the attackers from the west and the defenders in the east behind their
// fort's wall line, taking turns (a beat each: one side's squad, then the other's) to close and clash. A clash is
// resolved at once (auto, the owner's call for now): every troop of the striking squad lands a blow bettered by its
// hero's command and its kind's counters, melee on the front row and ranged on the back, the hero's own blow last, on
// whoever still stands; the struck squad strikes back at RIPOSTE. Troops are nameless and die; a squad routs at
// ROUT_AT of its worth or when its hero falls. A hero struck down is wounded, captured or killed (HERO_FATE, the
// founder FOUNDER_FATE); captives are ransomed or freed when the province is taken. Won, the province is the town's
// (a lair cleared); lost, the army falls back the way it came. Every roll is the seed's and the battle's own.

import { FACTION_BY_ID } from '../../data/factions';
import { declareWar, realm } from '../factions';
import { checkConquestWin } from './rivals';
import {
  ALL_TROOPS, BEAT_TICKS, BOARD_H, BOARD_W, CAPTAIN_BASE, CAPTAIN_MOST, CAPTAIN_PER_DAY, CAPTAIN_PER_TIER, COUNTERS, DEFENDERS_BY_TIER, FOUNDER_FATE, HERO_BLOW,
  HERO_FATE, HERO_HP, LAIR_SQUADS, MOVE, RANGED_SHARE, RANSOM_LEAST, RANSOM_PER_STRENGTH, REACH_RANGED, RIPOSTE, ROUT_AT, ROW_OF, SIEGE_PER_WALLS, SQUAD_SLOTS,
  TROOP_ATTACK, TROOP_HP, TROOPS, WALL_GUARD, WALL_HP, WALL_X, XP_LOST, XP_WON, type TroopDef,
} from '../../data/troops';
import { FORTS } from '../../data/conquest';
import { hashSeed, Rng } from '../../rng';
import { gainLevelXp } from '../classes';
import { killPerson } from '../health';
import { woundPerson } from '../injuries';
import { maxHp, notify, type GameState, type Person } from '../state';
import { paceDay, TICKS_PER_DAY } from '../time';
import { worldOf, type Army, type ConquestState, type Squad } from './conquest';
import { command, heroStrength, troopWorth } from './squads';
import type { ConquestWorld, Province } from './world';

export interface FieldTroop {
  troop: string;
  hp: number;
  max: number;
}
export interface FieldHero {
  name: string;
  /** The townsperson, or null for a foe's captain. */
  person: number | null;
  strength: number;
  command: number;
  hp: number;
  max: number;
}
export interface FieldSquad {
  id: number;
  side: 'town' | 'foe';
  /** The town's squad id, if the town's. */
  squad: number | null;
  name: string;
  hero: FieldHero | null;
  troops: (FieldTroop | null)[];
  x: number;
  y: number;
  /** What it marched in with, in worth (for the rout). */
  worthIn: number;
  out: 'routed' | 'fallen' | null;
}
export interface BattleEvent {
  tick: number;
  kind: 'move' | 'clash' | 'rout' | 'fall' | 'breach' | 'end';
  /** The acting squad, and the one struck. */
  from: number;
  to: number | null;
  text: string;
  /** A clash's harm done, and the riposte's. */
  harm?: number;
  back?: number;
}
export interface ProvinceBattle {
  id: number;
  province: number;
  army: number;
  started: number;
  /** Who held the province as the battle began (null: a lair). */
  holder?: string | null;
  /** Whose beat is next, the tick it falls on, and the turn count. */
  side: 'town' | 'foe';
  beat: number;
  turn: number;
  squads: FieldSquad[];
  /** The fort's walls left (0: breached or none). */
  walls: number;
  wallsMax: number;
  events: BattleEvent[];
  done: 'won' | 'lost' | null;
  endAt: number | null;
}
export interface Captive {
  hero: number;
  province: number;
  /** The realm that holds them (null: a lair's beasts keep nobody: they're never captured there). */
  by: string | null;
  ransom: number;
  since: number;
}
export interface BattleRecap {
  tick: number;
  province: string;
  won: boolean;
  turns: number;
  /** Troops lost and felled, the heroes' fates, and a few lines of the story. */
  lost: number;
  felled: number;
  fates: { name: string; fate: 'fought' | 'wounded' | 'captured' | 'killed' | 'routed' }[];
  lines: string[];
}

const EVENTS_KEPT = 16;
/** Beats without an end: the attack is called off. */
const STALEMATE_TURNS = 600;
/** A battle keeps its board 6 s after it ends, for the eyes. */
const END_SHOWN = 60;

export const battlesOf = (c: ConquestState): ProvinceBattle[] => (c.battles ??= []);
export const battleOfArmy = (c: ConquestState, armyId: number) => battlesOf(c).find((b) => b.army === armyId && !b.done) ?? null;
export const captivesOf = (c: ConquestState): Captive[] => (c.captives ??= []);
export const isCaptive = (c: ConquestState, p: Person) => captivesOf(c).some((x) => x.hero === p.id);
export const lairCleared = (c: ConquestState, province: number) => (c.cleared ?? []).includes(province);

/* ------------------------------------------------------------ starting */

const def = (id: string): TroopDef => ALL_TROOPS[id] ?? ALL_TROOPS.levies;
const worthOf = (q: FieldSquad) => (q.hero ? q.hero.strength * (q.hero.hp / q.hero.max) : 0) + q.troops.reduce((n, t) => n + (t ? troopWorth(def(t.troop)) * (t.hp / t.max) * (q.hero ? q.hero.command : 1) : 0), 0);
const alive = (q: FieldSquad) => !q.out && (q.troops.some((t) => t && t.hp > 0) || (q.hero && q.hero.hp > 0));

/** The town's squad as a piece. */
function fieldOf(s: GameState, q: Squad, id: number, x: number, y: number): FieldSquad | null {
  const p = s.people.find((x) => x.id === q.hero);
  if (!p) return null;
  const str = heroStrength(p);
  const hero: FieldHero = { name: p.name, person: p.id, strength: str, command: command(p), hp: str * HERO_HP * TROOP_HP, max: str * HERO_HP * TROOP_HP };
  const troops = q.slots.map((t) => (t && ALL_TROOPS[t] ? { troop: t, hp: ALL_TROOPS[t].hp, max: ALL_TROOPS[t].hp } : null));
  const f: FieldSquad = { id, side: 'town', squad: q.id, name: q.name, hero, troops, x, y, worthIn: 0, out: null };
  f.worthIn = worthOf(f);
  return f;
}
/** The province's defenders: a lair's beasts, or a settlement's garrison under captains of its realm. */
function defendersOf(s: GameState, c: ConquestState, p: Province, rng: Rng, from: number): FieldSquad[] {
  const out: FieldSquad[] = [];
  const holder = c.holder[p.id];
  const day = paceDay(s.tick);
  const place = (i: number, n: number) => ({ x: BOARD_W - 2 + (i % 2 === 0 ? 0 : 1) - (i >= 4 ? 1 : 0), y: Math.round(((i + 1) / (n + 1)) * (BOARD_H - 1)) });
  if (holder === null) {
    // a lair: beasts round their master
    for (let i = 0; i < LAIR_SQUADS; i++) {
      const troops: (FieldTroop | null)[] = Array(SQUAD_SLOTS).fill(null);
      for (let k = 0; k < 6 + Math.min(3, Math.floor(day / 6)); k++) troops[k] = { troop: 'lair_beasts', hp: 30, max: 30 };
      const str = Math.min(CAPTAIN_MOST, CAPTAIN_BASE + day * CAPTAIN_PER_DAY) * (i === 0 ? 1.2 : 0.6);
      const hero: FieldHero = { name: i === 0 ? 'The lair\'s master' : 'A great beast', person: null, strength: str, command: 1, hp: str * TROOP_HP, max: str * TROOP_HP };
      const at = place(i, LAIR_SQUADS);
      const f: FieldSquad = { id: from + i, side: 'foe', squad: null, name: i === 0 ? 'The lair\'s master' : 'The pack', hero, troops, x: at.x, y: at.y, worthIn: 0, out: null };
      f.worthIn = worthOf(f);
      out.push(f);
    }
    return out;
  }
  // a settlement: its realm's own troops where it has them, the garrison folk besides
  const origin = holder === 'town' ? s.origin ?? 'settlers' : FACTION_BY_ID[holder]?.origin ?? null;
  const own = TROOPS.filter((t) => t.origin && t.origin === origin && t.era === 'neolithic');
  const kinds = ['levies', 'town_guard', 'town_archers', ...(own.length ? [own[0].id] : []), ...(day > 8 ? ['spearmen'] : []), ...(day > 16 ? ['archers'] : [])];
  const n = DEFENDERS_BY_TIER[p.tier] ?? 1;
  const realmName = holder === 'town' ? 'the town' : FACTION_BY_ID[holder]?.name ?? holder;
  for (let i = 0; i < n; i++) {
    const troops: (FieldTroop | null)[] = Array(SQUAD_SLOTS).fill(null);
    const fill = 5 + Math.min(4, p.tier + Math.floor(day / 8));
    for (let k = 0; k < fill; k++) {
      const row = ROW_OF(k);
      const id = row === 2 ? (rng.chance(0.7) ? 'town_archers' : kinds[rng.int(0, kinds.length - 1)]) : row === 0 ? (rng.chance(0.5) ? 'town_guard' : kinds[rng.int(0, kinds.length - 1)]) : kinds[rng.int(0, kinds.length - 1)];
      const d = def(id);
      troops[k] = { troop: d.id, hp: d.hp, max: d.hp };
    }
    const str = Math.min(CAPTAIN_MOST, CAPTAIN_BASE + day * CAPTAIN_PER_DAY + p.tier * CAPTAIN_PER_TIER) * (i === 0 ? 1 : 0.75);
    const hero: FieldHero = { name: i === 0 ? `The captain of ${p.name}` : `A lieutenant of ${realmName}`, person: null, strength: str, command: 1 + 0.05 * p.tier + Math.min(0.5, day * 0.01), hp: str * TROOP_HP, max: str * TROOP_HP };
    const at = place(i, n);
    const f: FieldSquad = { id: from + i, side: 'foe', squad: null, name: i === 0 ? `${p.name}'s guard` : `${realmName}'s levy`, hero, troops, x: at.x, y: at.y, worthIn: 0, out: null };
    f.worthIn = worthOf(f);
    out.push(f);
  }
  return out;
}

/** An army arrived at a province held against it: the battle begins. */
export function startBattle(s: GameState, c: ConquestState, a: Army, province: number): ProvinceBattle | null {
  const w = worldOf(s);
  if (!w || battleOfArmy(c, a.id)) return null;
  const p = w.provinces[province];
  const rng = new Rng(hashSeed(`${s.seed}:pbattle:${s.tick}:${a.id}`));
  c.nextBattle ??= 1;
  const b: ProvinceBattle = { id: c.nextBattle++, province, army: a.id, started: s.tick, holder: c.holder[province], side: 'town', beat: s.tick + BEAT_TICKS, turn: 0, squads: [], walls: 0, wallsMax: 0, events: [], done: null, endAt: null };
  const squads = a.squads.map((id) => c.squads.find((q) => q.id === id)).filter((q): q is Squad => !!q);
  squads.forEach((q, i) => {
    const f = fieldOf(s, q, i + 1, i % 2, Math.round(((i + 1) / (squads.length + 1)) * (BOARD_H - 1)));
    if (f) b.squads.push(f);
  });
  if (!b.squads.length) return null;
  const foes = defendersOf(s, c, p, rng, 100);
  b.squads.push(...foes);
  const holder = c.holder[province];
  if (holder !== null) {
    b.wallsMax = FORTS[p.fort].walls * WALL_HP;
    b.walls = b.wallsMax;
    // storming a power's province is war
    const f = realm(s).find((x) => x.id === holder);
    if (f && f.stance !== 'war') declareWar(s, f, true);
  }
  battlesOf(c).push(b);
  notify(s, `${a.name} gives battle for ${p.name}: ${foes.length} squad${foes.length === 1 ? '' : 's'} hold it${b.walls ? ` behind the walls of its ${FORTS[p.fort].name.toLowerCase()}` : ''}.`, true);
  return b;
}

/* ------------------------------------------------------------ the beats */

export function battlesTick(s: GameState, c: ConquestState): void {
  const bs = c.battles;
  if (!bs?.length) return;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    if (b.done) {
      if (b.endAt !== null && s.tick >= b.endAt) bs.splice(i, 1);
      continue;
    }
    if (s.tick < b.beat) continue;
    b.beat = s.tick + BEAT_TICKS;
    takeBeat(s, c, b);
  }
}
const live = (b: ProvinceBattle, side: 'town' | 'foe') => b.squads.filter((q) => q.side === side && alive(q));
const dist = (a: FieldSquad, q: FieldSquad) => Math.max(Math.abs(a.x - q.x), Math.abs(a.y - q.y));
const rangedShare = (q: FieldSquad) => q.troops.filter((t) => t && def(t.troop).ranged).length / Math.max(1, q.troops.filter((t) => t).length);
const reachOf = (q: FieldSquad) => (rangedShare(q) >= RANGED_SHARE ? REACH_RANGED : 1);
const siegePower = (q: FieldSquad) => q.troops.reduce((n, t) => n + (t ? def(t.troop).walls ?? 0 : 0), 0);
const behindWalls = (b: ProvinceBattle, q: FieldSquad) => b.walls > 0 && q.side === 'foe' && q.x >= WALL_X;

function takeBeat(s: GameState, c: ConquestState, b: ProvinceBattle): void {
  const rng = new Rng(hashSeed(`${s.seed}:pbeat:${b.id}:${b.turn}`));
  const mine = live(b, b.side);
  const theirs = live(b, b.side === 'town' ? 'foe' : 'town');
  if (!mine.length || !theirs.length) return endBattle(s, c, b, theirs.length === 0 ? (b.side === 'town' ? 'won' : 'lost') : (b.side === 'town' ? 'lost' : 'won'));
  // the squad whose turn it is: round robin by the turn count
  const q = mine[Math.floor(b.turn / 2) % mine.length];
  b.turn++;
  b.side = b.side === 'town' ? 'foe' : 'town'; // (the other side acts next beat)
  // the nearest foe
  let target = theirs[0];
  for (const t of theirs) if (dist(q, t) < dist(q, target)) target = t;
  // at the wall line an attacker assaults over it (the walls' guard against them), as far as a bow reaches
  const atWall = q.side === 'town' && b.walls > 0 && q.x >= WALL_X - 1;
  const reach = atWall ? Math.max(reachOf(q), REACH_RANGED) : reachOf(q);
  // a long stand-off ends the attack
  if (b.turn > STALEMATE_TURNS) return endBattle(s, c, b, 'lost');
  // a siege squad before the walls batters them
  if (q.side === 'town' && b.walls > 0 && siegePower(q) > 0 && q.x >= WALL_X - 2) {
    b.walls = Math.max(0, b.walls - siegePower(q) * SIEGE_PER_WALLS);
    event(b, s.tick, b.walls > 0 ? 'clash' : 'breach', q.id, null, b.walls > 0 ? `${q.name} batter the walls.` : `${q.name} breach the walls!`);
    if (b.walls === 0) return;
    if (dist(q, target) > reach) return;
  }
  if (dist(q, target) <= reach) {
    clash(s, c, b, q, target, rng);
    return;
  }
  // close with it, round the others, never past the wall line while it stands
  const taken = new Set(b.squads.filter((x) => alive(x) && x !== q).map((x) => x.y * BOARD_W + x.x));
  let [x, y] = [q.x, q.y];
  for (let step = 0; step < MOVE; step++) {
    let best: [number, number] | null = null;
    let bestD = Math.max(Math.abs(x - target.x), Math.abs(y - target.y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= BOARD_W || ny >= BOARD_H || taken.has(ny * BOARD_W + nx)) continue;
      if (q.side === 'town' && b.walls > 0 && nx >= WALL_X) continue;
      if (q.side === 'foe' && b.walls > 0 && behindWalls(b, q) && nx < WALL_X) continue; // the garrison keeps its walls
      const d = Math.max(Math.abs(nx - target.x), Math.abs(ny - target.y));
      if (d < bestD) {
        bestD = d;
        best = [nx, ny];
      }
    }
    if (!best) break;
    [x, y] = best;
    if (bestD <= reach) break;
  }
  if (x !== q.x || y !== q.y) {
    q.x = x;
    q.y = y;
    event(b, s.tick, 'move', q.id, null, `${q.name} advance.`);
    if (dist(q, target) <= reach) clash(s, c, b, q, target, rng);
  }
}

/** One squad's blows on another, then the riposte. */
function clash(s: GameState, c: ConquestState, b: ProvinceBattle, att: FieldSquad, dfn: FieldSquad, rng: Rng): void {
  const dealt = strike(b, att, dfn, 1, rng);
  const back = alive(dfn) ? strike(b, dfn, att, RIPOSTE, rng) : 0;
  event(b, s.tick, 'clash', att.id, dfn.id, `${att.name} strike ${dfn.name}: ${Math.round(dealt)} harm${back ? `, ${Math.round(back)} back` : ''}.`, Math.round(dealt), Math.round(back));
  for (const q of [dfn, att]) settle(s, c, b, q, rng);
}
/** The blows of one squad on another: each troop's, bettered by its hero's command and its kind's counter, on the row
 *  it reaches; the hero's last. Returns the harm done. */
function strike(b: ProvinceBattle, att: FieldSquad, dfn: FieldSquad, share: number, rng: Rng): number {
  const cmd = att.hero ? att.hero.command : 1;
  const guard = behindWalls(b, dfn) ? WALL_GUARD : 1;
  let harm = 0;
  const hit = (blow: number, kind: string | null, ranged: boolean) => {
    const t = pickTarget(dfn, ranged, rng);
    if (t === 'hero') {
      if (!dfn.hero) return;
      const dmg = Math.max(1, blow * guard - 1);
      dfn.hero.hp -= dmg;
      harm += dmg;
      return;
    }
    if (!t) return;
    const d = def(t.troop);
    const counter = kind ? COUNTERS[def(kind).kind]?.[d.kind] ?? 1 : 1;
    const dmg = Math.max(1, blow * counter * guard - d.defence);
    t.hp -= dmg;
    harm += dmg;
  };
  for (const t of att.troops) {
    if (!t || t.hp <= 0) continue;
    const d = def(t.troop);
    if (d.heal) {
      // menders: the worst-hurt of their own
      const hurt = att.troops.filter((x): x is FieldTroop => !!x && x.hp > 0 && x.hp < x.max).sort((a, b2) => a.hp / a.max - b2.hp / b2.max)[0];
      if (hurt) hurt.hp = Math.min(hurt.max, hurt.hp + d.heal * share);
      continue;
    }
    hit(d.attack * cmd * share * (d.quick ? 1.1 : 1), d.id, !!d.ranged);
  }
  if (att.hero && att.hero.hp > 0) hit(att.hero.strength * HERO_BLOW * TROOP_ATTACK * share, null, false);
  return harm;
}
/** Whom a blow lands on: melee the front row that stands, then the middle, the back, the hero; ranged the back first. */
function pickTarget(dfn: FieldSquad, ranged: boolean, rng: Rng): FieldTroop | 'hero' | null {
  const rows = ranged ? [2, 1, 0] : [0, 1, 2];
  for (const r of rows) {
    const standing = dfn.troops.filter((t, i): t is FieldTroop => !!t && t.hp > 0 && ROW_OF(i) === r);
    if (standing.length) return standing[rng.int(0, standing.length - 1)];
  }
  return dfn.hero && dfn.hero.hp > 0 ? 'hero' : null;
}
/** After blows: the dead troops gone, a hero fallen, a squad routed. */
function settle(s: GameState, c: ConquestState, b: ProvinceBattle, q: FieldSquad, rng: Rng): void {
  if (q.out) return;
  for (let i = 0; i < q.troops.length; i++) if (q.troops[i] && q.troops[i]!.hp <= 0) q.troops[i] = null;
  if (q.hero && q.hero.hp <= 0) {
    q.out = 'fallen';
    event(b, s.tick, 'fall', q.id, null, `${q.hero.name} is struck down!`);
    if (q.hero.person !== null) heroDown(s, c, b, q, rng);
    return;
  }
  if (worthOf(q) < q.worthIn * ROUT_AT) {
    q.out = 'routed';
    event(b, s.tick, 'rout', q.id, null, `${q.name} break and run.`);
  }
}
/** A hero of the town struck down: wounded, captured or killed. */
function heroDown(s: GameState, c: ConquestState, b: ProvinceBattle, q: FieldSquad, rng: Rng): void {
  const p = s.people.find((x) => x.id === q.hero!.person);
  if (!p) return;
  const w = worldOf(s)!;
  const prov = w.provinces[b.province];
  const holder = c.holder[b.province];
  const odds = p.id === s.mainId ? FOUNDER_FATE : HERO_FATE;
  const roll = rng.next();
  const fate: 'wounded' | 'captured' | 'killed' = roll < odds.killed ? 'killed' : roll < odds.killed + odds.captured && holder !== null ? 'captured' : 'wounded';
  if (fate === 'killed') {
    killPerson(s, p, `fell in the battle for ${prov.name}`);
    return;
  }
  p.hp = Math.max(1, Math.round(maxHp(p) * 0.3));
  woundPerson(s, p, maxHp(p) * 0.35, 'cut', rng);
  if (fate === 'captured') {
    const ransom = Math.max(RANSOM_LEAST, Math.round(q.hero!.strength * RANSOM_PER_STRENGTH));
    captivesOf(c).push({ hero: p.id, province: b.province, by: holder, ransom, since: s.tick });
    p.away = -(1_000_000 + p.id);
    notify(s, `${p.name} is taken captive at ${prov.name}: ${FACTION_BY_ID[holder!]?.name ?? 'the holders'} ask ${ransom} coins.`, true);
  } else notify(s, `${p.name} is carried from the field at ${prov.name}, badly hurt.`);
}
function event(b: ProvinceBattle, tick: number, kind: BattleEvent['kind'], from: number, to: number | null, text: string, harm?: number, back?: number): void {
  b.events.push(harm === undefined ? { tick, kind, from, to, text } : { tick, kind, from, to, text, harm, back });
  if (b.events.length > EVENTS_KEPT) b.events.splice(0, b.events.length - EVENTS_KEPT);
}

/* ------------------------------------------------------------ the end */

function endBattle(s: GameState, c: ConquestState, b: ProvinceBattle, done: 'won' | 'lost'): void {
  const w = worldOf(s)!;
  const p = w.provinces[b.province];
  const a = (c.armies ?? []).find((x) => x.id === b.army);
  b.done = done;
  b.endAt = s.tick + END_SHOWN;
  // the town's squads: the dead troops gone from their slots, the heroes' experience and the recap's fates
  let lost = 0;
  let felled = 0;
  const fates: BattleRecap['fates'] = [];
  for (const f of b.squads) {
    if (f.side === 'foe') {
      felled += f.troops.filter((t) => !t).length + (f.out === 'fallen' ? 1 : 0);
      continue;
    }
    const q = c.squads.find((x) => x.id === f.squad);
    if (q) {
      for (let i = 0; i < SQUAD_SLOTS; i++) {
        if (q.slots[i] && !f.troops[i]) {
          lost++;
          q.slots[i] = null;
        }
      }
      if (done === 'won') q.battles++;
    }
    const hero = f.hero?.person !== null && f.hero ? s.people.find((x) => x.id === f.hero!.person) : undefined;
    if (hero) gainLevelXp(hero, 'melee', done === 'won' ? XP_WON : XP_LOST);
    const cap = f.hero?.person !== null && f.hero ? captivesOf(c).find((x) => x.hero === f.hero!.person && x.since >= b.started) : undefined;
    fates.push({ name: f.hero?.name ?? f.name, fate: f.out === 'fallen' ? (hero ? (cap ? 'captured' : 'wounded') : 'killed') : f.out === 'routed' ? 'routed' : 'fought' });
  }
  const lines: string[] = [];
  if (done === 'won') {
    const was = c.holder[b.province];
    c.holder[b.province] = 'town';
    c.taken ??= {};
    c.taken[b.province] = Math.floor(s.tick / TICKS_PER_DAY);
    if (was === null) {
      (c.cleared ??= []).push(b.province);
      lines.push(`The lair at ${p.name} is cleared, and the province is the town's.`);
    } else lines.push(`${p.name} is taken from ${FACTION_BY_ID[was]?.name ?? was}.`);
    // captives held here are freed
    const caps = captivesOf(c);
    for (let i = caps.length - 1; i >= 0; i--) {
      if (caps[i].province !== b.province) continue;
      const hero = s.people.find((x) => x.id === caps[i].hero);
      if (hero && a) hero.away = -a.id; // (with the army now; home when it is)
      lines.push(`${hero?.name ?? 'A captive'} is freed from the cells.`);
      caps.splice(i, 1);
    }
    event(b, s.tick, 'end', 0, null, `Victory! ${p.name} is the town's.`);
    notify(s, `${a?.name ?? 'The army'} wins the battle for ${p.name}: ${felled} of the foe felled, ${lost} of the town's troops lost.`, true);
  } else {
    lines.push(`The army is beaten before ${p.name} and falls back.`);
    event(b, s.tick, 'end', 0, null, `Defeat. The army falls back from ${p.name}.`);
    notify(s, `${a?.name ?? 'The army'} is beaten before ${p.name}: ${lost} troops lost, ${felled} of the foe felled.`, true);
    if (a) fallBack(s, c, w, a);
  }
  for (const f of fates) if (f.fate !== 'fought') lines.push(`${f.name}: ${f.fate}.`);
  c.lastBattle = { tick: s.tick, province: p.name, won: done === 'won', turns: b.turn, lost, felled, fates, lines };
  if (done === 'won') checkConquestWin(s, c, w);
}
/** A beaten army falls back to the nearest province of the town's (home at the last), at once. */
function fallBack(s: GameState, c: ConquestState, w: ConquestWorld, a: Army): void {
  const here = w.provinces[a.at];
  const back = here.neighbours.find((n) => c.holder[n] === 'town') ?? w.realms[0].capital;
  a.at = back;
  a.going = null;
  a.arrive = null;
  a.path = [];
  if (back === w.realms[0].capital) {
    // home: the heroes come in (armies.ts does the same on arrival)
    for (const p of s.people) if (p.away === -a.id) {
      p.away = null;
      p.task = null;
      p.activity = 'idle';
    }
  }
}

/** Pay a captive's ransom (from the war chest, then the treasury): they come home. */
export function ransom(s: GameState, heroId: number): { ok: boolean; reason?: string } {
  const c = s.conquest;
  const caps = c ? captivesOf(c) : [];
  const i = caps.findIndex((x) => x.hero === heroId);
  if (!c || i < 0) return { ok: false, reason: 'No such captive' };
  const cap = caps[i];
  if (c.chest + (s.coins ?? 0) < cap.ransom) return { ok: false, reason: `The war chest and treasury haven't ${cap.ransom} coins` };
  const fromChest = Math.min(c.chest, cap.ransom);
  c.chest -= fromChest;
  if (cap.ransom > fromChest) s.coins = (s.coins ?? 0) - (cap.ransom - fromChest);
  caps.splice(i, 1);
  const p = s.people.find((x) => x.id === heroId);
  if (p) {
    p.away = null;
    p.task = null;
    p.activity = 'idle';
    notify(s, `${p.name} is ransomed for ${cap.ransom} coins and comes home.`, true);
  }
  return { ok: true };
}
