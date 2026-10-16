// The Chronicle's Milestones filter: the generations (sim/tiers.ts) and the town's firsts (sim/milestones.ts), newest
// first, each with its mark, its line and its day.

import type { AnnalsView } from '../../shared/sim/snapshot';
import { MILESTONES } from '../../shared/data/tiers';
import { icon } from '../ui/icon';
import { el } from './dom';

export function renderMilestones(a: AnnalsView): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (a.generations?.length) {
    out.push(el('h2', '', 'The generations'));
    for (const g of a.generations) out.push(el('p', 'hall-line', g));
  }
  out.push(el('h2', '', `Milestones: ${a.milestones?.length ?? 0} of ${MILESTONES.length}`));
  if (a.milestonesFrom && a.milestonesFrom > 1) out.push(el('p', 'hint', `The town’s firsts are kept from day ${a.milestonesFrom}; older ones were not written down.`));
  if (!a.milestones?.length) out.push(el('p', 'empty', 'The town’s firsts are written here as they happen.'));
  for (const m of a.milestones ?? []) {
    const c = el('div', 'card hall-card milestone');
    const top = el('div', 'card-top');
    const name = el('span', 'card-name');
    const mark = icon(m.icon);
    if (mark) name.append(mark, ' ');
    name.append(m.title);
    top.append(name, el('span', 'card-size', `Day ${m.day}`));
    c.append(top, el('div', 'hint', m.line));
    out.push(c);
  }
  return out;
}
