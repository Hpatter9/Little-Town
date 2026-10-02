// Dungeon delves (data/dungeons.ts): a trip whose time on site is spent going room by room down a dungeon. Each room
// takes a while (ROOM_SECONDS) and burns a torch; what's in it is rolled when the party sets off, so the same delve
// plays out the same way. Fights (more foes the deeper they go), traps (a scout may spot them), treasure, shrines (a
// blessing or a curse), puzzle doors (the cleverest has a go), rest camps, forks (a risky party takes the darker way)
// and the boss at the bottom, whose hoard comes home. The party turns back when the torches run out or half of them
// are down; a lost or fled fight sends them home as on any trip (expeditions.ts). Deaths are real.

import { DUNGEON_BY_ID, ROOM_SECONDS, type DungeonDef, type RoomKind } from '../data/dungeons';
import { the, The } from '../data/expeditions';
import { MATERIAL_NAMES, type Material, type Stock } from '../data/materials';
import { hashSeed, mixSeed, Rng } from '../rng';
import { knockDown, stabilize } from './health';
import { addStock, ERA_MULTIPLIER, maxHp, notify, poolSize, type Expedition, type GameState, type Person } from './state';
import { TICK_HZ } from './time';
import { gainSkill } from './townsfolk';

/** A delve in progress (on its expedition). */
export interface Delve {
  /** The rooms, top to bottom; the last is the boss's. */
  rooms: RoomKind[];
  /** The room they're in (-1: at the door), and how long they've been in it (ticks). */
  at: number;
  ticks: number;
  /** Torches left (one burns a room). */
  torches: number;
  /** A risky party took the darker way at a fork: every fight after has one more foe. */
  deeper?: boolean;
  /** The boss's fight has begun (and, if the party is still down here when the room's time is up, been won). */
  bossFought?: boolean;
  cleared?: boolean;
  /** What's happened lately, for the watcher and the card (newest last). */
  log: string[];
}

/** Room odds (the first is always a fight, the one before the boss a rest camp). */
const ODDS: [RoomKind, number][] = [
  ['fight', 40],
  ['trap', 12],
  ['treasure', 12],
  ['shrine', 8],
  ['puzzle', 8],
  ['camp', 10],
  ['fork', 10],
];
/** Torches packed beyond one a room (each cut from a unit of wood in storage). */
export const SPARE_TORCHES = 2;
/** A trap's bite (share of health), and a scout's base chance to spot it (more with Ranged skill). */
const TRAP_HURT: [number, number] = [0.08, 0.2];
const SPOT_TRAP = 0.45;
/** A shrine blesses more often than it curses; a camp heals this share of health. */
const SHRINE_BLESS = 0.7;
const CAMP_HEAL = 0.25;
/** A puzzle door: the cleverest's chance (more with Research skill). */
const PUZZLE_BASE = 0.35;
const PUZZLE_PER_LEVEL = 0.04;
const LOG_LINES = 8;

/** The delve's own dice (from the town's seed and the trip), so it plays the same way each time. */
const rngOf = (s: GameState, e: Expedition, salt: number) => new Rng(mixSeed(hashSeed(s.seed), e.id, salt));

/** Ready a delve as its party sets off: roll its rooms and pack its torches. */
export function startDelve(s: GameState, e: Expedition, take: (m: Material, n: number) => number): void {
  const d = DUNGEON_BY_ID[e.dest];
  if (!d) return;
  const rng = rngOf(s, e, 1);
  const total = ODDS.reduce((n, [, w]) => n + w, 0);
  const rooms: RoomKind[] = [];
  for (let i = 0; i < d.rooms; i++) {
    if (i === 0) rooms.push('fight');
    else if (i === d.rooms - 1) rooms.push('camp');
    else {
      let r = rng.next() * total;
      rooms.push(ODDS.find(([, w]) => (r -= w) < 0)?.[0] ?? 'fight');
    }
  }
  rooms.push('boss');
  const want = rooms.length + SPARE_TORCHES;
  const torches = take('wood', want);
  e.delve = { rooms, at: -1, ticks: 0, torches, log: [] };
  if (torches < want) notify(s, `There wasn't wood for all the torches: ${the(d.name)} party has ${torches} for ${rooms.length} rooms.`);
}

