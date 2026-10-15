import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalNotices, readAbsence, situationNotices, toneOf, worst } from '../src/renderer/mobile/notices';
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

test('closing the away card reads everything from the absence, and nothing after', () => {
  const entries = Array.from({ length: 44 }, (_, i) => ({ id: i + 1, when: 'Day 3 · Spring · 14:05', day: 3, text: `Ada found something ${i}`, key: false }));
  const read = new Set<string>();
  readAbsence(journalNotices(entries, null, 60), read, 44);
  assert.equal(journalNotices(entries, null, 60).filter((n) => !read.has(n.key)).length, 0);
  // (the next line, after the player came back, is new)
  const later = [...entries, { id: 45, when: 'Day 3 · Spring · 15:00', day: 3, text: 'Ada built a hut', key: false }];
  const unread = journalNotices(later, null, 60).filter((n) => !read.has(n.key));
  assert.deepEqual(unread.map((n) => n.key), ['j:45']);
  // (a tip still waits to be read)
  readAbsence([{ key: 'tip:welcome', tone: 'gold', mark: '💡', title: 't', text: '' }], read, 44);
  assert.ok(!read.has('tip:welcome'));
});

test('the first days: tips for the food counter, sending a party and the beds come when the town needs them', async () => {
  const { meet } = await import('../src/renderer/mobile/tips');
  const { makePerson } = await import('../src/shared/sim/state');
  const { Rng } = await import('../src/shared/rng');
  const { TICKS_PER_DAY } = await import('../src/shared/sim/time');
  const s = plainGame('tips-days');
  assert.ok(!meet(snapshot(s), []).includes('sendparty'), 'not on the first day, nor alone');
  const rng = new Rng(5);
  for (let i = 0; i < 2; i++) s.people.push(makePerson(rng, s.nextId++, 'hunter', { x: s.people[0].x, y: s.people[0].y }, s.people.map((q) => q.name)));
  s.tick = 2 * TICKS_PER_DAY;
  const met = meet(snapshot(s), []);
  assert.ok(met.includes('sendparty'), 'three of them by the third day: a party may go');
  assert.ok(met.includes('food'), 'no food in store: the counter is explained');
});
