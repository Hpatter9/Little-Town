import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, EVENT_BY_ID } from '../src/shared/data/events';
import { DRINK_EVENTS, FOOD_EVENTS, KIN_EVENTS, SICK_EVENTS } from '../src/shared/data/eventFit';
import { eatersOf, newGame, type GameState } from '../src/shared/sim/state';

/** Hunger in an event's words. */
const HUNGER = /(^|[^a-z])(hunger|hungry|famine|starv[a-z]*|feast[a-z]*|cook[a-z]*|bread|meals?)([^a-z]|$)/i;
/** Those whose hunger is someone else's (strangers at the gate, a fair's crowd) or not the body's (the phylactery). */
const NOT_THE_TOWNS = ['phylactery', 'e_med_leper', 'e_med_fair', 'w_child_runaway', 'w_refugee_army', 'lost_legion'];

/** A town given everything the events' own `when`s might ask for, so only who lives there can turn one away. */
function ready(origin: 'lich' | 'robot' | 'settlers'): GameState {
  const s = newGame(`event-fit-${origin}`, { origin });
  for (let i = 0; i < 9; i++) s.people.push({ ...s.people[s.people.length - 1], id: s.nextId++, bornTick: undefined });
  s.coins = 500;
  return s;
}

test('every event listed as needing the living is an event', () => {
  for (const id of [...FOOD_EVENTS, ...SICK_EVENTS, ...DRINK_EVENTS, ...KIN_EVENTS]) assert.ok(EVENT_BY_ID[id], id);
});

test('no food or hunger event fires for a town with no eaters; nor sickness, drink, weddings or births', () => {
  for (const origin of ['lich', 'robot'] as const) {
    const s = ready(origin);
    assert.equal(eatersOf(s), 0, `nobody eats in a ${origin} town`);
    for (const id of [...FOOD_EVENTS, ...SICK_EVENTS, ...DRINK_EVENTS, ...KIN_EVENTS]) assert.equal(EVENT_BY_ID[id].when!(s), false, `${id} in a ${origin} town`);
    for (const e of EVENTS) {
      if (NOT_THE_TOWNS.includes(e.id) || !HUNGER.test(`${e.title} ${e.text}`)) continue;
      assert.equal(e.when?.(s) ?? true, false, `${e.id} (about hunger) can come to a ${origin} town`);
    }
  }
});

test('the living still meet them', () => {
  const s = ready('settlers');
  assert.ok(eatersOf(s) > 0);
  for (const id of ['l_cook', 'twins', 'sick_traveller', 'l_rival_friends']) assert.equal(EVENT_BY_ID[id].when!(s), true, id);
});