export interface DelveHooks {
  /** Turn for home (expeditions.ts startBack). */
  back: () => void;
  /** Start a fight with this group (expeditions.ts, as on the road). */
  fight: (group: Record<string, number>, boss: boolean) => void;
  /** What one can carry home. */
  room: () => number;
}

/** A tick of a delve, in its work phase (the party is inside). */
export function stepDelve(s: GameState, e: Expedition, members: Person[], hooks: DelveHooks): void {
  const v = e.delve;
  const d = DUNGEON_BY_ID[e.dest];
  if (!v || !d) return hooks.back();
  const roomTicks = Math.round(ROOM_SECONDS * TICK_HZ * ERA_MULTIPLIER[s.era]);
  if (v.at >= 0 && v.ticks < roomTicks) {
    v.ticks++;
    return;
  }
  // the room's done with: the boss's means the dungeon is theirs
  if (v.at >= 0 && v.rooms[v.at] === 'boss' && v.bossFought) {
    cleared(s, e, d, v, hooks);
    return;
  }
  // before going on: enough light, and enough of them on their feet?
  if (v.torches <= 0) {
    say(s, v, `The last torch gutters out in ${the(d.name)}. They feel their way back to the light.`, true);
    return hooks.back();
  }
  const up = members.filter((p) => !p.downed);
  if (up.length * 2 <= members.length) {
    say(s, v, `Too many of ${the(d.name)} party are down to go on. They turn back with what they found.`, true);
    return hooks.back();
  }
  v.at++;
  v.ticks = 0;
  v.torches--;
  enter(s, e, d, v, members, hooks);
}

