import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITY_BY_ID, abilitiesKnown, PATH_ABILITIES } from '../src/shared/data/abilities';
import { ATTR_KEYS, pointsEarned } from '../src/shared/data/attributes';
import { CLASS_DEFS, STAGE_LEVELS } from '../src/shared/data/classes';
import { ENEMIES } from '../src/shared/data/enemies';
import { callingName } from '../src/shared/data/founderClasses';
import { levelOf, stageOf } from '../src/shared/data/levels';
import { BASE_PATHS, branchesOf, lineage, PATH_BY_ID, PATHS } from '../src/shared/data/paths';
import { LEANS, roadAttrs, roadFavours } from '../src/shared/data/pathAttrs';
import { PATH_SKILL_ROWS } from '../src/shared/data/pathSkills';
import { attributesOf, freePoints, spendByClass, spendPoint, statsHourly } from '../src/shared/sim/attributes';
import { adoptPath, assignClass, classAllies, classesHourly, companionOf, roadsOpen } from '../src/shared/sim/classes';
import { personFighter, startBattle } from '../src/shared/sim/combat';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makePerson } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('the tree: eight bases, two roads at every fork, one ascended form at the end, every node an archetype with a skill of its own', () => {
  assert.equal(BASE_PATHS.length, 8);
  assert.equal(PATHS.length, 8 + 16 + 32 + 64 + 64);
  assert.equal(new Set(PATHS.map((n) => n.name)).size, PATHS.length, 'every name distinct');
  for (const n of PATHS) {
    assert.ok(CLASS_DEFS[n.cls], `${n.id} stands on a class`);
    const roads = branchesOf(n.id);
    if (n.stage < 3) assert.equal(roads.length, 2, `${n.id} forks two ways`);
    else if (n.stage === 3) assert.equal(roads.length, 1, `${n.id} has one ascended form`);
    else assert.equal(roads.length, 0);
    if (n.stage > 0) assert.ok(PATH_ABILITIES.some((a) => a.path === n.id), `${n.id} has a signature skill`);
    if (n.companion) assert.ok(ENEMIES[n.companion], `${n.id}'s companion exists`);
  }
  assert.equal(new Set(PATH_SKILL_ROWS.map((r) => r[1])).size, PATH_SKILL_ROWS.length, 'skill ids distinct');
  for (const a of PATH_ABILITIES) for (const e of a.active?.effects ?? []) if (e.summon) assert.ok(ENEMIES[e.summon], `${a.id} summons ${e.summon}`);
  assert.ok(!PATH_SKILL_ROWS.some((r) => ABILITY_BY_ID[r[1]]?.path === undefined), 'no path skill id clashes with a class skill');
  // every one of the 26 archetypes is reached somewhere
  for (const cls of Object.keys(CLASS_DEFS)) assert.ok(PATHS.some((n) => n.cls === cls), `${cls} is on the tree`);
});

test('a grown-up starts on a base calling fitting their skills; skills come from the road taken; the name is the node', () => {
  const s = plainGame('paths');
  let scholars = 0;
  for (let i = 0; i < 200; i++) {
    const p = makePerson(new Rng(i), 5000 + i, 'hunter', { x: 0, y: 0 }, []);
    p.skills.research.level = 18;
    assignClass(s, p);
    assert.ok(PATH_BY_ID[p.road!]?.stage === 0, 'a base');
    if (p.road === 'apprentice' || p.road === 'acolyte' || p.road === 'wanderer') scholars++;
  }
  assert.ok(scholars > 100, `scholars take to the books (${scholars} of 200)`);
  const p = makePerson(new Rng(3), 77, 'hunter', { x: 0, y: 0 }, []);
  p.cls = 'summoner';
  p.road = 'conjurer';
  p.level = 30;
  assert.equal(stageOf(p), 2);
  assert.equal(callingName(p, 2), 'Conjurer');
  assert.equal(callingName(p, 0), 'Wanderer');
  const known = abilitiesKnown(p.cls, levelOf(p), p.road).map((a) => a.id);
  assert.ok(known.includes('spirit_ward') && known.includes('bind_the_elements'), `the road's skills: ${known.join(' ')}`);
  assert.ok(!known.includes('elemental_court'), 'not the next node\'s');
  assert.equal(companionOf(p), 'fire_elemental');
});

