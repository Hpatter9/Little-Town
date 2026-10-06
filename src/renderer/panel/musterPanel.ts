// Raising a party yourself (sim/muster.ts), on a sheet over the Expeditions tab: the leader and their read of the odds,
// the party with why each was picked (drop someone, make someone leader), everyone else at home with whether they'd
// come (ask them; those who said no can be talked round with coins or ordered along), how boldly they go, what they
// pack, and Send them / Call it off.

import { RATIONS, MOST_EXTRA_TORCHES, type Rations } from '../../shared/data/muster';
import type { Bridge } from '../../shared/ipc';
import type { MusterPerson, MusterView } from '../../shared/sim/muster';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { face } from './townsfolkPanel';

const STAKES_TEXT = {
  safe: 'Careful: they keep clear of trouble. Fewer fights, lighter packs home.',
  risky: 'Bold: they go looking for it. More fights, half again as much brought home.',
};

export function renderMuster(m: MusterView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const send = (op: string, extra: Record<string, unknown> = {}) => bridge?.command({ type: 'muster', op, ...extra } as never);
  const sheet = el('div', 'muster-sheet over-tabs');
  const head = el('div', 'muster-head');
  head.append(el('div', 'muster-title', `A party for ${m.place}`), button('✕', () => send('cancel'), { cls: 'place quiet muster-x', title: 'Call it off' }));
  sheet.append(head);

  // the leader's word
  const leader = m.members.find((p) => p.id === m.leader) ?? m.members[0];
  const lv = leader && s.people.find((p) => p.id === leader.id);
  const brief = el('div', 'muster-brief');
  if (lv) brief.append(face(lv, s));
  const said = el('div', 'muster-said');
  said.append(el('div', 'muster-leader', leader ? `${leader.name} will lead` : 'Nobody to lead'), el('div', 'muster-odds', `“${m.odds}”`));
  brief.append(said);
  sheet.append(brief);

  // the party
  sheet.append(el('div', 'muster-h', `The party (${m.members.length} of up to ${m.most})`));
  for (const p of m.members) {
    const row = personRow(p, s);
    row.append(el('div', 'muster-why', p.reason ?? ''));
    const acts = el('div', 'muster-acts');
    if (p.id !== m.leader) acts.append(button('Lead', () => send('lead', { person: p.id }), { cls: 'place quiet', title: `Make ${p.name} the leader` }));
    if (m.members.length > 1) acts.append(button('Drop', () => send('drop', { person: p.id }), { cls: 'place quiet', title: `Leave ${p.name} at home` }));
    row.append(acts);
    sheet.append(row);
  }

  // everyone else at home
  const full = m.members.length >= m.most;
  sheet.append(el('div', 'muster-h', 'Ask someone else'));
  if (!m.others.length) sheet.append(el('div', 'hint', 'Nobody else is at home.'));
  for (const p of m.others) {
    const row = personRow(p, s);
    const acts = el('div', 'muster-acts');
    if (p.why) {
      row.append(el('div', 'muster-no', `${p.name} ${p.why}.`));
      if (p.price != null) acts.append(button(`Talk round (${p.price} coins)`, () => send('persuade', { person: p.id }), { disabled: m.treasury < p.price || full, title: 'Coins from the treasury into their purse, and they come gladly' }));
      acts.append(button('Order them', () => send('order', { person: p.id }), { cls: 'place quiet', disabled: full, title: 'They go, and resent it for a couple of days' }));
    } else {
      row.append(el('div', 'muster-why', p.keen ? 'would come' : 'may not want to'));
      acts.append(button('Ask along', () => send('add', { person: p.id }), { disabled: full }));
    }
    row.append(acts);
    sheet.append(row);
  }

  // how they go
  sheet.append(el('div', 'muster-h', 'How they go'));
  const stakes = el('div', 'row stakes');
  for (const k of ['safe', 'risky'] as const) stakes.append(button(k === 'safe' ? 'Careful' : 'Bold', () => send('set', { stakes: k }), { cls: m.stakes === k ? 'place on' : 'place quiet' }));
  sheet.append(stakes, el('div', 'hint', STAKES_TEXT[m.stakes]));

  // what they pack
  sheet.append(el('div', 'muster-h', 'What they pack'));
  const food = el('div', 'row stakes');
  for (const r of Object.keys(RATIONS) as Rations[]) food.append(button(RATIONS[r].name, () => send('set', { rations: r }), { cls: m.rations === r ? 'place on' : 'place quiet' }));
  sheet.append(food, el('div', 'hint', `Food: ${RATIONS[m.rations].text}.`));
  if (m.delve) {
    const t = el('div', 'row stakes');
    t.append(
      button('−', () => send('set', { torches: m.torches - 1 }), { cls: 'place quiet', disabled: m.torches <= 0 }),
      el('span', 'muster-count', `${m.torches} spare torch${m.torches === 1 ? '' : 'es'}`),
      button('+', () => send('set', { torches: m.torches + 1 }), { cls: 'place quiet', disabled: m.torches >= MOST_EXTRA_TORCHES }),
    );
    sheet.append(t, el('div', 'hint', 'Each torch is a unit of wood. More torches, further into the dark before they must turn back.'));
  }
  if (m.horsesHome) {
    const h = el('div', 'row stakes');
    h.append(button(m.horses ? 'Horses: taking them' : 'Horses: leaving them', () => send('set', { horses: !m.horses }), { cls: m.horses ? 'place on' : 'place quiet' }));
    sheet.append(h);
  }

  const foot = el('div', 'muster-foot');
  foot.append(button('Call it off', () => send('cancel'), { cls: 'place quiet' }), button('Send them', () => send('send'), { cls: 'place go', disabled: !m.members.length }));
  sheet.append(foot);
  return sheet;
}

function personRow(p: MusterPerson, s: Snapshot): HTMLElement {
  const row = el('div', 'muster-row');
  const pv = s.people.find((q) => q.id === p.id);
  if (pv) row.append(face(pv, s));
  const who = el('div', 'muster-who');
  who.append(el('div', 'muster-name', p.name), el('div', 'muster-sub', `${p.calling ?? 'No calling'} · level ${p.level}`));
  const bar = el('div', 'bar muster-hp');
  const fill = el('div', p.hp < p.maxHp * 0.5 ? 'bar-fill low' : 'bar-fill');
  fill.style.width = `${Math.round((p.hp / Math.max(1, p.maxHp)) * 100)}%`;
  bar.append(fill);
  who.append(bar);
  row.append(who);
  return row;
}
