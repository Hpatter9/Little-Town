// The Hall of Legends (the Chronicle's Legends tab) and the New Town screen's choice of a line: the towns gone by,
// kept on the device (renderer/legends.ts, sim/legacy.ts).

import { ITEM_BY_ID } from '../../shared/data/items';
import { ORIGIN_DEFS } from '../../shared/data/origins';
import { legendLine, type Legend } from '../../shared/sim/legacy';
import { readLegends } from '../legends';
import { el } from './dom';
import { expandable, facts } from './details';

const FATE = { fell: 'Fell', won: 'Triumphed', retired: 'Set aside' } as const;

export function renderLegends(): HTMLElement[] {
  const all = readLegends().reverse();
  const out: HTMLElement[] = [el('h2', '', 'Hall of Legends')];
  if (!all.length) return [...out, el('p', 'empty', 'No town has passed into legend yet. When this one falls, or you found another, it will be remembered here, and a descendant may found the next.')];
  out.push(el('div', 'hint', 'Towns gone by. A new town may be founded by a descendant of any of them (New Town, the last step).'));
  const grid = el('div', 'cards');
  for (const l of all) grid.append(legendCard(l));
  out.push(grid);
  return out;
}

export function legendCard(l: Legend, picked?: boolean, onPick?: () => void): HTMLElement {
  const c = el(onPick ? 'button' : 'div', `card legend${onPick ? ' pick' : ''}${picked ? ' on' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${l.founder}${l.generation > 1 ? ` (${l.generation}th of the line)`.replace('2th', '2nd').replace('3th', '3rd') : ''}`), el('span', 'card-size', picked ? 'Chosen' : FATE[l.fate]));
  c.append(top, el('div', 'purpose', `${ORIGIN_DEFS[l.origin]?.name ?? l.origin}${l.of ? ` · of ${l.of}` : ''} · ${legendLine(l)}`));
  if (l.heirloom && ITEM_BY_ID[l.heirloom]) c.append(el('div', 'hint', `Heirloom: ${ITEM_BY_ID[l.heirloom].name}`));
  if (onPick) {
    c.addEventListener('click', onPick);
    return c;
  }
  return expandable(c, `legend:${l.id}`, () => [
    facts([
      ['Lasted', `${l.days} days`],
      ['Ended', new Date(l.ended).toLocaleDateString()],
      ['Renown', `${l.renown}`],
      ...l.heroes.map((h): [string, string] => [h.fell ? `${h.name} †` : h.name, `${h.calling ?? 'no calling'}, level ${h.level}${h.felled ? `, ${h.felled} felled` : ''}`]),
    ]),
  ]);
}
