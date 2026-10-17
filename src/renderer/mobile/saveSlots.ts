// The phone's save slots (the main menu's Load game). The town in play is always `littletown.save`, as before, so
// nothing else about saving changed; the other towns wait in `littletown.slot.<n>`, and a small index
// (`littletown.slots`) says what each slot holds. The slot in play has an index entry but no slot key of its own (one
// copy of a big town, not two: localStorage is small). Switching towns swaps the texts and the page reloads.
// Pure: it takes a storage-like object, so the tests can run it without a browser.

export const SAVE_KEY = 'littletown.save';
export const SLOTS_KEY = 'littletown.slots';
export const CURRENT_KEY = 'littletown.slot.current';
const slotKey = (n: number) => `littletown.slot.${n}`;
/** How many towns the phone keeps (each is up to a megabyte or two, and a browser gives about 5 MB). */
export const MAX_SLOTS = 6;

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SlotInfo {
  n: number;
  name: string;
  origin: string;
  biome: string;
  day: number;
  people: number;
  savedAt: number;
}

export interface SlotBook {
  slots: SlotInfo[];
  /** The slot in play (the text in `littletown.save`), or 0 when there is no town yet. */
  current: number;
}

const safe = <T>(f: () => T, otherwise: T): T => {
  try {
    return f();
  } catch {
    return otherwise;
  }
};

function readIndex(store: Store): SlotInfo[] {
  const raw = safe(() => JSON.parse(store.getItem(SLOTS_KEY) ?? '[]') as unknown, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is SlotInfo => !!e && typeof e.n === 'number' && e.n >= 1 && e.n <= MAX_SLOTS)
    .map((e) => ({ n: e.n, name: String(e.name ?? ''), origin: String(e.origin ?? ''), biome: String(e.biome ?? ''), day: Number(e.day) || 0, people: Number(e.people) || 0, savedAt: Number(e.savedAt) || 0 }));
}

/** Write the index and the slot in play; false when the browser refuses (full). */
function writeBook(store: Store, book: SlotBook): boolean {
  try {
    store.setItem(SLOTS_KEY, JSON.stringify([...book.slots].sort((a, b) => a.n - b.n)));
    store.setItem(CURRENT_KEY, String(book.current));
    return true;
  } catch {
    return false;
  }
}

/** The slots as they stand. The first time this build runs, an existing `littletown.save` becomes slot 1, still the
 *  one in play (nobody loses a town); what the index knows of it is filled in from the game's next save. */
export function readSlots(store: Store, now = 0): SlotBook {
  const slots = readIndex(store);
  let current = Number(safe(() => store.getItem(CURRENT_KEY), '0')) || 0;
  const hasSave = safe(() => store.getItem(SAVE_KEY), null) !== null;
  if (!hasSave) {
    // (no town in play: any entry claiming to be it is gone)
    const rest = slots.filter((s) => s.n !== current || safe(() => store.getItem(slotKey(s.n)), null) !== null);
    return { slots: rest, current: 0 };
  }
  if (!slots.some((s) => s.n === current)) {
    const n = freeSlot(slots) ?? 1;
    const kept = slots.filter((s) => s.n !== n);
    kept.push({ n, name: 'Your town', origin: '', biome: '', day: 0, people: 0, savedAt: now });
    current = n;
    const book = { slots: kept, current };
    writeBook(store, book);
    return book;
  }
  return { slots, current };
}

/** The lowest free slot, or null when all are taken. */
export function freeSlot(slots: readonly SlotInfo[]): number | null {
  for (let n = 1; n <= MAX_SLOTS; n++) if (!slots.some((s) => s.n === n)) return n;
  return null;
}

/** What the game says of the town in play, kept in the index (each save). */
export function noteCurrent(store: Store, info: Omit<SlotInfo, 'n'>, now = info.savedAt): void {
  const book = readSlots(store, now);
  if (!book.current) return;
  const slots = book.slots.map((s) => (s.n === book.current ? { ...info, n: s.n } : s));
  writeBook(store, { slots, current: book.current });
}

export type Switch = { ok: true } | { ok: false; reason: 'missing' | 'full' };

/** Make slot `n` the town in play: the one in play is parked in its slot, and the chosen one moves into
 *  `littletown.save`. Nothing is lost if the browser runs out of room part way (it is put back). */
export function switchTo(store: Store, n: number): Switch {
  const book = readSlots(store);
  if (n === book.current) return { ok: true };
  const text = safe(() => store.getItem(slotKey(n)), null);
  if (text === null || !book.slots.some((s) => s.n === n)) return { ok: false, reason: 'missing' };
  const playing = safe(() => store.getItem(SAVE_KEY), null);
  try {
    if (playing !== null && book.current) store.setItem(slotKey(book.current), playing);
    store.setItem(SAVE_KEY, text);
  } catch {
    if (book.current) safe(() => store.removeItem(slotKey(book.current)), undefined);
    return { ok: false, reason: 'full' };
  }
  safe(() => store.removeItem(slotKey(n)), undefined);
  writeBook(store, { slots: book.slots, current: n });
  return { ok: true };
}

/** Take a slot away. The one in play goes too (its text, `littletown.save`); the page must not save it back. */
export function deleteSlot(store: Store, n: number): boolean {
  const book = readSlots(store);
  if (!book.slots.some((s) => s.n === n)) return false;
  safe(() => store.removeItem(slotKey(n)), undefined);
  if (n === book.current) safe(() => store.removeItem(SAVE_KEY), undefined);
  return writeBook(store, { slots: book.slots.filter((s) => s.n !== n), current: n === book.current ? 0 : book.current });
}

/** A new town is about to take over `littletown.save`. If the old one is worth keeping and there is a free slot, it
 *  is parked in its slot and the new town gets the free one ('new-slot'); otherwise the new town takes the slot in
 *  play ('replaced': the caller keeps the old text as the one backup, as before). */
export function beginTown(store: Store, keepOld: boolean, now = 0): 'new-slot' | 'replaced' {
  const book = readSlots(store, now);
  const playing = safe(() => store.getItem(SAVE_KEY), null);
  const free = freeSlot(book.slots);
  const blank = (n: number): SlotInfo => ({ n, name: 'New town', origin: '', biome: '', day: 0, people: 0, savedAt: now });
  if (keepOld && playing !== null && book.current && free !== null) {
    try {
      store.setItem(slotKey(book.current), playing);
    } catch {
      return 'replaced';
    }
    writeBook(store, { slots: [...book.slots, blank(free)], current: free });
    return 'new-slot';
  }
  const at = book.current || free || 1;
  writeBook(store, { slots: [...book.slots.filter((s) => s.n !== at), blank(at)], current: at });
  return 'replaced';
}
