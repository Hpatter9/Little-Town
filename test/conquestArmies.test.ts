import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GARRISON_HOLDS, REVOLT_GRACE_DAYS } from '../src/shared/data/troops';
import { addToArmy, armiesDaily, armyOfPerson, dismissArmy, garrison, homeProvince, legTicks, marchArmy, pickUp, raiseArmy, recallArmy, wayTo, loadTrain } from '../src/shared/sim/conquest/armies';
import { worldOf } from '../src/shared/sim/conquest/conquest';
import { formSquad, setSlot, disbandSquad } from '../src/shared/sim/conquest/squads';
import { warView } from '../src/shared/sim/conquest/warView';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('an army marches by order, takes free provinces, its heroes away meanwhile, and comes home', () => {
  const s = plainGame('army');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const hero = s.people[0];
  c.troops.militia = 6;
  const q = formSquad(s, hero.id).squad!;
  assert.ok(setSlot(s, q.id, 0, 'militia').ok);
  const r = raiseArmy(s, q.id);
  assert.ok(r.ok, r.reason ?? '');
  const a = r.army!;
  assert.equal(a.at, homeProvince(w));
  assert.ok(loadTrain(s, a.id, 'militia', 4).ok);
  assert.equal(c.troops.militia, 1);
  // a free neighbour of the home province (not a lair)
  const home = w.provinces[homeProvince(w)];
  const free = home.neighbours.find((n) => c.holder[n] === null && w.provinces[n].landmark !== 'lair');
  const held = home.neighbours.find((n) => c.holder[n] === 'town');
  assert.ok(free !== undefined && held !== undefined, 'a free neighbour and a held one');
  assert.deepEqual(wayTo(w, c, home.id, free!), [free]);
  assert.ok(marchArmy(s, a.id, free!).ok);
  assert.equal(a.going, free);
  assert.equal(hero.away, -a.id, 'the hero is away with the army');
  assert.equal(armyOfPerson(c, hero)?.id, a.id);
  assert.ok(disbandSquad(s, q.id) === false, 'a squad afield stays');
  const sim = new Sim(s);
  const ticks = legTicks(w, home.id, free!);
  for (let i = 0; i <= ticks + 1; i++) sim.step();
  assert.equal(a.going, null);
  assert.equal(a.at, free);
  assert.equal(c.holder[free!], 'town', 'the free province is taken');
  assert.equal(hero.away, -a.id, 'still afield');
  // a garrison left, then home
  assert.ok(garrison(s, a.id, GARRISON_HOLDS).ok);
  assert.equal(Object.values(c.garrisons![free!]).reduce((n, k) => n + k, 0), GARRISON_HOLDS);
  assert.ok(pickUp(s, a.id).ok);
  assert.equal(c.garrisons![free!], undefined);
  assert.ok(garrison(s, a.id, GARRISON_HOLDS).ok);
  assert.ok(recallArmy(s, a.id).ok);
  for (let i = 0; i <= legTicks(w, free!, home.id) + 1; i++) sim.step();
  assert.equal(a.at, home.id);
  assert.equal(hero.away, null, 'home again');
  assert.ok(hero.x !== undefined);
  // the view
  const v = warView(s)!;
  assert.equal(v.armies.length, 1);
  assert.equal(v.armies[0].home, true);
  assert.equal(v.provinces[free!].garrison, GARRISON_HOLDS);
  assert.equal(v.home, home.id);
  assert.ok(dismissArmy(s, a.id).ok);
  assert.equal(c.troops.militia, 2, 'the train comes back');
});

test('the way goes through friendly land only; a second squad joins at home; bare provinces revolt', () => {
  const s = plainGame('army2');
  s.people.push({ ...structuredClone(s.people[0]), id: 77, name: 'Second' });
  const c = s.conquest!;
  const w = worldOf(s)!;
  const q1 = formSquad(s, s.people[0].id).squad!;
  const q2 = formSquad(s, 77).squad!;
  const a = raiseArmy(s, q1.id).army!;
  assert.ok(addToArmy(s, a.id, q2.id).ok);
  assert.equal(raiseArmy(s, q2.id).ok, false, 'in an army already');
  const home = homeProvince(w);
  // a rival's capital: no way through its land
  const rival = w.realms[1];
  const rivalCap = w.provinces[rival.capital];
  for (const n of rivalCap.neighbours) if (c.holder[n] === null) c.holder[n] = rival.id;
  const way = wayTo(w, c, home, rival.capital);
  if (way) assert.ok(way.slice(0, -1).every((p) => c.holder[p] === null || c.holder[p] === 'town'), 'friendly all the way but the last');
  // a far free province: the march is leg by leg
  const far = w.provinces.map((p) => p.id).filter((i) => c.holder[i] === null && w.provinces[i].landmark !== 'lair' && wayTo(w, c, home, i)!.length >= 2)[0];
  assert.ok(far !== undefined);
  assert.ok(marchArmy(s, a.id, far).ok);
  assert.ok(a.path.length >= 1);
  const sim = new Sim(s);
  for (let i = 0; i < 6 * TICKS_PER_DAY && a.at !== far; i++) sim.step();
  assert.equal(a.at, far);
  assert.equal(c.holder[far], 'town');
  // revolt: a bare province past its grace goes free on some day
  const taken = c.holder.map((h, i) => (h === 'town' && i !== home && i !== a.at ? i : -1)).filter((i) => i >= 0);
  assert.ok(taken.length >= 1);
  for (const i of taken) c.taken![i] = -REVOLT_GRACE_DAYS;
  let lost = 0;
  for (let d = 0; d < 400 && !lost; d++) {
    s.tick = d * TICKS_PER_DAY;
    armiesDaily(s, c, w);
    lost = taken.filter((i) => c.holder[i] !== 'town').length;
  }
  assert.ok(lost >= 1, 'a bare province revolted');
  // the army's province never did: it stands there
  assert.equal(c.holder[far], 'town');
});
