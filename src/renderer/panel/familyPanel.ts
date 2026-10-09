// The People menu's Families tab (sim/lineage.ts `familiesView`, `snapshot.families`): each family line as a card (its
// name, renown, the living and the generations, a star when famous, its black sheep), and tapped, its tree: a row a
// generation, the line's founders at the top, each member a chip (the living bright, the dead with a cross, a child
// small, a black sheep marked), lines drawn from parents to children. Tapping a living member opens them.

import type { FamilyLine, KinNode } from '../../shared/sim/lineage';
import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { expandable, facts } from './details';

function tree(line: FamilyLine, open: (id: number) => void): HTMLElement {
  const box = el('div', 'kin-tree');
  const rows = new Map<number, KinNode[]>();
  for (const m of line.members) rows.set(m.gen, [...(rows.get(m.gen) ?? []), m]);
  const chips = new Map<number, HTMLElement>();
  for (const g of [...rows.keys()].sort((a, b) => a - b)) {
    const row = el('div', 'kin-row');
    // (couples side by side: each person beside their partner)
    const ms = rows.get(g)!.sort((a, b) => Math.min(a.id, a.partner ?? a.id) - Math.min(b.id, b.partner ?? b.id) || a.id - b.id);
    for (const m of ms) {
      const c = el('button', `kin${m.alive ? '' : ' dead'}${m.child ? ' child' : ''}${m.black ? ' black' : ''}`);
      c.append(el('span', 'kin-name', `${m.alive ? '' : '✝ '}${m.name}${m.black ? ' ⚑' : ''}`), el('span', 'kin-sub', m.child ? (m.master ? `apprentice to ${m.master}` : 'a child') : m.alive ? `${m.calling ?? 'no calling'} · lv ${m.level}` : (m.died ?? 'left the town')));
      if (m.titles.length) c.append(el('span', 'kin-sub kin-title', m.titles[0]));
      c.title = [m.black ? `The black sheep: ${m.black}` : '', m.died ?? '', m.trade ? `Learning ${m.trade}` : ''].filter(Boolean).join('\n');
      if (m.alive) c.addEventListener('click', (e) => (e.stopPropagation(), open(m.id)));
      chips.set(m.id, c);
      row.append(c);
    }
    box.append(row);
  }
  // the lines from parents to children, once laid out
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'kin-lines');
  box.prepend(svg);
  const draw = () => {
    if (!box.isConnected) return;
    const at = box.getBoundingClientRect();
    if (!at.width) return;
    svg.setAttribute('width', `${box.scrollWidth}`);
    svg.setAttribute('height', `${box.scrollHeight}`);
    svg.innerHTML = '';
    for (const m of line.members) {
      const c = chips.get(m.id);
      if (!c || !m.parents.length) continue;
      const ps = m.parents.map((q) => chips.get(q)).filter((x): x is HTMLElement => !!x);
      if (!ps.length) continue;
      const r = c.getBoundingClientRect();
      const x2 = r.left + r.width / 2 - at.left + box.scrollLeft;
      const y2 = r.top - at.top;
      const pr = ps.map((p) => p.getBoundingClientRect());
      const x1 = pr.reduce((t, b) => t + b.left + b.width / 2, 0) / pr.length - at.left + box.scrollLeft;
      const y1 = Math.max(...pr.map((b) => b.bottom)) - at.top;
      const mid = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} V${mid} H${x2} V${y2}`);
      path.setAttribute('class', m.black ? 'black' : '');
      svg.append(path);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(draw));
  return box;
}

export function familiesSection(s: Snapshot, open: (id: number) => void): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Families')];
  out.push(el('div', 'hint', 'The town\'s families and how they branch. Children go to lessons of a morning and learn a trade at a master\'s side of an afternoon; they take after their parents, and carry their grudges. When someone dies their home and purse go to their heir. A line grows famous by its deeds, and every family has its black sheep.'));
  if (!s.families.length) {
    out.push(el('p', 'empty', 'No families yet: the first child born in town begins one.'));
    return out;
  }
  for (const line of s.families) {
    const c = el('div', `card family${line.famous ? ' famous' : ''}`);
    const top = el('div', 'card-top');
    const title = line.name.charAt(0).toUpperCase() + line.name.slice(1);
    top.append(el('span', 'card-name', `${line.famous ? '★ ' : ''}${title}`), el('span', 'card-size', `${line.living} living · ${line.generations} generation${line.generations > 1 ? 's' : ''}`));
    c.append(top, el('div', 'hint', `Renown ${line.renown}${line.famous ? ' · a famous line' : ''}${line.blackSheep.length ? ` · black sheep: ${line.blackSheep.join(', ')}` : ''}`));
    out.push(
      expandable(c, `family:${line.root}`, () => [
        tree(line, open),
        facts([
          ['Members', `${line.members.length} (${line.members.filter((m) => !m.alive).length} dead)`],
          ['Children', `${line.members.filter((m) => m.child).length}`],
          ['Apprentices', line.members.filter((m) => m.master).map((m) => `${m.name} under ${m.master}`).join(', ') || 'none'],
        ]),
      ]),
    );
  }
  return out;
}
