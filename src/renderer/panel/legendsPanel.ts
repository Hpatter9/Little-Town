// The Hall of Legends (the Chronicle's Legends tab) and the New Town screen's choice of a line: every town gone by,
// kept across towns (renderer/legends.ts, sim/legacy.ts). At its head this town's own line when it is a descendant's
// (its spirits, its heirloom, the old town: sim/ancestors.ts); then the lines of descent, generation by generation;
// then every town, newest first.

import { ITEM_BY_ID } from '../../shared/data/items';
import { ORIGIN_DEFS } from '../../shared/data/origins';
import { legendLine, linesOf, type Legend, type LegendLine } from '../../shared/sim/legacy';
import type { EnemyLegend } from '../../shared/sim/greatEnemy';
import type { AncestryView } from '../../shared/sim/ancestors';
import { readLegends } from '../legends';
import { el } from './dom';
import { expandable, facts, list } from './details';

const FATE = { fell: 'Fell', won: 'Triumphed', retired: 'Set aside' } as const;
const FATE_MARK = { fell: ' †', won: ' ★', retired: '' } as const;

export function renderLegends(ancestry?: AncestryView | null): HTMLElement[] {
  const all = readLegends().reverse();
  const out: HTMLElement[] = [];
  if (ancestry) out.push(el('h2', '', 'Our line'), ourLine(ancestry));
  out.push(el('h2', '', 'Hall of Legends'));
  if (!all.length) return [...out, el('p', 'empty', 'No town has passed into legend yet. When this one falls, or you found another, it will be remembered here, and a descendant may found the next.')];
  out.push(el('div', 'hint', `${all.length} town${all.length === 1 ? '' : 's'} remembered. A new town may be founded by a descendant of any of them (New Town, the last step): the heirloom comes down, the ancestors may return as spirits, and the old town comes back.`));
  const lines = linesOf(all).filter((l) => l.founders.length > 1);
  if (lines.length) {
    out.push(el('h3', 'more-head', 'Lines of descent'));
    const grid = el('div', 'cards');
    for (const l of lines) grid.append(lineCard(l));
    out.push(grid);
  }
  out.push(el('h3', 'more-head', 'Every town'));
  const grid = el('div', 'cards');
  for (const l of all) grid.append(legendCard(l));
  out.push(grid);
  return out;
}

/** This town's own line: who it came of, the spirits that may come back, the heirloom and the old town. */
function ourLine(a: AncestryView): HTMLElement {
  const c = el('div', 'card legend ours');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', a.line), el('span', 'card-size', `${ordinal(a.generation)} generation`));
  c.append(top, el('div', 'purpose', `Of ${a.founder}, whose town ${a.fate === 'fell' ? 'fell' : a.fate === 'won' ? 'triumphed' : 'still stands'}. The line: ${[...a.forebears, 'this town'].join(' → ')}.`));
  if (a.heirloom) {
    const h = a.heirloom;
    c.append(el('div', `hint${h.cursed ? ' bad' : ''}`, `Heirloom: ${h.name}${h.plus ? ` +${h.plus}` : ''}, carried ${h.carried} generation${h.carried === 1 ? '' : 's'}${h.cursed ? ' · cursed' : h.lifted ? ' · its curse lifted' : ''}${h.bearer ? ` · borne by ${h.bearer}` : ' · in the stores'}`));
  }
  const place = a.place ? `${a.place.name}: ${a.place.laid ? 'its dead at rest' : a.place.found ? 'found, its dead restless' : 'somewhere on our land'}` : null;
  c.append(el('div', 'hint', [a.oldTown === 'power' ? `The old town stands: the Old House${a.house ? ` (${a.house.stance}, goodwill ${a.house.attitude})` : ''}` : 'The old town lies in ruins', place].filter(Boolean).join(' · ')));
  return expandable(c, 'legend:ours', () =>
    [
      facts([
        ['Spirits seen', `${a.visits}`],
        ...a.spirits.map((s): [string, string] => [s.fell ? `${s.name} †` : s.name, s.kin === 'forebear' ? 'a founder of the line' : [s.calling, s.level > 1 ? `level ${s.level}` : '', s.cause ? `died ${s.cause}` : '', s.kin === 'founder' ? 'the old founder' : ''].filter(Boolean).join(', ') || 'remembered']),
      ]),
      list('Lately', a.log),
    ].filter((x): x is HTMLElement => !!x),
  );
}

/** A line of descent: its founders in order, the towns we still remember, each marked by how it ended. */
function lineCard(l: LegendLine): HTMLElement {
  const c = el('div', 'card legend line');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', l.name), el('span', 'card-size', `${l.founders.length} generations`));
  const chain = el('div', 'legend-chain');
  const known = new Map(l.towns.map((t) => [t.founder, t]));
  l.founders.forEach((f, i) => {
    if (i) chain.append(el('span', 'legend-arrow', '→'));
    const t = known.get(f);
    chain.append(el('span', `legend-link${t ? ` ${t.fate}` : ' lost'}`, `${f}${t ? FATE_MARK[t.fate] : ''}`));
  });
  c.append(top, chain);
  return expandable(c, `line:${l.towns[0].id}`, () => l.towns.map((t) => legendCard(t)));
}

export function legendCard(l: Legend, picked?: boolean, onPick?: () => void): HTMLElement {
  const c = el(onPick ? 'button' : 'div', `card legend${onPick ? ' pick' : ''}${picked ? ' on' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${l.town ? `${l.town}: ` : ''}${l.founder}${l.generation > 1 ? ` (${ordinal(l.generation)} of the line)` : ''}`), el('span', 'card-size', picked ? 'Chosen' : FATE[l.fate]));
  c.append(top, el('div', 'purpose', `${ORIGIN_DEFS[l.origin]?.name ?? l.origin}${l.of ? ` · of ${l.of}` : ''} · ${legendLine(l)}`));
  if (l.heirloom && ITEM_BY_ID[l.heirloom]) c.append(el('div', `hint${l.cursed ? ' bad' : ''}`, `Heirloom: ${ITEM_BY_ID[l.heirloom].name}${l.heirloomCarried ? `, carried ${l.heirloomCarried} generation${l.heirloomCarried === 1 ? '' : 's'}` : ''}${l.cursed ? ' (cursed)' : ''}`));
  // (its Great Enemy, as the town ended: sim/greatEnemy.ts, kept on the legend by simHost.ts)
  const foe = (l as Legend & { enemy?: EnemyLegend }).enemy;
  if (foe) c.append(el('div', `hint${foe.fate === 'won' ? ' bad' : ''}`, foe.fate === 'beaten' ? `Slew ${foe.name}.` : foe.fate === 'won' ? `Broken by ${foe.name}. A descendant's town will meet it again.` : `${foe.name} still plotted against it.`));
  if (onPick) {
    c.addEventListener('click', onPick);
    return c;
  }
  return expandable(c, `legend:${l.id}`, () => [
    facts([
      ['Lasted', `${l.days} days`],
      ['Ended', new Date(l.ended).toLocaleDateString()],
      ['Renown', `${l.renown}`],
      ...l.heroes.map((h): [string, string] => [h.fell ? `${h.name} †` : h.name, `${h.calling ?? 'no calling'}, level ${h.level}${h.felled ? `, ${h.felled} felled` : ''}${h.cause ? `, died ${h.cause}` : ''}`]),
    ]),
  ]);
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
