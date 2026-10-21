import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events';
import { ORIGIN_OPTIONS, originOptions } from '../src/shared/data/originOptions';
import type { OriginId } from '../src/shared/data/origins';
import { Rng } from '../src/shared/rng';
import { answerEvent, startEvent } from '../src/shared/sim/events';
import { bloodInStore } from '../src/shared/sim/vampires';
import { packOn } from '../src/shared/sim/pack';
import { newGame, type Building, type GameState } from '../src/shared/sim/state';

/** A town of this people with the autopilot and the events off, as the other single-mechanic tests have it. */
function town(origin: OriginId, seed = 'origin-options'): GameState {
  const s = newGame(`${seed}-${origin}`, { origin });
  s.autopilot = false;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  s.battles = false;
  return s;
}
/** Put an event to the town and answer the extra option (the last). */
function answerExtra(s: GameState, id: string): string[] {
  startEvent(s, EVENT_BY_ID[id], new Rng(1));
  const before = s.journal.length;
  answerEvent(s, EVENT_BY_ID[id].options.length, new Rng(2));
  return s.journal.slice(before).map((j) => j.text);
}

test('every people has at least three extra answers, each on a real event, with a plain line on the button', () => {
  let total = 0;
  for (const [origin, extra] of Object.entries(ORIGIN_OPTIONS)) {
    const ids = Object.keys(extra!);
    assert.ok(ids.length >= 3, `${origin} has ${ids.length}`);
    for (const id of ids) {
      assert.ok(EVENT_BY_ID[id], `${origin}: no event ${id}`);
      assert.ok(extra![id].effects.length > 0 && extra![id].label.includes('('), `${origin}/${id}: the label says what it does`);
      total++;
    }
  }
  assert.equal(Object.keys(ORIGIN_OPTIONS).length, 13);
  assert.ok(total >= 40, `${total} extra answers`);
});

test('an extra answer shows only to its own people, last on the event card', () => {
  const towns = new Map<string, GameState>();
  const shown = (origin: string, id: string): string[] => {
    const s = towns.get(origin) ?? town(origin as OriginId);
    towns.set(origin, s);
    s.event = undefined;
    startEvent(s, EVENT_BY_ID[id], new Rng(1));
    return s.prompts[s.prompts.length - 1].options;
  };
  for (const [origin, extra] of Object.entries(ORIGIN_OPTIONS)) {
    for (const id of Object.keys(extra!)) {
      const base = EVENT_BY_ID[id].options.length;
      const mine = shown(origin, id);
      assert.equal(mine.length, base + 1, `${origin}/${id}`);
      assert.ok(mine[base].startsWith(extra![id].label.split(' (')[0]));
      for (const other of Object.keys(ORIGIN_OPTIONS)) {
        if (other !== origin && !originOptions(other as OriginId, id).length) assert.equal(shown(other, id).length, base, `${other}/${id}`);
      }
    }
  }
});

test('the Blood Court takes refugees for the blood farm: captives in the cells, blood in store', () => {
  const s = town('vampire');
  s.buildings.push({ id: 900, def: 'blood_farm', tile: s.land.camp.x + 8, row: s.land.camp.y + 4, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  const blood = bloodInStore(s);
  answerExtra(s, 'refugees');
  assert.ok(s.prisoners.length > 0);
  assert.ok(bloodInStore(s) > blood);
});

test('the liches raise the dead among the refugees', () => {
  const s = town('lich');
  const before = s.people.length;
  answerExtra(s, 'refugees');
  const raised = s.people.slice(before);
  assert.ok(raised.length > 0 && raised.every((p) => p.monster === 'undead'));
});

test('each people\'s own measure moves with its answer', () => {
  const grove = town('druid');
  answerExtra(grove, 'bumper_crop');
  assert.equal(grove.grove!.favour, 16);

  const court = town('fae');
  answerExtra(court, 'comet');
  assert.equal(court.court!.favour, 15);

  const work = town('alchemists');
  answerExtra(work, 'hermit_tome');
  assert.equal(work.work!.progress, 3);

  const order = town('knights');
  answerExtra(order, 'mercenaries');
  assert.equal(order.order!.honour, 13);

  const colony = town('robot');
  const power = colony.foundry?.power ?? 70;
  answerExtra(colony, 'l_gale');
  assert.equal(colony.foundry!.power, Math.min(100, power + 10));

  const settlers = town('settlers');
  answerExtra(settlers, 'bumper_crop');
  assert.equal(settlers.frontier!.wagons, 1);

  const wolves = town('werewolf');
  assert.ok(packOn(wolves));
  answerExtra(wolves, 'l_wolf_pup');
  assert.equal(wolves.pack!.renown, 3);

  const horde = town('orcs');
  const fury = horde.horde?.fury ?? 0;
  const people = horde.people.length;
  answerExtra(horde, 'captive_raider');
  assert.ok(horde.horde!.fury > fury);
  assert.equal(horde.people.length, people + 1);
});

test('the nomads, merfolk and dwarves are paid in their own stock', () => {
  const nomads = town('nomads');
  const horses = nomads.horses.length;
  answerExtra(nomads, 'wild_horses');
  assert.equal(nomads.horses.length, horses + 3);

  const sea = town('merfolk');
  const stock = () => Object.values(sea.buildings).reduce((n, b) => n + (b.store.fish ?? 0), 0);
  const fish = stock();
  answerExtra(sea, 'l_gale');
  assert.ok(stock() > fish);

  const hold = town('dwarves');
  const ore = () => hold.buildings.reduce((n, b) => n + (b.store.iron_ore ?? 0), 0);
  const had = ore();
  answerExtra(hold, 'cave');
  assert.ok(ore() >= had + 8);
});
