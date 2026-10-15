import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildingCentre, footprint } from '../src/shared/sim/buildings';
import { CELL, groundAt, isRoad, wet } from '../src/shared/sim/land';
import { roughSpot } from '../src/shared/sim/roughSleep';
import { campXY, newGame } from '../src/shared/sim/state';

test('everyone sleeping rough beds down on a spot of their own round the fire, on open ground', () => {
  const s = newGame('rough1', { origin: 'settlers', biome: 'forest', difficulty: 'easy', founder: { pick: 'maren' } } as Parameters<typeof newGame>[1]);
  // (six with no bed)
  while (s.people.length < 6) s.people.push({ ...structuredClone(s.people[0]), id: 900 + s.people.length });
  const fire = s.buildings.find((b) => b.def === 'campfire');
  const c = fire ? buildingCentre(fire) : campXY(s);
  const cells = new Set<string>();
  for (const p of s.people) {
    p.bed = null;
    const spot = roughSpot(s, p);
    p.task = { type: 'sleep', building: null, spot };
    const cx = Math.floor(spot.x / CELL);
    const cy = Math.floor(spot.y / CELL);
    assert.ok(!cells.has(`${cx},${cy}`), `${p.name} shares a spot`);
    cells.add(`${cx},${cy}`);
    assert.ok(!isRoad(s.land, cx, cy), 'not on a road');
    assert.ok(!wet(groundAt(s.land, cx, cy)), 'not in water');
    for (const b of s.buildings) {
      const r = footprint(b);
      assert.ok(!(cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h), `not inside the ${b.def}`);
    }
    assert.ok(Math.hypot(spot.x - c.x, spot.y - c.y) < 5 * CELL, 'near the fire');
  }
});
