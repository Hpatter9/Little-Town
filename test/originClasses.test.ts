import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITY_BY_ID, ALL_ABILITIES, PATH_ABILITIES } from '../src/shared/data/abilities';
import { CLASS_DEFS, CLASSES, STAGE_STEP, type ClassId, type ClassStats } from '../src/shared/data/classes';
import { BASE_COLOURS, emblemOf } from '../src/shared/data/emblems';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEMS } from '../src/shared/data/items';
import { classStat, evolveSteps, ORIGIN_EDGE, ORIGIN_EVOLVE } from '../src/shared/data/levels';
import { CALLINGS_PER_PEOPLE, callingId, callingNodes, ORIGIN_CALLING_LEAN, ORIGIN_CALLINGS } from '../src/shared/data/originCallings';
import { ORIGIN_ROADS } from '../src/shared/data/originPaths';
import { ORIGINS } from '../src/shared/data/origins';
import { PACK_SHEETS } from '../src/shared/data/packSheets';
import { armsOf, BASE_PATHS, branchesOf, CALLING_PATHS, callingBases, formOf, lineage, PATH_BY_ID, PATHS, roadsFrom } from '../src/shared/data/paths';
import { FORK } from '../src/shared/data/pathLore';
import { LEANS } from '../src/shared/data/pathAttrs';
import { GLYPH_CELLS } from '../src/shared/data/callings/kit';
import { FAMILIES } from '../src/shared/data/weapons';
import { assignClass, basePulls, canWear, classesHourly, classPull, roadsOpen } from '../src/shared/sim/classes';
import { makePerson, newGame, type Person } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const per = (o: string) => ORIGIN_CALLINGS.filter((t) => t.origin === o);

test('every people has exactly three base callings of its own, each a whole tree as deep as the shared ones', () => {
  for (const o of ORIGINS) assert.equal(per(o).length, CALLINGS_PER_PEOPLE, `${o} has ${CALLINGS_PER_PEOPLE} callings of its own`);
  const shared = (stage: number) => PATHS.filter((n) => n.stage === stage && lineage(n.id)[0].id === 'fighter').length;
  for (const t of ORIGIN_CALLINGS) {
    const base = callingId(t.origin, t.base.id);
    const tree = CALLING_PATHS.filter((n) => lineage(n.id)[0].id === base);
    // (as many nodes at each stage as a shared base calling has: 1, 2, 4, 8 and 8 ascended)
    for (let st = 0; st <= 4; st++) assert.equal(tree.filter((n) => n.stage === st).length, shared(st), `${base} stage ${st}`);
    for (const n of tree) {
      assert.equal(n.origin, t.origin);
      assert.ok(n.calling);
      // forks where the shared ones fork: two roads out of every node to stage 3, one ascended form after
      const kids = roadsFrom(n.id, t.origin);
      assert.equal(kids.length, n.stage < 3 ? 2 : n.stage === 3 ? 1 : 0, `${n.id} forks like the shared tree`);
      for (const k of kids) assert.equal(k.stage, n.stage + 1);
    }
  }
  assert.equal(CALLING_PATHS.length, ORIGINS.length * CALLINGS_PER_PEOPLE * 23);
});

test('ids and names are unique, and kept apart from the shared tree and the origin roads', () => {
  const all = Object.keys(PATH_BY_ID);
  assert.equal(new Set(all).size, all.length);
  for (const n of CALLING_PATHS) assert.ok(n.id.startsWith(`oc_${n.origin}_`), n.id);
  const shared = new Set([...PATHS.map((n) => n.name), ...ORIGIN_ROADS.flatMap((r) => [r.two.name, r.three.name, r.high.name, r.asc[1]])]);
  for (const o of ORIGINS) {
    const names = CALLING_PATHS.filter((n) => n.origin === o).map((n) => n.name);
    assert.equal(new Set(names).size, names.length, `${o}'s calling names are their own`);
    for (const nm of names) assert.ok(!shared.has(nm), `${o}: ${nm} is a shared calling's or origin road's name`);
  }
  const ids = ALL_ABILITIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'skill ids are unique');
});

