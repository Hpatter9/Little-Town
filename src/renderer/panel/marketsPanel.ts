// The Market menu's Prices and Trade house tabs (sim/markets.ts `marketView`, `snapshot.markets`): today's prices with
// their moves, the booms, shortages, gluts and crashes under way, the trade house (its standing, what the next tier
// brings, a loan owing, a bust), its routes to the powers (what each makes and wants, the road, the wagon on it, the
// profit so far; close or open), and the house's ledger of runs.

import type { Bridge } from '../../shared/ipc';
import type { MarketView } from '../../shared/sim/markets';
import type { Snapshot } from '../../shared/sim/snapshot';
import { expandable, facts } from './details';
import { button, el } from './dom';

const SWING_MARK = { boom: '📈', shortage: '⚠', glut: '📉', crash: '💥' } as const;
const SWING_NAME = { boom: 'Boom', shortage: 'Shortage', glut: 'Glut', crash: 'Crash' } as const;

export const marketsKey = (s: Snapshot) => {
  const m = s.markets;
  return m ? JSON.stringify([m.prices.map((p) => [p.m, p.price, p.change, p.swing]), m.swings, m.house, m.routes, m.log[0]]) : '';
};

export function renderMarkets(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const m = s.markets;
  const out: HTMLElement[] = [el('h2', '', 'Prices')];
  if (!m) {
    out.push(el('div', 'hint', 'No market yet. Once the town opens a trading post or a market stall, its goods have prices that move with supply, distance and war, and its own trade house sends wagons to the powers of the realm.'));
    return out;
  }
  out.push(el('div', 'hint', 'What a unit of each good fetches today, and how it moved since yesterday. Selling a lot of something brings its price down; buying raises it. War makes arms and food dear, winter makes food dearer, and booms and shortages come and go.'));
  out.push(...swingCards(m));
  const grid = el('div', 'price-grid');
  for (const p of m.prices.slice(0, 30)) {
    const ratio = p.price / p.worth;
    const cell = el('div', `price${p.swing ? ` ${p.swing}` : ''}${ratio >= 1.25 ? ' dear' : ratio <= 0.8 ? ' cheap' : ''}`);
    const arrow = p.change > 1 ? `▲${p.change}%` : p.change < -1 ? `▼${-p.change}%` : '–';
    cell.append(el('span', 'price-name', `${p.swing ? `${SWING_MARK[p.swing]} ` : ''}${p.name}`), el('span', 'price-now', `${p.price}`), el('span', `price-move ${p.change > 1 ? 'up' : p.change < -1 ? 'down' : ''}`, arrow));
    cell.title = `${p.name}: ${p.price} coins a unit (worth ${p.worth} in a quiet market). ${p.stock} in store.`;
    grid.append(cell);
  }
  out.push(grid);

  // the trade house
  const h = m.house;
  out.push(el('h2', '', 'Trade house'));
  const card = el('div', `card house tier-${h.level}${h.bustDays !== null ? ' bust' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${h.level >= 4 ? '♛ ' : '⚖ '}${h.tier}`), el('span', 'card-size', `standing ${h.standing}`));
  card.append(top);
  if (h.next && h.nextAt !== null) {
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.round(Math.min(1, h.standing / h.nextAt) * 100)}%`;
    bar.append(fill);
    const row = el('div', 'bar-row');
    row.append(el('span', 'bar-label', 'Next'), bar, el('span', 'bar-text', `${h.next} at ${h.nextAt}`));
    card.append(row);
  } else card.append(el('div', 'purpose', 'A merchant power: the realm\'s markets bend to the town\'s trade, and its partners hold it in high regard.'));
  card.append(el('div', 'purpose', `${h.routes} route${h.routes > 1 ? 's' : ''} at once · wagons of ${h.load} · ${h.runs} runs, ${h.profit >= 0 ? `${h.profit} coins made` : `${-h.profit} coins lost`}`));
  if (h.bustDays !== null) card.append(el('div', 'lock', `Gone bust: no merchant will deal with the house for ${h.bustDays} more day${h.bustDays === 1 ? '' : 's'}.`));
  if (h.loan) card.append(el('div', `lock${h.loan.days <= 1 ? '' : ' short'}`, `Owes ${h.loan.owed} coins to the moneylenders of ${h.loan.from}: due in ${h.loan.days} day${h.loan.days === 1 ? '' : 's'}. Unpaid, the house goes bust.`));
  out.push(
    expandable(card, 'house', () => [
      facts([
        ['Haggling', h.haggle ? `${Math.round(h.haggle * 100)}% better prices both ways` : 'none yet'],
        ['Moneylenders', h.level ? 'will lend to fill a wagon' : 'won\'t lend to peddlers'],
        ['Gone bust', h.busts ? `${h.busts} time${h.busts > 1 ? 's' : ''}` : 'never'],
      ]),
      'Profit raises the house\'s standing and losses lower it. Peddlers become traders at 150, a merchant house at 600, a trade league at 1800 and a merchant power at 4500. A loan unpaid when due, or three losing runs in a row with a loan out, breaks the house: the moneylenders seize the treasury and the stores, and it begins again as peddlers.',
    ]),
  );

  out.push(el('h2', '', 'Trade routes'));
  if (!m.routes.length) out.push(el('div', 'hint', 'No routes yet: the house trades with the powers of the realm once their envoys have come.'));
  for (const r of m.routes) out.push(routeCard(r, bridge));
  if (m.log.length) {
    out.push(el('h2', '', 'Ledger of runs'));
    const ul = el('ul', 'log');
    for (const line of m.log) ul.append(el('li', '', line));
    out.push(ul);
  }
  return out;
}

function swingCards(m: MarketView): HTMLElement[] {
  return m.swings.map((w) => {
    const c = el('div', `card swing ${w.kind}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${SWING_MARK[w.kind]} ${SWING_NAME[w.kind]} in ${w.name.toLowerCase()}`), el('span', 'card-size', `×${w.mult} · ${w.days} day${w.days === 1 ? '' : 's'} left`));
    c.append(top, el('div', 'purpose', w.why.charAt(0).toUpperCase() + w.why.slice(1) + '.'));
    return c;
  });
}

function routeCard(r: MarketView['routes'][number], bridge: Bridge | undefined): HTMLElement {
  const c = el('div', `card route${r.open ? '' : ' shut'}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${r.wagon ? '🛒 ' : ''}${r.name}`), el('span', 'card-size', r.runs ? `${r.runs} run${r.runs > 1 ? 's' : ''} · ${r.profit >= 0 ? '+' : ''}${r.profit}` : `${r.hours}h each way`));
  c.append(top);
  if (r.wagon) {
    const w = r.wagon;
    c.append(el('div', 'purpose', w.phase === 'out' ? `A wagon on the way with ${w.carrying}${w.coins ? ` and ${w.coins} coins` : ''}: there in ${w.hours}h.` : w.phase === 'home' ? `Coming home with ${w.coins} coins${w.carrying !== 'nothing' ? ` and ${w.carrying}` : ''}: home in ${w.hours}h.` : 'Selling at their market.'));
  } else c.append(el('div', 'purpose', r.open ? `Makes ${r.makes.join(', ') || 'little'}; wants ${r.wants.join(', ')}.` : r.why ?? 'Closed'));
  if (r.stance !== 'war' && r.stance !== 'destroyed')
    c.append(button(r.closed ? 'Open the route' : 'Close the route', () => bridge?.command({ type: 'tradeRoute', to: r.to, open: r.closed }), { cls: 'place small quiet no-expand' }));
  return expandable(c, `route:${r.to}`, () => [
    facts([
      ['Standing with them', r.stance],
      ['The road', `${r.hours} hours each way`],
      ['They make (cheap there)', r.makes.join(', ') || 'nothing much'],
      ['They want (dear there)', r.wants.join(', ')],
      ['Runs', `${r.runs}, ${r.profit >= 0 ? `${r.profit} coins made` : `${-r.profit} lost`}`],
    ]),
    'The further the road, the more the town\'s goods fetch there, and the likelier robbers are. A power with no treaty takes a toll; a trade treaty or an alliance doesn\'t. At war, the road is shut and a wagon on it is seized.',
  ]);
}
