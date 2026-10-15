// The Town menu's Magic tab (sim/magic.ts): the town's mana and the wild magic, the schools it has learned, its casters
// at their study, the rites and when each can be cast again, and the latest of what magic has done. The town works its
// magic itself; this is to watch.

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { expandable, facts } from './details';

/** Changes whenever what the tab shows changes (folded into the Town menu's key through heritageKey). */
export const magicKey = (s: Snapshot) => JSON.stringify(s.magic && [s.magic.mana, s.magic.cap, s.magic.flux, s.magic.servants, s.magic.enchanted, s.magic.casters, s.magic.rites, s.magic.counts, s.magic.log[0], s.magic.schools.map((x) => x.known)]);

function meter(label: string, share: number, text: string, colour: string): HTMLElement {
  const row = el('div', 'bar-row');
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  fill.style.background = colour;
  bar.append(fill);
  row.append(el('span', 'bar-label', label), bar, el('span', 'bar-text', text));
  return row;
}

export function magicSection(s: Snapshot): HTMLElement[] {
  const m = s.magic;
  if (!m) return [];
  const out: HTMLElement[] = [el('h2', '', 'Magic')];
  const name = m.name.charAt(0).toUpperCase() + m.name.slice(1);
  out.push(meter(name, m.cap ? m.mana / m.cap : 0, `${m.mana} of ${m.cap} (+${m.perHour} an hour)`, '#6aa0ff'));
  out.push(meter('Wild', m.flux, m.flux >= 0.8 ? 'about to surge!' : m.flux >= 0.5 ? 'restless' : 'calm', m.flux >= 0.8 ? '#ff5050' : '#b070e0'));
  out.push(
    el(
      'div',
      'hint',
      `${m.towers.length ? `${m.towers.length} Mage Tower${m.towers.length > 1 ? 's' : ''} on the leylines (strength ${m.towers.map((t) => t.ley.toFixed(1)).join(', ')}).` : 'No Mage Tower yet: the town will raise one where the leylines run strongest.'}${m.servants ? ` ${m.servants} ${m.servantName} at work.` : ''}${m.enchanted ? ' The tools are enchanted.' : ''} Every rite stirs the wild magic; when it surges, people die.`,
    ),
  );
  // the schools
  out.push(el('h2', '', 'Schools of magic'));
  const grid = el('div', 'cards');
  for (const sc of m.schools) {
    const c = el('div', `card${sc.known ? '' : ' card-off'}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', sc.name), el('span', 'card-size', sc.shunned ? 'shunned' : sc.known ? 'learned' : 'not yet'));
    c.append(top, el('div', 'purpose', sc.text));
    grid.append(c);
  }
  out.push(grid);
  // the casters
  out.push(el('h2', '', 'Casters'));
  if (!m.casters.length) out.push(el('p', 'empty', 'Nobody in town casts spells yet.'));
  const cards = el('div', 'cards');
  for (const c of m.casters) {
    const card = el('div', 'card');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `🔮 ${c.name}`), el('span', 'card-size', c.locked ? 'locked away' : `${c.spells} spells`));
    card.append(top);
    if (c.studying) card.append(meter('Study', c.progress, c.studying, '#d8b440'));
    if (c.madness > 0.05) card.append(meter('Mind', c.madness, c.madness >= 0.75 ? 'fraying' : 'troubled', '#c04060'));
    cards.append(expandable(card, `mage:${c.id}`, () => [facts([['Mastery', `${Math.round(c.mastery * 100)}%`], ['Madness', `${Math.round(c.madness * 100)}%`]])]));
  }
  out.push(cards);
  // the rites
  if (m.rites.length) {
    out.push(el('h2', '', 'Rites'));
    for (const r of m.rites) out.push(el('div', 'sign', `${r.name} (${r.school}, ${r.mana} ${m.name}): ${r.readyHours ? `again in ${r.readyHours} h` : 'ready'}`));
  }
  out.push(el('div', 'hint', `So far: ${m.counts.rites} rites, ${m.counts.miscasts} miscasts, ${m.counts.surges} surges, ${m.counts.deaths} dead of magic.`));
  for (const l of m.log) out.push(el('div', 'sign', l));
  return out;
}
