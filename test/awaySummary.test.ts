import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awayBefore, awaySummary } from '../src/shared/sim/awaySummary';
import { killPerson } from '../src/shared/sim/health';
import type { RaidRecap } from '../src/shared/sim/raidRecap';
import { plainGame } from './helpers';

test('nothing important while away: no card', () => {
  const s = plainGame('away-quiet');
  const b = awayBefore(s);
  s.tick += 600;
  assert.deepEqual(awaySummary(s, b), []);
});

test('the return card names the dead, the newcomers, the raids, a new age and a question waiting', () => {
  const s = plainGame('away-busy');
  s.people.push({ ...s.people[0], id: s.nextId++, name: 'Wren' });
  const b = awayBefore(s);
  s.tick += 6000;
  killPerson(s, s.people.find((p) => p.name === 'Wren')!, 'at the hands of the wolves');
  s.people.push({ ...s.people[0], id: s.nextId++, name: 'Tamsin' });
  s.raidRecap = { tick: s.tick, name: 'Wolves', outcome: 'victory', killed: 3 } as RaidRecap;
  s.era = 'medieval';
  s.prompts.push({ id: 1, kind: 'event', title: 'A stranger', text: '' } as never);
  const lines = awaySummary(s, b).map((l) => `${l.tone}: ${l.text}`);
  assert.ok(lines.some((l) => l.startsWith('bad: Wren died at the hands of the wolves')), lines.join('\n'));
  assert.ok(lines.some((l) => l === 'good: Wolves raided: they were beaten off (3 felled).'), lines.join('\n'));
  assert.ok(lines.some((l) => l === 'good: Joined the town: Tamsin.'), lines.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('good: The town reached the')), lines.join('\n'));
  assert.ok(lines.some((l) => l === 'ask: A question waits: A stranger.'), lines.join('\n'));
  assert.ok(lines[0].startsWith('bad:'), 'the worst first');
});
