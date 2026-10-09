// The Town menu's "Our ways" tab (sim/heritage.ts): each people's own system, for the town that has one. The town runs
// it itself; this is to watch: the druids' grove (its favour, guardians and rites), and the others as they come.

import type { HeritageView } from '../../shared/sim/heritage';
import type { Snapshot } from '../../shared/sim/snapshot';
import { expandable, facts } from './details';
import { el } from './dom';

export const heritageKey = (s: Snapshot) => JSON.stringify(s.heritage);

/** A bar from the middle: favour (−100..100) left in red, right in green. */
export function favourBar(v: number): HTMLElement {
  const bar = el('div', 'favour');
  const fill = el('div', `favour-fill ${v >= 0 ? 'up' : 'down'}`);
  fill.style.width = `${Math.min(100, Math.abs(v)) / 2}%`;
  fill.style[v >= 0 ? 'left' : 'right'] = '50%';
  bar.append(fill);
  return bar;
}

function logList(lines: string[]): HTMLElement {
  const ul = el('ul', 'log');
  for (const l of lines) ul.append(el('li', '', l));
  return ul;
}

export function heritageSection(s: Snapshot): HTMLElement[] {
  const h = s.heritage;
  if (!h) return [];
  return [...groveSection(h), ...courtSection(h), ...workSection(h)];
}

function groveSection(h: HeritageView): HTMLElement[] {
  const g = h.grove;
  if (!g) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the grove')];
  out.push(el('div', 'hint', 'The grove is alive, and it remembers. Felling the wild angers it; letting the woods grow back, and keeping the rites at the turn of each season, pleases it. Pleased, it blesses the fields and sends beasts to guard the town; angered, its thorns cut and its wolves come.'));
  const c = el('div', `card grove${g.blessed ? ' blessed' : g.angry ? ' angry' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🌳 ${g.mood}`), el('span', 'card-size', `favour ${g.favour > 0 ? '+' : ''}${g.favour}`));
  c.append(top, favourBar(g.favour));
  c.append(el('div', 'purpose', g.blessed ? 'Its blessing is on the fields and the foraging today.' : g.angry ? 'Its anger is on the fields; its thorns wait in the woods.' : 'Neither blessing nor curse today.'));
  c.append(el('div', 'purpose', `Next rite: ${g.nextRite.name}, in ${g.nextRite.days} day${g.nextRite.days > 1 ? 's' : ''}.`));
  out.push(
    expandable(c, 'grove', () => [
      facts([
        ['Blessed at', '+35: fields and foraging 15% better, and a guardian now and then'],
        ['Angered at', '−35: fields worse, thorns, wolves'],
        ['Guardians leave at', '−20'],
      ]),
    ]),
  );
  out.push(el('h2', '', 'Our ways: the guardians'));
  if (!g.guardians.length) out.push(el('div', 'hint', 'No guardians yet. When the grove is pleased, it sends a beast to guard the town.'));
  const grid = el('div', 'cards');
  for (const q of g.guardians) {
    const gc = el('div', 'card');
    const t = el('div', 'card-top');
    t.append(el('span', 'card-name', `${q.beast === 'bear' ? '🐻' : q.beast === 'boar' ? '🐗' : '🐺'} ${q.name}`), el('span', 'card-size', `${q.days} day${q.days === 1 ? '' : 's'}`));
    gc.append(t, el('div', 'purpose', `A great ${q.beast} of the grove. It fights beside the town in every raid.`));
    grid.append(gc);
  }
  if (g.guardians.length) out.push(grid);
  if (g.log.length) out.push(logList(g.log));
  return out;
}

function courtSection(h: HeritageView): HTMLElement[] {
  const c = h.court;
  if (!c) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the Court')];
  out.push(el('div', 'hint', 'Every few nights at moonrise the Fae Court comes with a bargain: a boon now, a price later. The fair folk always collect, and a price that can\'t be paid is taken another way. Refused, they sulk. Cold iron in the stores hurts them all; a charmed Court holds revels under the full moon.'));
  const card = el('div', `card court${c.revels ? ' blessed' : c.favour < -20 ? ' angry' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🧚 ${c.mood}`), el('span', 'card-size', `favour ${c.favour > 0 ? '+' : ''}${c.favour}`));
  card.append(top, favourBar(c.favour));
  card.append(el('div', 'purpose', `${c.struck} bargain${c.struck === 1 ? '' : 's'} struck, ${c.refused} refused. The next comes in about ${c.nextDays} day${c.nextDays === 1 ? '' : 's'}.`));
  if (c.ironHurts) card.append(el('div', 'lock short', `${c.iron} cold iron in the stores: the fair folk feel it.`));
  if (c.revels) card.append(el('div', 'purpose', 'Charmed: the Court holds revels under the full moon.'));
  out.push(card);
  if (c.debts.length) {
    out.push(el('h2', '', 'Our ways: what we owe'));
    for (const d of c.debts) {
      const dc = el('div', 'card');
      const t = el('div', 'card-top');
      t.append(el('span', 'card-name', d.title), el('span', 'card-size', d.days ? `due in ${d.days} day${d.days > 1 ? 's' : ''}` : 'due today'));
      dc.append(t, el('div', 'purpose', `The price: ${d.price}.`));
      out.push(dc);
    }
  }
  if (c.taken.length) out.push(el('div', 'hint', `Taken by the fair folk: ${c.taken.join(', ')}.`));
  if (c.log.length) out.push(logList(c.log));
  return out;
}

function workSection(h: HeritageView): HTMLElement[] {
  const w = h.work;
  if (!w) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the Great Work')];
  out.push(el('div', 'hint', 'Each morning the Crucible\'s best mind runs an experiment: a transmutation of base matter, or a potion for the town. Some explode. Each that works brings the Great Work on, through five stages, each opened by an offering, to the Philosopher\'s Stone: the Elixir of Life, and the game won.'));
  const c = el('div', 'card work');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `⚗ ${w.stageName}`), el('span', 'card-size', `stage ${w.stage} of 5`));
  c.append(top);
  if (w.next) {
    const row = el('div', 'bar-row');
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.round(Math.min(1, w.progress / w.next.at) * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'bar-label', 'Next'), bar, el('span', 'bar-text', `${w.next.name}: ${w.progress}/${w.next.at}`));
    c.append(row, el('div', 'purpose', `Offering: ${w.next.offering}. ${w.next.gift}`));
  } else c.append(el('div', 'purpose', 'The Great Work is complete.'));
  c.append(el('div', 'purpose', `${w.alchemist ? `${w.alchemist} works the athanor (${w.odds}% odds)` : 'Nobody at the athanor'} · ${w.worked} of ${w.tried} experiments worked, ${w.blasts} blew up`));
  out.push(c);
  if (w.homunculi.length) out.push(el('div', 'hint', `Homunculi at work: ${w.homunculi.join(', ')}.`));
  if (w.log.length) out.push(logList(w.log));
  return out;
}
