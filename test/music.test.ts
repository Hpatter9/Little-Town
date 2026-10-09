import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, PIECES, piecesFor, pieceSeconds, type Mood } from '../src/renderer/musicScore';
import { nextFor } from '../src/renderer/music';
import { moodOf } from '../src/renderer/musicMood';

const MOODS: Mood[] = ['day', 'night', 'winter', 'dark', 'feast', 'battle', 'boss', 'sea', 'heroic'];

test('the composer writes the same piece the same way from the same seed, and differently from another', () => {
  for (const p of PIECES) {
    const a = compose(p, 7);
    assert.deepEqual(a, compose(p, 7), p.id);
    assert.notDeepEqual(a, compose(p, 8), p.id);
  }
});

test('every piece is playable: notes in range, in time, and a fair length', () => {
  for (const p of PIECES) {
    const notes = compose(p, 3);
    assert.ok(notes.length > 50, `${p.id}: ${notes.length} notes`);
    for (const n of notes) {
      assert.ok(n.p >= 20 && n.p <= 100, `${p.id} pitch ${n.p}`);
      assert.ok(n.t >= 0 && n.d > 0 && n.v > 0 && n.v <= 1, `${p.id} note ${JSON.stringify(n)}`);
    }
    const secs = pieceSeconds(p, notes);
    assert.ok(secs > 40 && secs < 240, `${p.id} lasts ${secs.toFixed(0)}s`);
    // the melody stays in the key
    const lead = notes.filter((n) => n.i === p.lead);
    for (const n of lead) assert.ok(p.mode.includes((((n.p - p.root) % 12) + 12) % 12), `${p.id} ${n.p} out of key`);
  }
});

test('the pieces differ: keys, tempos, modes and instruments', () => {
  assert.ok(PIECES.length >= 16);
  assert.ok(new Set(PIECES.map((p) => p.id)).size === PIECES.length);
  assert.ok(new Set(PIECES.map((p) => p.lead)).size >= 5);
  assert.ok(new Set(PIECES.map((p) => p.bpm)).size >= 12);
  assert.ok(new Set(PIECES.map((p) => p.mode.join())).size >= 6);
});

test('every mood has music, and the next is never the one just played', () => {
  for (const m of MOODS) {
    assert.ok(piecesFor(m).length >= 1, m);
    let last: string | null = null;
    const heard = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const next = nextFor(m, last, (i * 0.6180339) % 1);
      assert.notEqual(next, last, m);
      heard.add(next);
      last = next;
    }
    assert.ok(heard.size >= 2, `${m}: only ${[...heard]}`);
  }
});

test('the mood follows the town', () => {
  const base = { raid: false, boss: false, fight: false, daylight: 1, season: 'summer', theme: 'town', gathering: null, biome: 'forest' };
  assert.equal(moodOf(base), 'day');
  assert.equal(moodOf({ ...base, daylight: 0.05 }), 'night');
  assert.equal(moodOf({ ...base, season: 'winter' }), 'winter');
  assert.equal(moodOf({ ...base, raid: true }), 'battle');
  assert.equal(moodOf({ ...base, raid: true, boss: true }), 'boss');
  assert.equal(moodOf({ ...base, theme: 'vampire' }), 'dark');
  assert.equal(moodOf({ ...base, gathering: 'wedding' }), 'feast');
  assert.equal(moodOf({ ...base, theme: 'merfolk' }), 'sea');
  assert.equal(moodOf({ ...base, theme: 'knights' }), 'heroic');
});
