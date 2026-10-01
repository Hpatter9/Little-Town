import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanNewGameOptions, SCENARIO_BY_ID, SCENARIOS } from '../src/shared/data/founding';
import { autoPriorities, maxHp, newGame } from '../src/shared/sim/state';
import { totalStock } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { JOBS } from '../src/shared/data/people';
import { FULL_MOON_DAYS } from '../src/shared/data/monsters';
import { FULL_MOON_PHASE, fullMoon, moonPhaseOf, nightDay } from '../src/shared/sim/monsters';
import { snapshot } from '../src/shared/sim/snapshot';

const look = { gender: 'f', skin: '#c9956a', hair: 'long', hairColor: '#8a3a22', beard: false, outfit: '#7a5a3a' } as const;

test('a plain new game is the same lone founder and campfire as ever', () => {
  const s = newGame('same-as-ever');
  assert.equal(s.people.length, 1);
  assert.deepEqual(s.buildings.map((b) => [b.def, b.store]), [['campfire', { berries: 8 }]]);
  assert.equal(s.nextId, 3);
  assert.deepEqual(s.research.done, []);
});

test('the founder the player made: name, looks, background skills and passions, chosen traits', () => {
  const s = newGame('made', { founder: { name: 'Astrid', look: { ...look }, background: 'scholar', traits: ['quick_learner', 'tough'] } });
  const f = s.people[0];
  assert.equal(f.name, 'Astrid');
  assert.deepEqual(f.look, look);
  assert.equal(f.skills.research.level, 5);
  assert.equal(f.skills.melee.level, 1);
  assert.equal(f.skills.farming.level, 2);
  assert.deepEqual(f.passions, ['research', 'medicine']);
  assert.deepEqual(f.traits, ['quick_learner', 'tough']);
  assert.equal(f.hp, maxHp(f), 'tough raises health');
  assert.ok(f.priorities.research < f.priorities.farm, 'jobs follow the skills (1 is the highest priority)');
});

test('scenarios: company, food (the campfire holds what fits, a stockpile the rest) and known research', () => {
  for (const sc of SCENARIOS) {
    const s = newGame(`scenario-${sc.id}`, { scenario: sc.id });
    assert.equal(s.people.length, 1 + sc.companions.length, sc.id);
    assert.equal(new Set(s.people.map((p) => p.name)).size, s.people.length, 'no two share a name');
    assert.equal(new Set([...s.people.map((p) => p.id), ...s.buildings.map((b) => b.id)]).size, s.people.length + s.buildings.length, 'ids are unique');
    assert.ok(s.nextId > Math.max(...s.people.map((p) => p.id), ...s.buildings.map((b) => b.id)));
    const stock = totalStock(s);
    for (const [m, n] of Object.entries(sc.stores)) assert.equal(stock[m as keyof typeof stock], n, `${sc.id}: ${m}`);
    assert.deepEqual(s.research.done, sc.research);
    assert.ok((s.buildings[0].store.berries ?? 0) <= 30);
  }
  const tribe = newGame('tribe', { scenario: 'tribe' });
  const child = tribe.people.find((p) => p.type === 'child')!;
  assert.equal(child.bornTick, 0);
  assert.ok(Object.values(child.priorities).every((v) => v === 0), 'too young to work');
  assert.ok(newGame('supplied', { scenario: 'supplied' }).buildings.some((b) => b.def === 'stockpile' && b.status === 'done'));
});

test('every scenario runs its first two days', () => {
  for (const sc of SCENARIOS) {
    const sim = new Sim(newGame(`run-${sc.id}`, { scenario: sc.id, founder: { background: 'hunter', traits: [] } }));
    for (let t = 0; t < 2 * TICKS_PER_DAY; t++) sim.step();
    assert.equal(sim.state.gameOver, null, sc.id);
  }
});

