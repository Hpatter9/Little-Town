// Animal husbandry (data/livestock.ts): pens in the fields behind the town. Farmers tend them (the Farm job, after the
// fields), the herds breed in spring and summer, eat grain through the winter, and are slaughtered when a pen is full,
// when they're kept for meat, or when the town's food runs short.

import { BUILDING_BY_ID } from '../data/buildings';
import { BREED_SEASON, HERDS, PEN_GROW_MAX, PEN_ROOM_PER_COL, RUSTLE_CHANCE, RUSTLE_MAX, SELL_FOOD_DAYS, SELL_SHARE, STARVE_HOURS } from '../data/livestock';
import { footprint } from './buildings';
import { buildable, groundAt, isRoad } from './land';
import { FOOD_VALUE } from '../data/people';
import type { Material, Stock } from '../data/materials';
import { skillSpeed } from '../data/skills';
import type { Rng } from '../rng';
import { buildingCentreX, depositNear, storages, totalStock } from './buildings';
import { addStock, foodDaysFor, carryCapacity, notify, poolSize, type Building, type GameState, type Person } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { gainSkill, workFactor } from './townsfolk';

const TEND_XP_PER_SEC = 2;
const TEND_XP = 12;
/** Below this many days of food, a pen gives up one animal for the pot at each tending (down to a breeding pair). */
const SHORT_FOOD_DAYS = 2;

export const isPen = (b: Building) => !!HERDS[b.def] && b.status === 'done';

/** A pen's herd (a new pen is empty: its animals are bought in, `stockPen`). */
export function herdOf(s: GameState, b: Building): NonNullable<Building['herd']> {
  b.herd ??= { head: 0, tended: s.tick, breed: 0, hungry: 0, work: 0 };
  return b.herd;
}

/** Head a pen holds at its present size. */
export const penRoom = (b: Building) => HERDS[b.def].room + (b.wide ?? 0) * PEN_ROOM_PER_COL;

/** Buy animals in from a drover: up to the pen's `start`, for coins (or `pay` in goods when there are none). Returns
 *  how many came. */
export function stockPen(s: GameState, b: Building, pay: (coins: number) => boolean): number {
  const def = HERDS[b.def];
  const h = herdOf(s, b);
  const want = Math.max(0, def.start - h.head);
  if (!want || !pay(def.price * want)) return 0;
  h.head += want;
  h.tended = s.tick;
  notify(s, `${want} ${want === 1 ? def.animal : def.plural} bought from a drover for the ${BUILDING_BY_ID[b.def].name.toLowerCase()} (${def.price * want} coins' worth).`, true);
  return want;
}

/** A pen nearly full widens by a column (to the right, else to the left) while there's free ground beside it. */
export function growPen(s: GameState, b: Building): boolean {
  const h = herdOf(s, b);
  if ((b.wide ?? 0) >= PEN_GROW_MAX || h.head < penRoom(b) - 1) return false;
  const f = footprint(b);
  for (const dx of [0, -1]) {
    const tryB = { ...b, tile: b.tile + dx, wide: (b.wide ?? 0) + 1 };
    const g = footprint(tryB);
    if (!canPlaceRect(s, b, g)) continue;
    b.tile = tryB.tile;
    b.wide = tryB.wide;
    notify(s, `The ${BUILDING_BY_ID[b.def].name.toLowerCase()} is fenced wider for its ${HERDS[b.def].plural} (${f.w} to ${g.w} cells).`);
    return true;
  }
  return false;
}
/** Whether a pen's new rectangle is free (nothing but itself on it, all of it open ground). */
function canPlaceRect(s: GameState, b: Building, r: { x: number; y: number; w: number; h: number }): boolean {
  for (const q of s.buildings) {
    if (q === b) continue;
    const o = footprint(q);
    if (o.x < r.x + r.w && r.x < o.x + o.w && o.y < r.y + r.h && r.y < o.y + o.h) return false;
  }
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= s.land.w || y >= s.land.h) return false;
      // (open, buildable ground, off the roads)
      if (!buildable(groundAt(s.land, x, y)) || isRoad(s.land, x, y)) return false;
    }
  return true;
}

/** Whether a pen wants tending now. */
export function needsTending(s: GameState, b: Building): boolean {
  if (!isPen(b)) return false;
  const h = herdOf(s, b);
  return h.head > 0 && s.tick - h.tended >= HERDS[b.def].everyHours * TICKS_PER_HOUR;
}

/** A pen that wants tending that nobody else is on, nearest first. */
export function penToTend(s: GameState, p: Person): Building | null {
  let best: Building | null = null;
  for (const b of s.buildings) {
    if (!needsTending(s, b)) continue;
    if (s.people.some((o) => o !== p && o.task?.type === 'farm' && o.task.building === b.id)) continue;
    if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
  }
  return best;
}

