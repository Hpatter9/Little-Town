import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PATH_ABILITIES, abilitiesKnown } from '../src/shared/data/abilities';
import { ATTR_KEYS } from '../src/shared/data/attributes';
import { STAGE_LEVELS } from '../src/shared/data/classes';
import { emblemOf } from '../src/shared/data/emblems';
import { callingName, FOUNDER_CLASSES } from '../src/shared/data/founderClasses';
import { FOUNDER_ROADS } from '../src/shared/data/founderLines';
import { classStat, EVOLVE_ATTRS, EVOLVE_HP, evolveSteps, levelPower, stageOf } from '../src/shared/data/levels';
import { ORIGIN_ROADS } from '../src/shared/data/originPaths';
import { ORIGINS } from '../src/shared/data/origins';
import { branchesOf, FOUNDER_PATHS, lineage, ORIGIN_PATHS, PATH_BY_ID, roadsFrom } from '../src/shared/data/paths';
import { LEANS } from '../src/shared/data/pathAttrs';
import { attributesOf } from '../src/shared/sim/attributes';
import { adoptFounderRoad, classesHourly, roadsOpen } from '../src/shared/sim/classes';
import { personFighter } from '../src/shared/sim/combat';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makePerson, maxHp, newGame } from '../src/shared/sim/state';
import { FOUNDERS } from '../src/shared/data/founders';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('every people has a road of its own: a third choice at the second evolution, its own name, lore, skill and emblem', () => {
  for (const o of ORIGINS) assert.equal(ORIGIN_ROADS.filter((r) => r.origin === o).length, 1, `${o} has one road of its own`);
  assert.equal(ORIGIN_PATHS.length, ORIGIN_ROADS.length * 3);
  for (const n of ORIGIN_PATHS) {
    assert.ok(n.origin);
    if (n.stage < 4) {
      assert.ok((n.lore ?? '').length > 60, `${n.id} has lore`);
      assert.ok(PATH_ABILITIES.some((a) => a.path === n.id && a.id !== `ascendancy_${n.id}`), `${n.id} has a signature skill`);
      assert.ok(LEANS[n.id], `${n.id} has a lean`);
    } else assert.ok(PATH_ABILITIES.some((a) => a.path === n.id), `${n.id} has the ascendancy`);
    assert.ok(emblemOf(n.id)?.main, `${n.id} has an emblem`);
  }
  for (const r of ORIGIN_ROADS) {
    // only their own people see it; the shared tree is as it was
    assert.ok(!branchesOf(r.from).some((n) => n.origin), `${r.from}'s shared roads are two`);
    const theirs = roadsFrom(r.from, r.origin);
    assert.equal(theirs.length, 3);
    for (const o of ORIGINS) if (o !== r.origin) assert.ok(!roadsFrom(r.from, o).some((n) => n.origin === r.origin));
    // its emblem differs from the shared roads'
    const looks = theirs.map((n) => { const e = emblemOf(n.id)!; return JSON.stringify([e.behind, e.main, e.charge]); });
    assert.equal(new Set(looks).size, 3, `${r.from}'s three roads look different`);
    // and straight on from there to the ascended form
    assert.deepEqual(branchesOf(r.two.id).map((n) => n.id), [r.three.id]);
    assert.deepEqual(branchesOf(r.three.id).map((n) => n.id), [r.asc[0]]);
  }
});

test('a lich at the fork is offered the Grave Cantor; a settler there is not; the road\'s skill is theirs once taken', () => {
  const s = plainGame('origin-road');
  s.autopilot = true;
  s.origin = 'lich';
  const p = s.people[0];
  p.origin = 'lich';
  p.cls = 'witch';
  p.road = 'occultist';
  p.level = STAGE_LEVELS[2];
  assert.ok(roadsOpen(p, s).some((n) => n.id === 'grave_cantor'));
  const settler = makePerson(new Rng(1), 900, 'hunter', { x: 0, y: 0 }, []);
  Object.assign(settler, { origin: 'settlers', cls: 'witch', road: 'occultist', level: STAGE_LEVELS[2] });
  assert.ok(!roadsOpen(settler, s).some((n) => n.origin));
  s.tick = TICKS_PER_HOUR;
  classesHourly(s);
  const q = s.prompts.find((x) => x.kind === 'evolve' && x.who === p.id)!;
  assert.equal(q.options.length, 4, 'three roads and "let them choose"');
  answerPrompt(s, q.id, q.roads!.indexOf('grave_cantor'), new Rng(2));
  assert.equal(p.road, 'grave_cantor');
  assert.equal(p.cls, 'necromancer');
  assert.ok(abilitiesKnown(p.cls, p.level, p.road).some((a) => a.id === 'requiem'));
  // a people's road is a step stronger than a shared road of the same archetype at the same stage
  const shared = { ...p, road: 'necromancer', origin: 'lich' as const };
  assert.ok(evolveSteps(p) > evolveSteps(shared));
  assert.ok(maxHp(p) > maxHp(shared));
});

