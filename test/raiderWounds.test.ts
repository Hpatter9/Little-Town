import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { autoPlace, cumulative, pointAt, startBattle } from '../src/shared/sim/battle';
import { speedOf } from '../src/shared/sim/defenses';
import { takePrisoners } from '../src/shared/sim/prisoners';
import { LAME_MOST, legWound } from '../src/shared/sim/raiderWounds';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { freeSpot, plainGame, put } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.autoBattle = false;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < 3; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    s.people.push(p);
  }
  return s;
}

test('a heavy blow can lame a raider: it walks slower for the rest of the raid, and never below the most a wound takes', () => {
  const s = town('lame-1');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  const rd = r.raiders.find((q) => !q.ally && !ENEMIES[q.kind].kit)!;
  for (let t = 0; t < 400 && !rd.lame; t++) {
    s.tick++;
    legWound(s, rd, rd.maxHp * 0.6);
  }
  assert.ok(rd.lame && rd.lamed, 'lamed');
  assert.ok(speedOf(rd, s.tick) < 1, 'and slowed');
  for (let t = 0; t < 2000; t++) {
    s.tick++;
    legWound(s, rd, rd.maxHp);
  }
  assert.ok(rd.lame! <= LAME_MOST + 1e-9, `never past ${LAME_MOST}`);
  // a scratch hardly ever does it
  const other = r.raiders.find((q) => q !== rd && !q.ally && !ENEMIES[q.kind].kit)!;
  let lamed = 0;
  for (let t = 0; t < 300; t++) {
    s.tick++;
    legWound(s, other, 1);
    if (other.lame) lamed++, (other.lame = 0);
  }
  assert.ok(lamed < 20, `a scratch lamed ${lamed} of 300`);
});

test('a lame bandit breaking from the fight is run down by a fighter close by, taken alive and made a prisoner', () => {
  const s = town('lame-run');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(6));
  r.phase = 'active';
  startBattle(s, r);
  const b = r.battle!;
  autoPlace(s, b, r);
  b.phase = 'fighting';
  b.until = s.tick;
  const u = b.units.find((x) => x.person !== undefined && b.map.spots.find((q) => q.id === x.spot)!.kind === 'block')!;
  const p = s.people.find((q) => q.id === u.person)!;
  const spot = b.map.spots.find((q) => q.id === u.spot)!;
  p.x = spot.x * 32;
  p.y = spot.y * 32;
  for (const x of b.units) x.cooldown = 99999; // (no blows: only the running down)
  const rd = r.raiders.find((q) => !q.ally && !ENEMIES[q.kind].kit)!;
  const path = b.map.paths[rd.bt!.lane] ?? b.map.paths[0];
  const cum = cumulative(path);
  let best = 0;
  const far = (d: number) => Math.hypot(pointAt(path, cum, d)[0] - spot.x, pointAt(path, cum, d)[1] - spot.y);
  for (let d = 0; d <= cum[cum.length - 1]; d += 0.25) if (far(d) < far(best)) best = d;
  rd.bt!.d = best;
  rd.bt!.back = true;
  rd.lame = LAME_MOST;
  rd.lamed = true;
  for (let i = 0; i < 200 && !rd.down && !rd.gone; i++) {
    s.tick++;
    updateRaid(s, new Rng(9 + i));
  }
  assert.ok(rd.down && rd.runDown, `run down (${rd.down}, ${rd.gone}, d ${rd.bt!.d.toFixed(2)})`);
  assert.ok(rd.taken, 'taken alive');
  const before = s.prisoners.length;
  const at = freeSpot(s, 'stockade'); // (a cell to hold them: data/prisons.ts)
  put(s, 'stockade', at.x, at.y);
  takePrisoners(s, [rd], new Rng(1));
  assert.equal(s.prisoners.length, before + 1, 'and made a prisoner');
});

test('a lame raider running through the town is caught by a defender beside it', () => {
  const s = town('lame-town');
  s.battles = false;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(2));
  r.phase = 'active';
  r.arrivesTick = s.tick;
  const rd = r.raiders.find((q) => !q.ally && !ENEMIES[q.kind].kit)!;
  const p = s.people[1];
  p.task = { type: 'defend', cooldown: 0 } as never;
  rd.x = p.x + 10;
  rd.y = p.y;
  rd.fleeing = true;
  rd.lame = LAME_MOST;
  for (let i = 0; i < 200 && !rd.down && !rd.gone; i++) {
    s.tick++;
    p.task = { type: 'defend', cooldown: 0 } as never;
    p.x = rd.x - 10;
    p.y = rd.y;
    updateRaid(s, new Rng(3 + i));
  }
  assert.ok(rd.down && rd.runDown && rd.taken, 'caught and taken');
});
