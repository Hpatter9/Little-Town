// The founder's card (the player's character): their portrait, name, calling, purse, gear, health and what they are
// doing, and five actions: Go to, Work at, Give to the town, Rest and Name an heir (sim/founder.ts). Go to is done on
// the map: tap a building, then "Send the founder here" (main.ts).

import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../../shared/data/items';
import { JOB_NAMES } from '../../shared/data/people';
import { GIVE_STEPS } from '../../shared/sim/founder';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { Bridge } from '../../shared/ipc';
import { itemIcon } from '../art/icons';
import { button, el } from './dom';
import { face } from './townsfolkPanel';

/** The redraw key: anything the card shows or a button changes. */
export function founderKey(s: Snapshot): string {
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f || !s.founder) return 'none';
  return [f.name, f.clsName, f.level, Math.round(f.hp), f.maxHp, Math.round(f.morale), f.coins, f.doing, s.founder.order, s.founder.heir?.id, s.founder.heir?.named, s.founder.heirs.map((h) => h.id).join(','), s.founder.shops.map((x) => [x.id, x.manager?.id, x.stock, x.price, x.today, x.last, x.seasonNet].join(':')).join(';'), s.founder.buyable.map((x) => `${x.id}:${x.price}`).join(','), s.founder.hires.map((h) => h.id).join(','), Object.values(f.gear).join(','), s.coins].join('|');
}

