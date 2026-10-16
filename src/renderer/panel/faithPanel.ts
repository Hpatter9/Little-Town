// The Town menu's Faith tab (sim/faith.ts, sim/religion.ts): the town's four gods, how each feels about it, what
// pleases and angers them, who follows them and when their feast days fall; the faithful (the priests, the zealots
// and the godless, the rival cult, the pilgrims); the miracles; and the latest signs. The town keeps them itself;
// this is to watch.

import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { cardLink } from './infoCard';
import { expandable, facts } from './details';

const ICON: Record<string, string> = { harvest: '🌾', hearth: '🔥', war: '⚔', sky: '⛈' };

/** What the tab shows, for its redraw key (buildPanel.ts `buildKey`). */
export const faithKey = (s: Snapshot) => {
  const r = s.religion;
  return [s.faith.gods.map((g) => g.favour), s.faith.signs[0]?.text, s.faith.nextRite, s.faith.places, r.priests.map((p) => p.id), r.followers, r.none, r.zealots, r.cult, r.miracles[0]?.text, r.log[0]?.text, r.pilgrimage, r.nextPilgrimage, r.feasts];
};

const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

export function faithSection(s: Snapshot): HTMLElement[] {
  const f = s.faith;
  const r = s.religion;
  if (!f.on) return [];
  const out: HTMLElement[] = [el('h2', '', 'The gods')];
  out.push(
    el(
      'div',
      'hint',
      f.places.length
        ? `Worshipped at ${f.places.join(', ').toLowerCase()} (+${f.worship} favour a day to each god).${f.nextRite !== null ? ` Next rite ${f.nextRite ? `in ${f.nextRite} day${f.nextRite > 1 ? 's' : ''}` : 'today'}.` : ''}`
        : 'Nowhere to worship yet: the gods grow cold toward the town. It will raise a shrine itself.',
    ),
  );
  const grid = el('div', 'cards');
  for (const g of f.gods) {
    const c = el('div', `card god god-${g.mood.replace(' ', '-')}`);
    const top = el('div', 'card-top');
    const name = el('span', 'card-name', `${ICON[g.domain] ?? ''} `);
    name.append(cardLink(g.name, { kind: 'god', id: g.domain })); // (its card: infoCard.ts)
    top.append(name, el('span', 'card-size', g.mood));
    c.append(top, el('div', 'purpose', `${g.title.charAt(0).toUpperCase() + g.title.slice(1)}, keeper of ${g.keeps}`));
    const bar = el('div', 'favour');
    const fill = el('div', `favour-fill ${g.favour >= 0 ? 'up' : 'down'}`);
    fill.style.width = `${Math.abs(g.favour) / 2}%`;
    fill.style[g.favour >= 0 ? 'left' : 'right'] = '50%';
    bar.append(fill);
    c.append(bar);
    const n = r.followers[g.domain];
    c.append(el('div', 'hint', `${n} follower${n === 1 ? '' : 's'} · feast day ${inDays(r.feasts[g.domain])}`));
    grid.append(
      expandable(c, `god:${g.domain}`, () => [
        facts([
          ['Favour', `${g.favour > 0 ? '+' : ''}${g.favour}`],
          ['Followers', n],
          ['Feast day', inDays(r.feasts[g.domain])],
          ['Pleased', `${g.blessing}`],
          ['Angered', `${g.wrath}`],
          ['Offerings', g.offer],
        ]),
      ]),
    );
  }
  out.push(grid);

  // the faithful: the priests, who believes what, the cult, the pilgrims
  out.push(el('h2', '', 'The faithful'));
  out.push(
    el(
      'div',
      'hint',
      r.priests.length
        ? `${r.priests.map((p) => `${p.name} (${p.place.toLowerCase()})`).join(', ')} keep${r.priests.length === 1 ? 's' : ''} the rites: the dawn prayer, the feast days, the funerals, a blessing on the defenders and on every party.`
        : f.places.length
          ? 'No priest yet: whoever holds the shrine keeps the rites. Until then the feast days pass unkept.'
          : 'No priest without a place of worship.',
    ),
  );
  const zealots = r.zealots ? ` ${r.zealots} zealot${r.zealots === 1 ? '' : 's'} among them.` : '';
  out.push(el('div', 'hint', `${r.none ? `${r.none} follow${r.none === 1 ? 's' : ''} no god.` : 'Everyone follows a god.'}${zealots}${r.idols ? ` ${r.idols} idol${r.idols === 1 ? '' : 's'} raised to miracles.` : ''}`));
  if (r.cult) out.push(el('div', 'sign wrath', `The cult of ${r.cult.name}: ${r.cult.members} follower${r.cult.members === 1 ? '' : 's'}, led by ${r.cult.leader}${r.cult.tolerated ? ', let be by the town' : ''}. It sours every god.`));
  if (r.pilgrimage) out.push(el('div', 'hint', `Pilgrims are on the road to ${r.pilgrimage}.`));
  else if (r.nextPilgrimage !== null) out.push(el('div', 'hint', `The next pilgrimage ${r.nextPilgrimage ? `in about ${r.nextPilgrimage} days` : 'when the priest is free'}.`));
  for (const e of r.log.slice(0, 5)) out.push(el('div', `sign ${e.kind === 'miracle' || e.kind === 'feast' || e.kind === 'pilgrim' ? 'bless' : e.kind === 'omen' || e.kind === 'wrath' || e.kind === 'cult' ? 'wrath' : ''}`, `Day ${e.day}: ${e.text}`));

  if (r.miracles.length) {
    out.push(el('h2', '', 'Miracles'));
    for (const m of r.miracles) out.push(el('div', 'sign bless', `Day ${m.day}: ${m.text}`));
  }
  out.push(el('h2', '', 'Signs from the gods'));
  if (!f.signs.length) out.push(el('p', 'empty', 'No sign yet.'));
  for (const g of f.signs) out.push(el('div', `sign ${g.kind}`, `Day ${g.day}: ${g.text}`));
  return out;
}
