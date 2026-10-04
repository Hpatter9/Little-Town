import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ascend, assignClass, canWear, classAllies, classesHourly } from '../src/shared/sim/classes';
import { CLASSES, className, STAGE_LEVELS } from '../src/shared/data/classes';
import { levelOf, stageOf } from '../src/shared/data/levels';
import { gainSkill } from '../src/shared/sim/townsfolk';
import { startBattle, stepBattle } from '../src/shared/sim/combat';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { makePerson, maxHp } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';


test('every grown-up is given a class once: weighted by their skills, some callings rare, never switched', () => {
  const s = plainGame('classes');
  const count: Record<string, number> = {};
  for (let i = 0; i < 4000; i++) {
    const p = makePerson(new Rng(i), 1000 + i, 'hunter', { x: 0, y: 0 }, []);
    count[assignClass(s, p)] = (count[assignClass(s, p)] ?? 0) + 1;
  }
  assert.equal(Object.keys(count).length, CLASSES.length, 'every calling turns up');
  assert.ok((count.necromancer ?? 0) * 4 < (count.knight ?? 0), `necromancers rare (${count.necromancer} to ${count.knight} knights)`);
  // a born scholar leans to the arcane, a born fighter to the blade
  let scholars = 0;
  let fighters = 0;
  for (let i = 0; i < 400; i++) {
    const p = makePerson(new Rng(i), 9000 + i, 'hunter', { x: 0, y: 0 }, []);
    p.skills.research.level = 18;
    if (['mage', 'witch', 'chronomancer', 'summoner', 'necromancer', 'spellblade'].includes(assignClass(s, p))) scholars++;
    const q = makePerson(new Rng(i), 19000 + i, 'hunter', { x: 0, y: 0 }, []);
    q.skills.melee.level = 18;
    if (['knight', 'warrior', 'samurai', 'blood_knight', 'guardian', 'monk'].includes(assignClass(s, q))) fighters++;
  }
  assert.ok(scholars > 150 && fighters > 200, `scholars ${scholars}, fighters ${fighters}`);
  // the hourly round gives classes to the classless grown-ups, and leaves them be after
  s.people[0].cls = null;
  classesHourly(s);
  const cls = s.people[0].cls;
  assert.ok(cls);
  s.people[0].skills.research.level = 20;
  classesHourly(s);
  assert.equal(s.people[0].cls, cls, 'never switched');
});

test('levels from all XP (fighting most); classes evolve at the stage levels; gear by class', () => {
  const p = makePerson(new Rng(1), 1, 'hunter', { x: 0, y: 0 }, []);
  p.cls = 'mage';
  const work = makePerson(new Rng(2), 2, 'hunter', { x: 0, y: 0 }, []);
  for (let i = 0; i < 200; i++) {
    gainSkill(p, 'melee', 10);
    gainSkill(work, 'farming', 10);
  }
  assert.ok(levelOf(p) > levelOf(work) && levelOf(work) > 1, `fighting ${levelOf(p)}, farming ${levelOf(work)}`);
  p.level = STAGE_LEVELS[2];
  assert.equal(stageOf(p), 2);
  assert.equal(className('mage', stageOf(p)), 'Sorcerer');
  // a mage: cloth and a staff, never plate or an axe; a knight the other way round
  assert.ok(canWear(p, 'linen_robe') && canWear(p, 'oak_staff'));
  assert.ok(!canWear(p, 'full_plate') && !canWear(p, 'battle_axe'));
  assert.ok(canWear({ cls: 'knight' }, 'full_plate') && canWear({ cls: 'knight' }, 'tower_shield') && !canWear({ cls: 'knight' }, 'linen_robe'));
  assert.ok(canWear(p, 'bone_charm'), 'charms for anyone');
  // stronger by class and level: a guardian has more health than a mage, a level 30 more than a level 1
  assert.ok(maxHp({ traits: [], cls: 'guardian' }) > maxHp({ traits: [], cls: 'mage' }));
  assert.ok(maxHp({ traits: [], cls: 'mage', level: 30 }) > maxHp({ traits: [], cls: 'mage', level: 1 }));
});

test('in battle: a summoner brings a spirit, a necromancer raises the fallen, a blood knight heals as they hit', () => {
  const s = plainGame('battle-classes');
  const [p] = s.people;
  p.skills.melee.level = 12;
  p.hp = maxHp(p);
  p.cls = 'summoner';
  assert.equal(classAllies([p])[0].kind, 'spirit');

  p.cls = 'necromancer';
  p.gear = { weapon: 'iron_sword', body: 'chainmail' };
  const rng = new Rng(4);
  const b = startBattle([p], {}, { wolf: 2 }, rng);
  for (let i = 0; i < 90 * TICK_HZ && !b.outcome; i++) stepBattle(b, rng, { retreatAt: 0, mainId: null });
  assert.ok(b.fighters.some((f) => f.kind === 'wolf' && f.side === 'party'), 'a fallen wolf rose for us: ' + b.outcome + ' ' + JSON.stringify(b.fighters.map((f) => [f.kind, f.side, f.hp, f.down, f.cls])));

  p.cls = 'blood_knight';
  p.hp = maxHp(p) / 3;
  const b2 = startBattle([p], {}, { boar: 1 }, rng);
  const knight = b2.fighters.find((f) => f.kind === 'person')!;
  const hp0 = knight.hp;
  let healed = false;
  for (let i = 0; i < 60 * TICK_HZ && !b2.outcome; i++) {
    stepBattle(b2, rng, { retreatAt: 0, mainId: null });
    if (knight.hp > hp0) healed = true;
  }
  assert.ok(healed, 'the blood knight healed by hitting');
});

test('in a raid at home, a beast tamer turns a wolf against the pack', () => {
  const s = plainGame('tamer');
  const p = s.people[0];
  p.cls = 'beast_tamer';
  const rng = new Rng(2);
  const r = startRaid(s, RAID_KIND_BY_ID.wolves, 40, rng);
  r.phase = 'active';
  for (const w of r.raiders) w.x = p.x + 40;
  s.tick = 0;
  for (let i = 0; i < 25 * TICK_HZ && s.raid; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(r.raiders.some((w) => w.ally), 'one was tamed');
});

test('the last stage is rare and late: levels alone stop a stage short; an ascension takes them there', () => {
  const s = plainGame('ascend');
  const p = s.people[0];
  p.cls = 'mage';
  p.level = 100;
  assert.equal(stageOf(p), 3, 'level 100, still one stage short');
  assert.equal(className('mage', stageOf(p)), 'Archmage');
  ascend(s, p, 'A quest fulfilled');
  assert.equal(stageOf(p), 4);
  assert.equal(className('mage', stageOf(p)), 'Arcanist');
  // the daily chance is small: few of a hundred level-45s ascend in a week
  let rose = 0;
  for (let i = 0; i < 100; i++) {
    const q = plainGame(`ascend-${i}`);
    q.people[0].cls = 'knight';
    q.people[0].level = 45;
    for (let d = 1; d <= 7; d++) {
      q.tick = d * 24 * 600;
      classesHourly(q);
    }
    if (q.people[0].ascended) rose++;
  }
  assert.ok(rose < 25, `${rose} of 100 ascended in a week`);
});