test("the panel's choices are checked: unknown or unfair picks are refused, names are cleaned", () => {
  const base = { biome: 'coast', difficulty: 'hard', scenario: 'band' };
  const ok = cleanNewGameOptions({ ...base, founder: { name: '  <Björn>  ', look, background: 'farmer', traits: ['green_thumb'] } });
  assert.equal(ok?.founder?.name, 'Björn');
  assert.equal(ok?.scenario, 'band');
  assert.equal(cleanNewGameOptions(base)?.founder, undefined, 'no founder: one is rolled');
  assert.equal(cleanNewGameOptions({ biome: 'forest', difficulty: 'normal' })?.scenario, 'lone');
  const bad = [
    { ...base, scenario: 'godmode' },
    { ...base, founder: { background: 'king', traits: [] } },
    { ...base, founder: { background: 'farmer', traits: ['tough', 'quick_learner', 'hard_worker'] } },
    { ...base, founder: { background: 'farmer', traits: ['hard_worker', 'lazy'] } },
    { ...base, founder: { background: 'farmer', traits: [], look: { ...look, skin: '#ff00ff' } } },
  ];
  for (const b of bad) assert.equal(cleanNewGameOptions(b), null, JSON.stringify(b));
  assert.equal(cleanNewGameOptions({ ...base, founder: { background: 'farmer', traits: [], look: { ...look, gender: 'f', beard: true } } })?.founder?.look?.beard, false, 'no beard on a woman');
  assert.ok(SCENARIO_BY_ID.lone);
});

test("a site with all its materials gets built before any more gathering (the founder used to shuttle between the two)", () => {
  for (const background of ['scholar', 'farmer']) {
    const sim = new Sim(newGame(`ready-site-${background}`, { founder: { background, traits: [] } }));
    const s = sim.state;
    const f = s.people[0];
    if (background === 'farmer') f.skills.gathering.level = 7; // (a skilled gatherer: gathering ranks high)
    f.priorities = autoPriorities(f.skills);
    const camp = s.buildings[0].tile;
    const wild = s.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.terrain !== 'clear').sort((a, b) => Math.abs(a.i - camp) - Math.abs(b.i - camp));
    for (const { i } of wild.slice(0, 6)) sim.command({ type: 'toggleGather', tile: i });
    for (const dx of [3, 4, 5, -5, -6, 6, 7, -7]) {
      sim.command({ type: 'placeBuilding', def: 'stockpile', tile: camp + dx });
      sim.step();
      if (s.buildings.some((b) => b.def === 'stockpile')) break;
    }
    const site = s.buildings.find((b) => b.def === 'stockpile')!;
    site.delivered = { wood: 6 }; // everything it needs is there
    for (let t = 0; t < TICKS_PER_HOUR && site.status !== 'done'; t++) sim.step();
    assert.equal(site.status, 'done', `${background}: built within the hour, with gathering still marked`);
  }
  // in auto mode building is never ranked below another job
  for (const level of [1, 2, 4, 7]) {
    const skills = Object.fromEntries(Object.entries(newGame('x').people[0].skills).map(([k]) => [k, { level: k === 'construction' ? 1 : level, xp: 0 }])) as never;
    const pr = autoPriorities(skills);
    for (const j of JOBS) if (j !== 'defend' && j !== 'construct') assert.ok(pr.construct <= pr[j], `construct ${pr.construct} vs ${j} ${pr[j]}`);
  }
});
test('the moon keeps its phase all night, and the drawn full moon is the werewolves\' full moon', () => {
  const s = newGame('moon');
  const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + (hour - 7) * TICKS_PER_HOUR;
  const fullDay = FULL_MOON_DAYS; // (the last day of each cycle)
  s.tick = at(fullDay, 23);
  assert.ok(fullMoon(s));
  assert.equal(snapshot(s).moonPhase, FULL_MOON_PHASE);
  assert.equal(snapshot(s).moonNight, true);
  s.tick = at(fullDay + 1, 2); // the small hours: still that night
  assert.equal(snapshot(s).moonPhase, FULL_MOON_PHASE);
  assert.equal(snapshot(s).moonNight, true);
  s.tick = at(fullDay + 1, 21); // the next night: waning
  assert.notEqual(snapshot(s).moonPhase, FULL_MOON_PHASE);
  const seen = new Set<number>();
  for (let d = 1; d <= FULL_MOON_DAYS; d++) seen.add(moonPhaseOf(nightDay(at(d, 22))));
  assert.equal(seen.size, FULL_MOON_DAYS, 'a different phase each night of the cycle');
});
test('every origin has three ready-made founders, each one the rules allow and the drawing can dress', async () => {
  const { FOUNDERS, FOUNDER_BY_ID } = await import('../src/shared/data/founders');
  const { ORIGINS } = await import('../src/shared/data/origins');
  const { TRAITS } = await import('../src/shared/data/people');
  const { MAX_NAME_LENGTH, MAX_FOUNDER_TRAITS } = await import('../src/shared/data/founding');
  const { readFileSync } = await import('node:fs');
  const lpc = JSON.parse(readFileSync('src/renderer/art/lpc/lpcData.json', 'utf8')) as { layers: Record<string, string>; alias: Record<string, string> };
  const has = (id: string) => !!lpc.layers[id] || !!lpc.layers[lpc.alias[id] ?? ''];
  const ids = new Set<string>();
  for (const o of ORIGINS) {
    assert.equal(FOUNDERS[o].length, 3, `${o} has three`);
    for (const f of FOUNDERS[o]) {
      assert.ok(!ids.has(f.id), `${f.id} is unique`);
      ids.add(f.id);
      assert.equal(FOUNDER_BY_ID[f.id], f);
      assert.ok(f.name.length <= MAX_NAME_LENGTH, `${f.name} fits`);
      assert.ok(f.traits.length <= MAX_FOUNDER_TRAITS && f.traits.every((t) => TRAITS.some((d) => d.id === t)), `${f.id}'s traits`);
      const g = f.look.gender;
      for (const part of [`body_${f.look.body ?? 'light'}_${g}`, ...(f.look.ears ? [`ears_${f.look.ears}_${g}`] : []), ...(f.look.eyes ? [`eyes_${f.look.eyes}_${g}`] : []), ...(f.look.hair === 'none' ? [] : [`hair_${f.look.hair}_${g}`]), ...(f.look.wear ?? []).map((w) => `${w.split(':')[0]}_${g}`)])
        assert.ok(has(part), `${f.id} wears ${part}`);
    }
  }
});

