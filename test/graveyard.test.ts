import assert from 'node:assert/strict';
import { test } from 'node:test';
import { killPerson } from '../src/shared/sim/health';
import { onBuilt } from '../src/shared/sim/era';
import { mood } from '../src/shared/sim/townsfolk';
import { summonForRaid } from '../src/shared/sim/classes';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { buildingCentreX } from '../src/shared/sim/buildings';
import { makePerson, type Building, type GameState } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', 3000 + i * 40, s.people.map((p) => p.name)));
  return s;
}
const yard = (s: GameState): Building => {
  const b = { id: s.nextId++, def: 'graveyard', tile: 90, status: 'done', delivered: {}, progress: 1, store: {} } as Building;
  s.buildings.push(b);
  return b;
};

test('a graveyard gathers the graves, and eases the mourning', () => {
  const s = town('yard');
  killPerson(s, s.people[1], 'of a fever');
  const where = s.graves![0].x;
  const b = yard(s);
  onBuilt(s, b);
  assert.notEqual(s.graves![0].x, where, 'the grave was moved');
  assert.ok(Math.abs(s.graves![0].x - buildingCentreX(b)) < 60, 'into the graveyard');
  killPerson(s, s.people[1], 'of a fever');
  assert.ok(Math.abs(s.graves![1].x - buildingCentreX(b)) < 60, 'and new graves go there too');
  const r = mood(s, s.people[0]).reasons.find((x) => x.text.startsWith('Mourning'));
  assert.equal(r?.text, 'Mourning a death (laid to rest)');
  assert.equal(r?.value, -3);
});

test('a Necromancer calls the buried up out of the graveyard to defend the town', () => {
  const s = town('yard-necro');
  yard(s);
  killPerson(s, s.people[2], 'of a fever');
  s.people[1].cls = 'necromancer';
  const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(1));
  summonForRaid(s, wave);
  const ghost = wave.raiders.find((r) => r.kind === 'grave_ghost');
  assert.ok(ghost?.ally, 'an ally ghost rises');
  assert.equal(ghost?.risenFrom, s.graves![0].name);
});

test("the town's own allies aren't counted among the raid's dead, or taken prisoner", async () => {
  const { updateRaid } = await import('../src/shared/sim/raids');
  const s = town('ally-count');
  const wave = startRaid(s, RAID_KIND_BY_ID.bandits, 12, new Rng(2));
  wave.phase = 'active';
  wave.raiders.splice(1);
  wave.raiders[0].down = true;
  const ghost = { ...wave.raiders[0], id: s.nextId++, kind: 'grave_ghost', ally: true, down: true };
  const raisedBandit = { ...wave.raiders[0], id: s.nextId++, kind: 'bandit', ally: true, down: true };
  wave.raiders.push(ghost, raisedBandit);
  for (const rd of wave.raiders) rd.gone = !rd.down;
  s.tick++;
  updateRaid(s, new Rng(9));
  assert.equal(s.raid, null);
  assert.ok(s.notices.some((n) => n.text.includes('The raider was killed')), s.notices.map((n) => n.text).join(' | '));
  assert.ok(s.prisoners.length <= 1, 'only the real bandit could be taken');
});