test('evolution: with the level, the two roads are put to the player; the answer (or their own choice) takes one', () => {
  const s = plainGame('evolve');
  s.autopilot = true; // (the question is asked only in a self-running town)
  const p = s.people[0];
  p.cls = 'warrior';
  p.road = 'fighter';
  p.level = STAGE_LEVELS[1];
  assert.deepEqual(roadsOpen(p).map((n) => n.id), ['knight', 'berserker']);
  s.tick = TICKS_PER_HOUR;
  classesHourly(s);
  const q = s.prompts.find((x) => x.kind === 'evolve');
  assert.ok(q && q.who === p.id && q.options.length === 3, 'asked');
  assert.equal(p.road, 'fighter', 'nothing changes until it is answered');
  classesHourly(s);
  assert.equal(s.prompts.filter((x) => x.kind === 'evolve').length, 1, 'asked once');
  answerPrompt(s, q!.id, 0, new Rng(1));
  assert.equal(p.road, 'knight');
  assert.equal(p.cls, 'knight');
  assert.equal(stageOf(p), 1);
  // left to themselves (the default), they choose a road that fits
  p.level = STAGE_LEVELS[2];
  classesHourly(s);
  const q2 = s.prompts.find((x) => x.kind === 'evolve')!;
  answerPrompt(s, q2.id, q2.defaultOption, new Rng(2));
  assert.ok(p.road === 'paladin' || p.road === 'dragoon', p.road!);
  // with the asking off, the town decides on the hour
  s.evolveAsk = false;
  p.level = STAGE_LEVELS[3];
  classesHourly(s);
  assert.equal(stageOf(p), 3);
  assert.ok(!s.prompts.some((x) => x.kind === 'evolve'));
  // the last form waits on an ascension
  p.level = STAGE_LEVELS[4];
  classesHourly(s);
  assert.equal(stageOf(p), 3);
  p.ascended = true;
  classesHourly(s);
  assert.equal(stageOf(p), 4);
  assert.equal(branchesOf(p.road!).length, 0);
});

test('an old save\'s classed townsperson takes the node of their class at their stage', () => {
  const p = makePerson(new Rng(9), 9, 'hunter', { x: 0, y: 0 }, []);
  p.cls = 'chronomancer';
  p.level = 31;
  adoptPath(p);
  assert.equal(p.road, 'chronomancer');
  const q = makePerson(new Rng(9), 10, 'hunter', { x: 0, y: 0 }, []);
  q.cls = 'necromancer';
  q.level = 5;
  adoptPath(q);
  assert.equal(lineage(q.road!).length, 1, 'a base');
  assert.equal(q.road, 'apprentice');
});

test('stat points: two a level, spent by the player or the class\'s way; Charisma counts; the glass cannon summons grow with them', () => {
  const s = plainGame('points');
  const p = s.people[0];
  p.cls = 'summoner';
  p.road = 'summoner';
  p.level = 11;
  p.attrPts = {};
  assert.equal(pointsEarned(11), 20);
  assert.equal(freePoints(p), 20);
  const before = attributesOf(p);
  assert.ok(spendPoint(p, 'cha'));
  assert.equal(attributesOf(p).cha, before.cha + 1);
  assert.equal(freePoints(p), 19);
  spendByClass(p);
  assert.equal(freePoints(p), 0);
  const after = attributesOf(p);
  assert.ok(after.int > before.int && after.cha > before.cha + 1, 'a summoner grows mind and charm');
  assert.ok(ATTR_KEYS.includes('cha'));
  // asked, points wait two days then are spent; auto, they're spent on the hour
  p.level = 12;
  s.autopilot = true;
  s.statsAsk = true;
  s.tick = 10 * TICKS_PER_HOUR;
  statsHourly(s);
  assert.equal(freePoints(p), 2, 'waiting on the player');
  s.tick += 49 * TICKS_PER_HOUR;
  statsHourly(s);
  assert.equal(freePoints(p), 0, 'spent after two days');
  s.statsAsk = false;
  p.level = 13;
  statsHourly(s);
  assert.equal(freePoints(p), 0);
  // the glass cannon: less health, more power than a warrior of the same level; its spirit grows with its level
  p.hp = 100;
  const f = personFighter(p, 'fighter', 'back');
  p.cls = 'warrior';
  p.road = 'fighter';
  const w = personFighter(p, 'fighter', 'front');
  assert.ok(f.maxHp < w.maxHp, `frail (${f.maxHp} against ${w.maxHp})`);
  p.cls = 'summoner';
  p.road = 'summoner';
  const low = classAllies([{ ...p, level: 1 } as typeof p])[0];
  p.level = 40;
  const high = classAllies([p])[0];
  assert.ok(high.maxHp > low.maxHp * 1.5, `the spirit grows (${low.maxHp} to ${high.maxHp})`);
  // and in a fight what they call up is scaled by their power
  const b = startBattle([p], {}, { wolf: 1 }, new Rng(2));
  const me = b.fighters.find((x) => x.kind === 'person')!;
  assert.ok((me.power ?? 1) > 1.5, `power ${me.power}`);
});

