import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GARRISON_HOLDS, REVOLT_GRACE_DAYS } from '../src/shared/data/troops';
import { addToArmy, armiesDaily, armyOfPerson, dismissArmy, garrison, homeProvince, legTicks, marchArmy, pickUp, raiseArmy, recallArmy, wayTo, loadTrain } from '../src/shared/sim/conquest/armies';
import { worldOf } from '../src/shared/sim/conquest/conquest';
import { formSquad, setSlot, disbandSquad } from '../src/shared/sim/conquest/squads';
import { warView } from '../src/shared/sim/conquest/warView';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { piece } from '../src/shared/data/quality';
import { battleOfArmy } from '../src/shared/sim/conquest/battles';
import { plainGame } from './helpers';
import { CONQUEST } from '../src/shared/data/conquest';

CONQUEST.on = true; // (the conquest is parked in the game, but its code stays tested)

/** Every province is fought for now: the town's heroes made seasoned enough to win free ground. */
const season = (p: ReturnType<typeof plainGame>['people'][number]) => {
  Object.assign(p, { level: 60, road: 'titan', cls: 'warrior', attrPts: undefined, gear: { weapon: 'iron_sword', body: 'steel_cuirass' }, gearQ: { weapon: piece(7, 5), body: piece(7, 5) } });
  for (const k of Object.keys(p.skills) as (keyof typeof p.skills)[]) p.skills[k] = { level: 40, xp: 0 };
};

test('an army marches by order, takes free provinces, its heroes away meanwhile, and comes home', () => {
  const s = plainGame('army');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const hero = s.people[0];
  season(hero);
  c.troops.militia = 6;
  const q = formSquad(s, hero.id, false).squad!; // (formed empty: the counts below are the test's own)
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
  assert.notEqual(c.holder[free!], 'town', 'free ground is not taken without a fight');
  assert.ok(battleOfArmy(c, a.id), 'a battle for it');
  for (let i = 0; i < TICKS_PER_DAY && battleOfArmy(c, a.id); i++) sim.step();
  assert.equal(c.holder[free!], 'town', 'the free province is won');
  // the march is over: its report
  const m = c.marches?.[0];
  assert.ok(m, 'a march report');
  assert.equal(m!.outcome, 'arrived');
  assert.equal(m!.won, 1);
  assert.deepEqual(m!.taken, [w.provinces[free!].name]);
  assert.ok(s.prompts.some((p) => p.kind === 'debrief' && p.title === `The march of ${a.name}`), 'told in the event box');
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
  season(s.people[0]);
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
  for (let i = 0; i < 12 * TICKS_PER_DAY && (a.at !== far || battleOfArmy(c, a.id) || a.march); i++) sim.step();
  assert.equal(a.at, far);
  assert.equal(c.holder[far], 'town');
  const m = c.marches![0];
  assert.ok(m.fought >= 2 && m.won === m.fought, 'a battle for every province on the way');
  assert.ok(m.taken.length >= 2);
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
