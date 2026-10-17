// The year's festivals (the Chronicle's Festivals tab; sim/festivals.ts): what's coming next and how ready the town is
// for it, then the four of the town's people, a card a season with its lore, what's made for it, its god, its song,
// what it leaves behind, and how it went last time. Nothing to do here: the town keeps them itself.

import type { FestivalsView } from '../../shared/sim/festivals';
import { el } from './dom';
import { cardLink } from './infoCard';
import { expandable, facts } from './details';

const SEASON_MARK: Record<string, string> = { spring: '🌱', summer: '☀', autumn: '🍂', winter: '❄' };
const OUTCOME: Record<string, string> = { held: 'Held with all it needed', poor: 'Held, but poorly ready', skipped: 'Skipped for want of food', missed: 'Missed' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function bar(done: number, of: number): HTMLElement {
  const b = el('div', 'bar');
  const f = el('div', 'bar-fill');
  f.style.width = `${Math.round((100 * done) / Math.max(1, of))}%`;
  b.append(f);
  return b;
}

/** A key for the panel's redraws (panel.ts). */
export const festivalsKey = (v: FestivalsView | undefined) =>
  !v ? '' : `${v.next.id}${v.next.days}${v.next.phase}${v.next.food.join('.')}${v.next.ware.join('.')}${v.on?.phase ?? ''}${v.calendar.map((r) => r.last?.outcome ?? '').join(',')}`;

export function renderFestivals(v: FestivalsView | undefined): HTMLElement[] {
  if (!v) return [el('p', 'empty', 'No festivals yet.')];
  const out: HTMLElement[] = [];
  const n = v.next;
  const row = v.calendar.find((r) => r.id === n.id);
  out.push(el('h2', '', 'Coming next'));
  const c = el('div', 'card festival-next');
  const top = el('div', 'card-top');
  const when = n.phase === 'held' ? 'Under way now' : n.days <= 0 ? 'Today' : n.days === 1 ? 'Tomorrow' : `In ${n.days} days`;
  const name = el('span', 'card-name', `${SEASON_MARK[row?.season ?? 'spring']} `);
  name.append(cardLink(n.name, { kind: 'festival', id: n.id })); // (its card: infoCard.ts)
  top.append(name, el('span', 'card-size', when));
  c.append(top);
  if (row) c.append(el('div', 'hint', row.lore));
  c.append(
    el('div', 'hint', n.phase === 'coming' ? (n.prepIn > 0 ? `The town starts making ready in ${n.prepIn} day${n.prepIn === 1 ? '' : 's'}.` : 'The town starts making ready tomorrow.') : n.phase === 'prep' ? 'The town is making ready: the spot is dressed round the fire, and the fire\'s cooks and crafters are at work.' : n.phase === 'day' ? 'Today: travellers are coming in, and the town gathers round the fire this evening.' : 'The town is gathered round the fire.'),
  );
  if (row) {
    const made = el('div', 'festival-made');
    made.append(el('span', '', `${row.food}: ${n.food[0]} of ${n.food[1]}`), bar(n.food[0], n.food[1]), el('span', '', `${row.ware}: ${n.ware[0]} of ${n.ware[1]}`), bar(n.ware[0], n.ware[1]));
    c.append(made);
  }
  out.push(c);
  out.push(el('h2', '', 'The year\'s festivals'));
  out.push(el('div', 'hint', 'Each season\'s festival falls on its seventh day. The town makes ready for three days before it, and keeps it by itself: if the stores can\'t spare the food, it is skipped, and the town and its god are sore.'));
  for (const r of v.calendar) {
    const card = el('div', `card festival-card${r.id === n.id ? ' next' : ''}`);
    const t = el('div', 'card-top');
    t.append(el('span', 'card-name', `${SEASON_MARK[r.season]} ${r.name}`), el('span', 'card-size', `${cap(r.season)}, day ${r.day}`));
    card.append(t, el('div', 'hint', r.last ? `Last: ${OUTCOME[r.last.outcome]} (year ${r.last.year})${r.last.coins ? `, ${r.last.coins} coins from the visitors` : ''}.` : 'Not yet kept.'));
    out.push(
      expandable(card, `festival:${r.id}`, () => [
        el('p', '', r.lore),
        facts([
          ['Food', r.food],
          ['Ware', r.ware],
          ['God', r.god],
          ['Its song', r.song],
          ['Leaves', r.boon],
        ]),
      ]),
    );
  }
  return out;
}
