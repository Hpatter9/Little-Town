// The town's alignment as two bars (sim/alignment.ts): good and evil (wicked on the left to radiant on the right), and
// order and chaos (anarchic to rigid), each with a marker for the town now, a tick for where its people's lore puts
// it, and the label; under them the town's title, the latest swings and their causes, and any pact with the Enemy.
import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';

function bar(kind: 'good' | 'order', value: number, home: number, left: string, right: string, label: string): HTMLElement {
  const box = el('div', 'align-axis');
  const track = el('div', `align-track ${kind}`);
  const pos = (v: number) => `${((Math.max(-100, Math.min(100, v)) + 100) / 2).toFixed(1)}%`;
  const h = el('span', 'align-home');
  h.style.left = pos(home);
  h.title = 'Where its people\'s nature draws the town back to';
  const mark = el('span', 'align-mark');
  mark.style.left = pos(value);
  track.append(h, mark);
  const ends = el('div', 'align-ends');
  ends.append(el('span', '', left), el('span', 'align-label', `${label} (${value > 0 ? '+' : ''}${value})`), el('span', '', right));
  box.append(track, ends);
  return box;
}

export function alignBar(s: Snapshot): HTMLElement {
  const a = s.align;
  const box = el('div', 'align-bar');
  box.append(bar('good', a.score, a.home, 'Wicked', 'Radiant', a.label), bar('order', a.order, a.orderHome, 'Chaos', 'Order', a.orderLabel));
  box.append(el('div', 'hint', `${a.title ? `${s.townName} ${a.title}. ` : ''}${a.line}`));
  if (a.pact) box.append(el('div', 'hint', a.pact));
  if (a.swings.length) box.append(el('div', 'hint', `Lately: ${a.swings.map((w) => `${w.why} ${w.delta > 0 ? '+' : ''}${Math.round(w.delta)}${w.axis ? ' (order)' : ''}`).join(' · ')}`));
  return box;
}
