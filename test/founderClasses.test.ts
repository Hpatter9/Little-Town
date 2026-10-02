import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASS_DEFS, CLASSES } from '../src/shared/data/classes';
import { FOUNDER_CLASS, FOUNDER_CLASSES } from '../src/shared/data/founderClasses';
import { FOUNDERS } from '../src/shared/data/founders';
import { classStat } from '../src/shared/data/levels';
import type { OriginId } from '../src/shared/data/origins';
import { classesHourly } from '../src/shared/sim/classes';
import { newGame } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';

test('every ready-made founder has a calling of their own, named unlike any other', () => {
  const names = new Set<string>(CLASSES.flatMap((c) => CLASS_DEFS[c].stages));
  const all = Object.values(FOUNDERS).flat();
  assert.equal(FOUNDER_CLASSES.length, all.length);
  for (const f of all) {
    const c = FOUNDER_CLASS[f.id];
    assert.ok(c, `${f.id} has a calling`);
    assert.ok(CLASS_DEFS[c.base], `${f.id} stands on a real class`);
    for (const n of c.stages) {
      assert.ok(!names.has(n), `${n} is used once`);
      names.add(n);
    }
  }
});

test('a founder starts in their calling, stronger than its base, and the snapshot names only what they have been', () => {
  for (const [origin, list] of Object.entries(FOUNDERS) as [OriginId, (typeof FOUNDERS)[OriginId]][]) {
    const f = list[0];
    const s = newGame(`fc-${origin}`, { origin, founder: { pick: f.id, background: '', traits: [], look: f.look, name: '' } });
    const p = s.people.find((q) => q.id === s.mainId)!;
    assert.equal(p.fcls, f.id, `${origin}: the founder's calling`);
    assert.equal(p.cls, FOUNDER_CLASS[f.id].base);
    const plainMate = { cls: p.cls, level: p.level };
    for (const k of Object.keys(FOUNDER_CLASS[f.id].stats) as (keyof typeof FOUNDER_CLASS[string]['stats'])[]) {
      const better = k === 'speed' ? classStat(p, k) < classStat(plainMate, k) : classStat(p, k) > classStat(plainMate, k);
      assert.ok(better, `${origin}: ${k} beats the base class`);
    }
    p.level = 20;
    const v = snapshot(s).people.find((q) => q.id === p.id)!;
    assert.equal(v.clsName, FOUNDER_CLASS[f.id].stages[2]);
    assert.deepEqual(v.clsPast, FOUNDER_CLASS[f.id].stages.slice(0, 2));
    assert.ok(v.founderCalling);
  }
});

test('a town founded before callings: its founder takes theirs, keeping their level', () => {
  const f = FOUNDERS.knights[1];
  const s = newGame('fc-old', { origin: 'knights', founder: { pick: f.id, background: '', traits: [], look: f.look, name: '' } });
  const p = s.people.find((q) => q.id === 1)!;
  delete p.fcls;
  p.cls = 'bard';
  p.level = 12;
  classesHourly(s);
  assert.equal(p.fcls, f.id);
  assert.equal(p.cls, FOUNDER_CLASS[f.id].base);
  assert.equal(p.level, 12);
});
