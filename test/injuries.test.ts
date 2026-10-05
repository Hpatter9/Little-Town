import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { capacities, injuriesHourly, injuryPace, injuryWork, losePart, prostheticsWanted, woundPerson } from '../src/shared/sim/injuries';
import { maxHp, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, row } from './helpers';

function someone(s: GameState, name = 'Hurt'): Person {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name, partner: null, wounds: undefined, lasting: undefined, fitted: undefined };
  s.people.push(p);
  return p;
}
function hours(s: GameState, n: number, rng: Rng) {
  for (let h = 0; h < n; h++) {
    s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    injuriesHourly(s, rng);
  }
}

test('a blow leaves a wound on a part, which hurts, hinders, and heals in days (faster tended)', () => {
  const s = plainGame('inj1');
  const rng = new Rng(3);
  const p = someone(s);
  const w = woundPerson(s, p, maxHp(p) * 0.25, 'cut', rng)!;
  assert.ok(w && w.sev > 0.5, 'a real wound');
  assert.ok(capacities(p).pain > 0, 'it hurts');
  assert.ok(injuryWork(p) < 1, 'and slows their work');
  hours(s, 24 * 5, rng);
  assert.equal(p.wounds!.length, 0, 'healed within five days');
  // tended (a healer's hut standing): faster
  const q = someone(s, 'Tended');
  const r = someone(s, 'Untended');
  woundPerson(s, q, maxHp(q) * 0.2, 'fracture', rng);
  woundPerson(s, r, maxHp(r) * 0.2, 'fracture', rng);
  r.away = 999; // (away: nobody tends them)
  s.buildings.push({ id: s.nextId++, def: 'healers_hut', tile: 10, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  hours(s, 24 * 3, rng);
  assert.ok((q.wounds?.[0]?.sev ?? 0) < (r.wounds?.[0]?.sev ?? 0), 'the tended heal faster');
});

test('a lost leg slows them to a crawl; a peg leg fitted by the healer gets them walking again', () => {
  const s = plainGame('inj2');
  const rng = new Rng(5);
  const p = someone(s);
  losePart(s, p, 'leg_l');
  assert.ok(injuryPace(p) < 0.7, `slowed: ${injuryPace(p)}`);
  assert.deepEqual(prostheticsWanted(s), ['leg']);
  const healer = someone(s, 'Healer');
  healer.skills.medicine.level = 40;
  s.buildings.push({ id: s.nextId++, def: 'healers_hut', tile: 10, row: row(s), status: 'done', delivered: {}, progress: 1, store: {}, operator: healer.id } as Building);
  s.items.peg_leg = 1;
  const before = injuryPace(p);
  hours(s, 1, rng);
  assert.equal(p.fitted?.leg_l, 'peg_leg', 'fitted');
  assert.equal(s.items.peg_leg, 0, 'used');
  assert.ok(injuryPace(p) > before, 'walking better');
  assert.equal(prostheticsWanted(s).length, 1, 'still wants a better one (prosthetic, then bionic)');
});

test('an arm lost takes the hand with it; their hands work half as well', () => {
  const s = plainGame('inj3');
  const p = someone(s);
  losePart(s, p, 'arm_r');
  assert.ok(p.lasting!.some((l) => l.part === 'hand_r' && l.kind === 'lost'));
  assert.ok(Math.abs(capacities(p).handling - 0.5) < 0.01);
  assert.deepEqual(prostheticsWanted(s), ['arm'], 'an arm, not a hand as well');
});

test('bad wounds sometimes scar for good', () => {
  const s = plainGame('inj4');
  const rng = new Rng(9);
  const folk = Array.from({ length: 30 }, (_, i) => someone(s, `P${i}`));
  for (const p of folk) woundPerson(s, p, maxHp(p) * 0.35, 'burn', rng);
  hours(s, 24 * 8, rng);
  const scarred = folk.filter((p) => p.lasting?.some((l) => l.kind === 'scar')).length;
  assert.ok(scarred >= 3 && scarred < 30, `${scarred} of 30 scarred`);
});

test('what shows of the harm: a patch, a peg, a crutch and a bandage', async () => {
  const { snapshot } = await import('../src/shared/sim/snapshot');
  const s = plainGame('marks1');
  const p = someone(s);
  p.lasting = [{ part: 'eye_l', kind: 'lost' }, { part: 'leg_r', kind: 'lost' }, { part: 'leg_l', kind: 'lost' }];
  p.fitted = { leg_r: 'peg_leg' };
  p.wounds = [{ part: 'head', kind: 'cut', sev: 0.5, peak: 0.5 }, { part: 'arm_l', kind: 'bruise', sev: 0.1, peak: 0.1 }];
  const v = snapshot(s).people.find((q) => q.id === p.id)!;
  const look = (part: string) => v.body.marks.find((m) => m.part === part)?.look;
  assert.equal(look('eye_l'), 'patch');
  assert.equal(look('leg_r'), 'peg');
  assert.equal(look('leg_l'), 'gone');
  assert.equal(look('head'), 'bandage');
  assert.equal(look('arm_l'), undefined, 'a light bruise isn\'t bandaged');
});
