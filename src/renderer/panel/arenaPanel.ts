// The People menu's Arena tab (sim/arena.ts `arenaView`, `snapshot.arena`): the season, tonight's card with the book
// (the odds, what the townsfolk have on it, and the treasury's bet: the player's only lever here), the bout under way to
// watch, the ladder of the season, the last bouts and the champions of past seasons.

import { PLAYER_BETS } from '../../shared/data/arena';
import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { expandable, facts } from './details';
import { button, el } from './dom';

export const arenaKey = (s: Snapshot) => {
  const a = s.arena;
  return JSON.stringify(a && [a.built, a.inSeason, a.season, a.renown, a.card && [a.card.id, a.card.hoursLeft, a.card.pot, a.card.treasury], a.bout, a.ladder.map((e) => [e.key, e.points]), a.past.length, a.past[0]?.day, a.champions.length, a.nextSeason, s.coins]);
};

export function arenaSection(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'The arena')];
  const a = s.arena;
  if (!a) {
    out.push(el('p', 'empty', 'No arena yet. Once the town is seven grown-ups strong and has learned Spear Hunting, it builds one, and holds a season of bouts each spring, summer and autumn.'));
    return out;
  }
  if (!a.built) out.push(el('div', 'hint', 'The arena is being built.'));
  out.push(el('div', 'hint', `${a.inSeason && a.season ? `In season: ${a.season}.` : a.nextSeason !== null ? `Out of season: the next opens in ${a.nextSeason} day${a.nextSeason === 1 ? '' : 's'}.` : 'Out of season.'} Renown ${a.renown} · ${a.master ? `Arena Master: ${a.master}` : 'no Arena Master yet'}`));

  if (a.bout) {
    const c = el('div', 'card arena-bout');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `⚔ ${a.bout.town} against ${a.bout.visitor}`), el('span', 'card-size', a.bout.over ? (a.bout.won ? 'Won' : 'Lost') : 'Fighting now'));
    c.append(top, el('div', 'purpose', `The visitor comes from ${a.bout.from}.`));
    if (!a.bout.over) c.append(button('Watch the bout', () => bridge?.command({ type: 'watch', expedition: a.bout!.id }), { cls: 'place' }));
    out.push(c);
  }
  if (a.card) {
    const k = a.card;
    const c = el('div', 'card arena-card');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', `${k.final ? '👑 The final: ' : 'Tonight: '}${k.town.name} against ${k.visitor.name}`), el('span', 'card-size', `in ${k.hoursLeft}h`));
    c.append(
      top,
      el('div', 'purpose', `${k.kind === 'beasts' ? 'A beast bout. ' : ''}${k.visitor.name} comes from ${k.visitor.from}. The book: ${k.pays.town}:1 on the town, ${k.pays.visitor}:1 on the visitor (it gives the town ${Math.round(k.odds * 100)}%).`),
      el('div', 'hint', `${k.bets} bet${k.bets === 1 ? '' : 's'}, ${k.pot} coins on it: ${k.backers.town} back the town, ${k.backers.visitor} the visitor.`),
    );
    const t = k.treasury;
    c.append(el('div', 'hint', t ? `The treasury has ${t.amount} coins on the ${t.on === 'town' ? 'town' : 'visitor'}: it would bring back ${Math.floor(t.amount * k.pays[t.on])}.` : `Bet from the treasury (${s.coins} coins):`));
    for (const on of ['town', 'visitor'] as const) {
      const row = el('div', 'row bet-row');
      row.append(el('span', 'bet-on', on === 'town' ? `On ${k.town.name}` : `On ${k.visitor.name}`));
      for (const n of PLAYER_BETS) row.append(button(`${n}`, () => bridge?.command({ type: 'arenaBet', on, amount: n }), { cls: 'place small', disabled: n > s.coins + (t?.amount ?? 0) }));
      c.append(row);
    }
    if (t) c.append(button('Take the bet back', () => bridge?.command({ type: 'arenaBet', on: t.on, amount: 0 }), { cls: 'place small' }));
    out.push(c);
  } else if (a.inSeason && !a.bout) out.push(el('div', 'hint', "Today's bout is posted at noon and fought at five."));

  out.push(el('h2', '', 'Standings'));
  if (!a.ladder.length) out.push(el('p', 'empty', 'Nobody has fought this season yet.'));
  else {
    const t = el('table', 'grid ladder');
    const head = el('tr');
    for (const h of ['#', 'Fighter', 'W', 'L', 'Pts']) head.append(el('th', '', h));
    t.append(head);
    for (const e of a.ladder) {
      const tr = el('tr', e.side === 'visitor' ? 'visitor' : 'ours');
      tr.append(el('td', '', `${e.rank}`), el('td', '', `${e.side === 'beast' ? '🐾 ' : e.side === 'visitor' ? '' : '★ '}${e.name}${e.from ? ` (${e.from})` : ''}`), el('td', '', `${e.wins}`), el('td', '', `${e.losses}`), el('td', '', `${e.points}`));
      t.append(tr);
    }
    out.push(t, el('div', 'hint', 'A win is 3 points and a knockout 1 more. ★ the town\'s own, 🐾 its beasts. The top of the ladder takes the crown at the season\'s last bout.'));
  }
  if (a.past.length) {
    out.push(el('h2', '', 'Bouts'));
    for (const b of a.past) {
      const c = el('div', 'card');
      c.append(el('div', 'purpose', `Day ${b.day}: ${b.won ? `${b.town} beat ${b.visitor}` : `${b.visitor} beat ${b.town}`}${b.ko ? ' (struck down)' : ''}${b.died ? `. ${b.died} died.` : ''}`));
      out.push(expandable(c, `bout:${b.day}:${b.town}`, () => [facts([['Visitor from', b.from], ['Bet on it', `${b.pot} coins`]])]));
    }
  }
  if (a.champions.length) {
    out.push(el('h2', '', 'Champions'));
    for (const c of a.champions) out.push(el('div', 'hint', `👑 ${c.name}${c.from ? ` of ${c.from}` : ''} · ${c.season.split(':')[1]}, year ${c.season.split(':')[0]}`));
  }
  return out;
}