test('evolving is a big jump: attributes, health and power all rise well beyond a level\'s worth', () => {
  const s = plainGame('evolve-jump');
  const p = s.people[0];
  p.cls = 'warrior';
  p.level = STAGE_LEVELS[1];
  p.road = 'fighter';
  p.hp = 1e9;
  const before = { at: attributesOf(p), hp: maxHp(p), power: levelPower(p), f: personFighter(p, 'fighter', 'front') };
  p.road = 'berserker';
  p.cls = 'warrior';
  const after = { at: attributesOf(p), hp: maxHp(p), power: levelPower(p), f: personFighter(p, 'fighter', 'front') };
  const sum = (a: typeof before.at) => ATTR_KEYS.reduce((n, k) => n + a[k], 0);
  assert.ok(sum(after.at) >= sum(before.at) + 8 * EVOLVE_ATTRS - 1, `attributes ${sum(before.at)} to ${sum(after.at)}`);
  assert.ok(after.at.str >= before.at.str + 6, 'their road\'s favoured attribute doubly');
  assert.ok(after.hp >= before.hp * (1 + EVOLVE_HP), `health ${before.hp} to ${after.hp}`);
  assert.ok(after.power >= before.power * 1.1, `power ${before.power} to ${after.power}`);
  assert.ok(after.f.damage[1] > before.f.damage[1] * 1.2, `blows ${before.f.damage} to ${after.f.damage}`);
  assert.ok(after.f.maxHp > before.f.maxHp * 1.2, `fight health ${before.f.maxHp} to ${after.f.maxHp}`);
  // and every stage more: an ascended form most of all
  const hps = [0, 1, 2, 3, 4].map((st) => maxHp({ ...p, road: lineage('avatar_of_slaughter')[st].id, level: STAGE_LEVELS[st] }));
  for (let i = 1; i < hps.length; i++) assert.ok(hps[i] > hps[i - 1]);
});

test('founders evolve by choice too: the line\'s own stage or a road of their own, and grow more than anyone', () => {
  for (const f of FOUNDER_CLASSES) {
    assert.ok(FOUNDER_ROADS[f.id], `${f.id} has roads of their own`);
    // a tree to the third stage, two roads at every fork, then the line's last stage
    let at = [`f_${f.id}`];
    for (let st = 1; st <= 3; st++) {
      at = at.flatMap((id) => {
        const roads = branchesOf(id);
        assert.equal(roads.length, 2, `${id} forks`);
        assert.deepEqual(roads.map((r) => r.name), [f.stages[st], FOUNDER_ROADS[f.id].alt[st - 1][0]]);
        const [a, b] = roads.map((r) => { const e = emblemOf(r.id)!; return JSON.stringify([e.behind, e.main, e.charge]); });
        assert.notEqual(a, b, `${id}'s roads look different`);
        return roads.map((r) => r.id);
      });
    }
    for (const id of at) assert.deepEqual(branchesOf(id).map((r) => r.name), [f.stages[4]]);
  }
  assert.equal(FOUNDER_PATHS.length, FOUNDER_CLASSES.length * 23);

  const s = newGame('founder-evolves', { origin: 'settlers', founder: { pick: 'maren', background: '', traits: [], look: FOUNDERS.settlers.find((x) => x.id === 'maren')!.look, name: '' } });
  const p = s.people.find((q) => q.id === s.mainId)!;
  assert.equal(p.road, 'f_maren');
  p.level = STAGE_LEVELS[1];
  s.tick = TICKS_PER_HOUR;
  classesHourly(s);
  const q = s.prompts.find((x) => x.kind === 'evolve' && x.who === p.id)!;
  assert.ok(q, 'the founder is asked');
  assert.deepEqual(q.options, ['Harvest Mother', 'Hearth-Warden', 'Let them choose']);
  answerPrompt(s, q.id, 1, new Rng(3));
  assert.equal(p.road, 'f_maren_a');
  assert.equal(stageOf(p), 1);
  assert.equal(callingName(p, 1), 'Hearth-Warden');
  assert.equal(callingName(p, 2), 'Seedwarden', 'the stages to come are the line\'s own');
  // the road of their own leans to its bent (Hearth-Warden: health and armour)
  const own = { ...p, road: 'f_maren_o' };
  assert.ok(classStat(p, 'armor') > classStat(own, 'armor'));
  // a founder's evolution lifts them more than anyone else's
  const plain = makePerson(new Rng(4), 901, 'hunter', { x: 0, y: 0 }, []);
  Object.assign(plain, { cls: 'druid', road: 'druid', level: STAGE_LEVELS[1] });
  assert.ok(evolveSteps(p) > evolveSteps(plain));
});

test('a founder from before the choices stands on the line\'s own node of their stage', () => {
  const p = makePerson(new Rng(5), 1, 'hunter', { x: 0, y: 0 }, []);
  Object.assign(p, { cls: 'warrior', fcls: 'grakk', level: STAGE_LEVELS[2] + 1, road: null });
  adoptFounderRoad(p);
  assert.equal(p.road, 'f_grakk_o_o');
  assert.equal(callingName(p, 2), 'Warboss');
  assert.ok(PATH_BY_ID[p.road!].founder === 'grakk');
});
