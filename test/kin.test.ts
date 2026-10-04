import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepKin } from '../src/shared/sim/townsfolk';
import { newGame, type Person } from '../src/shared/sim/state';

const stranger = (s: ReturnType<typeof newGame>, id: number): Person => {
  const p: Person = { ...s.people[s.people.length - 1], id, name: `Stranger ${id}`, monster: null, machine: false, look: { ...s.people[s.people.length - 1].look, body: undefined, hair: 'long', skin: '#e0b090' } } as Person;
  s.people.push(p);
  return p;
};

test('a lich town is the dead alone: whoever comes in living is raised, and looks it; the lich is left as they are', () => {
  const s = newGame('kin-lich', { origin: 'lich' });
  const lich = s.people.find((p) => p.id === s.mainId)!;
  const a = stranger(s, 50);
  const v = stranger(s, 51);
  v.monster = 'vampire';
  keepKin(s);
  assert.equal(a.monster, 'undead');
  assert.equal(a.look.body, 'skeleton');
  assert.equal(a.look.hair, 'none');
  assert.equal(v.monster, 'undead', 'a vampire among the dead is theirs too');
  assert.ok(!lich.monster || lich.monster !== 'undead' || lich.look.body === 'skeleton', 'the lich keeps their own shape');
  assert.ok(s.people.filter((p) => p.id !== s.mainId).every((p) => p.monster === 'undead' && p.look.body === 'skeleton'), 'every townsperson is one of the dead');
  assert.ok(s.journal.some((j) => /risen/.test(j.text)));
});

test('a pack bites its newcomers; a settlers\' town leaves them be', () => {
  const w = newGame('kin-wolf', { origin: 'werewolf' });
  const a = stranger(w, 60);
  keepKin(w);
  assert.equal(a.monster, 'werewolf');
  const t = newGame('kin-plain', { origin: 'settlers' });
  const b = stranger(t, 61);
  keepKin(t);
  assert.equal(b.monster, null);
  assert.notEqual(b.look.body, 'skeleton');
});
