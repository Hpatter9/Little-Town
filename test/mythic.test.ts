import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITY_BY_ID, ALL_ABILITIES } from '../src/shared/data/abilities';
import { CLASSES } from '../src/shared/data/classes';
import { emblemOf } from '../src/shared/data/emblems';
import { ENEMIES } from '../src/shared/data/enemies';
import { classStat, evolveSteps, ORIGIN_EDGE, ORIGIN_EVOLVE } from '../src/shared/data/levels';
import { MYTHIC_CALLINGS, MYTHIC_EDGE, MYTHIC_EVOLVE, MYTHIC_HEIR_ODDS, MYTHIC_ODDS, MYTHIC_OMEN_ODDS, mythicId, mythicNodes, WANDERER_ROAD } from '../src/shared/data/mythic';
import { callingNodes, ORIGIN_CALLINGS } from '../src/shared/data/originCallings';
import { PACK_SHEETS } from '../src/shared/data/packSheets';
import { armsOf, formOf, isMythic, lineage, MYTHIC_BASES, MYTHIC_PATHS, PATH_BY_ID, PATHS, roadsFrom } from '../src/shared/data/paths';
import { FORK } from '../src/shared/data/pathLore';
import { LEANS } from '../src/shared/data/pathAttrs';
import { roadNodes } from '../src/shared/data/callings/kit';
import { HERO_FORM } from '../src/renderer/art/heroForms';
import { ascend, assignClass, classesHourly, mythicOdds, mythicRoll, mythicYearLines } from '../src/shared/sim/classes';
import { makePerson, newGame } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('five mythic callings, each a whole tree; the Summoner\'s road grows from the first, the Wanderer has a new one', () => {
  assert.equal(MYTHIC_CALLINGS.length, 5);
  assert.equal(MYTHIC_BASES.length, 5);
  const shared = (stage: number) => PATHS.filter((n) => n.stage === stage && lineage(n.id)[0].id === 'fighter').length;
  for (const b of MYTHIC_BASES) {
    const tree = Object.values(PATH_BY_ID).filter((n) => lineage(n.id)[0].id === b.id);
    for (let st = 0; st <= 4; st++) assert.equal(tree.filter((n) => n.stage === st).length, shared(st), `${b.id} stage ${st}`);
    for (const n of tree) {
      assert.ok(n.mythic && isMythic(n.id), `${n.id} is mythic`);
      assert.equal(roadsFrom(n.id, 'settlers').length, n.stage < 3 ? 2 : n.stage === 3 ? 1 : 0, `${n.id} forks`);
    }
  }
  assert.equal(PATH_BY_ID.summoner.from, mythicId(MYTHIC_CALLINGS[0].base.id));
  for (const id of ['summoner', 'conjurer', 'beastcaller', 'voidbinder', 'planeswalker']) assert.ok(isMythic(id), `${id} is mythic now`);
  // the Wanderer keeps two roads: the Druid's and its new one
  const wander = roadsFrom('wanderer', 'settlers');
  assert.equal(wander.length, 2);
  assert.ok(wander.some((r) => r.id === 'druid') && wander.some((r) => r.id === WANDERER_ROAD![0].id));
  assert.ok(wander.every((r) => !r.mythic));
  for (const [n, stage] of roadNodes(WANDERER_ROAD!)) {
    assert.equal(PATH_BY_ID[n.id].stage, stage);
    assert.ok(PATH_BY_ID[n.id].lore && LEANS[n.id] && emblemOf(n.id)?.main && ABILITY_BY_ID[n.skill[0]]?.path === n.id, `${n.id} is whole`);
    assert.equal(ALL_ABILITIES.filter((a) => a.id === n.skill[0]).length, 1, `${n.skill[0]} is its own`);
  }
});

test('every mythic node has a skill nobody else has, an emblem that glows, a form of its own, and its tellings', () => {
  const elsewhere = new Set<string>([...Object.values(HERO_FORM).flat(), ...ORIGIN_CALLINGS.flatMap((t) => callingNodes(t).map(([, n]) => n.form).filter((f): f is NonNullable<typeof f> => !!f))]);
  const names = new Set(Object.values(PATH_BY_ID).filter((n) => !n.mythic).map((n) => n.name));
  for (const t of MYTHIC_CALLINGS) {
    assert.ok(t.born.includes('{name}') && t.born.includes('{town}') && t.title.length > 3, `${t.base.id} is told`);
    assert.ok(FORK[mythicId(t.base.id)]?.includes('{name}'));
    for (const [id, n] of mythicNodes(t)) {
      assert.ok(CLASSES.includes(n.cls) && n.lore.length > 60, id);
      assert.ok(!names.has(n.name), `${n.name} is a mythic calling's own name`);
      const skill = ABILITY_BY_ID[mythicId(n.skill[0])];
      assert.ok(skill?.path === id, `${id}'s skill`);
      assert.equal(ALL_ABILITIES.filter((a) => a.id === skill.id).length, 1);
      if (skill.active) for (const e of skill.active.effects) if (e.summon) assert.ok(ENEMIES[e.summon], e.summon);
      if (n.companion) assert.ok(ENEMIES[n.companion]);
      assert.ok(LEANS[id]);
      assert.ok(emblemOf(id)?.mythic && emblemOf(id)?.colours === t.colours, `${id}'s emblem glows`);
      const form = formOf(id)!;
      assert.ok(form in PACK_SHEETS && !elsewhere.has(form), `${id}: ${form} is the mythic callings' own`);
      assert.ok(armsOf(id));
    }
  }
  // (and the grafted Summoner road is drawn in its mythic base's form)
  assert.equal(formOf('conjurer'), formOf(mythicId(MYTHIC_CALLINGS[0].base.id)));
});

