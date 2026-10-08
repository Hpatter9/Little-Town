// The Town menu's Villages tab (sim/villages.ts): each daughter village the town has sent out, how big it is, who
// leads it and how they feel about the town, what it makes and sends, its latest news, and a gift from the treasury.
// The villages run themselves; this is to watch them (and to keep them sweet).

import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { VILLAGE_PEOPLE, GIFT_COINS, REBEL_AT, TITHE_AT } from '../../shared/data/villages';
import { button, el } from './dom';
import { expandable, facts, list } from './details';
import { showOnMap } from './townOverview';

const mood = (l: number, rebel: boolean) => (rebel ? 'Broken away' : l >= 75 ? 'Devoted' : l >= TITHE_AT ? 'Loyal' : l >= 35 ? 'Cool' : l >= REBEL_AT ? 'Sullen' : 'Seething');

export function villagesSection(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Daughter villages')];
  if (!s.villages.length) {
    out.push(el('p', 'empty', `None yet. Once the town has ${VILLAGE_PEOPLE} grown-ups or so, some will ask to go and found a village of their own out on the land.`));
    return out;
  }
  out.push(el('div', 'hint', 'They run themselves: they grow, send what they can spare by cart (free while loyal, else for coins), marry with the town, and send fighters when it is raided. Treated badly, one may break away.'));
  const grid = el('div', 'cards');
  for (const v of s.villages) {
    const c = el('div', `card village${v.rebel ? ' rebel' : ''}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `🏘 ${v.name}`), el('span', 'card-size', `${v.tier} of ${v.pop}`));
    c.append(top, el('div', 'purpose', `Led by ${v.leader}${v.leaderNature ? ` (${v.leaderNature.toLowerCase()})` : ''}. ${mood(v.loyalty, v.rebel)} toward the town.`));
    const bar = el('div', 'favour');
    const fill = el('div', `favour-fill ${v.loyalty >= 50 ? 'up' : 'down'}`);
    fill.style.width = `${Math.abs(v.loyalty - 50)}%`;
    fill.style[v.loyalty >= 50 ? 'left' : 'right'] = '50%';
    bar.append(fill);
    c.append(bar);
    const now: string[] = [];
    if (v.beset) now.push(`Beset by ${v.beset}!`);
    if (v.helpers.length) now.push(`${v.helpers.join(', ')} gone to help`);
    if (v.cartOut) now.push('A cart on the road to town');
    if (now.length) c.append(el('div', 'hint', now.join(' · ')));
    const row = el('div', 'row');
    row.append(
      button('Show on the map', () => showOnMap(bridge, { village: v.id }), { cls: 'place small no-expand' }),
      button(`Send a gift (${GIFT_COINS} coins)`, () => bridge?.command({ type: 'giftVillage', id: v.id }), { cls: 'place small quiet no-expand', disabled: !v.canGift }),
    );
    c.append(row);
    grid.append(
      expandable(c, `village:${v.id}`, () => [
        facts([
          ['Founded', `day ${v.founded}`],
          ['Loyalty', `${v.loyalty} of 100`],
          ['Makes', v.makes.join(', ') || 'little yet'],
          ['Waiting to send', `${v.goods}`],
          ['Its carts', v.rebel ? 'none: it keeps what it makes' : v.tithe ? 'tithe, free' : 'sold to the treasury'],
          ['Its folk', v.folk.map((f) => f.name).join(', ')],
        ]),
        ...[list('Lately', v.news)].filter((x): x is HTMLElement => !!x),
      ]),
    );
  }
  out.push(grid);
  return out;
}
