// The stores readout (the owner's ask): a small strip at the top right of the phone page with the town's coins and its
// main materials (wood, stone, food, and the one or two the town holds most of from a short list by stage). It reads
// the snapshot only, redraws only when a figure changes, and a tap opens the Town menu's Stores tab.
// (which figures, in `storesPick.ts`)

import type { Snapshot } from '../../shared/sim/snapshot';
import type { Material } from '../../shared/data/materials';
import { stockIcon } from '../art/materialIcons';
import { readoutItems, short } from './storesPick';
import { itemIcon } from '../art/icons';
import { ITEM_BY_ID } from '../../shared/data/items';

export function startStoresReadout(bridge: { onSnapshot(f: (s: Snapshot) => void): void; openPanel(id: string): void }): HTMLElement {
  const box = document.createElement('button');
  box.id = 'stores-readout';
  box.title = 'The town’s stores';
  box.hidden = true;
  let key = '';
  bridge.onSnapshot((s) => {
    const items = readoutItems(s.stock, s.coins, s.items);
    const k = items.map((i) => `${i.id}:${i.n}`).join('|');
    if (k === key) return;
    key = k;
    box.replaceChildren(
      ...items.map((i) => {
        const cell = document.createElement('span');
        cell.className = 'sr-item';
        cell.title = i.label;
        cell.append(icon(i.id) ?? Object.assign(document.createElement('b'), { textContent: i.id === 'coins' ? '●' : i.label[0] }), Object.assign(document.createElement('span'), { textContent: short(i.n) }));
        return cell;
      }),
    );
    box.hidden = false;
  });
  box.addEventListener('click', () => {
    try {
      localStorage.setItem('littletown.subtab.build', 'Stores');
    } catch {
      /* (no storage) */
    }
    bridge.openPanel('build');
  });
  return box;
}

/** Coins have no material icon: a gold disc; food borrows the berries' picture, the parts a blade blank's. */
function icon(id: string): HTMLElement | null {
  if (id === 'parts') return itemIcon(ITEM_BY_ID.iron_blade, 1);
  if (id === 'coins') {
    const d = document.createElement('i');
    d.className = 'sr-coin';
    return d;
  }
  return stockIcon((id === 'food' ? 'berries' : id) as Material, 16);
}