function enter(s: GameState, e: Expedition, d: DungeonDef, v: Delve, members: Person[], hooks: DelveHooks): void {
  const rng = rngOf(s, e, 100 + v.at);
  const up = members.filter((p) => !p.downed);
  const depth = v.at + 1;
  const where = `Room ${depth} of ${v.rooms.length}`;
  switch (v.rooms[v.at]) {
    case 'fight': {
      const group = { ...d.foes[rng.int(0, d.foes.length - 1)] };
      // (more of them further down, and more again past a darker fork)
      const extra = Math.floor(v.at / 3) + (v.deeper ? 1 : 0);
      const first = Object.keys(group)[0];
      if (extra && first) group[first] += extra;
      say(s, v, `${where}: something moves in the dark.`);
      hooks.fight(group, false);
      return;
    }
    case 'boss':
      v.bossFought = true;
      say(s, v, `${where}: the bottom of ${the(d.name)}, and ${d.threat} rises to meet them!`, true);
      hooks.fight({ ...d.boss }, true);
      return;
    case 'trap': {
      const scout = up.filter((p) => e.roles[p.id] === 'scout').sort((a, b) => b.skills.ranged.level - a.skills.ranged.level)[0];
      if (scout && rng.chance(SPOT_TRAP + scout.skills.ranged.level * 0.03)) {
        gainSkill(scout, 'ranged', 20);
        say(s, v, `${where}: ${scout.name} spots a tripwire, and they step round it.`);
        return;
      }
      const hurt: string[] = [];
      for (const p of up) {
        if (!rng.chance(0.6)) continue;
        p.hp = Math.max(0, p.hp - Math.round(maxHp(p) * (TRAP_HURT[0] + rng.next() * (TRAP_HURT[1] - TRAP_HURT[0]))));
        if (p.hp <= 0) knockDown(s, p);
        hurt.push(p.name);
      }
      say(s, v, `${where}: a trap! ${hurt.length ? `${names(hurt)} ${hurt.length > 1 ? 'are' : 'is'} hurt.` : 'It misses them all.'}`);
      return;
    }
    case 'treasure': {
      const got = gather(e, d, 2 + Math.floor(depth / 3), hooks, rng);
      const coins = rng.int(4, 10) * (1 + Math.floor(depth / 4));
      s.coins = (s.coins ?? 0) + coins;
      say(s, v, `${where}: a forgotten hoard: ${got || 'nothing they can carry'}, and ${coins} coins.`);
      return;
    }
    case 'shrine':
      if (rng.chance(SHRINE_BLESS)) {
        for (const p of members) {
          if (p.downed) stabilize(p);
          p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * 0.35));
        }
        say(s, v, `${where}: an old shrine. They kneel, and rise mended.`);
      } else {
        for (const p of up) p.hp = Math.max(1, p.hp - Math.round(maxHp(p) * 0.1));
        say(s, v, `${where}: a shrine to something that doesn't like visitors. A chill takes them all.`);
      }
      return;
    case 'puzzle': {
      const wit = [...up].sort((a, b) => b.skills.research.level - a.skills.research.level)[0];
      if (wit && rng.chance(PUZZLE_BASE + wit.skills.research.level * PUZZLE_PER_LEVEL)) {
        gainSkill(wit, 'research', 30);
        const got = gather(e, d, 4 + Math.floor(depth / 2), hooks, rng);
        say(s, v, `${where}: a door of turning rings. ${wit.name} works it out: behind it, ${got || 'an empty vault'}.`);
      } else say(s, v, `${where}: a door of turning rings that won't open for them.`);
      return;
    }
    case 'camp':
      for (const p of members) {
        if (p.downed) stabilize(p);
        else p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * CAMP_HEAL));
      }
      say(s, v, `${where}: a dry corner to rest in. They bind their wounds and eat.`);
      return;
    case 'fork': {
      const next = v.at + 1 < v.rooms.length - 1 ? v.at + 1 : -1;
      if (e.stakes === 'risky') {
        v.deeper = true;
        if (next >= 0) v.rooms[next] = 'treasure';
        say(s, v, `${where}: the way splits. They take the darker path, toward the glint of gold.`);
      } else {
        if (next >= 0) v.rooms[next] = 'camp';
        say(s, v, `${where}: the way splits. They take the safer path.`);
      }
      return;
    }
  }
}

/** The boss is dead: its hoard comes home (as much as they can carry), and the dungeon is the town's. */
function cleared(s: GameState, e: Expedition, d: DungeonDef, v: Delve, hooks: DelveHooks): void {
  v.cleared = true;
  const room = hooks.room();
  let took = 0;
  const got: string[] = [];
  for (const [m, n] of Object.entries(d.hoard) as [Material, number][]) {
    const k = Math.min(n, room - took);
    if (k <= 0) break;
    addStock(e.loot, m, k);
    took += k;
    got.push(`${k} ${MATERIAL_NAMES[m].toLowerCase()}`);
  }
  (s.delved ??= {})[d.id] = (s.delved[d.id] ?? 0) + 1;
  say(s, v, `${The(d.name)} is cleared! The party heads home with the hoard${got.length ? `: ${got.join(', ')}` : ''}.`, true);
  hooks.back();
}

/** Pick up what the dungeon gives, up to what's left of the party's carrying room; a line saying what. */
function gather(e: Expedition, d: DungeonDef, n: number, hooks: DelveHooks, rng: Rng): string {
  const got: Stock = {};
  for (let i = 0; i < n && hooks.room() > 0; i++) {
    const m = rng.weighted(d.loot as Record<Material, number>);
    addStock(e.loot, m, 1);
    addStock(got, m, 1);
  }
  return (Object.entries(got) as [Material, number][]).map(([m, k]) => `${k} ${MATERIAL_NAMES[m].toLowerCase()}`).join(', ');
}

function say(s: GameState, v: Delve, text: string, key = false): void {
  v.log.push(text);
  if (v.log.length > LOG_LINES) v.log.shift();
  notify(s, text, key);
}

const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);

/** How full a delving party's packs are (for the card). */
export const delveLoad = (e: Expedition) => poolSize(e.loot);
