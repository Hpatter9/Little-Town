// The Realm (sim/factions.ts), under the Expeditions menu: each power the town shares the land with, as a card (its
// name and lord, how it stands with the town, its temper and goodwill, its troops against the town's might, a war host
// on its way, and what the town's council of war would do about it: the town keeps its own diplomacy, sim/war/), and
// at war, storming its stronghold; then the dungeons the whole town could storm. The wars themselves are on the War
// tab.

import type { Bridge } from '../../shared/ipc';
import type { FactionView } from '../../shared/sim/factions';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { cardLink } from './infoCard';

const STANCE_CLASS: Record<string, string> = { war: 'bad', neutral: 'mid', peace: 'ok', trade: 'ok', alliance: 'good', vassal: 'good', destroyed: 'gone' };

export function renderRealm(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'The realm')];
  const r = s.realm;
  out.push(el('div', 'hint', `The town's might in the field: ${r.might} (its grown-ups, the seasoned counting for more). Each power weighs its troops against it. Envoys come to the gate with offers and demands, and the town's council has its answer ready (by the town's direction and its name for good or ill); answer them yourself in the box that opens, or let the council's stand. The realm's wars are on the War tab.`));
  const cards = el('div', 'cards wide realm');
  for (const f of r.factions) cards.append(factionCard(f, s, bridge));
  out.push(cards);
  // storming: the strongholds of powers at war, and the dungeons
  out.push(el('h2', '', 'Assaults'));
  out.push(el('div', 'hint', 'Take the whole town to war: one long fight, wave after wave, their lord or the dungeon\'s master last. Stormed, a stronghold is plundered, some of its folk come over, and you decide whether it kneels or burns.'));
  const targets = el('div', 'realm-targets');
  for (const f of r.factions) if (f.assault) targets.append(stormRow(`Storm ${f.stronghold}`, `${f.name}: ${f.troops} under arms, ${f.lord} at the last.`, f.assault, s, bridge));
  for (const d of r.dungeons) targets.append(stormRow(d.name, d.threats + '.', d.dest, s, bridge));
  if (!targets.childElementCount) targets.append(el('div', 'hint', 'Nothing to storm yet: a power must be at war with the town, or a dungeon found by the scouts.'));
  out.push(targets);
  return out;
}

function factionCard(f: FactionView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const card = el('div', `card realm-card ${STANCE_CLASS[f.stance] ?? ''}`);
  const head = el('div', 'realm-head');
  const name = el('div', 'realm-name');
  name.append(f.known ? cardLink(f.name, { kind: 'faction', id: f.id }) : f.name); // (its card: infoCard.ts)
  head.append(name, el('span', `realm-stance ${STANCE_CLASS[f.stance] ?? ''}`, f.known ? f.stanceName : 'Rumoured'));
  card.append(head);
  if (!f.known) {
    card.append(el('div', 'hint', 'Travellers speak of another power beyond the hills. Its envoys will come in time.'));
    return card;
  }
  card.append(el('div', 'realm-sub', `${f.lord}, of ${f.stronghold}${f.size === 'ruin' ? ' (in ruins)' : `, a ${f.size} of about ${f.folk}`} · ${f.temper.toLowerCase()}${f.married ? ' · kin by marriage' : ''}`));
  if (f.kin) card.append(el('div', `realm-sub kin-${f.kin.value < 0 ? 'grudge' : 'friend'}`, `${f.kin.value < 0 ? 'An old grudge' : 'An old friendship'}: ${f.kin.why}.`));
  if (f.rising) {
    card.append(el('div', 'realm-sub kin-grudge', `A rising power, now ${f.rising.stage}: it grows as the town does. ${f.rising.line}`));
    for (const d of f.rising.deeds) card.append(el('div', 'realm-sub', `· ${d}`));
  }
  if (f.stance === 'destroyed') {
    card.append(el('div', 'hint', `${f.stronghold} lies in ruins.`));
    return card;
  }
  // goodwill, -100 to 100, as a bar from the middle
  const mood = el('div', 'realm-mood');
  const bar = el('div', 'realm-bar');
  const fill = el('div', `realm-fill ${f.attitude < 0 ? 'neg' : 'pos'}`);
  fill.style.left = `${50 + Math.min(0, f.attitude) / 2}%`;
  fill.style.width = `${Math.abs(f.attitude) / 2}%`;
  bar.append(fill);
  mood.append(el('span', 'realm-lbl', `Goodwill: ${f.mood}`), bar);
  card.append(mood);
  const odds = f.troops > s.realm.might * 1.2 ? 'stronger than the town' : f.troops < s.realm.might * 0.7 ? 'weaker than the town' : 'about the town\'s match';
  card.append(el('div', 'realm-sub', `${f.troops} under arms (${odds})${f.beaten ? ` · ${f.beaten} host${f.beaten === 1 ? '' : 's'} broken` : ''}${f.stormed ? ` · stormed ${f.stormed}×` : ''}`));
  if (f.host) card.append(el('div', 'realm-host', `⚔ A war host of ${f.host.size} marches on the town: here in ${f.host.hours} hour${f.host.hours === 1 ? '' : 's'}.`));
  if (f.council) card.append(el('div', 'realm-sub', `The council: ${f.council}`));
  const acts = el('div', 'realm-acts');
  if (f.assault) acts.append(button('Storm their stronghold…', () => bridge?.command({ type: 'muster', op: 'raise', dest: f.assault! } as never), { cls: 'place go', title: 'Raise the whole town for an assault' }));
  card.append(acts);
  return card;
}

function stormRow(name: string, text: string, dest: string, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const row = el('div', 'realm-target');
  const who = el('div', 'realm-who');
  who.append(el('div', 'realm-name', name), el('div', 'realm-sub', text));
  const busy = !!s.muster;
  row.append(who, button('Raise the town…', () => bridge?.command({ type: 'muster', op: 'raise', dest } as never), { cls: 'place go', disabled: busy, title: busy ? 'A party is already being raised' : 'Pick who marches' }));
  return row;
}
