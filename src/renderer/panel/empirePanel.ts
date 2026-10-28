// The Market menu's Trade empire tab (sim/tradeEmpire.ts `empireView`, `snapshot.empire`): the trading posts and what they
// earn, the caravans and ships on the roads, the merchant guilds' deals, the safety the treasury has bought, this
// season's takings, and the ledger of big deals and losses. The town runs all of it itself under the Trade direction.

import type { Snapshot } from '../../shared/sim/snapshot';
import { expandable, facts } from './details';
import { el } from './dom';

export const empireKey = (s: Snapshot) => {
  const v = s.empire;
  return v ? JSON.stringify([v.posts, v.caravans.map((c) => [c.id, c.hoursLeft]), v.deals, v.safety, v.season, v.standing, v.totals, v.log[0], s.direction]) : s.direction === 'trade' ? 'trade' : '';
};

const LEVEL = ['small post', 'busy market', 'great market'];

export function renderEmpire(s: Snapshot): HTMLElement[] {
  const v = s.empire;
  const out: HTMLElement[] = [el('h2', '', 'Trade empire')];
  if (!v) {
    out.push(
      el(
        'div',
        'hint',
        s.direction === 'trade'
          ? 'With a trade house (the marketplace) and a little spare coin, the town will found its first trading post at a far market it knows the way to: map a region with a scouting party, or meet a power.'
          : 'Set the town\'s direction to Trade (Town, More) and, once it has a trade house, it will found trading posts at far markets, run caravans between them, take the merchant guilds\' deals and spend its coin on safety.',
      ),
    );
    return out;
  }
  out.push(el('div', 'hint', `${v.posts.length} of ${v.allowed} posts · ${v.season.so_far} coins' cut so far this season, ${v.season.last} paid last season · standing with the guilds ${v.standing >= 0 ? '+' : ''}${v.standing}`));
  if (!v.posts.length) out.push(el('div', 'hint', 'No posts now. The town will try again when it can spare the coin, the goods and the people.'));
  for (const p of v.posts) {
    const card = el('div', `card empire-card lv${p.level}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${p.sea ? '⚓' : '⌂'} ${p.name}`), el('span', 'card-size', LEVEL[p.level] ?? 'great market'));
    card.append(top, el('div', 'purpose', `${p.folk.join(' and ')} keep it · ${p.total} coins earned${p.caravan ? ' · a caravan is on its way' : p.called ? ' · a caravan called this season' : ''}`));
    out.push(expandable(card, `post:${p.id}`, () => [facts([['Founded', `${p.age} days ago`], ['Cut so far this season', `${p.takings} coins`], ['Earned in all', `${p.total} coins`]]), 'A post earns the town a share of the trade at its market each season, more as it grows and when a caravan calls. Bandits, war or a power\'s decree can take it, and the folk with it.'])); 
  }

  if (v.caravans.length) {
    out.push(el('h2', '', 'Trade empire caravans'));
    for (const c of v.caravans) {
      const card = el('div', 'card empire-card');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', `${c.kind === 'ship' ? '⛵' : '🐪'} To ${c.to}`), el('span', 'card-size', `home in ~${c.hoursLeft}h`));
      card.append(top, el('div', 'purpose', `Carrying ${c.carrying}${c.coins ? ` · ${c.coins} coins expected` : ''}`));
      out.push(card);
    }
  }

  out.push(el('h2', '', 'Trade empire deals'));
  if (!v.deals.length) out.push(el('div', 'hint', 'No deals now. The merchant guilds offer a monopoly, a charter or a loan every few days to a town with posts and good standing.'));
  for (const d of v.deals) {
    const card = el('div', 'card empire-card');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${d.kind === 'monopoly' ? '👑' : d.kind === 'charter' ? '📜' : '💰'} ${d.guild}`), el('span', 'card-size', `${d.days} day${d.days === 1 ? '' : 's'} left`));
    card.append(top, el('div', 'purpose', d.text));
    out.push(card);
  }

  out.push(el('h2', '', 'Trade empire safety'));
  const sf = v.safety;
  const lines = [
    sf.tributes || sf.tributePaid ? `Tribute: ${sf.tributePaid} coins paid to turn raiders back; the next costs about ${sf.nextTribute} for a band of six.` : `Tribute: none paid yet; a band of six would cost about ${sf.nextTribute}.`,
    sf.mercs ? `Hired swords: ${sf.mercs.n} for ${sf.mercs.days} more day${sf.mercs.days === 1 ? '' : 's'}; they fight in raids and eat pay.` : 'Hired swords: none this season.',
    sf.protection ? `Protection: ${sf.protection.power} keeps the roads and the posts for ${sf.protection.days} more day${sf.protection.days === 1 ? '' : 's'}.` : 'Protection: no power is paid for it now.',
  ];
  const safe = el('div', 'card empire-card');
  for (const l of lines) safe.append(el('div', 'purpose', l));
  out.push(safe);

  const t = v.totals;
  out.push(el('div', 'hint', `So far: ${t.sent} caravans sent, ${t.lostCaravans} lost (${t.lostWorth} coins of goods) · ${t.founded} posts founded, ${t.lostPosts} lost · ${t.made} coins made${t.settled ? ` · ${t.settled} merchant${t.settled > 1 ? 's' : ''} settled` : ''}`));
  if (v.log.length) {
    out.push(el('h2', '', 'Trade empire ledger'));
    const ul = el('ul', 'log');
    for (const line of v.log) ul.append(el('li', '', line));
    out.push(ul);
  }
  return out;
}
