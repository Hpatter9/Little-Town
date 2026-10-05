// The Monster Hunters' Guild (data/hunts.ts; the owner's ask). With the guild hall standing, now and then
// (`huntsHourly`) a hunt is posted: a quarry of one to five stars the town is ready for (`starsFor`), on the
// Expedition Board as `mhunt:<id>` (type `clear`) for `HUNT_DAYS`. The parties take it up themselves when they dare
// (`PULL_HUNT_STAR` a star); won, the purse (`HUNT_PURSE`) goes to the party and the quarry's parts to the stores
// (`huntHome`). The guild's hunters forge those parts into unique gear (`planForge`: each piece once, when the makings
// are in store; `finishPiece` in crafting.ts marks it made). Everything here draws on its own seeded stream.

import { FORGED_IDS, HUNT_DAYS, HUNT_EVERY_HOURS, HUNT_OUT, HUNT_POST_CHANCE, HUNT_PURSE, MOST_HUNTS, ALL_QUARRIES, QUARRY_BY_ID, type Quarry } from '../data/hunts';
import type { Destination } from '../data/expeditions';
import { eraReached } from '../data/eras';
import { ITEM_BY_ID } from '../data/items';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { campXY, notify, type Expedition, type GameState, type Hunt, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { describeFoes } from './places';
import { payParty } from './economy';
import { depositNear, totalStock } from './buildings';
import { canQueueCraft, queueCraft } from './crafting';
import { isChild } from './social';

export const HUNT_DEST = 'mhunt:';
export const isHuntDest = (id: string) => id.startsWith(HUNT_DEST);


const guildStands = (s: GameState) => s.buildings.some((b) => b.def === 'monster_guild' && b.status === 'done');
const grown = (s: GameState) => s.people.filter((p) => !isChild(p)).length;
const huntOf = (s: GameState, dest: string) => (s.hunts ?? []).find((h) => `${HUNT_DEST}${h.id}` === dest);

/** The most stars of hunt the guild offers a town: more as it grows and with the ages. */
export function starsFor(s: GameState): number {
  const n = grown(s);
  const era = eraReached(s.era, 'industrial') ? 2 : eraReached(s.era, 'medieval') ? 1 : 0;
  return Math.max(1, Math.min(5, 1 + Math.floor(n / 5) + era));
}

/** Each hour: lapsed hunts come off the board, and now and then a new one goes up; the guild forges what it can. */
export function huntsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const out = new Set(s.expeditions.map((e) => e.dest));
  const lapsed = (s.hunts ?? []).filter((h) => s.tick >= h.until && !out.has(`${HUNT_DEST}${h.id}`));
  for (const h of lapsed) notify(s, `The guild takes down its notice for ${QUARRY_BY_ID[h.quarry]?.name ?? 'a hunt'}: nobody went.`);
  if (lapsed.length) s.hunts = (s.hunts ?? []).filter((h) => !lapsed.includes(h));
  if (!guildStands(s)) return;
  if (s.autopilot !== false) planForge(s);
  maybePost(s);
}

function maybePost(s: GameState): void {
  if ((s.hunts ?? []).length >= MOST_HUNTS) return;
  if (s.lastHunt !== undefined && s.tick - s.lastHunt < HUNT_EVERY_HOURS * TICKS_PER_HOUR) return;
  const rng = Rng.from(hashSeed(s.seed), s.tick, 0x4b17);
  if (!rng.chance(HUNT_POST_CHANCE)) return;
  postHunt(s, rng);
}

/** The guild posts a hunt (tests post one by its quarry). The easier hunts come more often. */
export function postHunt(s: GameState, rng: Rng, quarry?: string): Hunt | null {
  const most = starsFor(s);
  const up = new Set((s.hunts ?? []).map((h) => h.quarry));
  const pool = ALL_QUARRIES.filter((q) => q.stars <= most && eraReached(s.era, q.era) && !up.has(q.id));
  const q = quarry ? QUARRY_BY_ID[quarry] : pickWeighted(rng, pool, (x) => (1 + (most - x.stars) * 0.6) * (x.id.startsWith('m_') ? 0.15 : 1));
  if (!q) return null;
  const h: Hunt = { id: s.nextId++, quarry: q.id, posted: s.tick, until: s.tick + HUNT_DAYS * TICKS_PER_DAY };
  (s.hunts ??= []).push(h);
  s.lastHunt = s.tick;
  notify(s, `The Monster Hunters' Guild posts a hunt: ${q.name}, ${'★'.repeat(q.stars)}, for ${HUNT_PURSE[q.stars]} coins and its parts. ${q.text}`, true);
  return h;
}

