// The stores readout (the owner's ask): a small strip at the top right of the phone page with the town's coins and its
// main materials (wood, stone, food, and the one or two the town holds most of from a short list by stage). It reads
// the snapshot only, redraws only when a figure changes, and a tap opens the Town menu's Stores tab.
// (which figures, in `storesPick.ts`) In autumn and winter it also shows the woodpile (sim/hardship.ts
// `woodpileForecast`): the logs put by for the hearths, tinted amber when they won't last the winter and blue-grey with
// the hearths cold.

import type { Snapshot } from '../../shared/sim/snapshot';
import type { Material } from '../../shared/data/materials';
import { stockIcon } from '../art/materialIcons';
import { readoutItems, short } from './storesPick';
import { itemIcon } from '../art/icons';
import { ITEM_BY_ID } from '../../shared/data/items';
import firepit from '../art/scene/firepit.png';
import firepitCold from '../art/scene/firepit_cold.png';

export function startStoresReadout(bridge: { onSnapshot(f: (s: Snapshot) => void): void; openPanel(id: string): void }): HTMLElement {
  const box = document.createElement('button');
  box.id = 'stores-readout';
  box.title = 'The town’s stores';
  box.hidden = true;
  let key = '';
  bridge.onSnapshot((s) => {
    const items = readoutItems(s.stock, s.coins, s.items);
    const fw = s.firewood;
    const k = items.map((i) => `${i.id}:${i.n}`).join('|') + (fw ? `|fire:${fw.pile}:${fw.warn}:${fw.heated}:${Math.floor(fw.lastsDays ?? -1)}` : '');
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
      ...(fw ? [fireCell(fw)] : []),
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

/** The woodpile's cell: the firepit (cold when the hearths are), the logs put by, and the warning's tint. */
function fireCell(fw: NonNullable<Snapshot['firewood']>): HTMLElement {
  const cell = document.createElement('span');
  cell.className = `sr-item sr-fire${fw.warn ? ` sr-${fw.warn}` : ''}`;
  const lasts = fw.lastsDays === null ? '' : `, about ${Math.floor(fw.lastsDays)} days with the stores`;
  cell.title = fw.heated ? 'Firewood: the town is heated' : fw.warn === 'cold' ? 'Firewood: none, and the hearths are cold!' : `Firewood: ${fw.pile} on the woodpile of ${fw.need} wanted${lasts}${fw.warn === 'short' ? ". It won't last the winter" : ''}`;
  const pic = document.createElement('img');
  pic.src = fw.warn === 'cold' ? firepitCold : firepit;
  pic.className = 'sr-firepit';
  cell.append(pic, Object.assign(document.createElement('span'), { textContent: fw.heated ? '∞' : short(fw.pile) }));
  return cell;
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