test('every node has its text, lore, skill, lean, emblem, weapon and form, and they resolve', () => {
  for (const t of ORIGIN_CALLINGS) {
    assert.ok(t.fork.includes('{name}') && FORK[callingId(t.origin, t.base.id)], `${t.base.id} tells its crossroads`);
    assert.ok(BASE_COLOURS[callingId(t.origin, t.base.id)], `${t.base.id} has colours`);
    for (const [id, n] of callingNodes(t)) {
      const node = PATH_BY_ID[id];
      assert.ok(CLASSES.includes(n.cls), `${id}: archetype ${n.cls}`);
      assert.ok(n.text.length > 15 && n.lore.length > 60, `${id} has text and lore`);
      assert.equal(node.lore, n.lore);
      // its skill, learned at its stage
      const skill = ABILITY_BY_ID[callingId(t.origin, n.skill[0])];
      assert.ok(skill && skill.path === id, `${id}'s skill ${n.skill[0]}`);
      if (skill.active) for (const e of skill.active.effects) if (e.summon) assert.ok(ENEMIES[e.summon], `${id} summons ${e.summon}`);
      if (n.companion) assert.ok(ENEMIES[n.companion], `${id}'s companion ${n.companion}`);
      assert.ok(LEANS[id] && Object.keys(LEANS[id]).length, `${id} has a lean`);
      for (const g of [n.emblem.main, n.emblem.charge]) if (g) assert.ok(g[1] >= 0 && g[1] < GLYPH_CELLS[g[0]], `${id}: glyph ${g}`);
      const e = emblemOf(id);
      assert.ok(e?.main && e.colours === t.colours, `${id} has an emblem in its calling's colours`);
      // what it fights with and how it is drawn (its own, or the nearest up its road)
      const arms = armsOf(id)!;
      assert.ok(FAMILIES[arms] && ITEMS.some((i) => i.family === arms), `${id}: arms ${arms}`);
      const form = formOf(id)!;
      assert.ok(form === 'doll' || form in PACK_SHEETS, `${id}: form ${form}`);
      if (t.origin === 'orcs') assert.ok(form === 'doll' || /orc|ogre|shaman_king/.test(form), `${id}: an orc keeps an orc's body`);
    }
    for (const n of CALLING_PATHS.filter((m) => m.stage === 4 && lineage(m.id)[0].id === callingId(t.origin, t.base.id))) {
      assert.ok(PATH_ABILITIES.some((a) => a.id === `ascendancy_${n.id}`), `${n.id} has the ascendancy`);
      assert.ok(emblemOf(n.id)?.crown && formOf(n.id) && armsOf(n.id));
    }
  }
});

test('the skills are as strong as the shared ones of their stage: a base calling only a small passive', () => {
  const total = (p: object) => Object.values(p).reduce((a: number, v) => a + (typeof v === 'number' ? Math.abs(v) : 0), 0);
  for (const t of ORIGIN_CALLINGS) {
    for (const [id, n] of callingNodes(t)) {
      const stage = PATH_BY_ID[id].stage;
      const what = n.skill[2];
      if (!Array.isArray(what)) {
        assert.ok(total(what) <= [0.12, 0.3, 0.5, 0.8][stage], `${id}: passive ${total(what).toFixed(2)} at stage ${stage}`);
        continue;
      }
      assert.ok(stage > 0, `${id}: a base calling's skill is a passive`);
      const [cd, fx] = what;
      assert.ok(cd >= 8 && cd <= 70, `${id}: cooldown ${cd}`);
      assert.ok(fx.filter((e) => e.kind === 'summon').length <= 3, `${id}: summons`);
      for (const e of fx) if (e.kind === 'damage' || e.kind === 'drain') assert.ok((e.power ?? 0) * (e.hits ?? 1) <= 3.2, `${id}: hits for ${e.power} x ${e.hits ?? 1}`);
    }
  }
});

test('their numbers sit beside the shared callings at each stage; the people\'s edge only on the ascended form', () => {
  const keys: (keyof ClassStats)[] = ['hp', 'damage', 'accuracy', 'dodge', 'armor', 'power', 'healing', 'speed', 'crit'];
  const edge = (cls: ClassId, road: string, level: number, ascended = false) => keys.reduce((a, k) => {
    const v = classStat({ cls, road, level, ascended }, k);
    const plain = k === 'dodge' || k === 'armor' || k === 'accuracy' || k === 'crit' ? 0 : 1;
    return a + Math.abs(v - plain);
  }, 0);
  const LV = [1, 12, 30, 55, 85];
  // (a node's edge grows by STAGE_STEP each stage, by ORIGIN_EDGE on a people's: taken out, the shared callings'
  // edges at any stage make the range a new one's must sit in)
  const raw = (cls: ClassId, road: string, st: number, k = 1) => edge(cls, road, LV[st], st === 4) / ((1 + STAGE_STEP * st) * k);
  const shared = PATHS.map((n) => raw(n.cls, n.id, n.stage));
  const lo = Math.min(...shared), hi = Math.max(...shared);
  for (let st = 0; st <= 4; st++) {
    const sharedSteps = evolveSteps({ cls: 'knight', road: PATHS.find((n) => n.stage === st)!.id, level: LV[st], ascended: st === 4 });
    for (const n of CALLING_PATHS.filter((m) => m.stage === st)) {
      const e = raw(n.cls, n.id, st, st === 4 ? ORIGIN_EDGE : 1);
      assert.ok(e >= lo * 0.9 - 1e-9 && e <= hi * 1.1 + 1e-9, `${n.id}: stat edge ${e.toFixed(3)} beside the shared ${lo.toFixed(3)}..${hi.toFixed(3)}`);
      assert.equal(evolveSteps({ cls: n.cls, road: n.id, level: LV[st], ascended: st === 4 }), sharedSteps * (st === 4 ? ORIGIN_EVOLVE : 1), `${n.id}: evolution steps`);
    }
  }
});

