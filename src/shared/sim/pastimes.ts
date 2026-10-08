// What townsfolk do with an idle moment (the owner's ask: everyday life to watch): a child runs off to play with the
// other children (tag about the camp), an elder sits by the fire, and a couple walks out together of an evening.
// It only changes where an idle wander goes and how the wait is spent: nobody is taken from work.

import { CELL } from './land';
import { calendar } from './time';
import { campXY, type GameState, type Person } from './state';
import { isChild } from './social';
import { isElder } from './ageing';
import { buildingDoor } from './buildings';

/** Market day: one day in `MARKET_EVERY` (the `MARKET_DAY`th), from `MARKET_FROM` to `MARKET_UNTIL`, in a town of at
 *  least `MARKET_PEOPLE` grown-ups: stalls go up on the square (the map draws them) and anyone idle goes to browse. */
export const MARKET_EVERY = 7;
export const MARKET_DAY = 5;
export const MARKET_FROM = 9;
export const MARKET_UNTIL = 16;
export const MARKET_PEOPLE = 3;
const MARKET_SQUARE = ['market', 'trading_post', 'general_store', 'emporium'];

/** Whether it's market day now (the day and the hour, the town big enough, no raid). */
export function marketOn(s: GameState): boolean {
  const c = calendar(s.tick);
  if (c.day % MARKET_EVERY !== MARKET_DAY % MARKET_EVERY || c.hour < MARKET_FROM || c.hour >= MARKET_UNTIL || s.raid) return false;
  return s.people.filter((p) => !isChild(p) && p.away === null).length >= MARKET_PEOPLE;
}

/** The market square: before the market (or the trading post, the store), else a little below the fire. */
export function marketSquare(s: GameState): { x: number; y: number } {
  const b = s.buildings.find((q) => MARKET_SQUARE.includes(q.def) && q.status === 'done');
  if (b) {
    const d = buildingDoor(b);
    return { x: d.x, y: d.y + 1.5 * CELL };
  }
  const c = campXY(s);
  return { x: c.x, y: c.y + 3 * CELL };
}

export type Pastime = 'play' | 'sit' | 'stroll' | 'market';

/** Couples walk out together between these hours. */
export const STROLL_FROM = 17;
export const STROLL_UNTIL = 21;
/** Elders sit this far from the fire (cells); children play within this of each other (cells). */
const FIRE_RING = 1.7;
const PLAY_NEAR = 2.5;
const STROLL_RING = 5;

/** Where an idle wander goes instead, and how the wait there is spent; null: wander as before. `slot` turns the
 *  spot from one wander to the next (a child running here, then there). */
export function pastimeFor(s: GameState, p: Person, slot: number): { x: number; y: number; pastime: Pastime } | null {
  if (p.away !== null || s.raid) return null;
  const c = campXY(s);
  if (isChild(p)) {
    // (round another child, so they chase each other about; else about the fire)
    const kids = s.people.filter((q) => q !== p && q.away === null && isChild(q));
    const other = kids.length ? kids[(slot + p.id) % kids.length] : null;
    const a = (slot * 2.399 + p.id) % (Math.PI * 2);
    const base = other ?? { x: c.x, y: c.y };
    return { x: base.x + Math.cos(a) * PLAY_NEAR * CELL, y: base.y + Math.sin(a) * PLAY_NEAR * CELL * 0.7, pastime: 'play' };
  }
  const hour = calendar(s.tick).hour;
  // (market day: off to the square to browse the stalls)
  if (marketOn(s)) {
    const m = marketSquare(s);
    const a = slot * 1.3 + p.id * 2.1;
    const r = (1 + ((p.id + slot) % 3)) * CELL;
    return { x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r * 0.6, pastime: 'market' };
  }
  const partner = p.partner != null ? s.people.find((q) => q.id === p.partner && q.away === null) : undefined;
  if (partner && hour >= STROLL_FROM && hour < STROLL_UNTIL) {
    // (the lower id leads them round a loop about the town; the other keeps a step beside)
    if (p.id < partner.id) {
      const a = slot * 0.9 + p.id;
      return { x: c.x + Math.cos(a) * STROLL_RING * CELL, y: c.y + Math.sin(a) * STROLL_RING * CELL * 0.7, pastime: 'stroll' };
    }
    return { x: partner.x - 0.6 * CELL, y: partner.y + 0.2 * CELL, pastime: 'stroll' };
  }
  if (isElder(s, p)) {
    const a = (p.id * 1.7) % (Math.PI * 2);
    return { x: c.x + Math.cos(a) * FIRE_RING * CELL, y: c.y + Math.sin(a) * FIRE_RING * CELL * 0.6, pastime: 'sit' };
  }
  return null;
}
