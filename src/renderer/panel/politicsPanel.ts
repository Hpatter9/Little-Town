// The Town menu's Council tab (sim/politics.ts): the four blocs and how each feels about the town's rule, who's in
// them and what they'd ask the council for; the laws in force and the rest; the latest votes, crimes, trials and
// strikes. The council decides for itself; the player answers its votes, trials and revolts in the event box.

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { expandable, facts } from './details';

const word = (n: number) => (n >= 75 ? 'Content' : n >= 55 ? 'Settled' : n >= 40 ? 'Grumbling' : n >= 25 ? 'Angry' : 'Furious');
const MARK: Record<string, string> = { vote: '⚖', crime: '🗝', trial: '⚖', strike: '✊', revolt: '🔥', law: '📜' };

export function politicsSection(s: Snapshot): HTMLElement[] {
  const pol = s.politics;
  if (!pol) return [];
  const out: HTMLElement[] = [el('h2', '', 'The council')];
  out.push(el('div', 'hint', 'The town governs itself: the council meets every few days and votes on what its unhappiest bloc asks for. You may let a vote stand or overrule it, and you pass sentence at trials.'));
  if (pol.strike) out.push(el('div', 'hint strike-line', `✊ ${pol.strike.bloc} are on strike before the seat (${pol.strike.hours} h more).`));
  const grid = el('div', 'cards');
  for (const b of pol.blocs) {
    const c = el('div', `card bloc${b.striking ? ' striking' : ''}`);
    c.style.borderLeft = `4px solid ${b.colour}`;
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', b.name), el('span', 'card-size', `${b.members.length} · ${word(b.sat)}`));
    c.append(top);
    const bar = el('div', 'favour');
    const fill = el('div', `favour-fill ${b.sat >= 50 ? 'up' : 'down'}`);
    fill.style.width = `${Math.abs(b.sat - 50)}%`;
    fill.style[b.sat >= 50 ? 'left' : 'right'] = '50%';
    bar.append(fill);
    c.append(bar);
    if (b.wants) c.append(el('div', 'hint', `Would call for ${b.wants}.`));
    grid.append(
      expandable(c, `bloc:${b.id}`, () => [
        el('div', 'purpose', b.who),
        facts([
          ['Satisfaction', `${b.sat} of 100`],
          ['Heading for', `${b.target}`],
          ['Members', b.members.join(', ') || 'none'],
        ]),
      ]),
    );
  }
  out.push(grid);

  out.push(el('h2', '', 'Laws'));
  out.push(el('div', 'hint', `The tax is ${pol.tax}. ${pol.laws.filter((l) => l.on).length ? '' : 'No laws are in force yet.'}`));
  const laws = el('div', 'cards');
  for (const l of [...pol.laws].sort((a, b) => Number(b.on) - Number(a.on))) {
    const c = el('div', `card law${l.on ? ' on' : ' off'}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${l.on ? '📜 ' : ''}${l.name}`), el('span', 'card-size', l.on ? 'In force' : 'Not passed'));
    c.append(top, el('div', 'purpose', l.does));
    laws.append(
      expandable(c, `law:${l.id}`, () => [
        facts([
          ['For it', l.for.join(', ') || 'nobody'],
          ['Against it', l.against.join(', ') || 'nobody'],
        ]),
      ]),
    );
  }
  out.push(laws);

  out.push(el('h2', '', 'Crime and trials'));
  out.push(el('div', 'hint', `${pol.crimes} crime${pol.crimes === 1 ? '' : 's'} so far, ${pol.caught} caught. Poverty and unhappiness breed it; guards, a curfew and harsh law keep it down.`));
  if (!pol.log.length) out.push(el('p', 'empty', 'Nothing yet.'));
  for (const e of pol.log) out.push(el('div', `sign ${e.kind}`, `${MARK[e.kind] ?? ''} Day ${e.day}: ${e.text}`));
  return out;
}
