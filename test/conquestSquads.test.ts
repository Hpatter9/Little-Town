import assert from 'node:assert/strict';
import { test } from 'node:test';
import { piece } from '../src/shared/data/quality';
import { SQUAD_SLOTS, TROOP_BY_ID, TROOPS } from '../src/shared/data/troops';
import { command, conquestDaily, disbandSquad, formSquad, heroStrength, leadership, leads, setSlot, squadStrength, train, troopWorth } from '../src/shared/sim/conquest/squads';
import { worldOf } from '../src/shared/sim/conquest/conquest';
import { warView } from '../src/shared/sim/conquest/warView';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('troops: every kind is worth about a soldier or more, and the peoples have one each', () => {
  for (const t of TROOPS) {
    assert.ok(troopWorth(t) >= 0.6 && troopWorth(t) <= 4, `${t.id} worth ${troopWorth(t)}`);
    assert.ok(t.cost.coins > 0);
  }
  const owned = TROOPS.filter((t) => t.origin).map((t) => t.origin);
  assert.equal(new Set(owned).size, 11);
  assert.ok(TROOPS.filter((t) => !t.origin).length >= 15);
});

test('a hero carries the squad: level and gear beat numbers', () => {
  const s = plainGame('hero');
  const green = s.people[0];
  green.cls = 'warrior';
  green.road = 'fighter';
  green.level = 1;
  green.gear = {};
  // a seasoned hero in the best gear
  const vet = { ...green, id: 99, name: 'Vet', level: 60, road: 'titan', attrPts: undefined, gear: { weapon: 'iron_sword', body: 'steel_cuirass' }, gearQ: { weapon: piece(7, 5), body: piece(7, 5) }, skills: structuredClone(green.skills) };
  for (const k of Object.keys(vet.skills) as (keyof typeof vet.skills)[]) vet.skills[k] = { level: 40, xp: 0 };
  s.people.push(vet as typeof green);
  assert.ok(heroStrength(vet as typeof green) > heroStrength(green) * 4, `vet ${heroStrength(vet as typeof green)} vs green ${heroStrength(green)}`);
  assert.ok(leadership(vet as typeof green) >= 7 && leadership(green) <= 3);
  assert.ok(command(vet as typeof green) > 1.8 && command(green) < 1.2);
  // the squads: nine militia under the green hero, three under the veteran
  s.conquest!.troops.militia = 12;
  const a = formSquad(s, green.id).squad!;
  const b = formSquad(s, vet.id).squad!;
  s.conquest!.recruits = 0;
  // (the green hero can't lead nine: their command is small)
  let placed = 0;
  for (let i = 0; i < SQUAD_SLOTS; i++) if (setSlot(s, a.id, i, 'militia').ok) placed++;
  assert.equal(placed, leadership(green));
  for (let i = 0; i < 3; i++) assert.ok(setSlot(s, b.id, i, 'militia').ok);
  // even were the green hero to lead nine, the veteran's three win by far
  a.slots = Array(SQUAD_SLOTS).fill('militia');
  const weak = squadStrength(s, a);
  const strong = squadStrength(s, b);
  assert.ok(strong > weak * 2, `strong ${strong} vs weak ${weak}`);
  assert.ok(disbandSquad(s, a.id));
  assert.ok(s.conquest!.troops.militia >= 9, 'the troops come back');
});

test('training and the days: recruits from the provinces, batches done, upkeep paid', () => {
  const s = plainGame('train');
  const c = s.conquest!;
  s.coins = 100;
  c.recruits = 5;
  s.buildings[0].store.wood = 10;
  assert.equal(train(s, 'nobody', 1).ok, false);
  assert.equal(train(s, 'archers', 1).ok, false, 'not yet studied');
  assert.equal(train(s, 'thralls', 1).ok, false, "another people's");
  const r = train(s, 'spearmen', 3);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(c.recruits, 2);
  assert.equal(s.coins, 100 - 3 * TROOP_BY_ID.spearmen.cost.coins);
  assert.equal(s.buildings[0].store.wood, 7);
  assert.equal(c.training.length, 1);
  const sim = new Sim(s);
  for (let i = 0; i < 13 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(c.training.length, 0);
  assert.equal(c.troops.spearmen, 3);
  // a day's reckoning: the town's provinces yield
  const w = worldOf(s)!;
  const held = c.holder.filter((h) => h === 'town').length;
  assert.ok(held >= 1);
  const coins = s.coins ?? 0;
  const rec = c.recruits;
  conquestDaily(s, c);
  assert.ok(c.recruits > rec, 'recruits came');
  assert.equal(s.coins, coins, "the town's treasury is left alone");
  assert.ok(c.chest > 0, 'the war chest filled');
  assert.ok(Object.values(c.goods).some((n) => n > 0), 'the war stores filled');
  void w;
  // the view
  const v = warView(s)!;
  assert.equal(v.provinces.length, w.provinces.length);
  assert.ok(v.troops.some((t) => t.id === 'spearmen' && t.n === 3));
  assert.ok(v.heroes.length >= 1);
  const hero = s.people[0];
  assert.ok(leads(hero, 'settlers').length >= 2);
});
