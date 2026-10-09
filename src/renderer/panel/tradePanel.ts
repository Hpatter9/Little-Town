// The Market menu (panel id 'trade'): the town's shops and inns (a card each, to step inside), the caravan's deals (while
// one is at the market), the workshops' orders and recipes (craftingPanel.ts renderWorkshops), and the animals: the
// pens' herds and the horses.

import { storePanel } from '../../shared/ipc';
const STORE_MARKS: Record<string, string> = { furniture: '🪑', weapons: '⚔️', armour: '🛡️', medicine: '⚗️' };
import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { HORSE_HP, WORTH } from '../../shared/data/trade';
import { expandable, facts, type More } from './details';
import type { Bridge, PanelId } from '../../shared/ipc';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { HERDS, PEN_ROOM_PER_COL } from '../../shared/data/livestock';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { marketsKey, renderMarkets } from './marketsPanel';

export const tradeKey = (s: Snapshot) =>
  JSON.stringify([s.caravan && [s.caravan.faction, Math.ceil(s.caravan.hoursLeft), s.caravan.offers.map((o) => [o.done, o.ok, o.reason])], s.marketBuilt, s.nextCaravanHours !== null && Math.ceil(s.nextCaravanHours), s.horses, s.stalls, s.stock, [s.shop, s.tavern, ...s.stores].map((v) => v && [v.name, v.keeperName, v.ownerName, v.takings, Math.round(v.renown)]), s.buildings.filter((b) => HERDS[b.def]).map((b) => [b.status, b.herd?.head, b.wide]), marketsKey(s)]);

const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

export function renderTrade(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  const head = el('div', 'panel-head');
  head.append(el('span', '', s.caravan ? `${s.caravan.faction ? `A caravan of ${s.caravan.faction}` : 'Caravan'} at the market: leaves in ${Math.ceil(s.caravan.hoursLeft)}h` : 'No caravan in town'), el('span', '', `Stored ${s.storageUsed}/${s.storageCapacity}`));
  out.push(head);

  // the town's shops and inns: each a card to step inside (the window: shopPanel.ts), with its keeper, owner and takings
  const venues = [...(['shop', 'tavern'] as const).filter((v) => s[v]).map((v) => ({ v: s[v]!, open: v as PanelId })), ...s.stores.map((st) => ({ v: st, open: storePanel(st.line!) as PanelId }))];
  out.push(el('h2', '', 'Shops'));
  if (!venues.length) out.push(el('div', 'hint', 'No shop yet. The town opens a trading post once it learns Barter, then an inn, and more shops as it grows.'));
  const shops = el('div', 'cards');
  for (const { v, open } of venues) {
    const c = el('div', 'card');
    const top = el('div', 'card-top');
    const mark = open === 'shop' ? '🛒' : open === 'tavern' ? '🍺' : STORE_MARKS[v.line!];
    top.append(el('span', 'card-name', `${mark} ${v.name}`), el('span', 'card-size', v.takings ? `took ${v.takings} yesterday` : ''));
    c.append(top, el('div', 'purpose', `${v.keeperName ? `Kept by ${v.keeperName}` : 'No keeper yet'} · ${v.ownerName ? `owned by ${v.ownerName}` : "the town's own"} · renown ${Math.round(v.renown)}`));
    c.append(button('Step inside', () => bridge?.openPanel(open), { cls: 'place small' }));
    shops.append(c);
  }
  if (venues.length) out.push(shops);

  out.push(el('h2', '', 'Caravan'));
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
      grid.append(expandable(c, `deal:${o.id}`, () => dealDetails(o, s)));
    }
    out.push(grid);
  } else if (!s.marketBuilt) {
    out.push(el('div', 'hint', 'Build a Market Stall (Trade research, Medieval era) and caravans will visit every couple of days.'));
  } else if (s.nextCaravanHours !== null) {
    out.push(el('div', 'hint', `The next caravan is due in about ${Math.ceil(s.nextCaravanHours)} game hours.`));
  }

  // prices, the trade house and its routes (marketsPanel.ts)
  out.push(...renderMarkets(s, bridge));

  // the pens' herds: how many head of each, against the room (sim/livestock.ts)
  const pens = s.buildings.filter((b) => b.status === 'done' && HERDS[b.def]);
  out.push(el('h2', '', `Herds (${pens.length} ${pens.length === 1 ? 'pen' : 'pens'})`));
  if (!pens.length) out.push(el('div', 'hint', 'No pens yet. The town builds them once it learns Domestication, and buys its first animals from a drover.'));
  for (const b of pens) {
    const h = HERDS[b.def];
    const head = b.herd?.head ?? 0;
    const room = h.room + (b.wide ?? 0) * PEN_ROOM_PER_COL;
    const row = el('div', 'bar-row');
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.round(Math.min(1, head / Math.max(1, room)) * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'bar-label', BUILDING_BY_ID[b.def].name), bar, el('span', 'bar-text', head ? `${head} ${head === 1 ? h.animal : h.plural} of ${room}` : 'waiting for a drover'));
    out.push(row);
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

/** A deal's details: what each side is worth at the town's prices, what's in store of each, and how it comes out. */
function dealDetails(o: NonNullable<Snapshot['caravan']>['offers'][number], s: Snapshot): More[] {
  const at = new Map(s.markets?.prices.map((p) => [p.m, p.price]) ?? []);
  const worth = (st: Stock) => Math.round((Object.entries(st) as [Material, number][]).reduce((n, [m, k]) => n + (at.get(m) ?? WORTH[m] ?? 1) * k, 0));
  const have = (st: Stock) =>
    (Object.keys(st) as Material[])
      .map((m) => `${s.stock[m] ?? 0} ${MATERIAL_NAMES[m].toLowerCase()}`)
      .join(', ');
  const give = worth(o.wants);
  const get = o.horse ? 0 : worth(o.gives);
  return [
    facts([
      ['You give', `${list(o.wants)} (worth about ${give} coins)`],
      ['In store now', have(o.wants)],
      ['You get', o.horse ? 'a horse: it carries for a party and speeds it on the road' : `${list(o.gives)} (worth about ${get} coins)`],
      ['Already have', o.horse ? `${s.horses.length} horse${s.horses.length === 1 ? '' : 's'}, stalls for ${s.stalls}` : have(o.gives)],
      ['Comes out', o.horse ? null : get >= give ? `about ${get - give} coins ahead` : `about ${give - get} coins behind`],
    ]),
    "Yours to take first. Once the caravan has been here half its stay, the town takes the deals it wants itself: goods it's short of, paid for with what it can spare.",
  ];
}