test('a ready-made founder founds the town as they are (only the name can change)', async () => {
  const { FOUNDER_BY_ID } = await import('../src/shared/data/founders');
  const { cleanFounder } = await import('../src/shared/data/founding');
  const def = FOUNDER_BY_ID.morvain;
  const spec = cleanFounder({ pick: 'morvain', background: 'forager', traits: ['lazy'] })!;
  const s = newGame('ready-made', { origin: 'lich', founder: spec });
  const main = s.people.find((p) => p.id === s.mainId)!;
  assert.equal(main.name, 'Morvain');
  assert.equal(main.look.body, 'skeleton');
  assert.deepEqual(main.traits, def.traits);
  assert.equal(main.skills.research.level, 5);
  assert.deepEqual(main.passions, def.background.passions);
  const renamed = newGame('ready-made', { origin: 'lich', founder: cleanFounder({ pick: 'morvain', name: 'Mortimer' })! });
  assert.equal(renamed.people.find((p) => p.id === renamed.mainId)!.name, 'Mortimer');
  assert.equal(cleanFounder({ pick: 'nobody' }), null, 'an unknown founder is refused');
});

test("a settler founder brings a friend (the town doesn't start a person short of the other origins)", async () => {
  const { cleanFounder } = await import('../src/shared/data/founding');
  const s = newGame('brings', { origin: 'settlers', founder: cleanFounder({ pick: 'maren' })! });
  assert.equal(s.people.length, 2);
  assert.equal(newGame('brings', { origin: 'settlers' }).people.length, 1, 'the classic lone start without a ready-made founder');
});