test('every calling has its telling and its emblem: lore for all but the ascended, a glyph on a real cell, colours by base', async () => {
  const { FORK, LORE_IDS, loreOf } = await import('../src/shared/data/pathLore');
  const { BASE_COLOURS, emblemOf } = await import('../src/shared/data/emblems');
  const ROWS: Record<string, [number, number]> = { ShortWep: [8, 5], MedWep: [8, 2], LongWep: [8, 7], Wand: [8, 7], Shield: [8, 1], Hat: [8, 4], Amulet: [8, 3], Scroll: [8, 6], Magic: [9, 5], Tool: [8, 3], Light: [8, 1], Potion: [8, 5], Ring: [8, 6], Ammo: [8, 6], Armor: [8, 9], Book: [8, 9], Music: [8, 6], Money: [8, 8] };
  for (const b of BASE_PATHS) {
    assert.ok(FORK[b.id]?.includes('{name}'), `${b.id} has a fork scene`);
    assert.ok(BASE_COLOURS[b.id], `${b.id} has colours`);
  }
  for (const n of PATHS) {
    if (n.stage < 4) assert.ok(LORE_IDS.includes(n.id), `${n.id} has lore`);
    const lore = loreOf(n.id, n.name, n.from ? PATH_BY_ID[n.from].name : undefined);
    assert.ok(lore.length > 60 && !/\{/.test(lore), `${n.id}: ${lore.slice(0, 40)}`);
    const e = emblemOf(n.id)!;
    assert.ok(e, `${n.id} has an emblem`);
    assert.ok(e.behind || e.main, `${n.id} shows something`);
    for (const gl of [e.behind, e.main, e.charge]) {
      if (!gl) continue;
      const [cols, rows] = ROWS[gl[0]];
      assert.ok(gl[1] >= 0 && gl[1] < cols * rows, `${n.id}: ${gl.join(' ')} is on the sheet`);
    }
    assert.equal(e.stage, n.stage);
    assert.equal(e.gem, n.stage >= 3);
    assert.equal(e.crown, n.stage >= 4);
  }
  // the two roads at a fork never share a glyph
  for (const n of PATHS.filter((x) => x.stage < 3)) {
    const [a, b] = branchesOf(n.id).map((r) => { const e = emblemOf(r.id)!; return JSON.stringify([e.behind, e.main, e.charge]); });
    assert.notEqual(a, b, `${n.id}'s roads look different`);
  }
});

test('stat points follow the road chosen, not only the archetype', () => {
  // every lean names a node, and every node past the base has a lean up its road
  for (const id of Object.keys(LEANS)) assert.ok(PATH_BY_ID[id], `lean for a node that isn't: ${id}`);
  for (const n of PATHS) if (n.stage > 0) assert.ok(lineage(n.id).some((m) => LEANS[m.id]), `${n.id} has no lean up its road`);
  // two roads from one archetype spend differently: the Berserker is all strength, the Titan bulk
  const b = roadAttrs('warrior', 'berserker');
  const t = roadAttrs('warrior', 'titan');
  assert.ok(b.str > t.str && t.vit > b.vit);
  assert.equal(roadFavours('warrior', 'berserker')[0], 'str');
  assert.equal(roadFavours('warrior', 'titan')[0], 'vit');
  // the summoner's roads lean to mind and charm; a beastcaller more to charm than a conjurer
  assert.ok(roadAttrs('summoner', 'beastcaller').cha > roadAttrs('summoner', 'conjurer').cha);
  assert.ok(roadAttrs('summoner', 'conjurer').int > roadAttrs('summoner', 'beastcaller').int);
  // shares still sum to one
  for (const n of PATHS) {
    const w = roadAttrs(n.cls, n.id);
    assert.ok(Math.abs(ATTR_KEYS.reduce((s, k) => s + w[k], 0) - 1) < 1e-6);
  }
  // and a townsperson's auto-spend uses it: a berserker's first points go to strength
  const s = plainGame('lean');
  const p = s.people[0];
  p.cls = 'warrior';
  p.road = 'berserker';
  p.level = 12;
  p.attrPts = {};
  spendByClass(p);
  assert.ok((p.attrPts.str ?? 0) > (p.attrPts.vit ?? 0));
});

test('a townsperson left to spend their own points keeps doing so, till the box is unticked', async () => {
  const { Sim } = await import('../src/shared/sim/sim');
  const { plainGame } = await import('./helpers');
  const { beginRecord, freePoints, statsHourly } = await import('../src/shared/sim/attributes');
  const sim = new Sim(plainGame('auto-stats'));
  const s = sim.state;
  const p = s.people[0];
  s.statsAsk = true;
  s.autopilot = true;
  p.level = 1;
  beginRecord(p); // (the record of points spent begins at the first level gained)
  p.level = 6;
  const before = freePoints(p);
  assert.ok(before > 0);
  sim.command({ type: 'spendStat', person: p.id, attr: null });
  sim.step();
  assert.equal(p.autoStats, true, 'remembered');
  assert.equal(freePoints(p), 0);
  p.level = 8;
  statsHourly(s);
  assert.equal(freePoints(p), 0, 'the new ones spent as they come');
  sim.command({ type: 'autoStats', person: p.id, on: false });
  sim.step();
  p.level = 10;
  statsHourly(s);
  assert.ok(freePoints(p) > 0, 'manual again: left for the player');
});
