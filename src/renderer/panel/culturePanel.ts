// The town's ways (the Chronicle's Culture tab; sim/culture.ts): the traits the town has earned from its history and how
// each was earned, its customs, dishes and sayings, the fashion in its children's names, and what is rising. Nothing to
// do here: the town grows them itself.

import type { CultureView } from '../../shared/sim/culture';
import { el } from './dom';
import { expandable, facts } from './details';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const FASHION: Record<string, string> = { fallen: 'after the fallen', heroes: 'after heroes', gods: 'after the gods' };

/** A key for the panel's redraws (panel.ts). */
export const cultureKey = (v: CultureView | undefined) => (!v ? '' : `${v.held.map((t) => `${t.id}${t.strength}`).join(',')}|${v.rising.map((t) => `${t.id}${t.strength}`).join(',')}|${v.fashion}|${v.log.length}`);

export function renderCulture(v: CultureView | undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (!v || !v.held.length) {
    out.push(el('p', 'empty', 'The town has no ways of its own yet. They grow from what happens to it over the months: a hard winter, a raid beaten off, a long peace, the sea.'));
  } else {
    out.push(el('h2', '', 'The town\'s ways'));
    out.push(el('div', 'hint', `The town holds ${v.held.length} way${v.held.length === 1 ? '' : 's'} at once, and lets go of any that no later history keeps alive.${v.fashion ? ` Its children are named ${FASHION[v.fashion]}.` : ''}${v.tavern ? ` The tavern's sign reads "${v.tavern}".` : ''}`));
    for (const t of v.held) {
      const card = el('div', 'card culture-card');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', t.name), el('span', 'card-size', `${t.strength} strong`));
      card.append(top, el('div', 'hint', t.cause));
      out.push(
        expandable(card, `culture:${t.id}`, () => [
          el('p', '', `${t.custom}: ${t.customText}`),
          facts([
            ['Kept in', cap(t.season)],
            ['Dish', t.dish],
            ['Saying', t.saying],
            ['In the town', t.prop],
          ]),
        ]),
      );
    }
  }
  if (v?.rising.length) {
    out.push(el('h2', '', 'Taking root'));
    out.push(el('div', 'hint', 'Not yet customs: history that could become one if it comes again.'));
    for (const r of v.rising) out.push(el('div', 'hint', `${r.name} (${r.strength})`));
  }
  if (v?.log.length) {
    out.push(el('h2', '', 'How it came about'));
    for (const l of [...v.log].reverse()) out.push(el('div', 'hint', l.text));
  }
  return out;
}
