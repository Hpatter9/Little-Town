// Where someone with no bed sleeps (the owner's complaint: they all stood in the middle of the town to sleep). Each
// beds down on a spot of their own round the camp's fire, for its warmth: the first just beside it, the rest on rings
// about it, the nearest ring first, their place on it by their id, never on a road, in a building, in water or rock,
// and a cell clear of any building where there's room. The map lays them down there (map/mapPeople.ts).

import { footprint } from './buildings';
import { castleLayout } from './castle';
import { CELL, groundAt, idx, inMap, isPlannedRoad, isRoad, wet, type Pt } from './land';
import { campXY, type GameState, type Person } from './state';

/** The rings round the fire (cells out), and how many places on each. */
const RINGS = [1.7, 2.6, 3.5, 4.4];
const PLACES = [8, 12, 16, 20];

/** A spot on open ground round the fire for someone sleeping rough (world px). */
export function roughSpot(s: GameState, p: Person): Pt {
  const c = campXY(s);
  // (the cells taken by buildings, and the cells round them: a heaped stockpile or a building site spills over its
  // footprint; and the spots of those already asleep out here)
  const built = new Set<number>();
  const near = new Set<number>();
  for (const b of s.buildings) {
    if (b.room) continue;
    const r = footprint(b);
    for (let y = r.y - 1; y <= r.y + r.h; y++)
      for (let x = r.x - 1; x <= r.x + r.w; x++) (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h ? built : near).add(y * 4096 + x);
  }
  const cellKey = (pt: Pt) => Math.floor(pt.y / CELL) * 4096 + Math.floor(pt.x / CELL);
  const taken = new Set<number>();
  for (const q of s.people) {
    if (q === p || q.task?.type !== 'sleep' || q.task.building !== null) continue;
    if (q.task.spot) taken.add(cellKey(q.task.spot));
    if (q.activity === 'sleep') taken.add(cellKey(q)); // (and wherever someone already lies)
  }
  // (the first beside the fire, where the town has always slept rough; the rest spread round it)
  const first = { x: c.x - CELL, y: c.y + CELL };
  if (!taken.has(cellKey(first))) return first;
  const m = s.land;
  const castle = castleLayout(s)?.region; // (never inside a castle's or a hold's walls)
  for (const clear of [true, false])
    for (let ring = 0; ring < RINGS.length; ring++) {
      const n = PLACES[ring];
      const start = (p.id * 5 + ring * 3) % n;
      for (let i = 0; i < n; i++) {
        const a = (((start + i) % n) / n) * Math.PI * 2 + ring * 0.4;
        const x = c.x + Math.cos(a) * RINGS[ring] * CELL;
        const y = c.y + Math.sin(a) * RINGS[ring] * CELL * 0.85;
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);
        const k = cy * 4096 + cx;
        if (!inMap(m, cx, cy) || castle?.has(idx(m, cx, cy)) || built.has(k) || (clear && near.has(k)) || taken.has(k) || isRoad(m, cx, cy) || isPlannedRoad(m, cx, cy)) continue;
        const g = groundAt(m, cx, cy);
        if (wet(g) || g === 'mountain' || g === 'rock') continue;
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
  // (nowhere free: beside the fire)
  return first;
}
