import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalNotices, situationNotices, toneOf, worst } from '../src/renderer/mobile/notices';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';
import { notify } from '../src/shared/sim/state';
import type { JournalEntryView } from '../src/shared/sim/snapshot';

test('the news is told apart by tone: red for threats and losses, gold for what wants the player, blue for the rest', () => {
  assert.equal(toneOf('Ulf has died of his wounds.', true), 'red');
  assert.equal(toneOf('Wolf pack is coming from the west!', false), 'red');
  assert.equal(toneOf('A wanderer asks to join the town.', false), 'gold');
  assert.equal(toneOf('Ore vein found in the Grey Barrens, to the north.', false), 'gold');
  assert.equal(toneOf('Research complete: Fire Keeping', false), 'blue');
  assert.equal(toneOf('Finished building: Wayside Shrine', false), 'blue');
  assert.equal(worst(['blue', 'gold', 'blue']), 'gold');
  assert.equal(worst(['blue', 'red', 'gold']), 'red');
  assert.equal(worst([]), null);
});

test('the standing situations and the Journal become keyed notices; the small change is left out', () => {
  const s = plainGame('notices');
  s.prompts.push({ id: s.nextId++, kind: 'visitor', expedition: null, title: 'A stranger at the gate', text: 'Take them in?', options: ['Take them in', 'Send them on'], defaultOption: 0, ticksLeft: 600 } as never);
  notify(s, 'Crafted: 2 spears');
  notify(s, `${s.people[0].name} has died of old age.`, true);
  const snap = snapshot(s);
  const now = situationNotices(snap);
  const ask = now.find((n) => n.key.startsWith('ask:'));
  assert.ok(ask && ask.tone === 'gold' && ask.action?.kind === 'question', JSON.stringify(now));
  const view = (e: { id: number; text: string; key?: true }): JournalEntryView => ({ id: e.id, when: 'Day 1 · Spring · 08:00', day: 1, text: e.text, key: !!e.key });
  const lines = journalNotices(s.journal.map(view), snap);
  assert.ok(!lines.some((n) => /Crafted/.test(n.title)), 'the small change is left to the Chronicle');
  const death = lines.find((n) => /died/.test(n.title));
  assert.ok(death && death.tone === 'red' && death.key === `j:${s.journal.at(-1)!.id}`, JSON.stringify(lines));
  // (keys are stable, so a notice counts as new once)
  assert.deepEqual(situationNotices(snap).map((n) => n.key), now.map((n) => n.key));
});

test('the first hour: each tip is met once, the earliest first, a couple at a time, with a way to its tab', async () => {
  const { meet, tipsDue, TIPS, TIPS_AT_ONCE } = await import('../src/renderer/mobile/tips');
  const { tipNotice } = await import('../src/renderer/mobile/notices');
  const s = plainGame('tips');
  let met = meet(snapshot(s), []);
  assert.ok(met.includes('welcome'), 'welcome at once');
  assert.ok(!met.includes('raid'), 'no raid yet');
  const read = new Set<string>();
  const due = tipsDue(met, (k) => read.has(k));
  assert.ok(due.length <= TIPS_AT_ONCE);
  assert.equal(due[0].id, 'welcome');
  read.add('tip:welcome');
  assert.ok(!tipsDue(met, (k) => read.has(k)).some((t) => t.id === 'welcome'), 'read, gone');
  met = meet(snapshot(s), met);
  assert.equal(new Set(met).size, met.length, 'each once');
  for (const t of TIPS) {
    const n = tipNotice(t);
    assert.equal(n.tone, 'gold');
    if (t.panel) assert.equal(n.action?.panel, t.panel);
  }
});
