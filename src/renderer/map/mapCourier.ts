// Riders on the road (the owner's ask): when news comes (a question put to the town, raiders sighted, a power gone to
// war, a host on the march, a quest offered, a caravan come to market: map/horizonRules.ts `newsBetween`), a courier
// gallops in from the edge of the fog on the side it comes from, along the roads where there are roads (fording a river with no bridge), to the seat of
// the town, waits there a moment with the word, and rides off the way they came (`riderAt`). One or two at a time,
// a few seconds apart; news that comes faster waits its turn, and the oldest is dropped past `NEWS_WAITING`. They are
// drawn by the people view as a rider on whtdragon's horse (main.ts `courierPerson`: the same as an envoy), so this
// holds only where they are. Renderer only: nothing of it is in the sim.

import { NAMES, randomLook, type Look } from '../../shared/data/people';
import { isSeat } from '../../shared/data/seats';
import { Rng } from '../../shared/rng';
import { doorCell } from '../../shared/sim/buildings';
import { CELL, findPath, type LandMap } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { COURIER_GAP, COURIERS_MOST, fogEdge, newsBearing, newsBetween, NEWS_WAITING, riderAt, type News, type NewsShot, type Pt } from './horizonRules';

/** What a cell of river costs a courier (they ford it rather than ride the long way round to a bridge). */
const FORD = 4;
/** The ids couriers are drawn under (well clear of the town's people, travellers and strangers). */
export const COURIER_IDS = 7_700_000;

/** A courier in sight: who, where and which way, mounted on which coat, and what they bring. */
export interface CourierView {
  id: number;
  name: string;
  look: Look;
  coat: number;
  x: number;
  y: number;
  dir: 1 | -1;
  riding: boolean;
  line: string;
}

interface Rider {
  id: number;
  name: string;
  look: Look;
  coat: number;
  line: string;
  route: Pt[];
  start: number;
}

export class Couriers {
  private prev: NewsShot | null = null;
  private readonly waiting: News[] = [];
  private readonly riders: Rider[] = [];
  private next = 1;
  private lastSent = -1e9;

  /** Each snapshot: what's new, and the land and the town's buildings (the seat it rides to). */
  sync(shot: NewsShot, land: LandMap, buildings: readonly Building[], now: number): void {
    for (const n of newsBetween(this.prev, shot)) {
      if (this.waiting.some((w) => w.key === n.key)) continue;
      this.waiting.push(n);
      while (this.waiting.length > NEWS_WAITING) this.waiting.shift();
    }
    this.prev = shot;
    // (gone riders off the road)
    for (let i = this.riders.length - 1; i >= 0; i--) if (!riderAt(this.riders[i].route, (now - this.riders[i].start) / 1000)) this.riders.splice(i, 1);
    if (this.waiting.length && this.riders.length < COURIERS_MOST && now - this.lastSent > COURIER_GAP * 1000) {
      const news = this.waiting.shift()!;
      const route = this.routeFor(news, land, buildings);
      if (route) {
        this.send(news, route, now);
        this.lastSent = now;
      }
    }
  }

  /** For previews (`window.__courier`): a rider sent at once with made-up news, from a bearing (radians) or any way. */
  dispatch(land: LandMap, buildings: readonly Building[], now: number, bearing?: number): boolean {
    const news: News = { key: `preview${this.next}`, kind: 'question', from: null, line: 'Bringing word from afar' };
    const route = this.routeFor(news, land, buildings, bearing);
    if (route) this.send(news, route, now);
    return !!route;
  }

  /** The couriers in sight now (world px). */
  views(now: number): CourierView[] {
    const out: CourierView[] = [];
    for (const r of this.riders) {
      const at = riderAt(r.route, (now - r.start) / 1000);
      if (at) out.push({ id: r.id, name: r.name, look: r.look, coat: r.coat, x: at.x, y: at.y, dir: at.dir, riding: at.phase !== 'wait', line: at.phase === 'out' ? 'Riding off again' : r.line });
    }
    return out;
  }

  private send(news: News, route: Pt[], now: number): void {
    const id = COURIER_IDS + this.next++;
    const rng = Rng.from(id, 0xc0);
    this.riders.push({ id, name: rng.pick(NAMES), look: randomLook(rng), coat: rng.int(0, 7), line: news.line, route, start: now });
  }

  /** The way in (world px): from the fog's edge on the news's side, along the land's cheapest way (the roads are
   *  cheap), to the seat's door; straight in where no way is found. Null with no seat (nowhere to bring it). */
  private routeFor(news: News, land: LandMap, buildings: readonly Building[], bearing = newsBearing(news)): Pt[] | null {
    const seat = buildings.find((b) => isSeat(b.def) && b.status === 'done') ?? buildings.find((b) => b.def === 'campfire');
    const door = seat ? doorCell(seat) : land.camp;
    const goal = { x: Math.max(0, Math.min(land.w - 1, door.x)), y: Math.max(0, Math.min(land.h - 1, door.y)) };
    // (a little round the fog's edge till a way in is found: water or the mountain in the way)
    for (const turn of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5]) {
      const e = fogEdge(land, bearing + turn, -1);
      const from = { x: Math.max(0, Math.min(land.w - 1, Math.floor(e.x))), y: Math.max(0, Math.min(land.h - 1, Math.floor(e.y))) };
      const path = findPath(land, from, goal, undefined, { maxNodes: 60000, ford: FORD });
      if (path && path.length > 2) return [from, ...path].map((c) => ({ x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL }));
    }
    const e = fogEdge(land, bearing, -1);
    return [
      { x: e.x * CELL, y: e.y * CELL },
      { x: (goal.x + 0.5) * CELL, y: (goal.y + 0.5) * CELL },
    ];
  }
}
