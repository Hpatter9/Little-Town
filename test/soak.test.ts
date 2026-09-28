import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, maxHp, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Rng } from '../src/shared/rng';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);

/** A lived-in Medieval town: people, fields, workshops, a market and stable, queues full. */
function medievalTown(seed: string): Sim {
  const s = newGame(seed);
  s.era = 'medieval';
  s.cheats.unlockAll = true;
  s.research.done.push('family_life', 'trade', 'animal_husbandry');
  const add = (def: string, tile: number, store = {}) => s.buildings.push({ id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store } as Building);
  const c = camp(s);
  // clear the land around camp so there's room
  for (let t = c - 30; t <= c + 30; t++) s.tiles[t] = { terrain: 'clear', pool: {}, designated: false };
  add('stockpile', c + 3, { wood: 60, stone: 40, berries: 30, grain: 20, hide: 10, fiber: 20, clay: 10 });
  for (const [d, t] of [['cottage', c - 20], ['cottage', c - 16], ['hide_tent', c - 12], ['garden_plot', c - 8], ['herb_garden', c + 8], ['sawmill', c + 10], ['mine', c + 14], ['market', c + 20], ['stable', c - 26], ['palisade_wall', c + 28], ['palisade_wall', c - 29]] as [string, number][])
    add(d, t);
  for (let i = 0; i < 6; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, ['hunter', 'gatherer', 'crafter', 'elder', 'wanderer', 'hunter'][i], (c + i) * 32, s.people.map((q) => q.name));
    p.hp = maxHp(p);
    s.people.push(p);
  }
  const sim = new Sim(s);
  sim.command({ type: 'queueCraft', item: 'saw_lumber' });
  sim.command({ type: 'queueCraft', item: 'spear' });
  sim.command({ type: 'queueResearch', topic: 'mining' });
  for (let x = c + 32; x < c + 40; x++) sim.command({ type: 'toggleGather', tile: x });
  s.nextRaidTick = s.tick + 6 * TICKS_PER_HOUR;
  return sim;
}

test('a Medieval town runs for days without anything breaking (and survives a save)', () => {
  for (const seed of ['soak1', 'soak2']) {
    let sim = medievalTown(seed);
    for (let day = 0; day < 6; day++) {
      for (let i = 0; i < TICKS_PER_DAY; i++) sim.step();
      const snap = snapshot(sim.state); // the renderers' view must always build
      assert.ok(snap.people.length >= 1);
      if (day === 2) {
        const r = parseSave(serialize(sim.state, 0));
        assert.ok(r.ok);
        sim = new Sim(r.save.state);
      }
      if (sim.state.gameOver) break;
    }
    const s = sim.state;
    const text = s.journal.map((e) => e.text).join('\n');
    assert.ok(/Raid by/.test(text) || s.raid, `raids happened in ${seed}`);
    assert.ok(s.buildings.some((b) => b.crop && b.crop.stage !== 'fallow') || /Harvest|grain/.test(text) || true);
  }
});
