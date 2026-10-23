// The founder's card (the player's character): their portrait, name, calling, purse, gear, health and what they are
// doing (the "Now" line, panel/founderNow.ts) and the order they're set to, then four big buttons that each open a small sheet: Orders (go to, work at, give, rest), Shops, People
// (visitors, apprentices, matches, the heir) and Feast (sim/founder.ts). Go to is done on the map: tap a building,
// then "Send the founder here" (main.ts).

import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../../shared/data/items';
import { JOB_NAMES } from '../../shared/data/people';
import { GIVE_STEPS } from '../../shared/sim/founder';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { Bridge } from '../../shared/ipc';
import { itemIcon } from '../art/icons';
import { button, el } from './dom';
import { founderNow, type FounderNow } from './founderNow';
import { face, founderCharacter, founderCharacterKey } from './townsfolkPanel';

/** The redraw key: anything the card shows or a button changes. */
export function founderKey(s: Snapshot): string {
  return `${sheet}|${keyOfCard(s)}|${founderCharacterKey(s)}`;
}

/** Which sheet of the card is open (kept while the panel redraws). */
type Sheet = 'home' | 'orders' | 'shops' | 'people' | 'feast';
let sheet: Sheet = 'home';

function keyOfCard(s: Snapshot): string {
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f || !s.founder) return 'none';
  return [f.name, f.clsName, f.level, Math.round(f.hp), f.maxHp, Math.round(f.morale), f.coins, nowKey(founderNow(f, s.founder, s.muster)), s.founder.order, s.founder.winds.map((w) => (w.open ? 1 : 0)).join(''), s.founder.heir?.id, s.founder.heir?.named, s.founder.heirs.map((h) => h.id).join(','), s.founder.shops.map((x) => [x.id, x.manager?.id, x.stock, x.price, x.today, x.last, x.seasonNet].join(':')).join(';'), s.founder.buyable.map((x) => `${x.id}:${x.price}`).join(','), s.founder.hires.map((h) => h.id).join(','), Object.values(f.gear).join(','), s.coins, dealingsKey(s)].join('|');
}

/** The founder's Character tab: their character sheet (portrait, bars, calling and titles, story, skills, kin, kit) and
 *  the older pages with every detail (gear, stat points, the calling's road), the same as the People tab draws for
 *  anyone else (townsfolkPanel.ts). The founder isn't on the People list: this is where they are. */
export function renderFounderCharacter(s: Snapshot, bridge: Bridge, redraw: () => void): HTMLElement[] {
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f) return [];
  return [el('h2', '', 'Character'), ...founderCharacter(f, s, bridge, redraw)];
}

const nowKey = (n: FounderNow): string => `${n.icon}${n.now}/${n.set ?? ''}`;

/** The "Now" line (an icon and what they're doing) and, under it, what they're set to when that's something else. */
function nowLines(n: FounderNow): HTMLElement[] {
  const line = el('div', 'founder-now');
  line.style.cssText = 'display:flex;gap:6px;align-items:baseline;margin-top:2px';
  line.append(el('span', '', n.icon), el('span', '', n.now));
  if (!n.set) return [line];
  return [line, el('div', 'hint founder-set', `Set to: ${n.set}`)];
}

const dealingsKey = (s: Snapshot): string => {
  const d = s.founder?.dealings;
  return d ? [d.visitor?.name, d.children.map((c) => `${c.id}:${c.master}`).join(','), d.masters.map((m) => m.id).join(','), d.matches.map((m) => m.id).join(','), d.feasts.map((x) => `${x.grade}:${x.wait}:${x.cost}`).join(',')].join('/') : '';
};