/** A hunt on the Expedition Board. */
export function huntDestination(s: GameState, h: Hunt): Destination | undefined {
  const q = QUARRY_BY_ID[h.quarry];
  if (!q) return undefined;
  const left = Math.max(0, h.until - s.tick) / TICKS_PER_DAY;
  return {
    id: `${HUNT_DEST}${h.id}`,
    name: `${q.name} ${'★'.repeat(q.stars)}`,
    type: 'clear',
    outSeconds: HUNT_OUT(q.stars),
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: {},
    threats: describeFoes(q.foes),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: q.foes, weight: 1 }] },
    recommendedParty: 2 + q.stars,
    scenery: q.scenery,
    description: `A hunt for the Monster Hunters' Guild: ${q.text} The purse: ${HUNT_PURSE[q.stars]} coins, and ${partsLine(q)}. (${left >= 1 ? `${Math.floor(left)} days left` : 'less than a day left'})`,
  };
}

function pickWeighted<T>(rng: Rng, items: readonly T[], w: (x: T) => number): T | undefined {
  const total = items.reduce((n, x) => n + w(x), 0);
  let r = rng.next() * total;
  for (const x of items) if ((r -= w(x)) < 0) return x;
  return items[items.length - 1];
}

const partsLine = (q: Quarry) =>
  Object.entries(q.parts)
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m as Material].toLowerCase()}`)
    .join(', ');

export const huntDestinations = (s: GameState): Destination[] => (s.hunts ?? []).map((h) => huntDestination(s, h)).filter((d): d is Destination => !!d);
export const huntDestOf = (s: GameState, id: string): Destination | undefined => {
  const h = huntOf(s, id);
  return h ? huntDestination(s, h) : undefined;
};
/** The stars of a hunt on the board (0 for anywhere else). */
export const huntStars = (s: GameState, id: string): number => {
  const h = huntOf(s, id);
  return h ? (QUARRY_BY_ID[h.quarry]?.stars ?? 0) : 0;
};

/** A party home from a hunt: won, the purse is theirs and the parts the town's; beaten, the quarry is still out there. */
export function huntHome(s: GameState, e: Expedition, members: Person[]): void {
  const h = huntOf(s, e.dest);
  if (!h) return;
  const q = QUARRY_BY_ID[h.quarry];
  if (!e.cleared) {
    if (!e.recalled) notify(s, `The hunters came back beaten from ${q.name}. It is still out there.`, true);
    return;
  }
  s.hunts = (s.hunts ?? []).filter((x) => x !== h);
  const purse = HUNT_PURSE[q.stars];
  const standing = members.filter((p) => !p.downed);
  payParty(s, standing.length ? standing : members, purse, `The guild's purse for ${q.name}`);
  depositNear(s, campXY(s), { ...q.parts });
  (s.huntsWon ??= {})[q.id] = (s.huntsWon[q.id] ?? 0) + 1;
  notify(s, `${q.name} is slain! The guild pays ${purse} coins, and the hunters bring home ${partsLine(q)}.`, true);
}

/* ------------------------------------------------------------ the forge */

/** The guild forges what it has the makings for: each unique once, one order at a time. */
export function planForge(s: GameState): void {
  if (s.crafting.some((o) => FORGED_IDS.includes(o.item))) return;
  const stock = totalStock(s);
  for (const id of FORGED_IDS) {
    if ((s.uniques ?? []).includes(id)) continue;
    const def = ITEM_BY_ID[id];
    if (!def || !Object.entries(def.cost).every(([m, n]) => (stock[m as Material] ?? 0) >= (n ?? 0))) continue;
    if (!canQueueCraft(s, id).ok) continue;
    queueCraft(s, id);
    notify(s, `The guild's hunters set to forging ${def.name} from the parts brought home.`, true);
    return;
  }
}

/* ------------------------------------------------------------ seen */

export interface HuntView {
  dest: string;
  name: string;
  stars: number;
  purse: number;
  parts: string;
  text: string;
  hoursLeft: number;
}
export interface ForgeView {
  id: string;
  name: string;
  made: boolean;
  holder: string | null;
  makings: string;
  ready: boolean;
}

export function huntsView(s: GameState): { guild: boolean; hunts: HuntView[]; forge: ForgeView[]; won: number } {
  const guild = guildStands(s);
  const hunts = (s.hunts ?? []).map((h) => {
    const q = QUARRY_BY_ID[h.quarry];
    return { dest: `${HUNT_DEST}${h.id}`, name: q.name, stars: q.stars, purse: HUNT_PURSE[q.stars], parts: partsLine(q), text: q.text, hoursLeft: Math.max(0, Math.ceil((h.until - s.tick) / TICKS_PER_HOUR)) };
  });
  const stock = totalStock(s);
  const forge = FORGED_IDS.map((id) => {
    const def = ITEM_BY_ID[id];
    const made = (s.uniques ?? []).includes(id);
    const holder = s.people.find((p) => Object.values(p.gear).includes(id))?.name ?? null;
    const makings = Object.entries(def.cost)
      .map(([m, n]) => `${n} ${MATERIAL_NAMES[m as Material].toLowerCase()}`)
      .join(', ');
    const ready = Object.entries(def.cost).every(([m, n]) => (stock[m as Material] ?? 0) >= (n ?? 0));
    return { id, name: def.name, made, holder, makings, ready };
  });
  const won = Object.values(s.huntsWon ?? {}).reduce((a, b) => a + b, 0);
  return { guild, hunts, forge, won };
}
