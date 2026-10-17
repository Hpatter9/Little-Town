import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginTown, CURRENT_KEY, deleteSlot, freeSlot, MAX_SLOTS, noteCurrent, readSlots, SAVE_KEY, SLOTS_KEY, switchTo, type SlotInfo, type Store } from '../src/renderer/mobile/saveSlots';

const memory = (limit = Infinity): Store & { data: Map<string, string>; limit: number } => {
  const data = new Map<string, string>();
  return {
    data,
    limit,
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      let used = 0;
      for (const [key, val] of data) if (key !== k) used += val.length;
      if (used + v.length > this.limit) throw new Error('quota');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
};
const info = (name: string, day = 5): Omit<SlotInfo, 'n'> => ({ name, origin: 'Settlers', biome: 'meadow', day, people: 7, savedAt: 1000 });

test('an old single save becomes slot 1 and stays the one in play', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'OLD');
  const book = readSlots(s, 50);
  assert.equal(book.current, 1);
  assert.deepEqual(book.slots.map((x) => x.n), [1]);
  assert.equal(s.getItem(SAVE_KEY), 'OLD');
  assert.equal(s.getItem('littletown.slot.1'), null); // (one copy only)
  assert.equal(readSlots(s).slots.length, 1); // (once)
});

test('no save, no slots', () => {
  assert.deepEqual(readSlots(memory()), { slots: [], current: 0 });
});

test('the game\'s save notes fill in the slot in play', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'A');
  noteCurrent(s, info('Hearthmoor'));
  assert.equal(readSlots(s).slots[0].name, 'Hearthmoor');
});

test('a new town goes into a free slot and the old one is parked', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'A');
  readSlots(s);
  assert.equal(beginTown(s, true), 'new-slot');
  s.setItem(SAVE_KEY, 'B');
  const book = readSlots(s);
  assert.equal(book.current, 2);
  assert.equal(s.getItem('littletown.slot.1'), 'A');
  assert.equal(s.getItem(SAVE_KEY), 'B');
});

test('a town only just begun is replaced, not kept', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'A');
  readSlots(s);
  assert.equal(beginTown(s, false), 'replaced');
  assert.deepEqual(readSlots(s).slots.map((x) => x.n), [1]);
});

test('switching swaps the texts', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'A');
  readSlots(s);
  beginTown(s, true);
  s.setItem(SAVE_KEY, 'B');
  assert.deepEqual(switchTo(s, 1), { ok: true });
  assert.equal(s.getItem(SAVE_KEY), 'A');
  assert.equal(s.getItem('littletown.slot.2'), 'B');
  assert.equal(s.getItem('littletown.slot.1'), null);
  assert.equal(readSlots(s).current, 1);
  assert.deepEqual(switchTo(s, 5), { ok: false, reason: 'missing' });
});

test('a switch that does not fit changes nothing', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'AAAA');
  readSlots(s);
  beginTown(s, true);
  s.setItem(SAVE_KEY, 'BBBB');
  let used = 0;
  for (const v of s.data.values()) used += v.length;
  s.limit = used; // (not a character to spare)
  const r = switchTo(s, 1);
  assert.equal(r.ok, false);
  assert.equal(s.getItem(SAVE_KEY), 'BBBB');
  assert.equal(s.getItem('littletown.slot.1'), 'AAAA');
  assert.equal(readSlots(s).current, 2);
});

test('the slots are capped; a full book keeps the town in play', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 't0');
  readSlots(s);
  for (let i = 1; i < MAX_SLOTS; i++) {
    assert.equal(beginTown(s, true), 'new-slot');
    s.setItem(SAVE_KEY, `t${i}`);
  }
  const full = readSlots(s);
  assert.equal(full.slots.length, MAX_SLOTS);
  assert.equal(freeSlot(full.slots), null);
  assert.equal(beginTown(s, true), 'replaced');
  assert.equal(readSlots(s).slots.length, MAX_SLOTS);
});

test('deleting a slot frees it; deleting the one in play removes the save', () => {
  const s = memory();
  s.setItem(SAVE_KEY, 'A');
  readSlots(s);
  beginTown(s, true);
  s.setItem(SAVE_KEY, 'B');
  assert.equal(deleteSlot(s, 1), true);
  assert.equal(s.getItem('littletown.slot.1'), null);
  assert.deepEqual(readSlots(s).slots.map((x) => x.n), [2]);
  assert.equal(deleteSlot(s, 2), true);
  assert.equal(s.getItem(SAVE_KEY), null);
  assert.equal(s.getItem(CURRENT_KEY), '0');
  assert.deepEqual(JSON.parse(s.getItem(SLOTS_KEY)!), []);
  assert.equal(deleteSlot(s, 4), false);
});