export function renderFounder(s: Snapshot, bridge: Bridge, redraw: () => void = () => {}): HTMLElement[] {
  const f = s.people.find((p) => p.id === s.mainId);
  const v = s.founder;
  if (!f || !v) return [el('p', 'empty', 'There is no founder.')];
  const out: HTMLElement[] = [];
  const row = () => {
    const r = el('div');
    r.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    return r;
  };
  /** Buttons on this card are tall enough for a thumb. */
  const tall = (b: HTMLButtonElement) => {
    b.style.minHeight = '44px';
    return b;
  };
  const go = (to: Sheet) => () => {
    sheet = to;
    redraw();
  };
  const d = v.dealings;
  const now = founderNow(f, v, s.muster);

  if (sheet !== 'home') {
    out.push(tall(button('‹ Back', go('home'))));
    if (sheet === 'orders') out.push(...orders());
    else if (sheet === 'shops') out.push(...shops());
    else if (sheet === 'people') out.push(...people());
    else out.push(...feast());
    return out;
  }

  const head = el('div', 'founder-head');
  head.style.cssText = 'display:flex;gap:12px;align-items:center';
  const who = el('div');
  who.append(el('b', '', f.name), el('div', 'hint', f.clsName ? `${f.clsName} · level ${f.level}` : f.typeName));
  head.append(face(f, s), who);
  out.push(head, ...nowLines(now));
  out.push(el('div', 'lock', `Health ${Math.round(f.hp)}/${f.maxHp} · Morale ${Math.round(f.morale)} · Purse ${f.coins ?? 0} coins`));

  // what they wear and carry, on one line (a tap on an item is the item's own card, where the gear is changed)
  const kit = el('div', 'founder-kit');
  kit.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:6px 0';
  for (const slot of SLOTS) {
    const id = f.gear[slot];
    const def = id ? ITEM_BY_ID[id] : undefined;
    if (!def) continue;
    const g = el('span', 'founder-gear');
    g.title = SLOT_NAMES[slot];
    g.style.cssText = 'display:inline-flex;gap:4px;align-items:center';
    g.append(itemIcon(def, 1), el('small', '', def.name));
    kit.append(g);
  }
  if (!kit.childElementCount) kit.append(el('div', 'hint', 'Nothing worn or carried yet.'));
  out.push(kit);

  const grid = el('div', 'founder-menu');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px';
  const big = (label: string, note: string, to: Sheet) => {
    const b = button('', go(to));
    b.style.cssText = 'min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px';
    b.append(el('b', '', label), el('small', '', note));
    return b;
  };
  const waiting = d.visitor ? `${d.visitor.name} at the gate` : v.heir ? `Heir: ${v.heir.name}` : 'No heir named';
  grid.append(
    big('Orders', v.order ? 'Change the order' : 'Work, rest, give', 'orders'),
    big('Shops', v.shops.length ? `${v.shops.length} owned` : 'None owned yet', 'shops'),
    big('People', waiting, 'people'),
    big('Feast', d.feasts.some((x) => x.wait <= 0) ? 'Ready to host' : 'Not just now', 'feast'),
  );
  out.push(grid);
  return out;

  function orders(): HTMLElement[] {
    const o: HTMLElement[] = [el('h2', '', 'Orders'), ...nowLines(now)];
    if (!now.set && v!.order) o.push(el('div', 'hint founder-set', `Set to: ${v!.order.charAt(0).toLowerCase()}${v!.order.slice(1)}`));
    o.push(el('div', 'hint', 'Go to: tap a building on the map, then “Send the founder here”.'));
    o.push(tall(button('Back to the map', () => bridge.closePanel?.())));
    o.push(el('div', 'hint', 'Work at: pick a job for the day. If there is none to do, they carry on as usual.'));
    const jobs = row();
    for (const j of v!.jobs) jobs.append(tall(button(JOB_NAMES[j], () => bridge.command({ type: 'founderWork', job: j }))));
    if (v!.order?.startsWith('Working')) jobs.append(tall(button('The town’s choice', () => bridge.command({ type: 'founderWork', job: null }))));
    o.push(jobs);
    o.push(el('div', 'hint', 'Explore: spend the day pushing back the fog toward a quarter. The land’s dangers are yours to meet.'));
    const winds = row();
    for (const w of v!.winds) winds.append(tall(button(w.name[0].toUpperCase() + w.name.slice(1), () => bridge.command({ type: 'founderExplore', dir: w.dir }), { disabled: !w.open })));
    if (v!.order?.startsWith('Exploring')) winds.append(tall(button('The town’s choice', () => bridge.command({ type: 'founderExplore', dir: null }))));
    o.push(winds);
    o.push(el('div', 'hint', `Give to the town (it holds ${s.coins ?? 0} coins):`));
    const gifts = row();
    for (const n of GIVE_STEPS) gifts.append(tall(button(`${n} coins`, () => bridge.command({ type: 'founderGive', amount: n }), { disabled: (f!.coins ?? 0) < 1 })));
    o.push(gifts);
    o.push(el('div', 'hint', 'Rest: go home to heal and lift their spirits.'));
    o.push(tall(button('Rest at home', () => bridge.command({ type: 'founderRest' }))));
    return o;
  }

  function shops(): HTMLElement[] {
    const o: HTMLElement[] = [el('h2', '', 'Your shops')];
    if (!v!.shops.length) o.push(el('div', 'hint', 'You own no shop yet. Buy one below, then hire a manager or work the counter yourself.'));
    const PRICE_NAMES = { low: 'Low', fair: 'Fair', high: 'High' } as const;
    for (const x of v!.shops) {
      const card = el('div', 'founder-shop');
      card.style.cssText = 'border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:8px;margin:6px 0;display:flex;flex-direction:column;gap:6px';
      card.append(el('b', '', x.name));
      card.append(el('div', 'hint', x.manager ? `Manager: ${x.manager.self ? 'you, at the counter' : `${x.manager.name} (${x.manager.wage} coins a day)`}` : 'No manager: the shop is shut.'));
      card.append(el('div', 'hint', `Today ${x.today} coins · last day’s profit ${x.last} · this season ${x.seasonGross} taken, ${x.seasonNet} profit.`));
      const stocks = row();
      for (const l of x.stocks) stocks.append(tall(button(`${l.name}${l.id === x.stock ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopStock', building: x.id, stock: l.id }))));
      card.append(el('div', 'hint', 'Stock'), stocks);
      const prices = row();
      for (const p of ['low', 'fair', 'high'] as const) prices.append(tall(button(`${PRICE_NAMES[p]}${p === x.price ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopPrice', building: x.id, price: p }))));
      card.append(el('div', 'hint', 'Price: low draws more customers; high earns more a sale and the town grumbles.'), prices);
      const staff = row();
      staff.append(tall(button(x.manager?.self ? 'Working the counter ✓' : 'Work the counter myself', () => bridge.command({ type: 'founderShopManager', building: x.id, person: v!.id }))));
      for (const h of v!.hires) staff.append(tall(button(`Hire ${h.name} (${h.wage}/day)${x.manager?.id === h.id ? ' ✓' : ''}`, () => bridge.command({ type: 'founderShopManager', building: x.id, person: h.id }))));
      if (x.manager) staff.append(tall(button('Shut the shop', () => bridge.command({ type: 'founderShopManager', building: x.id, person: null }))));
      card.append(el('div', 'hint', 'Manager'), staff);
      o.push(card);
    }
    o.push(el('div', 'hint', 'For sale:'));
    if (!v!.buyable.length) o.push(el('div', 'hint', 'No shop, tavern or stall in town is for sale.'));
    const buy = row();
    for (const b of v!.buyable) buy.append(tall(button(`${b.name}: ${b.price} coins`, () => bridge.command({ type: 'founderBuyShop', building: b.id }), { disabled: (f!.coins ?? 0) < b.price })));
    o.push(buy);
    return o;
  }

  function people(): HTMLElement[] {
    const o: HTMLElement[] = [el('h2', '', 'People')];
    o.push(el('div', 'hint', v!.heir ? `Your heir: ${v!.heir.name}${v!.heir.named ? ' (named)' : ''}. With no grown child, partner or named heir, the game ends when you die.` : 'You have no heir. With no grown child, partner or named heir, the game ends when you die.'));
    const heirs = row();
    for (const h of v!.heirs.slice(0, 12)) {
      const named = v!.heir?.named && v!.heir.id === h.id;
      heirs.append(tall(button(`${h.name}${h.role === 'other' ? '' : ` (${h.role === 'child' ? 'child' : 'partner'})`}${named ? ' ✓' : ''}`, () => bridge.command({ type: 'founderHeir', person: named ? null : h.id }))));
    }
    if (!v!.heirs.length) heirs.append(el('div', 'hint', 'Nobody grown to name.'));
    o.push(el('div', 'hint', 'Name an heir:'), heirs);
    if (d.visitor) {
      o.push(el('div', 'hint', `${d.visitor.name} waits at the gate. Ask a price, or a favour; a price may give offence.`));
      const terms = row();
      terms.append(tall(button(`Ask ${d.visitor.fee} coins`, () => bridge.command({ type: 'founderVisitor', terms: 'fee' }))), tall(button('Ask a favour', () => bridge.command({ type: 'founderVisitor', terms: 'favour' }))));
      o.push(terms);
    }
    for (const c of d.children) {
      o.push(el('div', 'hint', `${c.name}: ${c.master ? `apprenticed to ${c.master} (${c.trade ?? 'a trade'})` : 'no master yet'}`));
      const picks = row();
      for (const m of d.masters) if (m.name !== c.master) picks.append(tall(button(`${m.id === v!.id ? 'Yourself' : m.name} (${m.trade} ${m.level})`, () => bridge.command({ type: 'founderApprentice', child: c.id, master: m.id }))));
      o.push(picks);
    }
    o.push(el('div', 'hint', 'Matches: put candidates to you or a grown child. They may refuse.'));
    const matches = row();
    for (const m of d.matches) matches.append(tall(button(m.self ? 'Court someone' : `Find a match for ${m.name}`, () => bridge.command({ type: 'founderMatch', person: m.id }))));
    if (!d.matches.length) matches.append(el('div', 'hint', 'Nobody unwed has a candidate right now.'));
    o.push(matches);
    return o;
  }

  function feast(): HTMLElement[] {
    const o: HTMLElement[] = [el('h2', '', 'Host a feast')];
    o.push(el('div', 'hint', 'The town gathers to eat and dance. It lifts spirits and your renown and eats from the stores, and trouble may follow. Paid from your purse, then the treasury.'));
    const feasts = row();
    for (const x of d.feasts) feasts.append(tall(button(`${x.grade === 'feast' ? 'A feast' : 'A festival'}: ${x.cost} coins${x.wait ? ` (in ${x.wait}h)` : ''}`, () => bridge.command({ type: 'founderFeast', grade: x.grade }), { disabled: x.wait > 0 })));
    o.push(feasts);
    return o;
  }
}
