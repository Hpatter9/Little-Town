// The Realm (sim/factions.ts), under the Expeditions menu: each power the town shares the land with, as a card (its
// name and lord, how it stands with the town, its temper and goodwill, its troops against the town's might, a war host
// on its way), with what the town may do about it (gifts, treaties, a marriage, war, demands, freeing a vassal, and
// at war, storming its stronghold); then the dungeons the whole town could storm.

import type { Bridge } from '../../shared/ipc';
import type { FactionView } from '../../shared/sim/factions';
import type { Snapshot } from '../../shared/sim/snapshot';
import { GIFT_COINS } from '../../shared/data/factions';
import { button, el } from './dom';

const OP_LABEL: Record<string, [string, string]> = {
  gift: [`Send gifts (${GIFT_COINS})`, 'Coins from the treasury: they think better of the town'],
  peace: ['Propose peace', 'They agree if they bear the town no great grudge (sooner if they are losing a war)'],
  trade: ['Propose trade', 'Open roads: coins each day, and goodwill. Needs some warmth'],
  alliance: ['Propose an alliance', 'Their troops stand with the town against hosts and raids. Needs real warmth'],
  marry: ['Offer a match', 'One of theirs weds one of the town\'s: kin are slow to war on kin'],
  demand: ['Demand submission', 'Only a much weaker power kneels; the rest take offence'],
  free: ['Free them', 'A vassal released: peace, and gratitude'],
  war: ['Declare war', 'Breaking a treaty makes every power trust the town less'],
};

const STANCE_CLASS: Record<string, string> = { war: 'bad', neutral: 'mid', peace: 'ok', trade: 'ok', alliance: 'good', vassal: 'good', destroyed: 'gone' };

export function renderRealm(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'The realm')];
  const r = s.realm;
  out.push(el('div', 'hint', `The town's might in the field: ${r.might} (its grown-ups, the seasoned counting for more). Each power weighs its troops against it. Envoys come to the gate with offers and demands; answer them in the box that opens.`));
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
  head.append(el('div', 'realm-name', f.name), el('span', `realm-stance ${STANCE_CLASS[f.stance] ?? ''}`, f.known ? f.stanceName : 'Rumoured'));
  card.append(head);
  if (!f.known) {
    card.append(el('div', 'hint', 'Travellers speak of another power beyond the hills. Its envoys will come in time.'));
    return card;
  }
  card.append(el('div', 'realm-sub', `${f.lord}, of ${f.stronghold}${f.size === 'ruin' ? ' (in ruins)' : `, a ${f.size} of about ${f.folk}`} · ${f.temper.toLowerCase()}${f.married ? ' · kin by marriage' : ''}`));
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
  const acts = el('div', 'realm-acts');
  for (const op of f.can) {
    const [label, title] = OP_LABEL[op];
    acts.append(button(label, () => bridge?.command({ type: 'realm', faction: f.id, op } as never), { cls: op === 'war' ? 'place quiet danger' : 'place quiet', title, disabled: op === 'gift' && (s.coins ?? 0) < GIFT_COINS }));
  }
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
