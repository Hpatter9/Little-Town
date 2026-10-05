import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS } from '../src/shared/data/research';
import { BLEED_TICKS, heal, knockDown } from '../src/shared/sim/health';
import { maxHp, type Person } from '../src/shared/sim/state';
import { plainGame } from './helpers';

const helper = (s: ReturnType<typeof plainGame>): Person => {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: 'Hurt', partner: null };
  s.people.push(p);
  return p;
};

test('the care of the hurt is learned: every medicine topic but the buildings\' does something', () => {
  for (const id of ['herbalism', 'bonesetting', 'field_dressing', 'physick', 'barber_surgeons', 'convalescence', 'antiseptics', 'triage']) {
    const t = TOPICS.find((q) => q.id === id);
    assert.ok(t, id);
    assert.ok(t!.effects.some((e) => e.type === 'care'), `${id} has a care effect`);
  }
});

test('Field Dressing and Barber-Surgeons give the downed longer before they bleed out', () => {
  const s = plainGame('care1');
  s.items.medkit = 0;
  const p = helper(s);
  knockDown(s, p);
  const plain = p.downed!.bleedUntil! - s.tick;
  assert.equal(plain, BLEED_TICKS);
  s.research.done.push('herbalism', 'field_dressing', 'physick', 'barber_surgeons');
  const q = helper(s);
  knockDown(s, q);
  assert.equal(q.downed!.bleedUntil! - s.tick, Math.round(BLEED_TICKS * 1.5 * 1.5));
});

test('Physick and Convalescence heal faster; Bonesetting gets the downed up sooner', () => {
  const s = plainGame('care2');
  const a = helper(s);
  a.hp = 10;
  for (let i = 0; i < 600; i++) heal(s, a);
  const plain = a.hp - 10;
  s.research.done.push('herbalism', 'physick', 'convalescence');
  const b = helper(s);
  b.hp = 10;
  for (let i = 0; i < 600; i++) heal(s, b);
  assert.ok(b.hp - 10 > plain * 1.8, `${plain} then ${b.hp - 10}`);
  // up sooner: at 0.3 of their health without, 0.21 with Bonesetting
  s.research.done.push('bonesetting');
  const c = helper(s);
  c.downed = { bleedUntil: null };
  c.hp = maxHp(c) * 0.22;
  heal(s, c);
  assert.equal(c.downed, null, 'back on their feet');
});
