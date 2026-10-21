// The names the founder gave their unique weapons (sim/naming.ts, `Snapshot.founder.uniqueNames`) laid over the items'
// own names, so every card and list that shows an item's name shows the given one. Each page (the strip, the menus and the
// phone page) holds its own copy of the item table, so each calls this with its snapshots. Renders only; nothing here
// touches the game.

import { ITEM_BY_ID } from '../../shared/data/items';
import type { Snapshot } from '../../shared/sim/snapshot';

const original = new Map<string, string>();

export function applyGivenNames(snap: Snapshot): void {
  const given = snap.founder?.uniqueNames ?? {};
  for (const [id, name] of Object.entries(given)) {
    const def = ITEM_BY_ID[id];
    if (!def || def.name === name) continue;
    if (!original.has(id)) original.set(id, def.name);
    def.name = name;
  }
  for (const [id, name] of original) {
    if (given[id] !== undefined) continue;
    const def = ITEM_BY_ID[id];
    if (def) def.name = name;
    original.delete(id);
  }
}
