// The People menu's Guilds tab (sim/guilds.ts `guildsView`, `snapshot.guilds`): each guild or squad the town has formed
// as a card (its name, what it's for, its leader and members), and tapped, how it came about, what it does and its
// latest doings. Tapping a member opens them.

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { expandable, facts } from './details';

export function guildsSection(s: Snapshot, open: (id: number) => void): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Guilds')];
  out.push(el('div', 'hint', 'When the town finds it lacks something (a defence, healers, hunters, makers, traders, learning, or an elite squad for the worst fights), one of the townsfolk starts a guild for it, or the council votes one in. The town names it itself.'));
  if (!s.guilds.length) {
    out.push(el('p', 'empty', 'No guilds yet: they form as the town grows and finds what it lacks.'));
    return out;
  }
  for (const g of s.guilds) {
    const c = el('div', `card guild${g.role === 'elite' ? ' elite' : ''}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${g.role === 'elite' ? '⚔ ' : ''}${g.name}`), el('span', 'card-size', `${g.members.length} member${g.members.length === 1 ? '' : 's'}`));
    const chips = el('div', 'kin-row guild-chips');
    for (const m of g.members) {
      const b = el('button', 'kin');
      b.append(el('span', 'kin-name', `${m.lead ? '★ ' : ''}${m.name}`), el('span', 'kin-sub', m.lead ? `leader · lv ${m.level}` : `lv ${m.level}`));
      b.addEventListener('click', (e) => (e.stopPropagation(), open(m.id)));
      chips.append(b);
    }
    c.append(top, el('div', 'hint', `For ${g.what} · led by ${g.leader?.name ?? 'nobody'}`), chips);
    out.push(
      expandable(c, `guild:${g.id}`, () => [
        facts([
          ['Founded', `day ${g.founded}, ${g.by}`],
          ['What it does', g.perk],
        ]),
        ...(g.log.length ? [el('div', 'hint', g.log.join(' · '))] : []),
      ]),
    );
  }
  return out;
}