test('only a people\'s own folk start on its callings, leaned a little their way; never in a town run by hand', () => {
  const s = newGame('own-callings', { origin: 'lich' });
  const rng = new Rng(3);
  const fresh = (i: number, origin?: Person['origin']) => {
    const p = makePerson(rng, 5000 + i, 'hunter', { x: 0, y: 0 }, [], origin ?? 'lich');
    if (origin) p.origin = origin;
    return p;
  };
  // the draws: the eight shared and the people's three, theirs times the lean
  const p = fresh(0);
  const pulls = basePulls(s, p);
  assert.equal(pulls.length, BASE_PATHS.length + 3);
  for (const [b, w] of pulls) {
    assert.ok(!b.origin || b.origin === 'lich');
    assert.ok(Math.abs(w - (classPull(p, b.cls) / CLASS_DEFS[b.cls].rarity) * (b.calling ? ORIGIN_CALLING_LEAN : 1)) < 1e-9);
  }
  // many folk: a fair share take their people's own, more than an even draw would give them
  const counts = { own: 0, shared: 0, other: 0 };
  for (let i = 0; i < 400; i++) {
    const q = fresh(i);
    assignClass(s, q);
    const node = PATH_BY_ID[q.road!];
    assert.equal(node.stage, 0);
    assert.equal(q.cls, node.cls);
    if (!node.origin) counts.shared++;
    else if (node.origin === 'lich') counts.own++;
    else counts.other++;
  }
  assert.equal(counts.other, 0);
  const share = counts.own / 400;
  assert.ok(share > 0.2 && share < 0.6, `own share ${share}`);
  // a stranger of another people takes their own people's, never the town's
  for (let i = 0; i < 60; i++) {
    const q = fresh(1000 + i, 'orcs');
    assignClass(s, q);
    const o = PATH_BY_ID[q.road!].origin;
    assert.ok(!o || o === 'orcs', `a stranger of the orcs on ${q.road}`);
  }
  // in a town run by hand (the tests' plain towns) only the shared eight, as before
  const plain = plainGame('own-callings-plain');
  assert.equal(basePulls(plain, p).length, BASE_PATHS.length);
  for (let i = 0; i < 40; i++) {
    const q = fresh(2000 + i);
    assignClass(plain, q);
    assert.ok(!PATH_BY_ID[q.road!].origin);
  }
});

test('the lean is mild: without it their own callings would be drawn less', () => {
  const s = newGame('lean', { origin: 'orcs' });
  const p = makePerson(new Rng(9), 7000, 'hunter', { x: 0, y: 0 }, [], 'orcs');
  const pulls = basePulls(s, p);
  const own = pulls.filter(([b]) => b.calling).reduce((a, [, w]) => a + w, 0);
  const all = pulls.reduce((a, [, w]) => a + w, 0);
  const unleaned = own / ORIGIN_CALLING_LEAN / (all - own + own / ORIGIN_CALLING_LEAN);
  assert.ok(own / all > unleaned, 'the lean draws them more');
  assert.ok(ORIGIN_CALLING_LEAN > 1 && ORIGIN_CALLING_LEAN <= 2, 'and only a little');
});

test('the roads: theirs to walk on, kept out of the shared tree, and they evolve like anyone', () => {
  for (const b of BASE_PATHS) for (const o of ORIGINS) for (const r of roadsFrom(b.id, o)) assert.ok(!r.calling);
  for (const n of PATHS) assert.ok(branchesOf(n.id).every((r) => !r.calling));
  // a knight of the Order on the knights' own calling reaches the first evolution: two roads, both their people's
  const s = newGame('own-roads', { origin: 'knights' });
  s.evolveAsk = false;
  const p = s.people[1];
  const base = callingBases('knights')[0];
  p.road = base.id;
  p.cls = base.cls;
  p.level = 12;
  const open = roadsOpen(p, s);
  assert.equal(open.length, 2);
  assert.ok(open.every((r) => r.calling && r.from === base.id));
  // (even someone not of the knights, once on it, walks its roads)
  assert.equal(roadsOpen({ ...p, origin: 'orcs' }, s).length, 2);
  classesHourly(s);
  assert.equal(PATH_BY_ID[p.road!].stage, 1);
  assert.equal(p.cls, PATH_BY_ID[p.road!].cls);
  // their own weapon kind is theirs to wield, over their archetype's
  const arms = armsOf(p.road)!;
  const item = ITEMS.find((i) => i.family === arms && i.slot === 'weapon')!;
  assert.ok(canWear(p, item));
  // (a shared calling's person keeps the archetype's list)
  const other = ITEMS.find((i) => i.slot === 'weapon' && i.family && !CLASS_DEFS.mage.weapons.includes(i.family))!;
  assert.equal(canWear({ cls: 'mage', road: 'apprentice' }, other), false);
});

test('a save from before keeps its callings: a shared road stays as it was', () => {
  const s = newGame('old-save', { origin: 'lich' });
  s.evolveAsk = false;
  const p = s.people[1];
  p.road = 'occultist';
  p.cls = 'witch';
  p.level = 13;
  classesHourly(s);
  assert.equal(p.road, 'occultist');
  // (one with a class from before the paths takes the shared node of their class, as before)
  const q = s.people[2];
  q.road = undefined;
  q.cls = 'knight';
  q.level = 5;
  classesHourly(s);
  assert.equal(q.road, 'fighter');
});
