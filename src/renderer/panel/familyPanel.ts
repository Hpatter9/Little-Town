// The People menu's Families tab (sim/lineage.ts `familiesView`, `snapshot.families`): each family line as a card (its
// name, renown, the living and the generations, a star when famous, its black sheep), and tapped, its tree: a row a
// generation, the line's founders at the top, each member a chip (the living bright, the dead with a cross, a child
// small, a black sheep marked), lines drawn from parents to children. Tapping a living member opens them.

import type { DynastyView } from '../../shared/sim/dynasty';
import type { IntrigueView } from '../../shared/sim/intrigue';
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

/** The ruling house, its feuds and friendships, and the heirlooms (sim/dynasty.ts): what the family trees below mean. */
function dynastyBlocks(d: DynastyView): HTMLElement[] {
  const out: HTMLElement[] = [];
  const r = d.ruling;
  if (r) {
    const c = el('div', `card dynasty ${r.stage}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `♛ ${r.name}`), el('span', 'card-size', r.stageText));
    c.append(top, el('div', 'hint', `Rules since day ${r.since} · strength ${r.strength} (best ${r.peak}) · ${r.living} living${r.head ? ` · led by ${r.head}` : ''}${r.heir ? ` · heir ${r.heir}` : ' · no heir'}`));
    if (r.crisis) c.append(el('div', 'hint warn', `Crisis: ${r.crisis}.`));
    if (r.scandal) c.append(el('div', 'hint warn', 'A scandal clings to the house.'));
    if (r.challenger) c.append(el('div', 'hint', `The ${r.challenger} is growing past it.`));
    out.push(
      expandable(c, 'dynasty:ruling', () => [
        ...d.past.map((p) => `${p.name}: days ${p.from}-${p.to}, ${p.fate}.`),
        ...d.log.slice(-8).map((e) => `Day ${e.day}: ${e.text}`),
      ]),
    );
  }
  const live = d.feuds.filter((f) => !f.ended);
  if (live.length || d.bonds.length) {
    const c = el('div', 'card');
    c.append(el('div', 'card-name', 'Feuds and friendships'));
    for (const f of live) c.append(el('div', 'hint', `⚔ ${f.a} and ${f.b}: ${f.why} (day ${f.since}, heat ${f.heat}).`));
    for (const f of d.feuds.filter((x) => x.ended).slice(-3)) c.append(el('div', 'hint', `✓ ${f.a} and ${f.b}: ended by ${f.ended!.how} (day ${f.ended!.day}).`));
    for (const b of d.bonds) c.append(el('div', 'hint', `♥ ${b.a} and ${b.b}: ${b.why}.`));
    out.push(c);
  }
  for (const l of d.heirlooms) {
    const c = el('div', `card heirloom${l.lost ? ' lost' : ''}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `◆ ${l.item}`), el('span', 'card-size', l.lost ? 'lost' : l.holder ? `carried by ${l.holder}` : 'in the family chest'));
    c.append(top, el('div', 'hint', `Of the ${l.house} · ${l.carried} generation${l.carried === 1 ? '' : 's'} passed${l.lost ? ` · lost: ${l.lost}` : ''}`));
    out.push(expandable(c, `heirloom:${l.item}`, () => l.story));
  }
  return out;
}

/** The houses' holdings and wealth, what is known of their crimes, and what the town whispers (sim/intrigue.ts). */
function intrigueBlocks(v: IntrigueView): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const x of v.houses) {
    const c = el('div', `card house${x.ring || x.crimes.length ? ' guilty' : ''}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${x.ruling ? '♛ ' : ''}${x.name}`), el('span', 'card-size', `${x.wealth} coins`));
    const own = [['home', x.holdings.homes], ['shop', x.holdings.shops], ['workshop', x.holdings.works], ['field', x.holdings.fields]].filter(([, n]) => (n as number) > 0).map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`);
    c.append(top, el('div', 'hint', `${own.length ? `Owns ${own.join(', ')}` : 'Owns no land'} · chest ${x.purse}${x.seats ? ` · ${x.seats} seat${x.seats === 1 ? '' : 's'} on the council` : ''}`));
    if (x.ring) c.append(el('div', 'hint warn', `Known for ${x.ring}.`));
    if (x.rumour) c.append(el('div', 'hint', `Whispered: ${x.rumour}`));
    out.push(x.crimes.length ? expandable(c, `house:${x.root}`, () => x.crimes) : c);
  }
  if (v.whispers.length) {
    const c = el('div', 'card whispers');
    c.append(el('div', 'card-name', 'Whispers'));
    for (const w of v.whispers) c.append(el('div', 'hint', `Day ${w.day}: ${w.text}`));
    out.push(c);
  }
  return out;
}

export function familiesSection(s: Snapshot, open: (id: number) => void): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Families')];
  out.push(el('div', 'hint', 'The town\'s families and how they branch. Children go to lessons of a morning and learn a trade at a master\'s side of an afternoon; they take after their parents, and carry their grudges. When someone dies their home and purse go to their heir. A line grows famous by its deeds, and every family has its black sheep.'));
  if (s.dynasty) out.push(...dynastyBlocks(s.dynasty));
  if (s.intrigue) out.push(...intrigueBlocks(s.intrigue));
  if (!s.families.length) {
    out.push(el('p', 'empty', 'No families yet: the first child born in town begins one.'));
    return out;
  }
  const tags = (root: number) => {
    const d = s.dynasty;
    if (!d) return '';
    return [
      d.ruling?.root === root ? '♛' : '',
      d.feuds.some((f) => !f.ended && (f.aRoot === root || f.bRoot === root)) ? '⚔' : '',
      d.bonds.some((b) => b.aRoot === root || b.bRoot === root) ? '♥' : '',
      d.heirlooms.some((l) => l.houseRoot === root && !l.lost) ? '◆' : '',
    ].filter(Boolean).join('');
  };
  for (const line of s.families) {
    const c = el('div', `card family${line.famous ? ' famous' : ''}`);
    const top = el('div', 'card-top');
    const title = line.name.charAt(0).toUpperCase() + line.name.slice(1);
    top.append(el('span', 'card-name', `${line.famous ? '★ ' : ''}${title}${tags(line.root) ? ` ${tags(line.root)}` : ''}`), el('span', 'card-size', `${line.living} living · ${line.generations} generation${line.generations > 1 ? 's' : ''}`));
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