export function renderFounder(s: Snapshot, bridge: Bridge): HTMLElement[] {
  const f = s.people.find((p) => p.id === s.mainId);
  const v = s.founder;
  if (!f || !v) return [el('p', 'empty', 'There is no founder.')];
  const out: HTMLElement[] = [];

  const head = el('div', 'founder-head');
  head.style.cssText = 'display:flex;gap:12px;align-items:center';
  const who = el('div');
  who.append(el('b', '', f.name), el('div', 'hint', f.clsName ? `${f.clsName} · level ${f.level}` : f.typeName), el('div', '', f.doing));
  head.append(face(f, s), who);
  out.push(head);

  out.push(el('div', 'lock', `Health ${Math.round(f.hp)}/${f.maxHp} · Morale ${Math.round(f.morale)} · Purse ${f.coins ?? 0} coins`));
  if (v.order) out.push(el('div', 'hint', `Told to: ${v.order.charAt(0).toLowerCase()}${v.order.slice(1)}.`));

  const kit = el('div', 'founder-kit');
  for (const slot of SLOTS) {
    const id = f.gear[slot];
    const def = id ? ITEM_BY_ID[id] : undefined;
    if (!def) continue;
    const row = el('div', 'founder-gear');
    row.style.cssText = 'display:flex;gap:6px;align-items:center';
    row.append(itemIcon(def, 1), el('span', '', def.name), el('small', '', SLOT_NAMES[slot]));
    kit.append(row);
  }
  if (!kit.childElementCount) kit.append(el('div', 'hint', 'Nothing worn or carried yet.'));
  out.push(el('h2', '', 'Gear'), kit);

  out.push(el('h2', '', 'Go to'));
  out.push(el('div', 'hint', 'Tap a building on the map, then “Send the founder here”.'));
  out.push(button('Back to the map', () => bridge.closePanel?.()));

  out.push(el('h2', '', 'Work at'));
  out.push(el('div', 'hint', 'Pick a job for the day. If there is none to do, they carry on as usual.'));
  const jobs = el('div', 'founder-jobs');
  jobs.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const j of v.jobs) jobs.append(button(JOB_NAMES[j], () => bridge.command({ type: 'founderWork', job: j })));
  if (v.order?.startsWith('Working')) jobs.append(button('The town’s choice', () => bridge.command({ type: 'founderWork', job: null })));
  out.push(jobs);

  out.push(el('h2', '', 'Give to the town'));
  out.push(el('div', 'hint', `The treasury holds ${s.coins ?? 0} coins.`));
  const gifts = el('div', 'founder-gifts');
  gifts.style.cssText = 'display:flex;gap:6px';
  for (const n of GIVE_STEPS) gifts.append(button(`${n} coins`, () => bridge.command({ type: 'founderGive', amount: n }), { disabled: (f.coins ?? 0) < 1 }));
  out.push(gifts);

  out.push(el('h2', '', 'Rest'));
  out.push(el('div', 'hint', 'Go home to heal and lift their spirits.'));
  out.push(button('Rest at home', () => bridge.command({ type: 'founderRest' })));

  out.push(el('h2', '', 'Your shops'));
  if (!v.shops.length) out.push(el('div', 'hint', 'You own no shop yet. Buy one below, hire a manager or work the counter yourself.'));
  const PRICE_NAMES = { low: 'Low', fair: 'Fair', high: 'High' } as const;
  for (const x of v.shops) {
    const card = el('div', 'founder-shop');
    card.style.cssText = 'border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:8px;margin:6px 0;display:flex;flex-direction:column;gap:6px';
    card.append(el('b', '', x.name));
    card.append(el('div', 'hint', x.manager ? `Manager: ${x.manager.self ? 'you, at the counter' : `${x.manager.name} (${x.manager.wage} coins a day)`}` : 'No manager: the shop is shut.'));
    card.append(el('div', 'hint', `Takings today ${x.today} coins · last day’s profit ${x.last} · this season ${x.seasonGross} taken, ${x.seasonNet} profit.`));
    const stocks = el('div', 'founder-stock');
    stocks.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    for (const l of x.stocks) stocks.append(button(`${l.name}${l.id === x.stock ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopStock', building: x.id, stock: l.id })));
    card.append(el('div', 'hint', 'Stock'), stocks);
    const prices = el('div', 'founder-price');
    prices.style.cssText = 'display:flex;gap:6px';
    for (const p of ['low', 'fair', 'high'] as const) prices.append(button(`${PRICE_NAMES[p]}${p === x.price ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopPrice', building: x.id, price: p })));
    card.append(el('div', 'hint', 'Price: low draws more customers and pleases the town; high earns more a sale and the town grumbles.'), prices);
    const staff = el('div', 'founder-manager');
    staff.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    staff.append(button(x.manager?.self ? 'Working the counter ✓' : 'Work the counter myself', () => bridge.command({ type: 'founderShopManager', building: x.id, person: v.id })));
    for (const h of v.hires) staff.append(button(`Hire ${h.name} (${h.wage}/day)${x.manager?.id === h.id ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopManager', building: x.id, person: h.id })));
    if (x.manager) staff.append(button('Shut the shop', () => bridge.command({ type: 'founderShopManager', building: x.id, person: null })));
    card.append(el('div', 'hint', 'Manager'), staff);
    out.push(card);
  }
  out.push(el('h2', '', 'Buy a shop'));
  if (!v.buyable.length) out.push(el('div', 'hint', 'No shop, tavern or stall in town is for sale.'));
  const buy = el('div', 'founder-buy');
  buy.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const b of v.buyable) buy.append(button(`${b.name}: ${b.price} coins`, () => bridge.command({ type: 'founderBuyShop', building: b.id }), { disabled: (f.coins ?? 0) < b.price }));
  out.push(buy);

  out.push(el('h2', '', 'Name an heir'));
  out.push(el('div', 'hint', v.heir ? `${v.heir.name} would lead after you${v.heir.named ? ' (named)' : ''}. With no grown child, partner or named heir, the game ends when you die.` : 'You have no heir. With no grown child, partner or named heir, the game ends when you die.'));
  const heirs = el('div', 'founder-heirs');
  heirs.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const h of v.heirs.slice(0, 12)) {
    const named = v.heir?.named && v.heir.id === h.id;
    heirs.append(button(`${h.name}${h.role === 'other' ? '' : ` (${h.role === 'child' ? 'child' : 'partner'})`}${named ? ' ✓' : ''}`, () => bridge.command({ type: 'founderHeir', person: named ? null : h.id })));
  }
  if (!v.heirs.length) heirs.append(el('div', 'hint', 'No grown-ups to name.'));
  out.push(heirs);
  return out;
}
