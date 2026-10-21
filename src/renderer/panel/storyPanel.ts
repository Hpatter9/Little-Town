// The Story tab (a tab of the founder card, `GROUPS.founder` in `subtabs.ts`): chapters about the founder, newest first, one book a founder. A founder who has died has a closed book,
// kept below the open one (sim/story.ts).

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';

/** The redraw key: the chapters written and whose book is open. */
export function storyKey(s: Snapshot): string {
  return s.story.map((b) => `${b.who}:${b.closed ? 'c' : 'o'}:${b.chapters.length}`).join(',');
}

export function renderStory(s: Snapshot): HTMLElement[] {
  if (!s.story.length) return [el('h2', '', 'The founder\'s story'), el('p', 'empty', 'Nothing is written yet. The first chapter comes with the first hour of the town.')];
  const out: HTMLElement[] = [];
  for (const b of s.story) {
    out.push(el('h2', '', b.closed ? `${b.name}'s story (closed)` : `${b.name}'s story`));
    for (const c of b.chapters) {
      const card = el('div', 'card story-chapter');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', c.title), el('span', 'card-size', `day ${c.day}`));
      card.append(top, ...c.lines.map((l) => el('div', 'purpose', l)));
      out.push(card);
    }
  }
  return out;
}