test('the odds: about one in four hundred, more for the child of two ascended parents and after an ascension', () => {
  assert.ok(MYTHIC_ODDS >= 1 / 500 && MYTHIC_ODDS <= 1 / 300);
  const s = newGame('mythic-odds', { origin: 'settlers' });
  const rng = new Rng(11);
  const fresh = (i: number) => makePerson(rng, 10000 + i, 'hunter', { x: 0, y: 0 }, []);
  assert.equal(mythicOdds(s, fresh(0)), MYTHIC_ODDS);
  let mythic = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (mythicRoll(s, fresh(i))) mythic++;
  assert.ok(mythic > N * MYTHIC_ODDS * 0.6 && mythic < N * MYTHIC_ODDS * 1.5, `${mythic} of ${N}`);
  // a child of two ascended parents
  const [a, b, c] = [fresh(N + 20), fresh(N + 21), fresh(N + 22)];
  s.people.push(a, b, c);
  a.ascended = b.ascended = true;
  const child = fresh(N + 1);
  child.parents = [a.id, b.id];
  assert.equal(mythicOdds(s, child), MYTHIC_HEIR_ODDS);
  // an ascension stirs the omen, spent on the next to take a calling
  c.cls = 'knight';
  c.road = 'paladin';
  c.level = 90;
  ascend(s, c);
  assert.ok(s.mythicOmen);
  assert.equal(mythicOdds(s, fresh(N + 2)), MYTHIC_OMEN_ODDS);
  mythicRoll(s, fresh(N + 3));
  assert.ok(!s.mythicOmen);
  // never in a town run by hand
  const plain = plainGame('mythic-plain');
  for (let i = 0; i < 400; i++) assert.equal(mythicRoll(plain, fresh(N + 10 + i)), null);
});

test('one comes among the town: a mythic calling, a title, the news and a line in the chronicle', () => {
  const s = newGame('mythic-born', { origin: 'orcs' });
  s.townName = 'Oakhollow';
  const rng = new Rng(5);
  let p = makePerson(rng, 20000, 'hunter', { x: 0, y: 0 }, []);
  for (let i = 0; i < 4000 && !mythicRoll({ ...s, mythicOmen: false }, p); i++) p = makePerson(rng, 20001 + i, 'hunter', { x: 0, y: 0 }, []);
  assignClass(s, p);
  const node = PATH_BY_ID[p.road!];
  assert.ok(node.mythic && node.stage === 0, `${p.road}`);
  const t = MYTHIC_CALLINGS.find((m) => mythicId(m.base.id) === p.road)!;
  assert.ok(p.titles?.includes(t.title));
  const line = t.born.replaceAll('{name}', p.name).replaceAll('{town}', 'Oakhollow');
  assert.ok(s.notices.some((n) => n.text.includes(line)), 'the news');
  assert.deepEqual(mythicYearLines(s, 0), [line]);
  assert.ok(line.includes('Oakhollow') && line.includes(p.name));
});

test('mythic numbers: a people\'s edge below the top, and more than any people\'s at the ascended form', () => {
  assert.ok(MYTHIC_EDGE > ORIGIN_EDGE && MYTHIC_EVOLVE > ORIGIN_EVOLVE);
  for (const b of MYTHIC_BASES) {
    const top = MYTHIC_PATHS.find((n) => n.stage === 4 && lineage(n.id)[0].id === b.id)!;
    const shared = PATHS.find((n) => n.stage === 4 && n.cls === top.cls);
    if (shared) assert.ok(Math.abs(classStat({ cls: top.cls, road: top.id, level: 90, ascended: true }, 'hp') - 1) >= Math.abs(classStat({ cls: shared.cls, road: shared.id, level: 90, ascended: true }, 'hp') - 1));
    assert.equal(evolveSteps({ cls: top.cls, road: top.id, level: 90, ascended: true }), 5 * MYTHIC_EVOLVE);
    assert.equal(evolveSteps({ cls: b.cls, road: b.id, level: 1 }), 0);
  }
});

test('a save from before: someone on the Summoner\'s road keeps it, and it is mythic now', () => {
  const s = newGame('mythic-save', { origin: 'settlers' });
  s.evolveAsk = false;
  const p = makePerson(new Rng(2), 30000, 'hunter', { x: 0, y: 0 }, []);
  s.people.push(p);
  p.cls = 'summoner';
  p.road = 'conjurer';
  p.level = 31;
  classesHourly(s);
  assert.equal(p.road, 'conjurer');
  assert.ok(isMythic(p.road));
});
