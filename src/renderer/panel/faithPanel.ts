// The Town menu's Faith tab (sim/faith.ts): the town's four gods, how each feels about it, what pleases and angers
// them, and the latest signs. The town keeps them itself; this is to watch.

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { expandable, facts } from './details';

const ICON: Record<string, string> = { harvest: '🌾', hearth: '🔥', war: '⚔', sky: '⛈' };

export function faithSection(s: Snapshot): HTMLElement[] {
  const f = s.faith;
  if (!f.on) return [];
  const out: HTMLElement[] = [el('h2', '', 'The gods')];
  out.push(
    el(
      'div',
      'hint',
      f.places.length
        ? `Worshipped at ${f.places.join(', ').toLowerCase()} (+${f.worship} favour a day to each god).${f.nextRite !== null ? ` Next rite ${f.nextRite ? `in ${f.nextRite} day${f.nextRite > 1 ? 's' : ''}` : 'today'}.` : ''}`
        : 'Nowhere to worship yet: the gods grow cold toward the town. It will raise a shrine itself.',
    ),
  );
  const grid = el('div', 'cards');
  for (const g of f.gods) {
    const c = el('div', `card god god-${g.mood.replace(' ', '-')}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${ICON[g.domain] ?? ''} ${g.name}`), el('span', 'card-size', g.mood));
    c.append(top, el('div', 'purpose', `${g.title.charAt(0).toUpperCase() + g.title.slice(1)}, keeper of ${g.keeps}`));
    const bar = el('div', 'favour');
    const fill = el('div', `favour-fill ${g.favour >= 0 ? 'up' : 'down'}`);
    fill.style.width = `${Math.abs(g.favour) / 2}%`;
    fill.style[g.favour >= 0 ? 'left' : 'right'] = '50%';
    bar.append(fill);
    c.append(bar);
    grid.append(
      expandable(c, `god:${g.domain}`, () => [
        facts([
          ['Favour', `${g.favour > 0 ? '+' : ''}${g.favour}`],
          ['Pleased', `${g.blessing}`],
          ['Angered', `${g.wrath}`],
          ['Offerings', g.offer],
        ]),
      ]),
    );
  }
  out.push(grid);
  out.push(el('h2', '', 'Signs from the gods'));
  if (!f.signs.length) out.push(el('p', 'empty', 'No sign yet.'));
  for (const g of f.signs) out.push(el('div', `sign ${g.kind}`, `Day ${g.day}: ${g.text}`));
  return out;
}
