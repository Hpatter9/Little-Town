// The hall of heroes (the Chronicle's Heroes tab): the famous among the living (their calling and level, raiders
// felled, trips, titles), the chronicle of each year past (written at midwinter: sim/annals.ts), and the fallen, newest
// first, with how and when they died and what they did.

import type { AnnalsView } from '../../shared/sim/snapshot';
import { el } from './dom';

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

export function renderHeroes(a: AnnalsView): HTMLElement[] {
  const out: HTMLElement[] = [];
  out.push(el('h2', '', 'The famous'));
  if (!a.famous.length) out.push(el('p', 'empty', 'Nobody has made a name for themselves yet.'));
  for (const f of a.famous) {
    const c = el('div', 'card hall-card');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${f.founder ? '★ ' : ''}${f.name}`), el('span', 'card-size', f.founder ? 'Leader' : ''));
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
    top.append(el('span', 'card-name', `${f.founder ? '★ ' : ''}${f.name}`), el('span', 'card-size', `Day ${f.day}`));
    c.append(top, el('div', 'hall-cause', `Died ${f.cause}.`), el('div', 'hint', deeds(f)));
    const t = titles(f.titles);
    if (t) c.append(t);
    out.push(c);
  }
  return out;
}