/** How many days the town's food would last. */
function foodDays(s: GameState): number {
  const stock = totalStock(s);
  const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (stock[m] ?? 0) * v, 0);
  return foodDaysFor(s, food, 1.5);
}

/** One tick of tending. Returns true when it's done: the pen's yield (and any slaughter) goes into the farmer's hands,
 *  and what they can't carry into the nearest store. */
export function workPen(s: GameState, p: Person, b: Building): boolean {
  const def = HERDS[b.def];
  const h = herdOf(s, b);
  h.work += (skillSpeed(p.skills.farming.level) * workFactor(s, p)) / (def.tendSeconds * TICK_HZ);
  gainSkill(p, 'farming', TEND_XP_PER_SEC / TICK_HZ);
  if (h.work < 1) return false;
  h.work = 0;
  h.tended = s.tick;
  const got: Stock = {};
  for (const [m, per] of Object.entries(def.yields) as [Material, number][]) addStock(got, m, Math.max(1, Math.round(h.head * per)));
  // a full pen (that couldn't be widened) sells one to a drover when food is plenty, else one goes to the pot; a meat
  // pen sends one to the pot each tending, and any pen does when food is short (a breeding pair is always kept)
  const full = h.head >= penRoom(b);
  if (h.head > 2 && full && !def.forMeat && foodDays(s) >= SELL_FOOD_DAYS) {
    h.head--;
    const coins = Math.round(def.price * SELL_SHARE);
    s.coins = (s.coins ?? 0) + coins;
    notify(s, `A ${def.animal} from the full ${BUILDING_BY_ID[b.def].name.toLowerCase()} was sold for ${coins} coins.`);
  } else if (h.head > 2 && (full || def.forMeat || foodDays(s) < SHORT_FOOD_DAYS)) {
    h.head--;
    for (const [m, n] of Object.entries(def.cull) as [Material, number][]) addStock(got, m, n);
  }
  const room = Math.max(0, carryCapacity(s, p) - poolSize(p.carrying));
  let left = room;
  const spill: Stock = {};
  for (const [m, n] of Object.entries(got) as [Material, number][]) {
    const k = Math.min(n, left);
    addStock(p.carrying, m, k);
    left -= k;
    if (n > k) spill[m] = n - k;
  }
  if (poolSize(spill)) depositNear(s, buildingCentreX(b), spill);
  gainSkill(p, 'farming', TEND_XP);
  return true;
}

/** Take grain from the stores (as much as there is, up to n). Returns what was taken. */
function takeGrain(s: GameState, n: number): number {
  let left = n;
  for (const st of storages(s)) {
    const k = Math.min(left, st.store.grain ?? 0);
    if (k <= 0) continue;
    st.store.grain = (st.store.grain ?? 0) - k;
    left -= k;
    if (left <= 0) break;
  }
  return n - left;
}

/** Every game hour: the herds breed (not in winter), and in winter they eat grain, starving without it. */
export function tendHerds(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const season = calendar(s.tick).season;
  for (const b of s.buildings) {
    if (!isPen(b)) continue;
    const def = HERDS[b.def];
    const h = herdOf(s, b);
    if (season === 'winter') {
      // (fodder is owed a little each hour and paid in whole grain; while it can't be paid, they go hungry)
      h.owed = (h.owed ?? 0) + (def.fodder * h.head) / 24;
      const whole = Math.floor(h.owed);
      if (whole > 0) h.owed -= takeGrain(s, whole);
      if (h.head > 0 && h.owed >= 1) {
        h.hungry++;
        if (h.hungry >= STARVE_HOURS) {
          h.hungry = 0;
          h.owed = 0;
          h.head--;
          notify(s, `A ${def.animal} starved in the ${BUILDING_BY_ID[b.def].name}: there was no grain to feed them through the winter.`, true);
        }
      } else h.hungry = Math.max(0, h.hungry - 1);
      continue;
    }
    h.hungry = 0;
    h.owed = 0;
    if (h.head < 2 || h.head >= penRoom(b)) continue;
    h.breed += BREED_SEASON[season] / def.breedHours;
    if (h.breed >= 1) {
      h.breed = 0;
      h.head++;
    }
  }
}

/** Raiders who got away may drive off some of the herd. */
export function rustle(s: GameState, rng: Rng): void {
  const pens = s.buildings.filter((b) => isPen(b) && (b.herd?.head ?? 0) > 0);
  if (!pens.length || !rng.chance(RUSTLE_CHANCE)) return;
  const pen = rng.pick(pens);
  const h = herdOf(s, pen);
  const n = Math.min(h.head, rng.int(1, RUSTLE_MAX));
  h.head -= n;
  const def = HERDS[pen.def];
  notify(s, `The raiders drove off ${n} ${n === 1 ? def.animal : def.plural}.`, true);
}
