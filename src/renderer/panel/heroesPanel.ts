// The hall of heroes (the Chronicle's Heroes tab): the famous among the living (their calling and level, raiders
// felled, trips, titles), the chronicle of each year past (written at midwinter: sim/annals.ts), and the fallen, newest
// first, with how and when they died and what they did.

import type { AnnalsView } from '../../shared/sim/snapshot';
import { el } from './dom';
import { foldedSection } from './structure';
import { icon } from '../ui/icon';
import { MILESTONES } from '../../shared/data/tiers';
import { fallenGuildMark } from '../art/guildMarks';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function deeds(o: { felled: number; trips: number; level: number; calling: string | null }): string {
  const bits = [o.calling ? `${o.calling}, level ${o.level}` : `Level ${o.level}`];
  if (o.felled) bits.push(`${plural(o.felled, 'raider', 'raiders')} felled`);
  if (o.trips) bits.push(`${plural(o.trips, 'trip', 'trips')} abroad`);
  return bits.join(' · ');
}

function titles(list: string[]): HTMLElement | null {
  if (!list.length) return null;
  const row = el('div', 'hall-titles');
  for (const t of list) row.append(el('span', 'chip hall-title', t));
  return row;
}

/** `guildMark`: the badge of someone's guild, shown beside the name of the living (the fallen carry the badge of the guild they
 *  fell in on their record). */
export function renderHeroes(a: AnnalsView, guildMark?: (personId: number) => HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  // the generations and the firsts (sim/tiers.ts, sim/milestones.ts)
  if (a.generations?.length) {
    out.push(el('h2', '', 'The generations'));
    for (const g of a.generations) out.push(el('p', 'hall-line', g));
  }
  const firsts: HTMLElement[] = [];
  if (a.milestonesFrom && a.milestonesFrom > 1) firsts.push(el('p', 'hint', `The town’s firsts are kept from day ${a.milestonesFrom}; older ones were not written down.`));
  if (!a.milestones?.length) firsts.push(el('p', 'empty', 'The town’s firsts are written here as they happen.'));
  for (const m of a.milestones ?? []) {
    const c = el('div', 'card hall-card milestone');
    const top = el('div', 'card-top');
    const name = el('span', 'card-name');
    const mark = icon(m.icon);
    if (mark) name.append(mark, ' ');
    name.append(m.title);
    top.append(name, el('span', 'card-size', `Day ${m.day}`));
    c.append(top, el('div', 'hint', m.line));
    firsts.push(c);
  }
  out.push(foldedSection('journal', 'Milestones', firsts, `${a.milestones?.length ?? 0} of ${MILESTONES.length}`));
  out.push(el('h2', '', 'The famous'));
  if (!a.famous.length) out.push(el('p', 'empty', 'Nobody has made a name for themselves yet.'));
  for (const f of a.famous) {
    const c = el('div', 'card hall-card');
    const top = el('div', 'card-top');
    const name = el('span', 'card-name', `${f.founder ? '★ ' : ''}${f.name}`);
    const gm = guildMark?.(f.id);
    if (gm) name.append(' ', gm);
    top.append(name, el('span', 'card-size', f.founder ? 'Leader' : ''));
    c.append(top, el('div', 'hint', deeds(f)));
    const t = titles(f.titles);
    if (t) c.append(t);
    out.push(c);
  }
  out.push(el('h2', '', 'Chronicles'));
  if (!a.chronicles.length) out.push(el('p', 'empty', 'The first chronicle is written at midwinter.'));
  a.chronicles.forEach((ch, i) => {
    const d = el('details', 'card hall-chronicle') as HTMLDetailsElement;
    d.open = i === 0;
    const sum = el('summary', 'card-name', ch.title);
    d.append(sum);
    for (const line of ch.lines) d.append(el('p', 'hall-line', line));
    out.push(d);
  });
  out.push(el('h2', '', 'The fallen'));
  if (!a.fallen.length) out.push(el('p', 'empty', 'Nobody has died. Yet.'));
  for (const f of a.fallen) {
    const c = el('div', 'card hall-card fallen');
    const top = el('div', 'card-top');
    const fname = el('span', 'card-name', `${f.founder ? '★ ' : ''}${f.name}`);
    const fgm = fallenGuildMark(f);
    if (fgm) fname.append(' ', fgm);
    top.append(fname, el('span', 'card-size', `Day ${f.day}`));
    c.append(top, el('div', 'hall-cause', `Died ${f.cause}.`), el('div', 'hint', deeds(f)));
    const t = titles(f.titles);
    if (t) c.append(t);
    out.push(c);
  }
  return out;
}
