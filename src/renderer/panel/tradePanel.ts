// Trade panel: the way into the shop and the tavern (once built), the caravan's deals (while one is at the market) and
// the town's horses.

import { storePanel } from '../../shared/ipc';
const STORE_MARKS: Record<string, string> = { furniture: '🪑', weapons: '⚔️', armour: '🛡️', medicine: '⚗️' };
import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { HORSE_HP } from '../../shared/data/trade';
import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';

export const tradeKey = (s: Snapshot) =>
  JSON.stringify([s.caravan && [s.caravan.faction, Math.ceil(s.caravan.hoursLeft), s.caravan.offers.map((o) => [o.done, o.ok, o.reason])], s.marketBuilt, s.nextCaravanHours !== null && Math.ceil(s.nextCaravanHours), s.horses, s.stalls, s.stock, s.shop?.name, s.tavern?.name]);

const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

export function renderTrade(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  const head = el('div', 'panel-head');
  head.append(el('span', '', s.caravan ? `${s.caravan.faction ? `A caravan of ${s.caravan.faction}` : 'Caravan'} at the market: leaves in ${Math.ceil(s.caravan.hoursLeft)}h` : 'No caravan in town'), el('span', '', `Stored ${s.storageUsed}/${s.storageCapacity}`));
  out.push(head);

  // (once built: a way in to see them, besides tapping them in the town)
  const venues = (['shop', 'tavern'] as const).filter((v) => s[v]);
  if (venues.length || s.stores.length) {
    const row = el('div', 'venue-row');
    for (const v of venues) row.append(button(`${v === 'shop' ? '🛒' : '🍺'} ${s[v]!.name}`, () => bridge?.openPanel(v)));
    for (const st of s.stores) row.append(button(`${STORE_MARKS[st.line!]} ${st.name}`, () => bridge?.openPanel(storePanel(st.line!))));
    out.push(row);
  }

  if (s.caravan) {
    out.push(el('h2', '', 'Deals'));
    const grid = el('div', 'cards wide');
    for (const o of s.caravan.offers) {
      const c = el('div', o.done ? 'card done' : 'card');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', o.horse ? 'A horse' : `They give ${list(o.gives)}`), el('span', 'card-size', o.done ? 'Done' : ''));
      c.append(top, el('div', 'purpose', `For ${list(o.wants)}`));
      if (!o.done) {
        c.append(button('Trade', () => bridge?.command({ type: 'trade', offer: o.id }), { disabled: !o.ok, title: o.reason }));
        if (!o.ok && o.reason) c.append(el('div', 'lock short', o.reason));
      }
      grid.append(c);
    }
    out.push(grid);
  } else if (!s.marketBuilt) {
    out.push(el('div', 'hint', 'Build a Market Stall (Trade research, Medieval era) and caravans will visit every couple of days.'));
  } else if (s.nextCaravanHours !== null) {
    out.push(el('div', 'hint', `The next caravan is due in about ${Math.ceil(s.nextCaravanHours)} game hours.`));
  }

  out.push(el('h2', '', `Horses (${s.horses.length}/${s.stalls} stalls)`));
  if (!s.horses.length) {
    out.push(el('div', 'hint', s.stalls ? 'No horses yet. Caravans sell them now and then.' : 'Build a Stable (Animal Husbandry) to keep horses. They carry and speed up expeditions.'));
  }
  for (const h of s.horses) {
    const row = el('div', 'bar-row');
    const bar = el('div', 'bar');
    const fill = el('div', h.hp < HORSE_HP * 0.5 ? 'bar-fill low' : 'bar-fill');
    fill.style.width = `${Math.round((h.hp / HORSE_HP) * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'bar-label', h.name), bar, el('span', 'bar-text', h.away ? 'On an expedition' : h.hp < HORSE_HP * 0.5 ? 'Resting (hurt)' : 'In the stable'));
    out.push(row);
  }
  return out;
}
