// The town's alignment as a bar (sim/alignment.ts): wicked on the left to radiant on the right, a marker for the town
// now, a tick for where its people's lore puts it, the label under it, and the latest swings and their causes.
import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';

export function alignBar(s: Snapshot): HTMLElement {
  const a = s.align;
  const box = el('div', 'align-bar');
  const track = el('div', 'align-track');
  const pos = (v: number) => `${((Math.max(-100, Math.min(100, v)) + 100) / 2).toFixed(1)}%`;
  const home = el('span', 'align-home');
  home.style.left = pos(a.home);
  home.title = 'Where its people\'s nature draws the town back to';
  const mark = el('span', 'align-mark');
  mark.style.left = pos(a.score);
  track.append(home, mark);
  const ends = el('div', 'align-ends');
  ends.append(el('span', '', 'Wicked'), el('span', 'align-label', `${a.label} (${a.score > 0 ? '+' : ''}${a.score})`), el('span', '', 'Radiant'));
  box.append(track, ends, el('div', 'hint', a.line));
  if (a.swings.length) box.append(el('div', 'hint', `Lately: ${a.swings.map((w) => `${w.why} ${w.delta > 0 ? '+' : ''}${Math.round(w.delta)}`).join(' · ')}`));
  return box;
}
